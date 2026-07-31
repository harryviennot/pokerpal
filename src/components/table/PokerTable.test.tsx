import { render, screen } from '@testing-library/react-native';

import {
  bestFive,
  evaluateHand,
  parseCards,
  type Card,
  type ReplaySeat,
  type TableSnapshot,
} from '@/engine';
import { colors } from '@/theme';

import { PokerTable } from './PokerTable';

function makeSeat(seat: number, id: string, overrides: Partial<ReplaySeat> = {}): ReplaySeat {
  return {
    seat,
    id,
    stack: 1000,
    bet: 0,
    status: 'active',
    holeCards: null,
    shown: false,
    mucked: false,
    won: 0,
    rank: null,
    bestFive: null,
    ...overrides,
  };
}

function makeSnapshot(seats: ReplaySeat[], overrides: Partial<TableSnapshot> = {}): TableSnapshot {
  return {
    handNumber: 1,
    button: 0,
    street: 'preflop',
    board: [],
    seats,
    pot: 0,
    actor: null,
    complete: false,
    ...overrides,
  };
}

const hole = (notation: string): readonly [Card, Card] =>
  parseCards(notation) as unknown as readonly [Card, Card];

describe('PokerTable', () => {
  it('crowns the winner, shows the gain, the hand and the caption', async () => {
    const board = parseCards('9h 4s 4d Ac Kd');
    const winnerCards = hole('9c 9d');
    const seven = [...winnerCards, ...board];

    await render(
      <PokerTable
        heroSeat={0}
        snapshot={makeSnapshot(
          [
            makeSeat(0, 'You', { holeCards: hole('7s 2h'), status: 'folded' }),
            makeSeat(1, 'Ava', {
              holeCards: winnerCards,
              shown: true,
              won: 240,
              rank: evaluateHand(seven),
              bestFive: bestFive(seven),
            }),
            makeSeat(2, 'Ben', {
              holeCards: hole('Qs Qh'),
              shown: true,
              rank: evaluateHand([...hole('Qs Qh'), ...board]),
              bestFive: bestFive([...hole('Qs Qh'), ...board]),
            }),
          ],
          { street: 'river', board, complete: true },
        )}
      />,
    );

    expect(screen.getByLabelText('Winner')).toBeOnTheScreen();
    expect(screen.getByText('+240')).toBeOnTheScreen();
    expect(screen.getByText('Ava wins the hand')).toBeOnTheScreen();
    // The hand a pot was won with lives on the winner's own plate now.
    expect(screen.getByText('Full house')).toBeOnTheScreen();
  });

  it('turns a mucked hand face up and dimmed instead of hiding it', async () => {
    const board = parseCards('9h 4s 4d Ac Kd');
    const winnerCards = hole('9c 9d');
    const seven = [...winnerCards, ...board];

    await render(
      <PokerTable
        heroSeat={0}
        snapshot={makeSnapshot(
          [
            makeSeat(0, 'You', { holeCards: hole('7s 2h'), status: 'folded' }),
            makeSeat(1, 'Ava', {
              holeCards: winnerCards,
              shown: true,
              won: 240,
              rank: evaluateHand(seven),
              bestFive: bestFive(seven),
            }),
            makeSeat(2, 'Ben', { holeCards: hole('Qc Jc'), mucked: true }),
          ],
          { street: 'river', board, complete: true },
        )}
      />,
    );

    // The loser's cards read, greyed: outside the winning five, they dim.
    expect(screen.getByLabelText('Q of clubs, does not play')).toBeOnTheScreen();
    expect(screen.getByLabelText('J of clubs, does not play')).toBeOnTheScreen();
  });

  it('dims the board cards that do not play in the winning hand', async () => {
    const board = parseCards('9h 4s 4d Ac Kd');
    const winnerCards = hole('9c 9d');
    const seven = [...winnerCards, ...board];

    await render(
      <PokerTable
        heroSeat={0}
        snapshot={makeSnapshot(
          [
            makeSeat(0, 'You', { status: 'folded' }),
            makeSeat(1, 'Ava', {
              holeCards: winnerCards,
              shown: true,
              won: 240,
              rank: evaluateHand(seven),
              bestFive: bestFive(seven),
            }),
          ],
          { street: 'river', board, complete: true },
        )}
      />,
    );

    // The nine and the fours play; the ace and king kickers do not.
    expect(screen.getByLabelText('9 of hearts')).toBeOnTheScreen();
    expect(screen.getByLabelText('A of clubs, does not play')).toBeOnTheScreen();
    expect(screen.getByLabelText('K of diamonds, does not play')).toBeOnTheScreen();
  });

  it('says who took the pot when everyone folded', async () => {
    await render(
      <PokerTable
        heroSeat={0}
        snapshot={makeSnapshot(
          [
            makeSeat(0, 'You', { status: 'folded' }),
            makeSeat(1, 'Ava', { holeCards: hole('9c 9d'), won: 15 }),
          ],
          { complete: true },
        )}
      />,
    );

    expect(screen.getByText('Ava wins the hand')).toBeOnTheScreen();
  });

  it('stands unrevealed cards in for the board between hands', async () => {
    await render(
      <PokerTable
        heroSeat={0}
        snapshot={makeSnapshot([makeSeat(0, 'You'), makeSeat(1, 'Ava', { won: 90 })], {
          complete: true,
        })}
      />,
    );

    expect(screen.getAllByLabelText('Card not dealt yet')).toHaveLength(3);
  });

  it('renders no cards for a folded seat and a bet for a live one', async () => {
    await render(
      <PokerTable
        heroSeat={0}
        snapshot={makeSnapshot([
          makeSeat(0, 'You', { holeCards: hole('7s 2h') }),
          makeSeat(1, 'Ava', { holeCards: hole('9c 9d'), bet: 30 }),
          makeSeat(2, 'Ben', { holeCards: hole('Qs Qh'), status: 'folded' }),
        ])}
      />,
    );

    // Only Ava still holds cards face down; Ben's are gone with the fold.
    expect(screen.getAllByLabelText('Face-down card')).toHaveLength(2);
    expect(screen.getByLabelText('Bet 30')).toBeOnTheScreen();
    expect(screen.getByLabelText('Ben folded, 1 000 behind')).toBeOnTheScreen();
  });

  it('captions the hero with their live made hand', async () => {
    await render(
      <PokerTable
        heroSeat={0}
        snapshot={makeSnapshot(
          [makeSeat(0, 'You', { holeCards: hole('9c 9d') }), makeSeat(1, 'Ava')],
          { street: 'flop', board: parseCards('9h 4s 4d') },
        )}
      />,
    );

    // The live caption keeps the spoken form; only a comma'd tail is trimmed.
    expect(screen.getByText('Nines full of fours')).toBeOnTheScreen();
  });

  it('marks the dealer, the pot total and the chips already collected', async () => {
    await render(
      <PokerTable
        heroSeat={0}
        snapshot={makeSnapshot([makeSeat(0, 'You'), makeSeat(1, 'Ava', { bet: 20 })], {
          button: 1,
          pot: 60,
        })}
      />,
    );

    expect(screen.getByLabelText('Dealer button')).toBeOnTheScreen();
    // The total counts the chips still in front of seats; the middle shows only
    // what has already been pulled in.
    expect(screen.getByLabelText('Pot 80')).toBeOnTheScreen();
    expect(screen.getByLabelText('Pot 60')).toBeOnTheScreen();
  });

  it('badges an all-in bet, because the amount alone does not say it', async () => {
    await render(
      <PokerTable
        heroSeat={0}
        snapshot={makeSnapshot([
          makeSeat(0, 'You'),
          makeSeat(1, 'Ava', { bet: 500, stack: 0, status: 'allIn' }),
        ])}
      />,
    );

    expect(screen.getByText('All in')).toBeOnTheScreen();
    expect(screen.getByText('All-in')).toBeOnTheScreen();
  });

  it('hides a busted seat rather than seating a ghost', async () => {
    await render(
      <PokerTable
        heroSeat={0}
        snapshot={makeSnapshot([
          makeSeat(0, 'You'),
          makeSeat(1, 'Ava', { status: 'sittingOut', stack: 0 }),
          makeSeat(2, 'Ben'),
        ])}
      />,
    );

    expect(screen.queryByLabelText('Ava, 0 behind')).toBeNull();
    expect(screen.getByLabelText('Ben, 1 000 behind')).toBeOnTheScreen();
  });

  describe('optional decoration', () => {
    const acting = makeSnapshot(
      [
        makeSeat(0, 'You', { holeCards: hole('9c 9d') }),
        makeSeat(1, 'Ava', { holeCards: hole('7s 2h') }),
      ],
      { actor: 1 },
    );

    it('shows the acting seat the verb it just played, and nobody else', async () => {
      await render(<PokerTable heroSeat={0} snapshot={acting} actionLabel="Raise" />);

      expect(screen.getByText('Raise')).toBeOnTheScreen();
      expect(screen.getByText('You')).toBeOnTheScreen();
      expect(screen.queryByText('Ava')).toBeNull();
    });

    it('leaves the plate alone when the caller has no verb to show', async () => {
      await render(<PokerTable heroSeat={0} snapshot={acting} />);

      expect(screen.getByText('Ava')).toBeOnTheScreen();
    });

    it('inverts the seat the table is waiting on, not the one that just acted', async () => {
      // Ava (the frame's actor) already raised: her verb sits on a dark plate.
      // The clock is on the hero, whose plate inverts to white while the table
      // waits — the reference's language for "it is your turn".
      await render(<PokerTable heroSeat={0} snapshot={acting} actionLabel="Raise" onClock={0} />);

      expect(screen.getByText('Raise')).toHaveStyle({ color: colors.light.onPillDark });
      expect(screen.getByText('You')).toHaveStyle({ color: colors.light.onPillLight });
    });

    it('badges a hand with the equity the caller worked out', async () => {
      await render(<PokerTable heroSeat={0} snapshot={acting} seatBadges={['30%', '70%']} />);

      expect(screen.getByText('30%')).toBeOnTheScreen();
      expect(screen.getByText('70%')).toBeOnTheScreen();
    });

    it('falls back to an initial for a seat with no portrait', async () => {
      await render(<PokerTable heroSeat={0} snapshot={acting} />);

      expect(screen.getByText('A')).toBeOnTheScreen();
    });

    it('drops the initials once the caller supplies portraits', async () => {
      await render(
        <PokerTable
          heroSeat={0}
          snapshot={acting}
          seatAvatars={[{ uri: 'hero' }, { uri: 'ava' }]}
        />,
      );

      expect(screen.queryByText('A')).toBeNull();
    });
  });
});
