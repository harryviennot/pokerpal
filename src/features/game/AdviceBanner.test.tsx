import { act, cleanup, render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { createRng, reviewHand, type DecisionReview } from '@/engine';
import { playHand, HERO_SEAT, SEATS } from '@/fixtures/playedHand';

import { AdviceBanner } from './AdviceBanner';
import { type AdviceNotice } from './types';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const BIG_BLIND = 10;

/**
 * A real verdict from the coach on a real hand, not a hand-written one: the copy
 * on this banner is the engine's own `reason`, and a fixture that made one up
 * would let the wording drift away from what the math actually said.
 */
const REVIEWS: readonly DecisionReview[] = gradedHand();

function gradedHand(): readonly DecisionReview[] {
  const played = playHand();

  return reviewHand(
    { seats: [...SEATS], button: 0, blinds: { smallBlind: 5, bigBlind: BIG_BLIND } },
    played.events,
    HERO_SEAT,
    { rng: createRng(1), iterations: 200 },
  );
}

/** The costliest verdict, which is the one the notice carries. */
function worst(): DecisionReview {
  return REVIEWS.reduce((best, review) => (review.evLoss > best.evLoss ? review : best));
}

function notice(overrides: Partial<AdviceNotice> = {}): AdviceNotice {
  return { handNumber: 1, net: -120, total: REVIEWS.length, review: worst(), ...overrides };
}

const setupUser = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(async () => {
  await cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('AdviceBanner', () => {
  it('says nothing at all when there is no advice', async () => {
    await render(<AdviceBanner advice={null} bigBlind={BIG_BLIND} onDismiss={jest.fn()} />);

    expect(screen.queryByLabelText(/^(Correct|Marginal|Mistake|Blunder)\./)).not.toBeOnTheScreen();
  });

  it('arrives with the grade and the coach reasoning', async () => {
    await render(<AdviceBanner advice={notice()} bigBlind={BIG_BLIND} onDismiss={jest.fn()} />);

    const review = worst();

    expect(screen.getByText(review.reason)).toBeOnTheScreen();
    expect(screen.getByLabelText(new RegExp(`^${review.grade}`, 'i'))).toBeOnTheScreen();
  });

  it('quotes what the decision cost in big blinds', async () => {
    const review = worst();

    await render(<AdviceBanner advice={notice()} bigBlind={BIG_BLIND} onDismiss={jest.fn()} />);

    // Big blinds rather than chips, so a grade means the same at every level.
    expect(review.evLoss).toBeGreaterThan(BIG_BLIND / 2);
    expect(
      screen.getByText(new RegExp(`−${(review.evLoss / BIG_BLIND).toFixed(1)} bb`)),
    ).toBeOnTheScreen();
  });

  it('takes itself away after a few seconds, without being asked', async () => {
    const onDismiss = jest.fn();

    await render(<AdviceBanner advice={notice()} bigBlind={BIG_BLIND} onDismiss={onDismiss} />);

    expect(onDismiss).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(6_000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('can be dismissed by hand before it goes', async () => {
    const user = setupUser();
    const onDismiss = jest.fn();

    await render(<AdviceBanner advice={notice()} bigBlind={BIG_BLIND} onDismiss={onDismiss} />);
    await user.press(screen.getByLabelText('Dismiss the coach'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('opens the review when the body is tapped', async () => {
    const user = setupUser();

    await render(<AdviceBanner advice={notice()} bigBlind={BIG_BLIND} onDismiss={jest.fn()} />);
    await user.press(screen.getByLabelText(new RegExp(`^${worst().grade}`, 'i')));

    expect(router.push).toHaveBeenCalledWith('/game/review');
  });

  it('stays quiet about a hand the coach could not grade', async () => {
    await render(
      <AdviceBanner advice={notice({ review: null })} bigBlind={BIG_BLIND} onDismiss={jest.fn()} />,
    );

    expect(screen.queryByLabelText('Dismiss the coach')).not.toBeOnTheScreen();
  });
});
