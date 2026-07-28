# Project Log

A running record of what has been built, what was decided and why, and where the traps are. The PRD says *what* to build; [CLAUDE.md](../CLAUDE.md) says *how* to build it; this file says *what actually happened*.

Newest entries at the top. Add one per meaningful chunk of work.

---

## 2026-07-28 — Phase 2, slice 1: NLHE rules engine and table session

The engine now knows what a hand of poker is. Eight new modules in `src/engine/`, no new dependencies, no UI.

| Module | What |
| --- | --- |
| `events.ts` | `HandEvent` replay log union, `describeEvent` |
| `table.ts` | `Player`, `Action`, `HandState`, `Pot` and the trivial accessors |
| `betting.ts` | `legalActions`, min-raise rules, round closure |
| `pots.ts` | side-pot layering, uncalled bets, odd chips |
| `showdown.ts` | awards, split pots, reveal order and mucking |
| `deal.ts` | validation, antes, blinds, hole cards, street opening |
| `hand.ts` | the state machine joining the above |
| `session.ts` | button, blind levels, busts, rebuys, hand history |

322 tests passing, up from 220. Typecheck and lint clean.

### Decisions worth knowing about

**`legalActions(state)` is the only rule set.** It returns bounded descriptors (`{ type: 'raise', min, max }`); the UI will build its bet slider from it, bots will choose from it, and `applyBettingAction` validates against it. One source of truth, three consumers, nothing to drift. Actions use **raise-to** semantics — `to` is the player's total commitment on the street — so an all-in is just `to = committedThisStreet + stack` and there is no separate all-in action type.

**An incomplete all-in raise does not reopen the betting.** A shove that raises by less than the last full raise increment lifts the price but not `lastRaiseSize`. Players who already acted must call or fold; players who had not yet acted keep full raising rights. Two per-player flags carry it: `hasActedThisStreet` and `mayRaiseThisStreet`. This is the rule most engines get wrong, and it has tests in both directions.

**Uncalled bets are returned at the end of every betting round, before any pot math.** This is what keeps `buildPots` free of special cases — once the top commitment is trimmed to the second-highest, no folded player can have overcommitted, so every commitment layer is guaranteed a claimant. Side pots then reduce to layering distinct commitment levels.

**Adjacent pot layers with identical claimants are merged.** Two players folding at different levels does not create two side pots when the same seats can claim both; a side pot with no distinction is not a side pot.

**`dealHand(config, deck)` is public next to `startHand(config, rng)`.** Not a test hook: the shuffled deck is recorded in the opening event, so replay re-deals from it rather than reproducing an RNG sequence, and hand review can ask "what if the turn had been the ace" by handing in its own deck. It also makes scripted scenario tests readable.

**Folding is not offered when checking is free.** `legalActions` omits `fold` with nothing to call. It is never correct and it is a misclick at the table; bots choosing uniformly from legal actions would also fold good hands for no reason.

**Statuses are a record, not live state, once a hand ends.** A player who was all in and won keeps `allIn` with chips in front of them. Awarding does not rewrite how the hand was played, which replay needs.

**Button moves forward, skipping empty seats** — no dead button. A player can post the big blind twice in a row when the seat behind them busts; that is the accepted trade in online play and it avoids cardroom bookkeeping nobody will see.

**Each hand's seed is drawn from one session RNG** and recorded with the hand, so a session replays from a single seed and any individual hand replays standalone.

### Traps that cost real time

**A property harness built out of `expect` calls is ~50x slower than one that is not.** The first version asserted every invariant after every transition and took **69 seconds** for 8,400 hands. Collecting violations as strings and asserting once at the end took the same coverage to **1.4 seconds**. Jest's matchers, not the engine, were the entire cost — the same lesson as the Phase 1 note about benchmarking through babel-jest. Property tests belong in `test:engine`, so they have to stay cheap.

**Folding around is chip-neutral over an orbit.** A session test that played hands until a short stack busted, with every player folding, looped forever: the small blind loses 5 and the big blind wins exactly that, so a three-handed table returns to its starting stacks every three hands. Tests that need a player to bust need real betting, or should state the bust directly instead of playing toward it.

**An ante can put a player all in before a card is dealt.** Deal order and blind assignment were filtering on `status === 'active'`, which silently skipped that player — they would have been dealt no cards while still owning a share of the pot. Both now filter on "was dealt in" (`status !== 'sittingOut'`), which is a genuinely different question.

**Antes must not count towards what a player owes.** They are dead money: posted to `committedTotal` for pot layering, but `committedThisStreet` is reset to zero afterwards or the ante is treated as a partial call of the big blind.

### Testing approach

The scripted tests cover the situations we thought of; `handInvariants.test.ts` covers the ones we did not. It plays **8,400 seeded hands** through a uniformly-random legal-action chooser across two-to-nine-handed tables — including stacks too short to cover a blind and tables with antes — and after every single transition checks that chips are conserved, no stack is negative or fractional, exactly one seat is on the clock and can actually act, no card is dealt twice, dealt + burned + undealt is 52, and the board matches the street. Every hand must terminate inside 500 actions.

That harness is what makes the engine safe to hand to bots in the next slice, since bots will find every unreachable branch eventually.

### Known gaps

- **Reveal order after an all-in run-out** falls back to "first seat left of the button" rather than the last aggressor from the last street that had betting. Cosmetic — it moves no chips — but it is not quite the TDA rule.
- **No straddles, no run-it-twice, no dead button.** None are in the PRD.
- Session-level chip conservation is asserted in tests but the session layer has no property harness of its own; hand-level invariants carry it for now.

### Next

Slice 2 of Phase 2: the table UI, read-only — render a `HandState` on the felt with no betting controls, driven by hand history. Then betting actions, then the bot archetypes the PRD names.

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
