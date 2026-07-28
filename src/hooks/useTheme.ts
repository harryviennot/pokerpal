import { useColorScheme } from 'react-native';

import { colors, type ColorScheme, type ColorTokens } from '@/theme';

export interface Theme {
  scheme: ColorScheme;
  colors: ColorTokens;
}

/** Resolves the active color scheme to its token set. Defaults to light. */
export function useTheme(): Theme {
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return { scheme, colors: colors[scheme] };
}
