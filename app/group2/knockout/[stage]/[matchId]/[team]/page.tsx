import { KnockoutTeamGuessesPage } from '@/components/KnockoutTeamGuessesPage';
import { getPredictionGroup, GROUP2_PREDICTION_GROUP_ID } from '@/lib/prediction-groups';

interface Group2KnockoutTeamPageProps {
  params: {
    matchId: string;
    stage: string;
    team: string;
  };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Group2KnockoutTeamPage({ params }: Group2KnockoutTeamPageProps) {
  return (
    <KnockoutTeamGuessesPage
      group={getPredictionGroup(GROUP2_PREDICTION_GROUP_ID)}
      matchId={decodeURIComponent(params.matchId)}
      stage={params.stage}
      team={params.team}
    />
  );
}
