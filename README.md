# PokerPal

Practice No-Limit Texas Hold'em, get math-grounded coaching on every decision, and host home games with friends.

The product spec lives in [docs/poker-coach-app-prd.md](docs/poker-coach-app-prd.md); engineering conventions live in [CLAUDE.md](CLAUDE.md).

## Getting started

```bash
npm install
npx expo start
```

Press `i` for the iOS simulator or scan the QR code with Expo Go. Every dependency in the current phase ships inside Expo Go, so no native build is required yet.

## Commands

| Command               | What it does                                           |
| --------------------- | ------------------------------------------------------ |
| `npx expo start`      | Dev server                                             |
| `npm run typecheck`   | `tsc --noEmit`                                         |
| `npm run lint`        | ESLint + Prettier check                                |
| `npm run format`      | Prettier write                                         |
| `npm test`            | Full Jest suite                                        |
| `npm run test:engine` | Engine suite only — fast, run while editing the engine |

Typecheck, lint, and tests must all pass before any task is considered done.

## Layout

```
app/                 expo-router routes — thin, compose a feature screen
src/engine/          pure TypeScript poker domain (no React, Expo, or I/O)
src/services/        I/O and side effects
src/features/        one folder per product pillar
src/components/ui/   reusable design-system components
src/theme/           design tokens
docs/                PRD and ADRs
```

Dependencies point downward only. A lint rule fails the build if anything impure is imported into `src/engine`.
