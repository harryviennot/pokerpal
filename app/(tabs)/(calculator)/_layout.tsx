import { Stack } from 'expo-router';

export default function CalculatorLayout() {
  return (
    <Stack screenOptions={{ headerLargeTitle: true }}>
      <Stack.Screen name="index" options={{ title: 'Calculator' }} />
    </Stack>
  );
}
