'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import type {
  HomepageMatchdayData,
  MatchdayGuess,
  MatchdayMatch,
  MatchdayView,
} from '@/lib/matchday-types';

interface MatchdaySectionProps {
  data: HomepageMatchdayData;
}

export function MatchdaySection({ data }: MatchdaySectionProps) {
  const initialDateKey = getSafeInitialDateKey(data);
  const [selectedDateKey, setSelectedDateKey] = useState(initialDateKey);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [useAccessibleGuessColors, setUseAccessibleGuessColors] = useState(false);
  const activeDateChipRef = useRef<HTMLButtonElement | null>(null);
  const dateRailScrollRef = useRef<HTMLDivElement | null>(null);

  const selectedIndex = Math.max(
    data.matchdays.findIndex((matchday) => matchday.dateKey === selectedDateKey),
    0,
  );
  const selectedMatchday = data.matchdays[selectedIndex] ?? null;
  const todayMatchday = data.matchdays.find((matchday) => matchday.dateKey === data.todayDateKey) ?? null;
  const canGoPrevious = selectedIndex > 0;
  const canGoNext = selectedIndex >= 0 && selectedIndex < data.matchdays.length - 1;
  const canGoToday = Boolean(todayMatchday && selectedMatchday?.dateKey !== todayMatchday.dateKey);

  useEffect(() => {
    const activeDateChip = activeDateChipRef.current;
    const dateRailScroll = dateRailScrollRef.current;

    if (activeDateChip && dateRailScroll) {
      dateRailScroll.scrollTo({
        left: activeDateChip.offsetLeft - (dateRailScroll.clientWidth - activeDateChip.offsetWidth) / 2,
      });
    }
  }, [selectedDateKey]);

  function selectDate(dateKey: string) {
    setSelectedDateKey(dateKey);
    setExpandedMatchId(null);
  }

  function selectByOffset(offset: -1 | 1) {
    const nextMatchday = data.matchdays[selectedIndex + offset];

    if (nextMatchday) {
      selectDate(nextMatchday.dateKey);
    }
  }

  return (
    <section className="matchday-shell mx-auto mb-6 w-full max-w-[72rem] border border-[#8B847D59] bg-[#F4F2F0] text-left shadow-[0_1px_1px_rgba(37,47,61,0.03)]">
      <div className="border-b border-[#8B847D40] px-4 py-3 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[0.68rem] uppercase leading-none tracking-[0.12em] text-[#5C5752]">
              Matchday
            </p>

            {selectedMatchday ? (
              <MatchdayTitle matchday={selectedMatchday} todayDateKey={data.todayDateKey} />
            ) : (
              <div className="mt-2">
                <h2 className="text-lg font-semibold leading-tight tracking-[-0.02em] text-[#252F3D]">
                  Match schedule unavailable
                </h2>
                <p className="mt-1 text-sm leading-[1.45] text-[#5C5752]">
                  Sync World Cup fixtures to show matchdays and guesses.
                </p>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <GuessColorButton
              active={useAccessibleGuessColors}
              onClick={() => setUseAccessibleGuessColors((current) => !current)}
            />
            <TodayButton
              disabled={!canGoToday}
              onClick={() => {
                if (todayMatchday) {
                  selectDate(todayMatchday.dateKey);
                }
              }}
            />
          </div>
        </div>
      </div>

      {data.matchdays.length > 0 ? (
        <>
          <div className="sticky top-0 z-20 grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 border-b border-[#8B847D40] bg-[#F4F2F0] px-3 py-2 shadow-[0_1px_1px_rgba(37,47,61,0.03)] sm:px-4">
            <RailArrow
              disabled={!canGoPrevious}
              label="Previous matchday"
              onClick={() => selectByOffset(-1)}
            >
              ←
            </RailArrow>

            <div ref={dateRailScrollRef} className="overflow-x-auto">
              <div className="flex min-w-max gap-2">
                {data.matchdays.map((matchday) => (
                  <DateChip
                    key={matchday.dateKey}
                    active={matchday.dateKey === selectedMatchday?.dateKey}
                    buttonRef={matchday.dateKey === selectedMatchday?.dateKey ? activeDateChipRef : undefined}
                    matchday={matchday}
                    onSelect={() => selectDate(matchday.dateKey)}
                    todayDateKey={data.todayDateKey}
                  />
                ))}
              </div>
            </div>

            <RailArrow
              disabled={!canGoNext}
              label="Next matchday"
              onClick={() => selectByOffset(1)}
            >
              →
            </RailArrow>
          </div>

          <div className="divide-y divide-[#8B847D2E]">
            {selectedMatchday?.matches.map((match) => (
              <MatchRow
                key={match.id}
                accessibleGuessColors={useAccessibleGuessColors}
                expanded={expandedMatchId === match.id}
                match={match}
                onToggle={() => setExpandedMatchId((current) => (current === match.id ? null : match.id))}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function MatchdayTitle({
  matchday,
  todayDateKey,
}: {
  matchday: MatchdayView;
  todayDateKey: string;
}) {
  const title =
    matchday.dateKey === todayDateKey
      ? "Today's matches"
      : matchday.dateKey < todayDateKey
        ? `Matches on ${formatDateKey(matchday.dateKey, { weekday: 'long', month: 'long', day: 'numeric' })}`
        : 'Upcoming matches';
  const subtitle =
    matchday.dateKey === todayDateKey || matchday.dateKey > todayDateKey
      ? formatDateKey(matchday.dateKey, { weekday: 'long', month: 'long', day: 'numeric' })
      : `${matchday.matches.length} ${matchday.matches.length === 1 ? 'match' : 'matches'}`;

  return (
    <div className="mt-2">
      <h2 className="text-lg font-semibold leading-tight tracking-[-0.02em] text-[#252F3D]">{title}</h2>
      <p className="mt-1 text-sm leading-[1.45] text-[#5C5752]">{subtitle}</p>
    </div>
  );
}

function DateChip({
  active,
  buttonRef,
  matchday,
  onSelect,
  todayDateKey,
}: {
  active: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  matchday: MatchdayView;
  onSelect: () => void;
  todayDateKey: string;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={[
        'inline-flex h-9 items-center justify-center whitespace-nowrap border px-3 font-mono text-[0.68rem] uppercase leading-none tracking-[0.08em] transition',
        active
          ? 'border-[#4B607C80] bg-[#EEF1F3] text-[#252F3D]'
          : 'border-[#8B847D40] bg-transparent text-[#5C5752] hover:border-[#5C575280] hover:bg-[#EBE7E4]',
      ].join(' ')}
    >
      {formatMatchdayChipLabel(matchday.dateKey, todayDateKey)}
    </button>
  );
}

function TodayButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 items-center justify-center border border-[#8B847D59] bg-transparent px-3 font-mono text-[0.64rem] uppercase leading-none tracking-[0.1em] text-[#252F3D] transition hover:border-[#5C575280] hover:bg-[#EBE7E4] disabled:cursor-not-allowed disabled:border-[#8B847D2E] disabled:text-[#8B847D80] disabled:hover:bg-transparent"
    >
      Today
    </button>
  );
}

function GuessColorButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="Toggle accessible guess colors"
      aria-pressed={active}
      onClick={onClick}
      className={[
        'inline-flex h-9 items-center justify-center whitespace-nowrap border px-3 font-mono text-[0.64rem] uppercase leading-none tracking-[0.1em] transition',
        active
          ? 'border-[#4B607C80] bg-[#EEF1F3] text-[#252F3D]'
          : 'border-[#8B847D59] bg-transparent text-[#252F3D] hover:border-[#5C575280] hover:bg-[#EBE7E4]',
      ].join(' ')}
    >
      Alt colors
    </button>
  );
}

function MatchRow({
  accessibleGuessColors,
  expanded,
  match,
  onToggle,
}: {
  accessibleGuessColors: boolean;
  expanded: boolean;
  match: MatchdayMatch;
  onToggle: () => void;
}) {
  return (
    <article className="bg-[#F3F2F0] transition-colors hover:bg-[#EBE7E4]/65">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_4.75rem_auto] sm:items-center sm:px-5">
        <div className="col-span-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 sm:col-span-1">
          <p className="min-w-0 text-sm font-medium leading-[1.35] text-[#252F3D]">
            <MatchSummary match={match} />
          </p>
          <span className="font-mono text-[0.62rem] uppercase leading-none tracking-[0.08em] text-[#5C5752]">
            {getStageLabel(match)}
          </span>
        </div>
        <span className="font-mono text-[0.68rem] uppercase leading-none tracking-[0.08em] text-[#5C5752] sm:text-center">
          {getStatusLabel(match)}
        </span>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          className="inline-flex h-8 items-center justify-center border border-[#8B847D59] bg-transparent px-3 font-mono text-[0.64rem] uppercase leading-none tracking-[0.1em] text-[#252F3D] transition hover:border-[#5C575280] hover:bg-[#EBE7E4]"
        >
          {expanded ? 'Hide' : 'Guesses'}
        </button>
      </div>

      {expanded ? <GuessList accessibleColors={accessibleGuessColors} guesses={match.guesses} match={match} /> : null}
    </article>
  );
}

function GuessList({
  accessibleColors,
  guesses,
  match,
}: {
  accessibleColors: boolean;
  guesses: MatchdayGuess[];
  match: MatchdayMatch;
}) {
  if (guesses.length === 0) {
    return (
      <p className="border-t border-[#8B847D2E] px-4 py-3 text-sm leading-[1.45] text-[#5C5752] sm:px-5">
        No guesses matched this fixture yet.
      </p>
    );
  }

  return (
    <div className="border-t border-[#8B847D2E] px-4 py-2.5 sm:px-5">
      <div className="divide-y divide-[#8B847D24] border border-[#8B847D24] bg-[#F4F2F0]">
        {guesses.map((guess) => {
          const tone = getGuessTone(guess, accessibleColors);

          return (
            <div
              key={`${match.id}-${guess.player}`}
              className={`grid grid-cols-[minmax(5rem,0.26fr)_minmax(0,1fr)] items-center gap-3 px-3 py-2 text-sm ${tone.rowClassName}`}
            >
              <span className={`min-w-0 truncate font-medium ${tone.playerClassName}`}>{guess.player}</span>
              <span className="flex max-w-full min-w-0 items-center justify-end gap-1.5">
                {guess.advancingTeamMatch ? (
                  <AdvancingTeamChip
                    flagSrc={guess.advancingTeamMatch.flagSrc}
                    team={guess.advancingTeamMatch.team}
                  />
                ) : null}
                <span className={`max-w-full min-w-0 truncate border px-2 py-1 text-right font-mono text-[0.78rem] leading-none tabular-nums ${tone.detailClassName}`}>
                  <GuessSummary guess={guess} />
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdvancingTeamChip({ flagSrc, team }: { flagSrc: string; team: string }) {
  return (
    <span
      aria-label={`${team} advanced`}
      className="inline-flex h-5 w-7 shrink-0 items-center justify-center overflow-hidden border border-[#4B607C4D] bg-[#EEF1F3]"
      title={`${team} advanced`}
    >
      <Image
        src={flagSrc}
        alt=""
        width={18}
        height={12}
        sizes="18px"
        className="h-3 w-[18px] object-cover"
      />
    </span>
  );
}

function RailArrow({
  children,
  disabled,
  label,
  onClick,
}: {
  children: ReactNode;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center border border-[#8B847D59] bg-transparent text-sm leading-none text-[#252F3D] transition hover:border-[#5C575280] hover:bg-[#EBE7E4] disabled:cursor-not-allowed disabled:border-[#8B847D2E] disabled:text-[#8B847D80] disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function getSafeInitialDateKey(data: HomepageMatchdayData): string {
  return data.initialDateKey ?? data.matchdays[0]?.dateKey ?? '';
}

function MatchSummary({ match }: { match: MatchdayMatch }) {
  if (hasVisibleScore(match)) {
    return (
      <ScoreSummary
        awayGoals={match.awayGoals}
        awayPenaltyGoals={match.awayPenaltyGoals}
        awayTeam={match.awayTeam}
        homeGoals={match.homeGoals}
        homePenaltyGoals={match.homePenaltyGoals}
        homeTeam={match.homeTeam}
      />
    );
  }

  return <>{match.homeTeam} vs {match.awayTeam}</>;
}

function getStatusLabel(match: MatchdayMatch): string {
  if (match.status === 'FINISHED') {
    return 'FT';
  }

  if (match.status === 'IN_PLAY' || match.status === 'PAUSED') {
    return 'Live';
  }

  return match.displayTime ?? 'TBD';
}

function getStageLabel(match: MatchdayMatch): string {
  if (match.stage === 'GROUP_STAGE') {
    return formatGroupLabel(match.group);
  }

  return STAGE_LABELS[match.stage] ?? formatStageName(match.stage);
}

function formatGroupLabel(group: string | null): string {
  const groupId = group?.replace(/^GROUP_/, '');

  return groupId ? `Group ${groupId}` : 'Group stage';
}

function formatStageName(stage: string): string {
  return stage
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function hasVisibleScore(match: MatchdayMatch): boolean {
  return (
    match.homeGoals !== null &&
    match.awayGoals !== null &&
    (match.status === 'FINISHED' || match.status === 'IN_PLAY' || match.status === 'PAUSED')
  );
}

function getGuessTone(guess: MatchdayGuess, accessibleColors: boolean) {
  if (guess.resultMatch === true) {
    return accessibleColors
      ? {
          rowClassName: 'bg-[#1F6F9F12] odd:bg-[#1F6F9F1F]',
          playerClassName: 'text-[#155A82]',
          detailClassName: 'border-[#1F6F9F4D] bg-[#1F6F9F12] text-[#155A82]',
        }
      : {
          rowClassName: 'bg-[#4F765914] odd:bg-[#4F76591F]',
          playerClassName: 'text-[#315F3A]',
          detailClassName: 'border-[#4F76594D] bg-[#4F765914] text-[#315F3A]',
        };
  }

  if (guess.signMatch === true) {
    return accessibleColors
      ? {
          rowClassName: 'bg-[#D88C0014] odd:bg-[#D88C0024]',
          playerClassName: 'text-[#775000]',
          detailClassName: 'border-[#D88C0059] bg-[#D88C0014] text-[#775000]',
        }
      : {
          rowClassName: 'bg-[#9A6A1B14] odd:bg-[#9A6A1B1F]',
          playerClassName: 'text-[#76511D]',
          detailClassName: 'border-[#9A6A1B4D] bg-[#9A6A1B14] text-[#76511D]',
        };
  }

  if (guess.resultMatch === false || !guess.teamsMatch) {
    return accessibleColors
      ? {
          rowClassName: 'bg-[#8E5B8F12] odd:bg-[#8E5B8F1F]',
          playerClassName: 'text-[#6F3D70]',
          detailClassName: 'border-[#8E5B8F4D] bg-[#8E5B8F12] text-[#6F3D70]',
        }
      : {
          rowClassName: 'bg-[#9B4A430D] odd:bg-[#9B4A4314]',
          playerClassName: 'text-[#9B4A43]',
          detailClassName: 'border-[#9B4A4340] bg-[#9B4A430D] text-[#9B4A43]',
        };
  }

  return {
    rowClassName: 'odd:bg-[#EBE7E4]/22',
    playerClassName: 'text-[#252F3D]',
    detailClassName: 'border-[#8B847D33] bg-[#EBE7E4]/45 text-[#384251]',
  };
}

function GuessSummary({ guess }: { guess: MatchdayGuess }) {
  return (
    <ScoreSummary
      awayGoals={guess.awayGoals || '-'}
      awayPenaltyGoals={guess.awayPenaltyGoals}
      awayTeam={guess.awayTeam}
      homeGoals={guess.homeGoals || '-'}
      homePenaltyGoals={guess.homePenaltyGoals}
      homeTeam={guess.homeTeam}
    />
  );
}

function ScoreSummary({
  awayGoals,
  awayPenaltyGoals,
  awayTeam,
  homeGoals,
  homePenaltyGoals,
  homeTeam,
}: {
  awayGoals: number | string | null;
  awayPenaltyGoals: number | string | null;
  awayTeam: string;
  homeGoals: number | string | null;
  homePenaltyGoals: number | string | null;
  homeTeam: string;
}) {
  return (
    <>
      {homeTeam} {formatScoreValue(homeGoals)}-{formatScoreValue(awayGoals)}
      {hasPenaltyScore(homePenaltyGoals, awayPenaltyGoals) ? (
        <span className="text-[0.68em] font-medium text-[#5C5752]">
          {' '}({formatScoreValue(homePenaltyGoals)}-{formatScoreValue(awayPenaltyGoals)})
        </span>
      ) : null}
      {' '}{awayTeam}
    </>
  );
}

function formatScoreValue(value: number | string | null): string {
  if (typeof value === 'number') {
    return String(value);
  }

  return value?.trim() || '-';
}

function hasPenaltyScore(homePenaltyGoals: number | string | null, awayPenaltyGoals: number | string | null): boolean {
  return isNumericScore(homePenaltyGoals) && isNumericScore(awayPenaltyGoals);
}

function isNumericScore(value: number | string | null): boolean {
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  return Boolean(value && /^\d+$/.test(value.trim()));
}

function formatDateKey(
  dateKey: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    ...options,
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

function formatMatchdayChipLabel(dateKey: string, todayDateKey: string): string {
  if (dateKey === todayDateKey) {
    return 'Today';
  }

  if (dateKey === getPreviousDateKey(todayDateKey)) {
    return 'Yesterday';
  }

  if (dateKey === getNextDateKey(todayDateKey)) {
    return 'Tomorrow';
  }

  return formatDateKey(dateKey, { month: 'short', day: 'numeric' });
}

function getPreviousDateKey(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);

  return date.toISOString().slice(0, 10);
}

function getNextDateKey(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);

  return date.toISOString().slice(0, 10);
}

const STAGE_LABELS: Record<string, string> = {
  FINAL: 'Final',
  LAST_16: 'Round of 16',
  LAST_32: 'Round of 32',
  QUARTER_FINALS: 'Round of 8',
  SEMI_FINALS: 'Semi-final',
  THIRD_PLACE: 'Third place',
};
