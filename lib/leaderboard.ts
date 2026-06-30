import 'server-only';

import { list } from '@vercel/blob';
import { revalidateTag, unstable_cache } from 'next/cache';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import {
  getSafeResultFileName,
  isResultFileName,
} from '@/lib/result-files';
import {
  DEFAULT_PREDICTION_GROUP_ID,
  getLeaderboardBlobSnapshotCacheTag,
  getPredictionGroup,
  GROUP2_PREDICTION_GROUP_ID,
  type PredictionGroupConfig,
  type PredictionGroupId,
} from '@/lib/prediction-groups';

const CSV_DATE_PATTERN = /(\d{4})_(\d{2})_(\d{2})/;
const LEADERBOARD_BLOB_SNAPSHOT_CACHE_REVALIDATE_SECONDS = 24 * 60 * 60;
const PLAYER_PENALTIES: Record<string, number> = {
  riky: 180,
};

interface SnapshotSource {
  fileName: string;
  content: string;
  fallbackDate: Date;
}

export interface RawCsvRow {
  Jugador?: string;
  Signes?: string;
  Resultats?: string;
  'Diferència gols'?: string;
  Posicions?: string;
  'Setzens de final'?: string;
  Encreuaments?: string;
  Punts?: string;
}

export interface Standing {
  player: string;
  signs: number;
  exactResults: number;
  goalDifference: number;
  positions?: number;
  roundOf32?: number;
  brackets?: number;
  points: number;
  penalty: number;
  rank: number;
  rankMovement: number | null;
  pointMovement: number | null;
}

export interface LeaderboardSnapshot {
  dateKey: string;
  date: Date;
  fileName: string;
  standings: Standing[];
}

export interface LeaderboardData {
  snapshots: LeaderboardSnapshot[];
  latest: LeaderboardSnapshot | null;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export async function getLeaderboardData(
  groupId: PredictionGroupId = DEFAULT_PREDICTION_GROUP_ID,
): Promise<LeaderboardData> {
  const group = getPredictionGroup(groupId);
  const [localSources, blobSources] = await Promise.all([
    getLocalSnapshotSources(group),
    getCachedBlobSnapshotSources(group.id),
  ]);

  const sourcesByFileName = new Map<string, SnapshotSource>();

  for (const source of localSources) {
    sourcesByFileName.set(source.fileName, source);
  }

  for (const source of blobSources) {
    sourcesByFileName.set(source.fileName, source);
  }

  const loadedSnapshots = Array.from(sourcesByFileName.values()).map(readSnapshot);

  const snapshots = loadedSnapshots
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((snapshot, index, allSnapshots) => {
      const previous = index > 0 ? allSnapshots[index - 1] : null;
      return addMovement(snapshot, previous);
    });

  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  return { snapshots, latest };
}

export function revalidateLeaderboardBlobSnapshots(groupId: PredictionGroupId = DEFAULT_PREDICTION_GROUP_ID): void {
  revalidateTag(getLeaderboardBlobSnapshotCacheTag(groupId));
}

async function getLocalSnapshotSources(group: PredictionGroupConfig): Promise<SnapshotSource[]> {
  let fileNames: string[];

  try {
    fileNames = (await readdir(group.localResultsDir))
      .filter((fileName) => isResultFileName(fileName))
      .sort();
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }

  return Promise.all(
    fileNames.map(async (fileName) => {
      const filePath = path.join(group.localResultsDir, fileName);
      const [content, fileStat] = await Promise.all([readFile(filePath, 'utf8'), stat(filePath)]);

      return {
        fileName,
        content,
        fallbackDate: fileStat.mtime,
      };
    }),
  );
}

const getCachedDefaultBlobSnapshotSources = unstable_cache(
  () => getBlobSnapshotSources(getPredictionGroup(DEFAULT_PREDICTION_GROUP_ID)),
  [getLeaderboardBlobSnapshotCacheTag(DEFAULT_PREDICTION_GROUP_ID)],
  {
    revalidate: LEADERBOARD_BLOB_SNAPSHOT_CACHE_REVALIDATE_SECONDS,
    tags: [getLeaderboardBlobSnapshotCacheTag(DEFAULT_PREDICTION_GROUP_ID)],
  },
);

const getCachedGroup2BlobSnapshotSources = unstable_cache(
  () => getBlobSnapshotSources(getPredictionGroup(GROUP2_PREDICTION_GROUP_ID)),
  [getLeaderboardBlobSnapshotCacheTag(GROUP2_PREDICTION_GROUP_ID)],
  {
    revalidate: LEADERBOARD_BLOB_SNAPSHOT_CACHE_REVALIDATE_SECONDS,
    tags: [getLeaderboardBlobSnapshotCacheTag(GROUP2_PREDICTION_GROUP_ID)],
  },
);

function getCachedBlobSnapshotSources(groupId: PredictionGroupId): Promise<SnapshotSource[]> {
  if (groupId === GROUP2_PREDICTION_GROUP_ID) {
    return getCachedGroup2BlobSnapshotSources();
  }

  return getCachedDefaultBlobSnapshotSources();
}

async function getBlobSnapshotSources(group: PredictionGroupConfig): Promise<SnapshotSource[]> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    return [];
  }

  try {
    const sources: SnapshotSource[] = [];
    let cursor: string | undefined;

    do {
      const page = await list({
        cursor,
        prefix: group.resultsBlobPrefix,
        token,
      });

      const pageSources = await Promise.all(
        page.blobs.map(async (blob) => {
          const fileName = getSafeResultFileName(blob.pathname);

          if (!isResultFileName(fileName)) {
            return null;
          }

          const response = await fetch(blob.url, { cache: 'no-store' });

          if (!response.ok) {
            throw new Error(`Could not read uploaded result CSV ${fileName}.`);
          }

          return {
            fileName,
            content: await response.text(),
            fallbackDate: blob.uploadedAt,
          };
        }),
      );

      for (const source of pageSources) {
        if (source) {
          sources.push(source);
        }
      }

      cursor = page.cursor;
    } while (cursor);

    return sources;
  } catch (error) {
    console.error(`Could not read Vercel Blob result CSVs for ${group.id}.`, error);
    return [];
  }
}

