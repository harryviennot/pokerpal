import { StyleSheet, View } from 'react-native';

import { type Action, type ActionType, type LegalAction } from '@/engine';
import { MIN_TOUCH_TARGET, spacing } from '@/theme';
import { formatChips } from '@/utils/format';

import { isRaise } from './betPresets';
import { ConsoleButton } from './ConsoleButton';

export interface ActionRowProps {
  /** Straight from `legalActions`. A button the engine did not offer is not drawn. */
  legal: readonly LegalAction[];
  /** The total the raise button will commit to, from the sizer above it. */
  betTo: number;
  /** What the hero has behind, so a call for the last of it can say so. */
  stack: number;
  /** The move the guide is pointing at, ringed. Null when nothing is being suggested. */
  recommended?: ActionType | null;
  onAct: (action: Action) => void;
}

/**
 * The hero's committing buttons: `Fold | Call | Raise`, or `Check | Bet`.
 *
 * Every button here exists because `legalActions` said so — there is no second
 * opinion about the rules anywhere in the UI, which is what makes an illegal tap
 * unrepresentable rather than merely rejected. Red, because everything on this row
 * costs chips or gives up a hand.
 */
export function ActionRow({ legal, betTo, stack, recommended = null, onAct }: ActionRowProps) {
  const fold = legal.some((action) => action.type === 'fold');
  const check = legal.some((action) => action.type === 'check');
  const call = legal.find((action) => action.type === 'call');
  const raise = legal.find(isRaise);
  const commit = (action: Action) => (): void => onAct(action);
  // A bet and a raise are the same suggestion: the coach's EV model has no
  // opinion about which the rules happen to call for here.
  const suggests = (type: ActionType): boolean =>
    recommended === type || (recommended !== null && aggressive(recommended) && aggressive(type));

  return (
    <View style={styles.row}>
      {fold && (
        <ConsoleButton
          headline="Fold"
          tone="commit"
          haptic="commit"
          recommended={suggests('fold')}
          onPress={commit({ type: 'fold' })}
          style={styles.button}
        />
      )}
      {check && (
        <ConsoleButton
          headline="Check"
          tone="commit"
          haptic="commit"
          recommended={suggests('check')}
          onPress={commit({ type: 'check' })}
          style={styles.button}
        />
      )}
      {call && (
        <ConsoleButton
          headline="Call"
          // The reference says "All-in" rather than the number when a call is for
          // everything: the amount is the least interesting part of it.
          caption={call.amount >= stack ? 'All-in' : formatChips(call.amount)}
          tone="commit"
          haptic="commit"
          recommended={suggests('call')}
          onPress={commit({ type: 'call' })}
          style={styles.button}
        />
      )}
      {raise && (
        <ConsoleButton
          headline={raise.type === 'bet' ? 'Bet' : 'Raise'}
          caption={betTo >= raise.max ? 'All-in' : formatChips(betTo)}
          tone="commit"
          haptic="commit"
          recommended={suggests(raise.type)}
          onPress={commit({ type: raise.type, to: betTo })}
          style={styles.button}
        />
      )}
    </View>
  );
}

/** Bet and raise are one move as far as the coach is concerned. */
function aggressive(type: ActionType): boolean {
  return type === 'bet' || type === 'raise';
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    height: MIN_TOUCH_TARGET + spacing.sm,
  },
});
