import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { leakFocus } from '@/components/coach/coachCopy';
import { GlossaryFooter } from '@/components/coach/GlossaryFooter';
import { LanguageToggle } from '@/components/coach/LanguageToggle';
import { LeakSummary } from '@/components/coach/LeakSummary';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { Section } from '@/components/ui/Section';
import { StatRow } from '@/components/ui/StatRow';
import { Text } from '@/components/ui/Text';
import { currentBlinds, summarizeSession, topLeaks } from '@/engine';
import { useCoachLanguage } from '@/hooks/useCoachLanguage';
import { MIN_TOUCH_TARGET, spacing } from '@/theme';
import { formatChips } from '@/utils/format';

import { GradeBreakdown } from './GradeBreakdown';
import { SessionHighlights } from './SessionHighlights';
import { describeDuration, highlightsOf, tallyGrades } from './sessionReport';
import { describeBlinds } from './tableSetup';
import { type SessionSummaryData } from './types';
import { useGameStore } from './useGameStore';
import { useSessionHands } from './useSessionHands';

/**
 * Where a finished session lands: how it went, how it was played, and the two
 * hands worth watching again.
 *
 * Real mode's payoff, and the only place its coaching appears — nothing was said
 * at the table on purpose. Learning mode goes back to the lobby instead, so this
 * screen is reached by `replace`: the session is over and there is no felt behind
 * it to go back to.
 */
export function SessionSummaryScreen() {
  // The whole game object, unusually: the session has ended, so nothing is
  // patching it any more and there is no re-render to avoid.
  const game = useGameStore((state) => state.game);
  const leave = useGameStore((state) => state.leave);
  const language = useCoachLanguage();
  const { state: hands, reload } = useSessionHands();

  const exit = (destination: '/lobby' | '/history'): void => {
    leave();
    router.dismissTo(destination);
  };

  if (!game?.sessionEnd) {
    return (
      <EmptyState
        title="No session to report"
        message="This session has already been closed. Every hand you played is in History."
        action={{ label: 'Back to the lobby', onPress: () => exit('/lobby') }}
      />
    );
  }

  const end = game.sessionEnd;
  const coached = summarizeSession(game.coachHistory);
  const leaks = topLeaks(game.coachHistory.flatMap((record) => record.reviews));

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text
          variant="largeTitle"
          tabular
          tone={end.net > 0 ? 'success' : end.net < 0 ? 'danger' : 'label'}>
          {`${end.net > 0 ? '+' : ''}${formatChips(end.net)}`}
        </Text>
        <Text variant="headline">{describeOutcome(end)}</Text>
        <Text variant="subheadline" tone="secondaryLabel">
          {`${end.hands} ${end.hands === 1 ? 'hand' : 'hands'} · ${describeDuration(end.endedAt - end.startedAt)}`}
        </Text>
      </View>

      {/* Hands and minutes are in the line above; repeating them here would be
          two readouts of the same session competing to be read first. */}
      <Section title="Session">
        <StatRow label="Blinds at the end" value={describeBlinds(currentBlinds(game.session))} />
        <StatRow label="Biggest win" value={`+${formatChips(coached.biggestWin)}`} />
        <StatRow label="Biggest loss" value={formatChips(coached.biggestLoss)} />
      </Section>

      <Section title="How you played">
        <GradeBreakdown counts={tallyGrades(game.coachHistory)} />
        <Text variant="footnote" tone="secondaryLabel">
          {`${coached.decisionsGraded} ${coached.decisionsGraded === 1 ? 'decision' : 'decisions'} graded.`}
        </Text>
        {/* Inline rather than in the header, which this screen does not have.
            The report is where a player meets the vocabulary in bulk, so the
            switch belongs beside it. */}
        <LanguageToggle />
      </Section>

      <Section title="Top leaks">
        <LeakSummary leaks={leaks} />
        {coached.focus && (
          <Text variant="footnote" tone="secondaryLabel">
            Focus: {leakFocus(language)[coached.focus]}
          </Text>
        )}
      </Section>

      <SessionHighlights
        highlights={highlightsOf(game.coachHistory)}
        hands={hands}
        onReplay={(handId) =>
          router.push({ pathname: '/game/hand/[id]', params: { id: String(handId) } })
        }
        onRetry={reload}
      />

      {game.saveState === 'error' && (
        <Text variant="footnote" tone="danger">
          {"Couldn't save some of this session's hands — they won't appear in History."}
        </Text>
      )}

      <View style={styles.actions}>
        <Button label="Play again" onPress={() => exit('/lobby')} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done"
          onPress={() => exit('/history')}
          style={styles.done}>
          <Text variant="headline" tone="tint">
            Done
          </Text>
        </Pressable>
        <Text variant="footnote" tone="secondaryLabel" style={styles.footnote}>
          Every hand you played is saved in History.
        </Text>
        <GlossaryFooter />
      </View>
    </Screen>
  );
}

/** The session in one sentence, before any of the numbers. */
function describeOutcome(end: SessionSummaryData): string {
  if (end.busted) {
    return 'You lost your stack.';
  }

  if (end.net > 0) {
    return 'You walked away up.';
  }

  return end.net < 0 ? 'You walked away down.' : 'You walked away level.';
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
  },
  done: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footnote: {
    textAlign: 'center',
  },
});
