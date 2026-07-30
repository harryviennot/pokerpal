/**
 * The table the player chose, and the session config it becomes.
 *
 * The engine has always been able to seat two to nine players at any stakes in
 * either style; this module is the small vocabulary the setup screen uses to
 * say which, and the one place that turns it into a `SessionConfig`. Pure, so
 * every combination is checked without rendering anything.
 */

import {
  CALLING_STATION,
  MANIAC,
  ROCK,
  SHARK,
  TAG,
  type BlindLevel,
  type BotProfile,
  type SessionConfig,
  type TableStyle,
} from '@/engine';

import { type GameMode } from './types';

/** The bots the player can fill a table with. `mixed` is one of each, in turn. */
export type TableMixId = 'mixed' | 'rock' | 'callingStation' | 'maniac' | 'tag' | 'shark';

export interface TableMix {
  id: TableMixId;
  label: string;
  /** What playing against this table teaches, in one line. */
  describe: string;
}

/**
 * A table of one archetype is a drill: stations to practise value betting
 * against, rocks to steal from, maniacs to trap. Mixed is the game.
 */
export const MIXES: readonly TableMix[] = [
  { id: 'mixed', label: 'Mixed table', describe: 'One of each. The closest thing to a real game.' },
  { id: 'tag', label: 'Tight-aggressive', describe: 'Solid fundamentals. The hardest fair game.' },
  { id: 'shark', label: 'Sharks', describe: 'They read what you have been representing.' },
  {
    id: 'callingStation',
    label: 'Calling stations',
    describe: 'They pay you off. Practise betting your good hands.',
  },
  { id: 'rock', label: 'Rocks', describe: 'They fold too much. Practise stealing.' },
  { id: 'maniac', label: 'Maniacs', describe: 'Relentless. Practise letting them bluff at you.' },
];

const PROFILES: Record<Exclude<TableMixId, 'mixed'>, BotProfile> = {
  rock: ROCK,
  callingStation: CALLING_STATION,
  maniac: MANIAC,
  tag: TAG,
  shark: SHARK,
};

/** The rotation a mixed table deals out, so seat one is never the same type twice. */
const ROTATION: readonly BotProfile[] = [TAG, CALLING_STATION, ROCK, MANIAC, SHARK];

/** Enough names for a full table. The hero is always seat zero. */
const NAMES = ['Ava', 'Ben', 'Cleo', 'Dev', 'Elle', 'Finn', 'Gus', 'Hana'] as const;

export const HERO_NAME = 'You';

/** The engine seats two to nine, so one to eight opponents. */
export const MIN_OPPONENTS = 1;
export const MAX_OPPONENTS = 8;

export const STACK_OPTIONS = [500, 1_000, 2_500, 10_000] as const;

export const STAKE_OPTIONS: readonly BlindLevel[] = [
  { smallBlind: 1, bigBlind: 2 },
  { smallBlind: 5, bigBlind: 10 },
  { smallBlind: 25, bigBlind: 50 },
  { smallBlind: 50, bigBlind: 100, ante: 10 },
];

export interface TableSetup {
  opponents: number;
  mix: TableMixId;
  startingStack: number;
  blinds: BlindLevel;
  style: TableStyle;
  /** Cash only: buy a busted seat back in rather than letting it go dark. */
  rebuys: boolean;
}

/**
 * Six-handed, 5/10, mixed, rebuys on.
 *
 * A cash game that never ends is the right default for practice: the player
 * leaves when they want to, not when they bust.
 */
export const DEFAULT_SETUP: TableSetup = {
  opponents: 5,
  mix: 'mixed',
  startingStack: 1_000,
  blinds: { smallBlind: 5, bigBlind: 10 },
  style: 'cash',
  rebuys: true,
};

/** The lobby's choice, plus the mode it chose. What starts a game. */
export type GameSetup = TableSetup & { mode: GameMode };

/**
 * Learning by default: being coached is the point of the app, and a first
 * session with a wall clock and no way back is not where to start.
 */
export const DEFAULT_GAME_SETUP: GameSetup = { ...DEFAULT_SETUP, mode: 'learning' };

export interface TableSeatSetup {
  id: string;
  /** Null for the hero, who is nobody's bot. */
  profile: BotProfile | null;
}

/** Who sits where, hero first. Opponent count is clamped to what a table seats. */
export function seatsFor(setup: TableSetup): readonly TableSeatSetup[] {
  const count = clamp(Math.round(setup.opponents), MIN_OPPONENTS, MAX_OPPONENTS);

  return [
    { id: HERO_NAME, profile: null },
    ...Array.from({ length: count }, (_, index) => ({
      id: NAMES[index] ?? `Bot ${index + 1}`,
      profile: profileFor(setup.mix, index),
    })),
  ];
}

