import {
  Component,
  Input,
  Output,
  EventEmitter,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
  NgZone,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X, ExternalLink, Link, ZoomIn, ZoomOut, Download } from 'lucide-angular';
import { VideoPlayerComponent } from '../../../../shared/components/video-player/video-player.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TooltipDirective } from '../../../../shared/components/tooltip/tooltip.directive';
import { register } from 'swiper/element/bundle';
import { SwiperContainer } from 'swiper/element';
import { SwiperOptions } from 'swiper/types';

// Register Swiper custom elements
register();

export interface MediaItem {
  url: string;
  type: 'image' | 'video';
  senderName: string;
  sentAt: Date;
  filename: string;
}

@Component({
  selector: 'app-media-viewer-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, ModalComponent, TooltipDirective, VideoPlayerComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <app-modal
      [isOpen]="isOpen"
      [customLayout]="true"
      [variant]="'transparent'"
      [size]="'full'"
      [backdropClass]="'bg-black/85'"
      (closed)="close()"
    >
      <div class="flex flex-col h-screen w-full relative" slot="custom">
        <!-- Header -->
        <div class="absolute top-0 left-0 right-0 z-50 p-4 flex items-start justify-between bg-linear-to-b from-black/80 to-transparent transition-opacity hover:opacity-100" [class.opacity-0]="idle && !isHoveringControls">
          <!-- User Info -->
          <div class="flex flex-col text-white/90 drop-shadow-md">
            <span class="font-bold text-lg leading-none">{{ currentItem?.senderName }}</span>
            <span class="text-sm opacity-60 mt-1">{{ formatTime(currentItem?.sentAt) }}</span>
          </div>

          <!-- Controls -->
          <div 
            class="flex items-center gap-2"
            (mouseenter)="isHoveringControls = true"
            (mouseleave)="isHoveringControls = false"
          >
            @if (currentItem?.type === 'image') {
              <button 
                (click)="zoomIn()" 
                class="p-2 rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors backdrop-blur-sm border border-white/5"
                aria-label="Приблизить"
                [appTooltip]="'Приблизить'"
                tooltipPosition="bottom"
              >
                <lucide-icon [img]="ZoomIn" [size]="20"></lucide-icon>
              </button>
              <button 
                (click)="zoomOut()" 
                [disabled]="scale <= 1"
                class="p-2 rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors backdrop-blur-sm border border-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Отдалить"
                [appTooltip]="scale <= 1 ? 'Отдалять можно только приближенные изображения' : 'Отдалить'"
                tooltipPosition="bottom"
              >
                <lucide-icon [img]="ZoomOut" [size]="20"></lucide-icon>
              </button>
            }
            
            <a 
              [href]="currentItem?.url" 
              target="_blank"
              class="p-2 rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors backdrop-blur-sm border border-white/5"
              aria-label="Открыть в браузере"
              [appTooltip]="'Открыть в браузере'"
              tooltipPosition="bottom"
            >
              <lucide-icon [img]="ExternalLink" [size]="20"></lucide-icon>
            </a>

            <button 
              (click)="copyLink()" 
              class="p-2 rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors backdrop-blur-sm border border-white/5"
              aria-label="Копировать ссылку"
              [appTooltip]="'Копировать ссылку'"
              tooltipPosition="bottom"
            >
              <lucide-icon [img]="Link" [size]="20"></lucide-icon>
            </button>

            <button 
              (click)="close()" 
              class="p-2 rounded-full bg-white/10 text-white/90 hover:bg-white/15 transition-colors backdrop-blur-md border border-white/5 ml-2"
              aria-label="Закрыть"
              [appTooltip]="'Закрыть'"
              tooltipPosition="bottom"
            >
              <lucide-icon [img]="X" [size]="20"></lucide-icon>
            </button>
          </div>
        </div>

        <!-- Main Content Area -->
        <div 
          class="flex-1 flex items-center justify-center overflow-hidden relative w-full h-full"
          (mousemove)="onMouseMove()"
          (click)="onBackdropClick($event)"
        >
          @if (currentItem) {
            @if (currentItem.type === 'image') {
              <div 
                class="transition-transform duration-200 ease-out origin-center will-change-transform cursor-grab active:cursor-grabbing"
                [style.transform]="'scale(' + scale + ') translate(' + panX + 'px, ' + panY + 'px)'"
                (mousedown)="startPan($event)"
                (window:mousemove)="pan($event)"
                (window:mouseup)="endPan()"
                (wheel)="onWheel($event)"
              >
                <img 
                  [src]="currentItem.url" 
                  [alt]="currentItem.filename"
                  class="max-w-[90vw] max-h-[85vh] object-contain select-none rounded-lg shadow-2xl"
                  draggable="false"
                >
              </div>
            } @else {
              <div class="max-w-[90vw] max-h-[85vh] w-auto aspect-video rounded-xl shadow-2xl overflow-hidden bg-black" (click)="$event.stopPropagation()">
                <app-video-player 
                  [src]="currentItem.url" 
                  [autoplay]="true"
                ></app-video-player>
              </div>
            }
          }
        </div>

        <!-- Gallery (Bottom) -->
        <div 
          class="absolute bottom-0 left-0 right-0 z-50 pb-2 bg-linear-to-t from-black/90 to-transparent transition-opacity duration-300"
          [class.opacity-0]="!isGalleryReady || (idle && !isHoveringGallery)"
          (mouseenter)="isHoveringGallery = true"
          (mouseleave)="isHoveringGallery = false"
        >
          <div class="w-full max-w-[800px] mx-auto overflow-hidden px-4">
            <swiper-container
              #swiper
              class="w-full block"
              init="false"
            >
              @for (item of galleryItems; track item.url) {
                <swiper-slide 
                  class="rounded-xl size-14 my-auto flex items-center justify-center origin-center"
                  [class.z-10]="isCurrent(item)"
                >
                  <button
                    (click)="selectItem(item, $index)"
                    class="relative group w-full h-full rounded-lg bg-white/10 overflow-hidden border transition-all object-cover"
                    [class.border-violet-500]="isCurrent(item)"
                    [class.shadow-lg]="isCurrent(item)"
                    [class.shadow-violet-500/50]="isCurrent(item)"
                    [class.border-transparent]="!isCurrent(item)"
                    [class.opacity-50]="!isCurrent(item)"
                    [class.hover:opacity-100]="!isCurrent(item)"
                  >
                    @if (item.type === 'image') {
                      <img [src]="item.url" class="w-full h-full object-cover">
                    } @else {
                      <video [src]="item.url" class="w-full h-full object-cover"></video>
                    }
                  </button>
                </swiper-slide>
              }
            </swiper-container>
          </div>
        </div>
      </div>
    </app-modal>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class MediaViewerModalComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() initialItem?: MediaItem;
  @Input() galleryItems: MediaItem[] = [];
  @Output() closed = new EventEmitter<void>();

  @ViewChild('swiper') swiperRef!: ElementRef<SwiperContainer>;

  currentItem?: MediaItem;
  
  // Zoom & Pan state
  scale = 1;
  panX = 0;
  panY = 0;
  isPanning = false;
  startX = 0;
  startY = 0;

  // UI State
  idle = false;
  idleTimer: any;
  isHoveringControls = false;
  isHoveringGallery = false;
  isGalleryReady = false;
  private isInitializing = false;
  private isNavigating = false;

  // Icons
  readonly X = X;
  readonly ExternalLink = ExternalLink;
  readonly Link = Link;
  readonly ZoomIn = ZoomIn;
  readonly ZoomOut = ZoomOut;
  readonly Download = Download;

  constructor(private ngZone: NgZone) {}

  ngOnDestroy(): void {
    clearTimeout(this.idleTimer);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.resetZoom();
      this.currentItem = this.initialItem;
      this.resetIdleTimer();
      this.isGalleryReady = false;
      
      // Initialize swiper after modal animation completes (approx 250ms) to ensure correct dimensions
      setTimeout(() => {
        this.initSwiper();
      }, 250);
    }

    // Handle gallery updates while open
    if (changes['galleryItems'] && this.isOpen && !changes['isOpen']) {
      if (this.swiperRef?.nativeElement?.swiper) {
        this.swiperRef.nativeElement.swiper.update();
      }
    }
  }

  ngAfterViewInit() {
    // Swiper init logic handled in OnChanges to respect modal open state
  }

  private initSwiper(): void {
    if (!this.swiperRef?.nativeElement) return;

    const swiperEl = this.swiperRef.nativeElement;
    const initialIndex = this.getInitialIndex();

    const params: SwiperOptions = {
      slidesPerView: 'auto',
      spaceBetween: 8,
      centeredSlides: true,
      centerInsufficientSlides: true,
      centeredSlidesBounds: true,
      grabCursor: true,
      // Disable auto-scroll on click to manage state manually
      slideToClickedSlide: false,
      initialSlide: initialIndex,
      observer: true,
      observeParents: true,
      observeSlideChildren: true,
      resizeObserver: true,
      speed: 300,
      on: {
        // Sync state on slide change (swipe or manual)
        slideChange: (s) => {
          if (this.isInitializing || !this.isOpen || this.isNavigating) return;
          
          this.ngZone.run(() => {
            const index = s.activeIndex;
            if (this.galleryItems[index] && !this.isCurrent(this.galleryItems[index])) {
              this.currentItem = this.galleryItems[index];
              this.resetZoom();
            }
          });
        }
      }
    };

    this.isInitializing = true;
    Object.assign(swiperEl, params);
    swiperEl.initialize();

    // Force immediate update and jump to prevent "flash of wrong slide"
    if (swiperEl.swiper) {
      swiperEl.swiper.update();
      // Use 0ms duration for instant jump on open, and suppress callbacks to avoid loop/overwrite
      swiperEl.swiper.slideTo(initialIndex, 0, false);
    }

    // Reveal gallery and perform final layout update
    setTimeout(() => {
      this.isGalleryReady = true;
      if (swiperEl.swiper) {
        swiperEl.swiper.update();
      }
    }, 50);

    // Reset initialization flag after a short delay to allow initial events to settle
    setTimeout(() => {
      this.isInitializing = false;
    }, 150);
  }

  getInitialIndex(): number {
    if (!this.initialItem || !this.galleryItems.length) return 0;
    const index = this.galleryItems.findIndex(i => i.url === this.initialItem?.url);
    return index >= 0 ? index : 0;
  }

  isCurrent(item: MediaItem): boolean {
    return this.currentItem?.url === item.url;
  }

  close(): void {
    this.closed.emit();
  }

  selectItem(item: MediaItem, index: number): void {
    if (this.isCurrent(item)) return;

    this.isNavigating = true;
    this.currentItem = item;
    this.resetZoom();
    
    if (this.swiperRef?.nativeElement?.swiper) {
      // Wait for Angular to update classes (width change) then update swiper
      setTimeout(() => {
        const swiper = this.swiperRef.nativeElement.swiper;
        swiper.update();
        swiper.slideTo(index);
        
        // Unlock navigation after animation completes
        setTimeout(() => {
          this.isNavigating = false;
        }, 350);
      }, 0);
    } else {
      this.isNavigating = false;
    }
  }

  // Zoom Logic
  zoomIn(): void {
    this.scale = Math.min(this.scale + 0.5, 5);
  }

  zoomOut(): void {
    this.scale = Math.max(this.scale - 0.5, 1);
    if (this.scale === 1) {
      this.panX = 0;
      this.panY = 0;
    }
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = -Math.sign(event.deltaY) * 0.1;
    const newScale = Math.max(1, Math.min(5, this.scale + delta));
    this.scale = newScale;
    if (this.scale === 1) {
      this.panX = 0;
      this.panY = 0;
    }
  }

  // Pan Logic
  startPan(event: MouseEvent): void {
    if (this.scale > 1) {
      this.isPanning = true;
      this.startX = event.clientX - this.panX;
      this.startY = event.clientY - this.panY;
    }
  }

  pan(event: MouseEvent): void {
    if (!this.isPanning) return;
    event.preventDefault();
    this.panX = event.clientX - this.startX;
    this.panY = event.clientY - this.startY;
  }

  endPan(): void {
    this.isPanning = false;
  }

  resetZoom(): void {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
  }

  // Utils
  formatTime(date?: Date): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  copyLink(): void {
    if (this.currentItem?.url) {
      // If it's relative, make it absolute
      const url = this.currentItem.url.startsWith('http') 
        ? this.currentItem.url 
        : window.location.origin + this.currentItem.url;
        
      navigator.clipboard.writeText(url);
    }
  }

  onMouseMove(): void {
    this.resetIdleTimer();
  }

  resetIdleTimer(): void {
    this.idle = false;
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.idle = true;
    }, 3000);
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }
}
