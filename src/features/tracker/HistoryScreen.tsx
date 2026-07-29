import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { Section } from '@/components/ui/Section';
import { StatRow } from '@/components/ui/StatRow';
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
      <EmptyState
        title="History is unavailable"
        message="Something went wrong reading your saved hands."
        action={{ label: 'Try again', onPress: reload }}
      />
    );
  }

  if (state.hands.length === 0) {
    return (
      <EmptyState title="No hands yet" message="Play a hand at the table and it lands here." />
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
          <HandHistoryRow
            key={hand.id}
            hand={hand}
            onPress={() =>
              router.push({ pathname: '/history/[id]', params: { id: String(hand.id) } })
            }
          />
        ))}
      </Section>
    </Screen>
  );
}
