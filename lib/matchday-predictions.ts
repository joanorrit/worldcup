import 'server-only';

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';
import { getPlayerBets, type PlayerBetMatch } from '@/lib/player-bets';
import {
  DEFAULT_PREDICTION_GROUP_ID,
  getPredictionGroup,
  type PredictionGroupId,
} from '@/lib/prediction-groups';
import type {
  HomepageMatchdayData,
  MatchdayGuess,
  MatchdayTeamMeta,
  MatchdayView,
} from '@/lib/matchday-types';
import { getWorldCupMatchCache, WORLD_CUP_TIME_ZONE, type WorldCupMatch } from '@/lib/world-cup-matches';

const BET_FILE_PATTERN = /^[a-z0-9_-]+\.csv$/i;
const TBD_TEAM_PATTERN = /^(tbd|to be determined|winner\b|runner-up\b|runner up\b|w\d+|l\d+)$/i;

interface PlayerPredictionSet {
  matchesByDateTime: Map<string, PlayerBetMatch[]>;
}

interface PredictionIndexes {
  exactGuesses: Map<string, MatchdayGuess[]>;
  playerSets: Array<{
    player: string;
    predictions: PlayerPredictionSet;
  }>;
}

interface KnockoutMatchIndex {
  advancedTeamsByStage: Map<string, Set<string>>;
  matchesByTeamPair: Map<string, WorldCupMatch>;
}

export const getHomepageMatchdays = cache(async (
  groupId: PredictionGroupId = DEFAULT_PREDICTION_GROUP_ID,
): Promise<HomepageMatchdayData> => {
  const cacheData = await getWorldCupMatchCache();
  const matches = cacheData?.matches ?? [];
  const predictionIndexes = await getPredictionIndexes(groupId);
  const knockoutMatchIndex = getKnockoutMatchIndex(matches);
  const occurrenceCounts = new Map<string, number>();

  const matchdays = matches.reduce<MatchdayView[]>((days, match) => {
    const dateTimeKey = getDateTimeKey(match.dateKey, match.displayTime);
    const occurrenceIndex = occurrenceCounts.get(dateTimeKey) ?? 0;
    occurrenceCounts.set(dateTimeKey, occurrenceIndex + 1);

    const viewMatch = {
      ...match,
      awayTeamMeta: getTeamMeta(match.awayTeam),
      guesses: getGuessesForMatch(match, predictionIndexes, knockoutMatchIndex, occurrenceIndex),
      homeTeamMeta: getTeamMeta(match.homeTeam),
    };
    const day = days.find((entry) => entry.dateKey === viewMatch.dateKey);

    if (day) {
      day.matches.push(viewMatch);
    } else {
      days.push({
        dateKey: viewMatch.dateKey,
        matches: [viewMatch],
      });
    }

    return days;
  }, []);

  const todayDateKey = getTodayDateKey(cacheData?.timeZone ?? WORLD_CUP_TIME_ZONE);

  return {
    generatedAt: cacheData?.generatedAt ?? null,
    initialDateKey: getInitialDateKey(matchdays, todayDateKey),
    matchdays,
    source: cacheData?.source ?? 'unavailable',
    todayDateKey,
    timeZone: cacheData?.timeZone ?? WORLD_CUP_TIME_ZONE,
  };
});

