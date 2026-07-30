import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Section } from '@/components/ui/Section';
import { StatRow } from '@/components/ui/StatRow';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/theme';

import { ModeChoice } from './ModeChoice';
import { type GameSetup } from './tableSetup';
import { TableSetupForm } from './TableSetupForm';
import { useGameStore } from './useGameStore';

/**
 * The lobby: the game you are about to play, decided before you play it.
 *
 * The root of the Play tab and the only way onto the felt, so committing here
 * seats a table and opens the game rather than closing a sheet. The draft starts
 * from the store's last-used setup, which outlives the session, so the table you
 * like is one tap away.
 */
export function LobbyScreen() {
  const setup = useGameStore((state) => state.setup);
  const start = useGameStore((state) => state.start);
  // Two narrow selectors rather than one on `game`: this screen stays mounted
  // behind the felt, and subscribing to the game object would re-render the whole
  // lobby on every card the pump reveals.
  const live = useGameStore((state) => state.game !== null && state.game.sessionEnd === null);
  const handsPlayed = useGameStore((state) => state.game?.session.handsPlayed ?? 0);
  const [draft, setDraft] = useState<GameSetup>(setup);

  const change = (patch: Partial<GameSetup>): void =>
    setDraft((current) => ({ ...current, ...patch }));

  return (
    <Screen scroll>
      {live && (
        <Section title="Still playing">
          <StatRow label="Hands played" value={String(handsPlayed)} />
          <Button label="Back to your game" onPress={() => router.push('/game')} />
        </Section>
      )}

      <ModeChoice mode={draft.mode} onChange={(mode) => change({ mode })} />

      <TableSetupForm draft={draft} onChange={change} />

      <View style={styles.action}>
        <Button
          label={draft.mode === 'real' ? 'Start real game' : 'Start learning'}
          onPress={() => {
            start(draft);
            router.push('/game');
          }}
        />
        {live && (
          <Text variant="footnote" tone="secondaryLabel" style={styles.warning}>
            This ends the game you are in. Its hands stay in History.
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: {
    gap: spacing.sm,
  },
  warning: {
    textAlign: 'center',
  },
});
