import { Stack } from 'expo-router';

export default function LivePlayLayout() {
  return (
    <Stack screenOptions={{ headerLargeTitle: true }}>
      {/* The watching HUD owns its chrome; a navigation bar over the stage
          would fight the camera for the exact pixels the cards sit in. */}
      <Stack.Screen name="index" options={{ title: 'Live', headerShown: false }} />
    </Stack>
  );
}
