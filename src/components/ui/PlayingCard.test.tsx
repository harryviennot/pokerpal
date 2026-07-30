import { render, screen } from '@testing-library/react-native';

import { parseCard } from '@/engine';
import { colors } from '@/theme';

import { PlayingCard } from './PlayingCard';

/** The colour every glyph of `text` is painted, flattened out of the style prop. */
function glyphColors(text: string): string[] {
  return screen.getAllByText(text).map((node) => {
    const flat = [node.props.style].flat(4).filter(Boolean) as { color?: string }[];

    return flat.reduce<string>((found, style) => style.color ?? found, '');
  });
}

describe('PlayingCard', () => {
  it('labels a face-up card by rank and suit', async () => {
    await render(<PlayingCard card={parseCard('Ah')} />);

    expect(screen.getByLabelText('A of hearts')).toBeOnTheScreen();
    expect(screen.getByText('A')).toBeOnTheScreen();
    // The reference face carries the suit twice: a small index under the rank
    // and one large pip low on the card.
    expect(screen.getAllByText('♥')).toHaveLength(2);
  });

  it('drops the index pip at the smallest size, where it would be noise', async () => {
    await render(<PlayingCard card={parseCard('Ah')} size="small" />);

    expect(screen.getAllByText('♥')).toHaveLength(1);
  });

  it.each([
    ['Ah', '♥', 'suitRed'],
    ['Ad', '♦', 'suitOrange'],
    ['As', '♠', 'suitBlack'],
    ['Ac', '♣', 'suitBlack'],
  ] as const)('paints %s from the four-colour deck', async (notation, symbol, token) => {
    await render(<PlayingCard card={parseCard(notation)} />);

    expect(glyphColors(symbol)).toEqual([colors.light[token], colors.light[token]]);
  });

  it('never exposes the rank of a face-down card', async () => {
    await render(<PlayingCard card={parseCard('Ah')} faceDown />);

    expect(screen.getByLabelText('Face-down card')).toBeOnTheScreen();
    expect(screen.queryByText('A')).toBeNull();
    expect(screen.queryByText('♥')).toBeNull();
  });

  it('shows a mystery card as undealt rather than face down', async () => {
    await render(<PlayingCard mystery />);

    expect(screen.getByLabelText('Card not dealt yet')).toBeOnTheScreen();
    expect(screen.getByText('?')).toBeOnTheScreen();
  });

  it('keeps a mystery card shut even when handed one', async () => {
    await render(<PlayingCard card={parseCard('Ah')} mystery />);

    expect(screen.getByLabelText('Card not dealt yet')).toBeOnTheScreen();
    expect(screen.queryByText('A')).toBeNull();
  });

  it('says a dimmed card does not play', async () => {
    await render(<PlayingCard card={parseCard('Ah')} dimmed />);

    expect(screen.getByLabelText('A of hearts, does not play')).toBeOnTheScreen();
  });

  it('labels an empty slot', async () => {
    await render(<PlayingCard />);

    expect(screen.getByLabelText('Empty card slot')).toBeOnTheScreen();
  });

  it.each(['small', 'medium', 'large', 'xl'] as const)('renders at %s', async (size) => {
    await render(<PlayingCard card={parseCard('Kd')} size={size} />);

    expect(screen.getByLabelText('K of diamonds')).toBeOnTheScreen();
  });
});
