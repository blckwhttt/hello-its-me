import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { WEBRTC_CONFIG, AudioProfileName, ScreenShareQuality } from '../config/webrtc.config';
import { ElectronService } from './electron.service';

export interface PeerConnectionData {
  peerId: string;
  userId: string;
  username: string;
  connection: RTCPeerConnection;
  audioStream?: MediaStream;
  screenStream?: MediaStream;
  isScreenSharing: boolean;
  isMuted: boolean;
}

export interface AudioDevices {
  audioInputDevices: MediaDeviceInfo[];
  audioOutputDevices: MediaDeviceInfo[];
}

interface DisplayMediaVideoConstraints {
  width?: { ideal: number; max?: number };
  height?: { ideal: number; max?: number };
  frameRate?: { ideal: number; max?: number };
}

interface DisplayMediaAudioConstraints {
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  suppressLocalAudioPlayback?: boolean;
  selfBrowserSurface?: 'include' | 'exclude' | 'exclude-but-allow';
  systemAudio?: 'include' | 'exclude';
}

interface DisplayMediaStreamConstraints {
  video?: boolean | DisplayMediaVideoConstraints;
  audio?: boolean | DisplayMediaAudioConstraints;
}

type SupportedDisplayConstraintSet = MediaTrackSupportedConstraints & {
  systemAudio?: boolean;
  suppressLocalAudioPlayback?: boolean;
  selfBrowserSurface?: boolean;
};

type ChromeDesktopVideoConstraint = MediaTrackConstraints & {
  mandatory?: {
    chromeMediaSource: 'desktop';
    chromeMediaSourceId: string;
    maxFrameRate?: number;
    maxWidth?: number;
    maxHeight?: number;
  };
};

type ChromeDesktopAudioConstraint = MediaTrackConstraints & {
  mandatory?: {
    chromeMediaSource: 'desktop';
    chromeMediaSourceId: string;
  };
};

export type MicrophRoobertatus = 'pending' | 'granted' | 'denied' | 'not-found';

export type CommunicationMode = 'auto' | 'push-to-talk';

export interface PushToTalkShortcut {
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export interface CommunicationSettings {
  mode: CommunicationMode;
  shortcut: PushToTalkShortcut;
  releaseDelayMs: number;
}

const DEFAULT_PUSH_TO_TALK_SHORTCUT: PushToTalkShortcut = {
  code: 'Space',
  ctrlKey: true,
  altKey: false,
  shiftKey: false,
  metaKey: false,
};

const DEFAULT_COMMUNICATION_SETTINGS: CommunicationSettings = {
  mode: 'auto',
  shortcut: DEFAULT_PUSH_TO_TALK_SHORTCUT,
  releaseDelayMs: 200,
};

@Injectable({
  providedIn: 'root',
})
export class WebrtcService {
  // Локальный аудио стрим
  private localAudioStream$ = new BehaviorSubject<MediaStream | null>(null);
  // Локальный screen share стрим
  private localScreenStream$ = new BehaviorSubject<MediaStream | null>(null);
  // Статус микрофона
  private isMuted$ = new BehaviorSubject<boolean>(false);
  // Статус демонстрации экрана
  private isScreenSharing$ = new BehaviorSubject<boolean>(false);
  // Выбранное устройство вывода
  private selectedAudioOutputId$ = new BehaviorSubject<string>('default');
  // Статус доступа к микрофону
  private microphRoobertatus$ = new BehaviorSubject<MicrophRoobertatus>('pending');

  // Peer connections для каждого участника
  private peerConnections = new Map<string, PeerConnectionData>();

  // События
  public onRemoteAudioStream$ = new Subject<{ peerId: string; stream: MediaStream }>();
  public onRemoteScreenStream$ = new Subject<{ peerId: string; stream: MediaStream }>();
  public onPeerDisconnected$ = new Subject<string>();

  // ICE серверы (обновляются динамически из API)
  private rtcConfiguration: RTCConfiguration = {
    iceServers: WEBRTC_CONFIG.ice.iceServers,
    iceCandidatePoolSize: WEBRTC_CONFIG.ice.iceCandidatePoolSize,
  };
  private activeAudioProfile: AudioProfileName = WEBRTC_CONFIG.audio.defaultProfile;
  private activeScreenShareProfile: ScreenShareQuality = WEBRTC_CONFIG.screenShare.defaultProfile;

