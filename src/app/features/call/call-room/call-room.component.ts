import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChildren,
  QueryList,
  ViewChild,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import {
  Subject,
  takeUntil,
  firstValueFrom,
  combineLatest,
  Subscription,
  filter,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  of,
  map,
  catchError,
  finalize,
} from 'rxjs';
import { UploadService } from '../../../core/services/upload.service';
import { WebrtcService, MicrophRoobertatus } from '../../../core/services/webrtc.service';
import {
  WebsocketService,
  RoomParticipant,
  WebrtcParticipant,
  ChatMessage,
} from '../../../core/services/websocket.service';
import {
  ElectronService,
  ElectronScreenSource,
} from '../../../core/services/electron.service';
import { PushToTalkService } from '../../../core/services/push-to-talk.service';
import { WebrtcApiService } from '../../../core/services/webrtc-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.model';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import {
  MediaViewerModalComponent,
  MediaItem,
} from '../components/media-viewer-modal/media-viewer-modal.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { TooltipDirective } from '../../../shared/components/tooltip/tooltip.directive';
import { NotificationComponent } from '../../../shared/components/notification/notification.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { LogoComponent } from '../../../shared/components/logo/logo.component';
import {
  ContextMenuComponent,
  ContextMenuItem,
  ContextMenuPosition,
} from '../../../shared/components/context-menu/context-menu.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { LinkifyPipe } from '../../../shared/pipes/linkify.pipe';
import { LinkifyService } from '../../../shared/utils/linkify.service';
import { LinkPreviewComponent } from '../../../shared/components/link-preview/link-preview.component';
import { ChatInputComponent } from '../chat-input/chat-input.component';
import { ParticipantMenuService } from '../services/participant-menu.service';
import { VolumePreferencesService } from '../../../core/services/volume-preferences.service';
import { ScreenShareQuality } from '../../../core/config/webrtc.config';
import { RouterOutlet } from '@angular/router';
import { LinkPreviewService } from '../../../core/services/link-preview.service';
import type { LinkPreview } from '../../../core/models/link-preview.model';
import { PageMetaService } from '../../../core/services/page-meta.service';
import { formatShortcutLabel } from '../../../shared/utils/shortcut.utils';
import {
  LucideAngularModule,
  X,
  Link,
  LogOut,
  MessageSquare,
  Plus,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Monitor,
  Users,
  Settings,
  ArrowUp,
  Paperclip,
  File,
  Download,
  Loader2,
  Zap,
  Maximize,
  Check,
  RefreshCcw,
  AppWindow,
  MonitorUp,
  AlertTriangle,
} from 'lucide-angular';
import { environment } from '../../../../environments/environment';

interface RemotePeer extends Partial<User> {
  socketId: string;
  id: string; // Mapped from userId
  isMuted: boolean;
  isScreenSharing: boolean;
  audioStream?: MediaStream;
  screenStream?: MediaStream;
}

interface ScreenShareOption {
  id: ScreenShareQuality;
  label: string;
  description: string;
  width: number;
  height: number;
  frameRate: number;
}

interface ScreenShareSource {
  id: string;
  name: string;
  type: 'screen' | 'window';
  displayId?: string | null;
  thumbnail?: SafeUrl | null;
  appIcon?: SafeUrl | null;
}

export interface DateSeparator {
  type: 'date';
  date: Date;
  label: string;
}

export interface MessageGroup {
  type: 'group';
  user: User;
  messages: ChatMessage[];
  createdAt: Date; // Time of the first message in group
}

@Component({
  selector: 'app-call-room',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ModalComponent,
    MediaViewerModalComponent,
    ButtonComponent,
    TooltipDirective,
    NotificationComponent,
    LoadingSpinnerComponent,
    RouterOutlet,
    LucideAngularModule,
    LogoComponent,
    ContextMenuComponent,
    AvatarComponent,
    LinkifyPipe,
    ChatInputComponent,
    LinkPreviewComponent,
  ],
  templateUrl: './call-room.component.html',
  styleUrls: ['./call-room.component.scss'],
})
export class CallRoomComponent implements OnInit, OnDestroy {
  @ViewChildren('remoteAudio') remoteAudioElements!: QueryList<ElementRef<HTMLAudioElement>>;
  @ViewChildren('remoteScreen') remoteScreenElements!: QueryList<ElementRef<HTMLVideoElement>>;
  @ViewChild('localScreenVideo') localScreenVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('previewVideo')
  set previewVideoRef(element: ElementRef<HTMLVideoElement> | undefined) {
    this.previewVideo = element;
    this.attachPreviewStream();
  }
  private previewVideo?: ElementRef<HTMLVideoElement>;

  private _chatContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('chatContainer')
  set chatContainer(element: ElementRef<HTMLDivElement> | undefined) {
    this._chatContainer = element;
    // Как только контейнер появляется в DOM (например, после isLoading = false),
    // мы моментально прокручиваем его вниз, если там есть сообщения.
    if (element?.nativeElement) {
      if (this.chatMessages.length > 0) {
        element.nativeElement.scrollTop = element.nativeElement.scrollHeight;
        this.initialScrollDone = true;
      }
      // Также устанавливаем фокус на поле ввода, так как чат стал видимым
      setTimeout(() => this.chatInputRef?.focus(), 0);
    }
  }
  get chatContainer(): ElementRef<HTMLDivElement> | undefined {
    return this._chatContainer;
  }

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  @ViewChild('chatInputRef') chatInputRef?: ChatInputComponent;

  private destroy$ = new Subject<void>();
  private chatInputChanges$ = new Subject<string>();

  readonly X = X;
  readonly Link = Link;
  readonly LogOut = LogOut;
  readonly MessageSquare = MessageSquare;
  readonly Plus = Plus;
  readonly Send = Send;
  readonly Mic = Mic;
  readonly MicOff = MicOff;
  readonly Volume2 = Volume2;
  readonly VolumeX = VolumeX;
  readonly Monitor = Monitor;
  readonly Users = Users;
  readonly Settings = Settings;
  readonly ArrowUp = ArrowUp;
  readonly Paperclip = Paperclip;
  readonly File = File;
  readonly Download = Download;
  readonly Loader2 = Loader2;
  readonly Zap = Zap;
  readonly Maximize = Maximize;
  readonly Check = Check;
  readonly RefreshCcw = RefreshCcw;
  readonly AppWindow = AppWindow;
  readonly MonitorUp = MonitorUp;
  readonly AlertTriangle = AlertTriangle;

  roomId: string = '';
  currentUser: User | null = null;

  // Чат
  chatMessages: ChatMessage[] = [];
  chatGroups: (DateSeparator | MessageGroup)[] = [];
  chatInput: string = '';
  isUploadingFile = false;
  linkPreview: LinkPreview | null = null;
  linkPreviewLoading = false;
  linkPreviewError: string | null = null;
  isLinkPreviewDismissed = false;
  initialScrollDone = false; // Флаг для первичной прокрутки
  selectedFiles: {
    file: File;
    uploadedData?: { url: string; name: string; size: number; type: string };
    uploading: boolean;
    error?: boolean;
    previewUrl?: SafeUrl | string;
  }[] = [];

  // Media Viewer
  showMediaViewer = false;
  selectedMediaItem?: MediaItem;
  mediaGalleryItems: MediaItem[] = [];

  // Состояния
  isLoading = true;
  isConnecting = true;
  isMuted = false;
  isScreenSharing = false;
  isDeafened = false;
  screenShareOptions: ScreenShareOption[] = [];
  selectedScreenShareQuality: ScreenShareQuality | null = null;
  localScreenStream: MediaStream | null = null;
  isElectronApp = false;
  pushToTalkEnabled = false;
  pushToTalkHolding = false;
  pushToTalkManualOverride = false;
  pushToTalkShortcutLabel = '';

  // Участники
  remotePeers: RemotePeer[] = [];
  participants: RoomParticipant[] = [];

  // Ошибки
  error: string | null = null;
  audioAutoplayBlocked = false;
  
  // Статус микрофона
  microphRoobertatus: MicrophRoobertatus = 'pending';

  // Модальные окна
  showLeaveModal = false;
  showCopyNotification = false;
  showScreenShareModal = false;
  showScreenSourceModal = false;
  showScreenPreviewModal = false;
  previewStream: MediaStream | null = null;
  previewTitle = 'Демонстрация экрана';
  previewPeerId: string | null = null;
  previewAudioEnabled = false;
  previewHasAudio = false;
  previewAudioVolume = 0.85;
  previewIsFullscreen = false;

