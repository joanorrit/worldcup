import 'server-only';

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';
import { getPlayerBets, type PlayerBetMatch } from '@/lib/player-bets';
import type {
  HomepageMatchdayData,
  MatchdayGuess,
  MatchdayView,
} from '@/lib/matchday-types';
import { getWorldCupMatchCache, WORLD_CUP_TIME_ZONE, type WorldCupMatch } from '@/lib/world-cup-matches';

const BETS_DIR = path.join(process.cwd(), 'data', 'bets');
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

export const getHomepageMatchdays = cache(async (): Promise<HomepageMatchdayData> => {
  const cacheData = await getWorldCupMatchCache();
  const matches = cacheData?.matches ?? [];
  const predictionIndexes = await getPredictionIndexes();
  const occurrenceCounts = new Map<string, number>();

  const matchdays = matches.reduce<MatchdayView[]>((days, match) => {
    const dateTimeKey = getDateTimeKey(match.dateKey, match.displayTime);
    const occurrenceIndex = occurrenceCounts.get(dateTimeKey) ?? 0;
    occurrenceCounts.set(dateTimeKey, occurrenceIndex + 1);

    const viewMatch = {
      ...match,
      guesses: getGuessesForMatch(match, predictionIndexes, occurrenceIndex),
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

async function getPredictionIndexes(): Promise<PredictionIndexes> {
  const playerSlugs = await getPlayerSlugs();
  const playerBets = await Promise.all(
    playerSlugs.map(async (slug) => ({
      bets: await getPlayerBets(slug),
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
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        teamsMatch: false,
      };

      addExactGuess(exactGuesses, getExactMatchKey(dateKey, match.homeTeam, match.awayTeam), guess);
      addExactGuess(exactGuesses, getExactMatchKey(dateKey, match.awayTeam, match.homeTeam), {
        ...guess,
        awayGoals: match.homeGoals,
        awayTeam: match.homeTeam,
        homeGoals: match.awayGoals,
        homeTeam: match.awayTeam,
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

async function getPlayerSlugs(): Promise<string[]> {
  try {
    const fileNames = await readdir(BETS_DIR);

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
  occurrenceIndex: number,
): MatchdayGuess[] {
  const exactKey = getExactMatchKey(match.dateKey, match.homeTeam, match.awayTeam);
  const exactGuesses = indexes.exactGuesses.get(exactKey);
  const guessesByPlayer = new Map<string, MatchdayGuess>();

  if (exactGuesses && exactGuesses.length > 0) {
    for (const guess of exactGuesses) {
      guessesByPlayer.set(guess.player, {
        ...guess,
        teamsMatch: true,
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

    return [{
      player,
      homeGoals: prediction.homeGoals,
      awayGoals: prediction.awayGoals,
      homeTeam: prediction.homeTeam,
      awayTeam: prediction.awayTeam,
      teamsMatch: doPredictedTeamsMatchKnownFixtureTeams(match, prediction),
    }];
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
  prediction: PlayerBetMatch,
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

function sortGuesses(guesses: MatchdayGuess[]): MatchdayGuess[] {
  return [...guesses].sort((a, b) => a.player.localeCompare(b.player));
}

function formatPlayerName(player: string) {
  return player.charAt(0).toUpperCase() + player.slice(1);
}

function isMissingFileError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}

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
