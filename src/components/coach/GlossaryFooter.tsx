import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/ui/Text';
import { MIN_TOUCH_TARGET } from '@/theme';

/**
 * The way out of a verdict you could not read.
 *
 * Every screen that grades a decision carries one, because the moment a player
 * needs the glossary is the moment they are staring at a word they do not know —
 * not later, from a settings screen they will never think to open.
 */
export function GlossaryFooter() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="What do these words mean?"
      accessibilityHint="Opens the glossary"
      onPress={() => router.push('/glossary')}
      style={({ pressed }) => [styles.footer, pressed && styles.pressed]}>
      <Text variant="footnote" tone="tint">
        What do these words mean?
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  footer: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
