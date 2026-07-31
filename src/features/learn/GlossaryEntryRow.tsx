import { Pressable, StyleSheet, View } from 'react-native';

import { type GlossaryEntry } from '@/components/coach/glossary';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { MIN_TOUCH_TARGET, radius, spacing } from '@/theme';

export interface GlossaryEntryRowProps {
  entry: GlossaryEntry;
  expanded: boolean;
  onToggle: () => void;
}

/**
 * One word, both of its names, and what it means.
 *
 * Collapsed to a single line by default: a glossary that opens as forty
 * paragraphs is one nobody reads. Both names always show, because the mapping
 * between the two registers is the thing this screen exists to teach — a reader
 * who only ever sees "Costly mistake" will still hear "blunder" at a real table.
 */
export function GlossaryEntryRow({ entry, expanded, onToggle }: GlossaryEntryRowProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={entry.plain ? `${entry.term}, or ${entry.plain}` : entry.term}
      accessibilityHint={expanded ? 'Collapses the definition' : 'Expands the definition'}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.row,
        expanded && { backgroundColor: colors.tertiaryBackground, borderRadius: radius.sm },
        pressed && styles.pressed,
      ]}>
      <View style={styles.heading}>
        <Text variant="headline">{entry.term}</Text>
        {entry.plain !== null && (
          <Text variant="footnote" tone="secondaryLabel">
            {entry.plain}
          </Text>
        )}
      </View>

      <Text variant="subheadline" tone="secondaryLabel">
        {entry.short}
      </Text>

      {expanded && (
        <>
          <Text variant="subheadline">{entry.long}</Text>
          {entry.example !== undefined && (
            <Text variant="footnote" tone="secondaryLabel" style={styles.example}>
              {entry.example}
            </Text>
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    margin: -spacing.sm,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  example: {
    fontStyle: 'italic',
  },
  pressed: {
    opacity: 0.6,
  },
});
