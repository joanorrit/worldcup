import { AdminUploadPage } from '@/components/AdminUploadPage';
import { getPredictionGroup } from '@/lib/prediction-groups';

export const dynamic = 'force-dynamic';

interface UploadPageProps {
  searchParams?: {
    error?: string;
    uploaded?: string;
  };
}

export default function UploadPage({ searchParams }: UploadPageProps) {
  return <AdminUploadPage group={getPredictionGroup()} searchParams={searchParams} />;
}
