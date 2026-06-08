import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () =>
      import('./core/layout/public-shell.component').then(
        (m) => m.PublicShellComponent,
      ),
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/feature/login.component').then(
            (m) => m.LoginComponent,
          ),
      },
      { path: '', pathMatch: 'full', redirectTo: 'login' },
    ],
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./core/layout/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/feature/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'employees',
        canActivate: [roleGuard(['ADMIN'])],
        loadComponent: () =>
          import('./features/employees/feature/employees.component').then(
            (m) => m.EmployeesComponent,
          ),
      },
      {
        path: 'shifts',
        loadComponent: () =>
          import('./features/shifts/feature/cuadrante.component').then(
            (m) => m.CuadranteComponent,
          ),
      },
      {
        path: 'time-tracking',
        loadComponent: () =>
          import('./features/time-tracking/feature/clock.component').then(
            (m) => m.ClockComponent,
          ),
      },
      {
        path: 'absences',
        loadComponent: () =>
          import('./features/absences/feature/absence-request.component').then(
            (m) => m.AbsenceRequestComponent,
          ),
      },
      {
        path: 'timesheet',
        loadComponent: () =>
          import('./features/timesheet/feature/timesheet-review.component').then(
            (m) => m.TimesheetReviewComponent,
          ),
      },
      {
        path: 'timesheet-status',
        canActivate: [roleGuard(['ADMIN', 'MANAGER'])],
        loadComponent: () =>
          import('./features/timesheet/feature/timesheet-status.component').then(
            (m) => m.TimesheetStatusComponent,
          ),
      },
      {
        path: 'reports',
        canActivate: [roleGuard(['ADMIN', 'MANAGER'])],
        loadComponent: () =>
          import('./features/reports/feature/reports.component').then(
            (m) => m.ReportsComponent,
          ),
      },
      {
        path: 'admin',
        canActivate: [roleGuard(['ADMIN'])],
        loadComponent: () =>
          import('./features/admin/feature/rulesets.component').then(
            (m) => m.RulesetsComponent,
          ),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  {
    path: 'offline',
    loadComponent: () =>
      import('./features/offline/offline.component').then((m) => m.OfflineComponent),
  },
  { path: '**', redirectTo: '' },
];
