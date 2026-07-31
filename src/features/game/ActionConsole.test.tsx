import { cleanup, render, screen, userEvent } from '@testing-library/react-native';

import {
  applyAction,
  createRng,
  replayHand,
  startHand,
  type Action,
  type HandState,
  type TableConfig,
  type TableSnapshot,
} from '@/engine';

import { ActionConsole } from './ActionConsole';

/** The seed only decides the cards, and nothing here depends on them. */
const SEED = 20260729;

const HERO = 0;

const SEATS = [
  { id: 'You', stack: 500 },
  { id: 'Ava', stack: 500 },
  { id: 'Ben', stack: 500 },
];

/**
 * The reference screenshot's spot, exactly: the hero on the button at 10/20, so
 * 30 in the pot, 20 to call and a minimum raise to 40.
 */
function configFor(seats: readonly { id: string; stack: number }[]): TableConfig {
  return {
    seats,
    button: HERO,
    blinds: { smallBlind: 10, bigBlind: 20 },
    handNumber: 1,
    seed: SEED,
  };
}

interface Spot {
  hand: HandState;
  snapshot: TableSnapshot;
}

function spot(actions: readonly Action[] = [], seats = SEATS): Spot {
  const hand = actions.reduce(
    (state, action) => applyAction(state, action),
    startHand(configFor(seats), createRng(SEED)),
  );
  const frames = replayHand({ seats, events: hand.events });

  return { hand, snapshot: frames[frames.length - 1]!.snapshot };
}

/** Preflop, the hero first to act facing the big blind. */
const PREFLOP = spot();

/**
 * The flop, checked to the hero: 50 in the pot, nothing to call, and a minimum
 * bet of one big blind — which is what puts a third of the pot out of reach.
 */
const POSTFLOP = spot([
  { type: 'call' }, // You, on the button
  { type: 'fold' }, // Ava, the small blind
  { type: 'check' }, // Ben takes his option
  { type: 'check' }, // Ben again, first to act on the flop
]);

interface Handlers {
  onAct: jest.Mock;
  onPreselect: jest.Mock;
}

function handlers(): Handlers {
  return { onAct: jest.fn(), onPreselect: jest.fn() };
}

const setupUser = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

/**
 * The raise button's own label, which carries the pending size.
 *
 * Anchored on a digit or the shove so it cannot also match the stepper, whose
 * label starts with the same word.
 */
