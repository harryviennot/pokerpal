/**
 * The pump: what happens next, and when.
 *
 * The engine can play a whole orbit in the time it takes to hand it one decision,
 * and the store this replaces did exactly that — `playUntilSeat` ran every bot
 * between two frames, so the table answered the hero before the screen had drawn
 * their own chips going in. Nothing about the rules was wrong and the game felt
 * like arithmetic.
 *
 * So the loop is gone. In its place is one function that looks at the table, does
 * exactly one thing, `set`s it, and schedules itself for whenever that thing
 * should be over: one event revealed per timer, one bot decision per timer, one
 * graded decision per tick. Every delay comes from `pacing.ts` and every timer
 * from `gameScheduler.ts`, so the feel of the game lives in two pure modules and
 * this one only decides the order.
 */

import {
  advanceToLevel,
  applyAction,
  costliestDecision,
  finishHand,
  isSessionOver,
  legalActions,
  startNextHand,
  type Action,
  type BotPolicy,
  type BotProfile,
  type HandEvent,
  type Rng,
  type SeatIndex,
  type SessionState,
} from '@/engine';
import { type HandArchiver } from '@/services/handHistory';

import { type GameScheduler } from './gameScheduler';
import { createHandGrader, type HandGrader } from './grading';
import { heroNetOf, seatsOf, toArchived } from './handRecord';
import {
  DECISION_CLOCK_MS,
  LEVEL_LENGTH_MS,
  nextHandDelayFor,
  PRESELECT_BEAT_MS,
  revealDelayFor,
  thinkDelayFor,
} from './pacing';
import { resolvePreselect } from './preselect';
import { type ActiveGame } from './types';

/**
 * What the pump needs and no screen does.
 *
 * Kept out of `ActiveGame` because none of it renders: replacing an `Rng` in
 * state on every bot decision would wake every selector in the app to tell them
 * a generator advanced.
 */
export interface Runtime {
  archiver: HandArchiver;
  opponents: BotPolicy;
  /** One per seat, the hero's included as null, so `profiles[seat]` is never a hole. */
  profiles: readonly (BotProfile | null)[];
  botRng: Rng;
  paceRng: Rng;
  /** Non-null once the finished hand has started being graded. */
  grader: HandGrader | null;
  /** True once the finished hand has been archived and booked. Guards the pump. */
  booked: boolean;
}

export interface PumpDeps {
  scheduler: GameScheduler;
  /** The live game, or null between sessions. Read fresh on every step. */
  game: () => ActiveGame | null;
  runtime: () => Runtime | null;
  patch: (change: Partial<ActiveGame>) => void;
  /**
   * The hero's action, played through the store rather than applied here: going
   * through `act` is what cancels the decision clock and rejects an illegal tap.
   */
  act: (action: Action) => void;
}

/** The fewest players the engine will deal a hand to. */
const MIN_PLAYERS = 2;

/** Events that are the table filling up rather than the hand being played. */
const DEALING_EVENTS: ReadonlySet<HandEvent['type']> = new Set<HandEvent['type']>([
  'handStart',
  'blindPosted',
  'holeCardsDealt',
]);

