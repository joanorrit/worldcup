import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

const BETS_DIR = path.join(process.cwd(), 'data', 'bets');
const DATE_PATTERN = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
const GROUP_LABEL_PATTERN = /^Grupo ([A-L])$/;

const KNOCKOUT_SECTION_CONFIGS = [
  { label: 'Dieciseisavos de final', title: 'Dieciseisavos' },
  { label: 'Octavos de final', title: 'Octavos' },
  { label: 'Cuartos de final', title: 'Cuartos' },
  { label: 'Semifinales', title: 'Semifinales' },
  { label: '3º y 4º puesto', title: '3º y 4º puesto' },
  { label: 'Final', title: 'Final' },
];

type DateOrder = 'month-first' | 'day-first';

export interface PlayerBetMatch {
  date: Date;
  dateLabel: string;
  time: string;
  round: string;
  stage: 'Group Stage' | 'Knockout Stage';
  homeTeam: string;
  awayTeam: string;
  homeGoals: string;
  awayGoals: string;
}

export interface GroupStanding {
  position: string;
  team: string;
  points: string;
  played: string;
  won: string;
  drawn: string;
  lost: string;
  goalsFor: string;
  goalsAgainst: string;
  goalDifference: string;
}

export interface PlayerBetGroup {
  id: string;
  title: string;
  standings: GroupStanding[];
  matches: PlayerBetMatch[];
}

export interface KnockoutSection {
  id: string;
  title: string;
  matches: PlayerBetMatch[];
}

export interface HonorRollItem {
  label: string;
  value: string;
}

export interface PlayerBets {
  player: string;
  matches: PlayerBetMatch[];
  groupStageGroups: PlayerBetGroup[];
  knockoutSections: KnockoutSection[];
  honorRoll: HonorRollItem[];
}

export async function getPlayerBets(player: string): Promise<PlayerBets | null> {
  const filePath = path.join(BETS_DIR, `${player}.csv`);
  let content: string;

  try {
    content = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }

  const rows = parse(content, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: false,
  }) as string[][];
  const dateOrder = detectDateOrder(rows);

  return {
    player,
    matches: rows.map((row) => normalizeMatchRow(row, dateOrder)).filter((match): match is PlayerBetMatch => Boolean(match)),
    groupStageGroups: extractGroupStageGroups(rows, dateOrder),
    knockoutSections: extractKnockoutSections(rows, dateOrder),
    honorRoll: extractHonorRoll(rows),
  };
}

function extractGroupStageGroups(rows: string[][], dateOrder: DateOrder) {
  return rows.flatMap((row, rowIndex) => {
    const groupMatch = getCell(row, 35).match(GROUP_LABEL_PATTERN);

    if (!groupMatch) {
      return [];
    }

    const id = groupMatch[1];
    const matches = rows
      .slice(rowIndex, rowIndex + 6)
      .map((matchRow) => normalizeMatchRow(matchRow, dateOrder))
      .filter((match): match is PlayerBetMatch => Boolean(match));

    return {
      id,
      title: `Group ${id}`,
      standings: rows
        .slice(rowIndex + 2, rowIndex + 6)
        .map(normalizeGroupStanding)
        .filter((standing): standing is GroupStanding => Boolean(standing)),
      matches,
    };
  });
}


function extractKnockoutSections(rows: string[][], dateOrder: DateOrder): KnockoutSection[] {
  const labelRows = KNOCKOUT_SECTION_CONFIGS.map((config) => ({
    ...config,
    rowIndex: rows.findIndex((row) => getCell(row, 22) === config.label),
  })).filter((config) => config.rowIndex >= 0);

  return labelRows.map((config, index) => {
    const nextConfig = labelRows[index + 1];
    const endIndex = nextConfig?.rowIndex ?? rows.length;
    const matches = rows
      .slice(config.rowIndex + 1, endIndex)
      .map((matchRow) => normalizeMatchRow(matchRow, dateOrder))
      .filter((match): match is PlayerBetMatch => Boolean(match));

    return {
      id: slugify(config.title),
      title: config.title,
      matches,
    };
  });
}

function extractHonorRoll(rows: string[][]): HonorRollItem[] {
  const startIndex = rows.findIndex((row) => getCell(row, 26) === 'Cuadro de honor');

  if (startIndex < 0) {
    return [];
  }

  return rows
    .slice(startIndex + 1, startIndex + 4)
    .map((row) => ({
      label: getCell(row, 22).replace(/^[^A-Za-zÀ-ÿ0-9]+/, ''),
      value: getCell(row, 26),
    }))
    .filter((item) => item.label && item.value);
}

function normalizeMatchRow(row: string[], dateOrder: DateOrder): PlayerBetMatch | null {
  const rawDate = getCell(row, 23);
  const homeTeam = getCell(row, 26);
  const awayTeam = getCell(row, 31);

  if (!DATE_PATTERN.test(rawDate) || !homeTeam || !awayTeam) {
    return null;
  }

  const date = parseCsvDate(rawDate, dateOrder);
  const round = getCell(row, 25);

  return {
    date,
    dateLabel: formatBetDate(date),
    time: getCell(row, 24),
    round,
    stage: round.startsWith('J') ? 'Group Stage' : 'Knockout Stage',
    homeTeam,
    awayTeam,
    homeGoals: getCell(row, 28),
    awayGoals: getCell(row, 29),
  };
}

function normalizeGroupStanding(row: string[]): GroupStanding | null {
  const position = getCell(row, 35);
  const team = getCell(row, 37);

  if (!position || !team) {
    return null;
  }

  return {
    position,
    team,
    points: getCell(row, 38),
    played: getCell(row, 39),
    won: getCell(row, 40),
    drawn: getCell(row, 41),
    lost: getCell(row, 42),
    goalsFor: getCell(row, 43),
    goalsAgainst: getCell(row, 44),
    goalDifference: getCell(row, 45),
  };
}

function getCell(row: string[], index: number) {
  return row[index]?.trim() ?? '';
}

function detectDateOrder(rows: string[][]): DateOrder {
  let hasMonthFirstDate = false;
  let hasDayFirstDate = false;

  for (const row of rows) {
    const value = getCell(row, 23);

    if (!DATE_PATTERN.test(value)) {
      continue;
    }

    const [first, second] = value.split('/').map(Number);

    if (first > 12 && second <= 12) {
      hasDayFirstDate = true;
    }

    if (second > 12 && first <= 12) {
      hasMonthFirstDate = true;
    }
  }

  return hasDayFirstDate && !hasMonthFirstDate ? 'day-first' : 'month-first';
}

function parseCsvDate(value: string, dateOrder: DateOrder) {
  const [first, second, year] = value.split('/').map(Number);
  const month = dateOrder === 'day-first' ? second : first;
  const day = dateOrder === 'day-first' ? first : second;

  return new Date(Date.UTC(year, month - 1, day));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatBetDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function isMissingFileError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}
