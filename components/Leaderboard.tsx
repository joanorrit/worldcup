'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Standing } from '@/lib/leaderboard';

export interface LeaderboardSnapshotView {
  dateKey: string;
  dateLabel: string;
  fileName: string;
  standings: Standing[];
}

interface LeaderboardProps {
  snapshots: LeaderboardSnapshotView[];
  initialIndex?: number;
}

const numberFormatter = new Intl.NumberFormat('en-US');

export function Leaderboard({ snapshots, initialIndex }: LeaderboardProps) {
  const latestIndex = Math.max(snapshots.length - 1, 0);
  const safeInitialIndex = initialIndex ?? latestIndex;
  const [currentIndex, setCurrentIndex] = useState(() => clampIndex(safeInitialIndex, snapshots.length));

  const snapshot = snapshots[currentIndex];
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < latestIndex;

  const summary = useMemo(() => {
    const leader = snapshot?.standings[0];
    const totalPoints = snapshot?.standings.reduce((sum, standing) => sum + standing.points, 0) ?? 0;

    return {
      leader: leader ? `${leader.player} · ${formatNumber(leader.points)} pts` : '—',
      players: snapshot?.standings.length ?? 0,
      totalPoints,
    };
  }, [snapshot]);

  const goPrevious = useCallback(() => {
    setCurrentIndex((index) => Math.max(index - 1, 0));
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((index) => Math.min(index + 1, latestIndex));
  }, [latestIndex]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') {
        goPrevious();
      }

      if (event.key === 'ArrowRight') {
        goNext();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrevious]);

  if (!snapshot) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-[72rem] border border-[#8B847D59] bg-[#F4F2F0] text-center shadow-[0_1px_1px_rgba(37,47,61,0.03)]">
      <LeaderboardHeader
        canGoNext={canGoNext}
        canGoPrevious={canGoPrevious}
        currentIndex={currentIndex}
        fileName={snapshot.fileName}
        onNext={goNext}
        onPrevious={goPrevious}
        snapshotCount={snapshots.length}
        dateLabel={snapshot.dateLabel}
      />

      <LeaderboardSummary leader={summary.leader} players={summary.players} totalPoints={summary.totalPoints} />

      <PlayerRowList standings={snapshot.standings} />
    </section>
  );
}