export function createGamePump({ scheduler, game, runtime, patch, act }: PumpDeps): () => void {
  /**
   * One step of the game, then a timer for the next one.
   *
   * The order is the whole design. Showing what has already happened comes before
   * making anything else happen, so the screen is never behind the rules; a
   * finished hand is settled before anyone is asked to act, so a grade can never
   * arrive mid-hand; and the hero's turn is checked before the bots', so an armed
   * preselect plays at the moment the action reaches them.
   */
  const pump = (): void => {
    const live = game();
    const active = runtime();

    if (!live || !active) {
      return;
    }

    // 1. The engine has run ahead of the screen. Show one more event.
    if (live.shown < live.hand.events.length) {
      const event = live.hand.events[live.shown];

      if (!event) {
        return;
      }

      patch({
        shown: live.shown + 1,
        phase: DEALING_EVENTS.has(event.type) ? 'dealing' : 'revealing',
        decisionDeadline: null,
      });
      scheduler.schedule(revealDelayFor(event), pump);

      return;
    }

    // 2. Nothing left to show and nothing left to decide.
    if (live.hand.complete) {
      settleHand(live, active);

      return;
    }

    // A hand that is neither complete nor waiting on a seat cannot happen —
    // `applyAction` either finds the next seat or finishes the hand — but
    // stopping here beats reading `null` as seat zero.
    if (live.hand.toAct === null) {
      return;
    }

    if (live.hand.toAct === live.heroSeat) {
      offerHeroTheClock(live);

      return;
    }

    // 3. A bot is on the clock. Exactly one decision, after a think.
    const seat = live.hand.toAct;

    patch({ phase: 'botThinking', decisionDeadline: null });
    scheduler.schedule(
      thinkDelayFor(active.profiles[seat] ?? null, live.hand, seat, active.paceRng),
      playOneBotAction,
    );
  };

  /**
   * Grades the finished hand a decision at a time, then books it and lines up
   * the next one.
   *
   * Chunked because grading is a 1 500-sample Monte Carlo per decision, which in
   * one call is long enough to freeze the table exactly as the pot is pushed.
   * `booked` is what makes the last step happen once: the pump is reached from
   * several places and a hand must not be archived twice.
   */
  const settleHand = (live: ActiveGame, active: Runtime): void => {
    const over = { phase: 'handOver', preselect: null, decisionDeadline: null } as const;

    active.grader ??= createHandGrader(live.hand, live.handSeats, live.heroSeat);

    if (active.grader.step()) {
      patch({ ...over, reviews: active.grader.reviews() });
      scheduler.schedule(0, pump);

      return;
    }

    if (active.booked) {
      return;
    }

    active.booked = true;

    const reviews = active.grader.reviews();
    const net = heroNetOf(live.hand, live.handSeats, live.heroSeat);

    // Archived the moment it is graded: a player who reads the result and kills
    // the app must not lose the hand they just played.
    active.archiver.recordHand(toArchived(live.hand, live.handSeats, live.heroSeat, reviews));

    patch({
      ...over,
      reviews,
      coachHistory: [...live.coachHistory, { handNumber: live.hand.handNumber, net, reviews }],
      // Real mode is told nothing until the session is over: a verdict between
      // hands is a read on the table, and not having one is the mode's premise.
      advice:
        live.mode === 'learning'
          ? {
              handNumber: live.hand.handNumber,
              net,
              total: reviews.length,
              review: costliestDecision(reviews),
            }
          : null,
    });
    scheduler.schedule(nextHandDelayFor(live.hand.events), dealNext);
  };

  /** Hands the hero the clock, or plays what they armed before it got to them. */
  const offerHeroTheClock = (live: ActiveGame): void => {
    const armed = live.preselect === null ? null : resolvePreselect(live.preselect, live.hand);

    if (armed) {
      patch({ phase: 'heroTurn', decisionDeadline: null });
      // A beat, so the player watches the action reach them rather than finding
      // their own decision already made.
      scheduler.schedule(PRESELECT_BEAT_MS, () => {
        patch({ preselect: null });
        act(armed);
      });

      return;
    }

    // An armed action the table has invalidated is dropped, not translated: see
    // `preselect.ts` for why a `check` must never become a fold.
    patch({
      preselect: null,
      phase: 'heroTurn',
      decisionDeadline: live.mode === 'real' ? scheduler.now() + DECISION_CLOCK_MS : null,
    });

    if (live.mode === 'real') {
      scheduler.schedule(DECISION_CLOCK_MS, timeUp);
    }
  };

  /** The clock ran out: take the free check, or fold. Never bet for the player. */
  const timeUp = (): void => {
    const live = game();

    if (!live || live.hand.complete || live.hand.toAct !== live.heroSeat) {
      return;
    }

    const free = legalActions(live.hand).some((action) => action.type === 'check');

    act(free ? { type: 'check' } : { type: 'fold' });
  };

  /**
   * One bot decision, then straight back to the pump.
   *
   * Deliberately not a loop. A loop here is what made the old store resolve five
   * seats between two frames.
   */
  const playOneBotAction = (): void => {
    const live = game();
    const active = runtime();
    const seat = live?.hand.toAct ?? null;

    if (!live || !active || live.hand.complete || seat === null || seat === live.heroSeat) {
      return;
    }

    const legal = legalActions(live.hand);

    if (legal.length === 0) {
      return;
    }

    patch({ hand: applyAction(live.hand, active.opponents(live.hand, legal, active.botRng)) });
    pump();
  };

  /** Books the finished hand into the session and deals the next one, or ends. */
  const dealNext = (): void => {
    const live = game();
    const active = runtime();

    if (!live || !active || !live.hand.complete) {
      return;
    }

    const booked = finishHand(live.session, live.hand);
    // The wall clock is read here and nowhere else. Blinds that went up mid-hand
    // would change the price of a bet already made, which is not poker; between
    // hands is exactly where a cardroom raises them too.
    const leveled =
      live.mode === 'real'
        ? advanceToLevel(booked, Math.floor((scheduler.now() - live.startedAt) / LEVEL_LENGTH_MS))
        : booked;

    // Asked before dealing, because `startNextHand` throws rather than returning
    // null when the session is over or too few players can be dealt in.
    if (!canDealAnother(leveled, live.heroSeat)) {
      endSession(live, leveled);

      return;
    }

    const dealt = startNextHand(leveled);

    active.grader = null;
    active.booked = false;

    patch({
      session: dealt.session,
      hand: dealt.hand,
      handSeats: seatsOf(dealt.session),
      phase: 'dealing',
      shown: 0,
      preselect: null,
      reviews: [],
      advice: null,
      runoutEquity: null,
      decisionDeadline: null,
    });
    pump();
  };

  /**
   * The session is over. Captures what the summary needs, and stops.
   *
   * No navigation from here: the store says the session ended and the screen
   * decides what that looks like. `sessionEnd` going non-null is the signal.
   */
  const endSession = (live: ActiveGame, session: SessionState): void => {
    patch({
      session,
      phase: 'sessionOver',
      preselect: null,
      decisionDeadline: null,
      sessionEnd: {
        hands: session.handsPlayed,
        net: sessionNetOf(session, live.heroSeat),
        startedAt: live.startedAt,
        endedAt: scheduler.now(),
        busted: !canSit(session, live.heroSeat),
      },
    });
  };

  return pump;
}

/** Whether a seat will be dealt in again: chips behind, or a rebuy waiting. */
function canSit(session: SessionState, seat: SeatIndex): boolean {
  const player = session.seats[seat];

  return player !== undefined && player.seated && (player.stack > 0 || session.rebuyTo !== null);
}

/**
 * Whether there is another hand worth dealing.
 *
 * The hero being unable to sit ends it even when the bots could play on: a table
 * that keeps dealing to five bots after the player busts is a screensaver.
 */
function canDealAnother(session: SessionState, heroSeat: SeatIndex): boolean {
  if (isSessionOver(session) || !canSit(session, heroSeat)) {
    return false;
  }

  return session.seats.filter((_, seat) => canSit(session, seat)).length >= MIN_PLAYERS;
}

/**
 * The hero's chips won or lost across the session.
 *
 * Summed from the per-hand results rather than measured against the starting
 * stack, so a rebuy reads as what it is: chips bought, not chips won.
 */
function sessionNetOf(session: SessionState, seat: SeatIndex): number {
  return session.history.reduce((sum, record) => sum + (record.results[seat] ?? 0), 0);
}
