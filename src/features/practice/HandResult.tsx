import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { MIN_TOUCH_TARGET, radius, spacing } from '@/theme';
import { formatChips } from '@/utils/format';

export interface HandResultProps {
  /** The hero's chips won or lost on the hand just played. */
  net: number;
  onNextHand: () => void;
}

/** What the hand cost or paid, and the way on to the next one. */
export function HandResult({ net, onNextHand }: HandResultProps) {
  const { colors } = useTheme();

  const press = (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onNextHand();
  };

  return (
    <View style={styles.row}>
      <Text
        variant="headline"
        tabular
        tone={net > 0 ? 'success' : net < 0 ? 'danger' : 'secondaryLabel'}
        style={styles.net}>
        {describe(net)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next hand"
        onPress={press}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.tint },
          pressed && styles.pressed,
        ]}>
        <Text variant="headline" style={{ color: colors.cardFace }}>
          Next hand
        </Text>
      </Pressable>
    </View>
  );
}

function describe(net: number): string {
  if (net > 0) {
    return `You won ${formatChips(net)}`;
  }

  if (net < 0) {
    return `You lost ${formatChips(-net)}`;
  }

  return 'No chips changed hands';
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  net: {
    flex: 1,
  },
  button: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  pressed: {
    opacity: 0.6,
  },
});
