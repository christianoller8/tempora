import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-public-shell',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: var(--p-surface-ground);
      background-image:
        radial-gradient(ellipse at 25% 25%,
          color-mix(in srgb, var(--p-primary-color) 8%, transparent) 0%,
          transparent 55%),
        radial-gradient(ellipse at 75% 75%,
          color-mix(in srgb, var(--p-primary-color) 5%, transparent) 0%,
          transparent 55%);
    }
  `],
  template: `<router-outlet />`,
})
export class PublicShellComponent {}
