import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { radius } from '@/theme';

export const AVATAR_SIZE = 34;

export interface SeatAvatarProps {
  /** The display name; the circle shows its first letter. */
  name: string;
  /** Draws the crown badge on a seat that just won the pot. */
  crowned?: boolean;
}

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
        <Text
          accessibilityLabel="Winner"
          variant="footnote"
          style={[styles.crown, { color: colors.winner }]}>
          ♛
        </Text>
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
