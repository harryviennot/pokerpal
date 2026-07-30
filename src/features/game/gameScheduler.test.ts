import { createGameScheduler, realTimers, type GameTimers } from './gameScheduler';

/** A clock the test drives by hand: no timers, no frames, no waiting. */
function stubClock(): GameTimers<number> & { tick: (ms: number) => void; time: () => number } {
  let time = 0;
  let nextId = 1;
  const queued = new Map<number, { at: number; fn: () => void }>();

  return {
    setTimeoutFn: (fn, delayMs) => {
      const id = nextId++;

      queued.set(id, { at: time + delayMs, fn });

      return id;
    },
    clearTimeoutFn: (handle) => {
      queued.delete(handle);
    },
    now: () => time,
    time: () => time,
    tick: (ms) => {
      time += ms;

      for (const [id, entry] of [...queued.entries()]) {
        if (entry.at <= time) {
          queued.delete(id);
          entry.fn();
        }
      }
    },
  };
}

describe('createGameScheduler', () => {
  it('runs a callback once its delay has passed, and not before', () => {
    const clock = stubClock();
    const scheduler = createGameScheduler(clock);
    const ran = jest.fn();

    scheduler.schedule(500, ran);
    clock.tick(499);

    expect(ran).not.toHaveBeenCalled();

    clock.tick(1);

    expect(ran).toHaveBeenCalledTimes(1);
  });

  it('forgets a callback once it has run', () => {
    const clock = stubClock();
    const scheduler = createGameScheduler(clock);

    scheduler.schedule(10, () => undefined);

    expect(scheduler.pending()).toBe(1);

    clock.tick(10);

    expect(scheduler.pending()).toBe(0);
  });

  it('drops everything pending on cancelAll', () => {
    const clock = stubClock();
    const scheduler = createGameScheduler(clock);
    const ran = jest.fn();

    scheduler.schedule(10, ran);
    scheduler.schedule(20, ran);
    scheduler.cancelAll();
    clock.tick(1_000);

    expect(ran).not.toHaveBeenCalled();
    expect(scheduler.pending()).toBe(0);
  });

  it('makes a callback that outlived its generation a no-op', () => {
    // The race the generation exists for: a timer already handed to the event
    // loop cannot be un-fired, so it has to refuse to do anything itself.
    const queued: (() => void)[] = [];
    const unstoppable: GameTimers<() => void> = {
      setTimeoutFn: (fn) => {
        queued.push(fn);

        return fn;
      },
      // A platform that cannot cancel: clearing does nothing at all.
      clearTimeoutFn: () => undefined,
      now: () => 0,
    };
    const scheduler = createGameScheduler(unstoppable);
    const ran = jest.fn();

    scheduler.schedule(10, ran);
    scheduler.cancelAll();
    queued.forEach((fn) => fn());

    expect(ran).not.toHaveBeenCalled();
  });

  it('bumps the generation on every cancelAll', () => {
    const scheduler = createGameScheduler(stubClock());
    const first = scheduler.generation();

    scheduler.cancelAll();
    scheduler.cancelAll();

    expect(scheduler.generation()).toBe(first + 2);
  });

  it('still runs callbacks scheduled after a cancelAll', () => {
    const clock = stubClock();
    const scheduler = createGameScheduler(clock);
    const ran = jest.fn();

    scheduler.cancelAll();
    scheduler.schedule(5, ran);
    clock.tick(5);

    expect(ran).toHaveBeenCalledTimes(1);
  });

  it('does not leak an entry for a timer that fires synchronously', () => {
    // A stub clock is allowed to be that eager; the bookkeeping must survive it.
    const scheduler = createGameScheduler<null>({
      setTimeoutFn: (fn) => {
        fn();

        return null;
      },
      clearTimeoutFn: () => undefined,
      now: () => 0,
    });
    const ran = jest.fn();

    scheduler.schedule(0, ran);

    expect(ran).toHaveBeenCalledTimes(1);
    expect(scheduler.pending()).toBe(0);
  });

  it('reads the clock it was given', () => {
    const clock = stubClock();
    const scheduler = createGameScheduler(clock);

    clock.tick(1_234);

    expect(scheduler.now()).toBe(1_234);
  });

  it('runs on real timers by default', () => {
    jest.useFakeTimers();

    try {
      const scheduler = createGameScheduler(realTimers());
      const ran = jest.fn();

      scheduler.schedule(100, ran);
      jest.advanceTimersByTime(100);

      expect(ran).toHaveBeenCalledTimes(1);
      expect(scheduler.now()).toBe(Date.now());
    } finally {
      jest.useRealTimers();
    }
  });
});
