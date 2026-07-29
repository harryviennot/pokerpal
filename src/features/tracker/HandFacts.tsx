import { Section } from '@/components/ui/Section';
import { StatRow } from '@/components/ui/StatRow';
import { type StoredHand } from '@/services/handHistory';
import { formatChips, formatWhen } from '@/utils/format';

export interface HandFactsProps {
  hand: StoredHand;
}

/** What the hand was worth, and the table it was played on. */
export function HandFacts({ hand }: HandFactsProps) {
  const { blinds } = hand;
  const stakes = `${formatChips(blinds.smallBlind)} / ${formatChips(blinds.bigBlind)}`;

  return (
    <Section title="Hand">
      <StatRow
        label="Net"
        value={`${hand.heroNet > 0 ? '+' : ''}${formatChips(hand.heroNet)}`}
        tone={hand.heroNet > 0 ? 'success' : hand.heroNet < 0 ? 'danger' : 'label'}
      />
      <StatRow label="Played" value={formatWhen(hand.playedAt)} />
      <StatRow label="Blinds" value={blinds.ante ? `${stakes} (${blinds.ante} ante)` : stakes} />
      <StatRow label="Decisions graded" value={String(hand.decisionsGraded)} />
      {hand.evLost >= 1 && (
        <StatRow label="Given up" value={`−${formatChips(hand.evLost)}`} tone="danger" />
      )}
    </Section>
  );
}
