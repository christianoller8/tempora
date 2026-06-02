import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  computed,
} from '@angular/core';

/**
 * NotificationBellComponent — presentational component.
 *
 * Renders a bell button with an unread count badge.
 * Emits `open` event when clicked.
 *
 * Satisfies FR-NOTIF-9 (notification count display).
 */
@Component({
  selector: 'app-notification-bell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="notification-bell"
      [attr.aria-label]="ariaLabel()"
      (click)="open.emit()"
    >
      <span aria-hidden="true">🔔</span>
      @if (count() > 0) {
        <span
          class="badge"
          aria-live="polite"
          aria-atomic="true"
        >{{ count() }}</span>
      }
    </button>
  `,
})
export class NotificationBellComponent {
  readonly count = input<number>(0);
  readonly open = output<void>();

  readonly ariaLabel = computed(() =>
    this.count() > 0
      ? `Notifications: ${this.count()} unread`
      : 'Notifications',
  );
}
