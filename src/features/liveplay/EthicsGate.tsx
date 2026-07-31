import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/theme';

export interface EthicsGateProps {
  onAccept: () => void;
}

/**
 * The intended-use screen PRD A4 requires before LivePlay's camera ever
 * mounts. Shown once; the acknowledgement is persisted by the caller.
 */
export function EthicsGate({ onAccept }: EthicsGateProps) {
  const accept = (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAccept();
  };

  return (
    <Screen>
      <View style={styles.body}>
        <Text variant="title1">Before you point the camera</Text>

        <Text variant="body">
          LivePlay is a training tool: for practice with physical cards, agreed learning games, and
          reviewing your play afterwards.
        </Text>

        <Text variant="body">
          Real-time assistance devices are banned in casinos. Using this mid-hand in any game
          without every player&apos;s agreement is cheating.
        </Text>

        <Text variant="subheadline" tone="secondaryLabel">
          Hands you watch are saved to your history so the Coach can review them later.
        </Text>
      </View>

      <Button label="I understand" onPress={accept} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
});
