# PRD: Poker Coach

A mobile app to practice Texas Hold'em, get coached on every decision, and eventually play home games with friends.

Status: Draft v0.1
Owner: You
Last updated: 2026-07-28

---

## 1. Problem statement

Recreational poker players who want to improve have no good feedback loop. Real games are slow, expensive teachers: you rarely know whether a decision was good or just lucky. Existing training tools are either dry solver software built for pros, or casual poker games with no educational value. There is no app that lets a beginner-to-intermediate player practice realistic hands, get instant objective feedback, and track improvement over time, while also doubling as the platform for their real home games.

## 2. Goals

1. Help the user measurably improve at No-Limit Texas Hold'em.
2. Make practice fun enough that it happens daily (play-first, lessons second).
3. Provide trustworthy, math-grounded feedback, never hand-wavy advice.
4. Support real home games with friends, including buy-in tracking and settlement.

### Non-goals (v1)

- Real-money gambling of any kind. The app never moves money; it only tracks who owes whom in private games.
- Poker variants other than No-Limit Texas Hold'em (Omaha etc. can come later).
- Public matchmaking with strangers.
- Anti-cheat for competitive play (friends games are trust-based).

## 3. Target user

- Primary: a new-to-intermediate hobby player (like the author) who plays casual home games and wants to stop making obvious mistakes.
- Secondary: their friend group, who join hosted games and may or may not care about the training features.

## 4. Product pillars and features

### Pillar A: Odds Calculator (standalone tool)

A fast equity calculator usable at any time, independent of game mode.

Requirements:

- Input hero hole cards (0, 1, or 2 known), community cards (0 to 5 known), and number of opponents (1 to 8).
- Support marking opponents as "random hand" or assigning a simple range preset (tight, standard, loose, or custom grid later).
- Output win / tie / lose percentages via Monte Carlo simulation (target: 10,000+ iterations in under 1 second on a mid-range phone).
- Show outs and common draw odds when a draw is detected (flush draw, open-ender, gutshot).
- Show pot odds helper: enter pot size and bet to call, app says the required equity and whether the call is profitable given current equity.
- Card picker UI must be fast: tap rank then suit, with used cards greyed out.

Acceptance criteria: results within 1 percentage point of a reference equity calculator on a standard test set of 50 scenarios.

#### A2: Camera card scan (on-device)

Point the camera at cards instead of tapping them in.

Requirements:

- On-device object detection model (YOLO-nano class, TFLite / Core ML) recognizes rank and suit of face-up cards in the camera frame in real time; no network required.
- Detected cards appear as confirmable chips; user taps to accept or correct before they are committed, handling glare, occlusion, and misreads gracefully.
- Works for board cards primarily; hole cards default to manual entry (two taps) with optional scan.
- Model trained on public card datasets plus synthetic composites (card scans over random backgrounds, angles, lighting). Standard index decks supported first; four-color and novelty decks later.
- Target: detection at 20+ fps on a mid-range phone, scan-to-equity in under 2 seconds total.
- Positioning and copy: presented as a study and home-game tool. Casinos prohibit phone use at the table, and using it mid-hand without everyone's agreement is cheating; the app should say so plainly.

Acceptance criteria: 95%+ correct rank-and-suit reads on a benchmark photo set (varied lighting/angles) before user correction.

#### A3: Live hand tracker (play-by-play)

Follow a real hand as it happens, with odds updating at every step.

Requirements:

- Start a hand: enter hole cards, number of players dealt in, positions optional.
- As the hand unfolds: add flop, turn, river (by tap or camera scan); mark players who fold so the opponent count and equity update immediately.
- Pot odds live: enter pot size and bet facing you at any point; app shows required equity vs current equity and a call/fold/raise-leaning verdict.
- Every tracked hand is saved as a hand history and can be sent to the Coach (Pillar C) for post-game review, turning real games into training data.
- Fully offline; one-hand operation optimized (large tap targets, portrait).

Acceptance criteria: a full hand can be tracked in under 15 seconds of total interaction across all streets.

#### A4: Live Assist (continuous camera HUD)

The camera watches the table continuously and overlays live information, combining A2's recognition with A3's tracking.

Requirements:

- Tier 1 (core): continuous on-device detection of board cards from the live feed; as cards are dealt they appear in the HUD and hero equity, outs, and draw odds update in real time. Hole cards entered once at hand start.
- Tier 2 (advice): pot size and bet facing hero are entered by quick tap or short voice input (vision cannot read bets reliably); the HUD then shows required equity vs actual equity and a recommended action (fold / call / raise-leaning) with the reasoning available on tap. Advice uses the same graded rubric as the Coach so it is consistent with post-hand analysis.
- Tier 3 (experimental, not promised): chip stack and bet-size estimation from vision. Ships only if accuracy is high enough that advice built on it is trustworthy; otherwise stays behind a flag.
- All processing on device; no frames leave the phone.
- Session recording: every hand observed in Live Assist becomes a saved hand history for Coach review.
- Intended-use framing (required copy in the feature itself): Live Assist is a training tool for practice with physical cards, agreed learning games, and review. Real-time assistance devices are banned in casinos and using this mid-hand in any game without every player's agreement is cheating. The app states this at first launch of the feature.

