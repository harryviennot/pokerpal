import { useEffect, type ReactNode } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { useMotionPrefs } from '@/hooks/useMotionPrefs';
import { springs } from '@/theme';

export interface CardFlipProps {
  /** Position in the row: later cards turn a beat after the ones before them. */
  index?: number;
  children: ReactNode;
}

/** How far a card is turned away before it lands, in degrees. */
const FROM = 96;

/** Distance to the camera. Without it a rotateY reads as a horizontal squash. */
const PERSPECTIVE = 700;

/** Gap between one card turning over and the next, in milliseconds. */
const STAGGER = 70;

/**
 * Turns its child face up as it mounts, a beat after the card before it.
 *
 * For board reveals: keyed by card at the call site, so the flop turns over once
 * and a re-render never replays it. Hole cards keep `DealIn` — they slide and fan
 * into the player's hand rather than turning over in place. Instant under
 * reduced motion, where a flip is exactly the kind of rotation that triggers
 * motion sickness.
 */
export function CardFlip({ index = 0, children }: CardFlipProps) {
  const { reduceMotion } = useMotionPrefs();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;

      return;
    }

    progress.value = withDelay(index * STAGGER, withSpring(1, springs.flip));
  }, [index, reduceMotion, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ perspective: PERSPECTIVE }, { rotateY: `${(1 - progress.value) * FROM}deg` }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
