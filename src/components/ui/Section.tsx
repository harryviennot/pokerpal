import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';

export interface SectionProps {
  title?: string;
  /** Right-aligned accessory in the header row, e.g. a reset control. */
  accessory?: ReactNode;
  children: ReactNode;
}

/** A grouped block of content, in the style of an iOS inset grouped list. */
export function Section({ title, accessory, children }: SectionProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrapper}>
      {(title || accessory) && (
        <View style={styles.header}>
          {title ? (
            <Text variant="footnote" tone="secondaryLabel" style={styles.title}>
              {title.toUpperCase()}
            </Text>
          ) : (
            <View />
          )}
          {accessory}
        </View>
      )}
      <View
        style={[
          styles.body,
          { backgroundColor: colors.secondaryBackground, borderRadius: radius.md },
        ]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  title: {
    letterSpacing: 0.6,
  },
  body: {
    padding: spacing.base,
    gap: spacing.md,
  },
});
