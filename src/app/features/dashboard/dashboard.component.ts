import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { RoomsService, Room } from '../../core/services/rooms.service';
import { User } from '../../core/models/user.model';
import { PageMetaService } from '../../core/services/page-meta.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { NotificationComponent } from '../../shared/components/notification/notification.component';
import { TooltipDirective } from '../../shared/components/tooltip/tooltip.directive';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { LucideAngularModule, Plus, LogIn, Copy, LayoutGrid, Layers, Video, Mic, Monitor, Lock, Zap, ShieldCheck } from 'lucide-angular';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageHeaderComponent,
    ButtonComponent,
    NotificationComponent,
    TooltipDirective,
    LoadingSpinnerComponent,
    LucideAngularModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  readonly ROOM_LIMIT = 50;

  readonly Plus = Plus;
  readonly LogIn = LogIn;
  readonly Copy = Copy;
  readonly LayoutGrid = LayoutGrid;
  readonly Layers = Layers;
  readonly Video = Video;
  readonly Mic = Mic;
  readonly Monitor = Monitor;
  readonly Lock = Lock;
  readonly Zap = Zap;
  readonly ShieldCheck = ShieldCheck;

  currentUser: User | null = null;
  roomId: string = '';
  isCreatingRoom: boolean = false;
  isRoomsLoading = false;
  deletingRoomId: string | null = null;
  myRooms: Room[] = [];
  
  showNotification = false;
  notificationType: 'success' | 'error' = 'success';
  notificationMessage = '';

  constructor(
    private authService: AuthService,
    private roomsService: RoomsService,
    private router: Router,
    private pageMeta: PageMetaService,
  ) {}

  ngOnInit(): void {
    this.pageMeta.set({
      title: 'Главная',
      description: 'Создайте свою первую комнату или присоединитесь к существующей',
    });

    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        this.currentUser = user;
        if (user) {
          this.loadUserRooms();
        } else {
          this.myRooms = [];
        }
      });
  }

  createRoom(): void {
    if (this.isCreatingRoom) {
      return;
    }

    if (this.myRooms.length >= this.ROOM_LIMIT) {
      this.showErrorNotification(`Лимит в ${this.ROOM_LIMIT} активных комнат уже исчерпан`);
      return;
    }

    this.isCreatingRoom = true;

    // Создаём комнату через API
    this.roomsService
      .createRoom({
        name: `Комната ${this.currentUser?.username || 'Пользователя'}`,
        maxParticipants: 10,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (roomResponse) => {
          console.log('[Dashboard] Room created:', roomResponse);
          const createdRoomId = roomResponse?.roomId;

          if (!createdRoomId) {
            console.error('[Dashboard] Invalid room response:', roomResponse);
            this.showErrorNotification('Не удалось определить ID комнаты');
            this.isCreatingRoom = false;
            return;
          }

          this.showSuccessNotification('Комната успешно создана');
          this.loadUserRooms(false);
          this.router.navigate(['/call', createdRoomId]);
          this.isCreatingRoom = false;
        },
        error: (error) => {
          console.error('[Dashboard] Failed to create room:', error);
          const message =
            error?.error?.message ||
            (typeof error?.error === 'string' ? error.error : 'Не удалось создать комнату');
          this.showErrorNotification(message);
          this.isCreatingRoom = false;
        },
      });
  }

  joinRoom(): void {
    if (this.roomId.trim()) {
      this.router.navigate(['/call', this.roomId]);
    }
  }

  joinRoomFromList(room: Room): void {
    this.router.navigate(['/call', room.roomId]);
  }

  removeRoom(room: Room): void {
    if (this.deletingRoomId) {
      return;
    }

    const confirmed = window.confirm(`Удалить комнату «${room.name || room.roomId}»?`);
    if (!confirmed) {
      return;
    }

    this.deletingRoomId = room.roomId;

    this.roomsService
      .closeRoom(room.roomId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.myRooms = this.myRooms.filter((existingRoom) => existingRoom.roomId !== room.roomId);
          this.deletingRoomId = null;
          this.showSuccessNotification('Комната удалена');
        },
        error: (error) => {
          console.error('[Dashboard] Failed to delete room:', error);
          this.deletingRoomId = null;
          const message =
            error?.error?.message ||
            (typeof error?.error === 'string' ? error.error : 'Не удалось удалить комнату');
          this.showErrorNotification(message);
        },
      });
  }

  copyRoomCode(room: Room): void {
    navigator.clipboard.writeText(room.roomId).then(() => {
      this.showSuccessNotification('ID комнаты скопирован');
    });
  }

  formatRoomDate(date: string | undefined | null): string {
    if (!date) {
      return '';
    }
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(date));
  }

  logout(): void {
    this.authService.logout().subscribe();
  }

  copyRoomLink(): void {
    if (!this.roomId.trim()) {
      return;
    }
    const link = `${window.location.origin}/call/${this.roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      this.showSuccessNotification('Ссылка скопирована в буфер обмена');
    });
  }

  showSuccessNotification(message: string): void {
    this.notificationType = 'success';
    this.notificationMessage = message;
    this.showNotification = true;
  }

  showErrorNotification(message: string): void {
    this.notificationType = 'error';
    this.notificationMessage = message;
    this.showNotification = true;
  }

  onNotificationClosed(): void {
    this.showNotification = false;
  }

  private loadUserRooms(showLoader: boolean = true): void {
    if (!this.currentUser) {
      this.myRooms = [];
      return;
    }

    if (showLoader) {
      this.isRoomsLoading = true;
    }

    this.roomsService
      .getMyRooms()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rooms) => {
          this.myRooms = rooms;
          this.isRoomsLoading = false;
        },
        error: (error) => {
          console.error('[Dashboard] Failed to load rooms:', error);
          this.isRoomsLoading = false;
          this.showErrorNotification('Не удалось загрузить список комнат');
        },
      });
  }
}

