import { Host, Picker, Switch } from '@expo/ui';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Section } from '@/components/ui/Section';
import { StatRow } from '@/components/ui/StatRow';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/theme';
import { formatChips } from '@/utils/format';

import {
  describeBlinds,
  MAX_OPPONENTS,
  MIN_OPPONENTS,
  MIXES,
  seatsFor,
  STACK_OPTIONS,
  STAKE_OPTIONS,
  type TableMixId,
  type TableSetup,
} from './tableSetup';
import { usePracticeStore } from './usePracticeStore';

/** A picker is a native control; its host needs a height of its own. */
const PICKER_HEIGHT = 44;

/**
 * Choosing the table: how many opponents, who they are, and for what.
 *
 * Everything here has been in `SessionConfig` since the rules engine landed —
 * this is the vocabulary for saying which, and the one screen that can end a
 * session, so the button says exactly that.
 */
export function TableSetupScreen() {
  const current = usePracticeStore((state) => state.setup);
  const configure = usePracticeStore((state) => state.configure);
  const [draft, setDraft] = useState<TableSetup>(current);

  const change = <K extends keyof TableSetup>(key: K, value: TableSetup[K]): void =>
    setDraft((setup) => ({ ...setup, [key]: value }));

  const seats = seatsFor(draft);
  const mix = MIXES.find((entry) => entry.id === draft.mix);

  return (
    <Screen scroll>
      <Section title="Opponents">
        <Field label="How many">
          <Picker
            selectedValue={draft.opponents}
            onValueChange={(value) => change('opponents', Number(value))}>
            {counts().map((count) => (
              <Picker.Item key={count} label={String(count)} value={count} />
            ))}
          </Picker>
        </Field>

        <Field label="Who">
          <Picker
            selectedValue={draft.mix}
            onValueChange={(value) => change('mix', value as TableMixId)}>
            {MIXES.map((entry) => (
              <Picker.Item key={entry.id} label={entry.label} value={entry.id} />
            ))}
          </Picker>
        </Field>

        {mix && (
          <Text variant="footnote" tone="secondaryLabel">
            {mix.describe}
          </Text>
        )}
      </Section>

      <Section title="Stakes">
        <Field label="Blinds">
          <Picker
            selectedValue={describeBlinds(draft.blinds)}
            onValueChange={(value) =>
              change(
                'blinds',
                STAKE_OPTIONS.find((option) => describeBlinds(option) === value) ?? draft.blinds,
              )
            }>
            {STAKE_OPTIONS.map((option) => (
              <Picker.Item
                key={describeBlinds(option)}
                label={describeBlinds(option)}
                value={describeBlinds(option)}
              />
            ))}
          </Picker>
        </Field>

        <Field label="Starting stack">
          <Picker
            selectedValue={draft.startingStack}
            onValueChange={(value) => change('startingStack', Number(value))}>
            {STACK_OPTIONS.map((stack) => (
              <Picker.Item key={stack} label={formatChips(stack)} value={stack} />
            ))}
          </Picker>
        </Field>

        <StatRow
          label="Deep"
          value={`${Math.round(draft.startingStack / draft.blinds.bigBlind)} big blinds`}
        />
      </Section>

      <Section title="Style">
        <Field label="Game">
          <Picker
            selectedValue={draft.style}
            onValueChange={(value) => change('style', value === 'sitAndGo' ? 'sitAndGo' : 'cash')}>
            <Picker.Item label="Cash game" value="cash" />
            <Picker.Item label="Sit and go" value="sitAndGo" />
          </Picker>
        </Field>

        {draft.style === 'cash' ? (
          <Host style={styles.switch}>
            <Switch
              value={draft.rebuys}
              label="Rebuy when someone busts"
              onValueChange={(value) => change('rebuys', value)}
            />
          </Host>
        ) : (
          <Text variant="footnote" tone="secondaryLabel">
            Nobody rebuys. The table plays until one player has every chip.
          </Text>
        )}
      </Section>

      <Section title="The table">
        {seats.slice(1).map((seat) => (
          <StatRow key={seat.id} label={seat.id} value={seat.profile?.name ?? ''} />
        ))}
      </Section>

      <View style={styles.action}>
        <Button
          label="Start new table"
          onPress={() => {
            configure(draft);
            router.back();
          }}
        />
        <Text variant="footnote" tone="secondaryLabel" style={styles.warning}>
          This ends the session you are in. Its hands stay in History.
        </Text>
      </View>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text variant="subheadline" tone="secondaryLabel">
        {label}
      </Text>
      <Host style={styles.picker} matchContents>
        {children}
      </Host>
    </View>
  );
}

function counts(): readonly number[] {
  return Array.from({ length: MAX_OPPONENTS - MIN_OPPONENTS + 1 }, (_, i) => MIN_OPPONENTS + i);
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  picker: {
    minHeight: PICKER_HEIGHT,
  },
  switch: {
    height: PICKER_HEIGHT,
  },
  action: {
    gap: spacing.sm,
  },
  warning: {
    textAlign: 'center',
  },
});
