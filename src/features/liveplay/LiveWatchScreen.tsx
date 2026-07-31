import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CardPicker } from '@/components/cards/CardPicker';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { type Card } from '@/engine';
import { spacing } from '@/theme';

import { AdviceHud } from './AdviceHud';
import { BoardStrip } from './BoardStrip';
import { DemoFeedPanel } from './DemoFeedPanel';
import { EquityReadout } from './EquityReadout';
import { DEFAULT_FUSION } from './fusion';
import { LiveTopBar } from './LiveTopBar';
import { PotEntryPanel } from './PotEntryPanel';
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
  const fusion = useLivePlayStore((state) => state.fusion);
  const potEntry = useLivePlayStore((state) => state.potEntry);
  const opponents = useLivePlayStore((state) => state.opponents);
  const handsObserved = useLivePlayStore((state) => state.handsObserved);
  const handEnded = useLivePlayStore((state) => state.handEnded);
  const saveStatus = useLivePlayStore((state) => state.saveStatus);

  const confirmCandidate = useLivePlayStore((state) => state.confirmCandidate);
  const rejectCandidate = useLivePlayStore((state) => state.rejectCandidate);
  const correctBoardCard = useLivePlayStore((state) => state.correctBoardCard);
  const setPotEntry = useLivePlayStore((state) => state.setPotEntry);
  const endHand = useLivePlayStore((state) => state.endHand);
  const startNextHand = useLivePlayStore((state) => state.startNextHand);

  const hud = useLiveHud();
  const advice = useLiveAdvice(hud.observation);
  const [correcting, setCorrecting] = useState<number | null>(null);

  const correct = (card: Card): void => {
    if (correcting !== null) {
      correctBoardCard(correcting, card);
      setCorrecting(null);
    }
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

      <DemoFeedPanel />

      <View style={styles.readouts}>
        <BoardStrip
          board={hud.board}
          candidates={candidates}
          lockHits={DEFAULT_FUSION.lockHits}
          onCorrect={setCorrecting}
          onConfirm={confirmCandidate}
          onReject={rejectCandidate}
        />

        {correcting !== null ? (
          <View style={styles.correction}>
            <Text variant="subheadline" tone="secondaryLabel">
              What is that card really?
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
