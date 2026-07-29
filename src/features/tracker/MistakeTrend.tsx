import { useMemo } from 'react';

import { Section } from '@/components/ui/Section';
import { Sparkbars, type Sparkbar } from '@/components/ui/Sparkbars';
import { StatRow } from '@/components/ui/StatRow';
import { Text } from '@/components/ui/Text';
import { MIN_POINTS, mistakeRate, summarizeTrend, type TrendDirection } from '@/engine';
import { type StoredSessionStat } from '@/services/handHistory';
import { formatWhen } from '@/utils/format';

export interface MistakeTrendProps {
  /** Newest first, as the repository lists them. */
  sessions: readonly StoredSessionStat[];
}

/** What each direction means, said plainly enough to act on. */
const DIRECTION_COPY: Record<TrendDirection, string> = {
  improving: 'Fewer mistakes per hundred decisions than when you started. Keep going.',
  worsening: 'More mistakes per hundred decisions than when you started.',
  steady: 'Holding steady. Same rate of mistakes as when you started.',
  unknown: `Play ${MIN_POINTS} sessions and this starts reading as a trend.`,
};

const DIRECTION_TONE = {
  improving: 'success',
  worsening: 'danger',
  steady: 'secondaryLabel',
  unknown: 'secondaryLabel',
} as const satisfies Record<TrendDirection, 'success' | 'danger' | 'secondaryLabel'>;

/**
 * The PRD's trend line: mistakes per hundred decisions, session by session.
 *
 * A rate and never a count, because an evening of poker must not read as an
 * evening of getting worse. The engine decides whether there is a direction to
 * report at all; this only puts words on it.
 */
export function MistakeTrend({ sessions }: MistakeTrendProps) {
  const trend = useMemo(
    () =>
      summarizeTrend(
        sessions.map((session) => ({
          key: session.sessionId,
          at: session.startedAt,
          handsPlayed: session.hands,
          decisionsGraded: session.decisionsGraded,
          mistakes: session.mistakes,
          evLost: session.evLost,
          net: session.net,
        })),
      ),
    [sessions],
  );

  const graded = trend.points.filter((point) => point.decisionsGraded > 0);

  if (graded.length === 0) {
    return null;
  }

  const bars: Sparkbar[] = graded.map((point, index) => {
    const rate = mistakeRate([point]);

    return {
      key: String(point.key),
      value: rate,
      label: index === 0 || index === graded.length - 1 ? formatWhen(point.at) : undefined,
      accessibilityLabel: `${formatWhen(point.at)}: ${rate.toFixed(1)} mistakes per hundred decisions over ${point.handsPlayed} hands`,
    };
  });

  return (
    <Section title="Mistake rate">
      <Sparkbars bars={bars} goodBelow={trend.rate} />
      <StatRow
        label="Per hundred decisions"
        value={trend.rate.toFixed(1)}
        tone={DIRECTION_TONE[trend.direction]}
      />
      <Text variant="footnote" tone="secondaryLabel">
        {DIRECTION_COPY[trend.direction]}
      </Text>
    </Section>
  );
}
