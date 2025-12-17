import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';
import type { LinkPreview } from '../models/link-preview.model';

export interface RoomParticipant extends Partial<User> {
  id: string; // Mapped from userId
  socketId?: string;
  webrtcSocketId?: string;
}

export interface WebrtcParticipant extends Partial<User> {
  socketId: string;
  id: string; // Mapped from userId
}

export interface WebRTCSignal {
  fromSocketId: string;
  fromUserId: string;
  fromUsername?: string;
  fromDisplayName?: string;
  roomId: string;
  signal: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

export interface ChatMessage {
  id: string;
  content: string;
  files?: {
    url: string;
    name: string;
    size: number;
    type: string;
  }[];
  linkPreview?: LinkPreview | null;
  createdAt: Date;
  user: User;
}

@Injectable({
  providedIn: 'root',
})
export class WebsocketService {
  private signalingSocket: Socket | null = null;
  private webrtcSocket: Socket | null = null;
  private chatSocket: Socket | null = null;

  private readonly WS_URL = environment.wsUrl;

  // Статус соединений
  private signalingConnected$ = new BehaviorSubject<boolean>(false);
  private webrtcConnected$ = new BehaviorSubject<boolean>(false);
  private chatConnected$ = new BehaviorSubject<boolean>(false);

  // События комнаты
  public roomJoined$ = new Subject<{ roomId: string; participants: RoomParticipant[] }>();
  public userJoined$ = new Subject<RoomParticipant>();
  public userLeft$ = new Subject<RoomParticipant>();
  public userUpdated$ = new Subject<RoomParticipant>();

  // WebRTC участники
  public webrtcParticipantJoined$ = new Subject<WebrtcParticipant>();
  public webrtcParticipantLeft$ = new Subject<{ socketId: string; userId?: string }>();

  // WebRTC события
  public webrtcOffer$ = new Subject<WebRTCSignal>();
  public webrtcAnswer$ = new Subject<WebRTCSignal>();
  public webrtcIceCandidate$ = new Subject<WebRTCSignal>();

  // События медиа
  public audioStatusChanged$ = new Subject<{
    socketId: string;
    userId: string;
    enabled: boolean;
  }>();
  public screenShareStarted$ = new Subject<{
    socketId: string;
    userId: string;
    username: string;
  }>();
  public screenShareStopped$ = new Subject<{ socketId: string; userId: string }>();

  // Чат события
  public chatMessage$ = new Subject<ChatMessage>();

