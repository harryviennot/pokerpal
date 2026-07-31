# Project Log

A running record of what has been built, what was decided and why, and where the traps are. The PRD says *what* to build; [CLAUDE.md](../CLAUDE.md) says *how* to build it; this file says *what actually happened*.

Newest entries at the top. Add one per meaningful chunk of work.

---

## 2026-07-31 — LivePlay slice 2: the screen reader, and cards you never type in

Slice 1 shipped the pipeline behind a placeholder `.tflite`, so on a real
device LivePlay only ever showed its demo feed. That is fixed, and the fix
changed what the feature *is*.

**The scenario, stated plainly, because it decides everything below.** Two
phones: one runs PokerPal's practice game, the other films it with LivePlay
open. The overlay reads the table it is pointed at and shows the coach's
recommendation. The camera is watching **our own renderer** — which means we
know every pixel it will see, and a model is the wrong tool for a problem we
have the source code to.

So the ML path is gone: `react-native-fast-tflite`, its config plugin, the
placeholder model, `metro.config.js`'s asset extension and the decode/classMap
modules are all deleted. Git history keeps them for the physical-cards
workstream the PRD still describes; nothing in the tree pretends to be a
detector any more.

**In their place, `src/services/vision/screenReader/` — classic CV, pure TS.**

1. **Segmentation.** A whiteness mask on a stride-2 grid: bright *relative to
   the frame's own 95th-percentile luma* (so exposure shifts don't matter) and
   near-grey (so the blue felt, the red card backs and the purple mystery cards
   never enter the mask — the between-hands interstitial reads as empty felt for
   free, which is exactly what the boundary logic already wanted). Connected
   components come from a run-length union-find over preallocated typed arrays.
2. **Zoning by geometry, not by class.** The board is the largest aligned row of
   card-shaped blobs in the middle band; the hero pair is the low central fan,
   split at the column of least white coverage; everything else — opponent
   showdowns near the felt edges, stray pills — is `other` and never read.
3. **Reading a face.** Rank and suit come from two *fixed* sub-windows of the
   card, tight-cropped to their ink, contrast-normalized, and cross-correlated
   against templates. Suit shape decides; the pip's colour only breaks a
   near-tie, because our four-colour deck shares a hue between ♠ and ♣ and both
   ♥ and ♦ are warm.
4. **Templates rendered at runtime** with the platform's own system font via an
   offscreen Skia surface — the filmed screen draws SF Pro on iOS and Roboto on
   Android, so shipping bitmaps would mean matching one platform's glyphs
   against the other's.

**Hero cards are read, not typed.** Fusion grew a second channel: hero
candidates confirm on the same N-of-M rules, but lock as a **pair or not at
all** (one confirmed card is half a hand, and half a hand cannot be graded) and
go inert for the rest of the hand once locked. The store adopts that lock only
when nothing is set, so a pair the player entered or corrected is never
overwritten by a later frame. The setup gate is deleted; opening the tab is
enough.

Decisions and traps, the ones that cost time:

- **The boundary clock now counts empty *board* frames, not empty frames.** The
  hero's cards sit on screen for the entire hand; counting them would mean a
  hand could never end. Zone-less detections still mean `board`, so all 19
  original fusion tests passed untouched through the change.
- **Cross-channel blocking is not optional.** A card locked on the board must
  not audition as a hero card and vice versa — the same physical card cannot be
  in two places, and without the shared blocked set a misread in one channel
  poisons the other.
- **A tight crop on one side must be a tight crop on the other.** The reader
  crops what it extracts to the ink, so the templates have to be cropped the
  same way, or the two are scaled from different extents and the correlation
  collapses. This ate several rounds: the synthetic fixture's glyphs now force
  their four corner blocks on precisely so the crop is stable, and their
  interiors spell `index × 0x5B` rather than a hash — a 1-bit hash collision
  reads as two glyphs that are a coin-flip apart.
- **A glyph is not one band.** The first band-splitting attempt assumed rank and
  pip were the top two runs of ink rows; both ♦ and ♥ pinch in the middle, and
  a rank can break too. Fixed windows at fixed fractions of the card are what a
  known renderer actually affords.
- **The worklet declaration-order trap bit twice more** (`alignedRow`,
  `meanInkColor`). Helpers above callers, always, in anything the frame worklet
  can reach.
- **`setState` in an effect is lint-banned** and was the wrong shape anyway: the
  templates are needed on the very first frame, so they are computed in a lazy
  `useState` initializer instead of a render spent on `null`.

The test seam that made all of this tractable: `synthetic.ts` paints an RGB
buffer — the exact input the worklet gets — stamping the same glyph bitmaps
that `fakeTemplates()` matches against. `screenReaderPipeline.test.ts` then runs
painted pixels through the reader, fusion, the store and the coach with nothing
of ours mocked. 920 tests green.

Standing gaps, honestly: **still no device pass** (CLAUDE.md PR rule 3), so the
thresholds in `screenReader/config.ts` and the 640×1138 working resolution are
reasoned, not measured, and perspective tolerance is untested against a real
lens. The Skia template path has never executed — under Jest it returns null by
design and the demo feed takes over. And if the filmed screen still shows the
previous hand's cards when `startNextHand` fires, they can re-lock; the practice
game's deal animation makes that unlikely and the correction UI covers it, but
it is unproven.

---

## 2026-07-31 — LivePlay slice 1: the camera pipeline, end to end, on a stand-in model

Pillar A's Live Assist (PRD §A2/§A4) as a new `Live` tab: the camera watches a
real table, board cards lock into a persistent game state, and the coach's own
rubric recommends a sized action in real time. The whole pipeline exists —
tab → camera → frame worklet → tensor decode → temporal fusion → store →
`reviewDecision` → HUD → archive — with the detection model as the one
swappable stand-in. Bet reading by vision is deliberately **not** in this
slice: the PRD's Tier 2 quick-tap pot entry is the trustworthy path, and the
Tier 3 vision estimate stays a flag-gated later slice that will pre-fill the
sheet, never feed advice silently.

What shipped, bottom up:

1. **`src/services/vision/`** — the camera-free contract. `FrameDetections` is
   the seam: the real producer is a TFLite frame worklet, the test producer is
   `scriptedSource` (the `memoryRepo` of this service). `decodeDetections` is
   worklet-safe, written against the YOLO single-tensor export shape, and
   fixture-tested; it is the contract a replacement model must meet. The seam
   is *data-shaped* rather than an interface — everything downstream consumes
   `FrameDetections` through one store entry point, so Jest and the demo mode
   run the identical path the camera will.
2. **`fusion.ts`** — the heart of "keep the state, add to it". Detections
   audition as candidates keyed by card identity (52 identities make bbox
   tracking unnecessary); six steady sightings lock, eight misses evaporate a
   misread, glare flicker survives. The flop commits only as a set of three
   ordered by box position, then exactly one turn and one river; a locked card
   is immutable to vision — corrections are store actions, and a corrected or
   rejected card goes on a dead list the camera cannot resurrect. Two seconds
   of empty felt past a flop proposes the hand boundary. Every rule has a
   named test.
3. **Advice on the Coach's rubric.** `buildLiveHandState` dresses the observed
   spot (hero cards, locked board, opponent count, tapped pot/bet, all in bb ×
   100 chips) as a legal `HandState`; `reviewDecision` grades it with the same
   EV model and bands as post-hand review, seeded per spot so the same spot
   always says the same thing. Advice recomputes on state change only, never
   per frame. The banner's `reason` is phrased forward from `facts` — the
   engine's own reason string describes an action already *taken*.
4. **Archival.** Schema v2 adds `sessions.origin` ('game' | 'live'); observed
   hands flow through the existing `HandArchiver` with an honest event log —
   hero cards, locked streets, synthesized deck with observed cards pinned in
   deal positions, **no invented actions, hero net zero**. `replayHand`
   tolerates the action-free log (verified by test), so live hands replay in
   the tracker with villains simply never revealing. Advice is stored as
   zero-loss reviews (action = best) so leak tallies never charge the player
   for decisions nobody watched them make. History rows wear a `Live` tag.
5. **The ethics gate.** PRD A4's required copy — training tool, banned in
   casinos, mid-hand use without every player's agreement is cheating — shown
   before the camera ever mounts, persisted through a new
   `src/services/settings/` kv-store repo seamed like the hand-history one.
6. **The native layer, last and isolated.** `react-native-vision-camera` 5 is
   a full Nitro rewrite: no `useFrameProcessor`, no config plugin. Frames come
   from `useFrameOutput` with `pixelFormat: 'rgb'` and a `targetResolution` of
   the model's input size — which made the planned `vision-camera-resize-plugin`
   unnecessary (it is a v4-era package); `react-native-vision-camera-worklets`
   is the required companion. Permissions went into `app.json` directly
   (`ios.infoPlist`, `android.permissions`) since v5 has no plugin.
   `react-native-fast-tflite` 3 with the Core ML delegate runs the model
   synchronously in the frame worklet; the 10 Hz pacing gate lives on the
   React side because fusion's windows are tuned for it. The bundled
   `assets/models/cards.tflite` is a placeholder — loading fails, the stage
   falls back to a scripted demo feed, and that fallback is exactly what Jest
   exercises.