  private readonly STORAGE_KEY = 'webrtc_audio_settings';
  private readonly DEVICES_STORAGE_KEY = 'webrtc_selected_devices';
  private readonly COMMUNICATION_STORAGE_KEY = 'webrtc_communication_settings';

  // Настройки обработки аудио
  private audioProcessingSettings = this.loadAudioSettings();
  private selectedDevices = this.loadSelectedDevices();
  private communicationSettings = this.loadCommunicationSettings();
  private communicationSettings$ = new BehaviorSubject<CommunicationSettings>(this.communicationSettings);

  constructor(private electronService: ElectronService) {}

  private loadAudioSettings() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        return {
          noiseSuppression: true,
          echoCancellation: true,
          ...JSON.parse(saved),
        };
      }
    } catch (e) {
      console.warn('[WebRTC] Failed to load audio settings', e);
    }
    return {
      noiseSuppression: true,
      echoCancellation: true,
    };
  }

  private loadSelectedDevices() {
    try {
      const saved = localStorage.getItem(this.DEVICES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Инициализируем стрим сохраненным значением
        if (parsed.audioOutputId) {
          this.selectedAudioOutputId$.next(parsed.audioOutputId);
        }
        return parsed;
      }
    } catch (e) {
      console.warn('[WebRTC] Failed to load selected devices', e);
    }
    return {
      audioInputId: 'default',
      audioOutputId: 'default',
    };
  }

  private loadCommunicationSettings(): CommunicationSettings {
    try {
      const saved = localStorage.getItem(this.COMMUNICATION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return this.normalizeCommunicationSettings(parsed);
      }
    } catch (e) {
      console.warn('[WebRTC] Failed to load communication settings', e);
    }
    return this.getDefaultCommunicationSettings();
  }

  private getDefaultCommunicationSettings(): CommunicationSettings {
    return {
      mode: DEFAULT_COMMUNICATION_SETTINGS.mode,
      releaseDelayMs: DEFAULT_COMMUNICATION_SETTINGS.releaseDelayMs,
      shortcut: { ...DEFAULT_COMMUNICATION_SETTINGS.shortcut },
    };
  }

  private normalizeCommunicationSettings(
    settings: Partial<CommunicationSettings> | null | undefined
  ): CommunicationSettings {
    const normalizedShortcut = {
      ...DEFAULT_PUSH_TO_TALK_SHORTCUT,
      ...(settings?.shortcut ?? {}),
    };

    const releaseDelayMs = this.normalizeReleaseDelay(settings?.releaseDelayMs);

    return {
      ...this.getDefaultCommunicationSettings(),
      ...(settings ?? {}),
      shortcut: normalizedShortcut,
      releaseDelayMs,
    };
  }

  private normalizeReleaseDelay(value: number | undefined): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return DEFAULT_COMMUNICATION_SETTINGS.releaseDelayMs;
    }
    return Math.min(1000, Math.max(0, Math.round(value)));
  }

  private cloneCommunicationSettings(
    settings: CommunicationSettings
  ): CommunicationSettings {
    return {
      ...settings,
      shortcut: { ...settings.shortcut },
    };
  }

  private persistCommunicationSettings(settings: CommunicationSettings): void {
    try {
      localStorage.setItem(this.COMMUNICATION_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('[WebRTC] Failed to save communication settings', e);
    }
  }

  private debugLog(...args: unknown[]): void {
    console.log('[WebRTC Debug]', ...args);
  }

  /**
   * Инициализация локального аудио стрима
   * Возвращает null если микрофон недоступен (не выбрасывает ошибку)
   */
  async initializeAudioStream(profile?: AudioProfileName): Promise<MediaStream | null> {
    try {
      if (profile) {
        this.activeAudioProfile = profile;
      }

      const constraints = this.buildAudioConstraints({
        deviceId: this.selectedDevices.audioInputId !== 'default' ? { exact: this.selectedDevices.audioInputId } : undefined,
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: constraints,
        video: false, // БЕЗ ВИДЕО!
      });

      this.localAudioStream$.next(stream);
      this.microphRoobertatus$.next('granted');
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const shouldBeMuted = this.isMuted$.value;
        audioTrack.enabled = !shouldBeMuted;
      }
      this.debugLog('Local audio stream initialized', {
        label: audioTrack?.label,
        settings: audioTrack?.getSettings(),
        constraints: audioTrack?.getConstraints(),
      });
      return stream;
    } catch (error: any) {
      console.warn('[WebRTC] Could not initialize audio stream:', error?.name, error?.message);
      
      // Определяем причину ошибки
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        this.microphRoobertatus$.next('denied');
      } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
        this.microphRoobertatus$.next('not-found');
      } else {
        this.microphRoobertatus$.next('denied');
      }
      
      return null;
    }
  }

  /**
   * Повторная попытка получить доступ к микрофону
   */
  async retryMicrophoneAccess(): Promise<MediaStream | null> {
    this.microphRoobertatus$.next('pending');
    return this.initializeAudioStream();
  }

  /**
   * Обновление настроек обработки аудио
   */
  async updateAudioProcessing(settings: {
    noiseSuppression?: boolean;
    echoCancellation?: boolean;
  }): Promise<void> {
    this.audioProcessingSettings = {
      ...this.audioProcessingSettings,
      ...settings,
    };

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.audioProcessingSettings));
    } catch (e) {
      console.warn('[WebRTC] Failed to save audio settings', e);
    }

    const stream = this.localAudioStream$.value;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        try {
          await audioTrack.applyConstraints(this.buildAudioConstraints());
          this.debugLog('Audio constraints updated', {
            processing: this.audioProcessingSettings,
            trackSettings: audioTrack.getSettings(),
          });
        } catch (error) {
          console.error('[WebRTC Debug] Failed to apply audio constraints:', error);
        }
      }
    }
  }

  /**
   * Получение текущих настроек обработки аудио
   */
  getAudioProcessingSettings() {
    return { ...this.audioProcessingSettings };
  }

  /**
   * Получение текущих настроек коммуникации
   */
  getCommunicationSettings(): CommunicationSettings {
    return this.cloneCommunicationSettings(this.communicationSettings);
  }

  /**
   * Поток изменений настроек коммуникации
   */
  get communicationSettingsChanges() {
    return this.communicationSettings$.asObservable();
  }

  getDefaultPushToTalkShortcut(): PushToTalkShortcut {
    return { ...DEFAULT_PUSH_TO_TALK_SHORTCUT };
  }

  /**
   * Обновление настроек коммуникации
   */
  updateCommunicationSettings(update: Partial<CommunicationSettings>): void {
    const nextShortcut = update.shortcut
      ? {
          ...this.communicationSettings.shortcut,
          ...update.shortcut,
        }
      : this.communicationSettings.shortcut;

    const nextSettings: CommunicationSettings = {
      ...this.communicationSettings,
      ...update,
      shortcut: nextShortcut,
      releaseDelayMs: this.normalizeReleaseDelay(
        update.releaseDelayMs ?? this.communicationSettings.releaseDelayMs
      ),
    };

    this.communicationSettings = nextSettings;
    const snapshot = this.cloneCommunicationSettings(nextSettings);
    this.communicationSettings$.next(snapshot);
    this.persistCommunicationSettings(snapshot);
  }

  /**
   * Начало демонстрации экрана с поддержкой высокого качества
   */
  async startScreenShare(
    quality?: ScreenShareQuality,
    sourceId?: string
  ): Promise<MediaStream> {
    try {
      const selectedProfile = quality ?? this.activeScreenShareProfile;
      const profile = this.getScreenShareProfile(selectedProfile);

      this.activeScreenShareProfile = selectedProfile;

      // Настройки качества
      const constraints: DisplayMediaStreamConstraints = {
        video: {
          width: { ideal: profile.width, max: profile.width },
          height: { ideal: profile.height, max: profile.height },
          frameRate: { ideal: profile.frameRate, max: profile.frameRate },
        },
        audio: this.buildScreenShareAudioConstraints(),
      };

      const stream = this.electronService.isElectronApp()
        ? await this.startElectronScreenCapture(profile, sourceId)
        : await navigator.mediaDevices.getDisplayMedia(constraints);
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        await this.applyScreenTrackConstraints(videoTrack, profile);
        this.applyScreenTrackContentHint(videoTrack, profile);
      }

      // Обработка события остановки демонстрации через UI браузера
      stream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare();
      };

      this.localScreenStream$.next(stream);
      this.isScreenSharing$.next(true);

      this.debugLog('Screen sharing started', {
        quality,
        videoTrack: stream.getVideoTracks()[0].getSettings(),
      });

      return stream;
    } catch (error) {
      console.error('[WebRTC Debug] Error starting screen share:', error);
      throw new Error('Не удалось начать демонстрацию экрана');
    }
  }

  private async startElectronScreenCapture(
    profile: ReturnType<WebrtcService['getScreenShareProfile']>,
    sourceId?: string
  ): Promise<MediaStream> {
    if (!sourceId) {
      throw new Error('Источник экрана не выбран');
    }

    try {
      return await navigator.mediaDevices.getUserMedia(
        this.buildElectronMediaConstraints(profile, sourceId, true)
      );
    } catch (error) {
      console.warn(
        '[WebRTC] Electron capture with audio failed, retrying without audio',
        error
      );
      return navigator.mediaDevices.getUserMedia(
        this.buildElectronMediaConstraints(profile, sourceId, false)
      );
    }
  }

  private buildElectronMediaConstraints(
    profile: ReturnType<WebrtcService['getScreenShareProfile']>,
    sourceId: string,
    includeAudio: boolean
  ): MediaStreamConstraints {
    const videoConstraints: ChromeDesktopVideoConstraint = {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
        maxFrameRate: profile.frameRate,
        maxWidth: profile.width,
        maxHeight: profile.height,
      },
    };

    const constraints: MediaStreamConstraints = {
      video: videoConstraints,
    };

    if (includeAudio) {
      const audioConstraints: ChromeDesktopAudioConstraint = {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
        },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };
      constraints.audio = audioConstraints;
    } else {
      constraints.audio = false;
    }

    return constraints;
  }

  /**
   * Остановка демонстрации экрана
   */
  stopScreenShare(): void {
    const screenStream = this.localScreenStream$.value;
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      this.localScreenStream$.next(null);
      this.isScreenSharing$.next(false);
      this.debugLog('Screen sharing stopped');
    }
  }

  /**
   * Включение/выключение микрофона
   */
  toggleMute(): boolean {
    const nextState = !this.isMuted$.value;
    return this.setMuteState(nextState);
  }

  /**
   * Принудительно установить состояние микрофона
   */
  setMuteState(muted: boolean): boolean {
    const audioStream = this.localAudioStream$.value;
    const audioTrack = audioStream?.getAudioTracks()[0];

    if (audioTrack) {
      audioTrack.enabled = !muted;
      this.debugLog('Microphone state updated', {
        enabled: audioTrack.enabled,
        readyState: audioTrack.readyState,
        muted: audioTrack.muted,
      });
    }

    this.isMuted$.next(muted);
    return muted;
  }

  /**
   * Создание peer connection для нового участника
   */
  createPeerConnection(
    peerId: string,
    userId: string,
    username: string,
    onIceCandidate: (candidate: RTCIceCandidate) => void
  ): RTCPeerConnection {
    const connection = new RTCPeerConnection(this.rtcConfiguration);

    // Добавляем локальный аудио трек
    const audioStream = this.localAudioStream$.value;
    if (audioStream) {
      audioStream.getTracks().forEach((track) => {
        const sender = connection.addTrack(track, audioStream);
        this.applyAudioSenderParameters(sender);
      });
    }

    // Добавляем screen share трек если активен
    const screenStream = this.localScreenStream$.value;
    if (screenStream) {
      screenStream.getTracks().forEach((track) => {
        const sender = connection.addTrack(track, screenStream);
        this.applyScreenSenderParameters(sender);
      });
    }

    // Обработка ICE candidates
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.debugLog('Local ICE candidate generated', {
          peerId,
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        });
        onIceCandidate(event.candidate);
      } else {
        this.debugLog('ICE gathering completed for peer', peerId);
      }
    };

    // Обработка входящих треков
    connection.ontrack = (event) => {
      this.debugLog('Remote track received', {
        peerId,
        kind: event.track.kind,
        trackId: event.track.id,
        label: event.track.label,
        muted: event.track.muted,
        readyState: event.track.readyState,
        streamId: event.streams[0]?.id,
      });

      const stream = event.streams[0];
      const peerData = this.peerConnections.get(peerId);

      if (event.track.kind === 'audio') {
        if (this.isScreenShareAudioTrack(peerData, stream, event.track)) {
          if (peerData) {
            peerData.screenStream = peerData.screenStream ?? stream;
            peerData.isScreenSharing = true;
          }
          this.onRemoteScreenStream$.next({ peerId, stream });
          return;
        }
        this.tuneAudioReceiver(event.receiver);
        // Аудио стрим
        if (peerData) {
          peerData.audioStream = stream;
        }
        this.onRemoteAudioStream$.next({ peerId, stream });
      } else if (event.track.kind === 'video') {
        // Screen share стрим
        if (peerData) {
          peerData.screenStream = stream;
          peerData.isScreenSharing = true;
        }
        this.onRemoteScreenStream$.next({ peerId, stream });
      }
    };

    // Обработка изменения состояния соединения
    connection.onconnectionstatechange = () => {
      this.debugLog('RTCPeerConnection state changed', {
        peerId,
        connectionState: connection.connectionState,
        iceConnectionState: connection.iceConnectionState,
        signalingState: connection.signalingState,
      });

      if (
        connection.connectionState === 'disconnected' ||
        connection.connectionState === 'failed' ||
        connection.connectionState === 'closed'
      ) {
        this.removePeerConnection(peerId);
      }
    };

    // Обработка изменения ICE состояния
    connection.oniceconnectionstatechange = () => {
      this.debugLog('ICE connection state changed', {
        peerId,
        state: connection.iceConnectionState,
      });
    };

    // Сохраняем peer connection
    this.peerConnections.set(peerId, {
      peerId,
      userId,
      username,
      connection,
      isScreenSharing: false,
      isMuted: false,
    });

    return connection;
  }

  /**
   * Создание offer
   */
  async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const peerData = this.peerConnections.get(peerId);
    if (!peerData) {
      throw new Error('Peer connection not found');
    }

    const offer = await peerData.connection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true, // Для screen share
    });

    if (offer.sdp) {
      offer.sdp = this.setPreferredCodec(offer.sdp);
    }

    await peerData.connection.setLocalDescription(offer);
    return offer;
  }

  /**
   * Создание answer
   */
  async createAnswer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const peerData = this.peerConnections.get(peerId);
    if (!peerData) {
      throw new Error('Peer connection not found');
    }

    const answer = await peerData.connection.createAnswer();

    if (answer.sdp) {
      answer.sdp = this.setPreferredCodec(answer.sdp);
    }

    await peerData.connection.setLocalDescription(answer);
    return answer;
  }

  /**
   * Установка remote description
   */
  async setRemoteDescription(
    peerId: string,
    description: RTCSessionDescriptionInit
  ): Promise<void> {
    const peerData = this.peerConnections.get(peerId);
    if (!peerData) {
      throw new Error('Peer connection not found');
    }

    await peerData.connection.setRemoteDescription(new RTCSessionDescription(description));
  }

  /**
   * Добавление ICE candidate
   */
  async addIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peerData = this.peerConnections.get(peerId);
    if (!peerData) {
      console.warn('[WebRTC] Peer connection not found for ICE candidate:', peerId);
      return;
    }

    try {
      await peerData.connection.addIceCandidate(new RTCIceCandidate(candidate));
      this.debugLog('Remote ICE candidate added', {
        peerId,
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
      });
    } catch (error) {
      console.error('[WebRTC Debug] Error adding ICE candidate:', error);
    }
  }

  /**
   * Добавление screen share трека к существующим connections
   */
  async addScreenShareToConnections(screenStream: MediaStream): Promise<void> {
    for (const [peerId, peerData] of this.peerConnections) {
      screenStream.getTracks().forEach((track) => {
        const sender = peerData.connection.addTrack(track, screenStream);
        this.applyScreenSenderParameters(sender);
      });
    }
  }

  /**
   * Удаление screen share трека из всех connections
   */
  removeScreenShareFromConnections(): void {
    for (const [peerId, peerData] of this.peerConnections) {
      const senders = peerData.connection.getSenders();
      senders.forEach((sender) => {
        if (sender.track?.kind === 'video' && sender.track.label.includes('screen')) {
          peerData.connection.removeTrack(sender);
        }
      });
    }
  }

  /**
   * Удаление peer connection
   */
  removePeerConnection(peerId: string): void {
    const peerData = this.peerConnections.get(peerId);
    if (peerData) {
      peerData.connection.close();
      this.peerConnections.delete(peerId);
      this.onPeerDisconnected$.next(peerId);
      console.log('[WebRTC] Peer connection removed:', peerId);
    }
  }

  /**
   * Очистка всех соединений
   */
  cleanup(): void {
    // Останавливаем локальные стримы
    const audioStream = this.localAudioStream$.value;
    if (audioStream) {
      audioStream.getTracks().forEach((track) => track.stop());
    }

    const screenStream = this.localScreenStream$.value;
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
    }

    // Закрываем все peer connections
    for (const [peerId, peerData] of this.peerConnections) {
      peerData.connection.close();
    }

    this.peerConnections.clear();
    this.localAudioStream$.next(null);
    this.localScreenStream$.next(null);
    this.isMuted$.next(false);
    this.isScreenSharing$.next(false);
    this.microphRoobertatus$.next('pending');

    console.log('[WebRTC] All connections cleaned up');
  }

  /**
   * Получение списка аудио устройств
   */
  async getAudioDevices(): Promise<{
    input: MediaDeviceInfo[];
    output: MediaDeviceInfo[];
  }> {
    // Запрашиваем доступ к микрофону чтобы получить лейблы устройств
    if (!this.localAudioStream$.value) {
        try {
           // Создаем временный поток только если нет активного, чтобы получить права
           const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
           tempStream.getTracks().forEach(t => t.stop());
        } catch (e) {
            console.warn('[WebRTC] Could not get permissions for device enumeration', e);
        }
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      input: devices.filter((device) => device.kind === 'audioinput'),
      output: devices.filter((device) => device.kind === 'audiooutput'),
    };
  }

  /**
   * Получение текущих выбранных устройств
   */
  getSelectedDevices() {
    return { ...this.selectedDevices };
  }

  /**
   * Установка устройства вывода
   */
  async setAudioOutputDevice(deviceId: string): Promise<void> {
    this.selectedDevices.audioOutputId = deviceId;
    this.selectedAudioOutputId$.next(deviceId);
    this.saveSelectedDevices();
    this.debugLog('Audio output device selected', deviceId);
  }

  /**
   * Смена аудио устройства ввода
   */
  async switchAudioDevice(deviceId: string): Promise<void> {
    this.selectedDevices.audioInputId = deviceId;
    this.saveSelectedDevices();

    const currentStream = this.localAudioStream$.value;
    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop());
    }

    try {
        const newStream = await navigator.mediaDevices.getUserMedia({
            audio: this.buildAudioConstraints({
                deviceId: deviceId !== 'default' ? { exact: deviceId } : undefined,
            }),
        });

        this.localAudioStream$.next(newStream);

        // Обновляем треки во всех peer connections
        for (const [peerId, peerData] of this.peerConnections) {
            const senders = peerData.connection.getSenders();
            const audioSender = senders.find((s) => s.track?.kind === 'audio');
            if (audioSender && newStream.getAudioTracks()[0]) {
                audioSender.replaceTrack(newStream.getAudioTracks()[0]);
                this.applyAudioSenderParameters(audioSender);
            }
        }
        this.debugLog('Audio input device switched', deviceId);
    } catch (error) {
        console.error('[WebRTC] Failed to switch input device', error);
        throw error;
    }
  }

  private saveSelectedDevices() {
    try {
      localStorage.setItem(this.DEVICES_STORAGE_KEY, JSON.stringify(this.selectedDevices));
    } catch (e) {
      console.warn('[WebRTC] Failed to save selected devices', e);
    }
  }

  /**
   * Модификация SDP для установки приоритетного кодека (Opus) и его параметров
   */
  private setPreferredCodec(sdp: string): string {
    const codec = WEBRTC_CONFIG.audio.codec;
    const sdpLines = sdp.split('\r\n');
    const mLineIndex = sdpLines.findIndex((line) => line.startsWith('m=audio'));

    if (mLineIndex === -1) {
      return sdp;
    }

    // 1. Находим payload type для Opus
    let opusPayloadType: string | null = null;
    const rtpmapRegex = new RegExp(`a=rtpmap:(\\d+) ${codec}/\\d+`, 'i');

    for (const line of sdpLines) {
      const match = line.match(rtpmapRegex);
      if (match) {
        opusPayloadType = match[1];
        break;
      }
    }

    if (!opusPayloadType) {
      console.warn('[WebRTC] Opus codec not found in SDP');
      return sdp;
    }

    // 2. Перемещаем Opus в начало списка кодеков в m-line
    const mLine = sdpLines[mLineIndex];
    const [prefix, port, proto, ...codecs] = mLine.split(' ');

    const otherCodecs = codecs.filter((c) => c !== opusPayloadType);
    const newMLine = `${prefix} ${port} ${proto} ${opusPayloadType} ${otherCodecs.join(' ')}`;
    sdpLines[mLineIndex] = newMLine;

    // 3. Добавляем или обновляем параметры кодека (fmtp)
    const fmtpLineIndex = sdpLines.findIndex((line) =>
      line.startsWith(`a=fmtp:${opusPayloadType}`)
    );
    let fmtpParams = '';

    // Формируем строку параметров из конфига
    const params = Object.entries(this.getAudioProfile().opusParams)
      .map(([key, value]) => `${key}=${value}`)
      .join(';');

    if (fmtpLineIndex !== -1) {
      // Если строка fmtp уже есть, обновляем её
      sdpLines[fmtpLineIndex] = `a=fmtp:${opusPayloadType} ${params}`;
    } else {
      // Если нет, добавляем после rtpmap
      const rtpmapIndex = sdpLines.findIndex((line) =>
        line.startsWith(`a=rtpmap:${opusPayloadType}`)
      );
      if (rtpmapIndex !== -1) {
        sdpLines.splice(rtpmapIndex + 1, 0, `a=fmtp:${opusPayloadType} ${params}`);
      }
    }

    return sdpLines.join('\r\n');
  }

  // Геттеры для observables
  get localAudioStream() {
    return this.localAudioStream$.asObservable();
  }

  get localScreenStream() {
    return this.localScreenStream$.asObservable();
  }

  get isMuted() {
    return this.isMuted$.asObservable();
  }

  get isScreenSharing() {
    return this.isScreenSharing$.asObservable();
  }

  get selectedAudioOutputId() {
    return this.selectedAudioOutputId$.asObservable();
  }

  get microphRoobertatus() {
    return this.microphRoobertatus$.asObservable();
  }

  getMicrophRoobertatusValue(): MicrophRoobertatus {
    return this.microphRoobertatus$.value;
  }

  getPeerConnections(): Map<string, PeerConnectionData> {
    return this.peerConnections;
  }

  getPeerConnection(peerId: string): PeerConnectionData | undefined {
    return this.peerConnections.get(peerId);
  }

  configureIceServers(iceServers: RTCIceServer[]): void {
    if (!iceServers?.length) {
      return;
    }

    this.rtcConfiguration = {
      ...this.rtcConfiguration,
      iceServers,
    };

    this.debugLog('ICE server list updated', iceServers.map((server) => server.urls));
  }

  private getAudioProfile() {
    return WEBRTC_CONFIG.audio.profiles[this.activeAudioProfile];
  }

  getScreenShareProfiles() {
    return WEBRTC_CONFIG.screenShare.profiles;
  }

  getDefaultScreenShareQuality(): ScreenShareQuality {
    return WEBRTC_CONFIG.screenShare.defaultProfile;
  }

  setScreenShareQuality(profile: ScreenShareQuality) {
    if (WEBRTC_CONFIG.screenShare.profiles[profile]) {
      this.activeScreenShareProfile = profile;
    }
  }

  private getScreenShareProfile(profile?: ScreenShareQuality) {
    const target = profile ?? this.activeScreenShareProfile;
    return (
      WEBRTC_CONFIG.screenShare.profiles[target] ||
      WEBRTC_CONFIG.screenShare.profiles[WEBRTC_CONFIG.screenShare.defaultProfile]
    );
  }

  private buildAudioConstraints(overrides?: MediaTrackConstraints): MediaTrackConstraints {
    const profileConstraints = this.getAudioProfile().constraints;

    // Применяем настройки шумоподавления и эхоподавления поверх профиля
    const processingConstraints: MediaTrackConstraints = {
      echoCancellation: this.audioProcessingSettings.echoCancellation,
      noiseSuppression: this.audioProcessingSettings.noiseSuppression,
    };

    return {
      ...profileConstraints,
      ...processingConstraints,
      ...overrides,
    } as MediaTrackConstraints;
  }

  private applyAudioSenderParameters(sender: RTCRtpSender): void {
    if (sender.track?.kind !== 'audio') {
      return;
    }

    const senderConfig = this.getAudioProfile().sender;
    if (!senderConfig) {
      return;
    }

    try {
      const params = sender.getParameters();
      const encoding = (params.encodings?.[0] ?? {}) as RTCRtpEncodingParameters & {
        dtx?: boolean;
      };
      encoding.maxBitrate = senderConfig.maxBitrate;
      encoding.priority = senderConfig.priority;
      encoding.networkPriority = senderConfig.networkPriority;
      encoding.dtx = senderConfig.dtx;
      params.encodings = [encoding];
      sender.setParameters(params).catch((error) => {
        console.warn('[WebRTC] Unable to apply audio sender params', error);
      });
    } catch (error) {
      console.warn('[WebRTC] Failed to configure audio sender', error);
    }
  }

  private tuneAudioReceiver(receiver: RTCRtpReceiver): void {
    const receiverConfig = this.getAudioProfile().receiver;
    if (!receiverConfig) {
      return;
    }

    const receiverAny = receiver as RTCRtpReceiver & {
      jitterBufferTarget?: number;
      playoutDelayHint?: number;
    };

    if (
      typeof receiverConfig.jitterBufferTargetMs === 'number' &&
      'jitterBufferTarget' in receiverAny
    ) {
      receiverAny.jitterBufferTarget = receiverConfig.jitterBufferTargetMs / 1000;
    }

    if (
      typeof receiverConfig.playoutDelayHintMs === 'number' &&
      'playoutDelayHint' in receiverAny
    ) {
      receiverAny.playoutDelayHint = receiverConfig.playoutDelayHintMs / 1000;
    }
  }

  private async applyScreenTrackConstraints(
    track: MediaStreamTrack,
    profile: ReturnType<WebrtcService['getScreenShareProfile']>
  ): Promise<void> {
    try {
      await track.applyConstraints({
        width: { ideal: profile.width, max: profile.width },
        height: { ideal: profile.height, max: profile.height },
        frameRate: { ideal: profile.frameRate, max: profile.frameRate },
        aspectRatio: { ideal: profile.width / profile.height },
      });
    } catch (error) {
      console.warn('[WebRTC] Failed to enforce screen constraints', error);
    }
  }

  private applyScreenTrackContentHint(
    track: MediaStreamTrack,
    profile: ReturnType<WebrtcService['getScreenShareProfile']>
  ): void {
    try {
      if ('contentHint' in track) {
        track.contentHint = profile.contentHint;
      }
    } catch {
      // ignore
    }
  }

  private applyScreenSenderParameters(sender: RTCRtpSender): void {
    if (sender.track?.kind !== 'video') {
      return;
    }

    const profile = this.getScreenShareProfile();

    try {
      const params = sender.getParameters();
      const encoding = params.encodings?.[0] ?? {};
      encoding.maxBitrate = profile.maxBitrate;
      encoding.maxFramerate = profile.frameRate;
      encoding.priority = 'high';
      encoding.scaleResolutionDownBy = 1;
      params.degradationPreference = 'maintain-framerate';
      params.encodings = [encoding];
      sender
        .setParameters(params)
        .catch((error) => console.warn('[WebRTC] Unable to apply screen sender params', error));
    } catch (error) {
      console.warn('[WebRTC] Failed to configure screen sender', error);
    }
  }

  private buildScreenShareAudioConstraints(): DisplayMediaAudioConstraints {
    const supported = this.getSupportedDisplayConstraints();
    const constraints: DisplayMediaAudioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };

    if (supported?.suppressLocalAudioPlayback) {
      constraints.suppressLocalAudioPlayback = true;
    }
    if (supported?.systemAudio) {
      constraints.systemAudio = 'include';
    }
    if (supported?.selfBrowserSurface) {
      constraints.selfBrowserSurface = 'exclude';
    }

    return constraints;
  }

  private getSupportedDisplayConstraints(): SupportedDisplayConstraintSet | undefined {
    return typeof navigator !== 'undefined' && navigator.mediaDevices?.getSupportedConstraints
      ? (navigator.mediaDevices.getSupportedConstraints() as SupportedDisplayConstraintSet)
      : undefined;
  }

  private isScreenShareAudioTrack(
    peerData: PeerConnectionData | undefined,
    stream: MediaStream,
    track: MediaStreamTrack
  ): boolean {
    if (!stream) {
      return false;
    }

    if (peerData?.screenStream && peerData.screenStream.id === stream.id) {
      return true;
    }

    if (stream.getVideoTracks().length > 0) {
      return true;
    }

    const label = (track.label || '').toLowerCase();
    return label.includes('screen') || label.includes('display') || label.includes('system audio');
  }
}