async function getPredictionIndexes(groupId: PredictionGroupId): Promise<PredictionIndexes> {
  const playerSlugs = await getPlayerSlugs(groupId);
  const playerBets = await Promise.all(
    playerSlugs.map(async (slug) => ({
      bets: await getPlayerBets(slug, groupId),
      player: formatPlayerName(slug),
    })),
  );

  const exactGuesses = new Map<string, MatchdayGuess[]>();
  const playerSets = playerBets.flatMap(({ bets, player }) => {
    if (!bets) {
      return [];
    }

    const matchesByDateTime = new Map<string, PlayerBetMatch[]>();

    for (const match of bets.matches) {
      const dateKey = getPredictionDateKey(match);
      const guess: MatchdayGuess = {
        player,
        homeGoals: match.homeGoals,
        awayGoals: match.awayGoals,
        homePenaltyGoals: match.homePenaltyGoals,
        awayPenaltyGoals: match.awayPenaltyGoals,
        homeTeam: match.homeTeam,
        homeTeamMeta: getTeamMeta(match.homeTeam),
        awayTeam: match.awayTeam,
        awayTeamMeta: getTeamMeta(match.awayTeam),
        teamsMatch: false,
        resultMatch: null,
        signMatch: null,
        knockoutAdvancementMatch: null,
        penaltyScoreMatch: null,
      };

      addExactGuess(exactGuesses, getExactMatchKey(dateKey, match.homeTeam, match.awayTeam), guess);
      addExactGuess(exactGuesses, getExactMatchKey(dateKey, match.awayTeam, match.homeTeam), {
        ...guess,
        awayGoals: match.homeGoals,
        awayPenaltyGoals: match.homePenaltyGoals,
        awayTeam: match.homeTeam,
        awayTeamMeta: getTeamMeta(match.homeTeam),
        homeGoals: match.awayGoals,
        homePenaltyGoals: match.awayPenaltyGoals,
        homeTeam: match.awayTeam,
        homeTeamMeta: getTeamMeta(match.awayTeam),
      });

      const dateTimeKey = getDateTimeKey(dateKey, match.time);
      const bucket = matchesByDateTime.get(dateTimeKey) ?? [];
      bucket.push(match);
      matchesByDateTime.set(dateTimeKey, bucket);
    }

    return [{
      player,
      predictions: { matchesByDateTime },
    }];
  });

  return { exactGuesses, playerSets };
}

