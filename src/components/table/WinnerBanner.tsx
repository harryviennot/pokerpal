import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';

export interface WinnerBannerProps {
  /** The line to show, from `winnerSummary`. Renders nothing when null. */
  summary: string | null;
}

/** The result line under the board: "Ava wins with a full house". */
export function WinnerBanner({ summary }: WinnerBannerProps) {
  const { colors } = useTheme();

  if (summary === null) {
    return null;
  }

  return (
    <View style={[styles.banner, { backgroundColor: colors.feltOverlay }]}>
      <Text variant="footnote" numberOfLines={1} style={[styles.text, { color: colors.onFelt }]}>
        {summary}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  text: {
    fontWeight: '600',
  },
});
