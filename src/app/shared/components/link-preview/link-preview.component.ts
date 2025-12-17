import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LucideAngularModule, Play, ExternalLink } from 'lucide-angular';
import type { LinkPreview } from '../../../core/models/link-preview.model';
import { EmbedPlayerComponent } from '../embed-player/embed-player.component';

@Component({
  selector: 'app-link-preview',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, EmbedPlayerComponent],
  template: `
    @if (isWebsite || !showMedia) {
    <!-- Website Layout (Horizontal) OR when media is disabled -->
    <div
      class="flex items-center gap-3 rounded-[22px] bg-white/5 p-3 w-full max-w-[400px]"
    >
    @if (showMedia && (preview?.imageUrl || preview?.faviconUrl) && !imageFailed) {
      <div class="shrink-0 size-[50px] rounded-[10px] bg-white/5 overflow-hidden">
        <img
          [src]="preview!.imageUrl || preview!.faviconUrl"
          [alt]="preview!.title || ''"
          class="size-full object-cover"
          loading="lazy"
          (error)="onImageError()"
          draggable="false"
        />
      </div>
      } @else if (!showMedia && (preview?.imageUrl || preview?.faviconUrl) && !imageFailed) {
         <!-- Small thumbnail when media is disabled, but image exists (e.g. spotify track cover) -->
         <div class="shrink-0 size-[50px] rounded-[10px] bg-white/5 overflow-hidden">
          <img
            [src]="preview!.imageUrl || preview!.faviconUrl"
            [alt]="preview!.title || ''"
            class="size-full object-cover"
            loading="lazy"
            (error)="onImageError()"
            draggable="false"
          />
        </div>
      }

      <!-- Left: Content -->
      <div class="flex-1 min-w-0 flex flex-col gap-0.5">
        <!-- Site Name -->
        <div class="flex items-center gap-2 text-[11px] font-medium text-white/40 uppercase">
          @if (!showMedia && preview?.faviconUrl && !faviconFailed && !(preview?.imageUrl || preview?.faviconUrl)) {
            <img
              [src]="preview!.faviconUrl"
              alt=""
              class="size-3.5 rounded-sm opacity-80"
              loading="lazy"
              (error)="onFaviconError()"
              draggable="false"
            />
          }
          <span>{{ preview?.siteName || hostname }}</span>
        </div>

        <!-- Title -->
        <a
          [href]="preview?.url"
          target="_blank"
          rel="noopener noreferrer"
          class="text-[16px] font-semibold text-white/90 hover:text-white transition-colors line-clamp-1 wrap-break-word"
        >
          {{ preview?.title || preview?.url }}
        </a>

        <!-- Description -->
        @if (preview?.description) {
        <div class="text-[13px] font-normal leading-relaxed text-white/50 line-clamp-1 wrap-break-word">
          {{ preview!.description }}
        </div>
        }
      </div>
    </div>
    } @else {
    <!-- Video/Image/Spotify Layout (Vertical) -->
    <div
      class="flex flex-col gap-2.5 rounded-[20px] bg-white/5 p-4 w-full max-w-[520px]"
    >
      <!-- Header: Favicon + Site Name -->
      <div class="flex items-center gap-2 text-[11px] font-medium tracking-wide text-white/40 uppercase">
        @if (preview?.faviconUrl && !faviconFailed) {
        <img
          [src]="preview!.faviconUrl"
          alt=""
          class="size-3.5 rounded-sm opacity-80"
          loading="lazy"
          (error)="onFaviconError()"
          draggable="false"
        />
        }
        <span>{{ preview?.siteName || hostname }}</span>
      </div>

      <!-- Author (e.g. YouTube Channel) -->
      @if (preview?.author) {
      <div class="text-[14px] font-medium text-violet-400 mt-0.5">
        {{ preview!.author }}
      </div>
      }

      <!-- Title -->
      <a
        [href]="preview?.url"
        target="_blank"
        rel="noopener noreferrer"
        class="text-[17px] font-semibold text-white/90 hover:text-white transition-colors line-clamp-1 wrap-break-word"
      >
        {{ preview?.title || preview?.url }}
      </a>

      <!-- Description -->
      @if (preview?.description) {
      <div class="text-[12px] font-normal leading-relaxed text-white/40 line-clamp-1 wrap-break-word">
        {{ preview!.description }}
      </div>
      }

      <!-- Embed Player (Spotify etc) -->
      @if (isEmbeddable) {
        <app-embed-player [url]="preview?.url"></app-embed-player>
      }

      <!-- Media Area (Video Player or Image) -->
      @if (!isEmbeddable && showMedia && preview?.imageUrl && !imageFailed) {
      <div class="relative aspect-video w-full overflow-hidden rounded-[14px] bg-black/20 group/video">
        @if (isPlaying && videoUrl) {
        <iframe
          [src]="videoUrl"
          class="size-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
          frameborder="0"
        ></iframe>
        } @else {
        <img
          [src]="preview!.imageUrl"
          [alt]="preview!.title || ''"
          class="size-full object-cover transition duration-500 hover:scale-105"
          [class.cursor-pointer]="!isVideo"
          (click)="!isVideo && onMediaClick($event)"
          loading="lazy"
          (error)="onImageError()"
          draggable="false"
        />

        <!-- Play Button Overlay for Video -->
        @if (isVideo) {
        <button
          (click)="playVideo()"
          class="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 hover:bg-black/20 cursor-pointer"
        >
          <div
            class="flex text-white size-13 items-center justify-center rounded-full bg-black/60 backdrop-blur-md duration-300 pointer-events-none opacity-0 group-hover/video:opacity-100 group-hover/video:pointer-events-auto group-active/video:transform-[scale(0.9)] will-change-transform transition-all"
          >
            <lucide-icon [img]="Play" class="fill-current flex items-center justify-center relative" [size]="21" [strokeWidth]="0"></lucide-icon>
          </div>
        </button>
        }
        }
      </div>
      }
    </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class LinkPreviewComponent {
  readonly Play = Play;
  readonly ExternalLink = ExternalLink;

  private _preview?: LinkPreview | null;
  imageFailed = false;
  faviconFailed = false;

  isPlaying = false;
  videoUrl: SafeResourceUrl | null = null;

  constructor(private sanitizer: DomSanitizer) {}

  @Input()
  set preview(value: LinkPreview | null | undefined) {
    this._preview = value;
    this.imageFailed = false;
    this.faviconFailed = false;
    this.isPlaying = false;
    this.videoUrl = null;
  }

  @Input() showMedia = true;
  @Output() mediaClick = new EventEmitter<void>();

  get preview(): LinkPreview | null | undefined {
    return this._preview;
  }

  get hostname(): string {
    const url = this._preview?.url;
    if (!url) return '';
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  get isVideo(): boolean {
    return this._preview?.type === 'video';
  }

  get isEmbeddable(): boolean {
    return EmbedPlayerComponent.supports(this.preview?.url);
  }

  get isWebsite(): boolean {
    if (!this.showMedia) {
      return true;
    }
    return !this.isEmbeddable && (this.preview?.type === 'website' || this.preview?.type === 'unknown');
  }

  onImageError(): void {
    this.imageFailed = true;
  }

  onFaviconError(): void {
    this.faviconFailed = true;
  }

  onMediaClick(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.mediaClick.emit();
  }

  playVideo(): void {
    if (!this.preview?.url || !this.isVideo) return;

    const url = this.preview.url;
    let embedSrc = '';

    // Handle YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = this.extractYoutubeId(url);
      if (videoId) {
        const origin = typeof window !== 'undefined' && window.location.protocol === 'file:' 
          ? 'http://localhost' 
          : (typeof window !== 'undefined' ? window.location.origin : '');
          
        embedSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&origin=${origin}`;
      }
    }

    if (embedSrc) {
      this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedSrc);
      this.isPlaying = true;
    } else {
      // Fallback: open in new tab if we can't embed
      window.open(url, '_blank');
    }
  }

  private extractYoutubeId(url: string): string | null {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  }
}
