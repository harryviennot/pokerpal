import { Stack } from 'expo-router';

/**
 * The game's own stack, chromeless by default.
 *
 * The felt is the whole screen: no header, and no back swipe on `index`, since
 * the edge of the screen is where the bet slider and the action buttons live
 * and a stray drag must never fold the hand. Leaving is a deliberate control on
 * the screen instead.
 */
export default function GameLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ gestureEnabled: false }} />
      <Stack.Screen
        name="review"
        options={{
          title: 'Review',
          headerShown: true,
          // A sheet, per HIG: the review is a secondary flow over the felt,
          // not a destination of its own.
          presentation: 'formSheet',
          sheetAllowedDetents: [0.6, 1],
          sheetGrabberVisible: true,
        }}
      />
      <Stack.Screen name="summary" />
      {/* A detail screen, so an inline title: a large one belongs on the list it
          collapses into, not over the felt. */}
      <Stack.Screen name="hand/[id]" options={{ title: 'Hand', headerShown: true }} />
    </Stack>
  );
}