Decisions and traps:

- **Fusion counts frames, not milliseconds.** All its constants assume the
  10 Hz post rate; the gate that enforces that rate is in
  `useCardFrameProcessor`, deliberately on the JS side (worklet closures
  cannot carry state across invocations, and the frame timestamp unit is
  undocumented in VisionCamera 5 — `Date.now()` at the gate is the one clock
  everything agrees on).
- **The worklet transform bites declaration order.** A `'worklet'` function
  compiled by the reanimated Babel plugin captures its helpers *at definition
  time*; helpers declared below the caller arrive as `undefined` in Jest.
  Helpers above callers in any worklet-safe module.
- **Zustand updates under React 19 need async `act`.** Store writes from
  outside a component (feeding scripted frames in a screen test) only flush
  through `await act(async () => …)`; the sync form leaves the tree stale.
- **Steady state must not churn React.** `fuseFrame` returns reference-stable
  `board`/`candidates` when nothing changed, so selector-subscribed components
  sit idle at 10 Hz; the store also bails entirely on frames that change
  nothing visible.
- **The stand-in model is AGPL** (`keremberke/yolov8n-playing-cards` class of
  exports): dev-only, never committed, never shipped. The commercial model is
  its own slice, gated on the PRD's 95% benchmark set.
- **A fresh clone typechecks only after `expo-env.d.ts` exists** (generated;
  gitignored). The generic `require<T>()` typing lives in `expo/types` behind
  it. Also, the committed lockfile was missing two `@emnapi` entries and
  `npm ci` refused it; re-synced in this slice.
- **Expo Go is dead.** VisionCamera + fast-tflite are native modules; the app
  now needs `npx expo run:ios|android` or an EAS dev build.

Standing gaps, honestly: no device pass yet — camera, permissions, worklet
runtime compatibility, fps/thermals, and the Core ML delegate are all
unverified until this branch is built on hardware (CLAUDE.md PR rule 3), and
the real detector does not exist yet, so detection accuracy is not a claim
this slice makes anywhere. `expo-doctor` also reports pre-existing patch-level
version lags (expo 57.0.8 vs .9, RN 0.86.0 vs .2) left for a separate chore.

---

## 2026-07-30 — The arena: a full-screen game above the tabs, bots that think, and two ways to play

The game is no longer a tab with a header on top of it. It is a full-screen
route pushed over the whole tab bar, the table tab became a lobby you configure
*before* you play, and the bottom of the screen stopped being a stack of panels.
Modeled closely on the Betclic-style reference screenshots in `reference/`.

Six changes, each large enough to have been its own slice:

1. **Routes.** The root is a `Stack`; the tabs live in `(tabs)/` and the game is
   `/game`, with `/game/review` (formSheet), `/game/summary` and
   `/game/hand/[id]` as siblings so a replay opens above the tabs too.
2. **The store paces itself.** `playUntilSeat`'s synchronous loop is gone from
   the play path. `useGameStore` runs a pump that applies one bot action per
   scheduled tick and reveals one event per tick, so a hand plays out instead of
   snapping to its result.
3. **The felt is the supplied art.** `table-arena.png` drawn through a measured
   mapping, on a Skia backdrop of the reference's blue field and diagonal
   slashes. Seats sit on slot tables measured off the screenshots.
4. **The console floats.** Fold/Call/Raise in red over the backdrop with a
   vertical preset stack (All-in, Pot, x3.0/x2.5 preflop or 65%/35% postflop)
   and a ±big-blind stepper. No panel, no card, nothing boxing it in.
5. **Coaching became a notification.** The post-hand verdict slides in from the
   top, auto-dismisses, and taps through to the review sheet — which is now
   reached from a button in the top-right corner.
6. **Two modes.** Learning has unlimited time and live equity; Real Game has a
   20-second decision clock, blinds that climb every three minutes, no help
   while you play, and a summary at the end that replays your best and worst
   hand with the coach's reason for each.

| File | What |
| --- | --- |
| `app/_layout.tsx`, `app/(tabs)/`, `app/game/` | root Stack; tabs moved under `(tabs)`; `/game` + review/summary/hand routes. `app/table/` deleted |
| `src/features/game/useGameStore.ts` + `gamePump`, `gameScheduler`, `pacing`, `preselect`, `grading`, `handRecord` | the paced store: one action per tick, three RNG streams, chunked grading, wall-clock blind levels |
| `src/features/game/GameScreen.tsx` + `TopBar`, `ActionConsole`, `ActionRow`, `PreselectRow`, `PresetStack`, `ConsoleButton`, `DecisionClock`, `AdviceBanner`, `betPresets`, `useShownFrame`, `useLiveEquity`, `useRunoutEquity`, `useChunkedEquity` | the arena chrome. `TableScreen`/`ActionBar`/`BetSizer`/`CoachNote`/`HandResult` deleted |
| `src/features/game/LobbyScreen.tsx` + `ModeChoice`, `TableSetupForm`, `StakesSetup`, `SetupField` | configure before you play, with the mode choice as the headline |
| `src/features/game/SessionSummaryScreen.tsx` + `GradeBreakdown`, `SessionHighlights`, `HighlightCard`, `sessionReport`, `useSessionHands` | the real-mode report and its best/worst replays |
| `src/components/table/` | `GameBackdrop`, `CardFlip`, `SeatCards`, `HandRankPlate`, `EquityBadge`, `DealerButton` + pure `tableArt`, `seatSlots`, `seatMetrics`, `seatTone`, `boardLayout`, `arenaSlashes`; `TableFelt`/`useSeatGeometry`/`TableSeat`/`SeatPill`/`SeatAvatar`/`TableBet`/`TableCenter`/`WinnerBanner`/`PokerTable` rewritten |
| `src/components/ui/` | `PlayingCard` redesigned; `CardFace`, `CardBack`, `MysteryCard`, `suitColor` extracted |
| `src/engine/{session,coach}.ts` | `advanceToLevel` (the wall-clock seam) and `decisionPoints` (the chunked-grading seam) |
| `src/services/handHistory/` | `currentSessionId()`, `listSessionHands()` for the summary's replay lookup |
| `src/features/game/avatars.ts`, `assets/avatars/` | the ten character faces, drawn uniquely per session from the seeded RNG |

No new dependencies. `react-native-gesture-handler` was considered for
swipe-to-dismiss on the advice banner and rejected: it is not a direct
dependency, it would need a `GestureHandlerRootView` at the root, and a 44pt ✕
does the same job.

### Decisions worth knowing about

**The table art was already cut out.** `table.PNG` is RGBA with everything
outside the capsule at alpha 0, so the planned Skia rounded-rect clip was
unnecessary — a plain `<Image>` composites it straight onto the backdrop.
Measured once and encoded in `tableArt.ts`: the capsule occupies
x 0.2432, y 0.1016, w 0.5127, h 0.765 of the 1024×1536 image, aspect 0.4468.
Skia earns its place on the backdrop only, where a sheared gradient and a dozen
slashes are five draw calls and nothing a view border can fake. `useImage` was
avoided deliberately: it returns null on the first frame and would flash an
empty felt on every mount and every replay step.

**Pacing draws from its own RNG.** Three streams off the session seed: the
deck's, `botRng`, and a new `paceRng` for think-delays and the avatar draw. A
delay stealing a number from the bot stream would make an archived hand replay
differently from the hand that was played. There is a test that plays a paced
hand and compares its event log to `playUntilSeat` run synchronously on the same
seed — one stolen draw and they diverge.

**Grading is chunked, and the order is load-bearing.** `reviewDecision` draws
from the `Rng` it is handed, so a verdict depends on how many decisions were
graded before it. `decisionPoints` is walked front to back sharing ONE
`createRng(hand.seed)`, one decision per tick; that is the only way to reproduce
`reviewHand`, and it is asserted against it. A fresh Rng per tick is a different
coach, not a chunked one — which is exactly the bug the first version of that
test had.

**Blinds rise on the clock, between hands.** `SessionConfig.handsPerLevel`
counts hands, which is the wrong unit for "every three minutes". The store owns
the clock and states the level through the pure `advanceToLevel`, applied before
each deal — so the engine keeps its invariants and blinds never change
mid-hand.

**`shown` counts revealed events, not board cards.** The felt renders
`hand.events.slice(0, shown)`. `useHandReplay(..., {follow: true})` is
deliberately *not* used on the live screen: it pins to the newest frame and
would undo every bit of the pacing. It stays for the tracker and the review.

**The bottom gave back ~60pt, and the table grew ~30%.** The old screen
reserved ~324pt in-hand and ~390pt between hands (commentary, sizer, action bar,
coach note, result). Now only the 52pt action row is exclusive; the preset
column floats over the empty lower-right of the felt. The capsule went from
roughly 302×467 to 394×608 on a 402pt screen.