async function getPlayerSlugs(groupId: PredictionGroupId): Promise<string[]> {
  const group = getPredictionGroup(groupId);

  try {
    const fileNames = await readdir(group.localBetsDir);

    return fileNames
      .filter((fileName) => BET_FILE_PATTERN.test(fileName))
      .map((fileName) => path.basename(fileName, '.csv').toLowerCase())
      .sort((a, b) => a.localeCompare(b));
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

function getGuessesForMatch(
  match: WorldCupMatch,
  indexes: PredictionIndexes,
  knockoutMatchIndex: KnockoutMatchIndex,
  occurrenceIndex: number,
): MatchdayGuess[] {
  const exactKey = getExactMatchKey(match.dateKey, match.homeTeam, match.awayTeam);
  const exactGuesses = indexes.exactGuesses.get(exactKey);
  const guessesByPlayer = new Map<string, MatchdayGuess>();

  if (exactGuesses && exactGuesses.length > 0) {
    for (const guess of exactGuesses) {
      const evaluationMatch = getPredictionEvaluationMatch(match, knockoutMatchIndex, guess);
      const teamsMatch = doPredictedTeamsMatchKnownFixtureTeams(evaluationMatch, guess);

      guessesByPlayer.set(guess.player, {
        ...guess,
        resultMatch: getResultMatch(evaluationMatch, guess, teamsMatch),
        signMatch: getSignMatch(evaluationMatch, guess, teamsMatch),
        knockoutAdvancementMatch: getKnockoutAdvancementMatch(knockoutMatchIndex, evaluationMatch, guess),
        penaltyScoreMatch: getPenaltyScoreMatch(evaluationMatch, guess, teamsMatch),
        teamsMatch,
      });
    }
  }

  const dateTimeKey = getDateTimeKey(match.dateKey, match.displayTime);
  const slotGuesses = indexes.playerSets.flatMap(({ player, predictions }) => {
    if (guessesByPlayer.has(player)) {
      return [];
    }

    const prediction = predictions.matchesByDateTime.get(dateTimeKey)?.[occurrenceIndex];

    if (!prediction) {
      return [];
    }

    const evaluationMatch = getPredictionEvaluationMatch(match, knockoutMatchIndex, prediction);
    const teamsMatch = doPredictedTeamsMatchKnownFixtureTeams(evaluationMatch, prediction);
    const guess = {
      player,
      homeGoals: prediction.homeGoals,
      awayGoals: prediction.awayGoals,
      homePenaltyGoals: prediction.homePenaltyGoals,
      awayPenaltyGoals: prediction.awayPenaltyGoals,
      homeTeam: prediction.homeTeam,
      homeTeamMeta: getTeamMeta(prediction.homeTeam),
      awayTeam: prediction.awayTeam,
      awayTeamMeta: getTeamMeta(prediction.awayTeam),
      teamsMatch,
      resultMatch: getResultMatch(evaluationMatch, prediction, teamsMatch),
      signMatch: getSignMatch(evaluationMatch, prediction, teamsMatch),
      knockoutAdvancementMatch: getKnockoutAdvancementMatch(knockoutMatchIndex, evaluationMatch, prediction),
      penaltyScoreMatch: getPenaltyScoreMatch(evaluationMatch, prediction, teamsMatch),
    };

    return [guess];
  });

  return sortGuesses([...guessesByPlayer.values(), ...slotGuesses]);
}

function addExactGuess(
  guessesByMatch: Map<string, MatchdayGuess[]>,
  key: string,
  guess: MatchdayGuess,
): void {
  const guesses = guessesByMatch.get(key) ?? [];
  guesses.push(guess);
  guessesByMatch.set(key, guesses);
}

function getKnockoutMatchIndex(matches: WorldCupMatch[]): KnockoutMatchIndex {
  const advancedTeamsByStage = new Map<string, Set<string>>();
  const matchesByTeamPair = new Map<string, WorldCupMatch>();

  for (const match of matches) {
    if (match.stage === 'GROUP_STAGE') {
      continue;
    }

    const teamPairKey = getTeamPairKey(match.homeTeam, match.awayTeam);

    if (teamPairKey) {
      const existingMatch = matchesByTeamPair.get(teamPairKey);

      if (!existingMatch || isMoreUsefulKnockoutMatch(match, existingMatch)) {
        matchesByTeamPair.set(teamPairKey, match);
      }
    }

    const advancingTeam = getActualAdvancingTeam(match);

    if (advancingTeam) {
      const teamsByStage = advancedTeamsByStage.get(match.stage) ?? new Set<string>();
      teamsByStage.add(advancingTeam.normalizedName);
      advancedTeamsByStage.set(match.stage, teamsByStage);
    }
  }

  return { advancedTeamsByStage, matchesByTeamPair };
}

function getPredictionEvaluationMatch(
  displayedMatch: WorldCupMatch,
  knockoutMatchIndex: KnockoutMatchIndex,
  prediction: Pick<PlayerBetMatch, 'homeTeam' | 'awayTeam'>,
): WorldCupMatch {
  if (displayedMatch.stage === 'GROUP_STAGE') {
    return displayedMatch;
  }

  const teamPairKey = getTeamPairKey(prediction.homeTeam, prediction.awayTeam);

  if (!teamPairKey) {
    return displayedMatch;
  }

  return knockoutMatchIndex.matchesByTeamPair.get(teamPairKey) ?? displayedMatch;
}

function isMoreUsefulKnockoutMatch(match: WorldCupMatch, existingMatch: WorldCupMatch): boolean {
  if (getActualAdvancingTeam(match) && !getActualAdvancingTeam(existingMatch)) {
    return true;
  }

  if (match.homeGoals !== null && match.awayGoals !== null && (existingMatch.homeGoals === null || existingMatch.awayGoals === null)) {
    return true;
  }

  return false;
}

function getInitialDateKey(matchdays: MatchdayView[], todayKey: string): string | null {
  if (matchdays.length === 0) {
    return null;
  }

  const today = matchdays.find((matchday) => matchday.dateKey === todayKey);

  if (today) {
    return today.dateKey;
  }

  const upcoming = matchdays.find((matchday) => matchday.dateKey > todayKey);

  return upcoming?.dateKey ?? matchdays[matchdays.length - 1].dateKey;
}

function getExactMatchKey(dateKey: string, homeTeam: string, awayTeam: string): string {
  return `${dateKey}|${normalizeTeamName(homeTeam)}|${normalizeTeamName(awayTeam)}`;
}

function getTeamPairKey(homeTeam: string, awayTeam: string): string | null {
  const teams = [normalizeTeamName(homeTeam), normalizeTeamName(awayTeam)]
    .filter((team) => team !== 'tbd')
    .sort((a, b) => a.localeCompare(b));

  if (teams.length !== 2 || teams[0] === teams[1]) {
    return null;
  }

  return teams.join('|');
}

function getDateTimeKey(dateKey: string, time: string | null): string {
  return `${dateKey}|${normalizeTime(time)}`;
}

function getPredictionDateKey(match: PlayerBetMatch): string {
  return match.date.toISOString().slice(0, 10);
}

function getTodayDateKey(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

function normalizeTime(time: string | null): string {
  const [hour = '', minute = ''] = (time ?? '').split(':');
  const normalizedHour = Number.parseInt(hour, 10);
  const normalizedMinute = Number.parseInt(minute, 10);

  if (!Number.isFinite(normalizedHour) || !Number.isFinite(normalizedMinute)) {
    return 'TBD';
  }

  return `${String(normalizedHour).padStart(2, '0')}:${String(normalizedMinute).padStart(2, '0')}`;
}

function normalizeTeamName(team: string): string {
  const normalized = team
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  if (!normalized || TBD_TEAM_PATTERN.test(normalized)) {
    return 'tbd';
  }

  return TEAM_ALIASES[normalized] ?? normalized;
}

function doPredictedTeamsMatchKnownFixtureTeams(
  match: WorldCupMatch,
  prediction: Pick<PlayerBetMatch, 'homeTeam' | 'awayTeam'>,
): boolean {
  const predictedTeams = new Set([
    normalizeTeamName(prediction.homeTeam),
    normalizeTeamName(prediction.awayTeam),
  ]);
  const knownFixtureTeams = [match.homeTeam, match.awayTeam]
    .map(normalizeTeamName)
    .filter((team) => team !== 'tbd');

  return knownFixtureTeams.every((team) => predictedTeams.has(team));
}

function getResultMatch(
  match: WorldCupMatch,
  prediction: Pick<PlayerBetMatch, 'homeTeam' | 'awayTeam' | 'homeGoals' | 'awayGoals'>,
  teamsMatch: boolean,
): boolean | null {
  if (match.homeGoals === null || match.awayGoals === null) {
    return null;
  }

  if (match.stage !== 'GROUP_STAGE' && !teamsMatch) {
    return false;
  }

  const predictionGoals = getPredictionGoalsForMatch(match, prediction);

  if (!predictionGoals) {
    return false;
  }

  return predictionGoals.homeGoals === match.homeGoals && predictionGoals.awayGoals === match.awayGoals;
}

function getSignMatch(
  match: WorldCupMatch,
  prediction: Pick<PlayerBetMatch, 'homeTeam' | 'awayTeam' | 'homeGoals' | 'awayGoals'>,
  teamsMatch: boolean,
): boolean | null {
  if (match.homeGoals === null || match.awayGoals === null) {
    return null;
  }

  if (match.stage !== 'GROUP_STAGE' && !teamsMatch) {
    return false;
  }

  const predictionGoals = getPredictionGoalsForMatch(match, prediction);

  if (!predictionGoals) {
    return false;
  }

  return getResultSign(predictionGoals.homeGoals, predictionGoals.awayGoals) === getResultSign(match.homeGoals, match.awayGoals);
}

function getPredictionGoalsForMatch(
  match: WorldCupMatch,
  prediction: Pick<PlayerBetMatch, 'homeTeam' | 'awayTeam' | 'homeGoals' | 'awayGoals'>,
): { homeGoals: number; awayGoals: number } | null {
  const homeGoals = Number.parseInt(prediction.homeGoals, 10);
  const awayGoals = Number.parseInt(prediction.awayGoals, 10);

  if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) {
    return null;
  }

  const predictedHomeTeam = normalizeTeamName(prediction.homeTeam);
  const predictedAwayTeam = normalizeTeamName(prediction.awayTeam);
  const actualHomeTeam = normalizeTeamName(match.homeTeam);
  const actualAwayTeam = normalizeTeamName(match.awayTeam);

  if (
    predictedHomeTeam !== 'tbd' &&
    predictedAwayTeam !== 'tbd' &&
    actualHomeTeam !== 'tbd' &&
    actualAwayTeam !== 'tbd' &&
    predictedHomeTeam === actualAwayTeam &&
    predictedAwayTeam === actualHomeTeam
  ) {
    return {
      homeGoals: awayGoals,
      awayGoals: homeGoals,
    };
  }

  return { homeGoals, awayGoals };
}

function getKnockoutAdvancementMatch(
  knockoutMatchIndex: KnockoutMatchIndex,
  match: WorldCupMatch,
  prediction: Pick<PlayerBetMatch, 'homeTeam' | 'awayTeam' | 'homeGoals' | 'awayGoals' | 'homePenaltyGoals' | 'awayPenaltyGoals'>,
): boolean | null {
  if (match.stage === 'GROUP_STAGE') {
    return null;
  }

  const actualAdvancingTeam = getActualAdvancingTeam(match);
  const predictedAdvancingTeam = getPredictedAdvancingTeam(prediction);

  if (!predictedAdvancingTeam) {
    return null;
  }

  if (knockoutMatchIndex.advancedTeamsByStage.get(match.stage)?.has(predictedAdvancingTeam.normalizedName)) {
    return true;
  }

  if (!actualAdvancingTeam) {
    return null;
  }

  return false;
}

function getPenaltyScoreMatch(
  match: WorldCupMatch,
  prediction: Pick<PlayerBetMatch, 'homeTeam' | 'awayTeam' | 'homePenaltyGoals' | 'awayPenaltyGoals'>,
  teamsMatch: boolean,
): boolean | null {
  if (match.homePenaltyGoals === null || match.awayPenaltyGoals === null) {
    return null;
  }

  if (!teamsMatch) {
    return false;
  }

  const predictionPenaltyGoals = getPredictionPenaltyGoalsForMatch(match, prediction);

  if (!predictionPenaltyGoals) {
    return false;
  }

  return (
    predictionPenaltyGoals.homePenaltyGoals === match.homePenaltyGoals &&
    predictionPenaltyGoals.awayPenaltyGoals === match.awayPenaltyGoals
  );
}

function getPredictionPenaltyGoalsForMatch(
  match: WorldCupMatch,
  prediction: Pick<PlayerBetMatch, 'homeTeam' | 'awayTeam' | 'homePenaltyGoals' | 'awayPenaltyGoals'>,
): { homePenaltyGoals: number; awayPenaltyGoals: number } | null {
  const homePenaltyGoals = Number.parseInt(prediction.homePenaltyGoals, 10);
  const awayPenaltyGoals = Number.parseInt(prediction.awayPenaltyGoals, 10);

  if (!Number.isFinite(homePenaltyGoals) || !Number.isFinite(awayPenaltyGoals)) {
    return null;
  }

  const predictedHomeTeam = normalizeTeamName(prediction.homeTeam);
  const predictedAwayTeam = normalizeTeamName(prediction.awayTeam);
  const actualHomeTeam = normalizeTeamName(match.homeTeam);
  const actualAwayTeam = normalizeTeamName(match.awayTeam);

  if (
    predictedHomeTeam !== 'tbd' &&
    predictedAwayTeam !== 'tbd' &&
    actualHomeTeam !== 'tbd' &&
    actualAwayTeam !== 'tbd' &&
    predictedHomeTeam === actualAwayTeam &&
    predictedAwayTeam === actualHomeTeam
  ) {
    return {
      homePenaltyGoals: awayPenaltyGoals,
      awayPenaltyGoals: homePenaltyGoals,
    };
  }

  return { homePenaltyGoals, awayPenaltyGoals };
}

function getActualAdvancingTeam(match: WorldCupMatch): { normalizedName: string; team: string } | null {
  if (match.winner === 'HOME_TEAM') {
    return getKnownTeam(match.homeTeam);
  }

  if (match.winner === 'AWAY_TEAM') {
    return getKnownTeam(match.awayTeam);
  }

  if (match.homeGoals === null || match.awayGoals === null || match.homeGoals === match.awayGoals) {
    return null;
  }

  return getKnownTeam(match.homeGoals > match.awayGoals ? match.homeTeam : match.awayTeam);
}

function getPredictedAdvancingTeam(
  prediction: Pick<PlayerBetMatch, 'homeTeam' | 'awayTeam' | 'homeGoals' | 'awayGoals' | 'homePenaltyGoals' | 'awayPenaltyGoals'>,
): { normalizedName: string; team: string } | null {
  const homeGoals = Number.parseInt(prediction.homeGoals, 10);
  const awayGoals = Number.parseInt(prediction.awayGoals, 10);

  if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) {
    return null;
  }

  if (homeGoals > awayGoals) {
    return getKnownTeam(prediction.homeTeam);
  }

  if (homeGoals < awayGoals) {
    return getKnownTeam(prediction.awayTeam);
  }

  const homePenaltyGoals = Number.parseInt(prediction.homePenaltyGoals, 10);
  const awayPenaltyGoals = Number.parseInt(prediction.awayPenaltyGoals, 10);

  if (!Number.isFinite(homePenaltyGoals) || !Number.isFinite(awayPenaltyGoals) || homePenaltyGoals === awayPenaltyGoals) {
    return null;
  }

  return getKnownTeam(homePenaltyGoals > awayPenaltyGoals ? prediction.homeTeam : prediction.awayTeam);
}

function getKnownTeam(team: string): { normalizedName: string; team: string } | null {
  const normalizedName = normalizeTeamName(team);

  if (normalizedName === 'tbd') {
    return null;
  }

  return { normalizedName, team };
}

function getResultSign(homeGoals: number, awayGoals: number): -1 | 0 | 1 {
  if (homeGoals > awayGoals) {
    return 1;
  }

  if (homeGoals < awayGoals) {
    return -1;
  }

  return 0;
}

function sortGuesses(guesses: MatchdayGuess[]): MatchdayGuess[] {
  return [...guesses].sort((a, b) => a.player.localeCompare(b.player));
}

function formatPlayerName(player: string) {
  return player.charAt(0).toUpperCase() + player.slice(1);
}

function isMissingFileError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}

