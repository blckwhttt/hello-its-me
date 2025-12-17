import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

@Component({
  selector: 'app-form-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="flex flex-col items-start justify-start gap-[19px] w-full">
      <label [for]="inputId" class="text-[19px] text-white/40 font-medium transition-colors hover:text-white/60 cursor-pointer">
        {{ label }}
      </label>
      <div class="w-full relative">
        <input
          [type]="type"
          [id]="inputId"
          [placeholder]="placeholder"
          [formControl]="control"
          (blur)="onBlur()"
          (focus)="onFocus()"
          [class.border-red-500/40]="shouldShowError"
          class="w-full select-none rounded-[22px] bg-white/2 px-[19px] h-[68px] placeholder:text-white/18 text-[28px] font-semibold focus-within:bg-white/5 hover:bg-white/[0.03] transition-colors border-2 border-transparent focus-within:border-violet-500/30 outline-none"
        />
        
        @if (shouldShowError) {
          <p class="mt-2 ml-4 text-sm text-red-400/90 animate-fade-in">
            {{ getErrorMessage() }}
          </p>
        }
      </div>
    </div>
  `,
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in {
      animation: fadeIn 0.2s ease-out forwards;
    }
  `]
})
export class FormInputComponent {
  @Input() control!: FormControl;
  @Input() label = '';
  @Input() type = 'text';
  @Input() placeholder = '';
  @Input() inputId = '';
  @Input() name: 'email' | 'username' | 'password' | 'text' = 'text';
  @Input() submitted = false;

  private hasBeenBlurredAfterChange = false;

  onFocus() {
    // Сбрасываем флаг при фокусе, если нужно скрывать ошибку во время исправления
    // Но обычно лучше оставлять, если она уже была.
    // В данном случае мы просто не меняем hasBeenBlurredAfterChange
  }

  onBlur() {
    // Если поле было изменено (dirty) и мы ушли с него -> фиксируем это состояние
    if (this.control.dirty) {
      this.hasBeenBlurredAfterChange = true;
    }
  }

  get shouldShowError(): boolean {
    if (!this.control || !this.control.errors) return false;

    // 1. Если форма отправлена - показываем всегда
    if (this.submitted) return true;

    // 2. Показываем ошибку ТОЛЬКО если пользователь изменил поле И ушел с него
    return this.hasBeenBlurredAfterChange;
  }

  getErrorMessage(): string {
    const errors = this.control.errors;
    if (!errors) return '';

    if (errors['required']) {
      const labels: Record<string, string> = {
        email: 'Укажите Вашу почту',
        username: 'Придумайте никнейм',
        password: 'Придумайте пароль'
      };
      return labels[this.name] || 'Заполните это поле';
    }
    
    if (errors['email']) {
      return 'Неверный формат почты';
    }
    
    if (errors['minlength']) {
      if (this.name === 'username') return 'Никнейм должен содержать минимум 3 символа';
      return 'Пароль должен содержать минимум 8 символов';
    }
    
    if (errors['maxlength']) {
      return 'Никнейм слишком длинный (максимум 30 символов)';
    }
    
    if (errors['pattern']) {
      return 'Используйте только буквы, цифры, дефис и подчёркивание';
    }

    return 'Ошибка заполнения';
  }
}
