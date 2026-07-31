import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { radius } from '@/theme';

/** Diameter of the initial circle, which is what a caller with no artwork gets. */
const AVATAR_SIZE = 50;

/** The character bust beside an opponent's plate. */
const BUST = { width: 75, height: 100 };

/** The player's own portrait, which the reference plants in the bottom corner. */
const HERO_BUST = { width: 152, height: 210 };

export interface SeatAvatarProps {
  /** The display name; the fallback circle shows its first letter. */
  name: string;
  /** The character portrait. Without one the seat falls back to the circle. */
  source?: ImageSourcePropType;
  /** Draws the player's own, much larger portrait. Needs a `source`. */
  hero?: boolean;
}

/**
 * The face at a seat: a character bust where the caller has artwork, and a
 * coloured initial where it does not.
 *
 * The fallback is not a placeholder to be replaced — the tracker replays stored
 * hands whose players were never given a portrait, and an initial in a circle is
 * the right answer there.
 */
export function SeatAvatar({ name, source, hero = false }: SeatAvatarProps) {
  const { colors } = useTheme();

  if (source === undefined) {
    return hero ? null : (
      <View style={[styles.circle, { backgroundColor: colors.avatar }]}>
        <Text variant="footnote" style={[styles.initial, { color: colors.onSeatPill }]}>
          {name.slice(0, 1).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <Image
      accessibilityIgnoresInvertColors
      source={source}
      resizeMode="contain"
      style={hero ? HERO_BUST : BUST}
    />
  );
}

const styles = StyleSheet.create({
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
});
