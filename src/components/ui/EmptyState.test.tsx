import { cleanup, render, screen, userEvent } from '@testing-library/react-native';

import { EmptyState } from './EmptyState';

afterEach(async () => {
  await cleanup();
});

describe('EmptyState', () => {
  it('says what happened and offers nothing when there is nothing to do', async () => {
    await render(<EmptyState title="No hands yet" message="Play a hand and it lands here." />);

    expect(screen.getByText('No hands yet')).toBeOnTheScreen();
    expect(screen.getByText('Play a hand and it lands here.')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('runs the one action it is given', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();

    await render(
      <EmptyState
        title="History is unavailable"
        message="Something went wrong."
        action={{ label: 'Try again', onPress }}
      />,
    );

    await user.press(screen.getByLabelText('Try again'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
