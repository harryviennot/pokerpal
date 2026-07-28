/**
 * Betting-round rules: what a seat may do, what it costs, and when the round
 * is over.
 *
 * `legalActions` is the single source of truth. The table UI builds its buttons
 * and bet slider from it, bots choose from it, and `applyBettingAction`
 * validates against it — one rule set, three consumers, no drift.
 *
 * The rule most engines get wrong is the incomplete raise: an all-in that
 * raises by less than the last full raise increment. It raises the amount owed
 * but does not reopen the betting to players who have already acted; they may
 * only call or fold. Players still waiting to act keep full raising rights.
 */

import { type LoggedAction } from './events';
import {
  amountToCall,
  IllegalActionError,
  nextSeat,
  playerAt,
  type Action,
  type HandState,
  type LegalAction,
  type Player,
  type SeatIndex,
} from './table';

/** Everything the seat to act may legally do, with amounts already resolved. */
export function legalActions(state: HandState): LegalAction[] {
  if (state.complete || state.toAct === null) {
    return [];
  }

  const seat = state.toAct;
  const player = playerAt(state, seat);

  if (player.status !== 'active' || player.stack === 0) {
    return [];
  }

  const owed = state.currentBet - player.committedThisStreet;
  const maxTo = player.committedThisStreet + player.stack;
  const actions: LegalAction[] = [];

  if (owed > 0) {
    // Folding is only ever legal when there is something to fold to; folding a
    // free option is a fold-out-of-turn mistake the engine should not offer.
    actions.push({ type: 'fold' });
    actions.push({ type: 'call', amount: Math.min(owed, player.stack) });
  } else {
    actions.push({ type: 'check' });
  }

  // A raise must beat the current bet, and a player who cannot cover the
  // minimum may still shove for less than a full raise.
  if (player.mayRaiseThisStreet && maxTo > state.currentBet) {
    const type = state.currentBet === 0 ? 'bet' : 'raise';

    actions.push({ type, min: Math.min(state.minRaiseTo, maxTo), max: maxTo });
  }

  return actions;
}

/** True when `action` is one of `legalActions(state)`, amounts included. */
export function isLegalAction(state: HandState, action: Action): boolean {
  return legalActions(state).some((legal) => {
    if (legal.type !== action.type) {
      return false;
    }

    return legal.type === 'bet' || legal.type === 'raise'
      ? (action as { to: number }).to >= legal.min && (action as { to: number }).to <= legal.max
      : true;
  });
}

export interface BettingResult {
  players: Player[];
  currentBet: number;
  minRaiseTo: number;
  lastRaiseSize: number;
  logged: LoggedAction;
  allIn: boolean;
}

/**
 * Applies one action's effect on stacks, commitments and the raise bookkeeping.
 *
 * Returns the pieces rather than a whole `HandState` so `hand.ts` stays the
 * only module that decides what happens next — whose turn it is, whether the
 * street is over, whether the hand ended.
 *
 * @throws {IllegalActionError} when the action is not currently legal.
 */
export function applyBettingAction(state: HandState, action: Action): BettingResult {
  if (state.toAct === null) {
    throw new IllegalActionError('No seat is to act.');
  }

  const seat = state.toAct;

  if (!isLegalAction(state, action)) {
    throw new IllegalActionError(
      `${describe(action)} is not legal for seat ${seat} facing a bet of ${state.currentBet}.`,
    );
  }

  switch (action.type) {
    case 'fold':
      return settle(state, seat, 0, { type: 'fold' }, false);

    case 'check':
      return settle(state, seat, 0, { type: 'check' }, false);

    case 'call': {
      const amount = amountToCall(state, seat);

      return settle(state, seat, amount, { type: 'call', amount }, false);
    }

    case 'bet':
    case 'raise': {
      const player = playerAt(state, seat);
      const amount = action.to - player.committedThisStreet;
      const increment = action.to - state.currentBet;
      // An all-in that does not cover a full raise raises the amount owed but
      // does not reopen the betting.
      const full = increment >= state.lastRaiseSize;
      const logged: LoggedAction =
        action.type === 'bet'
          ? { type: 'bet', to: action.to, amount }
          : { type: 'raise', to: action.to, amount };

      return settle(state, seat, amount, logged, full);
    }
  }
}

