import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-clock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<p>Time Tracking feature (placeholder)</p>',
})
export class ClockComponent {}
