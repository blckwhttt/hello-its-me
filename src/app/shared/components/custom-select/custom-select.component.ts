import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  HostListener,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, ChevronDown, Check } from 'lucide-angular';

export interface SelectOption {
  value: string;
  label: string;
  icon?: any; // Allow passing Lucide icon component
}

@Component({
  selector: 'app-custom-select',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="relative" (clickOutside)="close()">
      <!-- Trigger -->
      <button
        type="button"
        #trigger
        (click)="toggle()"
        class="w-full flex items-center justify-between bg-white/7 rounded-full py-3 pl-3 pr-3 text-sm text-white transition-all hover:bg-white/10"
      >
        <div class="flex items-center gap-2 overflow-hidden">
          @if (selectedIcon) {
            <div class="text-white/50 shrink-0 flex items-center justify-center size-5">
              <lucide-icon [img]="selectedIcon" [size]="18"></lucide-icon>
            </div>
          }
          <span class="truncate">{{ selectedLabel }}</span>
        </div>
        <div class="shrink-0 ml-2 flex items-center justify-center text-white/40 transition-transform duration-200 origin-center" [class.rotate-180]="isOpen">
            <lucide-icon [img]="ChevronDown" [size]="16"></lucide-icon>
        </div>
      </button>

      <!-- Dropdown Menu -->
      @if (isRendered) {
      <div
        class="absolute z-50 w-full mt-2 bg-(--bg-dark) border border-white/5 rounded-[18px] shadow-xl overflow-hidden origin-top transition-all"
        [class.opacity-0]="!isVisible"
        [class.-translate-y-[10px]]="!isVisible"
        [class.opacity-100]="isVisible"
        [class.translate-y-0]="isVisible"
      >
        <div class="max-h-60 overflow-y-auto py-1 custom-scrollbar">
          @for (option of options; track option.value) {
          <button
            type="button"
            (click)="select(option)"
            class="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-white/5 transition-colors group"
            [class.bg-violet-500/10]="option.value === value"
            [class.text-violet-400]="option.value === value"
            [class.text-white/95]="option.value !== value"
          >
            <span class="truncate flex-1">{{ option.label }}</span>
            @if (option.value === value) {
            <lucide-icon [img]="Check" [size]="16" class="text-violet-400 ml-2 shrink-0"></lucide-icon>
            }
          </button>
          }
        </div>
      </div>
      }
    </div>
  `,
  styles: [
    `
      .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background-color: rgba(255, 255, 255, 0.2);
      }
    `,
  ],
})
export class CustomSelectComponent {
  @Input() options: SelectOption[] = [];
  @Input() value: string = '';
  @Input() placeholder: string = 'Select an option';
  @Output() valueChange = new EventEmitter<string>();

  @Input() icon: any = null; // Default icon for the trigger

  @ViewChild('trigger') triggerRef!: ElementRef;

  readonly ChevronDown = ChevronDown;
  readonly Check = Check;

  isOpen = false;
  isRendered = false;
  isVisible = false;

  get selectedLabel(): string {
    const selected = this.options.find((opt) => opt.value === this.value);
    return selected ? selected.label : this.placeholder;
  }
  
  get selectedIcon(): any {
      const selected = this.options.find((opt) => opt.value === this.value);
      return selected?.icon || this.icon;
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    this.isOpen = true;
    this.isRendered = true;
    // Небольшая задержка для того, чтобы браузер успел отрисовать элемент перед применением transition классов
    setTimeout(() => {
      this.isVisible = true;
    }, 10);
  }

  close(): void {
    this.isOpen = false;
    this.isVisible = false;
    // Ждем окончания анимации перед удалением из DOM
    setTimeout(() => {
      this.isRendered = false;
    }, 200);
  }

  select(option: SelectOption): void {
    this.value = option.value;
    this.valueChange.emit(this.value);
    this.close();
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    if (this.triggerRef && !this.triggerRef.nativeElement.contains(event.target)) {
        if (this.isOpen) {
            this.close();
        }
    }
  }
}


