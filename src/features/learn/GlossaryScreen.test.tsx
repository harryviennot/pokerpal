import { cleanup, render, screen, userEvent } from '@testing-library/react-native';

import { GLOSSARY, GLOSSARY_SECTIONS } from '@/components/coach/glossary';
import { useCoachLanguageStore } from '@/hooks/useCoachLanguage';

import { GlossaryScreen } from './GlossaryScreen';

const params: { term?: string } = {};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => params,
  router: { push: jest.fn() },
}));

beforeEach(() => {
  delete params.term;
});

afterEach(async () => {
  await cleanup();
});

describe('GlossaryScreen', () => {
  it('lists every term the coach can put on screen', async () => {
    await render(<GlossaryScreen />);

    for (const section of GLOSSARY_SECTIONS) {
      expect(screen.getByText(section.title.toUpperCase())).toBeOnTheScreen();

      for (const id of section.terms) {
        // `getAllByText`, because a word whose two registers agree — "mistake"
        // is already the plain word — renders its own name twice.
        expect(screen.getAllByText(GLOSSARY[id].term).length).toBeGreaterThan(0);
      }
    }
  });

  /**
   * The whole reason both registers ship. A player who only ever reads "Costly
   * mistake" still has to recognise "blunder" when someone says it at a table.
   */
  it('shows both names for a word, whichever register is selected', async () => {
    await render(<GlossaryScreen />);

    expect(screen.getByText('Blunder')).toBeOnTheScreen();
    expect(screen.getByText('Costly mistake')).toBeOnTheScreen();
  });

  it('opens collapsed, so it is a glossary and not an essay', async () => {
    await render(<GlossaryScreen />);

    expect(screen.getByText(GLOSSARY.blunder.short)).toBeOnTheScreen();
    expect(screen.queryByText(GLOSSARY.blunder.long)).not.toBeOnTheScreen();
  });

  it('expands the word the player tapped to get here', async () => {
    params.term = 'blunder';

    await render(<GlossaryScreen />);

    expect(screen.getByText(GLOSSARY.blunder.long)).toBeOnTheScreen();
  });

  it('opens rather than breaks on a term it does not have', async () => {
    params.term = 'not-a-real-term';

    await render(<GlossaryScreen />);

    expect(screen.getByText('Blunder')).toBeOnTheScreen();
    expect(screen.queryByText(GLOSSARY.blunder.long)).not.toBeOnTheScreen();
  });

  it('expands and collapses a definition on tap', async () => {
    const user = userEvent.setup();

    await render(<GlossaryScreen />);
    await user.press(screen.getByLabelText('Equity, or Your chances of winning'));

    expect(screen.getByText(GLOSSARY.equity.long)).toBeOnTheScreen();

    await user.press(screen.getByLabelText('Equity, or Your chances of winning'));

    expect(screen.queryByText(GLOSSARY.equity.long)).not.toBeOnTheScreen();
  });

  it('keeps only one definition open at a time', async () => {
    const user = userEvent.setup();

    params.term = 'blunder';

    await render(<GlossaryScreen />);
    await user.press(screen.getByLabelText('Equity, or Your chances of winning'));

    expect(screen.getByText(GLOSSARY.equity.long)).toBeOnTheScreen();
    expect(screen.queryByText(GLOSSARY.blunder.long)).not.toBeOnTheScreen();
  });

  it('carries the switch between the two registers', async () => {
    await render(<GlossaryScreen />);

    expect(screen.getByText('Coach language')).toBeOnTheScreen();
    expect(useCoachLanguageStore.getState().language).toBe('plain');
  });
});