Acceptance criteria: Tier 1 keeps a stable, correct board state through a full dealt hand at 20+ fps on a mid-range phone with no user correction in good lighting.

### Pillar B: Practice mode (play vs bots)

Full hands of NLHE against 1 to 8 bots at a virtual table.

Requirements:

- Complete NLHE rules engine: blinds, betting rounds, side pots, all-ins, split pots, showdown hand ranking.
- Configurable table: number of bots, starting stacks, blind levels, cash-game style (rebuy allowed) or sit-and-go style (play until one player has all chips).
- Play speed controls: normal, fast (bots act instantly), and step-by-step.
- Hand history: every hand is stored locally and replayable street by street.

Bot design:

- Bots decide using the same equity engine plus a personality profile with tunable parameters: preflop looseness (VPIP), aggression (raise vs call frequency), bluff frequency, positional awareness, tilt/randomness factor.
- Bot architecture is layered; difficulty maps to how many layers a bot uses:
  1. Hand evaluation: fast lookup-table 7-card evaluator (shared engine).
  2. Equity vs pot odds: Monte Carlo equity compared to the price offered (Easy/Medium).
  3. Range modeling: each opponent is tracked as a range of likely hands, narrowed Bayesian-style after every action; preflop play follows precomputed solved charts by position (Hard).
  4. Mixed strategies: frequency-based actions (e.g., bet 70% / check 30% with the same holding) and bluff frequencies balanced against value bets, seeded RNG for reproducibility. Shark-level postflop play uses strategy tables precomputed offline via abstracted CFR (bucketed hands and textures, restricted bet sizes) shipped with the app; no heavy solving on device.
  5. Exploitation: bots track the hero's tendencies (VPIP, fold-to-raise, bluff rate) and deviate to punish specific leaks. Deliberately educational: an exploitative bot exposes the player's habits in a way a balanced bot cannot.
- Ship with named archetypes so the user learns to exploit real player types:
  - The Rock (very tight, only bets with strong hands)
  - The Calling Station (calls too much, rarely raises)
  - The Maniac (bets and raises constantly)
  - The TAG (tight-aggressive, solid fundamentals)
  - The Shark (hardest: solved preflop charts, equity-driven postflop, balanced bluffs, mild randomization to avoid being predictable)
- Difficulty levels (Easy / Medium / Hard / Shark) map to how mathematically sound and how unexploitable the bot mix is.

Acceptance criteria: rules engine passes an exhaustive test suite (side pots, ties, odd-chip rules); bot quality is measured, not assumed, via a simulation harness where bots play 100k+ seeded hands against each other and against baselines (always-call, always-fold); each difficulty tier must beat the tier below it and a naive always-call strategy must lose chips to Medium bots over 1,000 simulated hands.

### Pillar C: The Coach (post-hand and post-session analysis)

The core differentiator. Every decision in practice mode is graded against the math.

Requirements:

- Coach toggle: off (just play), per-hand (summary after each hand), or per-decision (inline nudge after each action, training-wheels mode).
- For each hero decision, the engine records: position, equity vs estimated ranges, pot odds offered, stack-to-pot ratio, and the action taken.
- Grades each decision: Correct / Marginal / Mistake / Blunder, with a one-line mathematical reason (e.g., "Called 40% of pot with 18% equity and no draw").
- Natural-language coaching layer: an LLM turns the math engine's findings into friendly explanations and one concrete takeaway per hand. The math engine is the source of truth; the LLM only rephrases and contextualizes, never invents numbers.
- Leak tracker: mistakes are tagged by category (preflop looseness, chasing without odds, missed value bets, over-bluffing, positional errors) and aggregated into a "Your top 3 leaks" dashboard with trend lines over time.
- Session summary: net result, biggest pots, best and worst decisions, one focus point for next session.

Acceptance criteria: coach grades agree with a reference solver-informed rubric on at least 90% of a curated 100-decision test set.

### Pillar D: Learn (lessons, drills, and course)

A structured course tightly coupled to interactive practice, not passive reading.

Course outline (progressive levels, each unlocks the next):

1. Foundations: hand rankings, table positions, how a hand flows.
2. Preflop discipline: starting hand charts by position, why position matters.
3. The math: outs, pot odds, implied odds, equity intuition.
4. Postflop basics: board texture, made hands vs draws, bet sizing.
5. Reading opponents: ranges, player types, exploiting archetypes.
6. Aggression: value betting, semi-bluffs, when and why to bluff.
7. Meta skills: bankroll management, tilt control, table selection.

Drill types (each lesson ends with drills, and drills are also playable standalone):

