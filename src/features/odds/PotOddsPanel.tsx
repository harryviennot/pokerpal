import { StyleSheet, TextInput, View } from 'react-native';

import { StatRow } from '@/components/ui/StatRow';
import { Text } from '@/components/ui/Text';
import { analyzePotOdds, type CallVerdict } from '@/engine';
import { useTheme } from '@/hooks/useTheme';
import { MIN_TOUCH_TARGET, radius, spacing, typography } from '@/theme';
import { formatChips, formatPercent } from '@/utils/format';

export interface PotOddsPanelProps {
  pot: string;
  bet: string;
  onPotChange: (value: string) => void;
  onBetChange: (value: string) => void;
  /** Null until hero's equity is known. */
  heroEquity: number | null;
}

const VERDICT_COPY: Record<CallVerdict, string> = {
  profitable: 'Calling is profitable',
  marginal: 'Too close to call',
  unprofitable: 'Calling loses money',
};

const VERDICT_TONE = {
  profitable: 'success',
  marginal: 'warning',
  unprofitable: 'danger',
} as const;

/** Enter the pot and the bet facing hero; compare the price to hero's equity. */
export function PotOddsPanel({
  pot,
  bet,
  onPotChange,
  onBetChange,
  heroEquity,
}: PotOddsPanelProps) {
  const potValue = Number.parseFloat(pot);
  const betValue = Number.parseFloat(bet);
  const hasInputs = Number.isFinite(potValue) && Number.isFinite(betValue) && betValue > 0;

  const analysis =
    hasInputs && heroEquity !== null ? safeAnalyze(potValue, betValue, heroEquity) : null;
  const requiredOnly = hasInputs && heroEquity === null ? safeAnalyze(potValue, betValue, 0) : null;

  return (
    <View style={styles.wrapper}>
      <View style={styles.inputs}>
        <NumberField label="Pot" value={pot} onChange={onPotChange} placeholder="100" />
        <NumberField label="To call" value={bet} onChange={onBetChange} placeholder="25" />
      </View>

      {!hasInputs && (
        <Text variant="footnote" tone="secondaryLabel">
          Enter the pot and the bet facing you to see the price you are getting.
        </Text>
      )}

      {(analysis ?? requiredOnly) && (
        <View style={styles.readout}>
          <StatRow
            label="Equity needed"
            value={formatPercent((analysis ?? requiredOnly)!.requiredEquity)}
          />
          {analysis && (
            <>
              <StatRow label="Your equity" value={formatPercent(heroEquity as number)} />
              <StatRow
                label="Expected value"
                value={`${analysis.expectedValue >= 0 ? '+' : ''}${formatChips(analysis.expectedValue)}`}
              />
            </>
          )}
        </View>
      )}

      {analysis && (
        <Text variant="headline" tone={VERDICT_TONE[analysis.verdict]}>
          {VERDICT_COPY[analysis.verdict]}
        </Text>
      )}
    </View>
  );
}

function safeAnalyze(pot: number, bet: number, equity: number) {
  try {
    return analyzePotOdds(pot, bet, equity);
  } catch {
    // Negative or malformed numbers reach here; the empty state below is a
    // friendlier answer than surfacing a thrown message.
    return null;
  }
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.field}>
      <Text variant="caption" tone="secondaryLabel">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.tertiaryLabel}
        keyboardType="decimal-pad"
        inputMode="decimal"
        returnKeyType="done"
        style={[
          styles.input,
          typography.body,
          {
            color: colors.label,
            backgroundColor: colors.tertiaryBackground,
            borderRadius: radius.sm,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.md,
  },
  inputs: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  field: {
    flex: 1,
    gap: spacing.xs,
  },
  input: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
  },
  readout: {
    gap: spacing.sm,
  },
});