function readSnapshot(source: SnapshotSource): LeaderboardSnapshot {
  const rows = parse(source.content, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
  }) as RawCsvRow[];

  const standingsWithoutRanks = rows
    .map(normalizeRow)
    .filter((standing): standing is Omit<Standing, 'rank' | 'rankMovement' | 'pointMovement'> => Boolean(standing));

  return {
    dateKey: getDateKey(source.fileName, source.fallbackDate),
    date: getDate(source.fileName, source.fallbackDate),
    fileName: source.fileName,
    standings: rankStandings(standingsWithoutRanks),
  };
}

function normalizeRow(row: RawCsvRow): Omit<Standing, 'rank' | 'rankMovement' | 'pointMovement'> | null {
  const player = row.Jugador?.trim();

  if (!player) {
    return null;
  }

  const penalty = getPlayerPenalty(player);

  return {
    player,
    signs: parseScore(row.Signes),
    exactResults: parseScore(row.Resultats),
    goalDifference: parseScore(row['Diferència gols']),
    positions: parseOptionalScore(row.Posicions),
    roundOf32: parseOptionalScore(row['Setzens de final']),
    brackets: parseOptionalScore(row.Encreuaments),
    points: parseScore(row.Punts) - penalty,
    penalty,
  };
}

function rankStandings(
  entries: Array<Omit<Standing, 'rank' | 'rankMovement' | 'pointMovement'>>,
): Standing[] {
  let previousPoints: number | null = null;
  let currentRank = 0;

  return [...entries]
    .sort(compareEntries)
    .map((entry, index) => {
      if (entry.points !== previousPoints) {
        currentRank = index + 1;
        previousPoints = entry.points;
      }

      return {
        ...entry,
        rank: currentRank,
        rankMovement: null,
        pointMovement: null,
      };
    });
}

function compareEntries(
  a: Omit<Standing, 'rank' | 'rankMovement' | 'pointMovement'>,
  b: Omit<Standing, 'rank' | 'rankMovement' | 'pointMovement'>,
): number {
  return (
    b.points - a.points ||
    b.exactResults - a.exactResults ||
    b.signs - a.signs ||
    b.goalDifference - a.goalDifference ||
    a.player.localeCompare(b.player)
  );
}

function addMovement(
  snapshot: LeaderboardSnapshot,
  previous: LeaderboardSnapshot | null,
): LeaderboardSnapshot {
  if (!previous) {
    return snapshot;
  }

  const previousByPlayer = new Map(previous.standings.map((standing) => [standing.player, standing]));

  return {
    ...snapshot,
    standings: snapshot.standings.map((standing) => {
      const previousStanding = previousByPlayer.get(standing.player);

      return {
        ...standing,
        rankMovement: previousStanding ? previousStanding.rank - standing.rank : null,
        pointMovement: previousStanding ? standing.points - previousStanding.points : null,
      };
    }),
  };
}

function parseScore(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseOptionalScore(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getPlayerPenalty(player: string): number {
  return PLAYER_PENALTIES[player.trim().toLowerCase()] ?? 0;
}

function getDateKey(fileName: string, fallback: Date): string {
  const match = fileName.match(CSV_DATE_PATTERN);

  if (!match) {
    return fallback.toISOString().slice(0, 10);
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function getDate(fileName: string, fallback: Date): Date {
  const match = fileName.match(CSV_DATE_PATTERN);

  if (!match) {
    return fallback;
  }

  return new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
