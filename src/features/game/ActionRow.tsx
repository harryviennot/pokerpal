import { StyleSheet, View } from 'react-native';

import { type Action, type LegalAction } from '@/engine';
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
  onAct: (action: Action) => void;
}

/**
 * The hero's committing buttons: `Fold | Call | Raise`, or `Check | Bet`.
 *
 * Every button here exists because `legalActions` said so — there is no second
 * opinion about the rules anywhere in the UI, which is what makes an illegal tap
 * unrepresentable rather than merely rejected. Red, because everything on this row
 * costs chips or gives up a hand.
 *
 * Each action owns a fixed third of the row; an action the engine did not offer
 * leaves its slot empty rather than letting the others widen. Muscle memory can
 * trust the geography — a tap where Fold usually sits never lands on Check.
 */
export function ActionRow({ legal, betTo, stack, onAct }: ActionRowProps) {
  const fold = legal.some((action) => action.type === 'fold');
  const check = legal.some((action) => action.type === 'check');
  const call = legal.find((action) => action.type === 'call');
  const raise = legal.find(isRaise);
  const commit = (action: Action) => (): void => onAct(action);

  return (
    <View style={styles.row}>
      <View style={styles.slot}>
        {fold && (
          <ConsoleButton
            headline="Fold"
            tone="commit"
            haptic="commit"
            onPress={commit({ type: 'fold' })}
            style={styles.button}
            isActionRow
          />
        )}
      </View>
      <View style={styles.slot}>
        {check && (
          <ConsoleButton
            headline="Check"
            tone="commit"
            haptic="commit"
            onPress={commit({ type: 'check' })}
            style={styles.button}
            isActionRow
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
            onPress={commit({ type: 'call' })}
            style={styles.button}
            isActionRow
          />
        )}
      </View>
      <View style={styles.slot}>
        {raise && (
          <ConsoleButton
            headline={raise.type === 'bet' ? 'Bet' : 'Raise'}
            caption={betTo >= raise.max ? 'All-in' : formatChips(betTo)}
            tone="commit"
            haptic="commit"
            onPress={commit({ type: raise.type, to: betTo })}
            style={styles.button}
            isActionRow
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  slot: {
    flex: 1,
  },
  button: {
    height: MIN_TOUCH_TARGET + spacing.sm,
  },
});