**A preselect that stops being legal clears instead of folding.** An armed
`check` invalidated by someone's raise is cleared, not converted — folding a
hand the player never chose to fold would be the worst possible surprise.
`checkFold` in that spot does fold, because that is what it says.

### Traps

**The store no longer deals at import.** `game` is null between sessions, so
every consumer needs a real empty state; `/game` redirects to `/lobby` when
there is none. The old screen tests relied on that eager deal.

**`startNextHand` throws** when the session is over or fewer than two players
can play. The pump gates on that before calling it; the real-mode bust path
would crash otherwise.

**Jest's `moduleNameMapper` was ordered wrong** — `'^@/(.*)$'` sat before
`'^@/assets/(.*)$'`, so asset paths resolved into `src/assets/`. Found while
proving the avatar requires actually bundle (`expo export` lists all ten webp
files). Metro cannot do dynamic `require`, hence the static ten-entry map.

**A layer must be `position: 'absolute'`, and Jest cannot tell you when it
isn't.** The rewritten `TableFelt` shipped as a flow child with a real height,
which pushed every seat — zero-height flow wrappers whose absolute contents
hang off them — its full 608 points down the screen. Every test passed
(layout never runs under Jest); the first simulator run showed an empty felt
with avatars peeking over the bottom bezel. The seat maths was verified pure
and correct within minutes; the bug was one missing `position: 'absolute'`.
Simulator smoke-testing after a visual rewrite is not optional here.

**Plates carry the category, the coach keeps the sentence.** "Two pair, kings
and eights" truncated on every plate the first time a real two-pair hit the
felt. Shown-down plates now use `categoryName` ("Two pair"), matching the
reference; the hero's live caption keeps the spoken form ("Pair of fours") and
trims only a comma'd tail. And the hero's seat is named "You", so the winner
caption special-cases "You win the hand" — caught on the second simulated
showdown.

**A showdown gets read, not glimpsed.** Playtesting found the result gone
before it registered. Two changes, both in `pacing.ts` + `TableSeat`: each
`showdownHand` reveal now holds 1.1 s (was 0.5), and the finished hand lingers
`AUTO_NEXT_SHOWDOWN_MS` (8 s) before the next deal when cards were shown —
fold-ended hands keep the 4 s beat, because there is nothing on the felt to
study. And a mucked hand is turned face up, dimmed, instead of vanishing:
real poker lets a loser hide it, but the player learns nothing from a hand
that disappears, and the reference turns every losing hand over in grey. The
engine still records the muck; only the presentation declines to honour it.

**`allInBadge` was sampled off the wrong element** and landed blue; the
reference badge is red (`#E1444E`). Worth remembering that the equity chips and
the ALL IN badge look similar in a thumbnail and are not the same colour.

### Not done

**No real-device pass yet, and no verified device pass on the navigation.**
NativeTabs is still `unstable_`; that a push over the tab bar covers it was
confirmed from the installed expo-router source and a Metro bundle, not on
hardware. CLAUDE.md PR rule 3 applies before this merges.

**Equity badges do not show mid-run-out yet.** The engine only emits
`showdownHand` at the river — `closeStreet` runs the board out and then
finishes — so the badge window is currently the showdown reveal, where the
percentages are the exact result. `useRunoutEquity` is written and tested
against the incomplete-board case; the reference's 28% / 41% / 30% appears the
moment all-in hands are revealed earlier, with no change to the hook.

**No icon library.** `expo-symbols` is not a dependency, so the chevron,
stopwatch and review button are text glyphs.

---

## 2026-07-29 — Table redesign: the capsule felt, seats with faces, and a real showdown

The table screen now looks like a poker app instead of a wireframe, modeled on
reference screenshots: a portrait capsule table with a dark rim and radial-lit
teal felt (Skia), seat pills with initial avatars and tucked card backs, a
"Pot total" readout, two-corner card faces, chip-disc bets, a winner
presentation (gold glow, crown, `+N`, banner, non-playing cards dimmed) and a
live made-hand caption under the hero's fanned cards. First motion in the app:
deal/pop springs, bet chips zooming in and fading to the pot, a pot pulse and
the winner glow — all through named spring presets in `theme/motion.ts`,
all instant under reduce-motion.

| File | What |
| --- | --- |
| `src/components/table/` | `PokerTable` split into `TableFelt` (Skia), `TableCenter`, `TableSeat`, `SeatPill`, `SeatAvatar`, `TableBet`, `WinnerBanner`, `DealIn`, `useSeatGeometry`, `winnerSummary` |
| `src/engine/evaluator.ts` | `bestFive`: the five cards that play, for showdown highlighting |
| `src/engine/describeRank.ts` | `describeHandRank` / `describeMadeHand` copy ("Nines full of fours") |
| `src/engine/{showdown,events,hand,replay}.ts` | `bestFive` threaded to `ReplaySeat`; optional on the event so archived hands replay as null |
| `src/components/ui/{PlayingCard,ChipStack}.tsx` | two-corner faces, live `dimmed`, real card back; one chip disc over the amount |
| `src/theme/{colors,motion}.ts` | felt/rim/pill/winner/card tokens; spring presets |
| `src/hooks/useMotionPrefs.ts` | the one place that asks about reduced motion |

Two new dependencies, the ones CLAUDE.md and the PRD name for exactly this
slice: `@shopify/react-native-skia` (the felt) and `react-native-reanimated`
(+`react-native-worklets`).

Rebased onto slices 4 and 5, which moved the table to `src/components/table/`
on its second consumer. The redesign landed there rather than in the practice
feature, so the tracker's `HandReplayScreen` inherits all of it — a stored hand
now replays onto the new felt, with the winner banner and the dimmed
non-playing cards appearing at its showdown frames.

### Decisions worth knowing about

**`bestFive` rides the event log, not the UI.** The evaluator's packed score
cannot say *which* five cards won, so `bestFive` brute-forces the ≤21 subsets
on the display path and `resolveShowdown` stamps it into `showdownHand`
events. The field is optional there and `ReplaySeat.bestFive` is null for
hands archived before it existed — an empty `winningFive` set dims nothing
rather than crashing a legacy replay.

**Dimming talks, not just fades.** A card outside the winning five renders on
a grey face *and* appends ", does not play" to its accessibility label. The
first plan — `accessibilityState.disabled` — was ambiguous because every
non-pressable card already reads disabled from its `Pressable`.

**The hero seat is the same component.** `revealed` switches a seat from
avatar-plus-backs to large fanned face-up cards and the made-hand caption;
there is no `HeroSeat` fork to drift.

### Traps

- **Mocking reanimated in `jest.setup.ts` needs `__esModule: true` and an
  explicit `default`.** Both are non-enumerable on the real module, so a
  spread drops them, babel's interop then hands components the whole module
  as `Animated`, and every `Animated.View` renders as undefined. The failure
  names the innocent parent component, not the import.
- **jest-expo and react-native-worklets both want Jest's `resolver` slot.**
  `jest.resolver.js` composes them (worklets strips `.native` so its JS
  implementation loads); overriding `transformIgnorePatterns` or `setupFiles`
  likewise *replaces* the preset's values, so both are extended from
  `jest-expo/ios/jest-preset` programmatically instead of copied.
- **RNTL normalizes `formatChips`'s narrow no-break space to a plain space**
  in label queries — expectations must write `1 000` with a plain space, not the invisible U+202F character itself.
- **`toHaveAccessibilityState` is gone from RNTL v13**; assert on
  `accessibilityState` props or, better, put the state in the label.

### Known gaps

- The bet chip fades out when the street ends rather than flying its path to
  the pot; a bespoke flight needs per-seat vectors through a custom exiting
  worklet and wasn't worth it yet.
- The hero's own winning seat shows the gold pill and `+N` but no crown — the
  crown lives on the avatar, which the hero seat doesn't render.
- No real-device pass yet. Springs, the Skia felt, shadow glow and haptics
  all misrepresent on the simulator; CLAUDE.md's PR rule 3 applies before
  merge.
- `ActionBar` still hand-rolls its buttons. Slice 4 added
  `components/ui/Button`, but it is single-line and one tone, where these are
  a verb over an amount in two tones. Widening the design-system button is its
  own change, not one to smuggle into a rebase.
## 2026-07-29 — Phase 2, slice 6: the player chooses the table

Pillar B had an unmet acceptance criterion hiding in plain sight: *"Configurable
table: number of bots, starting stacks, blind levels, cash-game style (rebuy
allowed) or sit-and-go style."* The engine has supported every word of that since
the rules engine landed — `SessionConfig` already had `seats`, `style`, `levels`
and `rebuyTo`. It was all frozen into one constant in the practice store, with
three separate comments promising "the table-configuration slice". This is it.

