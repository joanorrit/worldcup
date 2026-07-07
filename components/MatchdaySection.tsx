'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type MouseEventHandler, type ReactNode, type Ref } from 'react';
import type {
  HomepageMatchdayData,
  MatchdayGuess,
  MatchdayMatch,
  MatchdayTeamMeta,
  MatchdayView,
} from '@/lib/matchday-types';

type MatchPanelTab = 'guesses' | 'consensus' | 'links';

interface MatchdaySectionProps {
  basePath?: string;
  data: HomepageMatchdayData;
}

export function MatchdaySection({ basePath = '', data }: MatchdaySectionProps) {
  const initialDateKey = getSafeInitialDateKey(data);
  const [selectedDateKey, setSelectedDateKey] = useState(initialDateKey);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [activeMatchTab, setActiveMatchTab] = useState<MatchPanelTab>('guesses');
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
    const homePath = getHomePath(basePath);

    if (isReloadNavigation()) {
      clearStoredMatchdayReturn(homePath);
      return;
    }

    const storedDateKey = takeStoredMatchdayReturn(homePath, data.matchdays);

    if (storedDateKey) {
      setSelectedDateKey(storedDateKey);
      setExpandedMatchId(null);
    }
  }, [basePath, data.matchdays]);

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
    setActiveMatchTab('guesses');
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
                basePath={basePath}
                expanded={expandedMatchId === match.id}
                match={match}
                activeTab={activeMatchTab}
                onTabChange={setActiveMatchTab}
                onToggle={() => {
                  setExpandedMatchId((current) => {
                    if (current === match.id) {
                      return null;
                    }

                    setActiveMatchTab('guesses');
                    return match.id;
                  });
                }}
                selectedDateKey={selectedDateKey}
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
  activeTab,
  basePath,
  expanded,
  match,
  onTabChange,
  onToggle,
  selectedDateKey,
}: {
  accessibleGuessColors: boolean;
  activeTab: MatchPanelTab;
  basePath: string;
  expanded: boolean;
  match: MatchdayMatch;
  onTabChange: (tab: MatchPanelTab) => void;
  onToggle: () => void;
  selectedDateKey: string;
}) {
  return (
    <article className="bg-[#F3F2F0] transition-colors hover:bg-[#EBE7E4]/65">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_4.75rem_auto] sm:items-center sm:px-5">
        <div className="col-span-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 sm:col-span-1">
          <p className="min-w-0 text-sm font-medium leading-[1.35] text-[#252F3D]">
            <MatchSummary basePath={basePath} match={match} selectedDateKey={selectedDateKey} />
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
          {expanded ? 'Hide' : 'More'}
        </button>
      </div>

      {expanded ? (
        <MatchPanel
          accessibleGuessColors={accessibleGuessColors}
          activeTab={activeTab}
          match={match}
          onTabChange={onTabChange}
        />
      ) : null}
    </article>
  );
}

function MatchPanel({
  accessibleGuessColors,
  activeTab,
  match,
  onTabChange,
}: {
  accessibleGuessColors: boolean;
  activeTab: MatchPanelTab;
  match: MatchdayMatch;
  onTabChange: (tab: MatchPanelTab) => void;
}) {
  const tabs = getMatchPanelTabs(match);
  const selectedTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : 'guesses';

  return (
    <div className="border-t border-[#8B847D2E]">
      <div className="flex gap-1 overflow-x-auto border-b border-[#8B847D2E] px-4 py-2 sm:px-5">
        {tabs.map((tab) => (
          <PanelTabButton
            key={tab.id}
            active={selectedTab === tab.id}
            label={tab.label}
            onClick={() => onTabChange(tab.id)}
          />
        ))}
      </div>

      {selectedTab === 'guesses' ? (
        <GuessList accessibleColors={accessibleGuessColors} guesses={match.guesses} match={match} />
      ) : null}
      {selectedTab === 'consensus' ? <ConsensusPanel match={match} /> : null}
      {selectedTab === 'links' ? <LinksPanel match={match} /> : null}
    </div>
  );
}

