import { Directive, Input, ElementRef, HostListener, Renderer2, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';

@Directive({
  selector: '[appTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnDestroy, OnChanges {
  @Input() appTooltip = '';
  @Input() tooltipPosition: 'top' | 'bottom' | 'left' | 'right' = 'top';

  private tooltipElement: HTMLElement | null = null;
  private tooltipTextSpan: HTMLElement | null = null;
  private showTimeout: any;

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  ngOnChanges(changes: SimpleChanges): void {
    // Если текст тултипа изменился и тултип уже отображается
    if (changes['appTooltip'] && this.tooltipElement) {
      this.updateTooltipText(changes['appTooltip'].currentValue);
    }
  }

  @HostListener('mouseenter')
  onMouseEnter(): void {
    if (!this.appTooltip) return;

    this.showTimeout = setTimeout(() => {
      this.show();
    }, 300);
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    clearTimeout(this.showTimeout);
    this.hide();
  }

  private show(): void {
    if (this.tooltipElement) return;

    this.tooltipElement = this.renderer.createElement('div');
    
    // Создаем span для текста
    this.tooltipTextSpan = this.renderer.createElement('span');
    this.renderer.setProperty(this.tooltipTextSpan, 'innerHTML', this.appTooltip);
    this.renderer.appendChild(this.tooltipElement, this.tooltipTextSpan);

    // Стили
    this.renderer.setStyle(this.tooltipElement, 'position', 'absolute');
    this.renderer.setStyle(this.tooltipElement, 'z-index', '9999');
    this.renderer.setStyle(this.tooltipElement, 'padding', '7px 11px');
    this.renderer.setStyle(this.tooltipElement, 'background', 'rgba(24, 24, 27, 0.8)');
    this.renderer.setStyle(this.tooltipElement, 'color', '#e2e8f0');
    this.renderer.setStyle(this.tooltipElement, 'font-size', '13px');
    this.renderer.setStyle(this.tooltipElement, 'font-weight', '400');
    this.renderer.setStyle(this.tooltipElement, 'letter-spacing', '0.01em');
    this.renderer.setStyle(this.tooltipElement, 'border-radius', '100px');
    this.renderer.setStyle(this.tooltipElement, 'backdrop-filter', 'blur(4px)');
    this.renderer.setStyle(
      this.tooltipElement,
      'box-shadow',
      '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
    );
    this.renderer.setStyle(this.tooltipElement, 'white-space', 'nowrap');
    this.renderer.setStyle(this.tooltipElement, 'pointer-events', 'none');
    
    // Анимация (начальное состояние)
    this.renderer.setStyle(this.tooltipElement, 'opacity', '0');
    this.renderer.setStyle(this.tooltipElement, 'transform', 'scale(0.95)');
    this.renderer.setStyle(this.tooltipElement, 'transition', 'opacity 0.1s ease-out, transform 0.1s ease-out');

    this.renderer.appendChild(document.body, this.tooltipElement);

    this.position();

    // Запуск анимации появления
    requestAnimationFrame(() => {
      if (this.tooltipElement) {
        this.renderer.setStyle(this.tooltipElement, 'opacity', '1');
        this.renderer.setStyle(this.tooltipElement, 'transform', 'scale(1)');
      }
    });
  }

  private updateTooltipText(newText: string): void {
    if (!this.tooltipTextSpan || !this.tooltipElement) return;

    // Обновляем innerHTML только span'а
    this.renderer.setProperty(this.tooltipTextSpan, 'innerHTML', newText);

    // Проверяем, не выходит ли обновленный тултип за границы экрана
    requestAnimationFrame(() => {
      if (!this.tooltipElement) return;

      const tooltipRect = this.tooltipElement.getBoundingClientRect();
      const edgeOffset = 8;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let needsRepositioning = false;
      let currentLeft = parseFloat(this.tooltipElement.style.left);
      let currentTop = parseFloat(this.tooltipElement.style.top);

      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollPos = window.pageYOffset || document.documentElement.scrollTop;

      // Проверяем горизонтальные границы
      const rightEdge = tooltipRect.right;
      const leftEdge = tooltipRect.left;

      if (rightEdge > viewportWidth - edgeOffset) {
        currentLeft = scrollLeft + viewportWidth - tooltipRect.width - edgeOffset;
        needsRepositioning = true;
      } else if (leftEdge < edgeOffset) {
        currentLeft = scrollLeft + edgeOffset;
        needsRepositioning = true;
      }

      // Проверяем вертикальные границы
      const bottomEdge = tooltipRect.bottom;
      const topEdge = tooltipRect.top;

      if (bottomEdge > viewportHeight - edgeOffset) {
        currentTop = scrollPos + viewportHeight - tooltipRect.height - edgeOffset;
        needsRepositioning = true;
      } else if (topEdge < edgeOffset) {
        currentTop = scrollPos + edgeOffset;
        needsRepositioning = true;
      }

      // Применяем новую позицию только если нужно
      if (needsRepositioning) {
        this.renderer.setStyle(this.tooltipElement, 'left', `${currentLeft}px`);
        this.renderer.setStyle(this.tooltipElement, 'top', `${currentTop}px`);
      }
    });
  }

  private position(): void {
    if (!this.tooltipElement) return;

    const hostPos = this.el.nativeElement.getBoundingClientRect();
    const tooltipPos = this.tooltipElement.getBoundingClientRect();

    const scrollPos = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    const edgeOffset = 8; // Отступ от края экрана
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;

    switch (this.tooltipPosition) {
      case 'top':
        top = hostPos.top + scrollPos - tooltipPos.height - 8;
        left = hostPos.left + scrollLeft + (hostPos.width - tooltipPos.width) / 2;
        break;
      case 'bottom':
        top = hostPos.bottom + scrollPos + 8;
        left = hostPos.left + scrollLeft + (hostPos.width - tooltipPos.width) / 2;
        break;
      case 'left':
        top = hostPos.top + scrollPos + (hostPos.height - tooltipPos.height) / 2;
        left = hostPos.left + scrollLeft - tooltipPos.width - 8;
        break;
      case 'right':
        top = hostPos.top + scrollPos + (hostPos.height - tooltipPos.height) / 2;
        left = hostPos.right + scrollLeft + 8;
        break;
    }

    // Проверка и коррекция горизонтальных границ
    const rightEdge = left + tooltipPos.width - scrollLeft;
    const leftEdge = left - scrollLeft;

    if (rightEdge > viewportWidth - edgeOffset) {
      // Тултип выходит за правую границу
      left = scrollLeft + viewportWidth - tooltipPos.width - edgeOffset;
    } else if (leftEdge < edgeOffset) {
      // Тултип выходит за левую границу
      left = scrollLeft + edgeOffset;
    }

    // Проверка и коррекция вертикальных границ
    const bottomEdge = top + tooltipPos.height - scrollPos;
    const topEdge = top - scrollPos;

    if (bottomEdge > viewportHeight - edgeOffset) {
      // Тултип выходит за нижнюю границу
      top = scrollPos + viewportHeight - tooltipPos.height - edgeOffset;
    } else if (topEdge < edgeOffset) {
      // Тултип выходит за верхнюю границу
      top = scrollPos + edgeOffset;
    }

    this.renderer.setStyle(this.tooltipElement, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);
  }

  private hide(): void {
    if (this.tooltipElement) {
      const el = this.tooltipElement;
      this.tooltipElement = null; // Сбрасываем ссылку сразу
      this.tooltipTextSpan = null; // Сбрасываем ссылку на span

      // Анимация исчезновения
      this.renderer.setStyle(el, 'opacity', '0');
      this.renderer.setStyle(el, 'transform', 'scale(0.95)');

      // Удаляем элемент после завершения анимации
      setTimeout(() => {
        if (el.parentNode) {
          this.renderer.removeChild(document.body, el);
        }
      }, 200); // Чуть больше времени анимации для надежности
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.showTimeout);
    // При уничтожении компонента удаляем тултип сразу без анимации, 
    // чтобы не оставлять "висящих" элементов
    if (this.tooltipElement) {
      if (this.tooltipElement.parentNode) {
        this.renderer.removeChild(document.body, this.tooltipElement);
      }
      this.tooltipElement = null;
      this.tooltipTextSpan = null;
    }
  }
}
