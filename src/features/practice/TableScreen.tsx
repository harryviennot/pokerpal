import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { type Street } from '@/engine';

import { DEMO_HAND, DEMO_HERO_SEAT } from './demoHand';
import { PokerTable } from './PokerTable';
import { ReplayControls } from './ReplayControls';
import { useHandReplay } from './useHandReplay';

const STREET_LABELS: Record<Street, string> = {
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
};

/**
 * Pillar B, read-only: a hand on the felt, stepped through from its event log.
 *
 * There are no betting controls yet and the hand is a fixed demo. What this
 * screen proves is that a `HandState` the engine produced renders correctly at
 * every point it passes through — including the awkward ones, like a short
 * stack all in and a seat that folded three streets ago.
 */
export function TableScreen() {
  const replay = useHandReplay(DEMO_HAND);
  const { snapshot } = replay;

  return (
    <Screen>
      <PokerTable snapshot={snapshot} heroSeat={DEMO_HERO_SEAT} />

      <View style={styles.commentary}>
        <Text variant="footnote" tone="secondaryLabel">
          {STREET_LABELS[snapshot.street]} · {replay.index + 1} of {replay.frames.length}
        </Text>
        <Text variant="body" numberOfLines={2}>
          {replay.frame.description}
        </Text>
      </View>

      <ReplayControls
        atStart={replay.atStart}
        atEnd={replay.atEnd}
        onStep={replay.step}
        onStepStreet={replay.stepStreet}
        onRestart={replay.restart}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  commentary: {
    // A fixed two-line block: the felt above must not jump as the text changes.
    minHeight: 62,
    gap: 2,
  },
});
