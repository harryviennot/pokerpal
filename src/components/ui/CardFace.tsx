import { StyleSheet, View } from 'react-native';

import { suitColor } from '@/components/ui/suitColor';
import { Text } from '@/components/ui/Text';
import { formatRank, rankOf, suitOf, suitSymbol, type Card } from '@/engine';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/theme';

/** Sizes named as `PlayingCard` names them; the face only cares about type. */
export type CardFaceSize = 'small' | 'medium' | 'large' | 'xl';

export interface CardFaceProps {
  card: Card;
  size: CardFaceSize;
  /** Fades the glyphs on a card that does not play at showdown. */
  dimmed?: boolean;
}

const RANK_VARIANT = {
  small: 'title3',
  medium: 'title1',
  large: 'largeTitle',
  xl: 'largeTitle',
} as const;

const PIP_VARIANT = {
  small: 'footnote',
  medium: 'title2',
  large: 'largeTitle',
  xl: 'largeTitle',
} as const;

/** The index pip under the rank. Dropped at the smallest size, where it is noise. */
const INDEX_VARIANT = {
  small: null,
  medium: 'caption',
  large: 'footnote',
  xl: 'footnote',
} as const;

/**
 * What a face-up card shows: a heavy rank in the top-left corner over a small
 * index pip, and one large pip low and centred.
 *
 * Suits use the four-colour deck — hearts red, diamonds orange, spades and clubs
 * the same near-black navy — so a player reads a suit without reading a symbol.
 */
export function CardFace({ card, size, dimmed = false }: CardFaceProps) {
  const { colors } = useTheme();
  const index = INDEX_VARIANT[size];
  const symbol = suitSymbol(suitOf(card));
  const glyph = { color: suitColor(suitOf(card), colors), opacity: dimmed ? 0.75 : 1 };

  return (
    <>
      <View style={styles.corner}>
        <Text variant={RANK_VARIANT[size]} style={[styles.rank, glyph]}>
          {formatRank(rankOf(card))}
        </Text>
        {index !== null && (
          <Text variant={index} style={[styles.index, glyph]}>
            {symbol}
          </Text>
        )}
      </View>
      <Text variant={PIP_VARIANT[size]} style={[styles.pip, glyph]}>
        {symbol}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  // Pulled up and in, so the rank's own line box does not push the glyph away
  // from the corner it is meant to sit in.
  corner: {
    position: 'absolute',
    top: -spacing.xs,
    left: spacing.xs,
  },
  rank: {
    fontWeight: '800',
  },
  index: {
    marginTop: -spacing.sm,
  },
  pip: {
    position: 'absolute',
    bottom: 0,

    right: spacing.xs,
    textAlign: 'center',
  },
});
