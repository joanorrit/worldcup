import 'server-only';

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';
import { getPlayerBets, type KnockoutSection, type PlayerBetMatch } from '@/lib/player-bets';
import {
  DEFAULT_PREDICTION_GROUP_ID,
  getPredictionGroup,
  type PredictionGroupId,
} from '@/lib/prediction-groups';
import type { MatchdayTeamMeta } from '@/lib/matchday-types';
import { getWorldCupMatchCache, type WorldCupMatch } from '@/lib/world-cup-matches';

const BET_FILE_PATTERN = /^[a-z0-9_-]+\.csv$/i;
const TBD_TEAM_PATTERN = /^(tbd|to be determined|winner\b|runner-up\b|runner up\b|w\d+|l\d+)$/i;

export interface KnockoutTeamGuessMatch {
  awayGoals: string;
  awayPenaltyGoals: string;
  awayTeam: string;
  awayTeamMeta: MatchdayTeamMeta;
  dateKey: string;
  dateLabel: string;
  homeGoals: string;
  homePenaltyGoals: string;
  homeTeam: string;
  homeTeamMeta: MatchdayTeamMeta;
  knockoutAdvancementMatch: boolean | null;
  penaltyScoreMatch: boolean | null;
  resultMatch: boolean | null;
  round: string;
  signMatch: boolean | null;
  teamsMatch: boolean;
  time: string;
}

export interface KnockoutTeamGuessRow {
  match: KnockoutTeamGuessMatch | null;
  player: string;
}

export interface KnockoutTeamGuessData {
  actualAwayTeamMeta: MatchdayTeamMeta;
  actualHomeTeamMeta: MatchdayTeamMeta;
  actualMatch: WorldCupMatch;
  rows: KnockoutTeamGuessRow[];
  sectionTitle: string;
  selectedTeam: string;
  stageLabel: string;
}

interface KnockoutSectionConfig {
  id: string;
  stageLabel: string;
  title: string;
}

interface KnockoutMatchIndex {
  advancedTeamsByStage: Map<string, Set<string>>;
  matchesByTeamPair: Map<string, WorldCupMatch>;
}

const KNOCKOUT_SECTION_BY_STAGE: Record<string, KnockoutSectionConfig> = {
  FINAL: {
    id: 'final',
    stageLabel: 'Final',
    title: 'Final',
  },
  LAST_16: {
    id: 'octavos',
    stageLabel: 'Round of 16',
    title: 'Octavos',
  },
  LAST_32: {
    id: 'dieciseisavos',
    stageLabel: 'Round of 32',
    title: 'Dieciseisavos',
  },
  QUARTER_FINALS: {
    id: 'cuartos',
    stageLabel: 'Round of 8',
    title: 'Cuartos',
  },
  SEMI_FINALS: {
    id: 'semifinales',
    stageLabel: 'Semi-final',
    title: 'Semifinales',
  },
  THIRD_PLACE: {
    id: '3-y-4-puesto',
    stageLabel: 'Third place',
    title: '3º y 4º puesto',
  },
};

export const getKnockoutTeamGuessData = cache(async (
  groupId: PredictionGroupId = DEFAULT_PREDICTION_GROUP_ID,
  stageSlug: string,
  matchId: string,
  teamSlug: string,
): Promise<KnockoutTeamGuessData | null> => {
  const cacheData = await getWorldCupMatchCache();
  const actualMatch = cacheData?.matches.find((match) => match.id === matchId) ?? null;

  if (!actualMatch || actualMatch.stage === 'GROUP_STAGE' || getStageSlug(actualMatch.stage) !== stageSlug) {
    return null;
  }

  const selectedTeam = getSelectedActualTeam(actualMatch, teamSlug);

  if (!selectedTeam) {
    return null;
  }

  const sectionConfig = KNOCKOUT_SECTION_BY_STAGE[actualMatch.stage];

  if (!sectionConfig) {
    return null;
  }

  const playerSlugs = await getPlayerSlugs(groupId);
  const knockoutMatchIndex = getKnockoutMatchIndex(cacheData?.matches ?? []);
  const rows = await Promise.all(
    playerSlugs.map(async (playerSlug) => {
      const bets = await getPlayerBets(playerSlug, groupId);
      const section = bets?.knockoutSections.find((entry) => entry.id === sectionConfig.id);
      const match = section ? findTeamMatchInSection(section, selectedTeam) : null;

      return {
        match: match ? toKnockoutTeamGuessMatch(match, actualMatch, knockoutMatchIndex) : null,
        player: formatPlayerName(playerSlug),
      };
    }),
  );

  return {
    actualAwayTeamMeta: getTeamMeta(actualMatch.awayTeam),
    actualHomeTeamMeta: getTeamMeta(actualMatch.homeTeam),
    actualMatch,
    rows,
    sectionTitle: sectionConfig.title,
    selectedTeam,
    stageLabel: sectionConfig.stageLabel,
  };
});

