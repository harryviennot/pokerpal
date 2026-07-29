import { Stack } from 'expo-router';

import { TableSetupLink } from '@/features/practice/TableSetupLink';

/**
 * An inline title, not a large one: the table does not scroll, so a large title
 * would never collapse and would only eat felt.
 */
export default function TableLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: 'Table', headerRight: () => <TableSetupLink /> }}
      />
      <Stack.Screen
        name="review"
        options={{
          title: 'Review',
          // A sheet, per HIG: the review is a secondary flow over the felt,
          // not a destination of its own.
          presentation: 'formSheet',
          sheetAllowedDetents: [0.6, 1],
          sheetGrabberVisible: true,
        }}
      />
      <Stack.Screen
        name="setup"
        options={{
          title: 'New table',
          presentation: 'formSheet',
          sheetAllowedDetents: [0.75, 1],
          sheetGrabberVisible: true,
        }}
      />
    </Stack>
  );
}
