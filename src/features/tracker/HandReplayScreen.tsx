import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { DecisionRow } from '@/components/coach/DecisionRow';
import { GlossaryFooter } from '@/components/coach/GlossaryFooter';
import { LanguageHeaderButton } from '@/components/coach/LanguageHeaderButton';
import { PokerTable } from '@/components/table/PokerTable';
import { ReplayCommentary } from '@/components/table/ReplayCommentary';
import { ReplayControls } from '@/components/table/ReplayControls';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { Section } from '@/components/ui/Section';
import { Text } from '@/components/ui/Text';
import { reviewsByFrame } from '@/engine';
import { useHandReplay } from '@/hooks/useHandReplay';
import { type StoredHand } from '@/services/handHistory';

import { HandFacts } from './HandFacts';
import { useStoredHand } from './useStoredHand';

export interface HandReplayScreenProps {
  /** The row id, as the router hands it over. */
  handId: string;
}

/**
 * A hand out of history, played back street by street.
 *
 * The same frames, the same felt and the same transport controls as the live
 * table — a played hand and a stored one differ only in where their event log
 * came from. What is new is the coach: stepping onto the frame of a graded
 * decision shows the verdict the player earned at that exact moment.
 */
export function HandReplayScreen({ handId }: HandReplayScreenProps) {
  const { state, reload } = useStoredHand(handId);

  if (state.status === 'loading') {
    return (
      <Screen center>
        <ActivityIndicator accessibilityLabel="Loading hand" />
      </Screen>
    );
  }

  if (state.status === 'notFound') {
    return <EmptyState title="Hand not found" message="This hand is no longer in your history." />;
  }

  if (state.status === 'error') {
    return (
      <EmptyState
        title="Hand is unavailable"
        message="Something went wrong reading this hand."
        action={{ label: 'Try again', onPress: reload }}
      />
    );
  }

  return <ReplayedHand hand={state.hand} />;
}

function ReplayedHand({ hand }: { hand: StoredHand }) {
  const input = useMemo(() => ({ seats: hand.seats, events: hand.events }), [hand]);
  const replay = useHandReplay(input);
  const verdicts = useMemo(
    () => reviewsByFrame(replay.frames, hand.reviews, hand.heroSeat),
    [replay.frames, hand.reviews, hand.heroSeat],
  );
  const verdict = verdicts[replay.index] ?? null;

  return (
    <Screen scroll>
      <Stack.Screen
        options={{
          title: `Hand #${hand.handNumber}`,
          // One tap to reword every verdict below, without leaving the hand
          // they are being read against.
          headerRight: () => <LanguageHeaderButton />,
        }}
      />

      {replay.frames.length > 0 && (
        <>
          {/* Sized rather than flexed: `PokerTable` fills its parent, and a
              flexed child of a scroll view collapses to nothing. */}
          <View style={styles.felt}>
            <PokerTable snapshot={replay.snapshot} heroSeat={hand.heroSeat} />
          </View>

          <ReplayCommentary
            frame={replay.frame}
            index={replay.index}
            total={replay.frames.length}
          />

          <ReplayControls
            atStart={replay.atStart}
            atEnd={replay.atEnd}
            onStep={replay.step}
            onStepStreet={replay.stepStreet}
            onRestart={replay.restart}
          />

          {/* Held open so the page does not jump as the cursor passes a decision. */}
          <View style={styles.verdict}>
            {verdict && <DecisionRow review={verdict} bigBlind={hand.blinds.bigBlind} />}
          </View>
        </>
      )}

      <HandFacts hand={hand} />

      <Section title="Decisions">
        {hand.reviews.length > 0 ? (
          hand.reviews.map((review, index) => (
            <DecisionRow key={index} review={review} bigBlind={hand.blinds.bigBlind} />
          ))
        ) : (
          <Text variant="subheadline" tone="secondaryLabel">
            The hand ended before you had a decision to make.
          </Text>
        )}
      </Section>

      <GlossaryFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  felt: {
    // Derived from the width rather than fixed, so the table scales with the
    // device instead of leaving a band of background on a larger one.
    aspectRatio: 0.85,
  },
  verdict: {
    // Roughly one verdict tall: holds the slot open as the cursor crosses a
    // decision so the page does not shuffle under a stepping thumb.
    minHeight: 64,
    justifyContent: 'center',
  },
});
