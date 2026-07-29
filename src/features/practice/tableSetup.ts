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
 * `rebuyTo` is dropped for a sit-and-go whatever the toggle says: buying back
 * in is what makes it not a sit-and-go, and a config that contradicts itself
 * should not reach the engine.
 */
export function toSessionConfig(setup: TableSetup, seed: number): SessionConfig {
  const stack = Math.max(1, Math.round(setup.startingStack));
  const rebuys = setup.style === 'cash' && setup.rebuys;

  return {
    seats: seatsFor(setup).map((seat) => ({ id: seat.id, stack })),
    style: setup.style,
    levels: [setup.blinds],
    seed,
    ...(rebuys ? { rebuyTo: stack } : {}),
  };
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