function getMatchPanelTabs(match: MatchdayMatch): Array<{ id: MatchPanelTab; label: string }> {
  const tabs: Array<{ id: MatchPanelTab; label: string }> = [
    { id: 'guesses', label: 'Guesses' },
    { id: 'consensus', label: 'Consensus' },
  ];

  if (match.links) {
    tabs.push({ id: 'links', label: 'Links' });
  }

  return tabs;
}

function PanelTabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        'inline-flex h-8 shrink-0 items-center justify-center border px-3 font-mono text-[0.62rem] uppercase leading-none tracking-[0.1em] transition',
        active
          ? 'border-[#4B607C80] bg-[#EEF1F3] text-[#252F3D]'
          : 'border-[#8B847D40] bg-transparent text-[#5C5752] hover:border-[#5C575280] hover:bg-[#EBE7E4]',
      ].join(' ')}
    >
      {label}
    </button>
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
    <div className="px-4 py-2.5 sm:px-5">
      <div className="divide-y divide-[#8B847D24] border border-[#8B847D24] bg-[#F4F2F0]">
        {guesses.map((guess) => {
          const tone = getGuessTone(guess, accessibleColors, match);

          return (
            <div
              key={`${match.id}-${guess.player}`}
              className={`grid grid-cols-[minmax(5rem,0.26fr)_minmax(0,1fr)] items-center gap-3 px-3 py-2 text-sm ${tone.rowClassName}`}
            >
              <span className={`min-w-0 truncate font-medium ${tone.playerClassName}`}>{guess.player}</span>
              <span className="flex max-w-full min-w-0 flex-wrap items-center justify-end gap-1.5">
                <GuessBadges guess={guess} />
                <span className={`max-w-full min-w-0 overflow-hidden border px-2 py-1 text-right font-mono text-[0.78rem] leading-none tabular-nums ${tone.detailClassName}`}>
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

function ConsensusPanel({ match }: { match: MatchdayMatch }) {
  const summary = getConsensusSummary(match);

  if (match.guesses.length === 0) {
    return (
      <p className="px-4 py-3 text-sm leading-[1.45] text-[#5C5752] sm:px-5">
        No guesses matched this fixture yet.
      </p>
    );
  }

  return (
    <div className="space-y-3 px-4 py-3 sm:px-5">
      <PredictionSplitPanel
        title={match.stage === 'GROUP_STAGE' ? 'Predicted outcome' : 'Predicted advancing team'}
        entries={summary.predictionEntries}
        total={summary.predictionCount}
        showFlags
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <CompactPanel title="Fixture confidence">
          <div className="space-y-2">
            <ConsensusBar label="Exact fixture" value={summary.exactFixtureCount} total={match.guesses.length} />
            <ConsensusBar label="One team" value={summary.oneTeamCount} total={match.guesses.length} />
            <ConsensusBar label="Different fixture" value={summary.differentFixtureCount} total={match.guesses.length} />
          </div>
        </CompactPanel>

        <CompactPanel title="Common scores">
          {summary.commonScores.length > 0 ? (
            <ul className="space-y-1.5">
              {summary.commonScores.map((score) => (
                <li key={score.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-mono text-[0.78rem] text-[#252F3D]">{score.label}</span>
                  <span className="text-right text-[#5C5752]">{formatPlayerCount(score.players.length)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyPanelText>No numeric score guesses yet.</EmptyPanelText>
          )}
        </CompactPanel>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <CompactPanel title="Contrarian picks">
          {summary.rareScores.length > 0 ? (
            <ul className="space-y-1.5">
              {summary.rareScores.map((score) => (
                <li key={`${score.label}-${score.players[0]}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-mono text-[0.78rem] text-[#252F3D]">{score.label}</span>
                  <span className="min-w-0 truncate text-right text-[#5C5752]">{score.players[0]}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyPanelText>No one-off score picks yet.</EmptyPanelText>
          )}
        </CompactPanel>

        <CompactPanel title="Impact now">
          {summary.hasKnownScore ? (
            <div className="space-y-2">
              <ImpactLine label="Exact score" players={summary.exactPlayers} />
              <ImpactLine label="Correct sign" players={summary.signPlayers} />
              <ImpactLine label="Goal difference" players={summary.goalDifferencePlayers} />
              <ImpactLine label="Knockout pass" players={summary.advancementPlayers} />
              <ImpactLine label="Penalty score" players={summary.penaltyPlayers} />
            </div>
          ) : (
            <div className="space-y-2">
              <ImpactLine label="Contrarian" players={summary.rareScorePlayers} />
              <ImpactLine label="Knockout pass" players={summary.advancementPlayers} />
            </div>
          )}
        </CompactPanel>
      </div>
    </div>
  );
}

function PredictionSplitPanel({
  entries,
  showFlags = false,
  title,
  total,
}: {
  entries: PredictionEntry[];
  showFlags?: boolean;
  title: string;
  total: number;
}) {
  return (
    <CompactPanel title={title}>
      {entries.length > 0 ? (
        <div className="space-y-2">
          {entries.map((entry) => (
            <PredictionSplitRow
              key={entry.key}
              entry={entry}
              showFlag={showFlags}
              total={total}
            />
          ))}
        </div>
      ) : (
        <EmptyPanelText>No numeric predictions yet.</EmptyPanelText>
      )}
    </CompactPanel>
  );
}

function PredictionSplitRow({
  entry,
  showFlag,
  total,
}: {
  entry: PredictionEntry;
  showFlag: boolean;
  total: number;
}) {
  const percent = total > 0 ? Math.round((entry.players.length / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-[#252F3D]">
          {showFlag && entry.meta ? <TeamFlag meta={entry.meta} /> : null}
          <span className="min-w-0 truncate">{entry.label}</span>
        </span>
        <span className="shrink-0 font-mono text-[0.72rem] leading-none text-[#252F3D]">
          {percent}% / {entry.players.length}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden bg-[#EBE7E4]">
        <div className="h-full bg-[#4B607C]" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1.5 truncate text-xs leading-none text-[#5C5752]">{formatPlayerList(entry.players)}</p>
    </div>
  );
}

function ConsensusBar({ label, total, value }: { label: string; total: number; value: number }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[#252F3D]">{label}</span>
        <span className="font-mono text-[0.72rem] text-[#5C5752]">{percent}% / {value}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden bg-[#EBE7E4]">
        <div className="h-full bg-[#4B607C]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function CompactPanel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="border border-[#8B847D24] bg-[#F4F2F0] p-3">
      <h3 className="mb-2 font-mono text-[0.62rem] uppercase leading-none tracking-[0.1em] text-[#5C5752]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ImpactLine({ label, players }: { label: string; players: string[] }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 text-sm">
      <span className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-[#5C5752]">{label}</span>
      <span className="min-w-0 text-[#252F3D]">
        {players.length > 0 ? formatPlayerList(players) : <span className="text-[#8B847D]">None</span>}
      </span>
    </div>
  );
}

function LinksPanel({ match }: { match: MatchdayMatch }) {
  return (
    <div className="space-y-3 px-4 py-3 sm:px-5">
      {match.links?.note ? <p className="text-sm leading-[1.45] text-[#5C5752]">{match.links.note}</p> : null}

      <div className="flex flex-wrap gap-2">
        {match.links?.matchCenterUrl ? (
          <ExternalLinkButton href={match.links.matchCenterUrl}>Match center</ExternalLinkButton>
        ) : null}
        {match.links?.previewUrl ? (
          <ExternalLinkButton href={match.links.previewUrl}>Preview</ExternalLinkButton>
        ) : null}
        {match.links?.highlightsUrl ? (
          <ExternalLinkButton href={match.links.highlightsUrl}>Highlights</ExternalLinkButton>
        ) : null}
      </div>
    </div>
  );
}

function ExternalLinkButton({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-8 items-center justify-center border border-[#8B847D59] bg-transparent px-3 font-mono text-[0.64rem] uppercase leading-none tracking-[0.1em] text-[#252F3D] transition hover:border-[#5C575280] hover:bg-[#EBE7E4]"
    >
      {children}
    </a>
  );
}

function EmptyPanelText({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-[1.45] text-[#5C5752]">{children}</p>;
}

interface PredictionEntry {
  key: string;
  label: string;
  meta: MatchdayTeamMeta | null;
  players: string[];
}

function getConsensusSummary(match: MatchdayMatch) {
  const scoreGroups = new Map<string, string[]>();
  const advancingGroups = new Map<string, PredictionEntry>();
  const outcomeGroups = new Map<string, PredictionEntry>();
  const hasKnownScore = hasKnownScoreValue(match.homeGoals) && hasKnownScoreValue(match.awayGoals);
  const exactPlayers: string[] = [];
  const signPlayers: string[] = [];
  const goalDifferencePlayers: string[] = [];
  const advancementPlayers: string[] = [];
  const penaltyPlayers: string[] = [];
  let exactFixtureCount = 0;
  let oneTeamCount = 0;
  let differentFixtureCount = 0;
  let advancingGuessCount = 0;
  let outcomeGuessCount = 0;

  for (const guess of match.guesses) {
    const homeGoals = parseGuessGoal(guess.homeGoals);
    const awayGoals = parseGuessGoal(guess.awayGoals);
    const matchingTeamCount = countKnownFixtureTeamMatches(match, guess);

    if (guess.teamsMatch) {
      exactFixtureCount += 1;
    } else if (matchingTeamCount === 1) {
      oneTeamCount += 1;
    } else {
      differentFixtureCount += 1;
    }

    if (homeGoals !== null && awayGoals !== null) {
      const scoreKey = `${homeGoals}-${awayGoals}`;
      const players = scoreGroups.get(scoreKey) ?? [];
      players.push(guess.player);
      scoreGroups.set(scoreKey, players);

      if (match.stage !== 'GROUP_STAGE') {
        const predictedAdvancingTeam = getPredictedAdvancingTeam(guess, homeGoals, awayGoals);

        if (predictedAdvancingTeam) {
          addPredictionEntry(advancingGroups, predictedAdvancingTeam, guess.player);
          advancingGuessCount += 1;
        }
      } else {
        const predictedOutcome = getPredictedGroupOutcome(guess, homeGoals, awayGoals);
        addPredictionEntry(outcomeGroups, predictedOutcome, guess.player);
        outcomeGuessCount += 1;
      }

      if (
        hasKnownScore &&
        homeGoals - awayGoals === (match.homeGoals as number) - (match.awayGoals as number) &&
        guess.resultMatch !== true
      ) {
        goalDifferencePlayers.push(guess.player);
      }
    }

    if (guess.resultMatch === true) {
      exactPlayers.push(guess.player);
    }

    if (guess.signMatch === true && guess.resultMatch !== true) {
      signPlayers.push(guess.player);
    }

    if (guess.knockoutAdvancementMatch === true) {
      advancementPlayers.push(guess.player);
    }

    if (guess.penaltyScoreMatch === true) {
      penaltyPlayers.push(guess.player);
    }
  }

  const commonScores = Array.from(scoreGroups.entries())
    .map(([label, players]) => ({ label, players }))
    .sort((a, b) => b.players.length - a.players.length || a.label.localeCompare(b.label))
    .slice(0, 5);
  const rareScores = Array.from(scoreGroups.entries())
    .map(([label, players]) => ({ label, players }))
    .filter((score) => score.players.length === 1)
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, 6);
  const rareScorePlayers = Array.from(scoreGroups.values())
    .filter((players) => players.length === 1)
    .flat()
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 6);
  const advancingEntries = sortPredictionEntries(advancingGroups);
  const outcomeEntries = sortPredictionEntries(outcomeGroups);

  return {
    advancementPlayers: advancementPlayers.sort((a, b) => a.localeCompare(b)),
    commonScores,
    differentFixtureCount,
    exactFixtureCount,
    exactPlayers: exactPlayers.sort((a, b) => a.localeCompare(b)),
    goalDifferencePlayers: goalDifferencePlayers.sort((a, b) => a.localeCompare(b)),
    hasKnownScore,
    oneTeamCount,
    penaltyPlayers: penaltyPlayers.sort((a, b) => a.localeCompare(b)),
    predictionCount: match.stage === 'GROUP_STAGE' ? outcomeGuessCount : advancingGuessCount,
    predictionEntries: match.stage === 'GROUP_STAGE' ? outcomeEntries : advancingEntries,
    rareScores,
    rareScorePlayers,
    signPlayers: signPlayers.sort((a, b) => a.localeCompare(b)),
  };
}

function addPredictionEntry(groups: Map<string, PredictionEntry>, entry: Omit<PredictionEntry, 'players'>, player: string) {
  const existingEntry = groups.get(entry.key);

  if (existingEntry) {
    existingEntry.players.push(player);
    return;
  }

  groups.set(entry.key, {
    ...entry,
    players: [player],
  });
}

function sortPredictionEntries(groups: Map<string, PredictionEntry>): PredictionEntry[] {
  return Array.from(groups.values())
    .map((entry) => ({
      ...entry,
      players: entry.players.sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => b.players.length - a.players.length || a.label.localeCompare(b.label));
}

function getPredictedGroupOutcome(
  guess: MatchdayGuess,
  homeGoals: number,
  awayGoals: number,
): Omit<PredictionEntry, 'players'> {
  if (homeGoals > awayGoals) {
    return getTeamPredictionEntry(guess.homeTeam, guess.homeTeamMeta);
  }

  if (awayGoals > homeGoals) {
    return getTeamPredictionEntry(guess.awayTeam, guess.awayTeamMeta);
  }

  return {
    key: 'draw',
    label: 'Draw',
    meta: null,
  };
}

function getPredictedAdvancingTeam(
  guess: MatchdayGuess,
  homeGoals: number,
  awayGoals: number,
): Omit<PredictionEntry, 'players'> | null {
  if (homeGoals > awayGoals) {
    return getTeamPredictionEntry(guess.homeTeam, guess.homeTeamMeta);
  }

  if (awayGoals > homeGoals) {
    return getTeamPredictionEntry(guess.awayTeam, guess.awayTeamMeta);
  }

  const homePenaltyGoals = parseGuessGoal(guess.homePenaltyGoals);
  const awayPenaltyGoals = parseGuessGoal(guess.awayPenaltyGoals);

  if (homePenaltyGoals === null || awayPenaltyGoals === null || homePenaltyGoals === awayPenaltyGoals) {
    return null;
  }

  return homePenaltyGoals > awayPenaltyGoals
    ? getTeamPredictionEntry(guess.homeTeam, guess.homeTeamMeta)
    : getTeamPredictionEntry(guess.awayTeam, guess.awayTeamMeta);
}

function getTeamPredictionEntry(team: string, meta: MatchdayTeamMeta): Omit<PredictionEntry, 'players'> {
  return {
    key: `team:${normalizeConsensusTeamName(team)}`,
    label: meta.team,
    meta,
  };
}

function countKnownFixtureTeamMatches(match: MatchdayMatch, guess: MatchdayGuess): number {
  const predictedTeams = new Set([
    normalizeConsensusTeamName(guess.homeTeam),
    normalizeConsensusTeamName(guess.awayTeam),
  ]);

  return [match.homeTeam, match.awayTeam]
    .map(normalizeConsensusTeamName)
    .filter((team) => team !== 'tbd')
    .filter((team) => predictedTeams.has(team))
    .length;
}

function normalizeConsensusTeamName(team: string): string {
  const normalized = team
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  return normalized || 'tbd';
}

function parseGuessGoal(value: string): number | null {
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? parsed : null;
}

function hasKnownScoreValue(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatPlayerCount(count: number): string {
  return `${count} ${count === 1 ? 'player' : 'players'}`;
}

function formatPlayerList(players: string[]): string {
  if (players.length <= 6) {
    return players.join(', ');
  }

  return `${players.slice(0, 6).join(', ')} +${players.length - 6}`;
}

function TeamLabel({
  href,
  meta,
  onNavigate,
  showName = false,
}: {
  href?: string | null;
  meta: MatchdayTeamMeta;
  onNavigate?: MouseEventHandler<HTMLAnchorElement>;
  showName?: boolean;
}) {
  const content = (
    <>
      <TeamFlag meta={meta} />
      <span
        className={
          showName
            ? 'min-w-0 truncate'
            : 'font-mono text-[0.72rem] uppercase tracking-[0.08em]'
        }
      >
        {showName ? meta.team : meta.code}
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex min-w-0 items-center gap-1.5 border-b border-[#4B607C40] text-[#252F3D] transition-colors hover:border-[#4B607C] hover:text-[#4B607C]"
        onClick={onNavigate}
        title={`View ${meta.team} knockout guesses`}
      >
        {content}
      </Link>
    );
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" title={meta.team}>
      {content}
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

function GuessBadges({ guess }: { guess: MatchdayGuess }) {
  const showPenaltyBadge =
    guess.penaltyScoreMatch === true && (guess.resultMatch === true || guess.signMatch === true);

  if (guess.knockoutAdvancementMatch !== true && !showPenaltyBadge) {
    return null;
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {guess.knockoutAdvancementMatch === true ? (
        <GuessBadge
          label="Correct knockout pass"
          src="/logos/knockout.png"
        />
      ) : null}
      {showPenaltyBadge ? (
        <GuessBadge
          label="Correct penalty score"
          src="/logos/penalties.png"
        />
      ) : null}
    </span>
  );
}

function GuessBadge({ label, src }: { label: string; src: string }) {
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

function MatchSummary({ basePath, match, selectedDateKey }: { basePath: string; match: MatchdayMatch; selectedDateKey: string }) {
  const homeTeamHref = getKnockoutTeamHref(basePath, match, match.homeTeam);
  const awayTeamHref = getKnockoutTeamHref(basePath, match, match.awayTeam);
  const rememberMatchday = () => {
    rememberMatchdayReturn(basePath, selectedDateKey);
  };

  if (hasVisibleScore(match)) {
    return (
      <ScoreSummary
        awayGoals={match.awayGoals}
        awayPenaltyGoals={match.awayPenaltyGoals}
        awayTeamMeta={match.awayTeamMeta}
        awayTeamHref={awayTeamHref}
        onAwayTeamNavigate={rememberMatchday}
        homeGoals={match.homeGoals}
        homePenaltyGoals={match.homePenaltyGoals}
        homeTeamMeta={match.homeTeamMeta}
        homeTeamHref={homeTeamHref}
        onHomeTeamNavigate={rememberMatchday}
        showTeamNames
      />
    );
  }

  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <TeamLabel href={homeTeamHref} meta={match.homeTeamMeta} onNavigate={rememberMatchday} showName />
      <span className="font-mono text-[0.72rem] uppercase text-[#5C5752]">vs</span>
      <TeamLabel href={awayTeamHref} meta={match.awayTeamMeta} onNavigate={rememberMatchday} showName />
    </span>
  );
}

function getStatusLabel(match: MatchdayMatch): string {
  if (match.status === 'FINISHED') {
    return 'FT';
  }

  if (match.status === 'IN_PLAY' || match.status === 'PAUSED' || (match.status === 'TIMED' && hasKnownScore(match))) {
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
    hasKnownScore(match) &&
    (match.status === 'FINISHED' || match.status === 'IN_PLAY' || match.status === 'PAUSED' || match.status === 'TIMED')
  );
}

function hasKnownScore(match: MatchdayMatch): boolean {
  return (
    match.homeGoals !== null &&
    match.awayGoals !== null
  );
}

function getGuessTone(guess: MatchdayGuess, accessibleColors: boolean, match: MatchdayMatch) {
  if (match.stage !== 'GROUP_STAGE' && guess.resultMatch === true && guess.penaltyScoreMatch === true) {
    return {
      rowClassName: 'bg-[linear-gradient(90deg,#E8A3A34D,#E8CB7B4D,#C8DD8B4D,#8FD6C94D,#9DB6E84D,#D4A3DC4D)] odd:bg-[linear-gradient(90deg,#E8A3A35C,#E8CB7B5C,#C8DD8B5C,#8FD6C95C,#9DB6E85C,#D4A3DC5C)]',
      playerClassName: 'text-[#252F3D]',
      detailClassName: 'border-[#8B847D59] bg-[#F4F2F0]/75 text-[#252F3D]',
    };
  }

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
      awayTeamMeta={guess.awayTeamMeta}
      homeGoals={guess.homeGoals || '-'}
      homePenaltyGoals={guess.homePenaltyGoals}
      homeTeamMeta={guess.homeTeamMeta}
    />
  );
}

function ScoreSummary({
  awayGoals,
  awayPenaltyGoals,
  awayTeamMeta,
  awayTeamHref,
  homeGoals,
  homePenaltyGoals,
  homeTeamMeta,
  homeTeamHref,
  onAwayTeamNavigate,
  onHomeTeamNavigate,
  showTeamNames = false,
}: {
  awayGoals: number | string | null;
  awayPenaltyGoals: number | string | null;
  awayTeamMeta: MatchdayTeamMeta;
  awayTeamHref?: string | null;
  homeGoals: number | string | null;
  homePenaltyGoals: number | string | null;
  homeTeamMeta: MatchdayTeamMeta;
  homeTeamHref?: string | null;
  onAwayTeamNavigate?: MouseEventHandler<HTMLAnchorElement>;
  onHomeTeamNavigate?: MouseEventHandler<HTMLAnchorElement>;
  showTeamNames?: boolean;
}) {
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1">
      <TeamLabel href={homeTeamHref} meta={homeTeamMeta} onNavigate={onHomeTeamNavigate} showName={showTeamNames} />
      <span className="inline-flex shrink-0 items-baseline gap-1">
        <span>{formatScoreValue(homeGoals)}-{formatScoreValue(awayGoals)}</span>
        {hasPenaltyScore(homePenaltyGoals, awayPenaltyGoals) ? (
          <span className="text-[0.68em] font-medium text-[#5C5752]">
            ({formatScoreValue(homePenaltyGoals)}-{formatScoreValue(awayPenaltyGoals)})
          </span>
        ) : null}
      </span>
      <TeamLabel href={awayTeamHref} meta={awayTeamMeta} onNavigate={onAwayTeamNavigate} showName={showTeamNames} />
    </span>
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

function getKnockoutTeamHref(basePath: string, match: MatchdayMatch, team: string): string | null {
  if (match.stage === 'GROUP_STAGE' || isPlaceholderTeam(team)) {
    return null;
  }

  const normalizedBasePath = basePath === '/' ? '' : basePath.replace(/\/$/, '');

  return `${normalizedBasePath}/knockout/${match.stage.toLowerCase().replace(/_/g, '-')}/${encodeURIComponent(match.id)}/${getRawTeamSlug(team)}`;
}

function getRawTeamSlug(team: string): string {
  return team
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-+/g, '-');
}

function isPlaceholderTeam(team: string): boolean {
  return /^(tbd|to be determined|winner\b|runner-up\b|runner up\b|w\d+|l\d+)$/i.test(team.trim());
}

function getHomePath(basePath: string): string {
  return basePath === '/' || basePath === '' ? '/' : basePath.replace(/\/$/, '');
}

function getMatchdayReturnStorageKey(homePath: string): string {
  return `worldcup:matchday-return:${homePath}`;
}

function rememberMatchdayReturn(basePath: string, dateKey: string) {
  if (typeof window === 'undefined' || !dateKey) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      getMatchdayReturnStorageKey(getHomePath(basePath)),
      JSON.stringify({ dateKey }),
    );
  } catch {
    // Some privacy modes can block sessionStorage; navigation should still work.
  }
}

function takeStoredMatchdayReturn(homePath: string, matchdays: MatchdayView[]): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storageKey = getMatchdayReturnStorageKey(homePath);

  try {
    const rawValue = window.sessionStorage.getItem(storageKey);
    window.sessionStorage.removeItem(storageKey);

    if (!rawValue) {
      return null;
    }

    const value = JSON.parse(rawValue) as { dateKey?: unknown };
    const dateKey = typeof value.dateKey === 'string' ? value.dateKey : null;

    return dateKey && matchdays.some((matchday) => matchday.dateKey === dateKey) ? dateKey : null;
  } catch {
    return null;
  }
}

function clearStoredMatchdayReturn(homePath: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(getMatchdayReturnStorageKey(homePath));
  } catch {
    // Ignore blocked storage; the homepage will fall back to its normal initial date.
  }
}

function isReloadNavigation(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const [navigationEntry] = window.performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];

  return navigationEntry?.type === 'reload';
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

function formatShortDate(dateKey: string): string {
  return formatDateKey(dateKey, { month: 'short', day: 'numeric' });
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
