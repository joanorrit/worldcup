---
name: worldcup-custom-app
description: World Cup custom app implementation guidance for this repository. Use when Codex is asked to design, build, restyle, review, or refine the app UI, especially leaderboard, prediction, standings, and tournament pages that should follow the project's calm pi.dev-inspired product/docs visual direction.
---

# World Cup Custom App

Use this skill for UI and product implementation work in this repository.

## UI Style

Before changing frontend layout, styling, copy hierarchy, or component presentation, read [ui-design-style.md](ui-design-style.md) and apply it as the visual source of truth.

Treat the style guide as project-specific direction that overrides generic sports-site instincts. Keep the app calm, minimal, documentation-like, and focused on one primary experience rather than a dashboard-heavy sports interface.

## Implementation Notes

- Preserve existing app conventions and component boundaries unless the requested change requires otherwise.
- Keep changes scoped to the page or component being worked on.
- Prefer reusable leaderboard and prediction components over duplicated page-specific markup.
- Use restrained World Cup color cues only for semantic states such as rank movement, errors, active states, or leader emphasis.
- Verify responsive behavior for mobile and desktop when changing layout or typography.
