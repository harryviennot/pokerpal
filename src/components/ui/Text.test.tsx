import { render, screen } from '@testing-library/react-native';

import { colors, typography } from '@/theme';

import { Text } from './Text';

describe('Text', () => {
  it('renders body type in the label tone by default', async () => {
    await render(<Text>Pot odds</Text>);

    expect(screen.getByText('Pot odds')).toHaveStyle({
      fontSize: typography.body.fontSize,
      color: colors.light.label,
    });
  });

  it('applies the requested variant and tone', async () => {
    await render(
      <Text variant="largeTitle" tone="danger">
        Blunder
      </Text>,
    );

    expect(screen.getByText('Blunder')).toHaveStyle({
      fontSize: typography.largeTitle.fontSize,
      color: colors.light.danger,
    });
  });

  it('opts into tabular figures so updating numbers do not shift layout', async () => {
    await render(<Text tabular>81.9%</Text>);

    expect(screen.getByText('81.9%')).toHaveStyle({ fontVariant: ['tabular-nums'] });
  });
});
