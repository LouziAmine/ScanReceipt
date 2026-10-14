import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { type UserSettings, DEFAULT_SETTINGS, SettingsRepository } from '@domain';

const KEY = 'settings.v1';

/** Adapter: settings in the platform key-value store (UserDefaults / SharedPreferences). */
@Injectable()
export class PreferencesSettingsRepository extends SettingsRepository {
  async load(): Promise<UserSettings> {
    const { value } = await Preferences.get({ key: KEY });
    if (!value) return DEFAULT_SETTINGS;
    try {
      // New settings added in later versions fall back to their defaults.
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(value) as Partial<UserSettings>) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async save(settings: UserSettings): Promise<void> {
    await Preferences.set({ key: KEY, value: JSON.stringify(settings) });
  }
}
