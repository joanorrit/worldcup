import { HomePageContent } from '@/components/HomePageContent';
import { getPredictionGroup, GROUP2_PREDICTION_GROUP_ID } from '@/lib/prediction-groups';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Group2Home() {
  return <HomePageContent group={getPredictionGroup(GROUP2_PREDICTION_GROUP_ID)} />;
}
