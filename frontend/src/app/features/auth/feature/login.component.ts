import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { DividerModule } from 'primeng/divider';
import { AuthStore } from '../../../core/auth/auth.store';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    CardModule,
    MessageModule,
    DividerModule,
  ],
  styles: [`
    :host {
      display: block;
      width: 100%;
      max-width: 420px;
    }

    .login-card {
      background: var(--p-surface-card);
      border: 1px solid var(--p-surface-border);
      border-radius: 16px;
      padding: 2.5rem 2rem;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.35);
    }

    .login-header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .login-logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      background: var(--p-primary-color);
      border-radius: 16px;
      margin-bottom: 1.25rem;
    }

    .login-logo .pi {
      font-size: 1.5rem;
      color: #fff;
    }

    .login-title {
      font-size: 1.375rem;
      font-weight: 700;
      color: var(--p-text-color);
      margin-bottom: 0.375rem;
    }

    .login-subtitle {
      font-size: 0.875rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 1.125rem;
    }

    .field label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .field .p-inputtext,
    .field :deep(.p-inputtext) {
      width: 100%;
      background: var(--p-surface-section);
      border-color: var(--p-surface-border);
    }

    .field :deep(.p-password) {
      width: 100%;
    }

    .submit-btn {
      margin-top: 0.5rem;
    }

    .login-footer {
      text-align: center;
      margin-top: 1.5rem;
      font-size: 0.75rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
    }

    .error-message {
      margin-bottom: 1rem;
    }
  `],
  template: `
    <div class="login-card">
      <!-- Header -->
      <div class="login-header">
        <div class="login-logo">
          <i class="pi pi-heart"></i>
        </div>
        <h1 class="login-title">Welcome back</h1>
        <p class="login-subtitle">Sign in to Tempora Healthcare</p>
      </div>

      <!-- Error -->
      @if (error()) {
        <p-message
          severity="error"
          [text]="error()!"
          styleClass="error-message w-full"
          aria-live="polite"
        />
      }

      <!-- Form -->
      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="field">
          <label for="login-email">Email address</label>
          <input
            pInputText
            id="login-email"
            formControlName="email"
            type="email"
            placeholder="admin@tempora.com"
            autocomplete="email"
            [attr.aria-invalid]="emailInvalid()"
          />
        </div>

        <div class="field">
          <label for="login-password">Password</label>
          <p-password
            inputId="login-password"
            formControlName="password"
            placeholder="••••••••"
            [feedback]="false"
            [toggleMask]="true"
            autocomplete="current-password"
            styleClass="w-full"
            inputStyleClass="w-full"
          />
        </div>

        <p-button
          type="submit"
          label="Sign in"
          icon="pi pi-sign-in"
          iconPos="right"
          styleClass="w-full submit-btn"
          [loading]="loading()"
          [disabled]="form.invalid"
        />
      </form>

      <div class="login-footer">
        Tempora &copy; {{ year }} — Healthcare Workforce Management
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthStore) as unknown as AuthStore;
  private readonly router = inject(Router);

  readonly year = new Date().getFullYear();

  readonly form = new FormGroup({
    email:    new FormControl('', { validators: [Validators.required, Validators.email], nonNullable: true }),
    password: new FormControl('', { validators: [Validators.required, Validators.minLength(6)], nonNullable: true }),
  });

  readonly loading = this.auth.loading;
  readonly error   = this.auth.error;

  readonly emailInvalid = () =>
    this.form.controls.email.invalid && this.form.controls.email.touched;

  submit(): void {
    if (this.form.invalid) return;
    const { email, password } = this.form.getRawValue();
    this.auth.login({ email, password }).subscribe({
      next: () => this.router.navigate(['/dashboard']),
    });
  }
}
