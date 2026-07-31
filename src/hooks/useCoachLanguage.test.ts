import { act, renderHook } from '@testing-library/react-native';

import { createMemoryPreferencesRepo, setPreferencesRepo } from '@/services/preferences';

import {
  coachLanguageFrom,
  DEFAULT_COACH_LANGUAGE,
  useCoachLanguage,
  useCoachLanguageStore,
} from './useCoachLanguage';

describe('useCoachLanguage', () => {
  it('starts in plain English, the register a beginner needs', async () => {
    const { result } = await renderHook(() => useCoachLanguage());

    expect(DEFAULT_COACH_LANGUAGE).toBe('plain');
    expect(result.current).toBe('plain');
  });

  it('re-renders every reader when the register changes', async () => {
    const { result } = await renderHook(() => useCoachLanguage());

    await act(async () => useCoachLanguageStore.getState().setLanguage('poker'));

    expect(result.current).toBe('poker');
  });

  it('flips between the two registers', async () => {
    const { result } = await renderHook(() => useCoachLanguage());

    await act(async () => useCoachLanguageStore.getState().toggleLanguage());
    expect(result.current).toBe('poker');

    await act(async () => useCoachLanguageStore.getState().toggleLanguage());
    expect(result.current).toBe('plain');
  });

  it('writes the choice through to storage', async () => {
    const repo = createMemoryPreferencesRepo();

    setPreferencesRepo(repo);
    await act(async () => useCoachLanguageStore.getState().setLanguage('poker'));

    expect(repo.get('coachLanguage')).toBe('poker');
  });
});

describe('coachLanguageFrom', () => {
  it('reads back both registers', () => {
    expect(coachLanguageFrom('plain')).toBe('plain');
    expect(coachLanguageFrom('poker')).toBe('poker');
  });

  it('falls back to the default when nothing has ever been written', () => {
    expect(coachLanguageFrom(null)).toBe(DEFAULT_COACH_LANGUAGE);
  });

  it('refuses a register that does not exist rather than rendering it', () => {
    expect(coachLanguageFrom('sarcastic')).toBe(DEFAULT_COACH_LANGUAGE);
    expect(coachLanguageFrom('')).toBe(DEFAULT_COACH_LANGUAGE);
  });
});
