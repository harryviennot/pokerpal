import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { StepperRow } from './StepperRow';
import { useLivePlayStore } from './useLivePlayStore';

/**
 * The two things the camera cannot read: how many players are still in, and
 * how deep the hero is sitting. Small, always reachable, never a gate.
 */
export function TableFactsRow() {
  const opponents = useLivePlayStore((state) => state.opponents);
  const heroStackBb = useLivePlayStore((state) => state.heroStackBb);
  const setOpponents = useLivePlayStore((state) => state.setOpponents);
  const setHeroStackBb = useLivePlayStore((state) => state.setHeroStackBb);

  return (
    <View style={styles.panel}>
      <StepperRow
        label="Opponents"
        value={opponents}
        onDecrease={() => setOpponents(opponents - 1)}
        onIncrease={() => setOpponents(opponents + 1)}
      />
      <StepperRow
        label="Your stack"
        value={heroStackBb}
        display={`${heroStackBb} bb`}
        onDecrease={() => setHeroStackBb(heroStackBb - 25)}
        onIncrease={() => setHeroStackBb(heroStackBb + 25)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.sm,
  },
});