function getTeamMeta(team: string): MatchdayTeamMeta {
  const normalizedName = normalizeTeamName(team);
  const knownTeam = TEAM_META_BY_NORMALIZED_NAME[normalizedName];

  if (!knownTeam) {
    return {
      code: normalizedName === 'tbd' ? 'TBD' : getFallbackTeamCode(team),
      flagSrc: null,
      team,
    };
  }

  return {
    code: knownTeam.code,
    flagSrc: `/flags/${knownTeam.flagSlug}.png`,
    team,
  };
}

function getFallbackTeamCode(team: string): string {
  const code = team
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '')
    .slice(0, 3)
    .toUpperCase();

  return code || 'TBD';
}

const TEAM_META_BY_NORMALIZED_NAME: Record<string, { code: string; flagSlug: string }> = {
  algeria: { code: 'ALG', flagSlug: 'algeria' },
  argentina: { code: 'ARG', flagSlug: 'argentina' },
  australia: { code: 'AUS', flagSlug: 'australia' },
  austria: { code: 'AUT', flagSlug: 'austria' },
  belgium: { code: 'BEL', flagSlug: 'belgium' },
  'bosnia and herzegovina': { code: 'BIH', flagSlug: 'bosnia-herzegovina' },
  brazil: { code: 'BRA', flagSlug: 'brazil' },
  canada: { code: 'CAN', flagSlug: 'canada' },
  'cape verde': { code: 'CPV', flagSlug: 'cape-verde-islands' },
  colombia: { code: 'COL', flagSlug: 'colombia' },
  'congo dr': { code: 'COD', flagSlug: 'congo-dr' },
  croatia: { code: 'CRO', flagSlug: 'croatia' },
  curacao: { code: 'CUW', flagSlug: 'curacao' },
  czechia: { code: 'CZE', flagSlug: 'czechia' },
  ecuador: { code: 'ECU', flagSlug: 'ecuador' },
  egypt: { code: 'EGY', flagSlug: 'egypt' },
  england: { code: 'ENG', flagSlug: 'england' },
  france: { code: 'FRA', flagSlug: 'france' },
  germany: { code: 'GER', flagSlug: 'germany' },
  ghana: { code: 'GHA', flagSlug: 'ghana' },
  haiti: { code: 'HAI', flagSlug: 'haiti' },
  iran: { code: 'IRN', flagSlug: 'iran' },
  iraq: { code: 'IRQ', flagSlug: 'iraq' },
  'ivory coast': { code: 'CIV', flagSlug: 'ivory-coast' },
  japan: { code: 'JPN', flagSlug: 'japan' },
  jordan: { code: 'JOR', flagSlug: 'jordan' },
  mexico: { code: 'MEX', flagSlug: 'mexico' },
  morocco: { code: 'MAR', flagSlug: 'morocco' },
  netherlands: { code: 'NED', flagSlug: 'netherlands' },
  'new zealand': { code: 'NZL', flagSlug: 'new-zealand' },
  norway: { code: 'NOR', flagSlug: 'norway' },
  panama: { code: 'PAN', flagSlug: 'panama' },
  paraguay: { code: 'PAR', flagSlug: 'paraguay' },
  portugal: { code: 'POR', flagSlug: 'portugal' },
  qatar: { code: 'QAT', flagSlug: 'qatar' },
  'saudi arabia': { code: 'KSA', flagSlug: 'saudi-arabia' },
  scotland: { code: 'SCO', flagSlug: 'scotland' },
  senegal: { code: 'SEN', flagSlug: 'senegal' },
  'south africa': { code: 'RSA', flagSlug: 'south-africa' },
  'south korea': { code: 'KOR', flagSlug: 'south-korea' },
  spain: { code: 'ESP', flagSlug: 'spain' },
  sweden: { code: 'SWE', flagSlug: 'sweden' },
  switzerland: { code: 'SUI', flagSlug: 'switzerland' },
  tunisia: { code: 'TUN', flagSlug: 'tunisia' },
  turkey: { code: 'TUR', flagSlug: 'turkey' },
  'united states': { code: 'USA', flagSlug: 'united-states' },
  uruguay: { code: 'URU', flagSlug: 'uruguay' },
  uzbekistan: { code: 'UZB', flagSlug: 'uzbekistan' },
};

