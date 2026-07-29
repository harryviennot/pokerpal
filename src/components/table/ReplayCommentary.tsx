import { StyleSheet, View } from 'react-native';

import { STREET_LABELS } from '@/components/coach/coachCopy';
import { Text } from '@/components/ui/Text';
import { type ReplayFrame } from '@/engine';

export interface ReplayCommentaryProps {
  frame: ReplayFrame;
  /** Zero-based position in the log; the counter adds the one. */
  index: number;
  total: number;
}

/** Where the hand is, and what just happened — one line of each. */
export function ReplayCommentary({ frame, index, total }: ReplayCommentaryProps) {
  return (
    <View style={styles.commentary}>
      <Text variant="footnote" tone="secondaryLabel">
        {STREET_LABELS[frame.snapshot.street]} · {index + 1} of {total}
      </Text>
      <Text variant="body" numberOfLines={2}>
        {frame.description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  commentary: {
    // A fixed two-line block: the felt above must not jump as the text changes.
    minHeight: 62,
    gap: 2,
  },
});