| File | What |
| --- | --- |
| `src/features/practice/tableSetup.ts` | `TableSetup`, the mixes, the options, and `toSessionConfig` |
| `src/features/practice/TableSetupScreen.tsx` | the sheet: opponents, who they are, stakes, stack, style |
| `src/features/practice/TableSetupLink.tsx` | the way in, from the felt's navigation bar |
| `src/features/practice/usePracticeStore.ts` | `setup` state, `configure`, and bots built from the chosen table |
| `app/table/setup.tsx`, `app/table/_layout.tsx` | a second formSheet over the felt |

526 tests passing, up from 508. Typecheck and lint clean. No new dependencies —
the pickers and the toggle are `@expo/ui`, which was already installed.

### Decisions worth knowing about

**A table of one archetype is a drill, not a novelty.** The mix options are
`mixed` plus each named archetype filling every seat, because "a table of calling
stations" is how you practise value betting and "a table of rocks" is how you
practise stealing. That is also where the difficulty ladder went: a table of
Sharks is the hard game, and it needs no separate Easy/Medium/Hard dial on top.

**Two bugs fell out of the store change, both real.** The bot policies were a
module constant built from the frozen table, so `reset(config)` with a different
table would have seated the wrong bots — silently, since a bot is just a
function. And the seed was the literal `20260728`, which means **every launch
dealt the identical session**: same cards, same opponents, same decisions. Both
are fixed by the same move — the setup is state, and the session is built from
it. There is now a test asserting that two seeds deal different hands, and one
asserting that the archetypes actually change what happens at the table.

**The seed is the clock, and the tests say so out loud.** Pinning a seed was
doing double duty: it made the tests deterministic *and* it froze the product.
The store now seeds from `Date.now()` and the tests pass `SEED` explicitly, which
is what they always meant. Every seed is still recorded with its session and its
hands, so a table is replayable after the fact — it is just no longer replayed by
accident.

**`toSessionConfig` drops `rebuyTo` for a sit-and-go whatever the toggle says.**
Buying back in is exactly what makes it not a sit-and-go, and a config that
contradicts itself should never reach the engine. The toggle is hidden rather
than disabled in that mode, with one line saying what happens instead.

**The setup screen is a formSheet, reached from the header.** Same precedent as
the review sheet: a secondary flow over the felt, not a destination. The felt has
no room for a settings control, and a header accessory costs nothing.

### Traps that cost real time

**Removing a fixed seed breaks every test that named a card.** Four assertions
like `getByLabelText('Call 10')` were quietly depending on the frozen session.
That they broke is the point — they were testing one seeded table while claiming
to test the screen.

**A mixed table of four opponents deals four archetypes, not three.** An
off-by-one in the test, not the code, and the profile objects in the failure diff
are long enough to hide it.

### Known gaps

- **The setup does not persist.** Relaunching returns to the default six-handed
  5/10 table. Settings storage is its own thing — SQLite has no key-value table
  and AsyncStorage is not installed.
- **The seat plates still do not say what each bot is.** The setup screen names
  them — "Ava, The Calling Station" — but once you are at the felt they are back
  to being names. Putting the type on an 84pt seat plate means widening
  `ReplaySeat`, which reaches into persistence, so it is its own slice.
- **No blind levels that rise.** `SessionConfig.handsPerLevel` exists and the
  screen offers a single level; a real sit-and-go wants a ladder.
- **The picker options are untestable under Jest.** They are native views and
  `Picker.Item` renders `null`, so the screen tests cover the summary, the seat
  list and the button. Which option a tap actually selects is device-only.
- **No simulator pass**, as ever. Two sheets over the felt, the header
  accessory, and both colour schemes are unverified.
- **Nothing warns before ending a session.** The button says it and the sheet
  says it, but there is no confirmation step.

### Next

Play speed and bot pacing — the other Pillar B requirement still outstanding, and
the one that makes the felt feel like a game. Then the LLM explanation layer, or
Phase 4.

---

## 2026-07-29 — Phase 3, slice 5: the leak dashboard and the trend that earns itself

The History tab became the dashboard the PRD asks for: mistakes per hundred
decisions charted session by session, and the top three leaks tallied across
every session ever played. Pillar C's *"aggregated into a 'Your top 3 leaks'
dashboard with trend lines over time"* is the last thing Phase 3 owed.

| File | What |
| --- | --- |
| `src/engine/trends.ts` | `summarizeTrend`, `mistakeRate`, `isMistake`, and the bands that decide whether there is a trend at all |
| `src/services/handHistory/` | `listSessions` and `leakTotals` — two aggregate queries, no schema change |
| `src/components/ui/Sparkbars.tsx` | a run of values as bars, drawn in plain Views |
| `src/components/coach/LeakSummary.tsx` | moved down on its second consumer |
| `src/features/tracker/MistakeTrend.tsx` | the chart, the rate and the sentence about it |
| `src/features/tracker/{HistoryScreen,useHandHistory}` | the dashboard, loaded in one round of queries |

504 tests passing, up from 482. Typecheck and lint clean. No new dependencies.

### Decisions worth knowing about

**The metric is a rate, never a count.** Leak counts rise because you played
more, so a raw-count chart tells an improving player they are getting worse. The
unit is mistakes per hundred graded decisions, which is also the PRD's own
success metric — *"coach mistake rate per 100 decisions trends downward over
4 weeks"*. There is a test whose whole job is to assert that a tenfold busier
run of sessions at the same rate reads as `steady`.

**The engine refuses to name a direction it cannot back.** Under four sessions
or forty graded decisions, `direction` is `unknown` and the UI says "play four
sessions and this starts reading as a trend" instead of drawing a verdict. The
log has recorded twice already that a poker number over a small sample measures
variance; a trend line is that mistake with a picture attached.

**The band is deliberately wide, and asymmetric on purpose.** A move must clear
a quarter of the earlier rate *and* two mistakes per hundred before it is called.
Telling an improving player they are getting worse costs trust the coach does not
get back; missing a small genuine move costs one more session of "steady".

**Direction is the recent half against the earlier half, not a fitted line.** It
needs no regression to explain, one wild session cannot swing it, and a player
can check the claim themselves. A trend the user cannot verify is a trend they
have to take on faith, which is the opposite of the point.

**Sessions are the x-axis, not calendar days.** A session is a unit a player
recognises — "last night" — and bucketing by day in SQL would have to pick a
timezone that `formatWhen` then disagrees with on the device. `sessions.started_at`
was already there.

**The chart is Views, not a library.** Skia and SVG are both uninstalled, and
CLAUDE.md's dependency rule says do not add one if what is here will do. Six bars
need no drawing engine; `ChipStack` already builds its discs the same way. Axes,
gridlines and a curve would be decoration over six numbers. Each bar carries its
own accessibility label, because the shape is exactly what a screen reader
cannot see.

**Two aggregate queries, not one review-fetching endpoint.** `decision_reviews`
already denormalises `grade`, `leak` and `ev_loss` into real columns — that was
slice 3 being careful — so both answers are one `GROUP BY` away and no JSON is
parsed. No migration.

**One hook, one round of queries.** The History tab reads a single local
database, so `useHandHistory` fetches all four results in one `Promise.all`
rather than four hooks racing four spinners over one screen.

### Traps that cost real time

**A hands-to-reviews join counts a hand once per decision it contains.** The
first `listSessions` summed `hero_net` over the joined rows, so a hand with three
graded decisions contributed its net three times. Correlated subqueries per
column, and a contract test that stores two hands and two reviews specifically so
the wrong version fails on the net.

**The first "noise" test was not noise.** 20 to 25 mistakes per hundred is a 25%
move and the code was right to call it. The lesson is that a band has to be
chosen from what a false alarm costs, and the test written afterwards — not the
other way round.

### Known gaps

- **The two new SQL statements are the ones Jest cannot run.** Same standing gap:
  expo-sqlite is out of Jest's module graph, so the contract suite pins the
  semantics against `memoryRepo` and the SQL itself is only exercised in the app.
  These two are the most intricate SQL in the repo, which makes a device pass
  worth more than usual.
- **No simulator pass**, again: the bar chart's proportions, the History tab with
  four sections, and both colour schemes are unverified.
- **The trend has one bar per session, capped at twelve.** A player with fifty
  short sessions sees the last twelve; there is no weekly rollup and no way to
  change the window.
- **Bars are coloured against the all-time average**, which means a player who is
  uniformly bad sees half their bars green. It reads as "better than your usual",
  which is what was wanted, but it is not a standard anyone external would set.
- **`evLost` is stored and summed but never charted.** Chips given up is arguably
  the better trend line than mistake count; it is also noisier, and one chart
  that is understood beats two that are skimmed.
- **Nothing recommends a drill from a leak yet** — the PRD's closing of the loop
  between Pillar C and Pillar D.

### Next

Phase 3's remaining piece is the LLM explanation layer over the coach's facts —
the one part of the pillar that needs the network, an API key, and a rule that it
may never invent a number. Otherwise Phase 4 opens: the Learn pillar, whose
preflop trainer the leak tracker is now able to point at.

---

## 2026-07-29 — Phase 3, slice 4: a stored hand opens and replays

