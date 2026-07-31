import { parseCard, parseCards } from '@/engine';
import { emptyFrames, frameOf, steadyFrames, type DetectionScript } from '@/services/vision';

import { DEFAULT_FUSION } from './fusion';
import { liveUsedCards, useLivePlayStore } from './useLivePlayStore';

const HERO: readonly [ReturnType<typeof parseCard>, ReturnType<typeof parseCard>] = [
  parseCard('Ah'),
  parseCard('Kh'),
];
const FLOP = parseCards('Qc 7d 2s');
const TURN = parseCard('9s');

function ingest(script: DetectionScript): void {
  const { ingestFrame } = useLivePlayStore.getState();

  for (const frame of script) {
    ingestFrame(frame);
  }
}

/** Into a watching hand with hero cards set — the everyday starting point. */
function startWatching(): void {
  const store = useLivePlayStore.getState();

  store.setHeroCards(HERO);
  store.beginWatching();
}

beforeEach(() => {
  useLivePlayStore.getState().reset();
});

describe('useLivePlayStore', () => {
  it('ignores frames until the user begins watching', () => {
    ingest(steadyFrames(FLOP, DEFAULT_FUSION.lockHits));

    expect(useLivePlayStore.getState().fusion.board).toHaveLength(0);
  });

  it('will not begin watching without hero cards', () => {
    useLivePlayStore.getState().beginWatching();

    expect(useLivePlayStore.getState().phase).toBe('setup');
  });

  it('locks a steady flop into the board', () => {
    startWatching();
    ingest(steadyFrames(FLOP, DEFAULT_FUSION.lockHits));

    expect(useLivePlayStore.getState().fusion.board).toEqual(FLOP);
  });

  it('never auditions the hero cards', () => {
    startWatching();
    ingest(steadyFrames(HERO, DEFAULT_FUSION.lockHits * 2));

    expect(useLivePlayStore.getState().fusion.board).toHaveLength(0);
    expect(useLivePlayStore.getState().fusion.candidates).toHaveLength(0);
  });

  it('clears the pot entry when the street advances', () => {
    startWatching();
    ingest(steadyFrames(FLOP, DEFAULT_FUSION.lockHits));
    useLivePlayStore.getState().setPotEntry({ pot: 10, toCall: 4 });

    ingest(steadyFrames([...FLOP, TURN], DEFAULT_FUSION.lockHits));

    const state = useLivePlayStore.getState();

    expect(state.fusion.board).toEqual([...FLOP, TURN]);
    expect(state.potEntry).toBeNull();
  });

  it('locks a tapped candidate immediately and kills a rejected one', () => {
    startWatching();
    ingest(steadyFrames(FLOP, DEFAULT_FUSION.lockHits));
    ingest(steadyFrames([...FLOP, TURN], 2));

    useLivePlayStore.getState().confirmCandidate(TURN);

    expect(useLivePlayStore.getState().fusion.board).toEqual([...FLOP, TURN]);

    const river = parseCard('3d');

    ingest(steadyFrames([...FLOP, TURN, river], 2));
    useLivePlayStore.getState().rejectCandidate(river);
    ingest(steadyFrames([...FLOP, TURN, river], DEFAULT_FUSION.lockHits * 2));

    const state = useLivePlayStore.getState();

    expect(state.fusion.board).toEqual([...FLOP, TURN]);
    expect(state.fusion.candidates).toHaveLength(0);
  });

  it('corrects a locked card and keeps the camera from restoring it', () => {
    startWatching();
    ingest(steadyFrames(FLOP, DEFAULT_FUSION.lockHits));

    const corrected = parseCard('Qh');

    useLivePlayStore.getState().correctBoardCard(0, corrected);

    expect(useLivePlayStore.getState().fusion.board).toEqual([corrected, FLOP[1], FLOP[2]]);

    // The misread Q♣ keeps being "seen"; it must not come back.
    ingest(steadyFrames(FLOP, DEFAULT_FUSION.lockHits * 2));

    expect(useLivePlayStore.getState().fusion.board).toEqual([corrected, FLOP[1], FLOP[2]]);
    expect(useLivePlayStore.getState().fusion.candidates).toHaveLength(0);
  });

  it('refuses a correction to a card already on the board', () => {
    startWatching();
    ingest(steadyFrames(FLOP, DEFAULT_FUSION.lockHits));

    useLivePlayStore.getState().correctBoardCard(0, FLOP[1]!);

    expect(useLivePlayStore.getState().fusion.board).toEqual(FLOP);
  });

  it('raises the hand boundary after the felt goes empty past a flop', () => {
    startWatching();
    ingest(steadyFrames(FLOP, DEFAULT_FUSION.lockHits));
    ingest(emptyFrames(DEFAULT_FUSION.handEndFrames));

    expect(useLivePlayStore.getState().handEnded).toBe(true);

    // Frames after the boundary change nothing until the next hand starts.
    ingest(steadyFrames([TURN], DEFAULT_FUSION.lockHits));

    expect(useLivePlayStore.getState().fusion.board).toEqual(FLOP);
  });

  it('starts the next hand clean and counts the one that ended', () => {
    startWatching();
    ingest(steadyFrames(FLOP, DEFAULT_FUSION.lockHits));
    useLivePlayStore.getState().setPotEntry({ pot: 10, toCall: 4 });
    ingest(emptyFrames(DEFAULT_FUSION.handEndFrames));

    useLivePlayStore.getState().startNextHand();

    const state = useLivePlayStore.getState();

    expect(state.fusion.board).toHaveLength(0);
    expect(state.heroCards).toBeNull();
    expect(state.potEntry).toBeNull();
    expect(state.rejected).toHaveLength(0);
    expect(state.handEnded).toBe(false);
    expect(state.phase).toBe('setup');
    expect(state.handsObserved).toBe(1);
  });

  it('keeps board and candidate references stable across idle frames', () => {
    startWatching();
    ingest(steadyFrames(FLOP, DEFAULT_FUSION.lockHits));

    const before = useLivePlayStore.getState().fusion;

    ingest(emptyFrames(3));

    const after = useLivePlayStore.getState().fusion;

    expect(after.board).toBe(before.board);
    expect(after.candidates).toBe(before.candidates);
  });
});

describe('liveUsedCards', () => {
  it('lists hero cards and the locked board', () => {
    startWatching();
    ingest(steadyFrames(FLOP, DEFAULT_FUSION.lockHits));

    expect(liveUsedCards(useLivePlayStore.getState())).toEqual([...HERO, ...FLOP]);
  });
});
