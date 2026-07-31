import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

/**
 * A stack above the tabs, so the game can cover them.
 *
 * The tab bar belongs to `(tabs)`, which is one screen of this stack; pushing
 * `game` puts a native view controller over that whole screen, tab bar
 * included. A game the player can tab away from mid-decision is a game they
 * lose. Headers are off here because every child layout owns its own chrome.
 */
export default function RootLayout() {
  const scheme = useColorScheme();

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="game" />
        {/* At the root rather than inside a tab or the game, because every
            coaching surface links to it and it has to be able to open over the
            felt as readily as over History. */}
        <Stack.Screen
          name="glossary"
          options={{
            title: 'What the words mean',
            headerShown: true,
            presentation: 'formSheet',
            sheetAllowedDetents: [0.6, 1],
            sheetGrabberVisible: true,
          }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
