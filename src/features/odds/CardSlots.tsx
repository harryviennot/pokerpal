import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';

import { PlayingCard } from '@/components/ui/PlayingCard';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/theme';

import { BOARD_SLOTS, HERO_SLOTS, type Slot, type SlotCards } from './useOddsStore';

export interface CardSlotsProps {
  cards: SlotCards;
  focusedSlot: Slot;
  onFocus: (slot: Slot) => void;
  onClear: (slot: Slot) => void;
}

const SLOT_NAMES: Record<Slot, string> = {
  hero1: 'First hole card',
  hero2: 'Second hole card',
  flop1: 'First flop card',
  flop2: 'Second flop card',
  flop3: 'Third flop card',
  turn: 'Turn card',
  river: 'River card',
};

/** Board slots that start a new street, so the row reads as flop | turn | river. */
const STREET_BREAKS: readonly Slot[] = ['turn', 'river'];

/** Hero's two cards and the five board positions, grouped by street. */
export function CardSlots({ cards, focusedSlot, onFocus, onClear }: CardSlotsProps) {
  const press = (slot: Slot): void => {
    void Haptics.selectionAsync();

    // Tapping a filled slot empties it, which is the fastest way to fix a
    // mistap: one tap to clear, then the picker is already aimed at that slot.
    if (cards[slot] !== undefined) {
      onClear(slot);

      return;
    }

    onFocus(slot);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.group}>
        <Text variant="caption" tone="secondaryLabel">
          Your hand
        </Text>
        <View style={styles.row}>
          {HERO_SLOTS.map((slot) => (
            <PlayingCard
              key={slot}
              card={cards[slot]}
              size="large"
              focused={focusedSlot === slot}
              onPress={() => press(slot)}
              accessibilityLabel={cards[slot] === undefined ? SLOT_NAMES[slot] : undefined}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <Text variant="caption" tone="secondaryLabel">
          Board
        </Text>
        <View style={styles.row}>
          {BOARD_SLOTS.map((slot) => (
            <View key={slot} style={STREET_BREAKS.includes(slot) ? styles.gap : null}>
              <PlayingCard
                card={cards[slot]}
                focused={focusedSlot === slot}
                onPress={() => press(slot)}
                accessibilityLabel={cards[slot] === undefined ? SLOT_NAMES[slot] : undefined}
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.base,
  },
  group: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gap: {
    marginLeft: spacing.sm,
  },
});
