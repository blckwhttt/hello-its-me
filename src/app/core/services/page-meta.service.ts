import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';

export interface PageMeta {
  title?: string;
  description?: string;
  /**
   * Set to false to avoid appending the brand suffix.
   */
  appendBrand?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PageMetaService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  private readonly brand = 'Twine';
  private readonly defaultTitle = `${this.brand} — общение и комнаты`;
  private readonly defaultDescription =
    'Общайтесь свободно, весело и безопасно';

  set(meta: PageMeta): void {
    const pageTitle = meta.title?.trim();
    const finalTitle =
      meta.appendBrand === false || !pageTitle ? pageTitle || this.defaultTitle : `${pageTitle} — ${this.brand}`;

    this.title.setTitle(finalTitle);

    const description = (meta.description || this.defaultDescription).trim();
    this.meta.updateTag({ name: 'description', content: description });
  }

  reset(): void {
    this.set({});
  }
}

@Injectable({ providedIn: 'root' })
export class PageTitleStrategy extends TitleStrategy {
  constructor(private readonly pageMeta: PageMetaService) {
    super();
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const title = this.buildTitle(snapshot) || undefined;
    const description = this.findDescription(snapshot.root);

    this.pageMeta.set({
      title,
      description: description || undefined,
    });
  }

  private findDescription(route: ActivatedRouteSnapshot | null): string | null {
    if (!route) {
      return null;
    }

    for (const child of route.children) {
      const childDescription = this.findDescription(child);
      if (childDescription) {
        return childDescription;
      }
    }

    const routeDescription = route.data?.['description'];
    return typeof routeDescription === 'string' ? routeDescription : null;
  }
}
