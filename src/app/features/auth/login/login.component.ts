import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { PageMetaService } from '../../../core/services/page-meta.service';
import { AuthLayoutComponent } from '../../../shared/components/auth-layout/auth-layout.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { NotificationComponent } from '../../../shared/components/notification/notification.component';
import { LucideAngularModule, Mail, Lock, AlertCircle } from 'lucide-angular';

import { FormInputComponent } from '../../../shared/components/form-input/form-input.component';

@Component({
  selector: 'app-login',
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
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  errorMessage: string = '';
  isLoading: boolean = false;
  showError = false;
  submitted = false;

  readonly Mail = Mail;
  readonly Lock = Lock;
  readonly AlertCircle = AlertCircle;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private pageMeta: PageMetaService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  ngOnInit(): void {
    this.pageMeta.set({
      title: 'Вход',
      description: 'Войдите в Twine чтобы продолжить звонки и чаты',
    });
  }

  onSubmit(): void {
    this.submitted = true;
    
    if (this.loginForm.invalid) {
      Object.keys(this.loginForm.controls).forEach(key => {
        this.loginForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.showError = false;

    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        this.isLoading = false;
        if (error.status === 401) {
          this.errorMessage = 'Неверная почта или пароль. Проверьте данные и попробуйте снова.';
        } else if (error.status === 429) {
          this.errorMessage = 'Слишком много попыток входа. Подождите немного и попробуйте снова.';
        } else {
          this.errorMessage = error.error?.message || 'Не удалось войти. Попробуйте позже.';
        }
        this.showError = true;
      }
    });
  }

  onErrorClosed(): void {
    this.showError = false;
  }

  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }
}

