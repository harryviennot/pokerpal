import { cleanup, render, screen } from '@testing-library/react-native';

import { type DecisionFacts, type DecisionReview } from '@/engine';

import { SessionReviewScreen } from './SessionReviewScreen';
import { usePracticeStore, type HandCoachRecord } from './usePracticeStore';

const read = () => usePracticeStore.getState();

const FACTS: DecisionFacts = {
  street: 'flop',
  playersBehind: 0,
  pot: 100,
  toCall: 25,
  stack: 900,
  spr: 9,
  equity: 0.18,
  requiredEquity: 0.2,
  outs: 0,
};

function review(overrides: Partial<DecisionReview> = {}): DecisionReview {
  return {
    seat: 0,
    action: { type: 'call' },
    best: { type: 'fold' },
    grade: 'correct',
    evLoss: 0,
    reason: 'Folded to 25% of pot holding 18% equity, needing 20%.',
    leak: null,
    facts: FACTS,
    ...overrides,
  };
}

/** Puts finished hands on the books without playing them, so copy is exact. */
function seedHistory(records: HandCoachRecord[]): void {
  usePracticeStore.setState({ coachHistory: records });
}

beforeEach(() => {
  read().reset();
});

afterEach(async () => {
  await cleanup();
});

describe('SessionReviewScreen', () => {
  it('shows the empty state before any hand has finished', async () => {
    await render(<SessionReviewScreen />);

    expect(screen.getByText('Nothing to review yet')).toBeOnTheScreen();
    expect(screen.queryByText('SESSION')).not.toBeOnTheScreen();
  });

  it('sums the session from the hands on the books', async () => {
    seedHistory([
      { handNumber: 1, net: 120, reviews: [review()] },
      { handNumber: 2, net: -45, reviews: [review(), review()] },
    ]);

    await render(<SessionReviewScreen />);

    expect(screen.getByText('Hands played')).toBeOnTheScreen();
    expect(screen.getByText('2')).toBeOnTheScreen();
    expect(screen.getByText('+75')).toBeOnTheScreen();
    expect(screen.getByText('+120')).toBeOnTheScreen();
    expect(screen.getByText('-45')).toBeOnTheScreen();
    expect(screen.getByText('3')).toBeOnTheScreen();
  });

  it('names the top leaks, costliest first, with a focus point', async () => {
    seedHistory([
      {
        handNumber: 1,
        net: -60,
        reviews: [
          review({ grade: 'mistake', evLoss: 30, leak: 'chasingWithoutOdds' }),
          review({ grade: 'blunder', evLoss: 80, leak: 'overBluffing' }),
        ],
      },
    ]);

    await render(<SessionReviewScreen />);

    expect(screen.getByText('Over-bluffing ×1')).toBeOnTheScreen();
    expect(screen.getByText('Chasing without the odds ×1')).toBeOnTheScreen();
    expect(screen.getByText(/Focus: Bluff less/)).toBeOnTheScreen();
  });

  it('says so when nothing leaked', async () => {
    seedHistory([{ handNumber: 1, net: 10, reviews: [review()] }]);

    await render(<SessionReviewScreen />);

    expect(screen.getByText(/No leaks so far/)).toBeOnTheScreen();
    expect(screen.queryByText(/^Focus:/)).not.toBeOnTheScreen();
  });

  it('lists every graded decision of the last hand with its verdict', async () => {
    seedHistory([
      {
        handNumber: 3,
        net: -20,
        reviews: [
          review(),
          review({
            grade: 'mistake',
            evLoss: 30,
            leak: 'chasingWithoutOdds',
            reason: 'Called 40% of pot with 18% equity and no draw, needing 29%.',
          }),
        ],
      },
    ]);

    await render(<SessionReviewScreen />);

    expect(screen.getByText('HAND #3')).toBeOnTheScreen();
    // Each also appears under Highlights, so more than one showing is right.
    expect(screen.getAllByText(/Folded to 25% of pot/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Called 40% of pot/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('MISTAKE').length).toBeGreaterThan(0);
  });

  it('reviews a hand actually played at the table', async () => {
    // The hero folds the button; the store grades that decision for real.
    read().act({ type: 'fold' });

    await render(<SessionReviewScreen />);

    expect(read().reviews.length).toBeGreaterThan(0);
    expect(screen.getByText('HAND #1')).toBeOnTheScreen();
    expect(screen.getAllByText(/equity/).length).toBeGreaterThan(0);
  });
});
