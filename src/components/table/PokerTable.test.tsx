import { render, screen } from '@testing-library/react-native';

import {
  bestFive,
  evaluateHand,
  parseCards,
  type Card,
  type ReplaySeat,
  type TableSnapshot,
} from '@/engine';

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
  it('crowns the winner, shows the gain and banners the hand', async () => {
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
    expect(screen.getByText('Ava wins with a full house')).toBeOnTheScreen();
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

    expect(screen.getByText('Ava wins')).toBeOnTheScreen();
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

    expect(screen.getByText('Nines full of fours')).toBeOnTheScreen();
  });
});
