import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  AfterViewInit,
  NgZone,
  ChangeDetectorRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  LoaderCircle,
  ChevronRight,
  ChevronLeft,
} from 'lucide-angular';

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div 
      class="relative w-full h-full bg-black overflow-hidden group select-none rounded-xl"
      (mousemove)="onMouseMove()"
      (mouseleave)="onMouseLeave()"
      (window:mouseup)="stopDrag()"
      (window:mousemove)="onDrag($event)"
      role="region"
      aria-label="Twine | Video Player"
    >
      <!-- Video Element -->
      <video
        #videoPlayer
        [src]="src"
        class="w-full h-full object-contain"
        [autoplay]="autoplay"
        (click)="togglePlay()"
        (timeupdate)="onTimeUpdate()"
        (loadedmetadata)="onMetadataLoaded()"
        (waiting)="isLoading = true"
        (canplay)="isLoading = false"
        (playing)="onPlay()"
        (pause)="onPause()"
        (ended)="onEnded()"
      ></video>

      <!-- Loading Spinner -->
      @if (isLoading) {
        <div class="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-10" aria-label="Загрузка видео...">
          <lucide-icon [img]="LoaderCircle" [size]="48" class="text-white animate-spin"></lucide-icon>
        </div>
      }

      <!-- Seek Feedback Overlays -->
      <!-- Right (+10 >) -->
      <div 
        class="absolute right-10 top-1/2 -translate-y-1/2 z-30 flex items-center gap-2 text-white/90 font-bold text-2xl bg-black/40 backdrop-blur-sm px-4 py-2 rounded-xl transition-all duration-300 pointer-events-none"
        [class.opacity-0]="seekFeedback !== 'forward'"
        [class.translate-x-4]="seekFeedback !== 'forward'"
        [class.opacity-100]="seekFeedback === 'forward'"
        [class.translate-x-0]="seekFeedback === 'forward'"
      >
        <span>+{{ seekAccumulator }}</span>
        <lucide-icon [img]="ChevronRight" [size]="32"></lucide-icon>
      </div>

      <!-- Left (< -10) -->
      <div 
        class="absolute left-10 top-1/2 -translate-y-1/2 z-30 flex items-center gap-2 text-white/90 font-bold text-2xl bg-black/40 backdrop-blur-sm px-4 py-2 rounded-xl transition-all duration-300 pointer-events-none"
        [class.opacity-0]="seekFeedback !== 'backward'"
        [class.translate-x-[-1rem]]="seekFeedback !== 'backward'"
        [class.opacity-100]="seekFeedback === 'backward'"
        [class.translate-x-0]="seekFeedback === 'backward'"
      >
        <lucide-icon [img]="ChevronLeft" [size]="32"></lucide-icon>
        <span>-{{ seekAccumulator }}</span>
      </div>

      <!-- Big Play Button (Center) -->
      <div 
        class="absolute inset-0 flex items-center justify-center bg-black/20 z-10 transition-all duration-300 pointer-events-none"
        [class.opacity-0]="isPlaying && !showCenterPlayBtn"
        [class.pointer-events-auto]="!isPlaying || showCenterPlayBtn"
      >
        <div 
          class="p-4 bg-white/10 rounded-full hover:bg-white/20 transition-all duration-300 transform cursor-pointer"
          (click)="togglePlay()"
          [class.scale-100]="!isPlaying || showCenterPlayBtn"
          [class.scale-50]="isPlaying && !showCenterPlayBtn"
          [class.hover:scale-110]="!isPlaying || showCenterPlayBtn"
        >
           <lucide-icon [img]="Play" [size]="48" class="text-white fill-white"></lucide-icon>
        </div>
      </div>

      <!-- Controls Overlay -->
      <div 
        class="absolute bottom-0 left-0 right-0 p-4 bg-linear-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300 z-20"
        [class.opacity-0]="!showControls && isPlaying"
        [class.opacity-100]="showControls || !isPlaying"
      >
        <!-- Progress Bar -->
        <div 
          #progressBar
          class="group/progress relative h-1 w-full bg-white/20 rounded-full mb-4 cursor-pointer hover:h-2 transition-all touch-none"
          (mousedown)="startDrag($event)"
          (mousemove)="onProgressHover($event)"
        >
           <!-- Buffered Bar (Optional) -->
           <!-- <div class="absolute top-0 left-0 h-full bg-white/30 rounded-full" [style.width.%]="bufferedPercent"></div> -->
           
           <!-- Current Progress -->
           <div class="absolute top-0 left-0 h-full bg-violet-400 group-active/progress:bg-violet-500 transition-colors rounded-full pointer-events-none" [style.width.%]="progressPercent"></div>
           
           <!-- Thumb (visible on hover or drag) -->
           <div 
             class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 bg-white rounded-full transition-opacity pointer-events-none"
             [class.opacity-0]="!isDragging"
             [class.group-hover/progress:opacity-100]="true"
             [class.opacity-100]="isDragging"
             [style.left.%]="progressPercent"
           ></div>
        </div>

        <!-- Controls Row -->
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <!-- Play/Pause -->
            <button 
              (click)="togglePlay()"
              class="text-white opacity-90 hover:opacity-100 transition-opacity"
              [attr.aria-label]="isPlaying ? 'Нажмите, чтобы поставить на паузу' : 'Нажмите, чтобы начать воспроизведение'"
              [attr.aria-pressed]="isPlaying"
            >
              <lucide-icon class="fill-current" [img]="isPlaying ? Pause : Play" [size]="24"></lucide-icon>
            </button>

            <!-- Volume -->
            <div class="flex items-center gap-2 group/volume">
              <button 
                (click)="toggleMute()"
                class="text-white opacity-90 hover:opacity-100 transition-opacity"
              >
                <lucide-icon class="fill-current" [img]="isMuted || volume === 0 ? VolumeX : Volume2" [size]="24"></lucide-icon>
              </button>
              
              <!-- Volume Slider Container -->
              <div 
                class="w-0 overflow-hidden group-hover/volume:w-24 transition-all duration-300 ease-out flex items-center h-8"
                [class.w-24]="isDraggingVolume"
              >
                 <div 
                   #volumeBar
                   class="relative w-20 h-1 bg-white/30 rounded-full cursor-pointer touch-none ml-2"
                   (mousedown)="startVolumeDrag($event)"
                 >
                    <!-- Fill -->
                    <div 
                      class="absolute top-0 left-0 h-full bg-white rounded-full pointer-events-none"
                      [style.width.%]="(isMuted ? 0 : volume) * 100"
                    ></div>
                    
                    <!-- Thumb -->
                    <div 
                      class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 bg-white rounded-full pointer-events-none transition-transform"
                      [style.left.%]="(isMuted ? 0 : volume) * 100"
                    ></div>
                 </div>
              </div>
            </div>

            <!-- Time -->
            <div class="text-white/70 text-sm font-medium select-none">
              {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
            </div>
          </div>

          <!-- Right Side Controls -->
          <div class="flex items-center gap-4">
            <!-- Fullscreen -->
            <button 
              (click)="toggleFullscreen()"
              class="text-white/90 hover:text-white hover:scale-110 transition-all focus:outline-none"
            >
              <lucide-icon [img]="isFullscreen ? Minimize : Maximize" [size]="24"></lucide-icon>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class VideoPlayerComponent implements AfterViewInit, OnDestroy {
  @Input() src: string = '';
  @Input() autoplay: boolean = false;

  @ViewChild('videoPlayer') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('progressBar') progressBar!: ElementRef<HTMLElement>;
  @ViewChild('volumeBar') volumeBar!: ElementRef<HTMLElement>;

  // State
  isPlaying = false;
  isLoading = true;
  currentTime = 0;
  duration = 0;
  volume = 0.5;
  isMuted = false;
  isFullscreen = false;

  // UI State
  showControls = true;
  controlsTimeout: any;
  showCenterPlayBtn = true;

  // Drag State
  isDragging = false;
  isDraggingVolume = false;
  dragProgress = 0; // 0-1

  // Seek State
  seekFeedback: 'none' | 'forward' | 'backward' = 'none';
  seekAccumulator = 0;
  seekTimeout: any;

  // Icons
  readonly Play = Play;
  readonly Pause = Pause;
  readonly Volume2 = Volume2;
  readonly VolumeX = VolumeX;
  readonly Maximize = Maximize;
  readonly Minimize = Minimize;
  readonly LoaderCircle = LoaderCircle;
  readonly ChevronRight = ChevronRight;
  readonly ChevronLeft = ChevronLeft;

  constructor(
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private hostElement: ElementRef
  ) {}

  ngAfterViewInit(): void {
    const video = this.videoElement.nativeElement;

    // Set initial state based on autoplay
    if (this.autoplay) {
      this.showCenterPlayBtn = false; // Hide immediately if we expect to play
      video.play().catch(() => {
        // If autoplay fails, revert
        this.isPlaying = false;
        this.showCenterPlayBtn = true;
        this.showControls = true;
      });
    }

    // Initialize volume
    video.volume = this.volume;
  }

  ngOnDestroy(): void {
    this.clearControlsTimeout();
    if (this.seekTimeout) clearTimeout(this.seekTimeout);
  }

  // Keyboard Handling
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    // Ensure we only react if the video is initialized and visible (simple check via duration)
    if (!this.duration) return;

    // Check if active element is not an input
    const activeTag = document.activeElement?.tagName.toLowerCase();
    if (activeTag === 'input' || activeTag === 'textarea') return;

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.accumulateSeek(5);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.accumulateSeek(-5);
    } else if (event.key === ' ' || event.key === 'Space') {
      event.preventDefault();
      this.togglePlay();
    }
  }

  // Video Events
  onTimeUpdate(): void {
    // Don't update time from video while dragging to prevent jumping
    if (!this.isDragging) {
      const video = this.videoElement.nativeElement;
      this.currentTime = video.currentTime;
    }
  }

  onMetadataLoaded(): void {
    const video = this.videoElement.nativeElement;
    this.duration = video.duration;
    this.isLoading = false;
    if (this.autoplay) this.isPlaying = true;
  }

  onEnded(): void {
    this.isPlaying = false;
    this.showCenterPlayBtn = true;
    this.showControls = true;
  }

  // Actions
  togglePlay(): void {
    const video = this.videoElement.nativeElement;
    if (video.paused) {
      video.play().catch((err) => console.error('Error playing video:', err));
    } else {
      video.pause();
    }
  }

  toggleMute(): void {
    const video = this.videoElement.nativeElement;
    this.isMuted = !this.isMuted;
    video.muted = this.isMuted;
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    this.isMuted = this.volume === 0;

    const video = this.videoElement.nativeElement;
    video.volume = this.volume;
    video.muted = this.isMuted;
  }

  // Drag & Seek Logic
  startDrag(event: MouseEvent): void {
    this.isDragging = true;
    this.calculateDragPosition(event);
  }

  startVolumeDrag(event: MouseEvent): void {
    this.isDraggingVolume = true;
    this.calculateVolumePosition(event);
  }

  onDrag(event: MouseEvent): void {
    if (this.isDragging) {
      event.preventDefault(); // Prevent selection
      this.calculateDragPosition(event);
    } else if (this.isDraggingVolume) {
      event.preventDefault();
      this.calculateVolumePosition(event);
    }
  }

  stopDrag(): void {
    if (this.isDragging) {
      this.isDragging = false;
      const video = this.videoElement.nativeElement;
      video.currentTime = this.dragProgress * this.duration;
      this.currentTime = video.currentTime; // Sync immediately
    }

    if (this.isDraggingVolume) {
      this.isDraggingVolume = false;
    }
  }

  private calculateVolumePosition(event: MouseEvent): void {
    if (!this.volumeBar) return;

    const rect = this.volumeBar.nativeElement.getBoundingClientRect();
    const clickPosition = event.clientX - rect.left;
    const percentage = Math.min(Math.max(0, clickPosition / rect.width), 1);

    this.setVolume(percentage);
  }

  private calculateDragPosition(event: MouseEvent): void {
    if (!this.progressBar) return;

    const rect = this.progressBar.nativeElement.getBoundingClientRect();
    const clickPosition = event.clientX - rect.left;
    // Clamp between 0 and 1
    this.dragProgress = Math.min(Math.max(0, clickPosition / rect.width), 1);

    // Update current time visually if needed for time display
    this.currentTime = this.dragProgress * this.duration;
  }

  seek(event: MouseEvent): void {
    // Deprecated in favor of drag logic
  }

  onProgressHover(event: MouseEvent): void {
    // Preview logic
  }

  // Accumulative Seeking
  accumulateSeek(seconds: number): void {
    const video = this.videoElement.nativeElement;
    const currentTime = video.currentTime;

    // Reset timeout if exists
    if (this.seekTimeout) clearTimeout(this.seekTimeout);

    // If changing direction or starting new seek sequence (feedback was hidden), reset accumulator
    if (
      this.seekFeedback === 'none' ||
      (seconds > 0 && this.seekFeedback === 'backward') ||
      (seconds < 0 && this.seekFeedback === 'forward')
    ) {
      this.seekAccumulator = 0;
    }

    // Calculate potential target time to check bounds
    // We need to know if we CAN seek in this direction
    let canSeek = true;
    if (seconds > 0 && currentTime >= this.duration - 0.1) canSeek = false;
    if (seconds < 0 && currentTime <= 0.1) canSeek = false;

    if (!canSeek) {
      // If we can't seek, don't increment accumulator.
      // If we haven't started accumulating (accumulator is 0), don't show feedback at all.
      if (this.seekAccumulator === 0) return;

      // If we already have an accumulator (e.g. +5), we just keep it as is,
      // but we still want to refresh the timeout so it doesn't disappear immediately if user keeps pressing.
      // So we just fall through to the timeout part, BUT we skip incrementing and applying seek.
    } else {
      // Update Accumulator
      this.seekAccumulator += Math.abs(seconds);
      this.seekFeedback = seconds > 0 ? 'forward' : 'backward';

      // Apply seek immediately
      const targetTime = Math.min(Math.max(0, currentTime + seconds), this.duration);
      video.currentTime = targetTime;
      this.currentTime = video.currentTime;
    }

    // Hide feedback after delay
    this.seekTimeout = setTimeout(() => {
      this.seekFeedback = 'none';
      // Do NOT reset seekAccumulator here.
      // It will be reset at the START of the next seek sequence.
      // This prevents the "+0" / "-0" flash.
    }, 1000);
  }

  onPlay(): void {
    this.isPlaying = true;
    this.isLoading = false;
    this.showCenterPlayBtn = false;
    this.resetControlsTimer();
  }

  onPause(): void {
    this.isPlaying = false;
    this.showCenterPlayBtn = true;
    this.showControls = true;
    this.clearControlsTimeout();
  }

  toggleFullscreen(): void {
    const elem = this.hostElement.nativeElement;

    if (!document.fullscreenElement) {
      elem
        .requestFullscreen()
        .then(() => {
          this.isFullscreen = true;
        })
        .catch((err: any) => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
      document.exitFullscreen().then(() => {
        this.isFullscreen = false;
      });
    }
  }

  // Helpers
  get progressPercent(): number {
    if (!this.duration) return 0;
    if (this.isDragging) return this.dragProgress * 100;
    return (this.currentTime / this.duration) * 100;
  }

  formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';

    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // Controls Visibility
  onMouseMove(): void {
    this.showControls = true;
    if (this.isPlaying) {
      this.resetControlsTimer();
    }
  }

  onMouseLeave(): void {
    if (this.isPlaying) {
      this.showControls = false;
    }
  }

  resetControlsTimer(): void {
    this.clearControlsTimeout();
    this.controlsTimeout = setTimeout(() => {
      if (this.isPlaying) {
        this.showControls = false;
      }
    }, 2500);
  }

  clearControlsTimeout(): void {
    if (this.controlsTimeout) {
      clearTimeout(this.controlsTimeout);
      this.controlsTimeout = null;
    }
  }
}