/**
 * The session the engine will run.
 *
 * The two modes are two different games above the same rules. Learning stays at
 * one blind level and honours the rebuy toggle, because a session you can be
 * coached through has to be one you cannot lose by accident. Real gets the whole
 * ladder and no rebuys whatever the toggle says: rising blinds with a stack you
 * cannot top up is the pressure the mode exists to apply.
 *
 * `rebuyTo` is also dropped for a sit-and-go, because buying back in is what
 * makes it not a sit-and-go, and a config that contradicts itself should not
 * reach the engine.
 */
export function toSessionConfig(setup: GameSetup, seed: number): SessionConfig {
  const stack = Math.max(1, Math.round(setup.startingStack));
  const real = setup.mode === 'real';
  const rebuys = !real && setup.style === 'cash' && setup.rebuys;

  return {
    seats: seatsFor(setup).map((seat) => ({ id: seat.id, stack })),
    style: setup.style,
    levels: real ? blindLadder(setup.blinds) : [setup.blinds],
    seed,
    ...(rebuys ? { rebuyTo: stack } : {}),
  };
}

/**
 * Multipliers on the chosen small blind, ~4/3 then ~3/2 in turn.
 *
 * That alternation doubles the stakes every two levels, which is the pattern a
 * live tournament clock uses: 15/30, 20/40, 30/60, 40/80, 60/120. Twelve steps
 * is a long evening; `advanceToLevel` clamps at the top rather than running out.
 */
const LADDER_STEPS: readonly number[] = [
  1,
  4 / 3,
  2,
  8 / 3,
  4,
  16 / 3,
  8,
  32 / 3,
  16,
  64 / 3,
  32,
  128 / 3,
];

/** Blinds a player would recognise, as multiples of a power of ten. */
const NICE_BLINDS: readonly number[] = [1, 1.5, 2, 3, 4, 5, 6, 8, 10];

/**
 * An escalating ladder from `base`, for a session with a clock on it.
 *
 * Every step is rounded to a figure a cardroom would print — nobody plays
 * 13/26 — which at low stakes means two steps can round together; those are
 * dropped rather than nudged, so the ladder is always strictly increasing and
 * sometimes shorter than twelve levels. The big blind and any ante keep their
 * ratio to the small blind, so a 1:2 table stays 1:2 all the way up.
 */
export function blindLadder(base: BlindLevel): readonly BlindLevel[] {
  const small = Math.max(1, Math.round(base.smallBlind));
  // Ratios rather than absolutes, so a 1:2 table stays 1:2 and an ante that was
  // a tenth of the small blind still is at the top of the ladder.
  const bigRatio = base.smallBlind > 0 ? base.bigBlind / base.smallBlind : 2;
  const anteRatio = base.ante && base.smallBlind > 0 ? base.ante / base.smallBlind : 0;
  const ladder: BlindLevel[] = [];

  for (const [index, step] of LADDER_STEPS.entries()) {
    // The first level is the table the player chose, untouched: rounding the
    // stake they picked would start the session at blinds they did not ask for.
    const smallBlind = index === 0 ? small : roundToNiceBlind(small * step);
    const previous = ladder[ladder.length - 1];

    if (previous && smallBlind <= previous.smallBlind) {
      continue;
    }

    const ante = anteRatio > 0 ? Math.max(1, Math.round(smallBlind * anteRatio)) : 0;

    ladder.push({
      smallBlind,
      bigBlind: Math.max(smallBlind + 1, Math.round(smallBlind * bigRatio)),
      ...(ante > 0 ? { ante } : {}),
    });
  }

  return ladder;
}

/** The nearest recognisable blind to `value`, never below one chip. */
function roundToNiceBlind(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(value, 1)));
  const scaled = value / magnitude;
  const nearest = NICE_BLINDS.reduce((best, candidate) =>
    Math.abs(candidate - scaled) < Math.abs(best - scaled) ? candidate : best,
  );

  return Math.max(1, Math.round(nearest * magnitude));
}

/** The label the setup screen puts on a stake, e.g. `5 / 10 (10 ante)`. */
export function describeBlinds(blinds: BlindLevel): string {
  const stakes = `${blinds.smallBlind} / ${blinds.bigBlind}`;

  return blinds.ante ? `${stakes} (${blinds.ante} ante)` : stakes;
}

function profileFor(mix: TableMixId, index: number): BotProfile {
  if (mix !== 'mixed') {
    return PROFILES[mix];
  }

  return ROTATION[index % ROTATION.length] ?? TAG;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
