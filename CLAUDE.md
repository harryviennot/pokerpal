# CLAUDE.md

## Project

Poker Coach: a mobile app to practice No-Limit Texas Hold'em, get math-grounded coaching on every decision, and host home games with friends. The full product spec lives in `docs/poker-coach-app-prd.md`. Read it before building any feature; it defines the six pillars (odds calculator, bot play, coach, lessons, multiplayer, settlement) and the acceptance criteria.

## Tech stack

- Expo SDK 57+ (always latest stable), React Native, React 19, TypeScript in strict mode.
- Routing: expo-router with native tabs and native stack. File-based routes in `app/`.
- Native UI: prefer `@expo/ui` (SwiftUI-backed on iOS, Compose on Android) for controls where it fits: toggles, pickers, progress, forms, context menus. Fall back to custom components only when no native equivalent exists (the poker table itself).
- Animation and gestures: react-native-reanimated + react-native-gesture-handler. Card and chip animation on the table via react-native-skia.
- Icons: expo-symbols (SF Symbols) on iOS with sensible fallbacks.
- Haptics: expo-haptics.
- Client state: zustand (one store per feature, no god store).
- Server state: TanStack Query wrapping Supabase calls. Never mix server cache into zustand.
- Backend: Supabase (Auth, Postgres, Realtime). Server-authoritative game logic for friend games lives in Supabase Edge Functions.
- Local persistence: expo-sqlite via a thin repository layer. Solo mode must work fully offline.
- Testing: Jest + React Native Testing Library. The poker engine has its own pure unit test suite.
- Lint/format: ESLint (expo config + import rules) and Prettier. Both must pass before any task is considered done.

Dependency rules: install packages with `npx expo install` (never bare npm/yarn add for RN packages) so versions match the SDK. Do not add a new dependency if the standard library, Expo SDK, or an existing dependency can do the job. Adding a dependency requires a one-line justification in the PR description.

When upgrading the SDK, use the official Expo agent skills (docs.expo.dev/skills), then run `npx expo-doctor`.

## Commands

- `npx expo start` - dev server
- `npm run typecheck` - `tsc --noEmit`
- `npm run lint` - ESLint + Prettier check
- `npm test` - Jest
- `npm run test:engine` - engine suite only (fast, run constantly while touching `src/engine`)

Definition of done for every task: typecheck, lint, and tests all pass. Run them; do not assume.

## Architecture

### Layering (strict, dependencies point downward only)

1. `src/engine/` - pure TypeScript poker domain: cards, deck, hand evaluation, Monte Carlo equity, rules engine, bot decision logic, settlement math. Zero imports from React, Expo, or any I/O. Deterministic when given a seeded RNG. This is the most valuable code in the repo; it is shared by the calculator, bots, coach, and tracker.
2. `src/services/` - I/O and side effects: Supabase client, repositories over SQLite, the coach LLM client, camera/ML inference. No React.
3. `src/features/` - one folder per product pillar (`odds`, `practice`, `coach`, `learn`, `friends`, `ledger`, `tracker`). Each contains its screens' components, hooks, and store. Features may import engine and services, never each other's internals; anything shared by two features moves down or into `src/components`.
4. `src/components/` - dumb, reusable components. Props in, pixels out. No stores, no services.
   - `ui/` is the design system, described in design vocabulary: Button, Card, Sheet, StatRow, PlayingCard, ChipStack. Keep it scannable — it is the first place anyone looks before writing a component.
   - `<domain>/` folders hold components shared by two features that render an engine type rather than a design idea: `table/` (a `TableSnapshot`), `coach/` (a `DecisionReview`). A new folder needs a second consumer first; one anticipated caller is not two.
5. `app/` - expo-router route files. Thin: compose a feature screen, nothing else. No business logic in route files, ever.

Also: `src/theme/` (design tokens), `src/hooks/` (generic hooks, plus hooks shared by two features), `src/utils/` (pure helpers), `src/fixtures/` (shared test data built through the engine, never imported by production code), `docs/` (PRD and ADRs).

### Rules

- Single Responsibility: one component, hook, or module does one thing. If a file needs "and" to describe it, split it.
- Hard cap: no file above 400 lines. Soft target: components under 150, hooks under 100. Hitting the cap means extract, not squeeze.
- No duplication: before writing a component, check `src/components/` and the feature folder for an existing one. Extend via props/variants instead of copying. Third similar block of JSX or logic means extract a shared component or hook.
- Logic lives in hooks or the engine; components render. A component with a `useEffect` doing business logic is a smell: move it.
- One exported component per component file. Named exports everywhere; default exports only where expo-router requires them.
- The engine never knows about the UI, the network, or the database. If you are about to import something impure into `src/engine`, stop and invert the dependency.
- Colocate tests: `Foo.test.ts` next to `Foo.ts`.

## Design system (Apple-like, super clean)

Follow Apple's Human Interface Guidelines as the default answer to every design question.

