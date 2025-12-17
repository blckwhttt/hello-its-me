import {
  Component,
  Input,
  Output,
  EventEmitter,
  HostListener,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X } from 'lucide-angular';

/**
 * Тип позиционирования модального окна
 */
export type ModalPosition = 'center' | 'top' | 'bottom';

/**
 * Размер модального окна
 */
export type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';

/**
 * Варианты padding
 */
export type ModalPadding = 'none' | 'sm' | 'md' | 'lg';

/**
 * Варианты стиля модального окна
 */
export type ModalVariant = 'default' | 'glass' | 'solid' | 'transparent';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    @if (isRendered) {
    <div
      class="fixed inset-0 z-50 flex p-4"
      [ngClass]="positionClass"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="heading ? modalTitleId : null"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 transition-opacity duration-200 ease-out"
        [ngClass]="backdropClass"
        [class.opacity-0]="!isVisible"
        (click)="onBackdropClick()"
      ></div>

      <!-- Modal -->
      <div
        class="relative w-full transition-all duration-200 ease-out transform"
        [ngClass]="[customWidth ? '' : sizeClass, customLayout ? '' : 'shadow-2xl', customLayout ? '' : variantClass, customClass]"
        [class.opacity-0]="!isVisible"
        [class.scale-95]="!isVisible"
        [style.max-width]="customWidth"
        [style.max-height]="customHeight || maxHeight"
        [style.height]="customHeight"
      >
        <!-- Hidden title for screen readers -->
        @if (heading) {
        <h2 [id]="modalTitleId" class="sr-only">{{ heading }}</h2>
        }

        <!-- Custom Layout Mode -->
        @if (customLayout) { 
        <ng-content select="[slot=custom]"></ng-content>
        } @else {
        <!-- Standard Layout -->

        <!-- Custom Header Slot -->
        @if (hasCustomHeader) {
        <ng-content select="[slot=header]"></ng-content>
        } @else if (heading || showClose) {
        <!-- Default Header -->
        <div
          class="flex items-center justify-between border-b border-white/5"
          [ngClass]="headerPaddingClass"
        >
          @if (heading) {
          <h3 class="text-lg font-semibold text-white">{{ heading }}</h3>
          }
          @if (showClose) {
          <button
            type="button"
            (click)="close()"
            class="text-white/40 hover:text-white transition-colors p-1 hover:bg-white/5 rounded-[10px]"
            [class.ml-auto]="!heading"
            aria-label="Закрыть модальное окно"
          >
            <lucide-icon [img]="X" [size]="20"></lucide-icon>
          </button>
          }
        </div>
        }

        <!-- Body -->
        <div [ngClass]="bodyPaddingClass" [class.overflow-y-auto]="scrollable">
          <ng-content></ng-content>
        </div>

        <!-- Custom Footer Slot -->
        @if (hasCustomFooter) {
        <ng-content select="[slot=footer-custom]"></ng-content>
        } @else {
        <!-- Default Footer -->
        <div
          #footerContent
          class="border-t border-white/5"
          [ngClass]="footerPaddingClass"
          [class.hidden]="!hasFooterContent"
        >
          <div class="flex items-center justify-end gap-3">
            <ng-content select="[slot=footer]"></ng-content>
          </div>
        </div>
        }

        }
      </div>
    </div>
    }
  `,
  styles: [
    `
      :host ::ng-deep [slot="footer"],
      :host ::ng-deep [slot="footer-custom"],
      :host ::ng-deep [slot="header"],
      :host ::ng-deep [slot="custom"] {
        display: contents;
      }
    `,
  ],
})
export class ModalComponent implements OnChanges, AfterViewInit {
  /**
   * Управляет видимостью модального окна
   */
  @Input() isOpen = false;

  /**
   * Заголовок модального окна
   */
  @Input() heading = '';

  /**
   * Показывать ли кнопку закрытия в заголовке
   */
  @Input() showClose = true;

  /**
   * Закрывать ли модальное окно при клике на backdrop
   */
  @Input() closeOnBackdrop = true;

  /**
   * Размер модального окна
   */
  @Input() size: ModalSize = 'xl';

  /**
   * Кастомная ширина модального окна (например: '800px', '90%', '50vw')
   * Если указано, то параметр size игнорируется
   */
  @Input() customWidth = '';

  /**
   * Кастомная высота модального окна (например: '600px', '80vh', '90%')
   */
  @Input() customHeight = '';

  /**
   * Позиционирование модального окна
   */
  @Input() position: ModalPosition = 'center';

  /**
   * Вариант стиля модального окна
   */
  @Input() variant: ModalVariant = 'default';

  /**
   * Padding для body, header и footer
   */
  @Input() padding: ModalPadding = 'md';

  /**
   * Кастомные CSS классы для модального окна
   */
  @Input() customClass = '';

  /**
   * Кастомные CSS классы для backdrop
   */
  @Input() backdropClass = 'bg-black/55';

  /**
   * Максимальная высота модального окна (deprecated, используйте customHeight)
   */
  @Input() maxHeight = '';

  /**
   * Включить прокрутку для body
   */
  @Input() scrollable = false;

  /**
   * Использовать кастомный header (через slot=header)
   */
  @Input() hasCustomHeader = false;

  /**
   * Использовать кастомный footer (через slot=footer-custom)
   */
  @Input() hasCustomFooter = false;

  /**
   * Использовать полностью кастомную разметку (отключает header/body/footer)
   */
  @Input() customLayout = false;

  /**
   * Событие закрытия модального окна
   */
  @Output() closed = new EventEmitter<void>();

  /**
   * ViewChild для проверки наличия контента в футере
   */
  @ViewChild('footerContent') footerContent?: ElementRef<HTMLDivElement>;

  readonly X = X;

  isRendered = false;
  isVisible = false;
  hasFooterContent = false;

  /**
   * Уникальный ID для aria-labelledby
   */
  readonly modalTitleId = `modal-title-${Math.random().toString(36).substring(2, 11)}`;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.checkFooterContent();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      if (this.isOpen) {
        this.openModal();
      } else {
        this.closeModal();
      }
    }
  }

  /**
   * Обработчик нажатия клавиши Escape
   */
  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    if (this.isOpen) {
      this.close();
    }
  }

  /**
   * Проверка наличия контента в футере
   */
  private checkFooterContent(): void {
    setTimeout(() => {
      if (this.footerContent) {
        const element = this.footerContent.nativeElement;
        this.hasFooterContent = element.children.length > 0;
        this.cdr.detectChanges();
      }
    }, 0);
  }

  /**
   * Открытие модального окна с анимацией
   */
  private openModal(): void {
    this.isRendered = true;
    setTimeout(() => {
      this.isVisible = true;
      this.checkFooterContent();
    }, 10);
  }

  /**
   * Закрытие модального окна с анимацией
   */
  private closeModal(): void {
    this.isVisible = false;
    setTimeout(() => {
      this.isRendered = false;
    }, 250);
  }

  /**
   * Закрытие модального окна
   */
  close(): void {
    this.closed.emit();
  }

  /**
   * Обработчик клика по backdrop
   */
  onBackdropClick(): void {
    if (this.closeOnBackdrop) {
      this.close();
    }
  }

  /**
   * Получение класса размера
   */
  get sizeClass(): string {
    if (this.size === 'full') {
      return 'w-full h-full max-w-full rounded-none';
    }

    const sizeMap: Record<Exclude<ModalSize, 'full'>, string> = {
      xs: 'max-w-xs',
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl',
      '2xl': 'max-w-2xl',
      '3xl': 'max-w-3xl',
      '4xl': 'max-w-4xl',
      '5xl': 'max-w-5xl',
      '6xl': 'max-w-6xl',
      '7xl': 'max-w-7xl',
    };

    return sizeMap[this.size];
  }

  /**
   * Получение класса позиционирования
   */
  get positionClass(): string {
    const positionMap: Record<ModalPosition, string> = {
      center: 'items-center justify-center',
      top: 'items-start justify-center pt-20',
      bottom: 'items-end justify-center pb-20',
    };
    return positionMap[this.position];
  }

  /**
   * Получение класса варианта стиля
   */
  get variantClass(): string {
    const variantMap: Record<ModalVariant, string> = {
      default: 'bg-black/40 backdrop-blur-xl border border-white/5 rounded-[14px]',
      glass: 'bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[14px]',
      solid: 'bg-gray-900 border border-white/10 rounded-[14px]',
      transparent: 'bg-transparent border-0 rounded-[14px]',
    };
    return variantMap[this.variant];
  }

  /**
   * Получение класса padding для header
   */
  get headerPaddingClass(): string {
    return this.getPaddingClass();
  }

  /**
   * Получение класса padding для body
   */
  get bodyPaddingClass(): string {
    return this.getPaddingClass();
  }

  /**
   * Получение класса padding для footer
   */
  get footerPaddingClass(): string {
    return this.getPaddingClass();
  }

  /**
   * Получение класса padding
   */
  private getPaddingClass(): string {
    const paddingMap: Record<ModalPadding, string> = {
      none: '',
      sm: 'px-4 py-3',
      md: 'px-6 py-4',
      lg: 'px-8 py-6',
    };
    return paddingMap[this.padding];
  }
}
