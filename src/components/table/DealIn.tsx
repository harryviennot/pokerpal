import { useEffect, type ReactNode } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useMotionPrefs } from '@/hooks/useMotionPrefs';
import { springs } from '@/theme';

export interface DealInProps {
  /** `slide` drops a board card into place; `scale` pops hole cards up. */
  variant?: 'slide' | 'scale';
  children: ReactNode;
}

/** How far a board card travels as it lands, in points. */
const DROP = 8;

/**
 * Springs its child in when it mounts. Keyed by card at the call site, so a
 * newly dealt card animates once and a re-render never replays it. Instant
 * under reduced motion.
 */
export function DealIn({ variant = 'slide', children }: DealInProps) {
  const { reduceMotion } = useMotionPrefs();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(1, springs.deal);
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform:
      variant === 'slide'
        ? [{ translateY: DROP * (1 - progress.value) }]
        : [{ scale: 0.9 + 0.1 * progress.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
