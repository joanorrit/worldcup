import 'server-only';

import path from 'node:path';

export const DEFAULT_PREDICTION_GROUP_ID = 'default';
export const GROUP2_PREDICTION_GROUP_ID = 'group2';

export type PredictionGroupId = typeof DEFAULT_PREDICTION_GROUP_ID | typeof GROUP2_PREDICTION_GROUP_ID;

export interface PredictionGroupConfig {
  id: PredictionGroupId;
  label: string;
  routePrefix: string;
  localResultsDir: string;
  localBetsDir: string;
  resultsBlobPrefix: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');

const PREDICTION_GROUPS = {
  [DEFAULT_PREDICTION_GROUP_ID]: {
    id: DEFAULT_PREDICTION_GROUP_ID,
    label: 'World Cup Predictions',
    routePrefix: '',
    localResultsDir: DATA_DIR,
    localBetsDir: path.join(DATA_DIR, 'bets'),
    resultsBlobPrefix: 'results/',
  },
  [GROUP2_PREDICTION_GROUP_ID]: {
    id: GROUP2_PREDICTION_GROUP_ID,
    label: 'World Cup Predictions',
    routePrefix: '/group2',
    localResultsDir: path.join(DATA_DIR, GROUP2_PREDICTION_GROUP_ID),
    localBetsDir: path.join(DATA_DIR, GROUP2_PREDICTION_GROUP_ID, 'bets'),
    resultsBlobPrefix: `${GROUP2_PREDICTION_GROUP_ID}/results/`,
  },
} satisfies Record<PredictionGroupId, PredictionGroupConfig>;

export function getPredictionGroup(groupId: PredictionGroupId = DEFAULT_PREDICTION_GROUP_ID): PredictionGroupConfig {
  return PREDICTION_GROUPS[groupId];
}

export function getLeaderboardBlobSnapshotCacheTag(groupId: PredictionGroupId): string {
  return `leaderboard-blob-snapshots:${groupId}`;
}
