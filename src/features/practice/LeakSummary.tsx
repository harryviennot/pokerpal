import { LEAK_LABELS } from '@/components/coach/coachCopy';
import { StatRow } from '@/components/ui/StatRow';
import { Text } from '@/components/ui/Text';
import { type LeakTally } from '@/engine';
import { formatChips } from '@/utils/format';

export interface LeakSummaryProps {
  /** Costliest first, at most three — `topLeaks` output. */
  leaks: readonly LeakTally[];
}

/** The habits the session showed, each priced in the chips it gave up. */
export function LeakSummary({ leaks }: LeakSummaryProps) {
  if (leaks.length === 0) {
    return (
      <Text variant="subheadline" tone="secondaryLabel">
        No leaks so far. Keep making the maths happy.
      </Text>
    );
  }

  return (
    <>
      {leaks.map((tally) => (
        <StatRow
          key={tally.leak}
          label={`${LEAK_LABELS[tally.leak]} ×${tally.count}`}
          value={`−${formatChips(tally.evLoss)}`}
          tone="danger"
        />
      ))}
    </>
  );
}
