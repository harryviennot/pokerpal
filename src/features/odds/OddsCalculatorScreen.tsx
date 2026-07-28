import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';

/**
 * Pillar A: the odds calculator.
 *
 * Currently the empty state only — the card picker, equity readout and pot-odds
 * helper land once the engine exists.
 */
export function OddsCalculatorScreen() {
  return (
    <Screen scroll center>
      <Text variant="title3">No hand yet</Text>
      <Text variant="subheadline" tone="secondaryLabel" style={{ textAlign: 'center' }}>
        Pick your hole cards to see your equity.
      </Text>
    </Screen>
  );
}
