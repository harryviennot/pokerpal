import { StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, ZoomIn } from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { radius, springs } from '@/theme';

export const AVATAR_SIZE = 34;

export interface SeatAvatarProps {
  /** The display name; the circle shows its first letter. */
  name: string;
  /** Draws the crown badge on a seat that just won the pot. */
  crowned?: boolean;
}

const crownIn = ZoomIn.springify()
  .damping(springs.glow.damping)
  .stiffness(springs.glow.stiffness)
  .mass(springs.glow.mass)
  .reduceMotion(ReduceMotion.System);

/** A player's initial in a circle, with a crown when they take the pot. */
export function SeatAvatar({ name, crowned = false }: SeatAvatarProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrapper}>
      <View style={[styles.circle, { backgroundColor: colors.avatar }]}>
        <Text variant="footnote" style={[styles.initial, { color: colors.onSeatPill }]}>
          {name.slice(0, 1).toUpperCase()}
        </Text>
      </View>
      {crowned && (
        <Animated.View entering={crownIn} style={styles.crown}>
          <Text accessibilityLabel="Winner" variant="footnote" style={{ color: colors.winner }}>
            ♛
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  circle: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontWeight: '700',
  },
  crown: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
  },
});
