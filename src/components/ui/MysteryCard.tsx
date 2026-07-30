import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';

export interface MysteryCardProps {
  /** The corner radius of the card this fills, so the inset ring can follow it. */
  radius: number;
  /** Scales the mark down on the small sizes. */
  large?: boolean;
}

/** Inset of the faint ring from the card's edge. */
const RING = 3;

/** Where the sparkles sit, as fractions of the card, and how bright each is. */
const SPARKS = [
  { left: '14%', top: '10%', opacity: 0.9 },
  { left: '72%', top: '20%', opacity: 0.7 },
  { left: '58%', top: '62%', opacity: 0.5 },
  { left: '22%', top: '78%', opacity: 0.35 },
] as const;

/**
 * A card that has not been dealt yet: the plum-to-navy "?" with sparkles that
 * holds the board's place between hands.
 *
 * Fills its parent, like `CardBack`.
 */
export function MysteryCard({ radius, large = false }: MysteryCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.card,
        {
          backgroundColor: colors.pillDark,
          experimental_backgroundImage: `linear-gradient(145deg, ${colors.cardBackRedDeep}, ${colors.pillDark} 70%)`,
        },
      ]}>
      <View
        style={[
          styles.ring,
          { borderColor: colors.onPillDark, borderRadius: Math.max(0, radius - RING) },
        ]}
      />
      {SPARKS.map((spark) => (
        <Text
          key={spark.left + spark.top}
          variant="caption"
          style={[styles.spark, spark, { color: colors.onPillDark }]}>
          ✦
        </Text>
      ))}
      <Text
        variant={large ? 'largeTitle' : 'title2'}
        style={[styles.mark, { color: colors.onPillDark }]}>
        ?
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    inset: RING,
    borderWidth: 1,
    opacity: 0.18,
  },
  spark: {
    position: 'absolute',
  },
  mark: {
    fontWeight: '800',
  },
});
