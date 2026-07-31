/**
 * Which words the coach uses, remembered between launches.
 *
 * App-level presentation state rather than a feature's, which is why it sits
 * next to `useTheme` instead of in a feature folder: the review sheet, the
 * summary, the felt and a stored hand in History all render the same verdicts
 * and must all render them the same way.
 *
 * Read through the store synchronously and written through on every change. The
 * store is seeded from disk the first time anything asks, so the first paint is
 * already in the right register — a screen that renders in poker terms and then
 * flips to plain reads as a bug, not as a setting being applied.
 */

import { create } from 'zustand';

import { type CoachLanguage } from '@/components/coach/coachCopy';
import { getPreferencesRepo } from '@/services/preferences';

/**
 * Plain by default.
 *
 * The player who cannot read the poker register is the one who needs the app
 * most, and they are the one who will never find the switch to turn it on.
 */
export const DEFAULT_COACH_LANGUAGE: CoachLanguage = 'plain';

interface CoachLanguageState {
  language: CoachLanguage;
  setLanguage(language: CoachLanguage): void;
  /** Flips to the other register. What the one-tap control on a header calls. */
  toggleLanguage(): void;
}

export const useCoachLanguageStore = create<CoachLanguageState>((set, get) => ({
  language: storedLanguage(),

  setLanguage: (language) => {
    set({ language });
    getPreferencesRepo().set('coachLanguage', language);
  },

  toggleLanguage: () => get().setLanguage(get().language === 'plain' ? 'poker' : 'plain'),
}));

/** The register to render in. The hook every coaching surface calls. */
export function useCoachLanguage(): CoachLanguage {
  return useCoachLanguageStore((state) => state.language);
}

/**
 * Narrows a stored string back to a register, falling back to the default.
 *
 * Anything unrecognised falls back rather than being trusted: the value came off
 * a disk this app does not own the only copy of, and a screen must never be
 * asked to render a register that does not exist.
 */
export function coachLanguageFrom(stored: string | null): CoachLanguage {
  return stored === 'plain' || stored === 'poker' ? stored : DEFAULT_COACH_LANGUAGE;
}

function storedLanguage(): CoachLanguage {
  return coachLanguageFrom(getPreferencesRepo().get('coachLanguage'));
}
