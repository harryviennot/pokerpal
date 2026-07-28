/**
 * Putting cards and chips on the table.
 *
 * Everything up to the first decision of a hand — validating the table, posting
 * antes and blinds, dealing hole cards — plus opening each later street. None
 * of it needs to know how betting works, which is why it sits below `hand.ts`
 * rather than inside it.
 */

import { type Card } from './cards';
import { type HandEvent, type Street } from './events';
import {
  InvalidTableError,
  nextSeat,
  type HandState,
  type Player,
  type SeatIndex,
  type TableConfig,
} from './table';

const MIN_SEATS = 2;
const MAX_SEATS = 9;

/** Cards dealt when each street is opened. */
const STREET_CARDS: Partial<Record<Street, number>> = { flop: 3, turn: 1, river: 1 };

/**
 * Builds the opening state of a hand: blinds posted, cards dealt, preflop
 * betting primed.
 *
 * `toAct` is left null — who acts first is a betting question, so `hand.ts`
 * fills it in and handles the case where nobody can act at all.
 *
 * @throws {InvalidTableError} when the table cannot play a hand.
 */
export function openHand(config: TableConfig, deck: readonly Card[]): HandState {
  validate(config);

  const { smallBlind, bigBlind } = config.blinds;
  const events: HandEvent[] = [
    {
      type: 'handStart',
      handNumber: config.handNumber ?? 1,
      seed: config.seed ?? 0,
      button: config.button,
      deck,
    },
  ];

  let players: Player[] = config.seats.map((seat, index) => ({
    seat: index,
    id: seat.id,
    stack: seat.stack,
    holeCards: null,
    status: seat.stack > 0 ? 'active' : 'sittingOut',
    committedThisStreet: 0,
    committedTotal: 0,
    hasActedThisStreet: false,
    mayRaiseThisStreet: true,
  }));

  players = postAntes(players, config.blinds.ante ?? 0, events);

  const { small, big } = blindSeats(players, config.button);

  players = postBlind(players, small, smallBlind, 'smallBlind', events);
  players = postBlind(players, big, bigBlind, 'bigBlind', events);

  const { players: dealt, deck: remaining } = dealHoleCards(players, config.button, deck, events);

  return {
    handNumber: config.handNumber ?? 1,
    seed: config.seed ?? 0,
    button: config.button,
    blinds: config.blinds,
    players: dealt,
    street: 'preflop',
    board: [],
    deck: remaining,
    toAct: null,
    // The big blind is a live bet, so preflop opens with it as the price and as
    // the increment a raise has to clear.
    currentBet: bigBlind,
    minRaiseTo: bigBlind * 2,
    lastRaiseSize: bigBlind,
    pots: [],
    events,
    complete: false,
  };
}

/** The seat that posted the big blind — where preflop action starts counting from. */
export function bigBlindSeat(state: HandState): SeatIndex {
  return blindSeats(state.players, state.button).big;
}

/** Burns a card, opens the next street and resets the street's betting state. */
export function dealStreet(state: HandState): HandState {
  const street = nextStreet(state.street);
  const count = STREET_CARDS[street] ?? 0;
  const deck = [...state.deck];
  const burned = deck.shift() as Card;
  const cards = deck.splice(0, count);

  return {
    ...state,
    street,
    board: [...state.board, ...cards],
    deck,
    currentBet: 0,
    // Postflop the big blind is the smallest legal opening bet.
    minRaiseTo: state.blinds.bigBlind,
    lastRaiseSize: state.blinds.bigBlind,
    players: state.players.map((player) => ({
      ...player,
      committedThisStreet: 0,
      hasActedThisStreet: false,
      mayRaiseThisStreet: true,
    })),
    events: [...state.events, { type: 'streetDealt', street, cards, burned }],
    toAct: null,
  };
}

export function nextStreet(street: Street): Street {
  switch (street) {
    case 'preflop':
      return 'flop';
    case 'flop':
      return 'turn';
    case 'turn':
      return 'river';
    default:
      return 'showdown';
  }
}

/**
 * A seat that was dealt into this hand. Not the same as `active`: an ante can
 * put a player all in before a card comes out, and they are still in the hand.
 */
function isDealtIn(player: Player): boolean {
  return player.status !== 'sittingOut';
}