const pending = (): string =>
  screen.getByLabelText(/^(Raise|Bet) (\d|All-in)/).props.accessibilityLabel;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(async () => {
  await cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('ActionConsole on the hero turn', () => {
  it('offers exactly the actions the rules offer, and nothing else', async () => {
    await render(
      <ActionConsole
        {...PREFLOP}
        heroSeat={HERO}
        phase="heroTurn"
        preselect={null}
        {...handlers()}
      />,
    );

    expect(screen.getByLabelText('Fold')).toBeOnTheScreen();
    expect(screen.getByLabelText('Call 20')).toBeOnTheScreen();
    expect(screen.getByLabelText('Raise 40')).toBeOnTheScreen();
    // Checking is not legal facing the big blind, so there is no button for it.
    expect(screen.queryByLabelText('Check')).not.toBeOnTheScreen();
    expect(screen.queryByLabelText('Bet 40')).not.toBeOnTheScreen();
  });

  it('opens the raise at the minimum the rules allow', async () => {
    await render(
      <ActionConsole
        {...PREFLOP}
        heroSeat={HERO}
        phase="heroTurn"
        preselect={null}
        {...handlers()}
      />,
    );

    expect(pending()).toBe('Raise 40');
  });

  it('calls the bet a bet when there is nothing to call', async () => {
    await render(
      <ActionConsole
        {...POSTFLOP}
        heroSeat={HERO}
        phase="heroTurn"
        preselect={null}
        {...handlers()}
      />,
    );

    expect(screen.getByLabelText('Check')).toBeOnTheScreen();
    expect(screen.getByLabelText('Bet 20')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Fold/)).not.toBeOnTheScreen();
  });

  it('plays the action the player tapped, with the amount showing on it', async () => {
    const user = setupUser();
    const spies = handlers();

    await render(
      <ActionConsole {...PREFLOP} heroSeat={HERO} phase="heroTurn" preselect={null} {...spies} />,
    );
    await user.press(screen.getByLabelText('Call 20'));

    expect(spies.onAct).toHaveBeenCalledWith({ type: 'call' });

    await user.press(screen.getByLabelText('Raise 40'));

    expect(spies.onAct).toHaveBeenCalledWith({ type: 'raise', to: 40 });
  });
});

describe('ActionConsole bet sizes', () => {
  it('offers the reference sizes, in big blinds before the flop', async () => {
    await render(
      <ActionConsole
        {...PREFLOP}
        heroSeat={HERO}
        phase="heroTurn"
        preselect={null}
        {...handlers()}
      />,
    );

    expect(screen.getByLabelText('All-in')).toBeOnTheScreen();
    expect(screen.getByLabelText('Pot')).toBeOnTheScreen();
    expect(screen.getByLabelText('x3.0')).toBeOnTheScreen();
    expect(screen.getByLabelText('x2.5')).toBeOnTheScreen();
    expect(screen.getByText('70')).toBeOnTheScreen();
    expect(screen.getByText('60')).toBeOnTheScreen();
    expect(screen.getByText('50')).toBeOnTheScreen();
  });

  it('switches to fractions of the pot after the flop', async () => {
    await render(
      <ActionConsole
        {...POSTFLOP}
        heroSeat={HERO}
        phase="heroTurn"
        preselect={null}
        {...handlers()}
      />,
    );

    expect(screen.getByLabelText('65%')).toBeOnTheScreen();
    expect(screen.getByLabelText('35%')).toBeOnTheScreen();
    expect(screen.queryByLabelText('x3.0')).not.toBeOnTheScreen();
  });

  it('loads the size the player chose into the raise button', async () => {
    const user = setupUser();

    await render(
      <ActionConsole
        {...PREFLOP}
        heroSeat={HERO}
        phase="heroTurn"
        preselect={null}
        {...handlers()}
      />,
    );
    await user.press(screen.getByLabelText('Pot'));

    expect(pending()).toBe('Raise 70');

    await user.press(screen.getByLabelText('All-in'));

    // A shove says so rather than naming a number, the way the reference does.
    expect(pending()).toBe('Raise All-in');
  });

  it('greys a size the rules will not take rather than hiding it', async () => {
    await render(
      <ActionConsole
        {...POSTFLOP}
        heroSeat={HERO}
        phase="heroTurn"
        preselect={null}
        {...handlers()}
      />,
    );

    // A third of a 50 pot is 18, and the smallest legal bet is a big blind of 20.
    expect(screen.getByText('18')).toBeOnTheScreen();
    expect(screen.getByLabelText('35%')).toBeDisabled();
    expect(screen.getByLabelText('65%')).toBeEnabled();
  });

  it('steps by one big blind and stops at both ends of the band', async () => {
    const user = setupUser();

    await render(
      <ActionConsole
        {...PREFLOP}
        heroSeat={HERO}
        phase="heroTurn"
        preselect={null}
        {...handlers()}
      />,
    );

    // Opens at the minimum, so there is nothing below to step down to.
    expect(screen.getByLabelText('Lower the size by one big blind')).toBeDisabled();

    await user.press(screen.getByLabelText('Raise the size by one big blind'));

    expect(pending()).toBe('Raise 60');

    await user.press(screen.getByLabelText('Lower the size by one big blind'));
    await user.press(screen.getByLabelText('Lower the size by one big blind'));

    // Clamped at the minimum rather than stepping into an illegal raise.
    expect(pending()).toBe('Raise 40');
  });

  it('clamps the stepper at the shove instead of going dead', async () => {
    const user = setupUser();

    await render(
      <ActionConsole
        {...PREFLOP}
        heroSeat={HERO}
        phase="heroTurn"
        preselect={null}
        {...handlers()}
      />,
    );
    await user.press(screen.getByLabelText('All-in'));

    expect(screen.getByLabelText('Raise the size by one big blind')).toBeDisabled();
  });

  it('opens every fresh decision at the minimum rather than the last size', async () => {
    const user = setupUser();
    const { rerender } = await render(
      <ActionConsole
        {...PREFLOP}
        heroSeat={HERO}
        phase="heroTurn"
        preselect={null}
        {...handlers()}
      />,
    );

    await user.press(screen.getByLabelText('Pot'));

    expect(pending()).toBe('Raise 70');

    await rerender(
      <ActionConsole
        {...POSTFLOP}
        heroSeat={HERO}
        phase="heroTurn"
        preselect={null}
        {...handlers()}
      />,
    );

    // A sizer left at a pot-sized raise must not become the default on the flop.
    expect(pending()).toBe('Bet 20');
  });
});

describe('ActionConsole while somebody else is on the clock', () => {
  it('arms a check or a check-fold when the pot is unraised', async () => {
    const user = setupUser();
    const spies = handlers();

    await render(
      <ActionConsole
        {...POSTFLOP}
        heroSeat={HERO}
        phase="botThinking"
        preselect={null}
        {...spies}
      />,
    );

    expect(screen.queryByLabelText('Bet 20')).not.toBeOnTheScreen();

    await user.press(screen.getByLabelText('Check'));

    expect(spies.onPreselect).toHaveBeenCalledWith('check');

    await user.press(screen.getByLabelText('Fold'));

    expect(spies.onPreselect).toHaveBeenCalledWith('checkFold');
  });

  it('offers a fold and a blind call when there is a price on screen', async () => {
    const user = setupUser();
    const spies = handlers();

    await render(
      <ActionConsole
        {...PREFLOP}
        heroSeat={HERO}
        phase="botThinking"
        preselect={null}
        {...spies}
      />,
    );

    expect(screen.getByLabelText('Call any')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Check')).not.toBeOnTheScreen();

    await user.press(screen.getByLabelText('Call any'));

    expect(spies.onPreselect).toHaveBeenCalledWith('callAny');
  });

  it('says All-in when a blind call would be for the last of the chips', async () => {
    const short = spot([], [{ id: 'You', stack: 20 }, ...SEATS.slice(1)]);

    await render(
      <ActionConsole
        {...short}
        heroSeat={HERO}
        phase="botThinking"
        preselect={null}
        {...handlers()}
      />,
    );

    expect(screen.getByLabelText('Call All-in')).toBeOnTheScreen();
  });

  it('disarms an armed action rather than needing a third button', async () => {
    const user = setupUser();
    const spies = handlers();

    await render(
      <ActionConsole
        {...POSTFLOP}
        heroSeat={HERO}
        phase="botThinking"
        preselect="check"
        {...spies}
      />,
    );
    await user.press(screen.getByLabelText('Check'));

    expect(spies.onPreselect).toHaveBeenCalledWith(null);
  });

  it('offers nothing at all once the hand is over', async () => {
    await render(
      <ActionConsole
        {...POSTFLOP}
        heroSeat={HERO}
        phase="handOver"
        preselect={null}
        {...handlers()}
      />,
    );

    expect(screen.queryByLabelText('Check')).not.toBeOnTheScreen();
    expect(screen.queryByLabelText('Fold')).not.toBeOnTheScreen();
  });
});

describe('ActionConsole live help', () => {
  it('shows the equity read it is given, and nothing when there is none', async () => {
    const { rerender } = await render(
      <ActionConsole
        {...PREFLOP}
        heroSeat={HERO}
        phase="heroTurn"
        preselect={null}
        hint="28% to win · 40% to call"
        {...handlers()}
      />,
    );

    expect(screen.getByText('28% to win · 40% to call')).toBeOnTheScreen();

    await rerender(
      <ActionConsole
        {...PREFLOP}
        heroSeat={HERO}
        phase="heroTurn"
        preselect={null}
        {...handlers()}
      />,
    );

    expect(screen.queryByText(/to win/)).not.toBeOnTheScreen();
  });
});
