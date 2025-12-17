import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { PageMetaService } from '../../../core/services/page-meta.service';
import { AuthLayoutComponent } from '../../../shared/components/auth-layout/auth-layout.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { NotificationComponent } from '../../../shared/components/notification/notification.component';
import { LucideAngularModule, Mail, User, Lock, AlertCircle } from 'lucide-angular';

import { FormInputComponent } from '../../../shared/components/form-input/form-input.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    RouterModule,
    AuthLayoutComponent,
    ButtonComponent,
    NotificationComponent,
    LucideAngularModule,
    FormInputComponent
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  registerForm: FormGroup;
  errorMessage: string = '';
  isLoading: boolean = false;
  showError = false;
  submitted = false;

  readonly Mail = Mail;
  readonly User = User;
  readonly Lock = Lock;
  readonly AlertCircle = AlertCircle;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private pageMeta: PageMetaService
  ) {
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30), Validators.pattern(/^[a-zA-Z0-9_-]+$/)]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  ngOnInit(): void {
    this.pageMeta.set({
      title: 'Регистрация',
      description: 'Создайте аккаунт Twine для звонков и комнат',
    });
  }

  onSubmit(): void {
    this.submitted = true;
    
    if (this.registerForm.invalid) {
      Object.keys(this.registerForm.controls).forEach(key => {
        this.registerForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.showError = false;

    const { email, username, password } = this.registerForm.value;

    this.authService.register({ email, username, password }).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        this.isLoading = false;
        if (error.status === 409) {
          this.errorMessage = 'Такая почта или никнейм уже зарегистрированы. Попробуйте другие.';
        } else if (error.status === 400) {
          this.errorMessage = error.error?.message || 'Проверьте правильность введённых данных.';
        } else if (error.status === 429) {
          this.errorMessage = 'Слишком много попыток регистрации. Подождите немного.';
        } else {
          this.errorMessage = error.error?.message || 'Не удалось создать аккаунт. Попробуйте позже.';
        }
        this.showError = true;
      }
    });
  }

  onErrorClosed(): void {
    this.showError = false;
  }

  get email() {
    return this.registerForm.get('email');
  }

  get username() {
    return this.registerForm.get('username');
  }

  get password() {
    return this.registerForm.get('password');
  }
}
