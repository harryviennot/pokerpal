import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/ui/Text';
import { MIN_TOUCH_TARGET, spacing } from '@/theme';

/**
 * The way to the table setup, from the felt's navigation bar.
 *
 * A header accessory rather than a control on the screen: choosing a table is a
 * secondary flow, and the felt has no room to spare.
 */
export function TableSetupLink() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="New table"
      accessibilityHint="Choose the opponents and stakes"
      onPress={() => router.push('/table/setup')}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
      <Text variant="body" tone="tint">
        Table
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
});
