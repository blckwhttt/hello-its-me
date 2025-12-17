import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, takeUntil } from 'rxjs';
import { CommunicationSettings, WebrtcService } from './webrtc.service';
import { ElectronService } from './electron.service';

type Modifier = 'ctrl' | 'alt' | 'shift' | 'meta';

@Injectable({
  providedIn: 'root',
})
export class PushToTalkService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly isHolding$ = new BehaviorSubject<boolean>(false);
  private readonly isEnabled$ = new BehaviorSubject<boolean>(false);
  private currentSettings: CommunicationSettings;
  private listenersAttached = false;
  private releaseTimeout: ReturnType<typeof setTimeout> | null = null;
  private pressedCodes = new Set<string>();

  private keyDownHandler = (event: KeyboardEvent) => this.onKeyDown(event);
  private keyUpHandler = (event: KeyboardEvent) => this.onKeyUp(event);
  private blurHandler = () => this.forceRelease();
  private visibilityHandler = () => {
    if (typeof document !== 'undefined' && document.hidden) {
      this.forceRelease();
    }
  };

  constructor(
    private webrtcService: WebrtcService,
    private electronService: ElectronService,
    private zone: NgZone
  ) {
    this.currentSettings = this.webrtcService.getCommunicationSettings();
    this.webrtcService.communicationSettingsChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((settings) => {
        this.currentSettings = settings;
        this.syncListeners();
      });

    this.syncListeners();
  }

  ngOnDestroy(): void {
    this.detachListeners();
    this.destroy$.next();
    this.destroy$.complete();
  }

  get holdingChanges() {
    return this.isHolding$.asObservable();
  }

  get enabledChanges() {
    return this.isEnabled$.asObservable();
  }

  isEnabled(): boolean {
    return this.isEnabled$.value;
  }

  isHolding(): boolean {
    return this.isHolding$.value;
  }

  forceRelease(): void {
    this.clearReleaseTimer();
    this.updateHolding(false);
    this.pressedCodes.clear();
  }

  private syncListeners(): void {
    const shouldEnable =
      this.electronService.isElectronApp() && this.currentSettings.mode === 'push-to-talk';

    if (shouldEnable) {
      this.attachListeners();
    } else {
      this.detachListeners();
      this.forceRelease();
    }

    this.isEnabled$.next(shouldEnable);
  }

  private attachListeners(): void {
    if (this.listenersAttached || !this.hasWindowContext()) {
      return;
    }

    this.zone.runOutsideAngular(() => {
      window.addEventListener('keydown', this.keyDownHandler, true);
      window.addEventListener('keyup', this.keyUpHandler, true);
      window.addEventListener('blur', this.blurHandler, true);
      document.addEventListener('visibilitychange', this.visibilityHandler, true);
    });

    this.listenersAttached = true;
  }

  private detachListeners(): void {
    if (!this.listenersAttached || !this.hasWindowContext()) {
      return;
    }

    window.removeEventListener('keydown', this.keyDownHandler, true);
    window.removeEventListener('keyup', this.keyUpHandler, true);
    window.removeEventListener('blur', this.blurHandler, true);
    document.removeEventListener('visibilitychange', this.visibilityHandler, true);
    this.listenersAttached = false;
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.isEnabled$.value || this.shouldIgnoreEventTarget(event.target)) {
      return;
    }

    if (!event.repeat) {
      this.pressedCodes.add(event.code);
    }

    if (!this.isShortcutSatisfied()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.clearReleaseTimer();
    this.updateHolding(true);
  }

  private onKeyUp(event: KeyboardEvent): void {
    if (!this.isEnabled$.value || this.shouldIgnoreEventTarget(event.target)) {
      return;
    }

    this.pressedCodes.delete(event.code);

    if (this.isShortcutSatisfied()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.scheduleRelease();
  }

  private isShortcutSatisfied(): boolean {
    const shortcut = this.currentSettings.shortcut;
    if (!shortcut) {
      return false;
    }

    if (!this.pressedCodes.has(shortcut.code)) {
      return false;
    }

    if (shortcut.ctrlKey && !this.isModifierPressed('ctrl')) {
      return false;
    }
    if (shortcut.altKey && !this.isModifierPressed('alt')) {
      return false;
    }
    if (shortcut.shiftKey && !this.isModifierPressed('shift')) {
      return false;
    }
    if (shortcut.metaKey && !this.isModifierPressed('meta')) {
      return false;
    }

    return true;
  }

  private isModifierPressed(modifier: Modifier): boolean {
    const lookup: Record<Modifier, string[]> = {
      ctrl: ['ControlLeft', 'ControlRight'],
      alt: ['AltLeft', 'AltRight'],
      shift: ['ShiftLeft', 'ShiftRight'],
      meta: ['MetaLeft', 'MetaRight'],
    };

    return lookup[modifier].some((code) => this.pressedCodes.has(code));
  }

  private shouldIgnoreEventTarget(target: EventTarget | null): boolean {
    if (!target || typeof HTMLElement === 'undefined') {
      return false;
    }

    const element = target as HTMLElement;
    const tag = element.tagName?.toLowerCase();
    if (!tag) {
      return false;
    }

    if (element.isContentEditable) {
      return true;
    }

    return tag === 'input' || tag === 'textarea' || tag === 'select';
  }

  private scheduleRelease(): void {
    const delay = this.currentSettings.releaseDelayMs ?? 0;
    if (delay <= 0) {
      this.updateHolding(false);
      return;
    }

    this.clearReleaseTimer();
    this.releaseTimeout = window.setTimeout(() => {
      this.updateHolding(false);
    }, delay);
  }

  private clearReleaseTimer(): void {
    if (this.releaseTimeout) {
      clearTimeout(this.releaseTimeout);
      this.releaseTimeout = null;
    }
  }

  private updateHolding(holding: boolean): void {
    if (this.isHolding$.value === holding) {
      return;
    }

    this.zone.run(() => {
      this.isHolding$.next(holding);
    });
  }

  private hasWindowContext(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }
}
