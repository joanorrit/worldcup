import { KnockoutTeamGuessesPage } from '@/components/KnockoutTeamGuessesPage';
import { getPredictionGroup } from '@/lib/prediction-groups';

interface KnockoutTeamPageProps {
  params: {
    matchId: string;
    stage: string;
    team: string;
  };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function KnockoutTeamPage({ params }: KnockoutTeamPageProps) {
  return (
    <KnockoutTeamGuessesPage
      group={getPredictionGroup()}
      matchId={decodeURIComponent(params.matchId)}
      stage={params.stage}
      team={params.team}
    />
  );
}
