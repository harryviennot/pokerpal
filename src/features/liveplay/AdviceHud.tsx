import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { STREET_LABELS } from '@/components/coach/coachCopy';
import { Text } from '@/components/ui/Text';
import { type Action } from '@/engine';
import { useMotionPrefs } from '@/hooks/useMotionPrefs';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing, springs } from '@/theme';
import { formatPercent } from '@/utils/format';

import { type LiveAdvice } from './liveAdvice';
import { LIVE_BIG_BLIND } from './liveHandState';

export interface AdviceHudProps {
  /** The recommendation for the current spot, or null when there is none. */
  advice: LiveAdvice | null;
}

/**
 * The Tier 2 banner: the recommended action in one word (sized when it is a
 * bet), the arithmetic behind it one tap away. Every number came out of the
 * engine; nothing here may soften or restate one.
 */
export function AdviceHud({ advice }: AdviceHudProps) {
  if (!advice) {
    return null;
  }

  // Keyed by the recommendation, so a fresh one remounts and announces itself
  // with a small settle while the same one re-rendering sits still.
  return <AdviceCard key={`${actionLabel(advice.best)}|${advice.reason}`} advice={advice} />;
}

function AdviceCard({ advice }: { advice: LiveAdvice }) {
  const { colors } = useTheme();
  const { reduceMotion } = useMotionPrefs();
  const [expanded, setExpanded] = useState(false);
  const entry = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    entry.value = reduceMotion ? 1 : withSpring(1, springs.notify);
  }, [entry, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: entry.value,
    transform: [{ translateY: (1 - entry.value) * spacing.lg }],
  }));

  return (
    <Animated.View
      style={[animatedStyle, styles.banner, { backgroundColor: colors.secondaryBackground }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Advice: ${actionLabel(advice.best)}. Tap for the reasoning.`}
        onPress={() => setExpanded((current) => !current)}>
        <View style={styles.headline}>
          <Text variant="title3" style={{ color: colors.tint }}>
            {actionLabel(advice.best)}
          </Text>
          <Text variant="caption" tone="secondaryLabel">
            {STREET_LABELS[advice.facts.street]}
          </Text>
        </View>
        <Text variant="subheadline" tone="secondaryLabel">
          {advice.reason}
        </Text>

        {expanded ? (
          <View style={styles.facts}>
            <Text variant="footnote" tone="secondaryLabel" tabular>
              Equity {formatPercent(advice.facts.equity)} · needs{' '}
              {formatPercent(advice.facts.requiredEquity)}
            </Text>
            <Text variant="footnote" tone="secondaryLabel" tabular>
              Pot {bb(advice.facts.pot)} bb · to call {bb(advice.facts.toCall)} bb · stack{' '}
              {bb(advice.facts.stack)} bb
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/** The action as it would be announced, sized in big blinds. */
export function actionLabel(action: Action): string {
  switch (action.type) {
    case 'fold':
      return 'Fold';
    case 'check':
      return 'Check';
    case 'call':
      return 'Call';
    case 'bet':
      return `Bet ${bb(action.to)} bb`;
    case 'raise':
      return `Raise to ${bb(action.to)} bb`;
  }
}

function bb(chips: number): string {
  const blinds = chips / LIVE_BIG_BLIND;

  return Number.isInteger(blinds) ? String(blinds) : blinds.toFixed(1);
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radius.md,
    padding: spacing.base,
    gap: spacing.xs,
  },
  headline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  facts: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
});