function LeaderboardHeader({
  canGoNext,
  canGoPrevious,
  currentIndex,
  dateLabel,
  fileName,
  onNext,
  onPrevious,
  snapshotCount,
}: {
  canGoNext: boolean;
  canGoPrevious: boolean;
  currentIndex: number;
  dateLabel: string;
  fileName: string;
  onNext: () => void;
  onPrevious: () => void;
  snapshotCount: number;
}) {
  return (
    <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-3 border-b border-[#8B847D40] px-4 py-3 sm:px-6 sm:py-4">
      <ArrowButton label="Previous snapshot" direction="previous" disabled={!canGoPrevious} onClick={onPrevious} />

      <div className="min-w-0 text-center">
        <p className="font-mono text-[0.7rem] uppercase leading-none tracking-[0.12em] text-[#5C5752]">
          Stage {currentIndex + 1} of {snapshotCount}
        </p>
        <div className="mx-auto mt-2 flex max-w-full min-w-0 flex-col items-center justify-center gap-1 text-sm leading-none text-[#384251]/80 sm:flex-row sm:gap-2">
          <span>{dateLabel}</span>
          <span className="hidden text-[#8B847D] sm:inline">/</span>
          <span className="max-w-full truncate font-mono text-[0.72rem] tracking-[-0.02em] text-[#5C5752]">{fileName}</span>
        </div>
      </div>

      <ArrowButton label="Next snapshot" direction="next" disabled={!canGoNext} onClick={onNext} />
    </div>
  );
}

function LeaderboardSummary({ leader, players, totalPoints }: { leader: string; players: number; totalPoints: number }) {
  return (
    <div className="grid border-b border-[#8B847D40] bg-[#EEF1F3]/60 text-sm sm:grid-cols-3">
      <SummaryItem label="Leader" value={leader} />
      <SummaryItem label="Players" value={String(players)} />
      <SummaryItem label="Total points" value={formatNumber(totalPoints)} />
    </div>
  );
}

function PlayerRowList({ standings }: { standings: Standing[] }) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[48rem]">
        <div className="grid grid-cols-[4.5rem_minmax(9rem,1fr)_5.5rem_6rem_4.75rem_5rem_5.75rem_5.75rem] border-b border-[#8B847D40] bg-[#EBE7E4]/55 px-4 py-2 text-left font-mono text-[0.62rem] uppercase leading-none tracking-[0.1em] text-[#5C5752]">
          <span className="text-center">Rank</span>
          <span>Player</span>
          <span className="text-center">Move</span>
          <span className="text-right">Points</span>
          <span className="text-center">Delta</span>
          <span className="text-center">Signes</span>
          <span className="text-center">Resultats</span>
          <span className="text-center">Diff. gols</span>
        </div>

        <div className="divide-y divide-[#8B847D2E]">
          {standings.map((standing) => (
            <PlayerRow key={standing.player} standing={standing} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PlayerRow({ standing }: { standing: Standing }) {
  const isLeader = standing.rank === 1;

  return (
    <article className="grid grid-cols-[4.5rem_minmax(9rem,1fr)_5.5rem_6rem_4.75rem_5rem_5.75rem_5.75rem] items-center bg-[#F3F2F0] px-4 py-2 text-left transition-colors hover:bg-[#EBE7E4]/65">
      <div className={isLeader ? 'text-center text-lg font-semibold leading-none text-[#7A5A22]' : 'text-center text-lg font-semibold leading-none text-[#5C5752]'}>
        #{standing.rank}
      </div>

      <h2 className="truncate pr-3 text-base font-medium leading-tight text-[#252F3D]">
        {standing.player}
      </h2>

      <div className="flex justify-center">
        <MovementBadge movement={standing.rankMovement} />
      </div>

      <div className="text-right text-lg font-semibold leading-none tabular-nums text-[#252F3D]">
        {formatNumber(standing.points)}
      </div>

      <div className="text-center">
        <PointDelta value={standing.pointMovement} />
      </div>

      <PlayerRowStat value={standing.signs} />
      <PlayerRowStat value={standing.exactResults} />
      <PlayerRowStat value={standing.goalDifference} />
    </article>
  );
}

function PlayerRowStat({ value }: { value: number }) {
  return <div className="text-center text-sm font-medium tabular-nums text-[#384251]/90">{value}</div>;
}

function ArrowButton({
  label,
  direction,
  disabled,
  onClick,
}: {
  label: string;
  direction: 'previous' | 'next';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center border border-[#8B847D59] bg-transparent text-[#252F3D] transition hover:border-[#5C575280] hover:bg-[#EBE7E4] disabled:cursor-not-allowed disabled:border-[#8B847D2E] disabled:text-[#8B847D80] disabled:hover:bg-transparent"
    >
      <span aria-hidden="true" className="text-base leading-none">
        {direction === 'previous' ? '←' : '→'}
      </span>
    </button>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 border-b border-[#8B847D40] px-4 py-3 text-center last:border-b-0 sm:border-b-0 sm:border-r sm:px-5 sm:last:border-r-0">
      <p className="font-mono text-[0.68rem] uppercase leading-none tracking-[0.12em] text-[#5C5752]">{label}</p>
      <p className="max-w-full truncate text-center text-sm font-medium text-[#252F3D]">{value}</p>
    </div>
  );
}

function MovementBadge({ movement }: { movement: number | null }) {
  if (movement === null) {
    return <span className="border border-[#8B847D40] px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-[#5C5752]">new</span>;
  }

  if (movement > 0) {
    return <span className="border border-[#6F8E7359] bg-[#A3A47312] px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-[#3F6B49]">↑ {movement}</span>;
  }

  if (movement < 0) {
    return <span className="border border-[#844F3B40] bg-[#844F3B0A] px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-[#844F3B]">↓ {Math.abs(movement)}</span>;
  }

  return <span className="border border-[#8B847D40] bg-[#EBE7E4]/45 px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-[#5C5752]">same</span>;
}

function PointDelta({ value }: { value: number | null }) {
  if (value === null) {
    return null;
  }

  const sign = value > 0 ? '+' : '';
  const className = value > 0 ? 'text-[#3F6B49]' : value < 0 ? 'text-[#844F3B]' : 'text-[#5C5752]';

  return <span className={`font-mono text-[0.7rem] font-medium ${className}`}>{sign}{value}</span>;
}

function clampIndex(index: number, length: number) {
  if (length <= 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), length - 1);
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}
