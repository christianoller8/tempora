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
      background: var(--bg);
      background-image:
        radial-gradient(ellipse at 25% 25%,
          rgba(64,27,187,0.08) 0%,
          transparent 55%),
        radial-gradient(ellipse at 75% 75%,
          rgba(64,27,187,0.05) 0%,
          transparent 55%);
    }
  `],
  template: `<router-outlet />`,
})
export class PublicShellComponent {}
