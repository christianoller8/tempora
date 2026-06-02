import { TestBed } from '@angular/core/testing';
import { ReportsComponent } from './reports.component';
import { ReportsApi } from '../data-access/reports.api';
import { API_BASE_URL } from '../../../core/http/api.tokens';
import { of } from 'rxjs';
import type { ReportRow } from '../data-access/reports.api';

const mockRows: ReportRow[] = [
  { employeeId: 'emp-1', firstName: 'Alice', regularHours: 120, overtimeHours: 5, partTimeDeviation: -5 },
];

function createMockApi(): Partial<InstanceType<typeof ReportsApi>> {
  return {
    getMonthlyHours: vi.fn().mockReturnValue(of(mockRows)),
    getOvertime: vi.fn().mockReturnValue(of([])),
    getAbsenteeism: vi.fn().mockReturnValue(of([])),
    getCoverage: vi.fn().mockReturnValue(of([])),
    getCompliance: vi.fn().mockReturnValue(of(new Blob())),
    downloadReport: vi.fn(),
  };
}

describe('ReportsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportsComponent],
      providers: [
        { provide: ReportsApi, useValue: createMockApi() },
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    }).compileComponents();
  });

  it('renders the report type buttons', () => {
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('button[type="button"]').length).toBeGreaterThanOrEqual(4);
  });

  it('selects a report type when button is clicked', () => {
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.selectType('overtime');
    expect(comp.selectedType()).toBe('overtime');
  });

  it('displays table rows after running a json report', async () => {
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    await comp.runReport('json');
    fixture.detectChanges();
    expect(comp.rows().length).toBeGreaterThan(0);
  });

  it('shows error message when API throws', async () => {
    const api = TestBed.inject(ReportsApi) as unknown as ReturnType<typeof createMockApi>;
    (api.getMonthlyHours as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Network error');
    });
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    await comp.runReport('json');
    expect(comp.error()).toBeTruthy();
  });

  it('shows only year filter for overtime report type', () => {
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.selectType('overtime');
    fixture.detectChanges();
    expect(comp.showMonth()).toBe(false);
    expect(comp.showEmployeeId()).toBe(true);
  });
});
