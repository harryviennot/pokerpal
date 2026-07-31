import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { explainRecommendation } from '@/components/coach/explain';
import { GlossaryLink } from '@/components/coach/GlossaryLink';
import { Text } from '@/components/ui/Text';
import { useCoachLanguage } from '@/hooks/useCoachLanguage';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';

import { type GuidedRead } from './useGuidedAdvice';

export interface GuideCardProps {
  guide: GuidedRead;
}

/**
 * The coach, talking before the decision instead of after it.
 *
 * Collapsed to the move and one line of why, because it sits over the felt while
 * a player is trying to decide. Tapping opens the full reasoning — the same
 * reasoning the grade will use afterwards, since both come out of `rankLines`.
 *
 * The copy is careful not to overclaim. The EV model behind it is showdown-only
 * with no fold equity, which makes it honest about ranking lines and known to
 * under-rate a good bluff. So it says what the math likes, never what the only
 * right move is.
 */
export function GuideCard({ guide }: GuideCardProps) {
  const { colors } = useTheme();
  const language = useCoachLanguage();
  const [open, setOpen] = useState(false);

  if (guide.pending) {
    return (
      <View style={[styles.card, { backgroundColor: colors.frostBadge }]}>
        <Text variant="footnote" style={{ color: colors.onFrostBadge }}>
          Working it out…
        </Text>
      </View>
    );
  }

  if (!guide.recommendation) {
    return null;
  }

  const { headline, why } = explainRecommendation(guide.recommendation, { language });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`The coach would ${headline}. ${why.join(' ')}`}
      accessibilityHint={open ? 'Hides the reasoning' : 'Shows the reasoning'}
      onPress={() => setOpen((current) => !current)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.frostBadge },
        pressed && styles.pressed,
      ]}>
      <View style={styles.header}>
        <Text variant="footnote" style={[styles.caption, { color: colors.onFrostBadge }]}>
          THE COACH WOULD
        </Text>
        <Text variant="caption" style={[styles.more, { color: colors.onFrostBadge }]}>
          {open ? 'Less' : 'Why?'}
        </Text>
      </View>

      <Text variant="headline" style={{ color: colors.onFrostBadge }}>
        {headline}
      </Text>

      {/* One line collapsed, all of it open: a player deciding needs the short
          version, and a player learning needs the rest. */}
      {(open ? why : why.slice(0, 1)).map((line) => (
        <Text key={line} variant="footnote" style={{ color: colors.onFrostBadge }}>
          {line}
        </Text>
      ))}

      {open && (
        <View style={styles.footer}>
          <Text variant="caption" style={{ color: colors.onFrostBadge }}>
            What the math likes here, not the only playable move.{' '}
          </Text>
          <GlossaryLink term="equity" variant="caption" style={{ color: colors.onFrostBadge }}>
            What do these words mean?
          </GlossaryLink>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  caption: {
    letterSpacing: 0.6,
    opacity: 0.75,
  },
  more: {
    fontWeight: '700',
    opacity: 0.9,
  },
  footer: {
    marginTop: spacing.xs / 2,
    opacity: 0.85,
  },
  pressed: {
    opacity: 0.8,
  },
});