  /**
   * Подключение к Signaling namespace
   */
  connectSignaling(): void {
    if (this.signalingSocket?.connected) {
      console.log('[WebSocket] Signaling already connected');
      return;
    }

    this.signalingSocket = io(`${this.WS_URL}/signaling`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.signalingSocket.on('connect', () => {
      console.log('[WebSocket] Signaling connected:', this.signalingSocket?.id);
      this.signalingConnected$.next(true);
    });

    this.signalingSocket.on('disconnect', (reason) => {
      console.log('[WebSocket] Signaling disconnected:', reason);
      this.signalingConnected$.next(false);
    });

    this.signalingSocket.on('connect_error', (error) => {
      console.error('[WebSocket] Signaling connection error:', error);
    });

    // События комнаты
    this.signalingSocket.on('room-joined', (data: { roomId: string; participants: any[] }) => {
      console.log('[WebSocket] Room joined:', data);
      const participants = (data.participants || []).map((participant) =>
        this.normalizeParticipant(participant)
      );
      this.roomJoined$.next({
        roomId: data.roomId,
        participants,
      });
    });

    this.signalingSocket.on('user-joined', (data: any) => {
      console.log('[WebSocket] User joined:', data);
      this.userJoined$.next(this.normalizeParticipant(data));
    });

    this.signalingSocket.on('user-left', (data: any) => {
      console.log('[WebSocket] User left:', data);
      this.userLeft$.next(this.normalizeParticipant(data));
    });

    this.signalingSocket.on('user-updated', (data: any) => {
      console.log('[WebSocket] User updated:', data);
      this.userUpdated$.next(this.normalizeParticipant(data));
    });
  }

  /**
   * Подключение к WebRTC namespace
   */
  connectWebRTC(): void {
    if (this.webrtcSocket?.connected) {
      console.log('[WebSocket] WebRTC already connected');
      return;
    }

    this.webrtcSocket = io(`${this.WS_URL}/webrtc`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.webrtcSocket.on('connect', () => {
      console.log('[WebSocket] WebRTC connected:', this.webrtcSocket?.id);
      this.webrtcConnected$.next(true);
    });

    this.webrtcSocket.on('disconnect', (reason) => {
      console.log('[WebSocket] WebRTC disconnected:', reason);
      this.webrtcConnected$.next(false);
    });

    this.webrtcSocket.on('connect_error', (error) => {
      console.error('[WebSocket] WebRTC connection error:', error);
    });

    // WebRTC сигналы
    this.webrtcSocket.on('webrtc:offer', (data: WebRTCSignal) => {
      console.log('[WebSocket] Received offer from:', data.fromSocketId);
      this.webrtcOffer$.next(data);
    });

    this.webrtcSocket.on('webrtc:answer', (data: WebRTCSignal) => {
      console.log('[WebSocket] Received answer from:', data.fromSocketId);
      this.webrtcAnswer$.next(data);
    });

    this.webrtcSocket.on('webrtc:ice-candidate', (data: WebRTCSignal) => {
      console.log('[WebSocket] Received ICE candidate from:', data.fromSocketId);
      this.webrtcIceCandidate$.next(data);
    });

    // События медиа
    this.webrtcSocket.on(
      'webrtc:audio-status',
      (data: { socketId: string; userId: string; enabled: boolean }) => {
        console.log('[WebSocket] Audio status changed:', data);
        this.audioStatusChanged$.next(data);
      }
    );

    this.webrtcSocket.on(
      'webrtc:screen-share-started',
      (data: { socketId: string; userId: string; username: string }) => {
        console.log('[WebSocket] Screen share started:', data);
        this.screenShareStarted$.next(data);
      }
    );

    this.webrtcSocket.on(
      'webrtc:screen-share-stopped',
      (data: { socketId: string; userId: string }) => {
        console.log('[WebSocket] Screen share stopped:', data);
        this.screenShareStopped$.next(data);
      }
    );

    this.webrtcSocket.on('webrtc:participant-joined', (data: any) => {
      console.log('[WebSocket] WebRTC participant joined:', data);
      this.webrtcParticipantJoined$.next({
        ...data,
        id: data.userId || data.id,
      });
    });

    this.webrtcSocket.on(
      'webrtc:participant-left',
      (data: { socketId: string; userId?: string }) => {
        console.log('[WebSocket] WebRTC participant left:', data);
        this.webrtcParticipantLeft$.next(data);
      }
    );
  }

  /**
   * Подключение к Chat namespace
   */
  connectChat(): void {
    if (this.chatSocket?.connected) {
      console.log('[WebSocket] Chat already connected');
      return;
    }

    this.chatSocket = io(`${this.WS_URL}/chat`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.chatSocket.on('connect', () => {
      console.log('[WebSocket] Chat connected:', this.chatSocket?.id);
      this.chatConnected$.next(true);
    });

    this.chatSocket.on('disconnect', (reason) => {
      console.log('[WebSocket] Chat disconnected:', reason);
      this.chatConnected$.next(false);
    });

    this.chatSocket.on('connect_error', (error) => {
      console.error('[WebSocket] Chat connection error:', error);
    });

    this.chatSocket.on('new-message', (message: ChatMessage) => {
      console.log('[WebSocket] New chat message:', message);
      this.chatMessage$.next(message);
    });
  }

  /**
   * Присоединение к комнате
   */
  joinRoom(roomId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.signalingSocket) {
        reject(new Error('Signaling socket not connected'));
        return;
      }

      this.signalingSocket.emit('join-room', { roomId }, (response: any) => {
        if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.message || 'Failed to join room'));
        }
      });
    });
  }

  /**
   * Выход из комнаты
   */
  leaveRoom(roomId: string): void {
    if (this.signalingSocket) {
      this.signalingSocket.emit('leave-room', { roomId });
    }
  }

  /**
   * Присоединение к WebRTC комнате
   */
  joinWebRTCRoom(roomId: string): Promise<{ participants: WebrtcParticipant[] }> {
    return new Promise((resolve, reject) => {
      if (!this.webrtcSocket) {
        reject(new Error('WebRTC socket not connected'));
        return;
      }

      this.webrtcSocket.emit('webrtc:join-room', { roomId }, (response: any) => {
        if (response?.success) {
          const participants = (response.participants || []).map((p: any) => ({
            ...p,
            id: p.userId || p.id,
          }));
          resolve({ participants });
        } else {
          reject(new Error(response?.message || 'Failed to join WebRTC room'));
        }
      });
    });
  }

  /**
   * Выход из WebRTC комнаты
   */
  leaveWebRTCRoom(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.webrtcSocket) {
        resolve();
        return;
      }

      this.webrtcSocket.emit('webrtc:leave-room', {}, (response: any) => {
        if (!response || response.success) {
          resolve();
        } else {
          reject(new Error(response?.message || 'Failed to leave WebRTC room'));
        }
      });
    });
  }

  /**
   * Получение списка участников
   */
  getParticipants(roomId: string): Promise<RoomParticipant[]> {
    return new Promise((resolve, reject) => {
      if (!this.signalingSocket) {
        reject(new Error('Signaling socket not connected'));
        return;
      }

      this.signalingSocket.emit('get-participants', { roomId }, (response: any) => {
        if (response?.success) {
          resolve(response.participants);
        } else {
          reject(new Error('Failed to get participants'));
        }
      });
    });
  }

  /**
   * Отправка WebRTC offer
   */
  sendOffer(roomId: string, targetSocketId: string, signal: RTCSessionDescriptionInit): void {
    if (this.webrtcSocket) {
      this.webrtcSocket.emit('webrtc:offer', {
        roomId,
        targetSocketId,
        signal,
      });
    }
  }

  /**
   * Отправка WebRTC answer
   */
  sendAnswer(roomId: string, targetSocketId: string, signal: RTCSessionDescriptionInit): void {
    if (this.webrtcSocket) {
      this.webrtcSocket.emit('webrtc:answer', {
        roomId,
        targetSocketId,
        signal,
      });
    }
  }

  /**
   * Отправка ICE candidate
   */
  sendIceCandidate(roomId: string, targetSocketId: string, signal: RTCIceCandidateInit): void {
    if (this.webrtcSocket) {
      this.webrtcSocket.emit('webrtc:ice-candidate', {
        roomId,
        targetSocketId,
        signal,
      });
    }
  }

  /**
   * Уведомление об изменении статуса аудио
   */
  toggleAudio(roomId: string, enabled: boolean): void {
    if (this.webrtcSocket) {
      this.webrtcSocket.emit('webrtc:toggle-audio', { roomId, enabled });
    }
  }

  /**
   * Уведомление о начале демонстрации экрана
   */
  startScreenShare(roomId: string): void {
    if (this.webrtcSocket) {
      this.webrtcSocket.emit('webrtc:start-screen-share', { roomId });
    }
  }

  /**
   * Уведомление об остановке демонстрации экрана
   */
  stopScreenShare(roomId: string): void {
    if (this.webrtcSocket) {
      this.webrtcSocket.emit('webrtc:stop-screen-share', { roomId });
    }
  }

  /**
   * Присоединение к чату комнаты
   */
  joinChatRoom(roomId: string): Promise<{ messages: ChatMessage[] }> {
    return new Promise((resolve, reject) => {
      if (!this.chatSocket) {
        reject(new Error('Chat socket not connected'));
        return;
      }

      this.chatSocket.emit('join-room', { roomId }, (response: any) => {
        if (response?.success) {
          resolve({ messages: response.messages || [] });
        } else {
          reject(new Error(response?.message || 'Failed to join chat room'));
        }
      });
    });
  }

  /**
   * Отправка сообщения в чат
   */
  sendChatMessage(
    roomId: string,
    content: string,
    files?: { url: string; name: string; size: number; type: string }[],
    disableLinkPreview?: boolean
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.chatSocket) {
        reject(new Error('Chat socket not connected'));
        return;
      }

      this.chatSocket.emit('send-message', { roomId, content, files, disableLinkPreview }, (response: any) => {
        if (response?.success) {
          resolve();
        } else {
          reject(new Error(response?.message || 'Failed to send message'));
        }
      });
    });
  }

  /**
   * Отключение от всех namespace'ов
   */
  disconnectAll(): void {
    if (this.signalingSocket) {
      this.signalingSocket.disconnect();
      this.signalingSocket = null;
      this.signalingConnected$.next(false);
    }

    if (this.webrtcSocket) {
      this.webrtcSocket.disconnect();
      this.webrtcSocket = null;
      this.webrtcConnected$.next(false);
    }

    if (this.chatSocket) {
      this.chatSocket.disconnect();
      this.chatSocket = null;
      this.chatConnected$.next(false);
    }

    console.log('[WebSocket] All connections closed');
  }

  // Геттеры для статуса соединений
  private normalizeParticipant(participant: any): RoomParticipant {
    return {
      id: participant?.userId || participant?.id,
      username: participant?.username,
      displayName: participant?.displayName,
      avatarUrl: participant?.avatarUrl,
      decorationUrl: participant?.decorationUrl,
      socketId: participant?.socketId,
      webrtcSocketId: participant?.webrtcSocketId,
      email: participant?.email, // If available
      isActive: participant?.isActive, // If available
      createdAt: participant?.createdAt, // If available
      updatedAt: participant?.updatedAt, // If available
    };
  }

  get isSignalingConnected(): Observable<boolean> {
    return this.signalingConnected$.asObservable();
  }

  get isWebRTCConnected(): Observable<boolean> {
    return this.webrtcConnected$.asObservable();
  }

  get isChatConnected(): Observable<boolean> {
    return this.chatConnected$.asObservable();
  }

  getSignalingSocketId(): string | undefined {
    return this.signalingSocket?.id;
  }

  getWebRTCSocketId(): string | undefined {
    return this.webrtcSocket?.id;
  }
}
