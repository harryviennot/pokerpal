import { cleanup, render, screen } from '@testing-library/react-native';

import { type StoredSessionStat } from '@/services/handHistory';

import { MistakeTrend } from './MistakeTrend';

const HOUR = 3_600_000;

/** `count` sessions at a fixed rate per hundred decisions, oldest first. */
function sessions(count: number, ratePerHundred: number, from = 0): StoredSessionStat[] {
  return Array.from({ length: count }, (_, index) => ({
    sessionId: from + index + 1,
    startedAt: (from + index + 1) * HOUR,
    hands: 20,
    net: 0,
    decisionsGraded: 100,
    mistakes: ratePerHundred,
    evLost: ratePerHundred * 3,
  }));
}

afterEach(async () => {
  await cleanup();
});

describe('MistakeTrend', () => {
  it('reports the rate and calls a fall an improvement', async () => {
    await render(<MistakeTrend sessions={[...sessions(3, 40), ...sessions(3, 10, 3)]} />);

    expect(screen.getByText('Per hundred decisions')).toBeOnTheScreen();
    expect(screen.getByText('25.0')).toBeOnTheScreen();
    expect(screen.getByText(/Keep going/)).toBeOnTheScreen();
  });

  it('will not call a direction it cannot back', async () => {
    await render(<MistakeTrend sessions={sessions(2, 40)} />);

    expect(screen.getByText('40.0')).toBeOnTheScreen();
    expect(screen.getByText(/starts reading as a trend/)).toBeOnTheScreen();
  });

  it('gives every bar a label a screen reader can use', async () => {
    await render(<MistakeTrend sessions={sessions(3, 20)} />);

    expect(
      screen.getAllByLabelText(/20\.0 mistakes per hundred decisions over 20 hands/),
    ).toHaveLength(3);
  });

  it('renders nothing at all when no decision has been graded', async () => {
    const ungraded = sessions(4, 0).map((session) => ({ ...session, decisionsGraded: 0 }));

    await render(<MistakeTrend sessions={ungraded} />);

    expect(screen.queryByText('Per hundred decisions')).not.toBeOnTheScreen();
  });
});
