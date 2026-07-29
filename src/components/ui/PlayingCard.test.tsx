import { render, screen } from '@testing-library/react-native';

import { parseCard } from '@/engine';

import { PlayingCard } from './PlayingCard';

describe('PlayingCard', () => {
  it('labels a face-up card by rank and suit', async () => {
    await render(<PlayingCard card={parseCard('Ah')} />);

    expect(screen.getByLabelText('A of hearts')).toBeOnTheScreen();
    expect(screen.getByText('A')).toBeOnTheScreen();
    expect(screen.getByText('♥')).toBeOnTheScreen();
  });

  it('never exposes the rank of a face-down card', async () => {
    await render(<PlayingCard card={parseCard('Ah')} faceDown />);

    expect(screen.getByLabelText('Face-down card')).toBeOnTheScreen();
    expect(screen.queryByText('A')).toBeNull();
    expect(screen.queryByText('♥')).toBeNull();
  });

  it('says a dimmed card does not play', async () => {
    await render(<PlayingCard card={parseCard('Ah')} dimmed />);

    expect(screen.getByLabelText('A of hearts, does not play')).toBeOnTheScreen();
  });

  it('labels an empty slot', async () => {
    await render(<PlayingCard />);

    expect(screen.getByLabelText('Empty card slot')).toBeOnTheScreen();
  });
});
