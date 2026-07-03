# Repository Guide

This repo is a small Next.js 14 App Router app for a friends World Cup prediction leaderboard. Keep this file compact: it exists to save agents from rediscovering the architecture.

## Stack

- Next.js `14.2.3`, React `18.3.1`, TypeScript, Tailwind CSS.
- CSV parsing uses `csv-parse/sync`.
- Uploaded result CSVs are stored in Vercel Blob via `@vercel/blob`.
- Import aliases use `@/*`.

## Related Skills

- For UI/product work in this repo, use `.agents/skills/worldcup-custom-app/SKILL.md`.
- For larger styling changes, read `.agents/skills/worldcup-custom-app/ui-design-style.md` and treat it as the visual source of truth.
- For match-of-the-day guess inclusion, colors, knockout team links, and badges, use `.agents/skills/worldcup-matchday-guesses/SKILL.md`.
- For React/Next.js performance, data fetching, rendering, or bundle work, use `.agents/skills/vercel-react-best-practices/SKILL.md`; detailed rules live in `.agents/skills/vercel-react-best-practices/rules/`.
- Do not edit `.agents/skills/*/AGENTS.md` for general repo context. Those files belong to their specific skills.

## Routes

- `app/page.tsx`: server-rendered leaderboard homepage. It forces dynamic rendering and reads all result snapshots through `getLeaderboardData()`.
- `app/[player]/page.tsx`: server-rendered player prediction page. The route param is a lowercase player slug matching `data/bets/<player>.csv`.
- `app/admin/upload/page.tsx`: server action upload form for result CSVs. Requires `ADMIN_UPLOAD_TOKEN` and `BLOB_READ_WRITE_TOKEN`.
- `app/layout.tsx` and `app/globals.css`: global shell and responsive CSS overrides.

## Data Model

- Result snapshots live in `data/` and must be named `Resultats_YYYY_MM_DD.csv`.
- Result CSV columns expected by `lib/leaderboard.ts`: `Jugador`, `Signes`, `Resultats`, `Diferència gols`, `Punts`.
- `lib/leaderboard.ts` merges committed local result CSVs with Blob result CSVs under the `results/` prefix. Blob files with the same basename override local files.
- Snapshot dates come from the filename first, then file/blob metadata as fallback.
- Standings are ranked by points, exact results, signs, goal difference, then player name. Movement is computed by comparing each snapshot with the previous chronological snapshot.
- Player prediction CSVs live in `data/bets/`. `lib/player-bets.ts` reads fixed spreadsheet-export columns, so avoid changing column indexes casually.

## Component Boundaries

- Keep data loading/parsing in `lib/` server-only modules where possible.
- `components/Leaderboard.tsx` is the main client component. It owns snapshot navigation, keyboard arrow handling, podium display, and player links.
- Pages mostly compose server data into view props. Avoid moving CSV or Blob work into client components.
- Use existing inline Tailwind conventions unless a shared abstraction clearly reduces real duplication.

## Styling Direction

- The UI is intentionally calm, minimal, and documentation/product-like, not a busy sports dashboard.
- Existing palette centers on `#EBE7E4`, `#F4F2F0`, `#252F3D`, `#5C5752`, with restrained accent colors.
- Responsive behavior relies partly on semantic class hooks in `app/globals.css` such as `leaderboard-player-row`, `player-standing-row`, and `player-match-row`; preserve these when changing related markup.
- For anything beyond a tiny style tweak, read `.agents/skills/worldcup-custom-app/ui-design-style.md` instead of expanding this section.

## Validation

- Useful commands: `npm run typecheck`, `npm run build`.
- `npm run lint` exists, but Next.js `next lint` may be deprecated depending on installed tooling; prefer typecheck/build for core verification.
- For data changes, verify `/`, at least one existing player route such as `/joan` or `/riky`, and `/admin/upload` if upload code changed.

## Operational Notes

- The app works without Blob credentials by reading committed CSVs only.
- Uploads require Vercel Blob configuration; local development may not exercise that path.
- Do not delete or rewrite CSV data unless the task explicitly asks for it.
- Keep this guide short. Add only durable architecture facts or recurring gotchas.
