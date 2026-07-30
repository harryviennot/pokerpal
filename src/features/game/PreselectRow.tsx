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
 * the player can *see* — a check-fold pair when the pot is unraised, a fold and
 * a call when there is money in front of them — never on what the engine already
 * knows, which would give away a bet still being dealt.
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
      {facingBet ? (
        <>
          <ConsoleButton
            headline="Fold"
            tone={tone(preselect === 'checkFold')}
            onPress={arm('checkFold')}
            style={styles.button}
          />
          <ConsoleButton
            headline="Call"
            // The reference says "All-in" rather than the number when a call is
            // for everything: the amount is the least interesting part of it.
            caption={toCall >= stack ? 'All-in' : 'any'}
            tone={tone(preselect === 'callAny')}
            onPress={arm('callAny')}
            style={styles.button}
          />
        </>
      ) : (
        <>
          <ConsoleButton
            headline="Check/Fold"
            tone={tone(preselect === 'checkFold')}
            onPress={arm('checkFold')}
            style={styles.button}
          />
          <ConsoleButton
            headline="Check"
            tone={tone(preselect === 'check')}
            onPress={arm('check')}
            style={styles.button}
          />
        </>
      )}
    </View>
  );
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
