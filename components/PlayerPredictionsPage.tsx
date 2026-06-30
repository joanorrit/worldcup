import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getPlayerBets,
  type GroupStanding,
  type HonorRollItem,
  type KnockoutSection,
  type PlayerBetGroup,
  type PlayerBetMatch,
} from '@/lib/player-bets';
import type { PredictionGroupConfig } from '@/lib/prediction-groups';

interface PlayerPredictionsPageProps {
  group: PredictionGroupConfig;
  player: string;
}

export async function PlayerPredictionsPage({ group, player: rawPlayer }: PlayerPredictionsPageProps) {
  const player = decodeURIComponent(rawPlayer).toLowerCase();

  if (!isValidPlayerSlug(player)) {
    notFound();
  }

  const bets = await getPlayerBets(player, group.id);

  if (!bets) {
    return <EmptyPlayerPage homeHref={getHomeHref(group)} />;
  }

  const playerName = formatPlayerName(player);
  const groupPredictionCount = bets.groupStageGroups.reduce((count, group) => count + group.matches.length, 0);

  return (
    <main className="min-h-screen bg-[#EBE7E4] text-[#252F3D]">
      <div className="player-page-container mx-auto w-full max-w-[80rem] px-4 pb-12 pt-6 sm:px-8 sm:pb-16 sm:pt-10">
        <header className="player-page-header max-w-[44rem] py-4 sm:py-6">
          <p className="font-mono text-[0.68rem] uppercase leading-none tracking-[0.12em] text-[#5C5752]">Player predictions</p>
          <h1 className="mt-4 font-serif text-[clamp(2.75rem,6vw,4.25rem)] font-normal italic leading-[0.9] tracking-[-0.06em] text-[#252F3D]">
            {playerName}
          </h1>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="font-mono text-[0.72rem] uppercase leading-none tracking-[0.1em] text-[#5C5752]">
              {bets.groupStageGroups.length} groups / {groupPredictionCount} group predictions
            </p>
            <BackButton href={getHomeHref(group)} />
          </div>
        </header>

        <section className="player-groups-grid grid gap-4 lg:grid-cols-2">
          {bets.groupStageGroups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </section>

        <KnockoutPredictions sections={bets.knockoutSections} />
        <HonorRoll items={bets.honorRoll} />
      </div>
    </main>
  );
}


function KnockoutPredictions({ sections }: { sections: KnockoutSection[] }) {
  const visibleSections = sections.filter((section) => section.matches.length > 0);

  if (visibleSections.length === 0) {
    return null;
  }

  return (
    <section className="player-knockout-section mt-8 border border-[#8B847D59] bg-[#F4F2F0] shadow-[0_1px_1px_rgba(37,47,61,0.03)]">
      <div className="border-b border-[#8B847D40] bg-[#EBE7E4]/55 px-4 py-3 sm:px-5">
        <h2 className="font-mono text-[0.72rem] uppercase leading-none tracking-[0.12em] text-[#5C5752]">Eliminatorias</h2>
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-5">
        {visibleSections.map((section) => (
          <KnockoutRound key={section.id} section={section} />
        ))}
      </div>
    </section>
  );
}

function KnockoutRound({ section }: { section: KnockoutSection }) {
  return (
    <article className="player-knockout-round border border-[#8B847D40] bg-[#F3F2F0]">
      <div className="flex items-baseline justify-between gap-4 border-b border-[#8B847D40] px-4 py-3 sm:px-5">
        <h3 className="font-mono text-[0.66rem] uppercase leading-none tracking-[0.1em] text-[#5C5752]">{section.title}</h3>
        <p className="font-mono text-[0.6rem] uppercase leading-none tracking-[0.08em] text-[#5C5752]">
          {section.matches.length} matches
        </p>
      </div>

      <div className="divide-y divide-[#8B847D2E]">
        {section.matches.map((match) => (
          <KnockoutMatchRow key={`${section.id}-${match.round}-${match.homeTeam}-${match.awayTeam}`} match={match} />
        ))}
      </div>
    </article>
  );
}

function KnockoutMatchRow({ match }: { match: PlayerBetMatch }) {
  return (
    <div className="player-match-row player-knockout-match-row grid grid-cols-[3.5rem_minmax(8rem,1fr)_6.25rem_minmax(8rem,1fr)] items-center px-4 py-2 text-sm transition-colors hover:bg-[#EBE7E4]/65 sm:px-5">
      <span className="player-match-round font-mono text-[0.68rem] uppercase tracking-[0.08em] text-[#5C5752]">#{match.round}</span>
      <span className="player-match-home min-w-0 truncate font-medium text-[#252F3D]">{match.homeTeam}</span>
      <span className="player-match-score text-center font-semibold tabular-nums text-[#252F3D]">
        <MatchScore match={match} />
      </span>
      <span className="player-match-away min-w-0 truncate font-medium text-[#252F3D]">{match.awayTeam}</span>
    </div>
  );
}

function HonorRoll({ items }: { items: HonorRollItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="player-honor-section mt-8 border border-[#8B847D59] bg-[#F4F2F0] shadow-[0_1px_1px_rgba(37,47,61,0.03)]">
      <div className="border-b border-[#8B847D40] bg-[#EBE7E4]/55 px-4 py-3 sm:px-5">
        <h2 className="font-mono text-[0.72rem] uppercase leading-none tracking-[0.12em] text-[#5C5752]">Cuadro de honor</h2>
      </div>

      <div className="grid sm:grid-cols-3">
        {items.map((item) => (
          <HonorRollItemCard key={item.label} item={item} />
        ))}
      </div>
    </section>
  );
}

function HonorRollItemCard({ item }: { item: HonorRollItem }) {
  return (
    <article className="player-honor-card border-b border-[#8B847D40] px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:px-5 sm:last:border-r-0">
      <p className="font-mono text-[0.62rem] uppercase leading-none tracking-[0.1em] text-[#5C5752]">{item.label}</p>
      <p className="mt-2 truncate text-xl font-semibold tracking-[-0.03em] text-[#252F3D]">{item.value}</p>
    </article>
  );
}

function EmptyPlayerPage({ homeHref }: { homeHref: string }) {
  return (
    <main className="min-h-screen bg-[#EBE7E4] text-[#252F3D]">
      <div className="mx-auto flex min-h-screen w-full max-w-[56rem] flex-col items-start justify-center px-4 py-12 sm:px-8">
        <div className="w-full border border-[#8B847D59] bg-[#F4F2F0] p-6 shadow-[0_1px_1px_rgba(37,47,61,0.03)] sm:p-8">
          <p className="font-mono text-[0.68rem] uppercase leading-none tracking-[0.12em] text-[#5C5752]">Player page</p>
          <h1 className="mt-4 font-serif text-4xl font-normal italic leading-none tracking-[-0.05em] text-[#252F3D]">Coming soon</h1>

          <BackButton className="mt-8" href={homeHref} />
        </div>
      </div>
    </main>
  );
}

function GroupCard({ group }: { group: PlayerBetGroup }) {
  return (
    <article className="player-group-card border border-[#8B847D59] bg-[#F4F2F0] shadow-[0_1px_1px_rgba(37,47,61,0.03)]">
      <div className="flex items-baseline justify-between gap-4 border-b border-[#8B847D40] bg-[#EBE7E4]/55 px-4 py-3 sm:px-5">
        <h2 className="font-mono text-[0.72rem] uppercase leading-none tracking-[0.12em] text-[#5C5752]">{group.title}</h2>
        <p className="font-mono text-[0.62rem] uppercase leading-none tracking-[0.1em] text-[#5C5752]">
          {group.matches.length} matches
        </p>
      </div>

      <GroupStandings standings={group.standings} />
      <GroupMatches matches={group.matches} />
    </article>
  );
}

function GroupStandings({ standings }: { standings: GroupStanding[] }) {
  return (
    <div className="player-standings border-b border-[#8B847D40]">
      <div className="player-standings-head grid grid-cols-[2.5rem_minmax(8rem,1fr)_3rem_2.25rem_2.25rem_2.25rem_2.25rem_2.5rem_2.5rem_2.75rem] px-4 py-2 text-left font-mono text-[0.58rem] uppercase leading-none tracking-[0.08em] text-[#5C5752] sm:px-5">
        <span className="text-center">Pos</span>
        <span>Team</span>
        <span className="text-right">Pts</span>
        <span className="text-right">J</span>
        <span className="text-right">G</span>
        <span className="text-right">E</span>
        <span className="text-right">P</span>
        <span className="text-right">GF</span>
        <span className="text-right">GC</span>
        <span className="text-right">DG</span>
      </div>

      <div className="divide-y divide-[#8B847D2E]">
        {standings.map((standing) => (
          <StandingRow key={`${standing.position}-${standing.team}`} standing={standing} />
        ))}
      </div>
    </div>
  );
}

function StandingRow({ standing }: { standing: GroupStanding }) {
  const isQualified = standing.position === '1' || standing.position === '2';

  return (
    <div className="player-standing-row grid grid-cols-[2.5rem_minmax(8rem,1fr)_3rem_2.25rem_2.25rem_2.25rem_2.25rem_2.5rem_2.5rem_2.75rem] items-center bg-[#F3F2F0] px-4 py-2 text-sm text-[#252F3D] transition-colors hover:bg-[#EBE7E4]/65 sm:px-5">
      <span className={isQualified ? 'player-standing-position text-center font-semibold text-[#7A5A22]' : 'player-standing-position text-center font-medium text-[#5C5752]'}>{standing.position}</span>
      <span className="player-standing-team min-w-0 truncate font-medium">{standing.team}</span>
      <span className="player-standing-points text-right font-semibold tabular-nums">{standing.points}</span>
      <div className="player-standing-secondary-stats">
        <NumberCell label="J" value={standing.played} />
        <NumberCell label="G" value={standing.won} />
        <NumberCell label="E" value={standing.drawn} />
        <NumberCell label="P" value={standing.lost} />
        <NumberCell label="GF" value={standing.goalsFor} />
        <NumberCell label="GC" value={standing.goalsAgainst} />
        <NumberCell label="DG" value={standing.goalDifference} />
      </div>
    </div>
  );
}

function GroupMatches({ matches }: { matches: PlayerBetMatch[] }) {
  return (
    <div>
      <div className="player-match-head grid grid-cols-[3rem_minmax(8rem,1fr)_6.25rem_minmax(8rem,1fr)] px-4 py-2 text-left font-mono text-[0.58rem] uppercase leading-none tracking-[0.08em] text-[#5C5752] sm:px-5">
        <span>Rnd</span>
        <span>Home</span>
        <span className="text-center">Score</span>
        <span>Away</span>
      </div>

      <div className="divide-y divide-[#8B847D2E]">
        {matches.map((match) => (
          <MatchRow key={`${match.round}-${match.homeTeam}-${match.awayTeam}`} match={match} />
        ))}
      </div>
    </div>
  );
}

function MatchRow({ match }: { match: PlayerBetMatch }) {
  return (
    <div className="player-match-row grid grid-cols-[3rem_minmax(8rem,1fr)_6.25rem_minmax(8rem,1fr)] items-center bg-[#F3F2F0] px-4 py-2 text-sm transition-colors hover:bg-[#EBE7E4]/65 sm:px-5">
      <span className="player-match-round font-mono text-[0.68rem] uppercase tracking-[0.08em] text-[#5C5752]">{match.round}</span>
      <span className="player-match-home min-w-0 truncate font-medium text-[#252F3D]">{match.homeTeam}</span>
      <span className="player-match-score text-center font-semibold tabular-nums text-[#252F3D]">
        <MatchScore match={match} />
      </span>
      <span className="player-match-away min-w-0 truncate font-medium text-[#252F3D]">{match.awayTeam}</span>
    </div>
  );
}

function MatchScore({ match }: { match: PlayerBetMatch }) {
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

function hasPenaltyScore(match: PlayerBetMatch): boolean {
  return /^\d+$/.test(match.homePenaltyGoals.trim()) && /^\d+$/.test(match.awayPenaltyGoals.trim());
}

function NumberCell({ label, value }: { label: string; value: string }) {
  return (
    <span className="player-number-cell text-right tabular-nums text-[#384251]/90">
      <span className="player-number-label hidden font-mono uppercase leading-none tracking-[0.08em] text-[#5C5752]">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function BackButton({ className = '', href }: { className?: string; href: string }) {
  return (
    <Link
      href={href}
      className={`${className} back-to-leaderboard inline-flex h-10 items-center border border-[#8B847D59] bg-transparent px-4 font-mono text-[0.68rem] uppercase leading-none tracking-[0.1em] text-[#252F3D] transition hover:border-[#5C575280] hover:bg-[#EBE7E4]`}
    >
      Back to leaderboard
    </Link>
  );
}

function formatPlayerName(player: string) {
  return player.charAt(0).toUpperCase() + player.slice(1);
}

function isValidPlayerSlug(player: string) {
  return /^[a-z0-9_-]+$/.test(player);
}

function getHomeHref(group: PredictionGroupConfig): string {
  return group.routePrefix || '/';
}
