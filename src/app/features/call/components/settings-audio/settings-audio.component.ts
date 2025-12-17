import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CommunicationMode,
  CommunicationSettings,
  PushToTalkShortcut,
  WebrtcService,
} from '../../../../core/services/webrtc.service';
import { TooltipDirective } from '../../../../shared/components/tooltip/tooltip.directive';
import { LucideAngularModule, Mic, Radio, Info, RadioIcon, Zap } from 'lucide-angular';
import { CustomSelectComponent, SelectOption } from '../../../../shared/components/custom-select/custom-select.component';
import { ElectronService } from '../../../../core/services/electron.service';
import { Subject, takeUntil } from 'rxjs';
import { formatShortcutLabel } from '../../../../shared/utils/shortcut.utils';

@Component({
  selector: 'app-settings-audio',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective, LucideAngularModule, CustomSelectComponent],
  templateUrl: './settings-audio.component.html',
  styleUrls: ['./settings-audio.component.scss'],
})
export class SettingsAudioComponent implements OnInit, OnDestroy {
  readonly Mic = Mic;
  readonly Radio = Radio;
  readonly Info = Info;
  readonly RadioIcon = RadioIcon;
  readonly Zap = Zap;

  settings = {
    noiseSuppression: true,
    echoCancellation: true,
  };

  audioInputOptions: SelectOption[] = [];
  audioOutputOptions: SelectOption[] = [];
  selectedInputId = 'default';
  selectedOutputId = 'default';

  communicationSettings: CommunicationSettings;
  isElectronApp = false;
  isCapturingShortcut = false;
  shortcutError: string | null = null;
  readonly releaseDelayRange = { min: 0, max: 1000, step: 25 };
  
  // Custom slider state
  isSliderDragging = false;
  isSliderHovered = false;
  private sliderElement: HTMLElement | null = null;
  
  private isMacOS = false;
  private destroy$ = new Subject<void>();
  private shortcutCaptureHandler = (event: KeyboardEvent) => this.handleShortcutCapture(event);
  private windowBlurHandler = () => this.cancelShortcutCapture();
  private sliderMouseMoveHandler = (event: MouseEvent) => this.handleSliderMouseMove(event);
  private sliderMouseUpHandler = () => this.handleSliderMouseUp();
  private sliderTouchMoveHandler = (event: TouchEvent) => this.handleSliderTouchMove(event);
  private sliderTouchEndHandler = () => this.handleSliderTouchEnd();

  constructor(
    private webrtcService: WebrtcService,
    private electronService: ElectronService
  ) {
    this.communicationSettings = this.webrtcService.getCommunicationSettings();
  }

  async ngOnInit(): Promise<void> {
    this.isElectronApp = this.electronService.isElectronApp();
    this.isMacOS = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
    this.settings = this.webrtcService.getAudioProcessingSettings();
    this.webrtcService.communicationSettingsChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((settings) => {
        this.communicationSettings = settings;
      });

    await this.loadDevices();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cancelShortcutCapture();
    this.cleanupSliderListeners();
  }

  async loadDevices(): Promise<void> {
    try {
      const devices = await this.webrtcService.getAudioDevices();
      
      this.audioInputOptions = this.formatDeviceOptions(devices.input, 'Микрофон');
      this.audioOutputOptions = this.formatDeviceOptions(devices.output, 'Динамики');

      const selected = this.webrtcService.getSelectedDevices();
      this.selectedInputId = selected.audioInputId;
      this.selectedOutputId = selected.audioOutputId;
    } catch (error) {
      console.error('Failed to load audio devices', error);
    }
  }

  private formatDeviceLabel(label: string): string {
    if (!label) return '';

    // 1. Удаляем техническую информацию в скобках в конце, например (3142:a008) или (Realtek Audio)
    // Но оставляем полезные названия, если они в скобках
    let clean = label.replace(/\s*\([0-9a-fA-F]{4}:[0-9a-fA-F]{4}\)$/, ''); 

    clean = clean.replace(/^Default - /, '').replace(/^По умолчанию - /, '');

    clean = clean.replace(/^\d+\s*-\s*/, '');

    return clean.trim();
  }

