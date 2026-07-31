import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CardPicker } from '@/components/cards/CardPicker';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { type Card } from '@/engine';
import { spacing } from '@/theme';

import { AdviceHud } from './AdviceHud';
import { BoardStrip } from './BoardStrip';
import { EquityReadout } from './EquityReadout';
import { DEFAULT_FUSION } from './fusion';
import { HeroCardsRow } from './HeroCardsRow';
import { adviceReview } from './liveAdvice';
import { LiveCameraView } from './LiveCameraView';
import { LiveTopBar } from './LiveTopBar';
import { PotEntryPanel } from './PotEntryPanel';
import { TableFactsRow } from './TableFactsRow';
import { useLiveAdvice } from './useLiveAdvice';
import { useLiveHud } from './useLiveHud';
import { liveUsedCards, useLivePlayStore } from './useLivePlayStore';

/**
 * The watching state: the stage on top, the locked board and its candidates
 * under it, the numbers under that, and the recommendation when there is one.
 */
export function LiveWatchScreen() {
  const candidates = useLivePlayStore((state) => state.fusion.candidates);
  const heroCards = useLivePlayStore((state) => state.heroCards);
  const heroSource = useLivePlayStore((state) => state.heroSource);
  const heroPending = useLivePlayStore((state) => state.fusion.hero.candidates.length);
  const fusion = useLivePlayStore((state) => state.fusion);
  const potEntry = useLivePlayStore((state) => state.potEntry);
  const opponents = useLivePlayStore((state) => state.opponents);
  const handsObserved = useLivePlayStore((state) => state.handsObserved);
  const handEnded = useLivePlayStore((state) => state.handEnded);
  const saveStatus = useLivePlayStore((state) => state.saveStatus);

  const confirmCandidate = useLivePlayStore((state) => state.confirmCandidate);
  const rejectCandidate = useLivePlayStore((state) => state.rejectCandidate);
  const correctBoardCard = useLivePlayStore((state) => state.correctBoardCard);
  const correctHeroCard = useLivePlayStore((state) => state.correctHeroCard);
  const setHeroCards = useLivePlayStore((state) => state.setHeroCards);
  const setPotEntry = useLivePlayStore((state) => state.setPotEntry);
  const recordAdvice = useLivePlayStore((state) => state.recordAdvice);
  const endHand = useLivePlayStore((state) => state.endHand);
  const startNextHand = useLivePlayStore((state) => state.startNextHand);

  const hud = useLiveHud();
  const advice = useLiveAdvice(hud.observation);
  // Which slot the player is fixing: a board index, or one of their own two.
  const [correcting, setCorrecting] = useState<{ kind: 'board' | 'hero'; index: number } | null>(
    null,
  );
  // The first of two manually entered hole cards, held until the pair is whole.
  const [pendingHero, setPendingHero] = useState<Card | null>(null);

  // Every recommendation shown goes into the hand's record, so the archived
  // hand carries what the coach said at the time (PRD A4: session recording).
  useEffect(() => {
    if (advice) {
      recordAdvice(adviceReview(advice));
    }
  }, [advice, recordAdvice]);

  const correct = (card: Card): void => {
    if (correcting === null) {
      return;
    }

    if (correcting.kind === 'board') {
      correctBoardCard(correcting.index, card);
    } else if (heroCards) {
      correctHeroCard(correcting.index === 0 ? 0 : 1, card);
    } else {
      // Nothing read yet: the first tap starts the pair, the second completes
      // it. A half-entered hand is never written to the store.
      const other = pendingHero;

      if (other === null) {
        setPendingHero(card);

        return;
      }

      setHeroCards(correcting.index === 0 ? [card, other] : [other, card]);
      setPendingHero(null);
    }

    setCorrecting(null);
  };

  if (handEnded) {
    return (
      <Screen center>
        <View style={styles.handOver}>
          <Text variant="title2">Hand over</Text>
          <Text variant="subheadline" tone="secondaryLabel">
            The felt cleared, so this hand went to your history.
          </Text>
          <Button label="Next hand" onPress={startNextHand} />
          <TableFactsRow />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <LiveTopBar
        street={hud.street}
        handsObserved={handsObserved}
        saveTrouble={saveStatus === 'error'}
        onEndHand={endHand}
      />

      <LiveCameraView />

      <View style={styles.readouts}>
        <HeroCardsRow
          cards={heroCards}
          source={heroSource}
          pending={heroPending}
          onCorrect={(index) => setCorrecting({ kind: 'hero', index })}
        />

        <BoardStrip
          board={hud.board}
          candidates={candidates}
          lockHits={DEFAULT_FUSION.lockHits}
          onCorrect={(index) => setCorrecting({ kind: 'board', index })}
          onConfirm={confirmCandidate}
          onReject={rejectCandidate}
        />

        {correcting !== null ? (
          <View style={styles.correction}>
            <Text variant="subheadline" tone="secondaryLabel">
              {correcting.kind === 'hero' && heroCards === null
                ? pendingHero === null
                  ? 'Pick your first card.'
                  : 'Pick your second card.'
                : 'What is that card really?'}
            </Text>
            <CardPicker used={liveUsedCards({ heroCards, fusion })} onPick={correct} />
          </View>
        ) : (
          <>
            <EquityReadout
              equity={hud.equity}
              outCount={hud.outCount}
              drawName={hud.drawName}
              requiredEquity={hud.requiredEquity}
              opponents={opponents}
            />
            <PotEntryPanel entry={potEntry} onCommit={setPotEntry} />
            <AdviceHud advice={advice} />
            <TableFactsRow />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  readouts: {
    gap: spacing.base,
    paddingTop: spacing.base,
  },
  handOver: {
    alignItems: 'center',
    gap: spacing.base,
  },
  correction: {
    gap: spacing.sm,
  },
});