- Preflop trainer: flashcard spots ("UTG with KJo: fold, call, or raise?") with spaced repetition so weak spots recur more often.
- Equity guessing game: see a matchup, guess the win percentage before reveal; score by accuracy. Trains table-speed estimation.
- Scenario mode: replay one tricky spot type (e.g., facing a river check-raise) repeatedly with variations.
- Quiz checkpoints per lesson.

Progress system: XP, streaks, per-skill mastery bars. Leak tracker (Pillar C) recommends which drills to do next, closing the loop between play and study.

### Pillar E: Play with friends (multiplayer)

Private online home games.

Requirements:

- Host creates a room, sets stakes structure (point value of chips, starting stacks, blinds), gets a 6-character join code and share link.
- Friends join from their phones; seats fill in join order; host can start, pause, and kick.
- Realtime sync of game state; reconnection recovers state; a disconnected player is auto-folded after a timeout.
- In-game emotes/chat (lightweight).
- Coach features are disabled during live friend games (no unfair assistance), but hands are recorded for post-game review by each player privately.

### Pillar F: Buy-ins and settlement

- Before the game, each player declares a buy-in amount (plus optional rebuys during play, host-approved).
- App tracks each player's chip count; at game end it produces a balance sheet: buy-in, cash-out, net.
- Debt simplification: computes the minimum set of transfers ("Marc pays Julie 15, Tom pays Julie 5") instead of pairwise IOUs.
- Export/share: shareable summary image or text for the group chat.
- The app never handles money. It is a ledger only. Copy in the UI must make this clear.

## 5. What could be added later (backlog ideas)

- Custom bot builder: tune your own villain's parameters.
- Range visualizer grid for study.
- Import hand histories from other apps for coaching.
- Tournament mode with escalating blinds and payout structures.
- Omaha and short-deck variants.
- Voice coach mode (spoken feedback between hands).
- Weekly challenge hands shared to all users.

## 6. Technical approach

- Client: React Native + Expo (single codebase for iOS and Android). Table UI in a canvas/Skia layer for smooth chip and card animation.
- Equity engine: hand evaluator plus Monte Carlo simulation written in TypeScript first; port hot path to native/WASM if profiling demands it. Shared by calculator, bots, and coach.
- Bots: local, deterministic-with-seed decision engine (personality parameters + equity). No server needed for solo play; solo mode works fully offline.
- Card recognition: on-device model (TensorFlow Lite on Android, Core ML on iOS) via react-native-vision-camera frame processors; inference and equity both run locally, so scan mode works offline.
- Coach LLM layer: Anthropic API call that receives the structured math verdicts and produces the natural-language explanation.
- Backend (multiplayer + accounts + ledger): Supabase, using Realtime channels for game state, Postgres for hands/ledger/progress, Auth for accounts. Server-authoritative game logic for friend games via an edge function so clients cannot cheat by tampering.
- Persistence: local-first for solo (SQLite on device), synced to Supabase when signed in.

## 7. Phased roadmap

- Phase 1: Foundation. Card/deck model, hand evaluator, Monte Carlo engine, odds calculator screen. (Pillar A)
- Phase 2: Solo play. Full rules engine, table UI, bot archetypes with difficulty levels, hand history + replay. (Pillar B)
- Phase 3: Coach. Decision logging, grading rubric, LLM explanation layer, leak tracker, session summaries. (Pillar C)
- Phase 4: Learn. Course levels 1 to 4, preflop trainer, equity guessing game, progress system. (Pillar D, first half)
- Phase 5: Friends. Supabase backend, rooms and join codes, realtime play, buy-in ledger and settlement. (Pillars E and F)
- Phase 6: Depth. Course levels 5 to 7, scenario mode, backlog items by demand.
- Phase 2.5 (parallel track): Live hand tracker, since it reuses the Phase 1 engine with a new screen. Camera scan lands later (Phase 4 to 6 window) because model training and tuning is its own workstream; the tracker must not wait for it.

Each phase ships something independently useful; Phase 1 alone is already a tool you would use at the table tomorrow.

## 8. Success metrics

- Learning: coach mistake rate per 100 decisions trends downward for an active user over 4 weeks; preflop trainer accuracy reaches 90%+.
- Engagement: median 3+ practice sessions per week; drill streaks sustained.
- Utility: at least one full friends game hosted end to end with settlement sheet shared.
- Quality: equity engine accuracy within 1 point of reference; zero rules-engine disputes in friend games.

## 9. Risks and open questions

- Bot quality vs effort: a true GTO bot is a research project. Mitigation: personality-plus-equity bots with precomputed preflop charts are plenty strong for the target user; "Shark" difficulty is calibrated, not solved.
- Coach trust: if the coach is ever wrong, trust collapses. Mitigation: math engine as single source of truth, LLM restricted to explanation, curated test set gating releases.
- Legal: money-adjacent features vary by jurisdiction. Mitigation: strict ledger-only design, no deposits, no payments, clear copy. Worth a check before public release, fine for personal/friends use.
- Open: cash game only for friends mode in v1, or also tournament? Anonymous guest join vs required accounts? Portrait or landscape table UI (leaning portrait for one-hand phone play)?