Tapping a row in History now deals that hand back onto the felt and steps
through it action by action, with the coach's verdict appearing on the frame of
the decision it graded. Pillar B's *"every hand is stored locally and replayable
street by street"* is now true on both halves.

Delivered as two commits: a pure refactor, then the feature.

| File | What |
| --- | --- |
| `src/components/table/` | `PokerTable`, `TableSeat`, `ReplayControls`, moved out of practice, plus a new `ReplayCommentary` |
| `src/components/coach/` | `DecisionRow`, `coachCopy`, same move |
| `src/hooks/useHandReplay.ts` | the replay cursor, now shared |
| `src/fixtures/playedHand.ts` | a real engine-played and coach-graded hand, for any test that needs one |
| `src/components/ui/{Button,EmptyState}.tsx` | the retry button and the "nothing here" screen, extracted on their second use |
| `src/engine/replay.ts` | `reviewsByFrame`: verdicts lined up against the frames they belong to |
| `src/services/handHistory/` | `StoredHand` gained `heroSeat`, read from the hand's own session |
| `src/features/tracker/` | `useStoredHand`, `HandReplayScreen`, `HandFacts`, a pressable `HandHistoryRow` |
| `app/history/[id].tsx` | the app's first route parameter |

482 tests passing, up from 464. Typecheck and lint clean. No new dependencies.

### Decisions worth knowing about

**The move came first, and on its own.** The replay screen needs the felt, the
replay cursor and the coach's decision row, all of which lived inside the
practice feature — and features may not import each other's internals. Doing it
as a separate commit with an unchanged test count is what makes the feature diff
readable.

**`src/components/ui/` is the design system; `src/components/<domain>/` is
everything else shared.** `ui/` is described in design vocabulary — Button, Text,
StatRow, a card face — and its value is that it stays scannable, because
CLAUDE.md tells everyone to check it before writing a component. `PokerTable`
takes a `TableSnapshot` and `DecisionRow` takes a `DecisionReview`: each renders
exactly one engine type. That is a different altitude, so `table/` and `coach/`
sit beside `ui/` rather than inside it. CLAUDE.md was updated, because it is the
source of truth for this and the convention is new.

**Only what is actually shared moved.** `CoachNote` and `LeakSummary` stayed in
practice: nothing else consumes them, and `CoachNote`'s accessibility hint names
the session review. The rule says *shared by two features*, present tense — one
anticipated caller is not two.

**`heroSeat` is read from the session, not guessed.** The felt rotates to the
hero and turns their cards face up, so a stored hand cannot be replayed without
it. `hero_seat` was already on the `sessions` table and simply never read back,
so `getHand` now joins it — no migration, and the log's earlier claim that a hand
replays "from its row alone" is finally true. The alternatives all fail on a real
hand: `reviews[0].seat` does not exist when the hero folded preflop with nothing
graded, and hardcoding 0 renders a rotated felt silently wrong the day a second
hero seat exists. The contract test stores two hands under sessions with
different hero seats, so both wrong answers fail it.

**`reviewsByFrame` refuses to guess.** `reviewHand` drops any decision the coach
could not grade, so its output is a *subsequence* of the hero's actions, not a
pairing. If the counts disagree the function returns all nulls rather than
attaching a verdict to the wrong action. A coach that says nothing is
recoverable; a coach that blames the wrong decision is the trust failure the PRD
names as the product's biggest risk.

**The verdict shows in place, not just in a list.** Both, in fact: the frame the
cursor is on carries its own verdict, and every verdict is listed below. Seeing
"CORRECT — called 67% of pot with 47% equity" at the exact moment it was decided
is the thing this screen is for; the list is the at-a-glance version.

**The felt is sized by aspect ratio, not flexed.** `PokerTable` fills its parent,
and a `flex: 1` child of a `ScrollView` collapses to nothing — the screen would
render a felt of zero height and no test could see it. `aspectRatio: 0.85` scales
with the device instead of picking a magic height.

### Traps that cost real time

**`SELECT h.*, s.*` would have silently corrupted the row.** `sessions` also has
`id`, `seed`, `small_blind` and `big_blind`, and SQLite resolves duplicate result
column names last-wins — a star join would have overwritten the hand's id and
blinds with the session's. The query names `s.hero_seat` and nothing else.

**A fixture that always takes the first legal action folds preflop.** The first
version of `playedHand.ts` produced exactly one hero decision, which is not
enough to test stepping between verdicts. Checking and calling instead reaches a
showdown and grades four.

**`HistoryScreen.test.tsx` kept passing after the screen started importing
`router`.** The mock factory did not define it, so `router` was `undefined` and
nothing noticed until something pressed a row. Green tests are not proof the mock
is complete.

### Known gaps

- **The SQL `getHand` join is the one statement Jest cannot run.** expo-sqlite
  does not exist under it, so the join is verified by the contract suite against
  `memoryRepo` and by review. Worse: every stored session has `heroSeat` 0 today,
  so even a device run cannot distinguish the join from the hardcode without
  temporarily moving `HERO_SEAT`.
- **No simulator pass**, again — remote Linux container. The felt inside a scroll
  view, the aspect ratio across device sizes, the title swapping to `Hand #12`
  after load, the push transition inside the History tab and both colour schemes
  all need a device.
- **A hand stored with no events** renders the summary and decisions but no felt.
  Reachable, handled, and it looks like an omission rather than an explanation.
- **The replay does not animate or auto-play.** Stepping is manual; the PRD's
  play-speed controls belong with the pacing slice.
- **Nothing links a hand back to its session**, so there is no way to see the
  other hands played alongside it.

### Next

Leak trends over time — the last thing the log's Phase 3 list still owes, and now
the only one whose data was already there. Or the LLM explanation layer over the
coach's facts.

---

## 2026-07-29 — Phase 3, slice 3: hands survive the app — SQLite and the History tab

The first I/O in the repo. Every finished hand is written to expo-sqlite with
its full event log, deck and coach grades, and a new History tab lists them
across restarts. `src/services/` now exists, and the tracker pillar has its
first surface.

| File | What |
| --- | --- |
| `src/services/handHistory/repo.ts` | the contract: `HandHistoryRepo`, `PersistenceError` |
| `src/services/handHistory/migrations.ts` | schema v1 behind `PRAGMA user_version`, append-only |
| `src/services/handHistory/sqliteRepo.ts` | the expo-sqlite implementation, the only file importing it |
| `src/services/handHistory/memoryRepo.ts` | the same contract on arrays, for Jest and previews |
| `src/services/handHistory/archiver.ts` | the write queue between a synchronous game and an async disk |
| `src/features/practice/usePracticeStore.ts` | archives on hand completion; `saveState` |
| `src/features/tracker/` | `useHandHistory`, `HistoryScreen`, `HandHistoryRow` |
| `app/history/` | the third native tab |

464 tests passing, up from 436. Typecheck and lint clean. One new dependency:
expo-sqlite, the persistence layer CLAUDE.md names, installed by the slice that
needs it.

### Decisions worth knowing about

**Events are the stored truth; reviews are stored too, not re-derived.**
`events_json` carries the deck via the `handStart` event, so a stored hand can
be replayed or re-graded from its row alone. Grades are also persisted because
re-deriving them costs ~1 500 Monte Carlo samples per decision — free at the
moment the hand ends, seconds of CPU if a history list had to do it. A
`coach_version` column marks which rubric produced each grade, so a future
coach change can find and re-grade stale verdicts instead of silently mixing
scales.

**The store never awaits the disk.** `HandArchiver.recordHand` returns void and
chains every write onto one internal promise tail — the no-floating-promises
rule is satisfied structurally, writes are strictly ordered, and the session
row is created lazily by the first hand's write so a hand can never race its
own session. A failed session insert clears the memo and the next hand retries
it; failures surface as `saveState: 'error'` and one footnote on the review
sheet, and the game keeps playing.

**Hands are archived the moment they complete, not when the next one is
dealt.** The player who reads a result and kills the app keeps that hand.
`nextHand` re-saves defensively; `UNIQUE(session_id, hand_number)` makes the
double-save a no-op, which the contract tests pin.

**The contract suite is the spec; the fake is what Jest runs.** expo-sqlite
does not exist under Jest. Mocking it would test the mock, and better-sqlite3
would be a native dev-dependency plus an adapter that exists only for tests.
Instead the repository behavior is one parameterized suite run against
`memoryRepo`, and `sqliteRepo` promises the same contract — verified in the
running app, which CLAUDE.md requires before merge anyway. The dynamic import
in `services/handHistory/index.ts` is what keeps expo-sqlite out of Jest's
module graph; `jest.setup.ts` installs a fresh memory repo before every test.

**No TanStack Query.** Not installed, and this is local single-writer play
data — the server-state rules don't apply. One `useHandHistory` hook with
explicit loading, error and empty states.

**No mid-session resume, on purpose.** `SessionState.rng` is a closure and
cannot be serialized without engine surgery. The PRD asks for stored,
replayable hands, not resumable sessions: launch deals fresh, the review sheet
stays session-scoped, and what survives restart is the History tab.

