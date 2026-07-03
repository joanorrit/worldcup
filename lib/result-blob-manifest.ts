import 'server-only';

import { get, list, put, type ListBlobResultBlob, type PutBlobResult } from '@vercel/blob';
import {
  getSafeResultFileName,
  isResultFileName,
} from '@/lib/result-files';
import type { PredictionGroupConfig } from '@/lib/prediction-groups';

const RESULT_BLOB_MANIFEST_VERSION = 1;
const RESULT_BLOB_MANIFEST_FILE_NAME = 'index.json';

export interface ResultBlobManifestEntry {
  fileName: string;
  pathname: string;
  uploadedAt: string;
  url: string;
}

interface ResultBlobManifest {
  files?: unknown;
  version?: unknown;
}

export async function readResultBlobManifestEntries(
  group: PredictionGroupConfig,
  token: string,
): Promise<ResultBlobManifestEntry[] | null> {
  const manifest = await get(getResultBlobManifestPath(group), {
    access: 'public',
    token,
  });

  if (!manifest || manifest.statusCode !== 200) {
    return null;
  }

  try {
    const payload = JSON.parse(await new Response(manifest.stream).text()) as ResultBlobManifest;

    if (payload.version !== RESULT_BLOB_MANIFEST_VERSION || !Array.isArray(payload.files)) {
      return null;
    }

    const entries = payload.files.filter(isResultBlobManifestEntry);
    return entries.length === payload.files.length ? entries : null;
  } catch {
    return null;
  }
}

export async function listResultBlobManifestEntries(
  group: PredictionGroupConfig,
  token: string,
): Promise<ResultBlobManifestEntry[]> {
  const entries: ResultBlobManifestEntry[] = [];
  let cursor: string | undefined;

  do {
    const page = await list({
      cursor,
      prefix: group.resultsBlobPrefix,
      token,
    });

    for (const blob of page.blobs) {
      const entry = getResultBlobManifestEntry(blob);

      if (entry) {
        entries.push(entry);
      }
    }

    cursor = page.cursor;
  } while (cursor);

  return entries;
}

export async function upsertResultBlobManifestEntry(
  group: PredictionGroupConfig,
  token: string,
  blob: PutBlobResult,
): Promise<void> {
  const entry = getResultBlobManifestEntry({
    pathname: blob.pathname,
    uploadedAt: new Date(),
    url: blob.url,
  });

  if (!entry) {
    return;
  }

  let entries: ResultBlobManifestEntry[] | null = null;

  try {
    entries = await readResultBlobManifestEntries(group, token);
  } catch (error) {
    console.error(`Could not read result Blob manifest for ${group.id}.`, error);
  }

  if (!entries) {
    try {
      entries = await listResultBlobManifestEntries(group, token);
    } catch (error) {
      console.error(`Could not bootstrap result Blob manifest for ${group.id}.`, error);
      entries = [];
    }
  }

  const entriesByFileName = new Map(entries.map((existingEntry) => [existingEntry.fileName, existingEntry]));
  entriesByFileName.set(entry.fileName, entry);

  await put(
    getResultBlobManifestPath(group),
    JSON.stringify(
      {
        version: RESULT_BLOB_MANIFEST_VERSION,
        files: Array.from(entriesByFileName.values()).sort((a, b) => a.fileName.localeCompare(b.fileName)),
      },
      null,
      2,
    ),
    {
      access: 'public',
      allowOverwrite: true,
      cacheControlMaxAge: 60,
      contentType: 'application/json; charset=utf-8',
      token,
    },
  );
}

function getResultBlobManifestPath(group: PredictionGroupConfig): string {
  return `${group.resultsBlobPrefix}${RESULT_BLOB_MANIFEST_FILE_NAME}`;
}

function getResultBlobManifestEntry(
  blob: Pick<ListBlobResultBlob, 'pathname' | 'uploadedAt' | 'url'>,
): ResultBlobManifestEntry | null {
  const fileName = getSafeResultFileName(blob.pathname);

  if (!isResultFileName(fileName)) {
    return null;
  }

  return {
    fileName,
    pathname: blob.pathname,
    uploadedAt: blob.uploadedAt.toISOString(),
    url: blob.url,
  };
}

function isResultBlobManifestEntry(value: unknown): value is ResultBlobManifestEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as ResultBlobManifestEntry;

  return (
    isResultFileName(entry.fileName) &&
    typeof entry.pathname === 'string' &&
    typeof entry.uploadedAt === 'string' &&
    !Number.isNaN(new Date(entry.uploadedAt).getTime()) &&
    typeof entry.url === 'string'
  );
}