- Typography: system font (SF Pro) only, via the platform default. Use the iOS type scale (Large Title 34, Title 28/22/20, Body 17, Footnote 13, Caption 12). Never hardcode font sizes in components; use `theme/typography`.
- Color: define semantic tokens in `src/theme/colors.ts` (background, secondaryBackground, label, secondaryLabel, tint, success, danger, felt). Every screen supports light and dark mode from day one; never hardcode a hex in a component.
- Spacing: 4pt grid. Only theme spacing tokens (4, 8, 12, 16, 20, 24, 32). Generous whitespace over dividers and boxes; when in doubt, remove chrome.
- Corners and depth: continuous corner radii from theme (10, 14, 20). Subtle shadows only; prefer hierarchy through spacing and type weight, not borders.
- Motion: reanimated springs (no linear timing for UI), 150 to 300 ms, subtle. Every animation must be interruptible. Respect the system reduce-motion setting.
- Touch: minimum 44x44pt targets. Haptics on meaningful actions (light for selection, medium for commit like Bet/Call, success/warning notifications for hand results). Never spam haptics.
- Structure: native large-title navigation, native tabs, sheets for secondary flows, context menus over custom popovers. Respect safe areas everywhere. Keyboard never covers inputs.
- Copy: short, sentence case, no jargon on user-facing surfaces. Numbers formatted (percentages one decimal, chips with thin-space grouping).
- The poker table screen is the one custom canvas: dark felt, high-contrast cards, calm palette. Even there, controls (bet slider, action buttons) follow the token system.

If a screen looks like a default template, it is not done. If it looks busy, delete elements until it does not.

## Coding standards

- TypeScript strict; `any` is banned (use `unknown` and narrow). No non-null assertions except in tests.
- Model poker domain types precisely: `Card`, `Rank`, `Suit`, `HandRank`, `Street`, `Action` as union types, not strings. Illegal states should be unrepresentable.
- All randomness flows through an injected seeded RNG interface. Never call `Math.random` directly in the engine (tests and replays depend on determinism).
- Errors: services return typed results or throw typed errors caught at the feature boundary; user-facing failures show a friendly state, never a raw message. No silent `catch {}`.
- Async: no floating promises (lint-enforced). Loading, error, and empty states are required for every data-driven view.
- Comments explain why, not what. Public engine functions get a one-line JSDoc with units (e.g., equity is 0 to 1, not percent).
- Naming: components PascalCase, hooks `useX`, stores `useXStore`, engine functions verb-first (`evaluateHand`, `simulateEquity`, `settleLedger`).

## Testing policy

- `src/engine` is test-first and aims for near-total coverage: hand evaluator against known rankings, side pots, split pots, settlement math, equity within 1 point of reference values on the PRD's 50-scenario set.
- Bots: property tests (a Shark bot must not lose chips to an always-call baseline over seeded simulated sessions).
- UI: test behavior via Testing Library (press Call, assert pot updates), not snapshots.
- Every bug fix starts with a failing test.

## Git workflow

Trunk-based development with short-lived feature branches. `main` is protected and always buildable.

### Branching

- One branch, one PR, one feature. A "feature" is a small, shippable slice (a PRD sub-section or less), not a whole pillar. Target: mergeable within a few days; a branch older than a week must be split or rebased.
- Big features are delivered as a sequence of stacked slices, each its own PR (e.g., practice mode: 1. rules engine, 2. table UI read-only, 3. betting actions, 4. bot integration, 5. polish).
- Branch names: `feat/odds-calculator-ui`, `fix/side-pot-split`, `chore/sdk-upgrade`, `refactor/extract-chip-stack`. Lowercase, hyphenated, prefixed by type.
- Branch from latest `main`, rebase on `main` before opening the PR. No long-lived develop branch, no merge commits into feature branches.

### Commits

- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`. Present tense, under 72 chars, scoped when useful (`feat(engine): add side pot resolution`).
- Small, coherent commits that each pass typecheck. No "wip" or "fixes" commits in the final PR; squash locally if needed.

### PR requirements (all must hold before merge)

1. Green checks: typecheck, lint, full test suite. Non-negotiable, enforced by branch protection.
2. Tested in the running app: the author has exercised the feature end to end in the dev build, including error/empty/loading states, before requesting merge.
3. Real-device pass required when the PR touches feel or native: animations, gestures, haptics, camera/ML, table-screen performance, navigation transitions, or any native module. The iOS simulator is acceptable only for pure logic and static layout; it misrepresents performance, haptics, and camera.
4. Dark mode and light mode both checked for any UI change.
5. PR description states: what, why, how it was tested (simulator vs device, which device), and screenshots or a screen recording for visual changes.
6. New dependencies justified in one line (see dependency rules above).
7. Scope discipline: no unrelated refactors or drive-by changes; open a separate PR.

### Merging and releases

- Squash-merge into `main` so history is one commit per feature, titled with the conventional-commit summary.
- Delete the branch after merge.
- `main` must always pass a fresh `npx expo prebuild`-free dev build; if a merge breaks main, fixing it takes priority over new work.
- Releases are cut from `main` via EAS Build; tag releases `v0.x.y`. Internal testing through TestFlight before any store submission.

## How to work in this repo (for Claude)

0. Read `docs/project-log.md` first. It records what has already been built, the decisions behind it, and the traps that have already cost time. Add an entry there when you finish a meaningful chunk of work.
1. Read the relevant PRD section before implementing a feature; respect its acceptance criteria.
2. Plan before coding on anything non-trivial: list the files you will touch and the components you will reuse. Prefer editing existing files over creating new ones.
3. Search for existing components, hooks, and engine functions before writing new ones.
4. Keep changes small and focused; do not refactor unrelated code in the same change.
5. After changes: run typecheck, lint, and the relevant tests. Fix what you broke.
6. Never commit secrets; Supabase keys come from environment config only.
7. If a requirement is ambiguous, ask rather than invent product behavior. UI polish decisions default to HIG.
8. Update this file when a convention changes; it is the source of truth for how we build.