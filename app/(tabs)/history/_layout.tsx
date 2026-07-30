import { Stack } from 'expo-router';

export default function HistoryLayout() {
  return (
    <Stack screenOptions={{ headerLargeTitle: true }}>
      <Stack.Screen name="index" options={{ title: 'History' }} />
      {/* A detail screen, so an inline title: a large one belongs on the list it
          collapses into, not over the felt. */}
      <Stack.Screen name="[id]" options={{ title: 'Hand', headerLargeTitle: false }} />
    </Stack>
  );
}