function validate(config: TableConfig): void {
  const seatCount = config.seats.length;

  if (seatCount < MIN_SEATS || seatCount > MAX_SEATS) {
    throw new InvalidTableError(`A table seats ${MIN_SEATS} to ${MAX_SEATS}, got ${seatCount}.`);
  }

  if (config.button < 0 || config.button >= seatCount) {
    throw new InvalidTableError(`Button seat ${config.button} is not at the table.`);
  }

  const { smallBlind, bigBlind } = config.blinds;

  if (!Number.isInteger(smallBlind) || !Number.isInteger(bigBlind) || smallBlind > bigBlind) {
    throw new InvalidTableError(`Blinds ${smallBlind}/${bigBlind} are not a valid integer pair.`);
  }

  const dealtIn = config.seats.filter((seat) => seat.stack > 0).length;

  if (dealtIn < MIN_SEATS) {
    throw new InvalidTableError(`Only ${dealtIn} seat(s) have chips; a hand needs ${MIN_SEATS}.`);
  }
}

function postAntes(players: readonly Player[], ante: number, events: HandEvent[]): Player[] {
  if (ante <= 0) {
    return [...players];
  }

  return players.map((player) => {
    if (player.status !== 'active') {
      return player;
    }

    const amount = Math.min(ante, player.stack);
    const posted = commit(player, amount);

    events.push({
      type: 'blindPosted',
      seat: player.seat,
      kind: 'ante',
      amount,
      allIn: posted.stack === 0,
    });

    // Antes are dead money: they belong to the pot, not to this street's
    // betting, so they must not count towards what anyone owes.
    return { ...posted, committedThisStreet: 0 };
  });
}

function commit(player: Player, amount: number): Player {
  const paid = Math.min(amount, player.stack);
  const stack = player.stack - paid;

  return {
    ...player,
    stack,
    committedThisStreet: player.committedThisStreet + paid,
    committedTotal: player.committedTotal + paid,
    status: stack === 0 ? 'allIn' : player.status,
  };
}

function postBlind(
  players: readonly Player[],
  seat: SeatIndex,
  amount: number,
  kind: 'smallBlind' | 'bigBlind',
  events: HandEvent[],
): Player[] {
  return players.map((player) => {
    if (player.seat !== seat) {
      return player;
    }

    const posted = commit(player, amount);

    events.push({
      type: 'blindPosted',
      seat,
      kind,
      amount: posted.committedThisStreet - player.committedThisStreet,
      allIn: posted.stack === 0,
    });

    // A blind is posted, not acted: the big blind still gets an option to raise
    // when the pot comes back unraised.
    return posted;
  });
}

/**
 * Which seats post the blinds.
 *
 * Heads-up inverts the usual order: the button posts the small blind, acts
 * first preflop and last on every later street.
 */
function blindSeats(
  players: readonly Player[],
  button: SeatIndex,
): { small: SeatIndex; big: SeatIndex } {
  const dealtIn = players.filter(isDealtIn);

  if (dealtIn.length === 2) {
    return { small: button, big: nextSeat(players, button, isDealtIn) as SeatIndex };
  }

  const small = nextSeat(players, button, isDealtIn) as SeatIndex;

  return { small, big: nextSeat(players, small, isDealtIn) as SeatIndex };
}

/** Two rounds, one card at a time, starting left of the button — as a dealer does. */
function dealHoleCards(
  players: readonly Player[],
  button: SeatIndex,
  deck: readonly Card[],
  events: HandEvent[],
): { players: Player[]; deck: Card[] } {
  const remaining = [...deck];
  const order = dealOrder(players, button);
  const hole = new Map<SeatIndex, Card[]>(order.map((seat) => [seat, []]));

  for (let round = 0; round < 2; round++) {
    for (const seat of order) {
      hole.get(seat)?.push(remaining.shift() as Card);
    }
  }

  const dealt = players.map((player) => {
    const cards = hole.get(player.seat);

    if (!cards || cards.length !== 2) {
      return player;
    }

    const pair = [cards[0] as Card, cards[1] as Card] as const;

    events.push({ type: 'holeCardsDealt', seat: player.seat, cards: pair });

    return { ...player, holeCards: pair };
  });

  return { players: dealt, deck: remaining };
}

/** Dealt-in seats clockwise from the first seat left of the button. */
function dealOrder(players: readonly Player[], button: SeatIndex): SeatIndex[] {
  const order: SeatIndex[] = [];
  let seat = button;

  for (let i = 0; i < players.length; i++) {
    const next = nextSeat(players, seat, isDealtIn);

    if (next === null || (order.length > 0 && next === order[0])) {
      break;
    }

    order.push(next);
    seat = next;
  }

  return order;
}
