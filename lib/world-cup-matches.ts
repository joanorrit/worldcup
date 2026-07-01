import 'server-only';

import { list, put } from '@vercel/blob';
import { revalidateTag, unstable_cache } from 'next/cache';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const FOOTBALL_DATA_BASE_URL = 'https://api.football-data.org/v4';
const LOCAL_DEVELOPMENT_MATCH_CACHE_PATH = path.join(process.cwd(), 'latest.json');
const LOCAL_MATCH_CACHE_PATH = path.join(process.cwd(), 'data', 'worldcup-matches.local.json');
const WORLD_CUP_MATCH_CACHE_TAG = 'world-cup-match-cache';
const WORLD_CUP_MATCH_CACHE_REVALIDATE_SECONDS = 24 * 60 * 60;

export const WORLD_CUP_CACHE_BLOB_PATH =
  process.env.WORLD_CUP_CACHE_BLOB_PATH ?? 'worldcup/matches/latest.json';
export const WORLD_CUP_COMPETITION_CODE = process.env.FOOTBALL_DATA_COMPETITION_CODE ?? 'WC';
export const WORLD_CUP_SEASON = Number.parseInt(process.env.WORLD_CUP_SEASON ?? '2026', 10);
export const WORLD_CUP_TIME_ZONE = process.env.WORLD_CUP_TIME_ZONE ?? 'Europe/Madrid';

export type WorldCupWinner = 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW';

export interface WorldCupMatch {
  id: string;
  sourceId: number;
  dateKey: string;
  utcDate: string;
  displayTime: string | null;
  status: string;
  stage: string;
  group: string | null;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number | null;
  awayGoals: number | null;
  homePenaltyGoals: number | null;
  awayPenaltyGoals: number | null;
  winner?: WorldCupWinner | null;
}

export interface WorldCupMatchCache {
  competitionCode: string;
  generatedAt: string;
  matches: WorldCupMatch[];
  season: number;
  source: string;
  timeZone: string;
}

interface FootballDataMatchesResponse {
  matches?: FootballDataMatch[];
}

interface FootballDataMatch {
  awayTeam?: FootballDataTeam | null;
  group?: string | null;
  homeTeam?: FootballDataTeam | null;
  id?: number;
  score?: {
    fullTime?: FootballDataScore | null;
    penalties?: FootballDataScore | null;
    regularTime?: FootballDataScore | null;
    winner?: string | null;
  } | null;
  stage?: string | null;
  status?: string | null;
  utcDate?: string | null;
}

interface FootballDataTeam {
  name?: string | null;
  shortName?: string | null;
  tla?: string | null;
}

interface FootballDataScore {
  away?: number | null;
  awayTeam?: number | null;
  home?: number | null;
  homeTeam?: number | null;
}

export async function getWorldCupMatchCache(): Promise<WorldCupMatchCache | null> {
  const cached = await readCachedBlobWorldCupMatchCache();

  if (cached) {
    return cached;
  }

  const developmentCache = await readLocalDevelopmentWorldCupMatchCache();

  if (developmentCache) {
    return developmentCache;
  }

  return readLocalWorldCupMatchCache();
}

export async function syncWorldCupMatches(): Promise<WorldCupMatchCache> {
  const matches = await fetchWorldCupMatchesFromApi();
  const cache: WorldCupMatchCache = {
    competitionCode: WORLD_CUP_COMPETITION_CODE,
    generatedAt: new Date().toISOString(),
    matches,
    season: WORLD_CUP_SEASON,
    source: 'football-data.org',
    timeZone: WORLD_CUP_TIME_ZONE,
  };

  await writeBlobWorldCupMatchCache(cache);

  return cache;
}

export function revalidateWorldCupMatchCache(): void {
  revalidateTag(WORLD_CUP_MATCH_CACHE_TAG);
}

async function fetchWorldCupMatchesFromApi(): Promise<WorldCupMatch[]> {
  const token = process.env.FOOTBALL_DATA_API_TOKEN;

  if (!token) {
    throw new Error('FOOTBALL_DATA_API_TOKEN is not configured.');
  }

  const url = new URL(`${FOOTBALL_DATA_BASE_URL}/competitions/${WORLD_CUP_COMPETITION_CODE}/matches`);
  url.searchParams.set('season', String(WORLD_CUP_SEASON));

  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'X-Auth-Token': token,
    },
  });

  if (!response.ok) {
    throw new Error(`football-data.org returned ${response.status} for World Cup matches.`);
  }

  const payload = (await response.json()) as FootballDataMatchesResponse;

  return (payload.matches ?? [])
    .map(normalizeFootballDataMatch)
    .filter((match): match is WorldCupMatch => Boolean(match))
    .sort(compareWorldCupMatches);
}

const readCachedBlobWorldCupMatchCache = unstable_cache(
  readBlobWorldCupMatchCache,
  [WORLD_CUP_MATCH_CACHE_TAG],
  {
    revalidate: WORLD_CUP_MATCH_CACHE_REVALIDATE_SECONDS,
    tags: [WORLD_CUP_MATCH_CACHE_TAG],
  },
);

