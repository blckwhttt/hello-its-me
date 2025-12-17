import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Loader2 } from 'lucide-angular';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <button
      [type]="type"
      [disabled]="disabled || loading"
      [class]="getButtonClasses()"
      (click)="handleClick($event)"
    >
      @if (loading) {
        <lucide-icon [name]="Loader2" class="animate-spin w-5 h-5"></lucide-icon>
      }
      <ng-content></ng-content>
    </button>
  `,
  styles: []
})
export class ButtonComponent {
  readonly Loader2 = Loader2;

  @Input() type: 'button' | 'submit' = 'button';
  @Input() variant: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' = 'primary';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() fullWidth = false;
  
  @Output() clicked = new EventEmitter<Event>();

  handleClick(event: Event): void {
    if (!this.disabled && !this.loading) {
      this.clicked.emit(event);
    }
  }

  getButtonClasses(): string {
    const baseClasses = 'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed';
    
    const sizeClasses = {
      sm: 'px-3.5 py-1.75 text-sm rounded-full',
      md: 'px-4 py-2 text-sm rounded-[10px]',
      lg: 'px-6 py-3 text-base rounded-[12px]'
    };
    
    const variantClasses = {
      primary: 'bg-linear-to-r from-violet-600 to-violet-500 text-white hover:from-violet-700 hover:to-violet-600 hover:opacity-90 shadow-lg shadow-violet-500/20',
      secondary: 'bg-white/5 text-white/90 hover:bg-white/10 border border-white/5',
      danger: 'bg-linear-to-r from-red-600/80 to-red-500/80 text-white hover:from-red-700/80 hover:to-red-600/80 hover:opacity-90 shadow-lg shadow-red-500/20',
      success: 'bg-linear-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-700 hover:to-emerald-600 hover:opacity-90 shadow-lg shadow-emerald-500/20',
      ghost: 'text-white/70 hover:bg-white/5 hover:text-white'
    };
    
    const widthClass = this.fullWidth ? 'w-full' : '';
    
    return `${baseClasses} ${sizeClasses[this.size]} ${variantClasses[this.variant]} ${widthClass}`;
  }
}

