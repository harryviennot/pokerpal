import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { parseCard, parseCards } from '@/engine';
import { useTheme } from '@/hooks/useTheme';
import { emptyFrames, heroPair, steadyFrames, type DetectionScript } from '@/services/vision';
import { radius, spacing } from '@/theme';

import { useLivePlayStore } from './useLivePlayStore';

/** The demo's cadence, matching the real frame processor's post rate. */
const FRAME_MS = 100;

/**
 * One scripted hand: the felt sits empty, a flop lands and holds, the turn
 * and river follow, the table is cleared. Looping it exercises every state
 * the HUD has — including the hand boundary.
 */
function demoScript(): DetectionScript {
  const flop = parseCards('Qc 7d 2s').map((card, index) => ({ card, bbox: slot(index) }));
  const turn = { card: parseCard('9s'), bbox: slot(3) };
  const river = { card: parseCard('3d'), bbox: slot(4) };
  // The hero's cards are on screen for the whole hand, exactly as they are on
  // a real table — so the demo exercises the auto-lock and the advice with no
  // taps at all.
  const hero = [...heroPair([parseCard('Ah'), parseCard('Kh')])];

  return [
    ...steadyFrames(hero, 10),
    ...steadyFrames([...hero, ...flop], 12),
    ...steadyFrames([...hero, ...flop, turn], 10),
    ...steadyFrames([...hero, ...flop, turn, river], 12),
    ...steadyFrames(hero, 24),
    ...emptyFrames(4),
  ];
}

function slot(index: number) {
  return { x: 0.15 + index * 0.14, y: 0.42, width: 0.11, height: 0.16 };
}

/**
 * The stage when there is no camera: a simulator, a permission not yet
 * granted, a model that failed to load. Feeds the scripted hand through the
 * same `ingestFrame` the frame processor uses, so everything above the
 * detection layer runs for real.
 */
export function DemoFeedPanel() {
  const { colors } = useTheme();

  useEffect(() => {
    const script = demoScript();
    let at = 0;

    const timer = setInterval(() => {
      const frame = script[at % script.length];

      at += 1;

      if (frame) {
        useLivePlayStore.getState().ingestFrame(frame);
      }
    }, FRAME_MS);

    return () => clearInterval(timer);
  }, []);

  return (
    <View style={[styles.stage, { backgroundColor: colors.felt }]}>
      <Text variant="footnote" tone="secondaryLabel">
        Demo — no camera on this device
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: spacing.base,
  },
});
