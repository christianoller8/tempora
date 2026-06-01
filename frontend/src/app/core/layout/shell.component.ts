import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthStore } from '../auth/auth.store';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav>
      <a routerLink="/dashboard">Dashboard</a>
      @if (isAdmin()) {
        <a routerLink="/employees">Employees</a>
      }
      <a routerLink="/shifts">Shifts</a>
      <a routerLink="/time-tracking">Time Tracking</a>
      <a routerLink="/absences">Absences</a>
      @if (isAdminOrManager()) {
        <a routerLink="/reports">Reports</a>
      }
      @if (isAdmin()) {
        <a routerLink="/admin">Admin</a>
      }
      <button type="button" (click)="logout()">Logout</button>
    </nav>
    <main>
      <router-outlet />
    </main>
  `,
})
export class ShellComponent {
  private readonly auth = inject(AuthStore);

  readonly isAdmin = computed(() => this.auth.role() === 'ADMIN');
  readonly isAdminOrManager = computed(() =>
    ['ADMIN', 'MANAGER'].includes(this.auth.role() ?? ''),
  );

  logout(): void {
    this.auth.logout().subscribe();
  }
}
