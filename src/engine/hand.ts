/**
 * The single-hand state machine.
 *
 * `startHand` deals, `applyAction` advances. Every function here is a pure
 * transform: the state that goes in is never mutated, so a hand history is just
 * the array of states it passed through and stepping backwards costs nothing.
 *
 * The engine drives everything that is not a player decision. Once a betting
 * round closes it collects the street, deals the next one, and — when nobody
 * can act again because the players are all in — runs the board out to
 * showdown by itself. Callers only ever supply decisions.
 *
 * Cards and chips going onto the table live in `deal.ts`; the betting rules
 * live in `betting.ts`. This module is the loop that joins them.
 */

import { applyBettingAction, nextToAct } from './betting';
import { type Card } from './cards';
import { bigBlindSeat, dealStreet, openHand } from './deal';
import { createDeck, shuffle } from './deck';
import { type HandEvent } from './events';
import { buildPots, findUncalledBet, toContribution } from './pots';
import { type Rng } from './rng';
import { resolveShowdown } from './showdown';
import {
  contestingPlayers,
  InvalidTableError,
  nextSeat,
  type Action,
  type HandState,
  type Player,
  type SeatIndex,
  type TableConfig,
} from './table';

/** Shuffles a fresh deck and deals a hand. Deterministic for a given `Rng`. */
export function startHand(config: TableConfig, rng: Rng): HandState {
  return dealHand(config, shuffle(createDeck(), rng));
}

/**
 * Deals a hand from a known deck.
 *
 * Public because replay and hand review need it: the shuffled deck is recorded
 * in the opening event, so re-dealing from it reproduces a hand exactly without
 * reconstructing an RNG, and study spots can ask "what if the turn had been the
 * ace" by handing in a deck of their own.
 *
 * @throws {InvalidTableError} when the table cannot play a hand.
 */
export function dealHand(config: TableConfig, deck: readonly Card[]): HandState {
  const opened = openHand(config, deck);
  const firstToAct = nextToAct(opened.players, bigBlindSeat(opened), opened.currentBet);

  // Nobody can act — the blinds put everyone all in — so the board runs out.
  return firstToAct === null ? closeStreet(opened) : { ...opened, toAct: firstToAct };
}

/**
 * Applies one player decision and runs the hand forward until it needs another
 * one — dealing streets and running the board out on its own where no decision
 * is left to make.
 *
 * @throws {IllegalActionError} when the action is not in `legalActions(state)`.
 * @throws {InvalidTableError} when the hand is not waiting for an action.
 */
export function applyAction(state: HandState, action: Action): HandState {
  if (state.complete || state.toAct === null) {
    throw new InvalidTableError('The hand is not waiting for an action.');
  }

  const seat = state.toAct;
  const result = applyBettingAction(state, action);
  const next: HandState = {
    ...state,
    players: result.players,
    currentBet: result.currentBet,
    minRaiseTo: result.minRaiseTo,
    lastRaiseSize: result.lastRaiseSize,
    events: [
      ...state.events,
      { type: 'actionTaken', seat, action: result.logged, allIn: result.allIn },
    ],
    toAct: null,
  };

  // Everyone but one player folded: the hand is over wherever it stands.
  if (contestingPlayers(next).length <= 1) {
    return finish(next);
  }

  const toAct = nextToAct(next.players, seat, next.currentBet);

  return toAct === null ? closeStreet(next) : { ...next, toAct };
}

/**
 * Ends a betting round: returns any unmatched bet, then either opens the next
 * street or, when no decisions are left, runs the board out to showdown.
 */
function closeStreet(state: HandState): HandState {
  const settled = returnUncalled(state);

  if (settled.street === 'river') {
    return finish(settled);
  }

  // At most one player can still put chips in, so there is nothing left to bet
  // into: deal the rest of the board in one go rather than asking for actions
  // nobody can take.
  const runOut =
    settled.players.filter((player) => player.status === 'active' && player.stack > 0).length <= 1;

  let next = dealStreet(settled);

  while (runOut && next.street !== 'river') {
    next = dealStreet(next);
  }

  if (runOut) {
    return finish(next);
  }

  return {
    ...next,
    toAct: nextSeat(next.players, next.button, (p) => p.status === 'active' && p.stack > 0),
  };
}

/** Hands back the part of a bet nobody could match, before any pot is built. */
function returnUncalled(state: HandState): HandState {
  const uncalled = findUncalledBet(state.players.map(toContribution));

  if (!uncalled) {
    return state;
  }

  const players = state.players.map((player) =>
    player.seat === uncalled.seat
      ? {
          ...player,
          stack: player.stack + uncalled.amount,
          committedThisStreet: Math.max(0, player.committedThisStreet - uncalled.amount),
          committedTotal: player.committedTotal - uncalled.amount,
          // Getting chips back can take a player out of an all-in.
          status: player.status === 'allIn' ? ('active' as const) : player.status,
        }
      : player,
  );

  return {
    ...state,
    players,
    events: [
      ...state.events,
      { type: 'uncalledBetReturned', seat: uncalled.seat, amount: uncalled.amount },
    ],
  };
}

/** Builds the final pots, awards them, and closes the log. */
function finish(state: HandState): HandState {
  const settled = returnUncalled(state);
  const pots = buildPots(settled.players.map(toContribution));
  const contesting = contestingPlayers(settled);
  const events: HandEvent[] = [...settled.events];
  let players = settled.players;

  if (contesting.length === 1) {
    // Everyone folded. No cards are shown: the winner gives nothing away.
    const winner = contesting[0] as Player;
    const amount = pots.reduce((sum, pot) => sum + pot.amount, 0);

    players = award(players, [{ seat: winner.seat, amount }]);
    events.push({ type: 'potAwarded', seat: winner.seat, amount, potIndex: 0, oddChip: false });
  } else {
    const { entries, awards } = resolveShowdown(
      players,
      pots,
      settled.board,
      settled.button,
      firstToShow(settled),
    );

    for (const entry of entries) {
      events.push(
        entry.mucked
          ? { type: 'handMucked', seat: entry.seat }
          : { type: 'showdownHand', seat: entry.seat, cards: entry.cards, rank: entry.rank },
      );
    }

    players = award(players, awards);

    for (const won of awards) {
      events.push({ type: 'potAwarded', ...won });
    }
  }

  events.push({ type: 'handEnd', street: settled.street });

  return { ...settled, players, pots, events, toAct: null, complete: true };
}

/**
 * Who shows first: the last player to bet or raise on the final street, or —
 * when that street was checked through — the first seat left of the button.
 */
function firstToShow(state: HandState): SeatIndex {
  for (let i = state.events.length - 1; i >= 0; i--) {
    const event = state.events[i];

    if (event?.type === 'streetDealt') {
      break;
    }

    if (
      event?.type === 'actionTaken' &&
      (event.action.type === 'bet' || event.action.type === 'raise')
    ) {
      return event.seat;
    }
  }

  const first = nextSeat(
    state.players,
    state.button,
    (player) => player.status === 'active' || player.status === 'allIn',
  );

  return first ?? state.button;
}

function award(
  players: readonly Player[],
  awards: readonly { seat: SeatIndex; amount: number }[],
): Player[] {
  const won = new Map<SeatIndex, number>();

  for (const a of awards) {
    won.set(a.seat, (won.get(a.seat) ?? 0) + a.amount);
  }

  return players.map((player) => ({
    ...player,
    stack: player.stack + (won.get(player.seat) ?? 0),
  }));
}
