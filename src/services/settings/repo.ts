/**
 * Tiny persisted key-value settings: flags the app must remember across
 * launches but that are nobody's business to query or join — the LivePlay
 * intended-use acknowledgement is the first.
 */

export interface SettingsRepo {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export class SettingsError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'SettingsError';
    this.cause = cause;
  }
}
