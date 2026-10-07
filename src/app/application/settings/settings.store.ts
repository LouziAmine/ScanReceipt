import { Injectable, computed, inject, signal } from '@angular/core';
import { DEFAULT_SETTINGS, SettingsRepository, type UserSettings, dateOrderOf } from '@domain';

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly repository = inject(SettingsRepository);
  private readonly state = signal<UserSettings>(DEFAULT_SETTINGS);

  readonly settings = this.state.asReadonly();
  readonly currency = computed(() => this.state().currency);
  readonly dateFormat = computed(() => this.state().dateFormat);
  readonly dateOrder = computed(() => dateOrderOf(this.state().dateFormat));

  async load(): Promise<void> {
    this.state.set(await this.repository.load());
  }

  async update(patch: Partial<UserSettings>): Promise<void> {
    const next = { ...this.state(), ...patch };
    this.state.set(next);
    await this.repository.save(next);
  }
}
