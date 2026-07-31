import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useCoachLanguage, useCoachLanguageStore } from '@/hooks/useCoachLanguage';
import { MIN_TOUCH_TARGET, spacing } from '@/theme';

const LABELS = {
  plain: 'Plain English',
  poker: 'Poker terms',
} as const;

/**
 * A one-tap flip between the two registers, for a screen that has a header.
 *
 * The reason it exists next to `LanguageToggle`: the player switches to compare
 * the wordings of a verdict they are looking at right now, and a control that
 * costs a navigation to reach breaks the comparison it is meant to enable. Two
 * options is exactly the case a toggle beats a picker.
 *
 * `Aa` because it is the platform's own glyph for "change the words", and
 * because `expo-symbols` is not a dependency of this project.
 */
export function LanguageHeaderButton() {
  const language = useCoachLanguage();
  const toggleLanguage = useCoachLanguageStore((state) => state.toggleLanguage);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: language === 'plain' }}
      accessibilityLabel={`Coach language: ${LABELS[language]}`}
      accessibilityHint={`Switches to ${LABELS[language === 'plain' ? 'poker' : 'plain']}`}
      hitSlop={spacing.sm}
      onPress={toggleLanguage}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Text variant="headline" tone="tint">
        Aa
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
