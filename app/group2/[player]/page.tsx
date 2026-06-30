import { PlayerPredictionsPage } from '@/components/PlayerPredictionsPage';
import { getPredictionGroup, GROUP2_PREDICTION_GROUP_ID } from '@/lib/prediction-groups';

interface Group2PlayerPageProps {
  params: {
    player: string;
  };
}

export default function Group2PlayerPage({ params }: Group2PlayerPageProps) {
  return <PlayerPredictionsPage group={getPredictionGroup(GROUP2_PREDICTION_GROUP_ID)} player={params.player} />;
}
