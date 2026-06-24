Design the app as a calm, minimal product/docs-style experience inspired by `https://pi.dev/news` and `https://pi.dev/docs/latest/models`.

The UI should feel like a polished internal documentation or product page, not a sports dashboard, fantasy football app, or betting site.

## Overall direction

- Warm parchment/off-white page background, not pure white and not dark.
- Center the main content in a responsive shell.
- Use generous whitespace and calm vertical rhythm.
- Prefer one focused primary experience over dashboards with many panels.
- Use thin warm-gray borders and subtle surface contrast.
- Avoid heavy shadows; use no shadow or a very faint 1px/soft shadow.
- Avoid loud gradients, bright sports colors, big flag graphics, stadium imagery, trophy emoji, or decorative football illustrations.

## Pi-inspired layout principles

- Main page shell:
  - centered with `margin: 0 auto`
  - max width around `80rem–82.5rem` for broad pages
  - for focused content, use narrower widths like `56rem–64rem`
  - responsive side padding:
    - mobile: around `1rem`
    - desktop: around `2rem`
  - bottom padding around `3rem–4rem`
- Header:
  - left-aligned inside the centered shell
  - max width around `40rem–44rem`
  - comfortable vertical padding, roughly `1.25rem–2.25rem`
- For chronological content, prefer a single centered feed/table/card rather than sidebars and multiple duplicate sections.

## Color palette

Use warm, muted colors close to pi.dev light mode:

- page background: `#EBE7E4` or `#FAFAF7`
- panel/card background: `#F3F2F0`, `#F4F2F0`, or `#FFFFFF` where clarity is needed
- soft panel background: `#EEF1F3`
- primary text: `#252F3D` or `#171717`
- body copy: muted blue/gray/brown like `#384251`, `#5C5752`, `#63635B`
- borders: warm translucent gray/brown like `#8B847D59`, `#5C575240`, `#E4E2D8`
- muted accent: tidal blue/gray `#4B607C`

World Cup colors should be extremely restrained:

- muted green only for positive movement or subtle active states
- muted gold/brown only for rank #1 or leader emphasis
- muted red only for negative movement or errors
- do not make green/gold the dominant visual identity

## Typography

- Calm, crisp, readable typography.
- Large page titles should feel editorial/documentation-like:
  - tight letter spacing
  - strong hierarchy
  - optional serif/italic feel if available, but not required
- Body copy:
  - around `1rem–1.2rem`
  - line-height around `1.55`
  - muted color
- Metadata:
  - small size
  - mono or mono-like style
  - uppercase where useful
  - letter spacing around `0.08em–0.13em`

## Cards, tables, and panels

- Cards/panels should be understated:
  - thin `1px` border
  - minimal or no border radius; if rounded, keep it modest (`0.5rem–1rem`)
  - no bubbly oversized corners
  - no heavy drop shadows
  - background should only slightly separate from the page
- Tables:
  - thin horizontal dividers
  - compact but readable rows
  - tabular numbers for scores/points
  - quiet hover state, e.g. slightly warmer/off-white background
  - no loud zebra striping
- Summary rows should be compact and understated, not stat-card dashboards.

## Buttons and chips

- Buttons should be small, quiet, and outlined by default.
- Use subtle hover states: border darkens slightly, background shifts slightly.
- Navigation arrows should feel like documentation controls, not sports controls.
- Chips/badges:
  - compact
  - thin border
  - small type
  - muted colors
  - use for metadata, rank movement, and status only when useful

## Leaderboard-specific guidance

- Prefer one elegant reusable leaderboard component.
- Show one snapshot at a time.
- Snapshot navigation should be simple and chronological.
- Stage/date/file metadata should be near navigation controls.
- Rank movement badges can use:
  - `↑ n` in muted green
  - `↓ n` in muted red
  - `same` in neutral gray
  - `new` in neutral gray
- Rank #1 can receive a subtle muted gold/brown text treatment, but avoid trophy emoji overload.

## Avoid

- Dashboard grids with many stat cards.
- Multiple duplicate leaderboard tables on the same page.
- Timeline sidebars unless they are very subtle and necessary.
- Football pitch backgrounds.
- Stadium/night themes.
- Bright emerald/gold as primary brand colors.
- Heavy shadows, gradients, neon colors, loud sports visuals.
- Big flags or country imagery as backgrounds.

## Tailwind-ish direction

```txt
page: bg-[#EBE7E4] or bg-[#FAFAF7]
text: text-[#252F3D] or text-[#171717]
copy: text-[#5C5752] / text-[#63635B]
panel: bg-[#F3F2F0] / bg-white
border: border-[#8B847D59] / border-[#E4E2D8]
muted accent: #4B607C
positive: muted green
leader: muted gold/brown
negative: muted red
```
