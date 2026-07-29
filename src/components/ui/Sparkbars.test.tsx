import { cleanup, render, screen } from '@testing-library/react-native';

import { Sparkbars, type Sparkbar } from './Sparkbars';

function bar(value: number, key = String(value)): Sparkbar {
  return { key, value, accessibilityLabel: `${key}: ${value}` };
}

afterEach(async () => {
  await cleanup();
});

describe('Sparkbars', () => {
  it('renders one labelled bar per value', async () => {
    await render(<Sparkbars bars={[bar(1), bar(5), bar(3)]} />);

    expect(screen.getByLabelText('1: 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('5: 5')).toBeOnTheScreen();
    expect(screen.getByLabelText('3: 3')).toBeOnTheScreen();
  });

  it('labels the ends of the axis and nothing in between', async () => {
    await render(
      <Sparkbars bars={[{ ...bar(1), label: 'March' }, bar(2), { ...bar(3), label: 'July' }]} />,
    );

    expect(screen.getByText('March')).toBeOnTheScreen();
    expect(screen.getByText('July')).toBeOnTheScreen();
  });

  it('draws nothing rather than an empty axis', async () => {
    const { toJSON } = await render(<Sparkbars bars={[]} />);

    expect(toJSON()).toBeNull();
  });

  it('survives a run of zeroes without dividing by one', async () => {
    await render(<Sparkbars bars={[bar(0, 'a'), bar(0, 'b')]} />);

    expect(screen.getByLabelText('a: 0')).toBeOnTheScreen();
    expect(screen.getByLabelText('b: 0')).toBeOnTheScreen();
  });
});
