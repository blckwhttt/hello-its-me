import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-embed-player',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (embedUrl) {
    <div 
      class="w-full overflow-hidden rounded-[14px] bg-white/5 relative"
      [style.height.px]="height"
    >
      @if (isLoading) {
        <!-- Skeleton Loader -->
        <div class="absolute inset-0 flex items-center gap-4 p-4 bg-white/5 skeleton-pulse z-10">
           <!-- Fake Album Art -->
           <div class="size-[120px] shrink-0 rounded-[8px] bg-white/10"></div>
           
           <!-- Fake Content -->
           <div class="flex flex-col gap-3 w-full">
             <div class="h-5 w-3/4 rounded-md bg-white/10"></div>
             <div class="h-4 w-1/2 rounded-md bg-white/10"></div>
             <div class="mt-auto flex items-center gap-2">
               <div class="size-8 rounded-full bg-white/10"></div>
               <div class="h-2 w-full rounded-full bg-white/10"></div>
             </div>
           </div>
        </div>
      }
      <iframe
        [src]="embedUrl"
        width="100%"
        [height]="height"
        frameBorder="0"
        allowfullscreen=""
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        (load)="onLoad()"
        [class.opacity-0]="isLoading"
        [class.opacity-100]="!isLoading"
        class="transition-opacity duration-300 relative z-20"
      ></iframe>
    </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    .skeleton-pulse {
      animation: pulse-fast 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    @keyframes pulse-fast {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.6;
      }
    }
  `]
})
export class EmbedPlayerComponent implements OnChanges {
  @Input() url?: string | null;

  embedUrl: SafeResourceUrl | null = null;
  isLoading = true;
  height = 152;

  constructor(private sanitizer: DomSanitizer) {}

  static supports(url?: string | null): boolean {
    if (!url) return false;
    return (
      url.includes('spotify.com') ||
      url.includes('music.apple.com') ||
      url.includes('soundcloud.com') ||
      url.includes('figma.com') ||
      url.includes('tiktok.com')
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['url']) {
      this.updateEmbedUrl();
    }
  }

  private updateEmbedUrl(): void {
    this.isLoading = true;
    this.embedUrl = null;
    this.height = 152;

    if (!this.url) return;

    // Spotify
    if (this.url.includes('spotify.com')) {
      const match = this.url.match(/open\.spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/);
      if (match) {
        const [_, type, id] = match;
        this.embedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(`https://open.spotify.com/embed/${type}/${id}`);
      }
    } 
    // Apple Music
    else if (this.url.includes('music.apple.com')) {
        // Example: https://music.apple.com/us/album/album-name/123456
        // Embed: https://embed.music.apple.com/us/album/album-name/123456
        const embedUrl = this.url.replace('music.apple.com', 'embed.music.apple.com');
        this.embedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
    }
    // SoundCloud
    else if (this.url.includes('soundcloud.com')) {
        const encodedUrl = encodeURIComponent(this.url);
        const src = `https://w.soundcloud.com/player/?url=${encodedUrl}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`;
        this.embedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(src);
    }
    // Figma
    else if (this.url.includes('figma.com')) {
        const encodedUrl = encodeURIComponent(this.url);
        const src = `https://www.figma.com/embed?embed_host=share&url=${encodedUrl}`;
        this.embedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(src);
        this.height = 450;
    }
    // TikTok
    else if (this.url.includes('tiktok.com')) {
        const match = this.url.match(/video\/(\d+)/);
        if (match) {
            const videoId = match[1];
            const src = `https://www.tiktok.com/embed/v2/${videoId}`;
            this.embedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(src);
            this.height = 700;
        }
    }
  }

  onLoad(): void {
    this.isLoading = false;
  }
}
