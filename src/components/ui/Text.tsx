import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { tabularNumbers, typography } from '@/theme';

type Variant = keyof typeof typography;
type Tone =
  'label' | 'secondaryLabel' | 'tertiaryLabel' | 'tint' | 'success' | 'danger' | 'warning';

export interface TextProps extends RNTextProps {
  variant?: Variant;
  tone?: Tone;
  /** Use tabular figures so in-place numeric updates do not shift layout. */
  tabular?: boolean;
}

/** Themed text. The only component that may reference typography tokens directly. */
export function Text({
  variant = 'body',
  tone = 'label',
  tabular = false,
  style,
  ...rest
}: TextProps) {
  const { colors } = useTheme();

  return (
    <RNText
      style={[typography[variant], { color: colors[tone] }, tabular && tabularNumbers, style]}
      {...rest}
    />
  );
}
