import { Stack } from 'expo-router';

/**
 * An inline title, not a large one: the table does not scroll, so a large title
 * would never collapse and would only eat felt.
 */
export default function TableLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Table' }} />
    </Stack>
  );
}
