import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { MatchdayLinks } from '@/lib/matchday-types';

const MATCH_LINKS_PATH = path.join(process.cwd(), 'data', 'match-links.json');

type RawMatchLinks = Record<string, unknown>;

export async function getMatchLinksById(): Promise<Map<string, MatchdayLinks>> {
  try {
    const payload = JSON.parse(await readFile(MATCH_LINKS_PATH, 'utf8')) as RawMatchLinks;
    const linksById = new Map<string, MatchdayLinks>();

    for (const [matchId, value] of Object.entries(payload)) {
      const links = normalizeMatchLinks(value);

      if (links) {
        linksById.set(matchId, links);
      }
    }

    return linksById;
  } catch (error) {
    if (isMissingFileError(error)) {
      return new Map();
    }

    console.error('Could not read local match links.', error);
    return new Map();
  }
}

function normalizeMatchLinks(value: unknown): MatchdayLinks | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const rawLinks = value as Record<string, unknown>;
  const links: MatchdayLinks = {};

  addUrl(links, 'highlightsUrl', rawLinks.highlightsUrl);
  addUrl(links, 'matchCenterUrl', rawLinks.matchCenterUrl);
  addUrl(links, 'previewUrl', rawLinks.previewUrl);

  if (typeof rawLinks.note === 'string' && rawLinks.note.trim()) {
    links.note = rawLinks.note.trim();
  }

  return Object.keys(links).length > 0 ? links : null;
}

function addUrl(links: MatchdayLinks, key: keyof MatchdayLinks, value: unknown): void {
  if (typeof value !== 'string') {
    return;
  }

  const trimmed = value.trim();

  if (!/^https?:\/\//i.test(trimmed)) {
    return;
  }

  links[key] = trimmed;
}

function isMissingFileError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}
