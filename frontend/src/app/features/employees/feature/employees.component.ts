import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-employees',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<p>Employees feature (placeholder)</p>',
})
export class EmployeesComponent {}