  // Источники демонстрации (Electron)
  screenSources: ScreenShareSource[] = [];
  screenSourcesLoading = false;
  screenSourcesError: string | null = null;
  pendingScreenSource: ScreenShareSource | null = null;

  // Контекстное меню участника
  showParticipantContextMenu = false;
  participantContextMenuPosition: ContextMenuPosition = { x: 0, y: 0 };
  participantContextMenuItems: ContextMenuItem[] = [];
  selectedParticipant: RoomParticipant | null = null;
  participantVolume = 100;

  private hasLeftRoom = false;
  private pendingAudioPlayback = new Map<string, MediaStream>();
  private remoteAudioVolumeSnapshot = new Map<string, number>();
  private readonly assetBaseUrl = (environment.apiUrl || '').replace(/\/api\/?$/, '');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private webrtcService: WebrtcService,
    private websocketService: WebsocketService,
    private authService: AuthService,
    private electronService: ElectronService,
    private webrtcApiService: WebrtcApiService,
    private participantMenuService: ParticipantMenuService,
    private volumePreferences: VolumePreferencesService,
    private uploadService: UploadService,
    private sanitizer: DomSanitizer,
    private linkPreviewService: LinkPreviewService,
    private linkifyService: LinkifyService,
    private pageMeta: PageMetaService,
    private pushToTalkService: PushToTalkService
  ) {
    this.isElectronApp = this.electronService.isElectronApp();
    this.pushToTalkShortcutLabel = formatShortcutLabel(
      this.webrtcService.getCommunicationSettings().shortcut,
      { fallbackLabel: 'Не задано' }
    );
  }

  async ngOnInit() {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.currentUser = user;
    });

    this.setupLinkPreviewSubscription();

    try {
      this.initializeScreenShareOptions();

      // Получаем roomId из URL
      this.roomId = this.route.snapshot.paramMap.get('roomId') || '';
      if (!this.roomId) {
        throw new Error('Room ID not provided');
      }

      this.pageMeta.set({
        title: this.roomId ? `Комната ${this.roomId}` : 'Комната',
        description: 'Звонок, чат и демонстрация экрана в комнате Twine',
      });

      // Получаем текущего пользователя
      this.currentUser = await firstValueFrom(this.authService.getCurrentUser());
      if (!this.currentUser) {
        throw new Error('User not authenticated');
      }

      await this.loadIceServers();

      // Подписываемся на события навигации для обновления профиля
      this.router.events
        .pipe(
          filter((event) => event instanceof NavigationEnd),
          takeUntil(this.destroy$)
        )
        .subscribe(async () => {
          if (this.currentUser) {
            const updatedUser = await firstValueFrom(this.authService.getCurrentUser());
            if (updatedUser) {
              this.currentUser = updatedUser;
            }
          }
        });

      // Подписываемся на события
      this.setupWebRTCSubscriptions();
      this.setupWebSocketSubscriptions();
      this.setupWebRTCParticipantSubscriptions();
      this.setupChatSubscriptions();
      this.setupMicrophRoobertatusSubscription();
      this.setupPushToTalkBridge();

      // Подключаемся к WebSocket
      this.websocketService.connectSignaling();
      this.websocketService.connectWebRTC();
      this.websocketService.connectChat();

      // Ждем подключения
      await this.waitForWebSocketConnections();

      // Присоединяемся к комнате (это работает независимо от микрофона)
      await this.websocketService.joinRoom(this.roomId);
      console.log('[CallRoom] Joined room:', this.roomId);

      // Пытаемся инициализировать аудио стрим (не блокирует работу чата)
      const audioStream = await this.webrtcService.initializeAudioStream();
      if (audioStream) {
        console.log('[CallRoom] Local audio stream initialized');
      } else {
        console.log('[CallRoom] Microphone not available, continuing without audio');
      }

      // Присоединяемся к чату
      const { messages } = await this.websocketService.joinChatRoom(this.roomId);
      this.chatMessages = messages;
      this.processMessages();
      this.updateMediaGallery();
      // Скролл будет выполнен после снятия isLoading

      // Присоединяемся к WebRTC комнате и синхронизируем участников
      const { participants: existingWebrtcParticipants } =
        await this.websocketService.joinWebRTCRoom(this.roomId);
      this.markCurrentParticipantWebRTC();
      await this.handleInitialWebrtcParticipants(existingWebrtcParticipants);

      this.isLoading = false;
      this.isConnecting = false;

      // Прокрутка произойдет автоматически через сеттер ViewChild chatContainer,
      // как только элемент отрендерится в DOM.
      // Фокус установим тоже там.
    } catch (error: any) {
      console.error('[CallRoom] Initialization error:', error);
      this.error = error.message || 'Failed to initialize call';
      this.isLoading = false;
      this.isConnecting = false;
    }
  }

  ngOnDestroy() {
    this.leaveRoom({ skipNavigation: true });
    this.destroy$.next();
    this.destroy$.complete();
  }

  resolveAvatarUrl(avatarUrl?: string | null): string | null {
    if (!avatarUrl) {
      return null;
    }
    if (avatarUrl.startsWith('http')) {
      return avatarUrl;
    }
    return `${this.assetBaseUrl}${avatarUrl}`;
  }

  resolveDecorationUrl(decorationUrl?: string | null): string | null {
    if (!decorationUrl) {
      return null;
    }
    if (decorationUrl.startsWith('http')) {
      return decorationUrl;
    }
    return `${this.assetBaseUrl}${decorationUrl}`;
  }

  /**
   * Настройка подписок чата
   */
  private setupChatSubscriptions(): void {
    this.websocketService.chatMessage$.pipe(takeUntil(this.destroy$)).subscribe((message) => {
      this.chatMessages.push(message);
      this.processMessages();
      this.updateMediaGallery();
      this.scrollToBottom(); // Используем стандартное поведение (плавное или нет, в зависимости от флага)
    });
  }

  /**
   * Настройка подписки на статус микрофона
   */
  private setupMicrophRoobertatusSubscription(): void {
    this.webrtcService.microphRoobertatus.pipe(takeUntil(this.destroy$)).subscribe((status) => {
      this.microphRoobertatus = status;
    });
  }

  /**
   * Синхронизация режима рации с состоянием микрофона
   */
  private setupPushToTalkBridge(): void {
    this.webrtcService.communicationSettingsChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((settings) => {
        this.pushToTalkShortcutLabel = formatShortcutLabel(settings.shortcut, {
          fallbackLabel: 'Не задано',
        });
      });

    this.pushToTalkService.enabledChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((enabled) => {
        this.pushToTalkEnabled = enabled;

        if (!enabled) {
          this.pushToTalkManualOverride = false;
          this.pushToTalkService.forceRelease();
          return;
        }

        // Включаем режим рации — микрофон выключен до удержания или закрепления
        this.pushToTalkManualOverride = false;
        this.applyPushToTalkMuteState(true);
      });

    this.pushToTalkService.holdingChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((holding) => {
        this.pushToTalkHolding = holding;

        if (!this.pushToTalkEnabled || this.pushToTalkManualOverride) {
          return;
        }

        this.applyPushToTalkMuteState(!holding);
      });
  }

  private applyPushToTalkMuteState(muted: boolean): void {
    if (!this.roomId) {
      return;
    }

    if (this.isMuted === muted) {
      return;
    }

    this.webrtcService.setMuteState(muted);
    this.websocketService.toggleAudio(this.roomId, !muted);
  }

  /**
   * Отправка сообщения
   */
  async sendMessage(): Promise<void> {
    const hasPendingUploads = this.selectedFiles.some((f) => f.uploading);
    const hasUploadedFiles = this.selectedFiles.some((f) => f.uploadedData);

    if ((!this.chatInput.trim() && !hasUploadedFiles) || hasPendingUploads) return;

    try {
      const content = this.chatInput;
      const uploadedFiles = this.selectedFiles
        .filter((f) => f.uploadedData)
        .map((f) => f.uploadedData!);

      const disableLinkPreview = this.isLinkPreviewDismissed;

      this.chatInput = ''; // Очищаем сразу для UX
      this.selectedFiles = [];
      this.linkPreview = null;
      this.isLinkPreviewDismissed = false;
      this.chatInputChanges$.next(this.chatInput);

      await this.websocketService.sendChatMessage(this.roomId, content, uploadedFiles, disableLinkPreview);
    } catch (error) {
      console.error('[CallRoom] Failed to send message:', error);
      // Можно вернуть текст в инпут при ошибке, но пока просто логируем
    }
  }

  triggerFileInput(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const newFiles = Array.from(input.files);
      const currentCount = this.selectedFiles.length;
      const remainingSlots = 50 - currentCount;

      if (remainingSlots <= 0) {
        this.error = 'Достигнут лимит файлов (50)';
        setTimeout(() => (this.error = null), 3000);
        input.value = '';
        return;
      }

      const filesToUpload = newFiles.slice(0, remainingSlots);

      // Check for file size limit (100MB)
      const maxSize = 100 * 1024 * 1024; // 100MB
      const validFiles: File[] = [];
      let hasOversizedFiles = false;

      filesToUpload.forEach((file) => {
        if (file.size > maxSize) {
          hasOversizedFiles = true;
        } else {
          validFiles.push(file);
        }
      });

      if (hasOversizedFiles) {
        this.error = 'Максимальный размер файла 100 МБ';
        setTimeout(() => (this.error = null), 5000);
      }

      validFiles.forEach((file) => this.handleFileUpload(file));
    }
    input.value = ''; // reset
  }

  handleFileUpload(file: File): void {
    let previewUrl: SafeUrl | string | undefined;
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      previewUrl = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(file));
    }

    const fileEntry = {
      file,
      uploading: true,
      error: false,
      uploadedData: undefined as
        | { url: string; name: string; size: number; type: string }
        | undefined,
      previewUrl,
    };

    // Use spread to ensure change detection and array reference update
    this.selectedFiles = [...this.selectedFiles, fileEntry];
    this.checkGlobalUploadStatus();

    this.uploadService.uploadFile(file).subscribe({
      next: (data) => {
        const entry = this.selectedFiles.find((f) => f.file === file);
        if (entry) {
          entry.uploadedData = data;
          entry.uploading = false;
        }
        this.checkGlobalUploadStatus();
      },
      error: (err) => {
        console.error('Upload failed', err);
        const entry = this.selectedFiles.find((f) => f.file === file);
        if (entry) {
          entry.error = true;
          entry.uploading = false;
        }
        this.checkGlobalUploadStatus();
        this.error = 'Не удалось загрузить файл';
        setTimeout(() => (this.error = null), 3000);
      },
    });
  }

  private checkGlobalUploadStatus(): void {
    this.isUploadingFile = this.selectedFiles.some((f) => f.uploading);
  }

  removeSelectedFile(index: number): void {
    this.selectedFiles.splice(index, 1);
    this.checkGlobalUploadStatus();
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toUpperCase() || 'FILE';
  }

  getDownloadUrl(url: string): string {
    if (url.startsWith('http')) return url;

    // Transform static URL to download endpoint URL
    // Static: /uploads/files/uuid/filename -> /upload/download/uuid/filename
    if (url.startsWith('/uploads/files/')) {
      const parts = url.split('/');
      // /uploads/files/uuid/filename
      // parts[0] = ""
      // parts[1] = "uploads"
      // parts[2] = "files"
      // parts[3] = uuid
      // parts[4] = filename
      if (parts.length >= 5) {
        const uuid = parts[3];
        const filename = parts.slice(4).join('/');
        return `${this.assetBaseUrl}/upload/download/${uuid}/${filename}`;
      }
    }

    return `${this.assetBaseUrl}${url}`;
  }

  /**
   * Обработка нажатия клавиш в поле ввода чата
   */
  onChatInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  /**
   * Прокрутка чата вниз
   */
  private scrollToBottom(force: boolean = false): void {
    if (!this.chatContainer) return;

    // Если это первичная загрузка или принудительная прокрутка
    if (!this.initialScrollDone || force) {
      // Используем setTimeout чтобы дать Angular время отрисовать элементы
      setTimeout(() => {
        if (this.chatContainer) {
          this.chatContainer.nativeElement.scrollTop =
            this.chatContainer.nativeElement.scrollHeight;

          // Если это была первая прокрутка, помечаем как выполненную
          if (!this.initialScrollDone) {
            this.initialScrollDone = true;
            // Для надежности повторяем через небольшой интервал, если картинки/контент догрузились
            setTimeout(() => {
              if (this.chatContainer) {
                this.chatContainer.nativeElement.scrollTop =
                  this.chatContainer.nativeElement.scrollHeight;
              }
            }, 100);
          }
        }
      }, 0);
      return;
    }

    // Стандартная плавная прокрутка для новых сообщений
    setTimeout(() => {
      if (this.chatContainer) {
        this.chatContainer.nativeElement.scrollTo({
          top: this.chatContainer.nativeElement.scrollHeight,
          behavior: 'smooth',
        });
      }
    }, 0);
  }

  formatMessageTime(date: Date | string): string {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  onChatInputChanged(value: string): void {
    this.chatInputChanges$.next(value);
  }

  private processMessages(): void {
    const groups: (DateSeparator | MessageGroup)[] = [];
    let lastDate: string | null = null;
    let currentGroup: MessageGroup | null = null;

    for (const msg of this.chatMessages) {
      const msgDate = new Date(msg.createdAt);
      const dateKey = msgDate.toLocaleDateString();

      // Date Separator
      if (dateKey !== lastDate) {
        // Close current group if exists
        if (currentGroup) {
          groups.push(currentGroup);
          currentGroup = null;
        }

        groups.push({
          type: 'date',
          date: msgDate,
          label: this.formatDateSeparator(msgDate),
        });
        lastDate = dateKey;
      }

      // Message Grouping
      // Group if same user AND within 5 minutes
      const isSameUser = currentGroup && currentGroup.user.id === msg.user.id;
      const isWithinTime =
        currentGroup &&
        msgDate.getTime() -
          new Date(currentGroup.messages[currentGroup.messages.length - 1].createdAt).getTime() <=
          5 * 60 * 1000;

      if (currentGroup && isSameUser && isWithinTime) {
        currentGroup.messages.push(msg);
      } else {
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = {
          type: 'group',
          user: msg.user,
          messages: [msg],
          createdAt: msgDate,
        };
      }
    }

    if (currentGroup) {
      groups.push(currentGroup);
    }

    this.chatGroups = groups;
  }

  private setupLinkPreviewSubscription(): void {
    this.chatInputChanges$
      .pipe(
        debounceTime(350),
        map((text) => this.extractFirstUrl(text)),
        distinctUntilChanged(),
        switchMap((url) => {
          this.linkPreviewError = null;

          if (!url) {
            this.linkPreview = null;
            this.linkPreviewLoading = false;
            return of(null);
          }

          this.linkPreviewLoading = true;
          this.linkPreview = null;
          this.isLinkPreviewDismissed = false;

          return this.linkPreviewService.getLinkPreview(url).pipe(
            catchError(() => {
              this.linkPreviewError = 'Не удалось загрузить предпросмотр ссылки';
              return of(null);
            }),
            finalize(() => {
              this.linkPreviewLoading = false;
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((preview) => {
        this.linkPreview = preview;
      });
  }

  private extractFirstUrl(text: string): string | null {
    const token = this.linkifyService.findLinks(text).find((t) => t.type === 'url');
    return token?.href ?? null;
  }

  private formatDateSeparator(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toLocaleDateString() === today.toLocaleDateString()) {
      return 'Сегодня';
    } else if (date.toLocaleDateString() === yesterday.toLocaleDateString()) {
      return 'Вчера';
    } else {
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  }

  isDateSeparator(item: DateSeparator | MessageGroup): item is DateSeparator {
    return item.type === 'date';
  }

  isMessageGroup(item: DateSeparator | MessageGroup): item is MessageGroup {
    return item.type === 'group';
  }

  /**
   * Настройка подписок WebRTC
   */
  private setupWebRTCSubscriptions(): void {
    // Подписка на изменение статуса микрофона
    this.webrtcService.isMuted.pipe(takeUntil(this.destroy$)).subscribe((isMuted) => {
      this.isMuted = isMuted;
    });

    // Подписка на изменение статуса screen share
    this.webrtcService.isScreenSharing
      .pipe(takeUntil(this.destroy$))
      .subscribe((isScreenSharing) => {
        this.isScreenSharing = isScreenSharing;
      });

    // Подписка на удаленные аудио стримы
    this.webrtcService.onRemoteAudioStream$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ peerId, stream }) => {
        console.log('[CallRoom] Received remote audio stream from:', peerId);
        const peer = this.remotePeers.find((p) => p.socketId === peerId);
        if (peer) {
          peer.audioStream = stream;
          this.playAudioStream(peerId, stream);
        }
      });

    // Подписка на удаленные screen share стримы
    this.webrtcService.onRemoteScreenStream$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ peerId, stream }) => {
        console.log('[CallRoom] Received remote screen stream from:', peerId);
        const peer = this.remotePeers.find((p) => p.socketId === peerId);
        if (peer) {
          peer.screenStream = stream;
          peer.isScreenSharing = true;
          this.playScreenStream(peerId, stream);
        }
      });

    // Подписка на отключение peer'ов
    this.webrtcService.onPeerDisconnected$.pipe(takeUntil(this.destroy$)).subscribe((peerId) => {
      console.log('[CallRoom] Peer disconnected:', peerId);
      this.remotePeers = this.remotePeers.filter((p) => p.socketId !== peerId);
      this.clearScreenStream(peerId);
    });

    this.webrtcService.localScreenStream.pipe(takeUntil(this.destroy$)).subscribe((stream) => {
      this.localScreenStream = stream;
      this.attachLocalScreenStream(stream);
    });

    // Подписка на изменение устройства вывода звука
    this.webrtcService.selectedAudioOutputId
      .pipe(takeUntil(this.destroy$))
      .subscribe((deviceId) => {
        this.updateAudioOutputDevice(deviceId);
      });
  }

  private updateAudioOutputDevice(deviceId: string): void {
    console.log('[CallRoom] Updating audio output device to:', deviceId);
    this.remoteAudioElements?.forEach((element) => {
      this.setSinkId(element.nativeElement, deviceId);
    });
  }

  private async setSinkId(element: HTMLMediaElement, deviceId: string): Promise<void> {
    const audioEl = element as any;
    if (typeof audioEl.setSinkId === 'function') {
      try {
        await audioEl.setSinkId(deviceId);
      } catch (error) {
        console.warn('[CallRoom] Failed to set audio output device:', error);
      }
    }
  }

  /**
   * Подписки на события WebRTC комнаты
   */
  private setupWebRTCParticipantSubscriptions(): void {
    this.websocketService.webrtcParticipantJoined$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (participant) => {
        this.updateParticipantWithWebRTC(participant);
        await this.tryCreatePeerConnection(participant.id);
      });

    this.websocketService.webrtcParticipantLeft$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ socketId, userId }) => {
        this.handlePeerLeave(socketId, userId);
      });
  }

  /**
   * Настройка подписок WebSocket
   */
  private setupWebSocketSubscriptions(): void {
    // Подписка на присоединение к комнате
    this.websocketService.roomJoined$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async ({ roomId, participants }) => {
        console.log('[CallRoom] Room joined successfully. Participants:', participants);
        this.roomId = roomId;
        const previous = this.participants;
        this.participants = participants.map((participant) => {
          const existing = previous.find((p) => p.id === participant.id);
          return {
            ...participant,
            webrtcSocketId: existing?.webrtcSocketId ?? participant.webrtcSocketId,
          };
        });
      });

    // Подписка на присоединение нового участника
    this.websocketService.userJoined$.pipe(takeUntil(this.destroy$)).subscribe((participant) => {
      console.log('[CallRoom] New user joined:', participant);
      const index = this.participants.findIndex((p) => p.id === participant.id);
      if (index !== -1) {
        const existing = this.participants[index];
        this.participants[index] = {
          ...existing,
          ...participant,
          webrtcSocketId: participant.webrtcSocketId ?? existing.webrtcSocketId,
        };
      } else {
        this.participants.push(participant);
      }
    });

    // Подписка на выход участника
    this.websocketService.userLeft$.pipe(takeUntil(this.destroy$)).subscribe((participant) => {
      console.log('[CallRoom] User left:', participant);
      const existing = this.participants.find((p) => p.id === participant.id);
      const peerSocketId = existing?.webrtcSocketId;
      this.participants = this.participants.filter((p) => p.id !== participant.id);
      this.handlePeerLeave(peerSocketId, participant.id);
    });

    this.websocketService.userUpdated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((participant) => this.handleParticipantUpdated(participant));

    // Подписка на WebRTC offer
    this.websocketService.webrtcOffer$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async ({ fromSocketId, fromUserId, fromUsername, fromDisplayName, signal }) => {
        console.log('[CallRoom] Received offer from:', fromSocketId);
        await this.handleOffer(
          fromSocketId,
          fromUserId,
          fromUsername || 'Unknown',
          signal as RTCSessionDescriptionInit,
          fromDisplayName
        );
      });

    // Подписка на WebRTC answer
    this.websocketService.webrtcAnswer$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async ({ fromSocketId, signal }) => {
        console.log('[CallRoom] Received answer from:', fromSocketId);
        await this.webrtcService.setRemoteDescription(
          fromSocketId,
          signal as RTCSessionDescriptionInit
        );
      });

    // Подписка на ICE candidates
    this.websocketService.webrtcIceCandidate$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async ({ fromSocketId, signal }) => {
        await this.webrtcService.addIceCandidate(fromSocketId, signal as RTCIceCandidateInit);
      });

    // Подписка на изменение статуса аудио других участников
    this.websocketService.audioStatusChanged$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ socketId, enabled }) => {
        const peer = this.remotePeers.find((p) => p.socketId === socketId);
        if (peer) {
          peer.isMuted = !enabled;
        }
      });

    // Подписка на начало screen share
    this.websocketService.screenShareStarted$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ socketId, username }) => {
        console.log('[CallRoom] Screen share started by:', username);
        const peer = this.remotePeers.find((p) => p.socketId === socketId);
        if (peer) {
          peer.isScreenSharing = true;
        }
      });

    // Подписка на остановку screen share
    this.websocketService.screenShareStopped$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ socketId }) => {
        const peer = this.remotePeers.find((p) => p.socketId === socketId);
        if (peer) {
          peer.isScreenSharing = false;
          peer.screenStream = undefined;
          this.clearScreenStream(socketId);
        }
      });
  }

  private async handleInitialWebrtcParticipants(participants: WebrtcParticipant[]): Promise<void> {
    for (const participant of participants) {
      this.updateParticipantWithWebRTC(participant);
      await this.tryCreatePeerConnection(participant.id);
    }
  }

  private updateParticipantWithWebRTC(participant: WebrtcParticipant): void {
    const existing = this.participants.find((p) => p.id === participant.id);

    if (existing) {
      existing.webrtcSocketId = participant.socketId;
      existing.username = participant.username ?? existing.username;
      existing.displayName = participant.displayName ?? existing.displayName;
      existing.avatarUrl = participant.avatarUrl ?? existing.avatarUrl;
      existing.decorationUrl = participant.decorationUrl ?? existing.decorationUrl;
    } else {
      this.participants.push({
        id: participant.id,
        username: participant.username,
        displayName: participant.displayName,
        avatarUrl: participant.avatarUrl,
        decorationUrl: participant.decorationUrl,
        webrtcSocketId: participant.socketId,
      });
    }
  }

  private shouldInitiateConnection(peerSocketId?: string): boolean {
    const localSocketId = this.websocketService.getWebRTCSocketId();

    if (!localSocketId || !peerSocketId) {
      return false;
    }

    // Детерминированный выбор инициатора, чтобы избежать glare ситуаций
    return localSocketId.localeCompare(peerSocketId) > 0;
  }

  private async tryCreatePeerConnection(userId: string): Promise<void> {
    const participant = this.participants.find((p) => p.id === userId);
    const peerSocketId = participant?.webrtcSocketId;
    const localSocketId = this.websocketService.getWebRTCSocketId();

    if (!peerSocketId || !localSocketId) {
      return;
    }

    // Только один из участников создает offer, чтобы не было двойных соединений
    if (!this.shouldInitiateConnection(peerSocketId)) {
      return;
    }

    if (this.remotePeers.some((peer) => peer.socketId === peerSocketId)) {
      return;
    }

    if (this.webrtcService.getPeerConnection(peerSocketId)) {
      return;
    }

    await this.createPeerConnectionAndOffer(
      peerSocketId,
      participant!.id || '',
      participant!.username || 'Unknown',
      participant!.displayName
    );
  }

  private handlePeerLeave(socketId?: string, userId?: string): void {
    if (socketId) {
      this.webrtcService.removePeerConnection(socketId);
      this.remotePeers = this.remotePeers.filter((peer) => peer.socketId !== socketId);
      this.clearScreenStream(socketId);
      this.pendingAudioPlayback.delete(socketId);
      this.remoteAudioVolumeSnapshot.delete(socketId);
    }

    if (userId) {
      const participant = this.participants.find((p) => p.id === userId);
      if (participant) {
        participant.webrtcSocketId = undefined;
      }
    }
  }

  private handleParticipantUpdated(participant: RoomParticipant): void {
    const userId = participant.id;
    if (!userId) {
      return;
    }

    const patch = this.extractUserPatch(participant);
    if (!patch) {
      return;
    }

    this.participants = this.participants.map((item) =>
      item.id === userId ? { ...item, ...patch } : item
    );

    this.remotePeers = this.remotePeers.map((peer) =>
      peer.id === userId ? { ...peer, ...patch } : peer
    );

    this.chatMessages = this.chatMessages.map((message) =>
      message.user.id === userId
        ? {
            ...message,
            user: {
              ...message.user,
              ...patch,
            },
          }
        : message
    );

    if (this.currentUser?.id === userId) {
      this.currentUser = {
        ...this.currentUser,
        ...patch,
      };
    }
  }

  private extractUserPatch(source: Partial<User>): Partial<User> | null {
    const patch: Partial<User> = {};
    if (source.displayName !== undefined) {
      patch.displayName = source.displayName;
    }
    if (source.avatarUrl !== undefined) {
      patch.avatarUrl = source.avatarUrl;
    }
    if (source.decorationUrl !== undefined) {
      patch.decorationUrl = source.decorationUrl;
    }
    return Object.keys(patch).length > 0 ? patch : null;
  }

  private async renegotiateAllPeers(): Promise<void> {
    const peerIds = Array.from(this.webrtcService.getPeerConnections().keys());
    await Promise.all(peerIds.map((peerId) => this.sendRenegotiationOffer(peerId)));
  }

  private async sendRenegotiationOffer(peerId: string): Promise<void> {
    try {
      if (!this.webrtcService.getPeerConnection(peerId)) {
        return;
      }
      const offer = await this.webrtcService.createOffer(peerId);
      this.websocketService.sendOffer(this.roomId, peerId, offer);
      console.log('[CallRoom] Renegotiation offer sent to:', peerId);
    } catch (error) {
      console.error('[CallRoom] Failed to renegotiate with peer', peerId, error);
    }
  }

  private markCurrentParticipantWebRTC(): void {
    if (!this.currentUser) {
      return;
    }

    const participant = this.participants.find((p) => p.id === this.currentUser?.id);
    if (participant) {
      participant.webrtcSocketId = this.websocketService.getWebRTCSocketId();
    }
  }

  /**
   * Ожидание подключения всех WebSocket соединений
   */
  private waitForWebSocketConnections(): Promise<void> {
    return new Promise((resolve, reject) => {
      let subscription: Subscription | undefined;
      const timeout = setTimeout(() => {
        subscription?.unsubscribe();
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      subscription = combineLatest([
        this.websocketService.isSignalingConnected,
        this.websocketService.isWebRTCConnected,
        this.websocketService.isChatConnected,
      ])
        .pipe(takeUntil(this.destroy$))
        .subscribe(([signalingConnected, webrtcConnected, chatConnected]) => {
          if (signalingConnected && webrtcConnected && chatConnected) {
            clearTimeout(timeout);
            subscription?.unsubscribe();
            resolve();
          }
        });
    });
  }

  /**
   * Создание peer connection и отправка offer
   */
  private async createPeerConnectionAndOffer(
    peerId: string,
    id: string,
    username: string,
    displayName?: string
  ): Promise<void> {
    try {
      if (!peerId || peerId === this.websocketService.getWebRTCSocketId()) {
        return;
      }

      if (this.webrtcService.getPeerConnection(peerId)) {
        return;
      }

      // Создаем peer connection
      const connection = this.webrtcService.createPeerConnection(
        peerId,
        id,
        username,
        (candidate) => {
          // Отправляем ICE candidate
          this.websocketService.sendIceCandidate(this.roomId, peerId, candidate.toJSON());
        }
      );

      // Создаем remote peer
      const existingPeer = this.remotePeers.find((peer) => peer.socketId === peerId);
      if (existingPeer) {
        existingPeer.id = id;
        existingPeer.username = username;
        existingPeer.displayName = displayName;
      } else {
        this.remotePeers.push({
          socketId: peerId,
          id,
          username,
          displayName,
          isMuted: false,
          isScreenSharing: false,
        });
      }

      // Создаем и отправляем offer
      const offer = await this.webrtcService.createOffer(peerId);
      this.websocketService.sendOffer(this.roomId, peerId, offer);

      console.log('[CallRoom] Offer sent to:', peerId);
    } catch (error) {
      console.error('[CallRoom] Error creating peer connection:', error);
    }
  }

  /**
   * Обработка входящего offer
   */
  private async handleOffer(
    peerId: string,
    id: string,
    username: string,
    offer: RTCSessionDescriptionInit,
    displayName?: string
  ): Promise<void> {
    try {
      this.updateParticipantWithWebRTC({
        socketId: peerId,
        id,
        username,
        displayName,
      });

      // Создаем peer connection (или повторно используем существующее)
      let connection = this.webrtcService.getPeerConnection(peerId)?.connection;
      if (!connection) {
        connection = this.webrtcService.createPeerConnection(peerId, id, username, (candidate) => {
          this.websocketService.sendIceCandidate(this.roomId, peerId, candidate.toJSON());
        });
      }

      // Создаем remote peer
      const existingPeer = this.remotePeers.find((peer) => peer.socketId === peerId);
      if (existingPeer) {
        existingPeer.id = id;
        existingPeer.username = username;
        existingPeer.displayName = displayName;
      } else {
        this.remotePeers.push({
          socketId: peerId,
          id,
          username,
          displayName,
          isMuted: false,
          isScreenSharing: false,
        });
      }

      // Устанавливаем remote description
      await this.webrtcService.setRemoteDescription(peerId, offer);

      // Создаем и отправляем answer
      const answer = await this.webrtcService.createAnswer(peerId);
      this.websocketService.sendAnswer(this.roomId, peerId, answer);

      console.log('[CallRoom] Answer sent to:', peerId);
    } catch (error) {
      console.error('[CallRoom] Error handling offer:', error);
    }
  }

  /**
   * Воспроизведение аудио стрима
   */
  private playAudioStream(peerId: string, stream: MediaStream): void {
    setTimeout(() => {
      this.attachAndPlayAudio(peerId, stream);
    }, 100);
  }

  /**
   * Воспроизведение screen share стрима
   */
  private playScreenStream(peerId: string, stream: MediaStream): void {
    setTimeout(() => {
      const videoElement = this.remoteScreenElements?.find(
        (el) => el.nativeElement.dataset['peerId'] === peerId
      );

      if (videoElement) {
        videoElement.nativeElement.srcObject = stream;
        videoElement.nativeElement.play().catch((error) => {
          console.error('[CallRoom] Error playing screen:', error);
        });
      }

      if (this.previewPeerId === peerId) {
        this.previewStream = stream;
        this.previewHasAudio = !!stream.getAudioTracks().length && this.previewPeerId !== 'local';
        this.attachPreviewStream();
      }
    }, 100);
  }

  private clearScreenStream(peerId: string): void {
    setTimeout(() => {
      const videoElement = this.remoteScreenElements?.find(
        (el) => el.nativeElement.dataset['peerId'] === peerId
      );

      if (videoElement) {
        videoElement.nativeElement.srcObject = null;
      }
      if (this.previewPeerId === peerId) {
        this.closeScreenPreview();
      }
    }, 0);
  }

  private attachLocalScreenStream(stream: MediaStream | null): void {
    setTimeout(() => {
      const videoElement = this.localScreenVideo?.nativeElement;
      if (!videoElement) {
        return;
      }

      if (stream) {
        videoElement.srcObject = stream;
        videoElement.play().catch((error) => {
          console.error('[CallRoom] Error playing local screen:', error);
        });
      } else {
        videoElement.srcObject = null;
      }
    }, 0);
  }

  /**
   * Переключение микрофона
   */
  toggleMute(): void {
    // Если микрофон недоступен, пробуем получить доступ
    if (this.microphRoobertatus !== 'granted') {
      this.requestMicrophoneAccess();
      return;
    }
    if (this.pushToTalkEnabled) {
      this.pushToTalkManualOverride = !this.pushToTalkManualOverride;

      if (this.pushToTalkManualOverride) {
        this.pushToTalkService.forceRelease();
        this.applyPushToTalkMuteState(false);
      } else {
        const shouldMute = !this.pushToTalkHolding;
        this.applyPushToTalkMuteState(shouldMute);
      }
      return;
    }
    const newMuteState = this.webrtcService.toggleMute();
    this.websocketService.toggleAudio(this.roomId, !newMuteState);
  }

  /**
   * Запрос доступа к микрофону
   */
  async requestMicrophoneAccess(): Promise<void> {
    const stream = await this.webrtcService.retryMicrophoneAccess();
    if (stream) {
      console.log('[CallRoom] Microphone access granted');
      // Уведомляем других о нашем статусе аудио
      this.websocketService.toggleAudio(this.roomId, !this.isMuted);
    }
  }

  /**
   * Начало демонстрации экрана
   */
  async startScreenShare(quality?: ScreenShareQuality, sourceId?: string): Promise<void> {
    try {
      const targetQuality =
        quality ??
        this.selectedScreenShareQuality ??
        this.webrtcService.getDefaultScreenShareQuality();

      this.selectedScreenShareQuality = targetQuality;

      const stream = await this.webrtcService.startScreenShare(targetQuality, sourceId);

      // Добавляем screen share треки во все существующие connections
      await this.webrtcService.addScreenShareToConnections(stream);
      await this.renegotiateAllPeers();

      // Уведомляем других участников
      this.websocketService.startScreenShare(this.roomId);

      console.log('[CallRoom] Screen sharing started');
      if (this.isElectronApp) {
        this.resetPendingScreenSource();
      }
    } catch (error: any) {
      console.error('[CallRoom] Error starting screen share:', error);
      this.error = 'Не удалось начать демонстрацию экрана';
      setTimeout(() => (this.error = null), 3000);
    }
  }

  /**
   * Остановка демонстрации экрана
   */
  async stopScreenShare(): Promise<void> {
    this.webrtcService.stopScreenShare();
    this.webrtcService.removeScreenShareFromConnections();
    await this.renegotiateAllPeers();
    this.websocketService.stopScreenShare(this.roomId);
    console.log('[CallRoom] Screen sharing stopped');
    if (this.previewPeerId === 'local') {
      this.closeScreenPreview();
    }
  }

  handleScreenShareClick(): void {
    if (this.isScreenSharing) {
      void this.stopScreenShare();
      return;
    }
    if (this.isElectronApp) {
      this.openScreenSourceModal();
      return;
    }
    this.openScreenShareModal();
  }

  get showSettingsModal(): boolean {
    return this.router.url.includes('/settings');
  }

  openSettingsModal(): void {
    if (this.showSettingsModal) {
      this.router.navigate(['./'], { relativeTo: this.route });
    } else {
      this.router.navigate(['settings'], { relativeTo: this.route });
    }
  }

  openScreenShareModal(): void {
    if (this.isElectronApp && !this.pendingScreenSource) {
      this.openScreenSourceModal();
      return;
    }
    this.showScreenShareModal = true;
  }

  closeScreenShareModal(resetSelection = true): void {
    this.showScreenShareModal = false;
    if (resetSelection) {
      this.resetPendingScreenSource();
    }
  }

  openScreenSourceModal(): void {
    if (!this.isElectronApp) {
      this.openScreenShareModal();
      return;
    }

    this.showScreenSourceModal = true;
    this.screenSourcesError = null;
    void this.loadScreenSources();
  }

  closeScreenSourceModal(resetSelection = true): void {
    this.showScreenSourceModal = false;
    if (resetSelection) {
      this.resetPendingScreenSource();
    }
  }

  async loadScreenSources(): Promise<void> {
    if (!this.isElectronApp) {
      return;
    }
    this.screenSourcesLoading = true;
    this.screenSourcesError = null;
    try {
      const sources = await this.electronService.getScreenSources({
        thumbnailSize: { width: 640, height: 360 },
        fetchWindowIcons: true,
      });
      this.screenSources = sources.map((source) => this.mapElectronSource(source));
    } catch (error) {
      console.error('[CallRoom] Failed to load screen sources', error);
      this.screenSources = [];
      this.screenSourcesError =
        'Не удалось получить список окон. Проверьте разрешения и попробуйте снова.';
    } finally {
      this.screenSourcesLoading = false;
    }
  }

  refreshScreenSources(): void {
    if (this.screenSourcesLoading) {
      return;
    }
    void this.loadScreenSources();
  }

  handleScreenSourceSelect(source: ScreenShareSource): void {
    this.pendingScreenSource = source;
    this.closeScreenSourceModal(false);
    this.openScreenShareModal();
  }

  changeScreenSource(): void {
    this.closeScreenShareModal(false);
    this.pendingScreenSource = null;
    this.openScreenSourceModal();
  }

  private resetPendingScreenSource(): void {
    this.pendingScreenSource = null;
  }

  private mapElectronSource(source: ElectronScreenSource): ScreenShareSource {
    return {
      id: source.id,
      name: (source.name || 'Неизвестный источник').trim(),
      type: source.type,
      displayId: source.displayId,
      thumbnail: source.thumbnail
        ? (this.sanitizer.bypassSecurityTrustUrl(source.thumbnail) as SafeUrl)
        : null,
      appIcon: source.appIcon
        ? (this.sanitizer.bypassSecurityTrustUrl(source.appIcon) as SafeUrl)
        : null,
    };
  }

  async selectScreenShareQuality(option: ScreenShareQuality): Promise<void> {
    if (this.isElectronApp && !this.pendingScreenSource) {
      this.openScreenSourceModal();
      return;
    }
    const sourceId = this.pendingScreenSource?.id;
    this.closeScreenShareModal(false);
    await this.startScreenShare(option, sourceId);
  }

  openScreenPreview(stream?: MediaStream | null, title?: string, peerId?: string): void {
    if (!stream) {
      return;
    }
    if (this.previewPeerId && this.previewPeerId !== 'local') {
      this.handlePreviewVoiceDucking(false, this.previewPeerId);
    }
    this.previewStream = stream;
    this.previewTitle = title || 'Демонстрация экрана';
    this.previewPeerId = peerId ?? null;
    this.previewHasAudio = !!stream.getAudioTracks().length && this.previewPeerId !== 'local';
    this.previewAudioVolume = 0.85;
    this.showScreenPreviewModal = true;
    this.setPreviewAudioState(false);
    this.attachPreviewStream();
  }

  closeScreenPreview(): void {
    this.setPreviewAudioState(false);
    this.showScreenPreviewModal = false;
    this.previewStream = null;
    this.previewPeerId = null;
    this.previewHasAudio = false;
    this.attachPreviewStream();
  }

  togglePreviewFullscreen(): void {
    const videoElement = this.previewVideo?.nativeElement;
    if (!videoElement) {
      return;
    }

    // Получаем контейнер с видео и контролами (родительский элемент видео)
    const videoContainer = videoElement.parentElement;
    if (!videoContainer) {
      return;
    }

    if (!document.fullscreenElement) {
      // Входим в полноэкранный режим (весь контейнер с контролами)
      videoContainer.requestFullscreen().catch((err) => {
        console.error('[CallRoom] Error entering fullscreen:', err);
      });
    } else {
      // Выходим из полноэкранного режима
      document.exitFullscreen().catch((err) => {
        console.error('[CallRoom] Error exiting fullscreen:', err);
      });
    }
  }

  togglePreviewAudio(): void {
    if (!this.previewHasAudio || this.previewPeerId === 'local') {
      return;
    }
    this.setPreviewAudioState(!this.previewAudioEnabled);
  }

  onPreviewAudioVolumeChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.previewAudioVolume = Math.min(1, Math.max(0, value));
      this.applyPreviewAudioState();
    }
  }

  private setPreviewAudioState(enabled: boolean): void {
    const shouldEnable = enabled && this.previewHasAudio && this.previewPeerId !== 'local';
    this.previewAudioEnabled = shouldEnable;
    this.applyPreviewAudioState();
    this.handlePreviewVoiceDucking(this.previewAudioEnabled);
  }

  private applyPreviewAudioState(target?: HTMLVideoElement): void {
    const videoEl = target ?? this.previewVideo?.nativeElement;
    if (!videoEl) {
      return;
    }
    const shouldMute = !this.previewAudioEnabled || this.previewPeerId === 'local';
    videoEl.muted = shouldMute;
    videoEl.volume = shouldMute ? 0 : this.previewAudioVolume;
  }

  private handlePreviewVoiceDucking(active: boolean, targetPeerId?: string | null): void {
    const peerId = targetPeerId ?? this.previewPeerId;
    if (!peerId || peerId === 'local') {
      return;
    }

    const audioRef = this.remoteAudioElements?.find(
      (el) => el.nativeElement.dataset['peerId'] === peerId
    );
    if (!audioRef) {
      return;
    }

    const native = audioRef.nativeElement;
    if (active) {
      if (!this.remoteAudioVolumeSnapshot.has(peerId)) {
        this.remoteAudioVolumeSnapshot.set(peerId, native.volume ?? 1);
      }
      native.volume = 0.35;
    } else {
      const previous = this.remoteAudioVolumeSnapshot.get(peerId);
      native.volume = previous ?? 1;
      this.remoteAudioVolumeSnapshot.delete(peerId);
    }
  }

  /**
   * Переключение deafen (отключение звука от всех)
   */
  toggleDeafen(): void {
    this.isDeafened = !this.isDeafened;

    // Отключаем/включаем все удаленные аудио элементы
    this.remoteAudioElements?.forEach((audioEl) => {
      audioEl.nativeElement.muted = this.isDeafened;
    });
  }

  /**
   * Копирование ссылки на комнату
   */
  copyRoomLink(): void {
    const link = `${window.location.origin}/call/${this.roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      console.log('[CallRoom] Room link copied to clipboard');
      this.showCopyNotification = true;
    });
  }

  onCopyNotificationClosed(): void {
    this.showCopyNotification = false;
  }

  /**
   * Открыть модальное окно подтверждения выхода
   */
  confirmLeaveRoom(): void {
    this.showLeaveModal = true;
  }

  /**
   * Закрыть модальное окно
   */
  closeLeaveModal(): void {
    this.showLeaveModal = false;
  }

  @HostListener('document:click')
  @HostListener('document:keydown')
  handleUserInteraction(): void {
    if (this.audioAutoplayBlocked) {
      this.resumePendingAudio();
    }
  }

  @HostListener('document:fullscreenchange')
  handleFullscreenChange(): void {
    this.previewIsFullscreen = !!document.fullscreenElement;
  }

  isCurrentParticipant(participant: RoomParticipant): boolean {
    return this.currentUser ? participant.id === this.currentUser.id : false;
  }

  getParticipantDisplayName(participant: RoomParticipant): string {
    return participant.displayName || participant.username || '';
  }

  getParticipantInitial(participant: {
    id: string;
    username: string;
    displayName?: string;
  }): string {
    const source = this.getParticipantDisplayName(participant as RoomParticipant);
    return source.charAt(0).toUpperCase();
  }

  private findPeerByUserId(userId: string): RemotePeer | undefined {
    return this.remotePeers.find((peer) => peer.id === userId);
  }

  isParticipantMuted(participant: RoomParticipant): boolean {
    if (this.isCurrentParticipant(participant)) {
      // Если микрофон недоступен, показываем как замьюченный
      if (this.microphRoobertatus !== 'granted') {
        return true;
      }
      return this.isMuted;
    }
    const peer = this.findPeerByUserId(participant.id || '');
    return peer ? peer.isMuted : true;
  }

  isParticipantScreenSharing(participant: RoomParticipant): boolean {
    if (this.isCurrentParticipant(participant)) {
      return this.isScreenSharing;
    }
    const peer = this.findPeerByUserId(participant.id || '');
    return peer ? peer.isScreenSharing : false;
  }

  get pushToTalkStatusLabel(): string {
    if (this.pushToTalkManualOverride) {
      return 'Закреплено';
    }
    if (this.pushToTalkHolding) {
      return 'Активно';
    }
    return 'Ожидание';
  }

  /**
   * Получение текста тултипа для кнопки микрофона
   */
  getMicrophoneTooltip(): string {
    switch (this.microphRoobertatus) {
      case 'pending':
        return 'Ожидается доступ к микрофону...';
      case 'denied':
        return 'Доступ к микрофону запрещён. Нажмите, чтобы попробовать снова';
      case 'not-found':
        return 'Микрофон не найден. Нажмите, чтобы попробовать снова';
      case 'granted':
        if (this.pushToTalkEnabled) {
          if (this.pushToTalkManualOverride) {
            return 'Микрофон закреплён. Нажмите, чтобы вернуться к удержанию';
          }
          const shortcut = this.pushToTalkShortcutLabel || 'выбранную комбинацию';
          return `Удерживайте ${shortcut}, чтобы говорить`;
        }
        return this.isMuted ? 'Включить микрофон' : 'Выключить микрофон';
      default:
        return 'Микрофон';
    }
  }

  /**
   * Проверка, ждём ли мы доступ к микрофону
   */
  get isMicrophonePending(): boolean {
    return this.microphRoobertatus === 'pending';
  }

  /**
   * Проверка, есть ли проблема с микрофоном
   */
  get hasMicrophoneIssue(): boolean {
    return this.microphRoobertatus === 'denied' || this.microphRoobertatus === 'not-found';
  }

  // Media Viewer Logic
  private updateMediaGallery(): void {
    const items: MediaItem[] = [];
    // Iterate in reverse to show newest first
    for (let i = this.chatMessages.length - 1; i >= 0; i--) {
      const msg = this.chatMessages[i];
      if (msg.files) {
        // Within a message, files are usually ordered. If we want absolutely newest first,
        // and assuming files are appended, we might want to reverse this inner loop too
        // or keep it as is depending on "upload order". Let's reverse inner too for consistency.
        for (let j = msg.files.length - 1; j >= 0; j--) {
          const file = msg.files[j];
          if (this.isImage(file.type) || this.isVideo(file.type)) {
            items.push({
              url: this.getDownloadUrl(file.url) + '?inline=true',
              type: this.isImage(file.type) ? 'image' : 'video',
              senderName: msg.user.displayName || msg.user.username,
              sentAt: new Date(msg.createdAt),
              filename: file.name,
            });
          }
        }
      }

      // Add link preview images to gallery
      if (msg.linkPreview && msg.linkPreview.type === 'image' && msg.linkPreview.url) {
        items.push({
          url: msg.linkPreview.url,
          type: 'image',
          senderName: msg.user.displayName || msg.user.username,
          sentAt: new Date(msg.createdAt),
          filename: msg.linkPreview.siteName || 'Link Image',
        });
      }
    }
    this.mediaGalleryItems = items;
  }

  hasMediaFiles(files?: { type: string }[]): boolean {
    if (!files) return false;
    return files.some((f) => this.isImage(f.type) || this.isVideo(f.type));
  }

  hasOtherFiles(files?: { type: string }[]): boolean {
    if (!files) return false;
    return files.some((f) => !this.isImage(f.type) && !this.isVideo(f.type));
  }

  openMediaViewer(
    url: string,
    type: string,
    senderName: string,
    sentAt: Date | string,
    filename: string
  ): void {
    const isLocalFile = !url.startsWith('http');
    const finalUrl = isLocalFile ? this.getDownloadUrl(url) + '?inline=true' : url;

    this.selectedMediaItem = {
      url: finalUrl,
      type: this.isImage(type) || type === 'image' ? 'image' : 'video',
      senderName,
      sentAt: new Date(sentAt),
      filename,
    };
    this.showMediaViewer = true;
  }

  openLinkPreviewMedia(msg: ChatMessage): void {
    if (!msg.linkPreview || msg.linkPreview.type !== 'image' || !msg.linkPreview.url) return;

    this.openMediaViewer(
      msg.linkPreview.url,
      'image',
      msg.user.displayName || msg.user.username,
      msg.createdAt,
      msg.linkPreview.siteName || 'Link Image'
    );
  }

  closeMediaViewer(): void {
    this.showMediaViewer = false;
    this.selectedMediaItem = undefined;
  }

  isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  isVideo(mimeType: string): boolean {
    return mimeType.startsWith('video/');
  }

  getMediaFiles(files?: any[]): any[] {
    if (!files) return [];
    return files.filter((f) => this.isImage(f.type) || this.isVideo(f.type));
  }

  getMediaGridClass(count: number): string {
    switch (count) {
      case 1:
        return 'grid-cols-1 max-w-[480px]';
      case 2:
        return 'grid-cols-2 max-w-[600px]';
      case 3:
        return 'grid-cols-2 max-w-[600px]';
      case 4:
        return 'grid-cols-2 max-w-[600px]';
      default:
        return 'grid-cols-3 max-w-[800px]';
    }
  }

  getMediaItemClass(index: number, count: number, file: any): string {
    const isVideo = this.isVideo(file.type);

    if (count === 1) {
      // Для одного файла: видео 16:9, изображение адаптивное
      return isVideo ? 'aspect-video w-full' : 'w-full h-auto max-h-[500px]';
    }

    if (count === 2) {
      // Два файла: 4:3
      return 'aspect-[4/3]';
    }

    if (count === 3) {
      // Три файла: первый широкий сверху
      if (index === 0) return 'col-span-2 aspect-[21/9]';
      return 'aspect-[4/3]';
    }

    if (count === 4) {
      // Четыре файла: 2x2, 16:9
      return 'aspect-video';
    }

    // 5 и более: квадраты
    return 'aspect-square';
  }

  /**
   * Выход из комнаты
   */
  leaveRoom(options?: { skipNavigation?: boolean }): void {
    if (this.hasLeftRoom) {
      return;
    }
    this.hasLeftRoom = true;

    const skipNavigation = options?.skipNavigation ?? false;

    console.log('[CallRoom] Leaving room...');

    this.showLeaveModal = false;

    // Останавливаем все стримы
    this.webrtcService.cleanup();

    // Отключаемся от WebRTC комнаты
    void this.websocketService.leaveWebRTCRoom().catch(() => undefined);

    // Выходим из комнаты через WebSocket
    this.websocketService.leaveRoom(this.roomId);

    // Отключаемся от WebSocket
    this.websocketService.disconnectAll();

    // Переходим на dashboard
    if (!skipNavigation) {
      this.router.navigate(['/dashboard']);
    }
  }

  /**
   * Получение количества участников с демонстрацией экрана
   */
  get screenSharingCount(): number {
    return (
      this.remotePeers.filter((p) => p.isScreenSharing).length + (this.isScreenSharing ? 1 : 0)
    );
  }

  private initializeScreenShareOptions(): void {
    const profiles = this.webrtcService.getScreenShareProfiles();
    this.screenShareOptions = Object.entries(profiles).map(([key, profile]) => ({
      id: key as ScreenShareQuality,
      ...profile,
    }));
    this.selectedScreenShareQuality = this.webrtcService.getDefaultScreenShareQuality();
  }

  private async loadIceServers(): Promise<void> {
    try {
      const iceServers = await firstValueFrom(this.webrtcApiService.getIceServers());
      if (iceServers.length) {
        this.webrtcService.configureIceServers(iceServers);
      }
    } catch (error) {
      console.warn('[CallRoom] Failed to load ICE servers, fallback to defaults', error);
    }
  }

  private attachPreviewStream(): void {
    setTimeout(() => {
      const videoEl = this.previewVideo?.nativeElement;
      if (!videoEl) {
        return;
      }
      if (this.previewStream) {
        videoEl.srcObject = this.previewStream;
        this.applyPreviewAudioState(videoEl);
        videoEl.play().catch((error) => console.error('[CallRoom] Preview play error', error));
      } else {
        videoEl.srcObject = null;
      }
    }, 0);
  }

  private attachAndPlayAudio(peerId: string, stream: MediaStream): void {
    const audioElement = this.remoteAudioElements?.find(
      (el) => el.nativeElement.dataset['peerId'] === peerId
    );

    if (!audioElement) {
      return;
    }

    audioElement.nativeElement.srcObject = stream;
    const remotePeer = this.remotePeers.find((peer) => peer.socketId === peerId);
    this.applyStoredVolumeForSocket(peerId, remotePeer?.id);

    // Применяем выбранное устройство вывода
    const selectedDevice = this.webrtcService.getSelectedDevices().audioOutputId;
    if (selectedDevice && selectedDevice !== 'default') {
      this.setSinkId(audioElement.nativeElement, selectedDevice);
    }

    audioElement.nativeElement.muted = this.isDeafened;
    const playPromise = audioElement.nativeElement.play();

    if (playPromise) {
      playPromise.catch((error) => {
        console.warn('[CallRoom] Autoplay prevented, waiting for user interaction', error);
        this.pendingAudioPlayback.set(peerId, stream);
        this.audioAutoplayBlocked = true;
      });
    }
  }

  private applyStoredVolumeForSocket(peerId: string, userId?: string | null): void {
    const targetVolume = this.volumePreferences.getVolume(userId);
    this.updateAudioElementVolume(peerId, targetVolume);
  }

  private applyParticipantVolume(userId: string, volumePercent: number): void {
    const peer = this.findPeerByUserId(userId);
    if (!peer?.socketId) {
      return;
    }
    this.updateAudioElementVolume(peer.socketId, volumePercent);
  }

  private updateAudioElementVolume(peerId: string, volumePercent: number): void {
    const audioRef = this.remoteAudioElements?.find(
      (el) => el.nativeElement.dataset['peerId'] === peerId
    );

    if (!audioRef) {
      return;
    }

    const normalizedVolume = this.percentToGain(volumePercent);

    if (this.remoteAudioVolumeSnapshot.has(peerId)) {
      this.remoteAudioVolumeSnapshot.set(peerId, normalizedVolume);
      return;
    }

    audioRef.nativeElement.volume = normalizedVolume;
  }

  private percentToGain(volumePercent: number): number {
    if (!Number.isFinite(volumePercent)) {
      return 1;
    }
    return Math.min(1, Math.max(0, volumePercent / 100));
  }

  private clampVolumePercent(volume: number): number {
    if (!Number.isFinite(volume)) {
      return 100;
    }
    return Math.max(0, Math.min(100, Math.round(volume)));
  }

  private resumePendingAudio(): void {
    if (!this.pendingAudioPlayback.size) {
      return;
    }

    for (const [peerId, stream] of this.pendingAudioPlayback.entries()) {
      this.attachAndPlayAudio(peerId, stream);
    }

    this.pendingAudioPlayback.clear();
    this.audioAutoplayBlocked = false;
  }

  /**
   * Открытие контекстного меню для участника
   */
  openParticipantContextMenu(event: MouseEvent, participant: RoomParticipant): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.currentUser) return;

    this.selectedParticipant = participant;
    this.participantContextMenuPosition = { x: event.clientX, y: event.clientY };
    this.participantVolume = this.volumePreferences.getVolume(participant.id);

    // Создаем меню через сервис с колбэками
    this.participantContextMenuItems = this.participantMenuService.createParticipantMenu(
      participant,
      {
        currentUserId: this.currentUser.id,
        isRoomOwner: false, // TODO: Добавить проверку владельца комнаты
        currentVolume: this.participantVolume,
        callbacks: {
          onVolumeChange: (p, volume) => this.handleVolumeChange(p, volume),
          onMute: (p) => this.handleMuteParticipant(p),
          onKick: (p) => this.handleKickParticipant(p),
          onViewProfile: (p) => this.handleViewProfile(p),
        },
      }
    );

    this.showParticipantContextMenu = true;
  }

  /**
   * Закрытие контекстного меню
   */
  closeParticipantContextMenu(): void {
    this.showParticipantContextMenu = false;
    this.selectedParticipant = null;
  }

  /**
   * Обработчик изменения громкости участника
   */
  private handleVolumeChange(participant: RoomParticipant, volume: number): void {
    const safeVolume = this.clampVolumePercent(volume);
    this.participantVolume = safeVolume;
    this.volumePreferences.setVolume(participant.id, safeVolume);
    console.log(`[CallRoom] Volume for ${participant.username} changed to:`, safeVolume);

    // Обновляем значение в меню
    this.participantContextMenuItems = this.participantMenuService.updateSliderValue(
      this.participantContextMenuItems,
      'volume',
      safeVolume
    );
    this.applyParticipantVolume(participant.id, safeVolume);
  }

  /**
   * Обработчик отключения звука участника
   */
  private handleMuteParticipant(participant: RoomParticipant): void {
    console.log('[CallRoom] Mute participant:', participant.username);
    // TODO: Реализовать локальное отключение звука участника
  }

  /**
   * Обработчик исключения участника (только для владельца)
   */
  private handleKickParticipant(participant: RoomParticipant): void {
    console.log('[CallRoom] Kick participant:', participant.username);
    // TODO: Реализовать исключение участника из комнаты
  }

  /**
   * Обработчик просмотра профиля
   */
  private handleViewProfile(participant: RoomParticipant): void {
    console.log('[CallRoom] View profile:', participant.username);
    // TODO: Реализовать просмотр профиля участника
  }

  /**
   * Обработчик клика на элемент контекстного меню (legacy, для обратной совместимости)
   */
  onParticipantContextMenuItemClick(item: ContextMenuItem): void {
    // Обработка будет через колбэки в элементах меню
  }

  /**
   * Обработчик изменения слайдера (legacy, для обратной совместимости)
   */
  onParticipantVolumeChange(data: { itemId: string; value: number }): void {
    // Обработка будет через колбэки в элементах меню
  }
}
