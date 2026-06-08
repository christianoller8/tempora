import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { PwaService } from './pwa.service';

@Component({
  selector: 'app-install-prompt',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule],
  styles: [`
    .install-banner {
      position: fixed;
      bottom: 1rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.875rem 1.25rem;
      background: var(--p-surface-card);
      border: 1px solid var(--p-primary-color);
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      max-width: calc(100vw - 2rem);
      width: 360px;
    }

    .install-banner__icon {
      font-size: 1.5rem;
      color: var(--p-primary-color);
      flex-shrink: 0;
    }

    .install-banner__text {
      flex: 1;
      min-width: 0;
    }

    .install-banner__title {
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--p-text-color);
    }

    .install-banner__sub {
      font-size: 0.75rem;
      color: var(--p-text-color-muted, var(--p-text-color-secondary));
      margin-top: 2px;
    }

    .install-banner__dismiss {
      flex-shrink: 0;
    }
  `],
  template: `
    @if (pwa.canInstall()) {
      <div class="install-banner" role="dialog" aria-label="Instalar aplicación">
        <i class="install-banner__icon pi pi-download"></i>
        <div class="install-banner__text">
          <div class="install-banner__title">Instalar Tempora</div>
          <div class="install-banner__sub">Acceso rápido desde tu pantalla de inicio</div>
        </div>
        <p-button
          label="Instalar"
          size="small"
          (onClick)="install()"
          [style]="{ minHeight: '44px' }"
        />
        <p-button
          icon="pi pi-times"
          [text]="true"
          severity="secondary"
          class="install-banner__dismiss"
          aria-label="Cerrar"
          (onClick)="dismiss()"
          [style]="{ minHeight: '44px', minWidth: '44px' }"
        />
      </div>
    }
  `,
})
export class InstallPromptComponent {
  protected readonly pwa = inject(PwaService);

  async install(): Promise<void> {
    await this.pwa.promptInstall();
  }

  dismiss(): void {
    this.pwa.dismissInstall();
  }
}
