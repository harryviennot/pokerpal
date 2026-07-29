import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/theme';

export interface EmptyStateProps {
  title: string;
  message: string;
  /** The one thing to do about it, when there is one. */
  action?: { label: string; onPress: () => void };
}

/** A screen with nothing on it: what happened, and what to do next. */
export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <Screen center>
      <Text variant="headline">{title}</Text>
      <Text variant="subheadline" tone="secondaryLabel" style={styles.message}>
        {message}
      </Text>
      {action && (
        <View style={styles.action}>
          <Button label={action.label} onPress={action.onPress} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: {
    textAlign: 'center',
  },
  action: {
    marginTop: spacing.sm,
  },
});
