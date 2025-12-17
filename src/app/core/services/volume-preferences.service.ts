import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Хранит пользовательские настройки громкости собеседников.
 * Значения сохраняются в localStorage и восстанавливаются между комнатами.
 */
@Injectable({
  providedIn: 'root',
})
export class VolumePreferencesService {
  private readonly storageKey = 'twine:volume-preferences:v1';
  private readonly defaultVolume = 100;
  private readonly cache = new Map<string, number>();
  private readonly isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      this.restoreFromStorage();
    }
  }

  /**
   * Получить сохраненную громкость в процентах (0-100).
   */
  getVolume(userId: string | undefined | null): number {
    if (!userId) {
      return this.defaultVolume;
    }
    return this.cache.get(userId) ?? this.defaultVolume;
  }

  /**
   * Сохранить громкость и вернуть нормализованное значение.
   */
  setVolume(userId: string | undefined | null, volume: number): number {
    if (!userId) {
      return this.defaultVolume;
    }

    const normalized = this.clampVolume(volume);
    if (this.cache.get(userId) === normalized) {
      return normalized;
    }

    this.cache.set(userId, normalized);
    this.persist();
    return normalized;
  }

  private restoreFromStorage(): void {
    if (!this.isBrowser) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Record<string, number>;
      Object.entries(parsed).forEach(([userId, volume]) => {
        if (typeof volume === 'number') {
          this.cache.set(userId, this.clampVolume(volume));
        }
      });
    } catch (error) {
      console.warn('[VolumePreferences] Failed to restore volume preferences', error);
      this.cache.clear();
    }
  }

  private persist(): void {
    if (!this.isBrowser) {
      return;
    }

    try {
      const payload: Record<string, number> = {};
      this.cache.forEach((value, userId) => {
        payload[userId] = value;
      });
      window.localStorage.setItem(this.storageKey, JSON.stringify(payload));
    } catch (error) {
      console.warn('[VolumePreferences] Failed to persist volume preferences', error);
    }
  }

  private clampVolume(value: number): number {
    if (!Number.isFinite(value)) {
      return this.defaultVolume;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
  }
}


