export type LinkPreviewType = 'website' | 'video' | 'image' | 'unknown';

export interface LinkPreview {
  /** Final (resolved) URL after redirects */
  url: string;

  /** Normalized URL that was requested */
  requestedUrl: string;

  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  faviconUrl: string | null;
  author: string | null;
  type: LinkPreviewType;
}
