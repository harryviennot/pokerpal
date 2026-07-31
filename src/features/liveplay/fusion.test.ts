import { parseCard, type Card } from '@/engine';
import {
  emptyFrames,
  flicker,
  frameOf,
  slotBox,
  steadyFrames,
  type DetectionScript,
} from '@/services/vision';

import {
  DEFAULT_FUSION,
  emptyFusion,
  fuseFrame,
  type FusionState,
  type FuseOptions,
} from './fusion';

const KC = parseCard('Kc');
const SEVEN_H = parseCard('7h');
const SEVEN_D = parseCard('7d');
const TWO_D = parseCard('2d');
const NINE_S = parseCard('9s');
const AS = parseCard('As');
const AH = parseCard('Ah');

function play(state: FusionState, script: DetectionScript, options?: FuseOptions): FusionState {
  return script.reduce((folded, frame) => fuseFrame(folded, frame, options), state);
}

/** A state with a flop already locked, the everyday mid-hand starting point. */
function flopLocked(): FusionState {
  return { ...emptyFusion(), board: [KC, SEVEN_H, TWO_D] };
}

describe('fuseFrame', () => {
  describe('candidate confirmation', () => {
    it('locks a turn card after six steady sightings, not before', () => {
      const early = play(flopLocked(), steadyFrames([NINE_S], DEFAULT_FUSION.lockHits - 1));

      expect(early.board).toHaveLength(3);
      expect(early.candidates[0]?.hits).toBe(DEFAULT_FUSION.lockHits - 1);

      const locked = fuseFrame(early, frameOf([NINE_S]));

      expect(locked.board).toEqual([KC, SEVEN_H, TWO_D, NINE_S]);
      expect(locked.candidates).toHaveLength(0);
    });

    it('locks through glare flicker: seen four, gone two, seen three', () => {
      const state = play(flopLocked(), flicker([NINE_S], 4, 2, 1));
      const after = play(state, steadyFrames([NINE_S], 3));

      expect(after.board).toContain(NINE_S);
    });

    it('drops a candidate written off after eight misses', () => {
      const glimpsed = play(flopLocked(), steadyFrames([NINE_S], 2));
      const gone = play(glimpsed, emptyFrames(DEFAULT_FUSION.dropMisses));

      expect(gone.candidates).toHaveLength(0);
      expect(gone.board).toHaveLength(3);
    });

    it('lets a one-frame misread evaporate while the real card locks', () => {
      // The 7♦ flashes once amid a steady 7♥ — the classic suit misread.
      const script: DetectionScript = [
        frameOf([SEVEN_H]),
        frameOf([SEVEN_H, { card: SEVEN_D, bbox: slotBox(0) }]),
        ...steadyFrames([SEVEN_H], DEFAULT_FUSION.lockHits),
      ];

      const state = play({ ...emptyFusion(), board: [KC, AS, TWO_D] }, script);

      expect(state.board).toContain(SEVEN_H);
      expect(state.board).not.toContain(SEVEN_D);
      expect(state.candidates.map((c) => c.card)).not.toContain(SEVEN_H);
    });

    it('gates out low-confidence detections entirely', () => {
      const state = play(flopLocked(), steadyFrames([{ card: NINE_S, confidence: 0.4 }], 10));

      expect(state.candidates).toHaveLength(0);
      expect(state.board).toHaveLength(3);
    });
  });

  describe('identity rules', () => {
    it('keeps one candidate for a card detected twice in one frame', () => {
      const doubled = frameOf([NINE_S, { card: NINE_S, bbox: slotBox(3) }]);
      const state = fuseFrame(flopLocked(), doubled);

      expect(state.candidates).toHaveLength(1);
      expect(state.candidates[0]?.hits).toBe(1);
    });

    it('never auditions a card that is already locked', () => {
      const state = play(flopLocked(), steadyFrames([KC], 10));

      expect(state.candidates).toHaveLength(0);
      expect(state.board).toEqual([KC, SEVEN_H, TWO_D]);
    });

    it('never auditions the hero cards passed as dead', () => {
      const state = play(flopLocked(), steadyFrames([AS, AH], 10), { dead: [AS, AH] });

      expect(state.candidates).toHaveLength(0);
    });

    it('drops an existing candidate the moment its card becomes dead', () => {
      const auditioning = play(flopLocked(), steadyFrames([NINE_S], 2));
      const state = fuseFrame(auditioning, frameOf([]), { dead: [NINE_S] });

      expect(state.candidates).toHaveLength(0);
    });
  });

  describe('board shape', () => {
    it('commits the flop as three cards together, ordered left to right', () => {
      // Listed in a scrambled order every frame; the boxes say Kc, 7h, 2d.
      const scrambled = steadyFrames(
        [
          { card: TWO_D, bbox: slotBox(2) },
          { card: KC, bbox: slotBox(0) },
          { card: SEVEN_H, bbox: slotBox(1) },
        ],
        DEFAULT_FUSION.lockHits,
      );

      const state = play(emptyFusion(), scrambled);

      expect(state.board).toEqual([KC, SEVEN_H, TWO_D]);
    });

    it('shows no board at all while only two flop cards are confirmed', () => {
      const state = play(emptyFusion(), steadyFrames([KC, SEVEN_H], DEFAULT_FUSION.lockHits + 4));

      expect(state.board).toHaveLength(0);
      expect(state.candidates).toHaveLength(2);
    });

    it('locks turn and river one at a time, never two at once', () => {
      const together = play(flopLocked(), steadyFrames([NINE_S, AS], DEFAULT_FUSION.lockHits));

      // Both are eligible; only the stronger sighting takes the turn.
      expect(together.board).toHaveLength(4);

      const river = play(together, steadyFrames([NINE_S, AS], DEFAULT_FUSION.lockHits));

      expect(river.board).toHaveLength(5);
    });

    it('never considers a sixth card', () => {
      const full: FusionState = { ...emptyFusion(), board: [KC, SEVEN_H, TWO_D, NINE_S, AS] };
      const state = play(full, steadyFrames([AH], 20));

      expect(state.board).toHaveLength(5);
      expect(state.candidates).toHaveLength(0);
    });

    it('keeps a locked card locked through anything the camera says', () => {
      const state = play(flopLocked(), emptyFrames(DEFAULT_FUSION.handEndFrames - 1));

      expect(state.board).toEqual([KC, SEVEN_H, TWO_D]);
      expect(state.handEnded).toBe(false);
    });
  });

  describe('hand boundary', () => {
    it('ends the hand after two seconds of empty felt past the flop', () => {
      const state = play(flopLocked(), emptyFrames(DEFAULT_FUSION.handEndFrames));

      expect(state.handEnded).toBe(true);
      expect(state.board).toEqual([KC, SEVEN_H, TWO_D]);
    });

    it('does not end a hand that never saw a flop', () => {
      const state = play(emptyFusion(), emptyFrames(DEFAULT_FUSION.handEndFrames * 2));

      expect(state.handEnded).toBe(false);
    });

    it('resets the empty streak when any card is sighted, locked ones included', () => {
      const nearly = play(flopLocked(), emptyFrames(DEFAULT_FUSION.handEndFrames - 1));
      const interrupted = fuseFrame(nearly, frameOf([KC]));

      expect(interrupted.emptyStreak).toBe(0);
      expect(play(interrupted, emptyFrames(DEFAULT_FUSION.handEndFrames - 1)).handEnded).toBe(
        false,
      );
    });
  });

  describe('determinism', () => {
    it('folds the same script to the same state every time', () => {
      const script: DetectionScript = [
        ...steadyFrames([KC, SEVEN_H, TWO_D], DEFAULT_FUSION.lockHits),
        ...flicker([NINE_S], 4, 2, 2),
        ...emptyFrames(DEFAULT_FUSION.handEndFrames),
      ];

      const once = play(emptyFusion(), script);
      const twice = play(emptyFusion(), script);

      expect(twice).toEqual(once);
    });
  });
});

describe('emptyFusion', () => {
  it('starts with nothing locked and no boundary proposed', () => {
    expect(emptyFusion()).toEqual({
      board: [] as Card[],
      candidates: [],
      emptyStreak: 0,
      handEnded: false,
    });
  });
});
