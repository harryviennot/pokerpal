import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator } from 'react-native';

import { LEAK_FOCUS } from '@/components/coach/coachCopy';
import { LeakSummary } from '@/components/coach/LeakSummary';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { Section } from '@/components/ui/Section';
import { StatRow } from '@/components/ui/StatRow';
import { Text } from '@/components/ui/Text';
import { formatChips } from '@/utils/format';

import { HandHistoryRow } from './HandHistoryRow';
import { MistakeTrend } from './MistakeTrend';
import { useHandHistory } from './useHandHistory';

/** The PRD's "your top 3 leaks", across every session rather than one. */
const TOP_LEAKS = 3;

/**
 * The tracker's surface: the all-time ledger, whether the mistakes are getting
 * rarer, the habits costing the most, and every hand ever played on this device.
 *
 * Reads the hand-history repository, so everything here is across all sessions;
 * how tonight is going belongs to the table's review sheet.
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

  const { totals, leaks } = state;
  const top = leaks.slice(0, TOP_LEAKS);
  const focus = top[0]?.leak;

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

      <MistakeTrend sessions={state.sessions} />

      <Section title="Your top 3 leaks">
        <LeakSummary leaks={top} />
        {focus && (
          <Text variant="footnote" tone="secondaryLabel">
            Focus: {LEAK_FOCUS[focus]}
          </Text>
        )}
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