**`reload` never drops to `loading`.** A tab-focus refresh updates the list in
place; the spinner exists only before the first result ever arrives.

### Traps that cost real time

**A bare `act(() => hook.reload())` does not flush the async work it starts.**
The state update fired, the effect re-ran, and the fetch's `setState` then
landed where no `waitFor` ever saw it — the test read a stale-but-ready state
forever. `await act(async () => …)` is the form that works; the screen tests
never hit this because `userEvent.press` already wraps properly.

**Jest cannot run a test file outside the project root** — the babel runtime
resolves relative to the test file, so a scratch-directory repro fails on
`@babel/runtime` before it fails on anything real. Debug files go inside
`src/`, then get deleted.

### Known gaps

- **The SQL implementation is exercised by the app, not by Jest.** The contract
  suite pins the behavior and `sqliteRepo` mirrors it statement by statement,
  but nothing automated executes the SQL. A dev-screen run of the contract
  against the real database on a simulator would close this.
- **No simulator pass from this environment** (remote Linux container, again):
  the History tab, the third-tab layout, and an actual kill-and-relaunch
  persistence check all need a simulator or device before merge.
- **History lists, but cannot open, a hand.** Tapping a row should replay it —
  that slice starts by moving `PokerTable`/`useHandReplay`/`DecisionRow` down
  out of the practice feature, which is its own refactor.
- **The list is capped at 100 rows** with no paging, and nothing prunes the
  database, ever.
- **Trend lines still missing** — but the data side is now done: timestamps,
  per-hand net, per-decision `ev_loss` and `leak` are all queryable. What
  remains is a charting decision.

### Next

Either the stored-hand replay screen (move the shared table pieces down, then
`getHand` feeds the existing replay UI), or leak trends over time now that the
timestamps exist.

---

## 2026-07-29 — Phase 3, slice 2: the leak tracker and the session review

The coach's verdicts add up to something. A review sheet off the table shows how
the session is going, the three habits costing the most, and every graded
decision from the last hand — the PRD's leak tracker and session summary,
session-scoped.

| File | What |
| --- | --- |
| `src/engine/leaks.ts` | `tallyLeaks`, `topLeaks`, `costliestDecision`, `bestDecision`, `summarizeSession` |
| `src/features/practice/usePracticeStore.ts` | grades finished hands, accumulates `coachHistory` |
| `src/features/practice/SessionReviewScreen.tsx` | the sheet: summary, leaks, decisions |
| `src/features/practice/DecisionRow.tsx`, `LeakSummary.tsx`, `coachCopy.ts` | its parts and their words |
| `src/components/ui/StatRow.tsx` | label-left value-right row, extracted on its third use |
| `app/table/review.tsx` | formSheet route; the coach note on the felt opens it |

436 tests passing, up from 412. Typecheck and lint clean. No new dependencies.

### Decisions worth knowing about

**Aggregation is engine code, in its own module.** `coach.ts` grades one
decision and is already at the file cap; answering "what habit is costing me"
is a different responsibility and a pure fold over `DecisionReview[]`. The
future cross-session dashboard reads the same functions.

**Grading moved out of the hook and into the store.** Three consumers now need
the same reviews — the felt's coach note, the review sheet, and the session
books — so the store computes them once when a hand completes, and
`useHandCoach` shrank to a selector. `coachHistory` records `{ handNumber, net,
reviews }` per finished hand; it is local play data, the same category as
`hand` and `session`, not server cache.

**Leaks are ranked by chips given up, not by count.** Three cheap positional
slips matter less than one habitual bad call, and the order should say so. The
"focus" line is simply the top leak's one-line fix from `LEAK_FOCUS`.

**"Best decision" means the correct one with the most at stake.** Every correct
decision ties at zero EV lost, so lowest-loss cannot rank them; the biggest pot
navigated correctly is the one that took nerve.

**The review lives in `src/features/practice`, not a new `tracker` feature.**
It reads `usePracticeStore`, and features may not import each other's
internals. The tracker feature is born when SQLite persistence gives it its own
repository-backed data source.

**Trend lines are deferred with persistence, deliberately.** Nothing persists
yet, and an in-session trend over ~20 hands is the same small-sample trap this
log already records twice. A trend the tracker cannot back would be the coach
lying with a chart.

### Traps that cost real time

**A decision renders in two places, and tests must expect that.** The costliest
decision appears under Highlights *and* in the last hand's list, so
`getByText(/Folded/)` fails on "found multiple elements". Not a bug — the same
verdict shown twice is the design — but the assertions have to be
`getAllByText`.

**`prettier --check` runs after ESLint in `npm run lint`** — an auto-fixed
import order still fails the script until Prettier has run over the same files.

### Known gaps

- **No simulator pass.** This slice was built in a remote Linux container with
  no iOS simulator. The formSheet-over-native-tabs presentation and both color
  schemes are exactly what a simulator or device has to confirm before this is
  called done; tests cannot see either. Flagged in the PR rather than claimed.
- **Only the last hand's decisions are listed.** Earlier hands are in
  `coachHistory` and summarized, but there is no per-hand browser yet.
- **Nothing persists.** Close the app and the session review is gone. SQLite,
  and the trends it makes honest, are their own slice.
- **The evLoss shown is chips, not big blinds.** One blind level exists today,
  so they differ only by a constant; when levels vary the display should
  convert per hand.

### Next

The LLM explanation layer over the coach's facts, or SQLite persistence for
hands and reviews — whichever the next session picks, the reviews it needs are
now accumulated and typed.

---

## 2026-07-29 — Phase 3, slice 1: the coach grades a decision

Pillar C opens. Every decision the player makes is graded against the math, with
a one-line reason built from numbers the engine computed.

| File | What |
| --- | --- |
| `src/engine/coach.ts` | `reviewDecision`, `reviewHand`, grades, leaks, EV |
| `src/features/practice/useHandCoach.ts` | grades a finished hand for the hero |
| `src/features/practice/CoachNote.tsx` | the verdict on the costliest decision |

412 tests passing, up from 396. Typecheck and lint clean. No new dependencies.
Checked on the simulator: *"CORRECT — Folded to 67% of pot holding 28% equity,
needing 40%."*

### Decisions worth knowing about

**The coach adds judgement, not arithmetic.** Every number it needs already
existed: equity against modelled ranges from slice 5, the price from `potOdds`,
outs from `draws`, the stack-to-pot ratio from the table. That is the payoff for
five slices of keeping the engine pure — Pillar C is a grading rubric on top of
work already done, not a new pile of poker maths.

**The unit is chips of expected value given up, converted to big blinds.** A
grade has to mean the same thing at 5/10 as at 50/100, and "what did that cost
you" is the only currency a player can act on. Bands: under 0.25bb correct, 1bb
marginal, 4bb mistake, worse is a blunder. The bottom band is deliberately not
zero — equity is sampled and ranges are estimated, so calling a decision wrong
over a tenth of a blind of modelled EV is false precision dressed as coaching.

**`reviewHand` re-deals from the deck in the hand's own opening event** and
replays the actions through the real engine, so the state handed to each grade is
exactly the one the player faced. This is what `dealHand` was made public for in
slice 1 of Phase 2, and it means a review can never drift from what happened.

**The coach never speaks mid-hand.** A grade shown while the hand is live would
leak the ranges it modelled and tell the player what the table is holding. The
PRD's per-decision "training wheels" mode is a deliberate setting and needs its
own thinking about what it may reveal; the default is per-hand.

### The bug that mattered

**Folding aces preflop graded as "marginal".** The EV model is showdown-only —
it asks what each line is worth if the hand were checked down from here — and by
that measure folding aces on the button costs 0.8bb, because the model assumes no
further betting ever happens. It is internally consistent and it is obviously
wrong as coaching.

The fix is deliberately narrow. Severity, and **only** severity, is weighted by
how much betting is left in the hand (preflop ×4 down to river ×1). The *ranking*
of the lines stays showdown-only, because scaling the EV of calling would bias
every grade towards calling more — and a coach that encourages loose calls is
worse than one that under-rates aces. The weights are coarse, they are named
`STREET_WEIGHT`, and they are the first thing to replace when a real multi-street
EV model exists.

The test now asserts the claim that survives those constants changing — folding
aces is at least a mistake — rather than the exact grade.

### Traps that cost real time

**A stacked-deck test can quietly grade the wrong hand.** Hole cards go
round-robin from the seat left of the button, so a flat list of six cards does
not deal the hand it looks like it deals: the first version gave the hero pocket
sevens while the test name said aces, and the equity assertion was the only thing
that noticed. The helper now takes named hands and builds the deck in deal order,
burn cards included.

**`tsc` catches what `babel-jest` does not.** A bad cast in the test helper ran
happily under Jest and failed the typecheck — worth remembering that a green test
run is not a green build.

### Known gaps

