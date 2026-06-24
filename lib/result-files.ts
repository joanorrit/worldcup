import 'server-only';

import path from 'node:path';
import { parse } from 'csv-parse/sync';

export const RESULT_FILE_PATTERN = /^Resultats_\d{4}_\d{2}_\d{2}\.csv$/;
export const RESULTS_BLOB_PREFIX = 'results/';
export const MAX_RESULT_CSV_BYTES = 1024 * 1024;

export function getSafeResultFileName(fileName: string): string {
  return path.basename(fileName);
}

export function isResultFileName(fileName: string): boolean {
  return RESULT_FILE_PATTERN.test(getSafeResultFileName(fileName));
}

export function validateResultCsvContent(content: string): string | null {
  let rows: Array<Record<string, string>>;

  try {
    rows = parse(content, {
      columns: true,
      bom: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<Record<string, string>>;
  } catch {
    return 'The CSV could not be parsed.';
  }

  if (rows.length === 0) {
    return 'The CSV is empty.';
  }

  const hasLeaderboardRow = rows.some((row) => row.Jugador?.trim() && row.Punts?.trim());

  if (!hasLeaderboardRow) {
    return 'The CSV must include leaderboard rows with Jugador and Punts columns.';
  }

  return null;
}
