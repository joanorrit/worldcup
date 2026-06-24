import { Leaderboard, type LeaderboardSnapshotView } from '@/components/Leaderboard';
import { formatDate, getLeaderboardData } from '@/lib/leaderboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const { snapshots, latest } = await getLeaderboardData();

  if (!latest) {
    return <EmptyState />;
  }

  const snapshotViews: LeaderboardSnapshotView[] = snapshots.map((snapshot) => ({
    dateKey: snapshot.dateKey,
    dateLabel: formatDate(snapshot.date),
    fileName: snapshot.fileName,
    standings: snapshot.standings,
  }));

  return (
    <main className="min-h-screen bg-[#EBE7E4] text-[#252F3D]">
      <div className="mx-auto flex w-full max-w-[76rem] flex-col items-center px-4 pb-8 pt-4 text-center sm:px-6 sm:pb-10 sm:pt-6 lg:px-8">
        <header className="mx-auto flex max-w-[48rem] flex-col items-center py-4 sm:py-6">
          <p className="inline-flex border border-[#8B847D59] px-2 py-1 font-mono text-[0.68rem] uppercase leading-none tracking-[0.12em] text-[#5C5752]">
            World Cup Predictions
          </p>
          <h1 className="mt-3 font-serif text-[clamp(2.75rem,6vw,4.25rem)] font-normal italic leading-[0.9] tracking-[-0.06em] text-[#252F3D]">
            Leaderboard
          </h1>
          <p className="mt-3 max-w-[38rem] text-[1rem] leading-[1.55] text-[#384251]/90">
            Browse each standings snapshot chronologically. Add a new CSV to data/ and the latest stage updates automatically.
          </p>
        </header>

        <Leaderboard snapshots={snapshotViews} />
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#EBE7E4] p-4 text-center text-[#252F3D]">
      <div className="w-full max-w-md border border-[#8B847D59] bg-[#F4F2F0] p-6 sm:p-8">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-[#5C5752]">World Cup Predictions</p>
        <h1 className="mt-4 font-serif text-4xl font-normal italic tracking-[-0.05em]">No leaderboard data</h1>
        <p className="mt-4 text-sm leading-[1.55] text-[#384251]/85">
          Add a CSV file to the data directory using the expected Resultats_YYYY_MM_DD.csv format.
        </p>
      </div>
    </main>
  );
}