- **No reference test set.** The PRD wants agreement with a solver-informed
  rubric on 100 curated decisions; that set does not exist, so the grades are
  reasoned rather than validated. This is the biggest outstanding item in the
  pillar.
- **No LLM layer.** The reason strings are terse and factual by design; turning
  them into coaching prose is the next slice, and it may never invent a number.
- **No leak tracker.** Decisions are tagged with the PRD's five categories, but
  nothing aggregates them into "your top 3 leaks" yet.
- **Only the costliest decision is shown.** A per-hand list and a session summary
  both need somewhere to live that is not the felt.
- **Bet and raise EV has no fold equity**, so the coach under-values aggression:
  a good bluff reads as marginal rather than correct. Deliberate — it errs
  towards not encouraging bluffs it cannot price.

### Next

The leak tracker and a hand-review surface, then the LLM layer over the top.

---

## 2026-07-29 — Phase 2, slice 5: range modelling and the Shark

The bots stop treating every opponent as a random hand. The Shark narrows each
seat to a range from what they have actually done, and measures its equity
against that — the PRD's third layer.

| File | What |
| --- | --- |
| `src/engine/rangeModel.ts` | `modelOpponents`, `chenScore`, `strengthOf` |
| `src/engine/archetypes.ts` | `SHARK`, and `readsRanges` on the profile |

396 tests passing, up from 384. Typecheck and lint clean. No new dependencies.

### Decisions worth knowing about

**The Shark beats the TAG, measured rather than asserted.** Three of each,
interleaved so neither side owns the button, 2 400 hands: **the Sharks took
4 348 chips off the TAGs, winning five of six seeds.** That single losing seed is
why the test lives in the opt-in long run and not in the fast suite — a
400-hand version of it would pass or fail on which seed it was given, and a test
that depends on that is measuring variance, not the bot.

**The model reads only the public log.** It walks `state.events`, so a bot can
never see a card the table has not shown. Ranges narrow against the board *as it
stood when the action was taken* — a flop raise says something about the flop,
not about the river that arrived two streets later.

**Narrowing is deliberately timid, and that direction is the safe one.** A raise
keeps the top 35%, a call 70%, a check 90%, and nothing narrows below 12 combos.
Narrowing too hard invents a range the opponent never had and then folds correct
calls to it; narrowing too little only costs a little edge.

**What the model does not know is worth stating plainly.** It ranks by strength,
so it captures "they are representing something strong" and nothing else — not
draws, not a line that makes no sense, not a player who checks a monster, and no
memory across hands. Balance and exploitation are the layers above it.

**Preflop strength is the Chen formula.** It is cheap, well known, and only has
to sort 169 starting hands into roughly the right order. The published values are
pinned in the tests — AA 20, AKs 12, 72o −1 — so a change to the implementation
has to admit it. Postflop the ordering comes from the evaluator, where it is
exact.

### Traps that cost real time

**A 100-hand sample said the Shark was losing.** Its first measurement came back
at −104 bb/100 against a mixed table, which looked like the range model was
actively harmful. It was noise: at 2 400 hands the same bot is comfortably ahead.
Do not tune a poker bot against a sample that small — and do not report one
either.

**Four-handed with the button on seat 0, the first seat to act is 3.** Two range
tests asserted against the wrong seat and failed for a reason that had nothing to
do with the code under test.

**`parseCards` wants spaces.** `'AsAh'` is not two cards, it is an error.

### Known gaps

- **No mixed strategies and no CFR tables.** The Shark's bluffs are a frequency,
  not a balanced fraction of its value bets, and the PRD's fourth layer wants
  solved charts shipped with the app.
- **No exploitation layer.** No bot tracks the player across hands, so none of
  them can punish a specific leak — the thing the PRD calls deliberately
  educational.
- **The tier ladder is two rungs.** Hard beats Medium; there is no Easy tier
  defined below them yet, so "each tier beats the one below" is only half tested.
- **Range modelling costs about 15 ms a decision**, which is invisible for one
  bot at a table and the reason a Shark-heavy simulation is several times slower.

### Next

Slice 6: mixed frequencies and balance — pricing bluffs against value bets rather
than rolling for them.

---

## 2026-07-29 — Phase 2, slice 4: the bot archetypes, and the scales to weigh them

The table has real opponents. Four of the PRD's named archetypes play the felt,
and a simulation harness measures them rather than taking their word for it.

| File | What |
| --- | --- |
| `src/engine/archetypes.ts` | `BotProfile`, `makeBot`, and the Rock, Calling Station, Maniac and TAG |
| `src/engine/simulate.ts` | `simulateMatch`: N seeded hands, chips counted in bb/100 |
| `src/engine/bots.ts` | gained `bySeat`, which makes a table of personalities one policy |
| `src/engine/potOdds.ts` | gained `potRaiseTo`, now shared by the bots and the bet sizer |

384 tests passing, up from 364. Typecheck and lint clean. No new dependencies.

### Decisions worth knowing about

**Thresholds are in *even shares* of the pot, not raw equity.** A bot's `entry`
and `raiseAt` are multiples of `1 / (players + 1)`, so 1.0 always means "an
average hand for this table". Raw equity cannot do that job: 30% is a monster
against five opponents and a fold heads-up, so any fixed equity threshold plays
one table size correctly and every other one wrong.

**The archetypes are measured on how they play, not on whether they win.** The
tests assert the ordering the names promise — the Rock enters fewest pots, the
Maniac most, the Station raises almost never — because that is what the archetype
*is*. A personality is a distribution, so it is counted over a seeded run rather
than asserted spot by spot.

**A Maniac beating a table of calling stations is not a bug.** It looks wrong
until you notice always-call is maximally exploitable by aggression: it never
folds, so every value bet gets paid, and it never raises, so nothing punishes the
bluffs. The PRD's criterion is that the baseline *loses* to a Medium bot, and
both the TAG and the Rock take chips off it comfortably.

**The 100k-hand run is opt-in, not part of the suite.** `POKER_LONG_SIM=1`
switches it on. The PRD wants that sample before it believes a bot; the engine
suite has to stay fast enough to leave running while editing, and it already grew
from 3s to 5s absorbing the short version.

**Rebuys stay on during measurement, and chips are counted per hand.** Measuring
a win rate and measuring who survives are different questions; letting a seat
bust out makes a short stack look like a bad bot. The consequence is that the
session total *does* move — a rebuy adds chips on purpose — so conservation is
asserted within a hand, never across the run.

**`potRaiseTo` moved into the engine and the bet sizer now calls it.** The bots
size their bets the same way the player's presets do, which is one implementation
of a piece of poker arithmetic that is easy to get wrong — and the exact numbers
are pinned in the engine's tests, where they do not shift every time a bot's
personality is tuned.

### Traps that cost real time

**Wiring real bots in broke four UI tests, all correctly.** The old tests were
written against a table of calling stations, and encoded that: ten face-down
cards (now the archetypes fold and a folded seat has no cards), a pot of 45 (now
the pot depends on who came along). The fix was to stop asserting arithmetic in
screen tests — that belongs in `potOdds.test.ts` — and assert the wiring instead:
the presets are ordered, and none of them can leave the legal band.

**Folding around is chip-neutral only over a *whole* orbit.** A three-handed test
over 40 hands is 13 orbits and one hand, and that spare hand is the small blind
handing its blind to the big blind. This is the second time this exact fact has
cost time; 39 hands, not 40.

### Known gaps

- **No Shark.** It needs range modelling and the mixed strategies above this
  layer, which is the next slice's work. The PRD's tier ladder cannot be tested
  properly until there is more than one tier.
- **The bots cannot see the players they are facing.** Every opponent is a random
  hand to them — no range narrowing, no history, no exploitation.
- **Their names do not say what they are.** Learning to spot a Calling Station is
  the point, so the labels belong in the table-configuration slice alongside
  choosing the mix.
- **`voluntary` counts actions, not hands**, so it overstates VPIP for a seat that
  calls twice in one hand. Good enough to rank archetypes, not to publish.

### Next

Slice 5: range modelling and the Shark — narrowing each opponent to a range from
their actions, and mixed frequencies on top of it.

---

## 2026-07-29 — Phase 2, slice 3: the hero plays

The table is live. The hero folds, calls, bets and raises for real, against five
seats that call anything. Every hand is dealt, played and booked by the engine.

| File | What |
| --- | --- |
| `src/engine/bots.ts` | `BotPolicy`, the always-call and always-fold baselines, `playUntilSeat` |
| `src/features/practice/usePracticeStore.ts` | the session, the live hand, the hero's decision |
| `src/features/practice/ActionBar.tsx` | fold / check / call / bet / raise, built from `legalActions` |
| `src/features/practice/BetSizer.tsx` | native slider and pot-fraction presets |
| `src/features/practice/HandResult.tsx` | what the hand paid, and the next one |
| `src/features/practice/useHandReplay.ts` | grew a cursor that follows a growing log |

364 tests passing, up from 344. Typecheck and lint clean. No new dependencies —
the slider is `@expo/ui`, which was already installed.

