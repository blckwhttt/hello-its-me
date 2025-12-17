import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LinkifyService {
  // Robust regex for URL detection (http/https/www)
  // Handles:
  // - http://, https://, www. prefixes
  // - Query parameters with special chars including Unicode (Russian, etc)
  // - Stops at common punctuation if at the end unless part of URL
  private readonly urlRegex = /((?:https?:\/\/|www\.)[^\s]+)/gi;

  constructor() {}

  /**
   * Finds URLs in text and returns an array of tokens (text or url)
   */
  findLinks(text: string): { type: 'text' | 'url'; value: string; href?: string }[] {
    if (!text) return [{ type: 'text', value: '' }];

    const tokens: { type: 'text' | 'url'; value: string; href?: string }[] = [];
    let lastIndex = 0;
    let match;

    // Reset regex state
    this.urlRegex.lastIndex = 0;

    while ((match = this.urlRegex.exec(text)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        tokens.push({
          type: 'text',
          value: text.substring(lastIndex, match.index),
        });
      }

      const url = match[0];
      let href = url;
      
      // Add protocol if missing for www links
      if (url.toLowerCase().startsWith('www.')) {
        href = 'https://' + url;
      }

      tokens.push({
        type: 'url',
        value: url,
        href,
      });

      lastIndex = this.urlRegex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      tokens.push({
        type: 'text',
        value: text.substring(lastIndex),
      });
    }

    return tokens;
  }

  /**
   * Returns HTML string with anchor tags
   */
  linkify(text: string, className: string = 'text-blue-400 hover:underline'): string {
    const tokens = this.findLinks(text);
    return tokens
      .map((token) => {
        if (token.type === 'url') {
          return `<a href="${token.href}" target="_blank" rel="noopener noreferrer" class="${className}" onclick="event.stopPropagation()">${token.value}</a>`;
        }
        return this.escapeHtml(token.value);
      })
      .join('');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

