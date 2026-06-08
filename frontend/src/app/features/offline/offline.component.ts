import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-offline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ButtonModule],
  styles: [`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100dvh;
      padding: 2rem;
      background: var(--p-surface-ground);
    }

    .offline-card {
      text-align: center;
      max-width: 400px;
      width: 100%;
    }

    .offline-icon {
      font-size: 4rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      margin-bottom: 1.5rem;
      display: block;
    }

    .offline-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--p-text-color);
      margin-bottom: 0.75rem;
    }

    .offline-message {
      font-size: 0.9375rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      line-height: 1.6;
      margin-bottom: 2rem;
    }

    .offline-actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      align-items: center;
    }
  `],
  template: `
    <div class="offline-card">
      <i class="offline-icon pi pi-wifi"></i>
      <h1 class="offline-title">Sin conexión</h1>
      <p class="offline-message">
        No hay conexión a internet. Las funciones de registro de jornada y
        consulta de datos no están disponibles en este momento.
        Conéctate a la red para continuar.
      </p>
      <div class="offline-actions">
        <p-button
          label="Reintentar"
          icon="pi pi-refresh"
          (onClick)="retry()"
          [style]="{ minHeight: '44px' }"
        />
        <p-button
          label="Volver al inicio"
          [routerLink]="['/']"
          [text]="true"
          severity="secondary"
          [style]="{ minHeight: '44px' }"
        />
      </div>
    </div>
  `,
})
export class OfflineComponent {
  retry(): void {
    window.location.reload();
  }
}
