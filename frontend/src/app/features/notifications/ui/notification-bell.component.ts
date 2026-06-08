import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * NotificationBellComponent — topbar bell with unread count badge.
 * Stays presentational: emits (open) with the MouseEvent so the host
 * can anchor a popover to the button (ADR-5).
 */
@Component({
  selector: 'app-notification-bell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, BadgeModule, TranslatePipe],
  styles: [`
    :host { display: inline-flex; align-items: center; }

    .bell-btn {
      position: relative;
    }

    .bell-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 18px;
      height: 18px;
      background: var(--p-red-500, #ef4444);
      color: #fff;
      font-size: 0.65rem;
      font-weight: 700;
      border-radius: 9px;
      padding: 0 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      pointer-events: none;
    }
  `],
  template: `
    <div class="bell-btn" style="position: relative; display: inline-flex;">
      <p-button
        icon="pi pi-bell"
        [text]="true"
        [rounded]="true"
        severity="secondary"
        (onClick)="open.emit($event)"
        [attr.aria-label]="count() > 0 ? ('NOTIFICATIONS.TITLE' | translate) + ': ' + count() : ('NOTIFICATIONS.TITLE' | translate)"
      />
      @if (count() > 0) {
        <span class="bell-badge" aria-live="polite" aria-atomic="true">
          {{ count() > 99 ? '99+' : count() }}
        </span>
      }
    </div>
  `,
})
export class NotificationBellComponent {
  readonly count = input<number>(0);
  /** Emits the click MouseEvent so the host can anchor a p-popover to it. */
  readonly open  = output<MouseEvent>();

}
