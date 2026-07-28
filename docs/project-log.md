# Project Log

A running record of what has been built, what was decided and why, and where the traps are. The PRD says *what* to build; [CLAUDE.md](../CLAUDE.md) says *how* to build it; this file says *what actually happened*.

Newest entries at the top. Add one per meaningful chunk of work.

---

## 2026-07-28 — Phase 1: Foundation and Odds Calculator

Went from an empty repository to a working odds calculator. Five commits on `main`, delivered as four PRs.

| Commit | PR | What |
| --- | --- | --- |
| `f58b731` | — | Expo SDK 57 scaffold, strict TS, ESLint/Prettier, Jest |
| `179ebfc` | #4 | GitHub Actions CI |
| `eb8367c` | #1 | Cards, seeded RNG, deck, 7-card evaluator |
| `082acc9` | #5 | Equity, ranges, draws, pot odds |
| `c409483` | #3 | The Odds Calculator screen |

State at the end: 220 tests passing, typecheck and lint clean, both native bundles building in CI, and the calculator verified running on the iOS simulator in light and dark mode.

### Decisions worth knowing about

**Cards are branded integers, not objects.** A `Card` is a number `0..51` encoded as `rankIndex * 4 + suitIndex`, branded so only `makeCard` and `parseCard` can produce one. The simulator evaluates millions of cards per run; an object per card would have dominated the budget. Illegal states stay unrepresentable, which is what CLAUDE.md actually asks for — it does not require an object.

**The evaluator does not check 21 subsets.** A hand reduces to a 13-bit rank mask, four suit masks and a rank-count array. Straights come from an 8 KB `Int8Array` built at module load — no generated file, no build step. A hand with five of one suit can never also be quads or a full house, so a flush short-circuits. Results pack into one integer, making comparison a single numeric operation and a split pot exact equality.

Measured at **91 ns per seven-card hand** (10.9M/sec) in V8. Note that the same benchmark reads ~280k/sec under Jest — that is babel-jest instrumentation, not the engine. Benchmark against compiled output, not through the test runner.

**Equity has two independent code paths on purpose.** `enumerateEquity` walks every runout exactly; `simulateEquity` samples with a seeded RNG. They share only the evaluator, which is what makes the test suite meaningful — the exact path is the ground truth the sampled path is measured against. `equity()` picks between them.

Limitation to remember: `enumerateEquity` requires **every** opponent hand to be known. In the calculator's normal case (N random opponents) the answer is always sampled. The exact path serves hand review, study spots, and tests.

**Outs mean "cards that complete a detected straight or flush draw"** — not "any card that improves hero's category". The looser definition counts board pairs, which help every opponent equally, and reported **23 outs for a bare flush draw instead of 9**. Equity is the number that accounts for opponents; the calculator shows both.

**The calculator converges rather than blocking.** Equity runs in 2,000-sample chunks across frames, so the figure visibly settles while the UI keeps painting; any input change cancels the run in flight. The exact path is derived in a `useMemo`, not stored in an effect — an effect meant `setState` during render, which the React compiler lint correctly rejects. Sampled state carries the input key it belongs to so a stale result can never flash.

**No tabs yet.** A one-item tab bar reads as broken. The app is a large-title stack until Practice mode gives it a second destination in Phase 2.

**Deviations from CLAUDE.md's stated stack, all deliberate:** Reanimated, Gesture Handler, Skia, SQLite, Supabase and TanStack Query are *not* installed. They arrive in the phase that needs them, per the dependency rule. `expo-symbols` was installed and then removed when the design settled on plain glyphs.

### Traps that cost real time

**`npm ci` cannot be used in CI on Linux.** npm does not record the dependencies of optional packages it prunes on the generating platform, so a macOS lockfile fails `npm ci` on Linux with `@emnapi/core@2.0.0-alpha.3 missing from lock file` (via `@napi-rs/wasm-runtime`, pulled in by the ESLint import resolver). Things that do **not** fix it: `--omit=optional` (the sync check runs first), regenerating with `--package-lock-only` (prunes the same subtree), pinning the prerelease through `overrides` (the parent is never installed here). A full re-resolve *does* place them, but drifts `react-native-worklets` off the version the SDK pins. CI therefore uses `npm install --no-audit --no-fund`, with `npx expo install --check` as the drift guard.

**Screen tests must drain the chunked simulation.** Timers left pending outlive the test that started them and land on the next test's tree, which shows up as *later, unrelated* tests rendering an empty screen — several tests away from the actual cause. Call the `settleEquity()` helper after anything that completes a hand. `jest.setup.ts` sets `IS_REACT_ACT_ENVIRONMENT`; RNTL 14's `render` is **async** and must be awaited.

**TypeScript 6 does not auto-include `@types/jest`.** `tsconfig.json` needs `"types": ["jest"]` or every test file fails `tsc --noEmit`. This shipped broken in the scaffold commit and was only caught later — `main` was red for four commits before CI existed to notice.

**Deleting a base branch auto-closes its child PR.** Merging #1 with `--delete-branch` closed stacked PR #2, and GitHub then refuses to reopen it (restoring the branch does not help). #2 had to be replaced by #5. When PRs are stacked, **retarget the child to `main` before merging the parent**, and do not delete branches until the stack is done.

### Testing approach

The engine's correctness rests on exhaustive invariants rather than spot checks, and that is worth preserving:

- All **2,598,960** five-card hands enumerated; the category histogram matches the textbook counts exactly and yields precisely **7,462** distinct hand values.
- The 7-card path is checked against a deliberately naive best-of-21-subsets reference over 20,000 random hands.
- The PRD's **50-scenario** equity set passes within 1 point. Ten preflop matchups have widely published equities that our enumeration reproduces (AA vs KK 82.4%, AKs vs QQ 46.2%, AKo vs AQo 74.0%) — that external agreement is what stops the set being self-fulfilling. The other 24 are postflop spots whose ground truth is computed live by `enumerateEquity`, so nothing is hardcoded.

Jest runs as two projects. `engine` is a plain node environment with no React Native transform, so `npm run test:engine` stays fast enough to run continuously. `app` carries the jest-expo preset.

### Known gaps

- **No real-device pass.** The calculator touches haptics and scroll feel; CLAUDE.md requires a device check for that and it has not happened. Simulator only so far.
- **No branch protection on `main`.** CLAUDE.md calls green checks "non-negotiable", but nothing enforces it — the `verify` and `build` checks are worth marking required in repo settings.
- **Placeholder app icon.** Still the default Expo artwork.
- **No dependency audit in CI.** There was an audit job; it was removed on request. The `overrides` block in `package.json` (pinning `brace-expansion` and `uuid` forward) stays, because it takes the tree to zero known vulnerabilities and costs nothing. npm's own suggested fix for those two was a semver-major *downgrade* of jest and expo-splash-screen.

### Next

Phase 2 per the PRD: the NLHE rules engine, then the table UI, then betting actions, then bot archetypes — each its own slice and PR. The engine layer it builds on is in place and tested.
