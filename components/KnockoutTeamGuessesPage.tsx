import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getKnockoutTeamGuessData,
  type KnockoutTeamGuessMatch,
  type KnockoutTeamGuessRow,
} from '@/lib/knockout-team-guesses';
import type { MatchdayTeamMeta } from '@/lib/matchday-types';
import { getPlayerPath } from '@/lib/player-slugs';
import type { PredictionGroupConfig } from '@/lib/prediction-groups';
import type { WorldCupMatch } from '@/lib/world-cup-matches';

interface KnockoutTeamGuessesPageProps {
  group: PredictionGroupConfig;
  matchId: string;
  stage: string;
  team: string;
}

export async function KnockoutTeamGuessesPage({
  group,
  matchId,
  stage,
  team,
}: KnockoutTeamGuessesPageProps) {
  const data = await getKnockoutTeamGuessData(group.id, stage, matchId, team);

  if (!data) {
    notFound();
  }

  const selectedRows = data.rows.filter((row) => row.match);
  const missingRows = data.rows.length - selectedRows.length;
  const sameFixtureRows = selectedRows.filter((row) => row.match?.teamsMatch);
  const exactScoreRows = selectedRows.filter((row) => row.match?.resultMatch === true);
  const advancingRows = selectedRows.filter((row) => row.match?.knockoutAdvancementMatch === true);
  const rows = sortRows(data.rows);
  const selectedTeamMeta = getSelectedTeamMeta(data.selectedTeam, data.actualHomeTeamMeta, data.actualAwayTeamMeta);

  return (
    <main className="min-h-screen bg-[#EBE7E4] text-[#252F3D]">
      <div className="knockout-page-container mx-auto w-full max-w-[72rem] px-4 pb-12 pt-6 sm:px-8 sm:pb-16 sm:pt-10">
        <header className="knockout-page-header max-w-[46rem] py-4 sm:py-6">
          <p className="font-mono text-[0.68rem] uppercase leading-none tracking-[0.12em] text-[#5C5752]">
            Knockout team guesses
          </p>
          <h1 className="mt-4 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 font-serif text-5xl font-normal italic leading-[0.92] tracking-normal text-[#252F3D] sm:text-6xl">
            <TitleFlag meta={selectedTeamMeta} />
            {data.selectedTeam}
          </h1>
          <p className="mt-4 text-[1rem] leading-[1.55] text-[#384251]/90">
            Who placed {data.selectedTeam} in this {data.stageLabel.toLowerCase()} slot, and what match did they predict?
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="font-mono text-[0.72rem] uppercase leading-none tracking-[0.1em] text-[#5C5752]">
              {selectedRows.length} selected / {missingRows} not selected
            </p>
            <BackButton href={getHomeHref(group)} />
          </div>
        </header>

        <ActualMatchCard
          awayTeamMeta={data.actualAwayTeamMeta}
          homeTeamMeta={data.actualHomeTeamMeta}
          match={data.actualMatch}
          stageLabel={data.stageLabel}
        />

        <section className="mt-6 border border-[#8B847D59] bg-[#F4F2F0] shadow-[0_1px_1px_rgba(37,47,61,0.03)]">
          <div className="flex flex-col gap-1 border-b border-[#8B847D40] bg-[#EBE7E4]/55 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:px-5">
            <h2 className="font-mono text-[0.72rem] uppercase leading-none tracking-[0.12em] text-[#5C5752]">
              {data.selectedTeam} picks
            </h2>
            <p className="font-mono text-[0.62rem] uppercase leading-none tracking-[0.1em] text-[#5C5752]">
              {data.rows.length} players
            </p>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-[#8B847D40] px-4 py-3 sm:px-5">
            <SummaryChip label="Selected" value={selectedRows.length} />
            <SummaryChip label="Not selected" value={missingRows} />
            <SummaryChip label="Same fixture" value={sameFixtureRows.length} />
            <SummaryChip label="Advanced" value={advancingRows.length} />
            <SummaryChip label="Exact score" value={exactScoreRows.length} />
          </div>

          <div className="knockout-team-head grid grid-cols-[minmax(7rem,0.18fr)_7.5rem_minmax(0,1fr)_6.25rem_9.5rem] border-b border-[#8B847D40] px-4 py-2 text-left font-mono text-[0.58rem] uppercase leading-none tracking-[0.08em] text-[#5C5752] sm:px-5">
            <span>Player</span>
            <span>Slot</span>
            <span>Predicted match</span>
            <span className="text-right">Score</span>
            <span className="text-right">Badges</span>
          </div>

          <div className="divide-y divide-[#8B847D2E]">
            {rows.map((row) => (
              <GuessRow key={row.player} basePath={group.routePrefix} row={row} selectedTeam={data.selectedTeam} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function ActualMatchCard({
  awayTeamMeta,
  homeTeamMeta,
  match,
  stageLabel,
}: {
  awayTeamMeta: MatchdayTeamMeta;
  homeTeamMeta: MatchdayTeamMeta;
  match: WorldCupMatch;
  stageLabel: string;
}) {
  return (
    <section className="border border-[#8B847D59] bg-[#F4F2F0] shadow-[0_1px_1px_rgba(37,47,61,0.03)]">
      <div className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
        <div className="min-w-0">
          <p className="font-mono text-[0.62rem] uppercase leading-none tracking-[0.1em] text-[#5C5752]">
            Actual match
          </p>
          <p className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-lg font-semibold leading-tight tracking-normal text-[#252F3D]">
            <TeamLabel meta={homeTeamMeta} />
            <span className="font-mono text-sm font-medium uppercase text-[#5C5752]">vs</span>
            <TeamLabel meta={awayTeamMeta} />
          </p>
        </div>
        <p className="font-mono text-[0.68rem] uppercase leading-none tracking-[0.08em] text-[#5C5752] sm:text-right">
          {stageLabel} / {formatDate(match.dateKey)} / {match.displayTime ?? 'TBD'}
        </p>
      </div>
    </section>
  );
}

function GuessRow({
  basePath,
  row,
  selectedTeam,
}: {
  basePath: string;
  row: KnockoutTeamGuessRow;
  selectedTeam: string;
}) {
  const playerPath = getPlayerPath(row.player, basePath);

  if (!row.match) {
    return (
      <article className="knockout-team-row knockout-team-row-empty grid grid-cols-[minmax(7rem,0.18fr)_7.5rem_minmax(0,1fr)_6.25rem_9.5rem] items-center gap-3 bg-[#F3F2F0] px-4 py-2.5 text-sm text-[#5C5752] transition-colors hover:bg-[#EBE7E4]/65 sm:px-5">
        <Link href={playerPath} className="knockout-team-player min-w-0 truncate font-medium text-[#252F3D] transition-colors hover:text-[#4B607C]">
          {row.player}
        </Link>
        <span className="knockout-team-slot font-mono text-[0.68rem] uppercase tracking-[0.08em] text-[#8B847D]">-</span>
        <span className="knockout-team-prediction min-w-0 border-l border-[#8B847D2E] pl-3">
          Did not put {selectedTeam} in this round
        </span>
        <span className="knockout-team-score text-right font-mono text-[0.7rem] uppercase tracking-[0.08em] text-[#8B847D]">-</span>
        <span className="knockout-team-status text-right" aria-hidden="true">-</span>
      </article>
    );
  }

  const tone = getGuessTone(row.match);

  return (
    <article className={`knockout-team-row grid grid-cols-[minmax(7rem,0.18fr)_7.5rem_minmax(0,1fr)_6.25rem_9.5rem] items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-[#EBE7E4]/65 sm:px-5 ${tone.rowClassName}`}>
      <Link href={playerPath} className={`knockout-team-player min-w-0 truncate font-medium transition-colors hover:text-[#4B607C] ${tone.playerClassName}`}>
        {row.player}
      </Link>
      <span className="knockout-team-slot font-mono text-[0.68rem] uppercase tracking-[0.08em] text-[#5C5752]">
        {formatShortDate(row.match.dateKey)} / {row.match.time || 'TBD'} / #{row.match.round}
      </span>
      <PredictedMatch match={row.match} />
      <span className={`knockout-team-score border px-2 py-1 text-right font-semibold tabular-nums ${tone.detailClassName}`}>
        <MatchScore match={row.match} />
      </span>
      <IconBadges match={row.match} />
    </article>
  );
}

function PredictedMatch({ match }: { match: KnockoutTeamGuessMatch }) {
  return (
    <span className="knockout-team-prediction min-w-0 text-[#384251]/95">
      <TeamLabel meta={match.homeTeamMeta} />
      <span className="px-2 font-mono text-[0.68rem] uppercase text-[#5C5752]">vs</span>
      <TeamLabel meta={match.awayTeamMeta} />
    </span>
  );
}

function TeamLabel({ meta, showName = false }: { meta: MatchdayTeamMeta; showName?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" title={meta.team}>
      <TeamFlag meta={meta} />
      <span className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-[#5C5752]">{meta.code}</span>
      {showName ? <span className="min-w-0 truncate font-medium text-[#252F3D]">{meta.team}</span> : null}
    </span>
  );
}

function TeamFlag({ meta }: { meta: MatchdayTeamMeta }) {
  if (!meta.flagSrc) {
    return null;
  }

  return (
    <span className="inline-flex h-4 w-6 shrink-0 items-center justify-center overflow-hidden border border-[#8B847D40] bg-[#F4F2F0]">
      <Image
        src={meta.flagSrc}
        alt=""
        width={24}
        height={16}
        sizes="24px"
        className="h-4 w-6 object-cover"
      />
    </span>
  );
}

function TitleFlag({ meta }: { meta: MatchdayTeamMeta }) {
  if (!meta.flagSrc) {
    return null;
  }

  return (
    <span className="inline-flex h-8 w-12 shrink-0 items-center justify-center overflow-hidden border border-[#8B847D40] bg-[#F4F2F0] sm:h-9 sm:w-14">
      <Image
        src={meta.flagSrc}
        alt=""
        width={56}
        height={36}
        sizes="56px"
        className="h-full w-full object-cover"
        priority
      />
    </span>
  );
}

function SummaryChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-[#8B847D40] bg-[#EBE7E4]/45 px-2 py-1 font-mono text-[0.62rem] uppercase leading-none tracking-[0.08em] text-[#5C5752]">
      <span>{label}</span>
      <span className="font-semibold tabular-nums text-[#252F3D]">{value}</span>
    </span>
  );
}

function IconBadges({ match }: { match: KnockoutTeamGuessMatch }) {
  const showPenaltyBadge =
    match.penaltyScoreMatch === true && (match.resultMatch === true || match.signMatch === true);

  if (match.knockoutAdvancementMatch !== true && !showPenaltyBadge) {
    return <span className="knockout-team-status text-right" aria-hidden="true">-</span>;
  }

  return (
    <span className="knockout-team-status flex justify-end gap-1">
      {match.knockoutAdvancementMatch === true ? (
        <IconBadge label="Correct knockout pass" src="/logos/knockout.png" />
      ) : null}
      {showPenaltyBadge ? (
        <IconBadge label="Correct penalty score" src="/logos/penalties.png" />
      ) : null}
    </span>
  );
}

function IconBadge({ label, src }: { label: string; src: string }) {
  return (
    <span
      aria-label={label}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden border border-[#4B607C33] bg-transparent"
      title={label}
    >
      <Image
        src={src}
        alt=""
        width={28}
        height={28}
        sizes="28px"
        className="h-7 w-7 object-contain"
      />
    </span>
  );
}

function MatchScore({ match }: { match: KnockoutTeamGuessMatch }) {
  return (
    <>
      {match.homeGoals || '-'}-{match.awayGoals || '-'}
      {hasPenaltyScore(match) ? (
        <span className="text-[0.68em] font-medium text-[#5C5752]">
          {' '}({match.homePenaltyGoals}-{match.awayPenaltyGoals})
        </span>
      ) : null}
    </>
  );
}

function BackButton({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="back-to-leaderboard inline-flex h-10 items-center border border-[#8B847D59] bg-transparent px-4 font-mono text-[0.68rem] uppercase leading-none tracking-[0.1em] text-[#252F3D] transition hover:border-[#5C575280] hover:bg-[#EBE7E4]"
    >
      Back to leaderboard
    </Link>
  );
}

function hasPenaltyScore(match: KnockoutTeamGuessMatch): boolean {
  return /^\d+$/.test(match.homePenaltyGoals.trim()) && /^\d+$/.test(match.awayPenaltyGoals.trim());
}

function getGuessTone(match: KnockoutTeamGuessMatch) {
  if (match.resultMatch === true && match.penaltyScoreMatch === true) {
    return {
      rowClassName: 'bg-[linear-gradient(90deg,#E8A3A34D,#E8CB7B4D,#C8DD8B4D,#8FD6C94D,#9DB6E84D,#D4A3DC4D)] odd:bg-[linear-gradient(90deg,#E8A3A35C,#E8CB7B5C,#C8DD8B5C,#8FD6C95C,#9DB6E85C,#D4A3DC5C)]',
      playerClassName: 'text-[#252F3D]',
      detailClassName: 'border-[#8B847D59] bg-[#F4F2F0]/75 text-[#252F3D]',
    };
  }

  if (match.resultMatch === true) {
    return {
      rowClassName: 'bg-[#4F765914] odd:bg-[#4F76591F]',
      playerClassName: 'text-[#315F3A]',
      detailClassName: 'border-[#4F76594D] bg-[#4F765914] text-[#315F3A]',
    };
  }

  if (match.signMatch === true) {
    return {
      rowClassName: 'bg-[#9A6A1B14] odd:bg-[#9A6A1B1F]',
      playerClassName: 'text-[#76511D]',
      detailClassName: 'border-[#9A6A1B4D] bg-[#9A6A1B14] text-[#76511D]',
    };
  }

  if (match.resultMatch === false || !match.teamsMatch) {
    return {
      rowClassName: 'bg-[#9B4A430D] odd:bg-[#9B4A4314]',
      playerClassName: 'text-[#9B4A43]',
      detailClassName: 'border-[#9B4A4340] bg-[#9B4A430D] text-[#9B4A43]',
    };
  }

  return {
    rowClassName: 'bg-[#F3F2F0] odd:bg-[#EBE7E4]/22',
    playerClassName: 'text-[#252F3D]',
    detailClassName: 'border-[#8B847D33] bg-[#EBE7E4]/45 text-[#384251]',
  };
}

function sortRows(rows: KnockoutTeamGuessRow[]): KnockoutTeamGuessRow[] {
  return [...rows].sort((a, b) => {
    const scoreDifference = getRowSortScore(b) - getRowSortScore(a);

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    return a.player.localeCompare(b.player);
  });
}

function getRowSortScore(row: KnockoutTeamGuessRow): number {
  if (!row.match) {
    return 0;
  }

  return (
    10 +
    (row.match.teamsMatch ? 4 : 0) +
    (row.match.knockoutAdvancementMatch === true ? 3 : 0) +
    (row.match.resultMatch === true ? 2 : 0) +
    (row.match.signMatch === true ? 1 : 0)
  );
}

function getSelectedTeamMeta(
  selectedTeam: string,
  homeTeamMeta: MatchdayTeamMeta,
  awayTeamMeta: MatchdayTeamMeta,
): MatchdayTeamMeta {
  if (homeTeamMeta.team === selectedTeam) {
    return homeTeamMeta;
  }

  if (awayTeamMeta.team === selectedTeam) {
    return awayTeamMeta;
  }

  return {
    code: selectedTeam.slice(0, 3).toUpperCase(),
    flagSrc: null,
    team: selectedTeam,
  };
}

function getHomeHref(group: PredictionGroupConfig): string {
  return group.routePrefix || '/';
}

function formatDate(dateKey: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

function formatShortDate(dateKey: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T12:00:00Z`));
}