### Decisions worth knowing about

**A played hand and a replayed one are the same data.** The felt renders the
newest frame of the live hand's own event log, so nothing new was needed to show
a hand being played — and when the hand ends, the replay controls from slice 2
step back through it with no extra state. The cursor holds `null` for "track the
end", which is what lets the log grow underneath it without an effect chasing the
length.

**`legalActions` is the only thing that decides what the hero can do.** Buttons
exist because it returned them and are labelled with its numbers; the slider's
band is its `min` and `max`. There is no second opinion about the rules anywhere
in the UI, so no tap can be illegal. The store still checks `isLegalAction`
before applying — not to duplicate the rules, but because a tap can arrive
against a table that has already moved on, and the felt must not crash on it.

**The opponents are the PRD's own always-call baseline, not an invented
placeholder.** It is a bot the archetypes will be measured against in slice 4,
so it is code that stays rather than scaffolding that gets deleted. It is also
honest about what it is: nobody will mistake this for a poker opponent.

**Bots act synchronously, so the table is only ever in two states**: the hero is
on the clock, or the hand is over. There is no "waiting for Ava" state to design
around yet. Play-speed controls, and the pacing that makes bots feel like
players, are their own slice.

**A pot-sized raise is not a bet of the pot.** The raiser calls first, and the
pot they are raising has grown by that call, so the increment is a fraction of
`pot + toCall` on top of the call itself. The first version sized the presets off
the bare pot and offered 45 where the answer was 65. With nothing to call the two
definitions coincide, which is exactly why the bug is easy to miss.

**Bet sizing is keyed to the decision, not stored across it.** Each new decision
opens at the minimum raise rather than inheriting the last one's size — a slider
left at all-in must not become the next street's default. Deriving that from the
event-log length rather than resetting it in an effect keeps the value legal on
every render.

### Traps that cost real time

**`@expo/ui`'s `Host` with `matchContents` collapses a SwiftUI slider to a stub.**
The slider has no width of its own, so sizing the host to its content gives a
40pt blob in the corner. Drop `matchContents` and give the host a height.

**A JSX comment is an expression, not a statement.** Putting `{/* … */}` inside
`{condition && ( … )}` is a syntax error, and the app keeps happily running the
last good bundle — so the screenshot looks identical and the change appears to
have done nothing. Check the Metro log before believing a screenshot.

**A test loop that sends `call` forever never terminates**, because `call` is not
offered when checking is free and the store correctly ignores it. Take the action
from `legalActions` rather than assuming one, and bound the loop.

### Known gaps

- **No coaching yet.** Every decision is recorded in the log the coach will read,
  but nothing grades it. That is Phase 3.
- **No bot pacing or play-speed control**, so the table jumps from the hero's
  action straight to their next one.
- **The table is not configurable** — six seats, 5/10, 1 000 chips, rebuys on.
- **The hero cannot leave a hand mid-way** or sit out.

### Next

Slice 4: the bot archetypes the PRD names, and the simulation harness that
measures them against these baselines.

---

## 2026-07-28 — Phase 2, slice 2: the table on screen, read-only

The engine's output is now visible. A hand renders on the felt and can be stepped
through action by action or street by street. No betting controls, no bots — the
hand is a fixed demo script played through the real engine.

| File | What |
| --- | --- |
| `src/engine/replay.ts` | `HandEvent[]` → one `TableSnapshot` per event |
| `src/components/ui/ChipStack.tsx` | a wagered amount on the felt |
| `src/components/ui/PlayingCard.tsx` | gained a face-down state and a `small` size |
| `src/features/practice/PokerTable.tsx` | the felt, the geometry, the board and the pot |
| `src/features/practice/TableSeat.tsx` | one player: cards, name plate, dealer button |
| `src/features/practice/ReplayControls.tsx` | transport controls |
| `src/features/practice/useHandReplay.ts` | the cursor into the log |
| `src/features/practice/demoHand.ts` | the scripted hand, played through the engine |
| `app/(calculator)/`, `app/table/` | the app gets native tabs |

344 tests passing, up from 322. Typecheck and lint clean. No new dependencies.
Exercised on the iOS 26.2 simulator in light and dark mode, stepping the demo
hand through every street.

### Decisions worth knowing about

**The UI never renders a `HandState`.** It renders a `TableSnapshot`, one per
event in the log, and "live" is simply the last frame. Stepping backwards,
reviewing a hand from history and watching one play out are then the same code
path, and the UI reads a flat already-resolved shape instead of asking the engine
questions mid-render.

**`replay.ts` is bookkeeping, not rules, and that is the whole point.** Legality,
betting closure, who shows and who wins were all settled when the hand was
played. All the reducer does is move chips between a stack, the bet in front of a
seat, and the middle. Re-running the engine from the recorded deck would have
been the other option, but `applyAction` deals a whole street transition in one
call — the flop would arrive on the same frame as the last preflop call, and
street-by-street replay is a PRD requirement.

**The replay is checked against the engine, not against itself.** 400 seeded
hands are played by a random legal-action chooser, replayed, and the final
snapshot stacks must equal the engine's final stacks, with chips conserved on
every intermediate frame. Anything the reducer drops or double-counts shows up
there — the missing ante did, immediately.

**`describeEvent` took an optional namer rather than growing a twin.** The engine
does not know display names, so it numbers seats; callers that know them pass a
function and get `Ava raises to 30`. One line of commentary, one implementation.

**Seats are always in the tree, and only visible once measured.** Their positions
come from `onLayout` rather than fixed points, so two-handed and nine-handed
tables lay out from the same rule. Gating the render on the measurement instead
would have kept the seats out of the accessibility tree until the second frame —
and out of the test tree entirely, since `onLayout` never fires under Jest.

**The hero is pinned to the bottom** and seats run up the right-hand side from
there, so the table always reads from the player's own chair whatever seat they
are in.

**The table screen has an inline title, not a large one.** A large title only
earns its space when it can collapse into a scroll; the felt does not scroll.

### Traps that cost real time

**Everything the simulator caught, the test suite had passed.** Three real bugs
survived 36 green component tests, because none of them are about behaviour:

1. **The floating tab bar in iOS 26 sits on top of a fixed screen.** The replay
   controls were underneath it and unreachable. A `ScrollView` gets the inset
   from the system via `contentInsetAdjustmentBehavior`, which is why the
   calculator never showed it; a fixed screen has to ask `useSafeAreaInsets`.
   `Screen` now applies the bottom inset in its non-scrolling branch, so the next
   fixed screen gets it for free.
2. **Hole cards rendered outside the felt**, and the top seat's were clipped off
   the screen entirely. Seats were centred on the felt's edge to "straddle the
   rail", which works for a name plate and not for a plate with two cards above
   it. The seat ellipse is now inset by half a seat plus the rail.
3. **Folded seats kept their cards**, dimmed. A folded player has no cards.

**Adding `useSafeAreaInsets` to `Screen` broke every screen test at once** —
without a provider the hook throws rather than returning zeros. The library ships
`react-native-safe-area-context/jest/mock` for this; one `jest.mock` in
`jest.setup.ts` beats wrapping every test in a provider.

**`⏮` and the other media glyphs render as colour emoji**, not as text in the
label colour. `↺` and the angle quotes do not.

**The iOS build fails in `node_modules`, not in our code.** `expo-modules-jsi`
57.0.4 has `abs(milliseconds) <= maxJavaScriptDateMilliseconds`, which Xcode
26.2's Swift rejects as ambiguous. `.magnitude` compiles. There is no newer
published version; it wants an upstream issue or a `patch-package` entry, and
until then a fresh `npm install` re-breaks the local build.

**RNTL 14's `renderHook` is async like its `render`.** Without awaiting it,
`result` is undefined and every assertion fails on `.current` rather than on
anything to do with the hook.

**`expo run:ios` rewrites the `ios` and `android` npm scripts** to `expo run:*`
on its first run. Harmless, but it lands in the diff of whatever branch happened
to be checked out.

**`StyleSheet.absoluteFillObject` does not exist in this typing** — it is
`absoluteFill`, or spell the inset out.

### Known gaps

- **No animation.** Cards appear and chips jump. Reanimated and Skia arrive with
  the slice that needs them, per the dependency rule.
- **The demo hand is a fixture.** Real hands arrive with the betting controls and
  the bots.
- **A face-down card is a flat colour with a hairline inset**, not artwork. It is
  honest and legible; it is not decorative.
- **No landscape layout.** The ellipse maths handles it, the type scale does not.
- **No real-device pass**, and none for the calculator either — still simulator
  only. Haptics and scroll feel are exactly what a simulator misrepresents.
- **The tab bar was only reachable by tapping**, which the simulator could not be
  driven to do from here; the table screen was verified by temporarily pointing
  the index route at it. The tab bar itself, both icons and both labels, is in
  the screenshots.

### Next

Slice 3: betting controls — `legalActions` driving a bet slider and action
buttons, hero acting for real. Then the bot archetypes.

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