async function readBlobWorldCupMatchCache(): Promise<WorldCupMatchCache | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    return null;
  }

  try {
    const page = await list({
      limit: 10,
      prefix: WORLD_CUP_CACHE_BLOB_PATH,
      token,
    });
    const blob = page.blobs.find((entry) => entry.pathname === WORLD_CUP_CACHE_BLOB_PATH);

    if (!blob) {
      return null;
    }

    const response = await fetch(blob.url, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Could not read World Cup match cache ${WORLD_CUP_CACHE_BLOB_PATH} from Blob.`);
    }

    return parseWorldCupMatchCache(await response.text());
  } catch (error) {
    console.error('Could not read World Cup match cache from Blob.', error);
    return null;
  }
}

async function readLocalDevelopmentWorldCupMatchCache(): Promise<WorldCupMatchCache | null> {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  try {
    return parseWorldCupMatchCache(await readFile(LOCAL_DEVELOPMENT_MATCH_CACHE_PATH, 'utf8'));
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    console.error('Could not read local development World Cup match cache.', error);
    return null;
  }
}

async function writeBlobWorldCupMatchCache(cache: WorldCupMatchCache): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured.');
  }

  await put(WORLD_CUP_CACHE_BLOB_PATH, JSON.stringify(cache, null, 2), {
    access: 'public',
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: 'application/json; charset=utf-8',
    token,
  });
}

async function readLocalWorldCupMatchCache(): Promise<WorldCupMatchCache | null> {
  try {
    return parseWorldCupMatchCache(await readFile(LOCAL_MATCH_CACHE_PATH, 'utf8'));
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    console.error('Could not read local World Cup match cache.', error);
    return null;
  }
}

function parseWorldCupMatchCache(content: string): WorldCupMatchCache | null {
  try {
    const parsed = JSON.parse(content) as Partial<WorldCupMatchCache>;

    if (!Array.isArray(parsed.matches)) {
      return null;
    }

    return {
      competitionCode: parsed.competitionCode ?? WORLD_CUP_COMPETITION_CODE,
      generatedAt: parsed.generatedAt ?? new Date(0).toISOString(),
      matches: parsed.matches.filter(isWorldCupMatch).map(normalizeCachedWorldCupMatch).sort(compareWorldCupMatches),
      season: parsed.season ?? WORLD_CUP_SEASON,
      source: parsed.source ?? 'local',
      timeZone: parsed.timeZone ?? WORLD_CUP_TIME_ZONE,
    };
  } catch {
    return null;
  }
}

function normalizeCachedWorldCupMatch(match: WorldCupMatch): WorldCupMatch {
  return {
    ...match,
    homePenaltyGoals: getScoreValue(match.homePenaltyGoals),
    awayPenaltyGoals: getScoreValue(match.awayPenaltyGoals),
  };
}

function normalizeFootballDataMatch(match: FootballDataMatch): WorldCupMatch | null {
  if (!match.id || !match.utcDate) {
    return null;
  }

  const date = new Date(match.utcDate);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const status = match.status ?? 'SCHEDULED';
  const score = getMatchScore(match.score);

  return {
    id: String(match.id),
    sourceId: match.id,
    dateKey: getDateKey(date, WORLD_CUP_TIME_ZONE),
    utcDate: date.toISOString(),
    displayTime: getDisplayTime(date, WORLD_CUP_TIME_ZONE),
    status,
    stage: match.stage ?? '',
    group: match.group ?? null,
    homeTeam: getTeamName(match.homeTeam, 'TBD'),
    awayTeam: getTeamName(match.awayTeam, 'TBD'),
    homeGoals: getScoreSideValue(score, 'home'),
    awayGoals: getScoreSideValue(score, 'away'),
    homePenaltyGoals: getScoreSideValue(match.score?.penalties, 'home'),
    awayPenaltyGoals: getScoreSideValue(match.score?.penalties, 'away'),
    winner: getWinnerValue(match.score?.winner),
  };
}

function getMatchScore(score: FootballDataMatch['score']) {
  if (hasCompleteScore(score?.regularTime)) {
    return score?.regularTime;
  }

  return score?.fullTime ?? null;
}

function hasCompleteScore(score: FootballDataScore | null | undefined): boolean {
  return getScoreSideValue(score, 'home') !== null && getScoreSideValue(score, 'away') !== null;
}

function getTeamName(team: FootballDataTeam | null | undefined, fallback: string): string {
  return team?.name?.trim() || team?.shortName?.trim() || team?.tla?.trim() || fallback;
}

function getScoreValue(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getScoreSideValue(score: FootballDataScore | null | undefined, side: 'home' | 'away'): number | null {
  if (!score) {
    return null;
  }

  return side === 'home'
    ? getScoreValue(score.home ?? score.homeTeam)
    : getScoreValue(score.away ?? score.awayTeam);
}

function getWinnerValue(value: string | null | undefined): WorldCupWinner | null {
  return value === 'HOME_TEAM' || value === 'AWAY_TEAM' || value === 'DRAW' ? value : null;
}

function getDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

function getDisplayTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone,
  }).format(date);
}

function compareWorldCupMatches(a: WorldCupMatch, b: WorldCupMatch): number {
  return (
    new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime() ||
    a.sourceId - b.sourceId
  );
}

function isWorldCupMatch(value: unknown): value is WorldCupMatch {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const match = value as Partial<WorldCupMatch>;

  return (
    typeof match.id === 'string' &&
    typeof match.sourceId === 'number' &&
    typeof match.dateKey === 'string' &&
    typeof match.utcDate === 'string' &&
    typeof match.status === 'string' &&
    typeof match.homeTeam === 'string' &&
    typeof match.awayTeam === 'string'
  );
}

function isMissingFileError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}