const TEAM_ALIASES: Record<string, string> = {
  alemania: 'germany',
  'arabia saudi': 'saudi arabia',
  'arabia saudita': 'saudi arabia',
  argelia: 'algeria',
  belgica: 'belgium',
  'bosnia herzegovina': 'bosnia and herzegovina',
  'bosnia y herzegovina': 'bosnia and herzegovina',
  brasil: 'brazil',
  'cabo verde': 'cape verde',
  'cape verde islands': 'cape verde',
  camerun: 'cameroon',
  catar: 'qatar',
  'corea del norte': 'north korea',
  'corea del sur': 'south korea',
  'costa de marfil': 'ivory coast',
  'cote d ivoire': 'ivory coast',
  croacia: 'croatia',
  curazao: 'curacao',
  'czech republic': 'czechia',
  dinamarca: 'denmark',
  egipto: 'egypt',
  'emiratos arabes unidos': 'united arab emirates',
  escocia: 'scotland',
  eslovaquia: 'slovakia',
  eslovenia: 'slovenia',
  espana: 'spain',
  'estados unidos': 'united states',
  francia: 'france',
  holanda: 'netherlands',
  inglaterra: 'england',
  iran: 'iran',
  irak: 'iraq',
  irlanda: 'ireland',
  islandia: 'iceland',
  japon: 'japan',
  jordania: 'jordan',
  'korea republic': 'south korea',
  marruecos: 'morocco',
  'nueva zelanda': 'new zealand',
  noruega: 'norway',
  'paises bajos': 'netherlands',
  polonia: 'poland',
  'reino unido': 'england',
  'republica checa': 'czechia',
  'republica democratica del congo': 'congo dr',
  'rd congo': 'congo dr',
  rumania: 'romania',
  sudafrica: 'south africa',
  suecia: 'sweden',
  suiza: 'switzerland',
  tunez: 'tunisia',
  turquia: 'turkey',
  turkiye: 'turkey',
  ucrania: 'ukraine',
  usa: 'united states',
};
