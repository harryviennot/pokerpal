import { StyleSheet, View } from 'react-native';

import { MIN_TOUCH_TARGET, spacing } from '@/theme';

import { ConsoleButton, type ConsoleTone } from './ConsoleButton';
import { type Preselect } from './types';

export interface PreselectRowProps {
  /** True when there is a price on screen: the choice is fold or call, not check. */
  facingBet: boolean;
  /** Chips the call would cost, so a call for the last of them can say so. */
  toCall: number;
  /** What the hero has behind, for the same reason. */
  stack: number;
  preselect: Preselect | null;
  onPreselect: (preselect: Preselect | null) => void;
}

/**
 * The console while somebody else is on the clock: an action armed in advance.
 *
 * Grey, because nothing here spends a chip yet, and only two choices, because a
 * third would be a decision rather than a shortcut. Which two depends on what
 * the player can *see* — a fold and a check when the pot is unraised, a fold and
 * a call when there is money in front of them — never on what the engine already
 * knows, which would give away a bet still being dealt.
 *
 * The buttons keep the committing row's geography: fold in the left third, the
 * passive action in the middle, the raise third empty. The fold button reads
 * "Fold" even while a check is still free — arming it never folds a hand that
 * could check, which `resolvePreselect` guarantees.
 *
 * Tapping an armed button disarms it: there is no third control for cancelling.
 */
export function PreselectRow({
  facingBet,
  toCall,
  stack,
  preselect,
  onPreselect,
}: PreselectRowProps) {
  const arm = (next: Preselect) => (): void => onPreselect(preselect === next ? null : next);
  const tone = (armed: boolean): ConsoleTone => (armed ? 'armed' : 'quiet');

  return (
    <View style={styles.row}>
      <View style={styles.slot}>
        <ConsoleButton
          headline="Fold"
          tone={tone(preselect === 'checkFold')}
          onPress={arm('checkFold')}
          style={styles.button}
        />
      </View>
      <View style={styles.slot}>
        {facingBet ? (
          <ConsoleButton
            headline="Call"
            // The reference says "All-in" rather than the number when a call is
            // for everything: the amount is the least interesting part of it.
            caption={toCall >= stack ? 'All-in' : 'any'}
            tone={tone(preselect === 'callAny')}
            onPress={arm('callAny')}
            style={styles.button}
          />
        ) : (
          <ConsoleButton
            headline="Check"
            tone={tone(preselect === 'check')}
            onPress={arm('check')}
            style={styles.button}
          />
        )}
      </View>
      <View style={styles.slot} />
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
