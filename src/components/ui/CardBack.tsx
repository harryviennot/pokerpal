import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/theme';

export interface CardBackProps {
  /** The corner radius of the card this fills, so the inset ring can follow it. */
  radius: number;
}

/** Inset of the light ring from the card's edge. */
const RING = 3;

/**
 * The back of a card: red, ringed in white, with a lozenge in the middle.
 *
 * Fills its parent rather than sizing itself, so `PlayingCard` stays the one
 * place that knows how big a card is.
 */
export function CardBack({ radius }: CardBackProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: colors.cardBackRed,
          // A two-stop gradient with no extra views and no canvas. If the
          // platform ignores it the flat `backgroundColor` underneath still
          // reads as a card back, which is why it is safe to lean on.
          experimental_backgroundImage: `linear-gradient(180deg, ${colors.cardBackRed}, ${colors.cardBackRedDeep})`,
        },
      ]}>
      <View
        style={[
          styles.ring,
          { borderColor: colors.cardFace, borderRadius: Math.max(0, radius - RING) },
        ]}
      />
      <View style={[styles.lozenge, { backgroundColor: colors.cardFace }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    inset: RING,
    borderWidth: 1.5,
    opacity: 0.9,
  },
  // Centred by insetting equally on all sides: percentage offsets plus negative
  // margins would need the card's size, which this component does not have.
  lozenge: {
    position: 'absolute',
    inset: '42%',
    borderRadius: spacing.xs / 2,
    transform: [{ rotate: '45deg' }],
    opacity: 0.85,
  },
});
