import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { LEAK_FOCUS } from '@/components/coach/coachCopy';
import { DecisionRow } from '@/components/coach/DecisionRow';
import { LeakSummary } from '@/components/coach/LeakSummary';
import { Screen } from '@/components/ui/Screen';
import { Section } from '@/components/ui/Section';
import { StatRow } from '@/components/ui/StatRow';
import { Text } from '@/components/ui/Text';
import { bestDecision, costliestDecision, summarizeSession, topLeaks } from '@/engine';
import { formatChips } from '@/utils/format';

import { usePracticeStore, type HandCoachRecord } from './usePracticeStore';

/**
 * Pillar C's review surface: how the session is going, the habits it is
 * showing, and every graded decision from the last finished hand.
 *
 * Session-scoped on purpose: this is how tonight is going. What happened across
 * every session lives on the History tab, which reads the stored hands.
 */
export function SessionReviewScreen() {
  const hand = usePracticeStore((state) => state.hand);
  const handSeats = usePracticeStore((state) => state.handSeats);
  const heroSeat = usePracticeStore((state) => state.heroSeat);
  const reviews = usePracticeStore((state) => state.reviews);
  const coachHistory = usePracticeStore((state) => state.coachHistory);
  const saveState = usePracticeStore((state) => state.saveState);

  // The current hand joins the books the moment it finishes; a live one stays
  // out, because its grades do not exist until it is over.
  const records = useMemo<readonly HandCoachRecord[]>(() => {
    if (!hand.complete) {
      return coachHistory;
    }

    return [
      ...coachHistory,
      {
        handNumber: hand.handNumber,
        net: (hand.players[heroSeat]?.stack ?? 0) - (handSeats[heroSeat]?.stack ?? 0),
        reviews,
      },
    ];
  }, [hand, handSeats, heroSeat, reviews, coachHistory]);

  if (records.length === 0) {
    return (
      <Screen center>
        <Text variant="headline">Nothing to review yet</Text>
        <Text variant="subheadline" tone="secondaryLabel" style={styles.empty}>
          Finish a hand and the coach&apos;s notes land here.
        </Text>
      </Screen>
    );
  }

  const allReviews = records.flatMap((record) => record.reviews);
  const summary = summarizeSession(records);
  const leaks = topLeaks(allReviews);
  const best = bestDecision(allReviews);
  const worst = costliestDecision(allReviews);
  const lastHand = records[records.length - 1];

  return (
    <Screen scroll>
      <Section title="Session">
        <StatRow label="Hands played" value={String(summary.handsPlayed)} />
        <StatRow
          label="Net"
          value={`${summary.net > 0 ? '+' : ''}${formatChips(summary.net)}`}
          tone={summary.net > 0 ? 'success' : summary.net < 0 ? 'danger' : 'label'}
        />
        <StatRow label="Biggest win" value={`+${formatChips(summary.biggestWin)}`} />
        <StatRow label="Biggest loss" value={formatChips(summary.biggestLoss)} />
        <StatRow label="Decisions graded" value={String(summary.decisionsGraded)} />
      </Section>

      <Section title="Top leaks">
        <LeakSummary leaks={leaks} />
        {summary.focus && (
          <Text variant="footnote" tone="secondaryLabel">
            Focus: {LEAK_FOCUS[summary.focus]}
          </Text>
        )}
      </Section>

      {(best || (worst && worst.evLoss >= 1)) && (
        <Section title="Highlights">
          {best && (
            <>
              <Text variant="caption" tone="tertiaryLabel">
                BEST DECISION
              </Text>
              <DecisionRow review={best} />
            </>
          )}
          {worst && worst.evLoss >= 1 && (
            <>
              <Text variant="caption" tone="tertiaryLabel">
                COSTLIEST DECISION
              </Text>
              <DecisionRow review={worst} />
            </>
          )}
        </Section>
      )}

      {lastHand && (
        <Section title={`Hand #${lastHand.handNumber}`}>
          {lastHand.reviews.length > 0 ? (
            lastHand.reviews.map((review, index) => <DecisionRow key={index} review={review} />)
          ) : (
            <Text variant="subheadline" tone="secondaryLabel">
              The hand ended before you had a decision to make.
            </Text>
          )}
        </Section>
      )}

      {saveState === 'error' && (
        <Text variant="footnote" tone="danger">
          {"Couldn't save this session's hands — they won't appear in History."}
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: {
    textAlign: 'center',
  },
});
