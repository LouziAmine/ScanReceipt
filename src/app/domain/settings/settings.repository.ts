import { type UserSettings } from './user-settings';

export abstract class SettingsRepository {
  abstract load(): Promise<UserSettings>;
  abstract save(settings: UserSettings): Promise<void>;
}
