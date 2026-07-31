import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { leakFocus } from '@/components/coach/coachCopy';
import { DecisionRow } from '@/components/coach/DecisionRow';
import { GlossaryFooter } from '@/components/coach/GlossaryFooter';
import { LeakSummary } from '@/components/coach/LeakSummary';
import { Screen } from '@/components/ui/Screen';
import { Section } from '@/components/ui/Section';
import { StatRow } from '@/components/ui/StatRow';
import { Text } from '@/components/ui/Text';
import { summarizeSession, topLeaks } from '@/engine';
import { useCoachLanguage } from '@/hooks/useCoachLanguage';
import { formatChips } from '@/utils/format';

import { heroNetOf } from './handRecord';
import { HIGHLIGHT_LABELS, highlightsOf, type SessionHighlight } from './sessionReport';
import { type HandCoachRecord } from './types';
import { useGameStore } from './useGameStore';

/**
 * Pillar C's review surface: how the session is going, the habits it is
 * showing, and every graded decision from the last finished hand.
 *
 * Session-scoped on purpose: this is how tonight is going. What happened across
 * every session lives on the History tab, which reads the stored hands.
 *
 * A sheet over a game that keeps dealing underneath it, which is only consistent
 * because `coachHistory` is append-only: a hand finishing while this is on screen
 * adds a record, so every number here can grow but none of them can change its
 * mind.
 */
export function SessionReviewScreen() {
  const session = useSessionRecords();
  const language = useCoachLanguage();
  // The blinds do not move in a learning session, so every verdict on this
  // sheet was earned at the same level and can honestly be quoted in it.
  const bigBlind = useGameStore((state) => state.game?.hand.blinds.bigBlind);

  if (!session) {
    return (
      <Screen center>
        <Text variant="headline">No game in progress</Text>
        <Text variant="subheadline" tone="secondaryLabel" style={styles.empty}>
          Start a game from the lobby and the coach&apos;s notes land here.
        </Text>
      </Screen>
    );
  }

  const { records, saveState } = session;

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

  const summary = summarizeSession(records);
  const leaks = topLeaks(records.flatMap((record) => record.reviews));
  const { best, worst } = highlightsOf(records);
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
            Focus: {leakFocus(language)[summary.focus]}
          </Text>
        )}
      </Section>

      {(best || worst) && (
        <Section title="Highlights">
          <Highlight kind="best" highlight={best} bigBlind={bigBlind} />
          <Highlight kind="worst" highlight={worst} bigBlind={bigBlind} />
        </Section>
      )}

      {lastHand && (
        <Section title={`Hand #${lastHand.handNumber}`}>
          {lastHand.reviews.length > 0 ? (
            lastHand.reviews.map((review, index) => (
              <DecisionRow key={index} review={review} bigBlind={bigBlind} />
            ))
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

      <GlossaryFooter />
    </Screen>
  );
}

interface SessionRecords {
  records: readonly HandCoachRecord[];
  saveState: 'ok' | 'error';
}

/**
 * The hands this session has finished, or null when there is no game at all.
 *
 * One selector per field rather than one on the game: this sheet sits over a
 * table that repaints as every card lands, and subscribing to the game object
 * would re-render the whole review on each of those frames.
 */
function useSessionRecords(): SessionRecords | null {
  const coachHistory = useGameStore((state) => state.game?.coachHistory);
  const hand = useGameStore((state) => state.game?.hand);
  const handSeats = useGameStore((state) => state.game?.handSeats);
  const heroSeat = useGameStore((state) => state.game?.heroSeat);
  const reviews = useGameStore((state) => state.game?.reviews);
  const saveState = useGameStore((state) => state.game?.saveState);

  return useMemo(() => {
    if (!coachHistory || !hand || !handSeats || !reviews || !saveState || heroSeat === undefined) {
      return null;
    }

    // The hand in progress stays out: its grades do not exist until it is over.
    // Once it is, it is shown from the live hand until the store books it —
    // the store grades a finished hand one decision at a time, so between the
    // last card and the record landing there is a real hand with real verdicts
    // that the sheet would otherwise be a hand behind on.
    const booked =
      !hand.complete || coachHistory.some((record) => record.handNumber === hand.handNumber);

    return {
      saveState,
      records: booked
        ? coachHistory
        : [
            ...coachHistory,
            {
              handNumber: hand.handNumber,
              net: heroNetOf(hand, handSeats, heroSeat),
              reviews,
            },
          ],
    };
  }, [coachHistory, hand, handSeats, heroSeat, reviews, saveState]);
}

/** One highlighted verdict, captioned with the hand it came from. */
function Highlight({
  kind,
  highlight,
  bigBlind,
}: {
  kind: keyof typeof HIGHLIGHT_LABELS;
  highlight: SessionHighlight | null;
  bigBlind?: number;
}) {
  if (!highlight) {
    return null;
  }

  return (
    <>
      <Text variant="caption" tone="tertiaryLabel">
        {`${HIGHLIGHT_LABELS[kind].toUpperCase()} · HAND #${highlight.handNumber}`}
      </Text>
      <DecisionRow review={highlight.review} bigBlind={bigBlind} />
    </>
  );
}

const styles = StyleSheet.create({
  empty: {
    textAlign: 'center',
  },
});
