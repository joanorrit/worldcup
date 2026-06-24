# World Cup Leaderboard

A minimal, server-rendered Next.js dashboard for a friends World Cup game.

## How data works

- Put CSV snapshots in `data/`.
- Files are discovered automatically; no code changes are needed.
- Dates are read from names like `Resultats_2026_06_14.csv`.
- The newest snapshot becomes the current leaderboard, while older CSVs become historical stages.

Expected columns:

```csv
Jugador,Signes,Resultats,Diferència gols,Punts
```

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.
