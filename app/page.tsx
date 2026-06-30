import { HomePageContent } from '@/components/HomePageContent';
import { getPredictionGroup } from '@/lib/prediction-groups';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Home() {
  return <HomePageContent group={getPredictionGroup()} />;
}
