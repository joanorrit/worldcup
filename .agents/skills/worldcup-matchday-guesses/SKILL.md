---
name: worldcup-matchday-guesses
description: World Cup matchday guess matching and evaluation logic for this repo. Use when Codex needs to explain, debug, review, or change how players' guesses are included in match-of-the-day fixtures, colored green/yellow/red/default, linked from knockout team labels, or given knockout and penalty badges.
---

# World Cup Matchday Guesses

## Overview

Use this skill for the match-of-the-day guess drawer and the knockout team click-through pages. Keep data loading and scoring logic in `lib/`, and keep presentation logic in the matching components unless a shared helper clearly reduces duplication.

## Primary Files

- `lib/matchday-predictions.ts`: builds matchday data, chooses which player guesses appear for each fixture, and computes `teamsMatch`, `resultMatch`, `signMatch`, `knockoutAdvancementMatch`, and `penaltyScoreMatch`.
- `components/MatchdaySection.tsx`: renders the matchday UI, team links, guess colors, score summaries, and badges.
- `lib/knockout-team-guesses.ts`: builds the click-through page reached from a knockout team link.
- `components/KnockoutTeamGuessesPage.tsx`: renders click-through rows, colors, score summaries, and badges.
- `lib/matchday-types.ts`: shared `MatchdayMatch` and `MatchdayGuess` shapes.

## Inclusion Logic

In `getPredictionIndexes()`:

- Read all player bet CSVs for the prediction group.
- For each prediction, add an exact fixture key: `date|normalizedHome|normalizedAway`.
- Also add the reversed exact fixture key with home/away teams, goals, and penalty goals swapped.
- Store each prediction in a date/time bucket: `date|normalizedTime`.

In `getGuessesForMatch()`:

- First include exact team matches for the displayed fixture.
- Deduplicate by player after exact matches.
- Then include slot fallback guesses for players without exact matches by matching date, displayed time, and occurrence index.
- Sort the final rows alphabetically by player.

This means a player can appear because they predicted the exact teams, including reversed home/away order, or because their knockout/TBD bracket slot occupies the same date/time slot as the actual fixture.

## Evaluation Logic

Before scoring knockout guesses, `getPredictionEvaluationMatch()` may replace the displayed match with the actual knockout match for the predicted team pair in the same knockout stage. This lets a predicted knockout pairing be evaluated against the real fixture where that pair occurred in that round, when known, without letting a round-of-32 prediction match a round-of-16 fixture.

Use these meanings consistently:

- `teamsMatch`: every known real fixture team is present in the prediction after team normalization. Unknown/TBD real teams are ignored.
- `resultMatch`: `null` if the real score is unknown. Otherwise true only for exact goals, with goals swapped when predicted home/away is reversed. For knockout matches with wrong teams, return false.
- `signMatch`: `null` if the real score is unknown. Otherwise true for same outcome only: home win, draw, or away win, again respecting reversed teams. For knockout matches with wrong teams, return false.
- `knockoutAdvancementMatch`: `null` for group-stage matches. For knockout, derive the predicted advancing team from normal goals, then penalty goals if normal goals are tied. Return true if that team is known to have advanced in the same stage; return false only once the actual advancing team is known.
- `penaltyScoreMatch`: `null` if the actual match has no penalty score. Return false when teams do not match or penalty goals are invalid. Return true only for exact penalty goals, with home/away penalty goals swapped when needed.

Team normalization removes accents, lowercases, normalizes punctuation and spaces, maps aliases, and treats blank/TBD placeholders as `tbd`.

## Colors

Matchday rows use `getGuessTone()` in `components/MatchdaySection.tsx`. Knockout team click-through rows use a parallel `getGuessTone()` in `components/KnockoutTeamGuessesPage.tsx`.

- Rainbow: knockout match with exact result and exact penalty score.
- Green: `resultMatch === true`.
- Yellow: `signMatch === true`.
- Red: `resultMatch === false || !teamsMatch`.
- Default/no color: pending or inconclusive guesses, usually before scores are known.

Wrong teams are red because `!teamsMatch` is sufficient, even before the final score is known. In accessible color mode on the matchday drawer, the same states become blue/orange/purple alternatives, but the branching logic is unchanged.

## Team Links

`getKnockoutTeamHref()` returns a link only when:

- The match is not `GROUP_STAGE`.
- The clicked team is not a placeholder/TBD team.

The URL shape is:

```text
/{optional-group-prefix}/knockout/{stage-slug}/{matchId}/{team-slug}
```

On that page, `findTeamMatchInSection()` lists players who placed the selected team in that knockout section, then evaluates each predicted match with the same result/sign/advancement/penalty concepts.

## Badges

Use the existing bitmap badge assets:

- `/logos/knockout.png`: show when `knockoutAdvancementMatch === true`.
- `/logos/penalties.png`: show when `penaltyScoreMatch === true` and either `resultMatch === true` or `signMatch === true`.

The penalty badge intentionally requires a correct result or sign in addition to the penalty score, so an isolated penalty-score match on an otherwise wrong guess does not get the badge.

## Change Checklist

When changing this area:

- Keep inclusion/scoring in `lib/matchday-predictions.ts` or `lib/knockout-team-guesses.ts`.
- Keep rendering, colors, links, and badges in the components unless extracting a focused shared helper.
- Update both matchday and knockout team page behavior if the user expects parity.
- Verify with `npm run typecheck`; use `npm run build` when behavior or routes changed.
- Manually inspect `/`, a knockout team link from match of the day when available, and `/group2` if group behavior changed.
