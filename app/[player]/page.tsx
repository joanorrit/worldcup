import { PlayerPredictionsPage } from '@/components/PlayerPredictionsPage';
import { getPredictionGroup } from '@/lib/prediction-groups';

interface PlayerPageProps {
  params: {
    player: string;
  };
}

export default function PlayerPage({ params }: PlayerPageProps) {
  return <PlayerPredictionsPage group={getPredictionGroup()} player={params.player} />;
}
