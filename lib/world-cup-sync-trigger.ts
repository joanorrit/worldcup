import 'server-only';

import { waitUntil } from '@vercel/functions';
import { revalidatePath } from 'next/cache';
import type { HomepageMatchdayData, MatchdayMatch } from '@/lib/matchday-types';
import { revalidateWorldCupMatchCache, syncWorldCupMatches } from '@/lib/world-cup-matches';

const DEFAULT_SYNC_MIN_AGE_HOURS = 3;
const DEFAULT_LIVE_SYNC_MIN_AGE_MINUTES = 30;
const DEFAULT_AFTER_MATCH_BUFFER_MINUTES = 120;

export function scheduleWorldCupSyncIfNeeded(data: HomepageMatchdayData, pathToRevalidate = '/'): boolean {
  if (!shouldSyncWorldCupMatches(data)) {
    return false;
  }

  waitUntil(
    syncWorldCupMatches()
      .then(() => {
        revalidateWorldCupMatchCache();
        revalidatePath(pathToRevalidate);
      })
      .catch((error) => {
        console.error('Could not sync World Cup fixtures from homepage trigger.', error);
      }),
  );

  return true;
}

function shouldSyncWorldCupMatches(data: HomepageMatchdayData, now = new Date()): boolean {
  if (!process.env.FOOTBALL_DATA_API_TOKEN || !process.env.BLOB_READ_WRITE_TOKEN) {
    return false;
  }

  const todayMatches = data.matchdays.find((matchday) => matchday.dateKey === data.todayDateKey)?.matches ?? [];

  if (!todayMatches.some((match) => isAfterMatchSyncWindow(match, now))) {
    return false;
  }

  return isCacheOldEnough(data.generatedAt, getSyncMinAgeMs(todayMatches, now), now);
}

function isCacheOldEnough(generatedAt: string | null, minAgeMs: number, now: Date): boolean {
  if (!generatedAt) {
    return true;
  }

  const generatedAtTime = new Date(generatedAt).getTime();

  if (Number.isNaN(generatedAtTime)) {
    return true;
  }

  return now.getTime() - generatedAtTime >= minAgeMs;
}

function isAfterMatchSyncWindow(match: MatchdayMatch, now: Date): boolean {
  const matchStartTime = new Date(match.utcDate).getTime();

  if (Number.isNaN(matchStartTime)) {
    return false;
  }

  return now.getTime() >= matchStartTime + getAfterMatchBufferMs();
}

function getSyncMinAgeMs(todayMatches: MatchdayMatch[], now: Date): number {
  if (todayMatches.some((match) => isPostBufferUnfinishedMatch(match, now))) {
    return getPositiveNumberEnv('WORLD_CUP_LIVE_SYNC_MIN_AGE_MINUTES', DEFAULT_LIVE_SYNC_MIN_AGE_MINUTES) * 60 * 1000;
  }

  return getPositiveNumberEnv('WORLD_CUP_SYNC_MIN_AGE_HOURS', DEFAULT_SYNC_MIN_AGE_HOURS) * 60 * 60 * 1000;
}

function isPostBufferUnfinishedMatch(match: MatchdayMatch, now: Date): boolean {
  return !isFinalMatchStatus(match.status) && isAfterMatchSyncWindow(match, now);
}

function isFinalMatchStatus(status: string): boolean {
  return ['FINISHED', 'AWARDED'].includes(status);
}

function getAfterMatchBufferMs(): number {
  return (
    getPositiveNumberEnv('WORLD_CUP_SYNC_AFTER_MATCH_MINUTES', DEFAULT_AFTER_MATCH_BUFFER_MINUTES) * 60 * 1000
  );
}

function getPositiveNumberEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseFloat(rawValue);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
