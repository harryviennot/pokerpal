import { NativeTabs } from 'expo-router/unstable-native-tabs';

/**
 * The three places you can be when you are not in a hand.
 *
 * "Play" is the lobby, not the felt: the game itself lives above this
 * navigator so nothing can pull the player out of a hand mid-decision.
 */
export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="(calculator)">
        <NativeTabs.Trigger.Icon sf="percent" />
        <NativeTabs.Trigger.Label>Calculator</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="lobby">
        <NativeTabs.Trigger.Icon sf="suit.spade.fill" />
        <NativeTabs.Trigger.Label>Play</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Icon sf="clock" />
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
