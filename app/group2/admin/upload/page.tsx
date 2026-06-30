import { AdminUploadPage } from '@/components/AdminUploadPage';
import { getPredictionGroup, GROUP2_PREDICTION_GROUP_ID } from '@/lib/prediction-groups';

export const dynamic = 'force-dynamic';

interface Group2UploadPageProps {
  searchParams?: {
    error?: string;
    uploaded?: string;
  };
}

export default function Group2UploadPage({ searchParams }: Group2UploadPageProps) {
  return <AdminUploadPage group={getPredictionGroup(GROUP2_PREDICTION_GROUP_ID)} searchParams={searchParams} />;
}