  private formatDeviceOptions(devices: MediaDeviceInfo[], defaultLabelPrefix: string): SelectOption[] {
    const options: SelectOption[] = [];
    
    // Находим устройство по умолчанию
    const defaultDevice = devices.find(d => d.deviceId === 'default');
    
    if (defaultDevice) {
      let cleanLabel = this.formatDeviceLabel(defaultDevice.label);
        
      if (!cleanLabel) {
        cleanLabel = 'По умолчанию';
      } else {
        cleanLabel = `По умолчанию: ${cleanLabel}`;
      }
      
      options.push({
        value: 'default',
        label: cleanLabel
      });
    } else {
       options.push({ value: 'default', label: 'По умолчанию' });
    }

    devices.forEach(device => {
      if (device.deviceId !== 'default') {
        let label = this.formatDeviceLabel(device.label);
        if (!label) {
            label = `${defaultLabelPrefix} ${device.deviceId.slice(0, 5)}...`;
        }
        
        options.push({
          value: device.deviceId,
          label: label
        });
      }
    });

    return options;
  }

  async onInputDeviceChange(deviceId: string): Promise<void> {
    this.selectedInputId = deviceId;
    try {
      await this.webrtcService.switchAudioDevice(deviceId);
    } catch (error) {
      console.error('Failed to switch input device', error);
    }
  }

  async onOutputDeviceChange(deviceId: string): Promise<void> {
    this.selectedOutputId = deviceId;
    try {
      await this.webrtcService.setAudioOutputDevice(deviceId);
    } catch (error) {
      console.error('Failed to switch output device', error);
    }
  }

  updateSettings(): void {
    this.webrtcService.updateAudioProcessing(this.settings);
  }

  selectCommunicationMode(mode: CommunicationMode): void {
    if (mode === this.communicationSettings.mode) {
      return;
    }

    if (!this.isElectronApp && mode === 'push-to-talk') {
      return;
    }

    this.webrtcService.updateCommunicationSettings({ mode });
  }

  beginShortcutCapture(): void {
    if (!this.pushToTalkControlsEnabled || this.isCapturingShortcut) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    this.isCapturingShortcut = true;
    this.shortcutError = null;
    window.addEventListener('keydown', this.shortcutCaptureHandler, true);
    window.addEventListener('blur', this.windowBlurHandler, true);
  }

  cancelShortcutCapture(): void {
    if (!this.isCapturingShortcut) {
      return;
    }

    this.isCapturingShortcut = false;
    this.shortcutError = null;
    if (typeof window === 'undefined') {
      return;
    }
    window.removeEventListener('keydown', this.shortcutCaptureHandler, true);
    window.removeEventListener('blur', this.windowBlurHandler, true);
  }

  resetShortcutToDefault(): void {
    if (!this.pushToTalkControlsEnabled) {
      return;
    }
    this.webrtcService.updateCommunicationSettings({
      shortcut: this.webrtcService.getDefaultPushToTalkShortcut(),
    });
  }

  onReleaseDelayChange(delay: number): void {
    if (!this.pushToTalkControlsEnabled) {
      return;
    }

    const numericDelay = typeof delay === 'number' ? delay : Number(delay);
    if (Number.isNaN(numericDelay)) {
      return;
    }
    this.webrtcService.updateCommunicationSettings({ releaseDelayMs: numericDelay });
  }

  get pushToTalkControlsEnabled(): boolean {
    return this.isElectronApp && this.communicationSettings.mode === 'push-to-talk';
  }

  get shortcutDisplay(): string {
    return formatShortcutLabel(this.communicationSettings.shortcut, {
      isMac: this.isMacOS,
      fallbackLabel: 'Не задано',
    });
  }

  get modeDescription(): string {
    if (!this.isElectronApp) {
      return 'В браузере активен автоматический режим.';
    }
    return this.communicationSettings.mode === 'push-to-talk'
      ? 'Удерживайте выбранную комбинацию, чтобы говорить.'
      : 'Микрофон управляется автоматически кнопкой и голосовой активностью.';
  }

