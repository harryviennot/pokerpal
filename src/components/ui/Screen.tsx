import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/theme';

export interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a scroll view. Off for screens that manage their own scrolling. */
  scroll?: boolean;
  /** Center content on both axes — for empty and error states. */
  center?: boolean;
  contentStyle?: ViewStyle;
}

/** Page container: applies the background token and consistent edge padding. */
export function Screen({ children, scroll = false, center = false, contentStyle }: ScreenProps) {
  const { colors } = useTheme();
  const padding = [styles.content, center && styles.centered, contentStyle];

  if (scroll) {
    return (
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[padding, center && styles.grow]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }, padding]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  content: { padding: spacing.base, gap: spacing.base },
  centered: { justifyContent: 'center', alignItems: 'center' },
});
