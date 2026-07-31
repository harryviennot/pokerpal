/**
 * The contract for remembering a setting between launches.
 *
 * Deliberately a string key-value store and nothing more: a preferences service
 * that knew what a coach language was would be a service that has to change
 * every time a screen gains a switch. Narrowing the string back into a union is
 * the caller's job, and so is deciding what an unrecognised value means.
 */

export type PreferenceKey = 'coachLanguage';

export interface PreferencesRepo {
  /**
   * The stored value, or null when nothing has been written yet.
   *
   * Synchronous on purpose. A preference read a frame late is a screen that
   * paints in the wrong register and then flips, which reads as a bug.
   */
  get(key: PreferenceKey): string | null;
  set(key: PreferenceKey, value: string): void;
}
