import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { MIN_TOUCH_TARGET, radius, spacing } from '@/theme';

export interface ButtonProps {
  label: string;
  onPress: () => void;
}

/** A filled action. The label is the accessibility label; keep it a verb phrase. */
export function Button({ label, onPress }: ButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.tint },
        pressed && styles.pressed,
      ]}>
      <Text variant="headline" style={{ color: colors.cardFace }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radius.sm,
  },
  pressed: {
    opacity: 0.8,
  },
});
