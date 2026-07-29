import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { MIN_TOUCH_TARGET, radius, spacing } from '@/theme';

export interface ReplayControlsProps {
  atStart: boolean;
  atEnd: boolean;
  onStep: (delta: number) => void;
  onStepStreet: (delta: number) => void;
  onRestart: () => void;
}

/** Transport controls for a replay: a step either way, a street either way, a restart. */
export function ReplayControls({
  atStart,
  atEnd,
  onStep,
  onStepStreet,
  onRestart,
}: ReplayControlsProps) {
  return (
    <View style={styles.row}>
      {/* A text glyph, not ⏮ — the media symbols render as colour emoji. */}
      <ControlButton label="↺" hint="Restart the hand" onPress={onRestart} disabled={atStart} />
      <ControlButton
        label="‹‹"
        hint="Previous street"
        onPress={() => onStepStreet(-1)}
        disabled={atStart}
      />
      <ControlButton
        label="‹"
        hint="Previous action"
        onPress={() => onStep(-1)}
        disabled={atStart}
      />
      <ControlButton label="›" hint="Next action" onPress={() => onStep(1)} disabled={atEnd} grow />
      <ControlButton
        label="››"
        hint="Next street"
        onPress={() => onStepStreet(1)}
        disabled={atEnd}
      />
    </View>
  );
}

interface ControlButtonProps {
  label: string;
  hint: string;
  onPress: () => void;
  disabled: boolean;
  /** The primary control, which takes the space the others do not need. */
  grow?: boolean;
}

function ControlButton({ label, hint, onPress, disabled, grow = false }: ControlButtonProps) {
  const { colors } = useTheme();

  const press = (): void => {
    // Selection-weight only: stepping a replay is a browse, not a commitment.
    void Haptics.selectionAsync();
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={press}
      style={({ pressed }) => [
        styles.control,
        grow && styles.grow,
        { backgroundColor: grow ? colors.tint : colors.secondaryBackground },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <Text variant="headline" style={{ color: grow ? colors.cardFace : colors.label }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  control: {
    minWidth: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  grow: {
    flex: 1,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.6,
  },
});
