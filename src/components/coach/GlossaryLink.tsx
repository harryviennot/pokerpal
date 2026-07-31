import { router } from 'expo-router';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { Text, type TextProps } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/theme';

import { GLOSSARY, type GlossaryTermId } from './glossary';

const PRESS_SLOP = {
  top: spacing.sm,
  bottom: spacing.sm,
  left: spacing.sm,
  right: spacing.sm,
} as const;

export interface GlossaryLinkProps extends Pick<TextProps, 'variant' | 'tone'> {
  term: GlossaryTermId;
  /** What to render. Defaults to the term's own name. */
  children?: string;
  style?: StyleProp<TextStyle>;
}

/**
 * A word that explains itself.
 *
 * Underlined rather than tinted: these appear inside sentences and in grade
 * labels that already carry a tone colour, and re-colouring them would either
 * fight the verdict's own colour or hide the link entirely.
 *
 * Text rather than a `Pressable` so it flows inline with the sentence around it.
 * `hitSlop` buys back the touch target a line of body text does not have on its
 * own, per the HIG's 44pt minimum.
 */
export function GlossaryLink({ term, children, variant, tone, style }: GlossaryLinkProps) {
  const { colors } = useTheme();
  const entry = GLOSSARY[term];

  return (
    <Text
      accessibilityRole="link"
      accessibilityLabel={`${children ?? entry.term}. ${entry.short}`}
      accessibilityHint="Opens the glossary"
      variant={variant}
      tone={tone}
      // Buys back some of the touch target a line of body text does not have on
      // its own. `Text` has no `hitSlop`, so this is what there is.
      pressRetentionOffset={PRESS_SLOP}
      suppressHighlighting={false}
      onPress={() => router.push({ pathname: '/glossary', params: { term } })}
      style={[styles.link, { textDecorationColor: colors.tertiaryLabel }, style]}>
      {children ?? entry.term}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    textDecorationLine: 'underline',
    // Dotted, so a defined word reads as "there is more here" rather than as a
    // navigation link the player is being pushed towards.
    textDecorationStyle: 'dotted',
  },
});
