import { Host, Picker, Switch } from '@expo/ui';
import { StyleSheet } from 'react-native';

import { Section } from '@/components/ui/Section';
import { StatRow } from '@/components/ui/StatRow';
import { Text } from '@/components/ui/Text';

import { PICKER_HEIGHT, SetupField } from './SetupField';
import { StakesSetup } from './StakesSetup';
import {
  MAX_OPPONENTS,
  MIN_OPPONENTS,
  MIXES,
  seatsFor,
  type GameSetup,
  type TableMixId,
  type TableSetup,
} from './tableSetup';

export interface TableSetupFormProps {
  draft: GameSetup;
  onChange: (change: Partial<TableSetup>) => void;
}

/**
 * The table: how many opponents, who they are, what they play for, and who ends
 * up in which seat.
 *
 * Every field here has been in `SessionConfig` since the rules engine landed —
 * this is the vocabulary for saying which. Mode-dependent, because two of these
 * choices mean something different in a real game, and a setting that is quietly
 * ignored is worse than one that was never offered.
 */
export function TableSetupForm({ draft, onChange }: TableSetupFormProps) {
  const mix = MIXES.find((entry) => entry.id === draft.mix);

  return (
    <>
      <Section title="Opponents">
        <SetupField label="How many">
          <Picker
            selectedValue={draft.opponents}
            onValueChange={(value) => onChange({ opponents: Number(value) })}>
            {counts().map((count) => (
              <Picker.Item key={count} label={String(count)} value={count} />
            ))}
          </Picker>
        </SetupField>

        <SetupField label="Who">
          <Picker
            selectedValue={draft.mix}
            onValueChange={(value) => onChange({ mix: value as TableMixId })}>
            {MIXES.map((entry) => (
              <Picker.Item key={entry.id} label={entry.label} value={entry.id} />
            ))}
          </Picker>
        </SetupField>

        {mix && (
          <Text variant="footnote" tone="secondaryLabel">
            {mix.describe}
          </Text>
        )}
      </Section>

      <StakesSetup draft={draft} onChange={onChange} />

      <Section title="Style">
        <SetupField label="Game">
          <Picker
            selectedValue={draft.style}
            onValueChange={(value) =>
              onChange({ style: value === 'sitAndGo' ? 'sitAndGo' : 'cash' })
            }>
            <Picker.Item label="Cash game" value="cash" />
            <Picker.Item label="Sit and go" value="sitAndGo" />
          </Picker>
        </SetupField>

        <Rebuys draft={draft} onChange={onChange} />
      </Section>

      <Section title="The table">
        {seatsFor(draft)
          .slice(1)
          .map((seat) => (
            <StatRow key={seat.id} label={seat.id} value={seat.profile?.name ?? ''} />
          ))}
      </Section>
    </>
  );
}

/** Whether busted seats buy back in — which only a learning cash game asks. */
function Rebuys({ draft, onChange }: TableSetupFormProps) {
  if (draft.mode === 'real') {
    return (
      <Text variant="footnote" tone="secondaryLabel">
        Nobody rebuys in a real game. Lose your stack and the session is over.
      </Text>
    );
  }

  if (draft.style === 'sitAndGo') {
    return (
      <Text variant="footnote" tone="secondaryLabel">
        Nobody rebuys. The table plays until one player has every chip.
      </Text>
    );
  }

  return (
    <Host style={styles.switch}>
      <Switch
        value={draft.rebuys}
        label="Rebuy when someone busts"
        onValueChange={(value) => onChange({ rebuys: value })}
      />
    </Host>
  );
}

function counts(): readonly number[] {
  return Array.from({ length: MAX_OPPONENTS - MIN_OPPONENTS + 1 }, (_, i) => MIN_OPPONENTS + i);
}

const styles = StyleSheet.create({
  switch: {
    height: PICKER_HEIGHT,
  },
});
