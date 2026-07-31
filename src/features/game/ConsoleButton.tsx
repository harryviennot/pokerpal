import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing, type ColorTokens } from '@/theme';

/**
 * `commit` costs chips. `quiet` does not. `armed` is a preselect that is set, and
 * borrows the acting seat's inverted plate so the eye finds it without a caption.
 * `off` is shown-but-unavailable: the reference greys a size the rules will not
 * take rather than hiding it, so the player can see why it is not on offer.
 */
export type ConsoleTone = 'commit' | 'quiet' | 'armed' | 'off';

/** What a press is worth. Chips going in earn more than a browse; nothing is free. */
export type ConsoleHaptic = 'commit' | 'select' | 'none';

export interface ConsoleButtonProps {
  /** The bold top line: the verb, or the chips for a bet-size preset. */
  headline: string;
  /** The lighter line under it. Null when the headline is the whole button. */
  caption?: string | null;
  tone?: ConsoleTone;
  /** What a screen reader hears. Defaults to the two lines read together. */
  label?: string;
  haptic?: ConsoleHaptic;
  disabled?: boolean;
  onPress: () => void;
  /** The caller owns the footprint: an action button is taller than a preset. */
  style?: StyleProp<ViewStyle>;
  isActionRow?: boolean;
}

/**
 * One control on the action console: a verb over an amount, on a coloured slab.
 *
 * Every button the player taps on the felt is this one, which is what keeps the
 * console's four tones and its haptics in a single place. It holds no opinion
 * about the rules — what it says and whether it is available are both decided
 * above it, from `legalActions`.
 */
export function ConsoleButton({
  headline,
  caption = null,
  tone = 'quiet',
  label,
  haptic = 'select',
  disabled = false,
  onPress,
  style,
  isActionRow = false
}: ConsoleButtonProps) {
  const { colors } = useTheme();
  const skin = skinFor(tone, colors);

  const press = (): void => {
    if (haptic === 'commit') {
      // Committing chips is a decision, not a browse: medium weight, per the HIG.
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (haptic === 'select') {
      void Haptics.selectionAsync();
    }

    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? (caption === null ? headline : `${headline} ${caption}`)}
      disabled={disabled}
      onPress={press}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? skin.pressed : skin.backgroundBorder },
        isActionRow ? { padding : 2.5, paddingBottom: 6 } : { padding : 1.5, paddingBottom: 4 },
        style,
      ]}>
        <View style={[styles.buttonInside, { backgroundColor: skin.background, borderRadius: isActionRow ? radius.sm - 2.5 : radius.sm - 1.5}]}>
      <Text
        variant="headline"
        tabular
        numberOfLines={1}
        style={[styles.headline, skin.faded && styles.faded, { color: skin.ink }]}>
        {headline}
      </Text>
      {caption !== null && (
        <Text
          variant="footnote"
          tabular
          numberOfLines={1}
          style={[styles.caption, skin.faded && styles.faded, { color: skin.ink }]}>
          {caption}
        </Text>
      )}
      </View>
    </Pressable>
  );
}

interface Skin {
  background: string;
  backgroundBorder: string;
  pressed: string;
  ink: string;
  /** True where the ink itself has to read as unavailable, not just the slab. */
  faded: boolean;
}

function skinFor(tone: ConsoleTone, colors: ColorTokens): Skin {
  switch (tone) {
    case 'commit':
      return {
        background: colors.actionRed,
        backgroundBorder: colors.actionRedBorder,
        pressed: colors.actionRedPressed,
        ink: colors.onActionRed,
        faded: false,
      };
    case 'quiet':
      return {
        background: colors.consoleGray,
        backgroundBorder: colors.consoleGrayBorder,
        pressed: colors.consoleGrayPressed,
        ink: colors.onConsoleGray,
        faded: false,
      };
    case 'armed':
      return {
        background: colors.pillLight,
        backgroundBorder: colors.pillLightBorder,
        pressed: colors.pillLight,
        ink: colors.onPillLight,
        faded: false,
      };
    case 'off':
      return {
        background: colors.consoleDisabled,
        backgroundBorder: colors.consoleDisabledBorder,
        pressed: colors.consoleDisabled,
        ink: colors.onConsoleGray,
        faded: true,
      };
  }
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  buttonInside: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  headline: {
    fontWeight: '800',
  },
  caption: {
    opacity: 0.7,
    marginTop: -spacing.xs / 2,
  },
  faded: {
    opacity: 0.35,
  },
});