  private handleShortcutCapture(event: KeyboardEvent): void {
    if (!this.isCapturingShortcut) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.repeat) {
      return;
    }

    if (event.code === 'Escape') {
      this.cancelShortcutCapture();
      return;
    }

    const shortcut: PushToTalkShortcut = {
      code: event.code,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
    };

    if (!this.hasShortcutModifier(shortcut)) {
      this.shortcutError = 'Добавьте модификатор (Ctrl, Alt, Shift или Cmd).';
      return;
    }

    this.shortcutError = null;
    this.webrtcService.updateCommunicationSettings({ shortcut });
    this.cancelShortcutCapture();
  }

  private hasShortcutModifier(shortcut: PushToTalkShortcut): boolean {
    return shortcut.ctrlKey || shortcut.altKey || shortcut.shiftKey || shortcut.metaKey;
  }

  // Custom Slider Methods
  get sliderProgressPercent(): number {
    const { min, max } = this.releaseDelayRange;
    const value = this.communicationSettings.releaseDelayMs;
    return ((value - min) / (max - min)) * 100;
  }

  onSliderMouseDown(event: MouseEvent): void {
    if (!this.pushToTalkControlsEnabled) {
      return;
    }
    
    event.preventDefault();
    this.isSliderDragging = true;
    this.sliderElement = event.currentTarget as HTMLElement;
    this.updateSliderValue(event.clientX, this.sliderElement);
    
    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', this.sliderMouseMoveHandler);
      window.addEventListener('mouseup', this.sliderMouseUpHandler);
    }
  }

  onSliderTouchStart(event: TouchEvent): void {
    if (!this.pushToTalkControlsEnabled) {
      return;
    }
    
    event.preventDefault();
    this.isSliderDragging = true;
    this.sliderElement = event.currentTarget as HTMLElement;
    const touch = event.touches[0];
    this.updateSliderValue(touch.clientX, this.sliderElement);
    
    if (typeof window !== 'undefined') {
      window.addEventListener('touchmove', this.sliderTouchMoveHandler, { passive: false });
      window.addEventListener('touchend', this.sliderTouchEndHandler);
    }
  }

  private handleSliderMouseMove(event: MouseEvent): void {
    if (!this.isSliderDragging || !this.sliderElement) {
      return;
    }
    
    event.preventDefault();
    this.updateSliderValue(event.clientX, this.sliderElement);
  }

  private handleSliderTouchMove(event: TouchEvent): void {
    if (!this.isSliderDragging || !this.sliderElement) {
      return;
    }
    
    event.preventDefault();
    const touch = event.touches[0];
    this.updateSliderValue(touch.clientX, this.sliderElement);
  }

  private handleSliderMouseUp(): void {
    this.isSliderDragging = false;
    this.sliderElement = null;
    this.cleanupSliderListeners();
  }

  private handleSliderTouchEnd(): void {
    this.isSliderDragging = false;
    this.sliderElement = null;
    this.cleanupSliderListeners();
  }

  private cleanupSliderListeners(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', this.sliderMouseMoveHandler);
      window.removeEventListener('mouseup', this.sliderMouseUpHandler);
      window.removeEventListener('touchmove', this.sliderTouchMoveHandler);
      window.removeEventListener('touchend', this.sliderTouchEndHandler);
    }
  }

  private updateSliderValue(clientX: number, sliderElement: HTMLElement): void {
    const rect = sliderElement.getBoundingClientRect();
    const { min, max, step } = this.releaseDelayRange;
    
    // Calculate percentage (0-1)
    let percent = (clientX - rect.left) / rect.width;
    percent = Math.max(0, Math.min(1, percent));
    
    // Calculate raw value
    let value = min + percent * (max - min);
    
    // Round to nearest step
    value = Math.round(value / step) * step;
    
    // Clamp to range
    value = Math.max(min, Math.min(max, value));
    
    // Update if changed
    if (value !== this.communicationSettings.releaseDelayMs) {
      this.onReleaseDelayChange(value);
    }
  }

}