function findTeamMatchInSection(section: KnockoutSection, team: string): PlayerBetMatch | null {
  const selectedTeamName = normalizeTeamName(team);

  return section.matches.find((match) => (
    normalizeTeamName(match.homeTeam) === selectedTeamName ||
    normalizeTeamName(match.awayTeam) === selectedTeamName
  )) ?? null;
}

function toKnockoutTeamGuessMatch(
  match: PlayerBetMatch,
  actualMatch: WorldCupMatch,
  knockoutMatchIndex: KnockoutMatchIndex,
): KnockoutTeamGuessMatch {
  const evaluationMatch = getPredictionEvaluationMatch(actualMatch, knockoutMatchIndex, match);
  const teamsMatch = doPredictedTeamsMatchKnownFixtureTeams(evaluationMatch, match);

  return {
    awayGoals: match.awayGoals,
    awayPenaltyGoals: match.awayPenaltyGoals,
    awayTeam: match.awayTeam,
    awayTeamMeta: getTeamMeta(match.awayTeam),
    dateKey: match.date.toISOString().slice(0, 10),
    dateLabel: match.dateLabel,
    homeGoals: match.homeGoals,
    homePenaltyGoals: match.homePenaltyGoals,
    homeTeam: match.homeTeam,
    homeTeamMeta: getTeamMeta(match.homeTeam),
    knockoutAdvancementMatch: getKnockoutAdvancementMatch(knockoutMatchIndex, evaluationMatch, match),
    penaltyScoreMatch: getPenaltyScoreMatch(evaluationMatch, match, teamsMatch),
    resultMatch: getResultMatch(evaluationMatch, match, teamsMatch),
    round: match.round,
    signMatch: getSignMatch(evaluationMatch, match, teamsMatch),
    teamsMatch,
    time: match.time,
  };
}

function getKnockoutMatchIndex(matches: WorldCupMatch[]): KnockoutMatchIndex {
  const advancedTeamsByStage = new Map<string, Set<string>>();
  const matchesByTeamPair = new Map<string, WorldCupMatch>();

  for (const match of matches) {
    if (match.stage === 'GROUP_STAGE') {
      continue;
    }

    const teamPairKey = getStageTeamPairKey(match.stage, match.homeTeam, match.awayTeam);

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
  const teamPairKey = getStageTeamPairKey(displayedMatch.stage, prediction.homeTeam, prediction.awayTeam);

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

function getTeamPairKey(homeTeam: string, awayTeam: string): string | null {
  const teams = [normalizeTeamName(homeTeam), normalizeTeamName(awayTeam)]
    .filter((team) => team !== 'tbd')
    .sort((a, b) => a.localeCompare(b));

  if (teams.length !== 2 || teams[0] === teams[1]) {
    return null;
  }

  return teams.join('|');
}

function getStageTeamPairKey(stage: string, homeTeam: string, awayTeam: string): string | null {
  const teamPairKey = getTeamPairKey(homeTeam, awayTeam);

  return teamPairKey ? `${stage}|${teamPairKey}` : null;
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

  if (!teamsMatch) {
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

  if (!teamsMatch) {
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

function getSelectedActualTeam(match: WorldCupMatch, teamSlug: string): string | null {
  if (matchesTeamSlug(match.homeTeam, teamSlug) && !isPlaceholderTeam(match.homeTeam)) {
    return match.homeTeam;
  }

  if (matchesTeamSlug(match.awayTeam, teamSlug) && !isPlaceholderTeam(match.awayTeam)) {
    return match.awayTeam;
  }

  return null;
}

function matchesTeamSlug(team: string, teamSlug: string): boolean {
  return getTeamSlug(team) === teamSlug || getRawTeamSlug(team) === teamSlug;
}

function getStageSlug(stage: string): string {
  return stage.toLowerCase().replace(/_/g, '-');
}

function getTeamSlug(team: string): string {
  return normalizeTeamName(team).replace(/\s+/g, '-');
}

function getRawTeamSlug(team: string): string {
  return team
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-+/g, '-');
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

function isPlaceholderTeam(team: string): boolean {
  return normalizeTeamName(team) === 'tbd';
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

function formatPlayerName(player: string) {
  return player.charAt(0).toUpperCase() + player.slice(1);
}

function isMissingFileError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
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
