import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { Section } from '@/components/ui/Section';
import { StatRow } from '@/components/ui/StatRow';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { MIN_TOUCH_TARGET, radius, spacing } from '@/theme';
import { formatChips } from '@/utils/format';

import { HandHistoryRow } from './HandHistoryRow';
import { useHandHistory } from './useHandHistory';

/**
 * The tracker's first surface: every hand ever played on this device, newest
 * first, with the all-time ledger above it. Reads the hand-history repository;
 * the live session belongs to the table and its review sheet.
 */
export function HistoryScreen() {
  const { state, reload } = useHandHistory();

  // A hand finished on the table tab appears the moment this tab is opened.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (state.status === 'loading') {
    return (
      <Screen center>
        <ActivityIndicator accessibilityLabel="Loading hand history" />
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen center>
        <Text variant="headline">History is unavailable</Text>
        <Text variant="subheadline" tone="secondaryLabel" style={styles.centered}>
          Something went wrong reading your saved hands.
        </Text>
        <RetryButton onPress={reload} />
      </Screen>
    );
  }

  if (state.hands.length === 0) {
    return (
      <Screen center>
        <Text variant="headline">No hands yet</Text>
        <Text variant="subheadline" tone="secondaryLabel" style={styles.centered}>
          Play a hand at the table and it lands here.
        </Text>
      </Screen>
    );
  }

  const { totals } = state;

  return (
    <Screen scroll>
      <Section title="All time">
        <StatRow label="Hands played" value={String(totals.hands)} />
        <StatRow
          label="Net"
          value={`${totals.net > 0 ? '+' : ''}${formatChips(totals.net)}`}
          tone={totals.net > 0 ? 'success' : totals.net < 0 ? 'danger' : 'label'}
        />
        <StatRow label="Decisions graded" value={String(totals.decisionsGraded)} />
      </Section>

      <Section title="Hands">
        {state.hands.map((hand) => (
          <HandHistoryRow key={hand.id} hand={hand} />
        ))}
      </Section>
    </Screen>
  );
}

function RetryButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Try again"
      onPress={onPress}
      style={({ pressed }) => [
        styles.retry,
        { backgroundColor: colors.tint },
        pressed && styles.pressed,
      ]}>
      <Text variant="headline" style={{ color: colors.cardFace }}>
        Try again
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: {
    textAlign: 'center',
  },
  retry: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  pressed: {
    opacity: 0.8,
  },
});
