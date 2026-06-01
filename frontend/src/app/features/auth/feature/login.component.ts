import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label for="email">Email</label>
      <input
        id="email"
        formControlName="email"
        type="email"
        placeholder="Email"
        autocomplete="email"
      />
      <label for="password">Password</label>
      <input
        id="password"
        formControlName="password"
        type="password"
        placeholder="Password"
        autocomplete="current-password"
      />
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }
      <button type="submit" [disabled]="loading()">Login</button>
    </form>
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  readonly form = new FormGroup({
    email: new FormControl('', { validators: [Validators.required, Validators.email], nonNullable: true }),
    password: new FormControl('', { validators: [Validators.required], nonNullable: true }),
  });

  readonly loading = this.auth.loading;
  readonly error = this.auth.error;

  submit(): void {
    if (this.form.invalid) return;
    const { email, password } = this.form.getRawValue();
    this.auth.login({ email, password }).subscribe({
      next: () => this.router.navigate(['/dashboard']),
    });
  }
}
