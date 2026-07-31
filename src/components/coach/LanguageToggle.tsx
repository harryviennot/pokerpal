import { Host, Picker } from '@expo/ui';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useCoachLanguage, useCoachLanguageStore } from '@/hooks/useCoachLanguage';
import { spacing } from '@/theme';

import { type CoachLanguage } from './coachCopy';

const OPTIONS: readonly { value: CoachLanguage; label: string }[] = [
  { value: 'plain', label: 'Plain English' },
  { value: 'poker', label: 'Poker terms' },
];

export interface LanguageToggleProps {
  /** Null hides it — the control is the whole row where the label would be noise. */
  label?: string | null;
}

/**
 * Which register the coach speaks in.
 *
 * The same choice appears as a one-tap `Aa` button on the screens that have a
 * header; this is the version for screens that do not, and the canonical one on
 * the glossary, where naming both options is the point rather than a detail.
 *
 * A native picker rather than a custom segmented control, per the HIG and the
 * lobby's existing setup rows.
 */
export function LanguageToggle({ label = 'Coach language' }: LanguageToggleProps) {
  const language = useCoachLanguage();
  const setLanguage = useCoachLanguageStore((state) => state.setLanguage);

  return (
    <View style={styles.row}>
      {label !== null && (
        <Text variant="subheadline" tone="secondaryLabel">
          {label}
        </Text>
      )}
      <Host style={styles.picker} matchContents>
        <Picker
          selectedValue={language}
          onValueChange={(value) => setLanguage(value === 'poker' ? 'poker' : 'plain')}>
          {OPTIONS.map((option) => (
            <Picker.Item key={option.value} label={option.label} value={option.value} />
          ))}
        </Picker>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  picker: {
    minHeight: 44,
  },
});
