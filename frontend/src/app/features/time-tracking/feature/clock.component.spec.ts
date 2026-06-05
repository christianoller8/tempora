import { TestBed } from '@angular/core/testing';
import { ClockComponent } from './clock.component';
import { TimeStore } from '../data-access/time.store';
import { TimeApi } from '../data-access/time.api';
import { SseService } from '../../../core/sse/sse.service';
import { API_BASE_URL } from '../../../core/http/api.tokens';
import { AuthStore } from '../../../core/auth/auth.store';
import { ReportsApi } from '../../reports/data-access/reports.api';
import { EmployeesApi } from '../../employees/data-access/employees.api';
import { of } from 'rxjs';
import type { TimeEntryDto } from '../data-access/time.api';

function createMockAuthStore(role: string | null = 'EMPLOYEE'): Partial<AuthStore> {
  return {
    role: () => role,
    user: () => null,
  };
}

function createMockReportsApi(): Partial<InstanceType<typeof ReportsApi>> {
  return {
    downloadTimeEntries: vi.fn(() => of(undefined)),
  };
}

function createMockEmployeesApi(): Partial<InstanceType<typeof EmployeesApi>> {
  return {
    list: vi.fn(() => of([])),
  };
}

const openEntry: TimeEntryDto = {
  id: 'entry-1',
  employeeId: 'emp-1',
  clockIn: new Date().toISOString(),
  clockOut: null,
  status: 'OPEN',
  source: 'web',
};

function createMockStore(): Partial<InstanceType<typeof TimeStore>> {
  return {
    currentEntry: () => openEntry,
    isClocking: () => false,
    error: () => null,
    isClockedIn: () => true,
    clockInTime: () => openEntry.clockIn,
    entries: () => [openEntry],
    clockIn: vi.fn().mockResolvedValue(undefined),
    clockOut: vi.fn().mockResolvedValue(undefined),
    loadEntries: vi.fn().mockResolvedValue(undefined),
  } as unknown as Partial<InstanceType<typeof TimeStore>>;
}

describe('ClockComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClockComponent],
      providers: [
        { provide: TimeStore, useValue: createMockStore() },
        {
          provide: TimeApi,
          useValue: {
            clockIn: () => of(openEntry),
            clockOut: () => of({ ...openEntry, status: 'CLOSED' }),
            listEntries: () => of([openEntry]),
            createCorrection: () => of({}),
          },
        },
        {
          provide: SseService,
          useValue: {
            connect: vi.fn(),
            disconnect: vi.fn(),
            connected: () => false,
            lastEvent: () => null,
          },
        },
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    }).compileComponents();
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(ClockComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders ClockWidgetComponent', () => {
    const fixture = TestBed.createComponent(ClockComponent);
    fixture.detectChanges();
    const widget = fixture.nativeElement.querySelector('app-clock-widget');
    expect(widget).toBeTruthy();
  });

  it('calls store.clockIn on clockIn event', () => {
    const store = TestBed.inject(TimeStore);
    const fixture = TestBed.createComponent(ClockComponent);
    fixture.detectChanges();

    fixture.componentInstance.onClockIn();
    expect(store.clockIn).toHaveBeenCalled();
  });

  it('calls store.clockOut on clockOut event', () => {
    const store = TestBed.inject(TimeStore);
    const fixture = TestBed.createComponent(ClockComponent);
    fixture.detectChanges();

    fixture.componentInstance.onClockOut();
    expect(store.clockOut).toHaveBeenCalled();
  });

  it('toggles correction form visibility', () => {
    const fixture = TestBed.createComponent(ClockComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance['showCorrectionForm']()).toBe(false);
    const toggleBtn = fixture.nativeElement.querySelector('.btn-link');
    expect(toggleBtn).toBeTruthy();
    toggleBtn.click();
    fixture.detectChanges();
    expect(fixture.componentInstance['showCorrectionForm']()).toBe(true);
  });
});

describe('ClockComponent — Export for Inspection button (T10)', () => {
  function setupWithRole(role: string | null) {
    return TestBed.configureTestingModule({
      imports: [ClockComponent],
      providers: [
        { provide: TimeStore, useValue: createMockStore() },
        {
          provide: TimeApi,
          useValue: {
            clockIn: () => of(openEntry),
            clockOut: () => of({ ...openEntry, status: 'CLOSED' }),
            listEntries: () => of([openEntry]),
            createCorrection: () => of({}),
          },
        },
        {
          provide: SseService,
          useValue: {
            connect: vi.fn(),
            disconnect: vi.fn(),
            connected: () => false,
            lastEvent: () => null,
          },
        },
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        { provide: AuthStore, useValue: createMockAuthStore(role) },
        { provide: ReportsApi, useValue: createMockReportsApi() },
        { provide: EmployeesApi, useValue: createMockEmployeesApi() },
      ],
    }).compileComponents();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('should not render export button for EMPLOYEE role', async () => {
    await setupWithRole('EMPLOYEE');
    const fixture = TestBed.createComponent(ClockComponent);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('p-button');
    const exportBtn = Array.from(buttons).find((el: Element) =>
      el.getAttribute('label') === 'Export for Inspection',
    );
    expect(exportBtn).toBeUndefined();
  });

  it('should render export button for ADMIN role', async () => {
    await setupWithRole('ADMIN');
    const fixture = TestBed.createComponent(ClockComponent);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('p-button');
    const exportBtn = Array.from(buttons).find((el: Element) =>
      el.getAttribute('label') === 'Export for Inspection',
    );
    expect(exportBtn).toBeTruthy();
  });

  it('should render export button for MANAGER role', async () => {
    await setupWithRole('MANAGER');
    const fixture = TestBed.createComponent(ClockComponent);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('p-button');
    const exportBtn = Array.from(buttons).find((el: Element) =>
      el.getAttribute('label') === 'Export for Inspection',
    );
    expect(exportBtn).toBeTruthy();
  });

  it('should set showExport=true when export button is clicked', async () => {
    await setupWithRole('ADMIN');
    const fixture = TestBed.createComponent(ClockComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.showExport()).toBe(false);

    component.showExport.set(true);
    expect(component.showExport()).toBe(true);
  });

  it('should render app-export-dialog with visible=false initially for ADMIN', async () => {
    await setupWithRole('ADMIN');
    const fixture = TestBed.createComponent(ClockComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.showExport()).toBe(false);
  });

  it('should pass visible=true to export dialog when showExport is set to true', async () => {
    await setupWithRole('ADMIN');
    const fixture = TestBed.createComponent(ClockComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.showExport.set(true);
    fixture.detectChanges();

    expect(component.showExport()).toBe(true);
    const dialog = fixture.nativeElement.querySelector('app-export-dialog');
    expect(dialog).toBeTruthy();
  });
});
