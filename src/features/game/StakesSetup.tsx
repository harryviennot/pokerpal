import { Picker } from '@expo/ui';

import { Section } from '@/components/ui/Section';
import { StatRow } from '@/components/ui/StatRow';
import { Text } from '@/components/ui/Text';
import { formatChips } from '@/utils/format';

import { LEVEL_LENGTH_MS } from './pacing';
import { SetupField } from './SetupField';
import {
  blindLadder,
  describeBlinds,
  STACK_OPTIONS,
  STAKE_OPTIONS,
  type GameSetup,
  type TableSetup,
} from './tableSetup';

/** How many rungs of the ladder to show. Enough to see where it is going. */
const LADDER_PREVIEW = 3;

const LEVEL_MINUTES = Math.round(LEVEL_LENGTH_MS / 60_000);

export interface StakesSetupProps {
  draft: GameSetup;
  onChange: (change: Partial<TableSetup>) => void;
}

/**
 * What the table plays for: the blinds, the stack, and how deep that is.
 *
 * The chosen stake means something different in each mode — a learning session
 * stays on it, a real one starts there and climbs — so the ladder it becomes is
 * shown rather than left to be discovered mid-session.
 */
export function StakesSetup({ draft, onChange }: StakesSetupProps) {
  const ladder = blindLadder(draft.blinds)
    .slice(0, LADDER_PREVIEW)
    .map(describeBlinds)
    .join('  →  ');

  return (
    <Section title="Stakes">
      <SetupField label="Blinds">
        <Picker
          selectedValue={describeBlinds(draft.blinds)}
          onValueChange={(value) =>
            onChange({
              blinds:
                STAKE_OPTIONS.find((option) => describeBlinds(option) === value) ?? draft.blinds,
            })
          }>
          {STAKE_OPTIONS.map((option) => (
            <Picker.Item
              key={describeBlinds(option)}
              label={describeBlinds(option)}
              value={describeBlinds(option)}
            />
          ))}
        </Picker>
      </SetupField>

      <SetupField label="Starting stack">
        <Picker
          selectedValue={draft.startingStack}
          onValueChange={(value) => onChange({ startingStack: Number(value) })}>
          {STACK_OPTIONS.map((stack) => (
            <Picker.Item key={stack} label={formatChips(stack)} value={stack} />
          ))}
        </Picker>
      </SetupField>

      <StatRow
        label="Deep"
        value={`${Math.round(draft.startingStack / draft.blinds.bigBlind)} big blinds`}
      />

      {draft.mode === 'real' && (
        <Text variant="footnote" tone="secondaryLabel">
          {`Those are the opening blinds. They climb every ${LEVEL_MINUTES} minutes: ${ladder} …`}
        </Text>
      )}
    </Section>
  );
}