/**
 * Moves `amount` from the seat's stack into the pot and updates who still owes
 * an action.
 *
 * `fullRaise` decides the interesting part: a full raise reopens the betting
 * for everyone, an incomplete all-in raise only forces the others to answer
 * the new price.
 */
function settle(
  state: HandState,
  seat: SeatIndex,
  amount: number,
  logged: LoggedAction,
  fullRaise: boolean,
): BettingResult {
  const actor = playerAt(state, seat);
  const committedThisStreet = actor.committedThisStreet + amount;
  const stack = actor.stack - amount;
  const raised = committedThisStreet > state.currentBet;
  const currentBet = Math.max(state.currentBet, committedThisStreet);
  const increment = committedThisStreet - state.currentBet;

  const updated: Player = {
    ...actor,
    stack,
    committedThisStreet,
    committedTotal: actor.committedTotal + amount,
    status: logged.type === 'fold' ? 'folded' : stack === 0 ? 'allIn' : actor.status,
    hasActedThisStreet: true,
    mayRaiseThisStreet: actor.mayRaiseThisStreet,
  };

  const players = state.players.map((player) => {
    if (player.seat === seat) {
      return updated;
    }

    if (!raised || player.status !== 'active') {
      return player;
    }

    return {
      ...player,
      // Everyone owes an answer to a new price, whether or not it was a full raise.
      hasActedThisStreet: false,
      // ...but only a full raise gives back the right to re-raise.
      mayRaiseThisStreet: fullRaise
        ? true
        : !player.hasActedThisStreet && player.mayRaiseThisStreet,
    };
  });

  // The floor for the next raise is always the current price plus the last
  // *full* raise increment. An incomplete all-in lifts the price without
  // lifting that increment, so the next full raise still has to clear the
  // original one.
  const lastRaiseSize = raised && fullRaise ? increment : state.lastRaiseSize;

  return {
    players,
    currentBet,
    lastRaiseSize,
    minRaiseTo: currentBet + lastRaiseSize,
    logged,
    allIn: stack === 0 && logged.type !== 'fold',
  };
}

/**
 * True when nobody can act again on this street.
 *
 * Closes when every player who can still act has acted since the last raise
 * and has matched the current bet. The big blind's preflop option falls out of
 * this for free: the blind was posted, not acted, so an unraised pot cannot
 * close until the big blind has had a say.
 */
export function isBettingRoundClosed(players: readonly Player[], currentBet: number): boolean {
  const canAct = players.filter((player) => player.status === 'active' && player.stack > 0);

  if (canAct.length === 0) {
    return true;
  }

  // One player left with chips and everyone else all in or folded: there is
  // nothing left to bet into unless they still owe a call.
  const contesting = players.filter(
    (player) => player.status === 'active' || player.status === 'allIn',
  );

  if (contesting.length <= 1) {
    return true;
  }

  return canAct.every(
    (player) => player.hasActedThisStreet && player.committedThisStreet === currentBet,
  );
}

/** The next seat that still has a decision to make, or null when the round is closed. */
export function nextToAct(
  players: readonly Player[],
  from: SeatIndex,
  currentBet: number,
): SeatIndex | null {
  if (isBettingRoundClosed(players, currentBet)) {
    return null;
  }

  return nextSeat(
    players,
    from,
    (player) =>
      player.status === 'active' &&
      player.stack > 0 &&
      (!player.hasActedThisStreet || player.committedThisStreet < currentBet),
  );
}

function describe(action: Action): string {
  return action.type === 'bet' || action.type === 'raise'
    ? `${action.type} to ${action.to}`
    : action.type;
}
