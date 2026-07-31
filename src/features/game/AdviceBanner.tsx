import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { gradeLabels, GRADE_TONES } from '@/components/coach/coachCopy';
import { explainReview } from '@/components/coach/explain';
import { Text } from '@/components/ui/Text';
import { type DecisionReview } from '@/engine';
import { useCoachLanguage } from '@/hooks/useCoachLanguage';
import { useMotionPrefs } from '@/hooks/useMotionPrefs';
import { useTheme } from '@/hooks/useTheme';
import { MIN_TOUCH_TARGET, radius, spacing, springs } from '@/theme';

import { type AdviceNotice } from './types';

export interface AdviceBannerProps {
  /** The coach's word on the hand just finished, or null when there is none. */
  advice: AdviceNotice | null;
  /** The blind the loss is quoted in, so a grade means the same at every level. */
  bigBlind: number;
  onDismiss: () => void;
}

/** How long a notice stays before it takes itself away. */
const LINGER_MS = 6_000;

/** How far above its resting place the notice starts. */
const RISE = spacing.xxl * 2;

/**
 * The coach's verdict on the hand just played, as a notification.
 *
 * A notification and not a panel, which is the whole point: it arrives over the
 * felt, says one thing, and leaves — by itself after six seconds, or the moment
 * it is dismissed. Nothing waits on it and nothing is blocked by it, so the next
 * hand can be dealt underneath while it is still on screen.
 *
 * Every number on it came out of the engine. Nothing here may round a figure into
 * a different claim or soften a grade the math did not soften; the product rests
 * on the verdict being trustworthy.
 */
export function AdviceBanner({ advice, bigBlind, onDismiss }: AdviceBannerProps) {
  const review = advice?.review ?? null;

  useEffect(() => {
    if (!review) {
      return;
    }

    const timer = setTimeout(onDismiss, LINGER_MS);

    return () => clearTimeout(timer);
    // Keyed on the hand rather than the notice object, so a re-render does not
    // restart the six seconds a player has already spent reading it.
  }, [advice?.handNumber, review, onDismiss]);

  // A hand with nothing gradable in it — everyone folded to the hero's blind, say
  // — has no verdict to deliver, and a notice saying so would be noise.
  if (!advice || !review) {
    return null;
  }

  return (
    <Notice
      key={advice.handNumber}
      review={review}
      total={advice.total}
      bigBlind={bigBlind}
      onDismiss={onDismiss}
    />
  );
}

interface NoticeProps {
  review: DecisionReview;
  /** How many decisions were graded, so one verdict can say what it is one of. */
  total: number;
  bigBlind: number;
  onDismiss: () => void;
}

function Notice({ review, total, bigBlind, onDismiss }: NoticeProps) {
  const { colors } = useTheme();
  const { reduceMotion } = useMotionPrefs();
  const language = useCoachLanguage();
  const entry = useSharedValue(reduceMotion ? 1 : 0);
  const tone = GRADE_TONES[review.grade];
  const grade = gradeLabels(language)[review.grade];
  // The headline only, not the whole explanation: a notice that takes six
  // seconds to read is one that leaves before it has been read. The rest is a
  // tap away in the review sheet this opens.
  const { what } = explainReview(review, { language, bigBlind });

  useEffect(() => {
    entry.value = reduceMotion ? 1 : withSpring(1, springs.notify);
  }, [entry, reduceMotion]);

  const slide = useAnimatedStyle(() => ({
    opacity: entry.value,
    transform: [{ translateY: (entry.value - 1) * RISE }],
  }));

  return (
    <Animated.View style={[styles.wrapper, slide]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${grade}. ${what}`}
        accessibilityHint="Opens the session review"
        onPress={() => router.push('/game/review')}
        style={({ pressed }) => [
          styles.notice,
          { backgroundColor: colors.captionScrim },
          pressed && styles.pressed,
        ]}>
        <View style={[styles.accent, { backgroundColor: colors[tone] }]} />

        <View style={styles.body}>
          <View style={styles.header}>
            <Text variant="footnote" tone={tone} style={styles.grade}>
              {grade.toUpperCase()}
            </Text>
            {review.evLoss >= bigBlind / 2 && (
              <Text variant="caption" tabular style={[styles.cost, { color: colors.onFrostBadge }]}>
                −{(review.evLoss / bigBlind).toFixed(1)} bb
                {total > 1 ? ` · worst of ${total}` : ''}
              </Text>
            )}
          </View>
          <Text variant="subheadline" numberOfLines={2} style={{ color: colors.onFrostBadge }}>
            {what}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss the coach"
          hitSlop={spacing.sm}
          onPress={onDismiss}
          style={styles.close}>
          <Text variant="body" style={[styles.closeGlyph, { color: colors.onFrostBadge }]}>
            ✕
          </Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingRight: spacing.xs,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  // A tone stripe rather than a tinted card: the grade has to read at a glance
  // without the notice shouting over the table underneath it.
  accent: {
    width: spacing.xs,
    alignSelf: 'stretch',
  },
  body: {
    flex: 1,
    gap: spacing.xs / 2,
    paddingVertical: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  grade: {
    letterSpacing: 0.6,
    fontWeight: '700',
  },
  cost: {
    opacity: 0.75,
  },
  close: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: {
    opacity: 0.7,
  },
  pressed: {
    opacity: 0.8,
  },
});
