import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { type Action, type LegalAction } from '@/engine';
import { useTheme } from '@/hooks/useTheme';
import { MIN_TOUCH_TARGET, radius, spacing } from '@/theme';
import { formatChips } from '@/utils/format';

export interface ActionBarProps {
  /** Straight from `legalActions`. An empty list means it is not the hero's turn. */
  legal: readonly LegalAction[];
  /** The amount the bet/raise button will commit to, from the sizer beside it. */
  betTo: number;
  onAct: (action: Action) => void;
}

/**
 * The hero's controls.
 *
 * Every button here exists because `legalActions` said so — there is no second
 * opinion about the rules in the UI. A button the engine did not offer is not
 * rendered, so no tap can ever be illegal.
 */
export function ActionBar({ legal, betTo, onAct }: ActionBarProps) {
  const fold = legal.find((action) => action.type === 'fold');
  const check = legal.find((action) => action.type === 'check');
  const call = legal.find((action) => action.type === 'call');
  const raise = legal.find((action) => action.type === 'bet' || action.type === 'raise');

  return (
    <View style={styles.row}>
      {fold && <ActionButton verb="Fold" onPress={() => onAct({ type: 'fold' })} />}
      {check && <ActionButton verb="Check" onPress={() => onAct({ type: 'check' })} />}
      {call && (
        <ActionButton
          verb="Call"
          amount={formatChips(call.amount)}
          onPress={() => onAct({ type: 'call' })}
        />
      )}
      {raise && (
        <ActionButton
          verb={raise.type === 'bet' ? 'Bet' : 'Raise to'}
          amount={formatChips(betTo)}
          primary
          onPress={() => onAct({ type: raise.type, to: betTo })}
        />
      )}
    </View>
  );
}

interface ActionButtonProps {
  /** The action word, bold on its own line. */
  verb: string;
  /** The chips under the verb. Also part of the accessible label. */
  amount?: string;
  /** The aggressive action gets the accent color. */
  primary?: boolean;
  onPress: () => void;
}

function ActionButton({ verb, amount, primary = false, onPress }: ActionButtonProps) {
  const { colors } = useTheme();
  const background = primary ? colors.tint : colors.seatPill;
  const foreground = primary ? colors.cardFace : colors.onSeatPill;

  const press = (): void => {
    // Committing chips is a decision, not a browse: medium weight, per the HIG.
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={amount === undefined ? verb : `${verb} ${amount}`}
      onPress={press}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background },
        pressed && styles.pressed,
      ]}>
      <Text variant="headline" numberOfLines={1} style={{ color: foreground }}>
        {verb}
      </Text>
      {amount !== undefined && (
        <Text
          variant="footnote"
          tabular
          numberOfLines={1}
          style={[styles.amount, { color: foreground }]}>
          {amount}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET + spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  amount: {
    opacity: 0.8,
  },
  pressed: {
    opacity: 0.6,
  },
});
