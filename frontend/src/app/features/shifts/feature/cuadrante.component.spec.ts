import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { CuadranteComponent } from './cuadrante.component';
import { SchedulesStore } from '../data-access/schedules.store';
import { ShiftsApi } from '../data-access/shifts.api';
import type { ShiftSchedule } from '../data-access/shifts.api';
import { AuthStore } from '../../../core/auth/auth.store';
import { ReportsApi } from '../../reports/data-access/reports.api';
import { ApiService } from '../../../core/http/api.service';
import { API_BASE_URL } from '../../../core/http/api.tokens';

const mockSchedule: ShiftSchedule = {
  id: 'sched-1',
  organizationId: 'org-1',
  centerId: 'center-1',
  departmentId: null,
  year: 2026,
  month: 6,
  status: 'DRAFT',
  publishedAt: null,
  publishedBy: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function createMockApi(): Partial<InstanceType<typeof ShiftsApi>> {
  return {
    listSchedules: () => of([mockSchedule]),
    createSchedule: () => of(mockSchedule),
    publishSchedule: () => of({ schedule: { ...mockSchedule, status: 'PUBLISHED' as const }, warnings: [] }),
    listAssignments: () => of([]),
  };
}

function createMockStore(): Partial<InstanceType<typeof SchedulesStore>> {
  const entities = [mockSchedule];
  return {
    entities: () => entities,
    loading: () => false,
    error: () => null,
    lastWarnings: () => [],
    loadSchedules: async () => {},
    createSchedule: async () => mockSchedule,
    publishSchedule: async () => [],
    clearWarnings: () => {},
  } as unknown as Partial<InstanceType<typeof SchedulesStore>>;
}

describe('CuadranteComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CuadranteComponent],
      providers: [
        { provide: SchedulesStore, useValue: createMockStore() },
        { provide: ShiftsApi, useValue: createMockApi() },
      ],
    }).compileComponents();
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(CuadranteComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('calls loadCurrentSchedule on init', () => {
    const store = TestBed.inject(SchedulesStore);
    const loadSpy = vi.spyOn(store, 'loadSchedules');
    const fixture = TestBed.createComponent(CuadranteComponent);
    fixture.detectChanges();
    expect(loadSpy).toHaveBeenCalled();
  });

  it('activeSchedule() returns schedule matching selected year/month', () => {
    const fixture = TestBed.createComponent(CuadranteComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component['selectedYear'].set(2026);
    component['selectedMonth'].set(6);

    expect(component['activeSchedule']()?.id).toBe('sched-1');
  });

  it('activeSchedule() returns null when no matching schedule', () => {
    const fixture = TestBed.createComponent(CuadranteComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component['selectedYear'].set(2025);

    expect(component['activeSchedule']()).toBeNull();
  });

  it('dismissWarnings() clears the warnings signal', () => {
    const fixture = TestBed.createComponent(CuadranteComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component['warnings'].set([{ type: 'warn', code: 'MAX_DAILY_9H', message: 'Warning' }]);
    component['dismissWarnings']();

    expect(component['warnings']()).toHaveSize(0);
  });

  it('publish() calls schedulesStore.publishSchedule with active schedule id', async () => {
    const store = TestBed.inject(SchedulesStore);
    const publishSpy = vi.spyOn(store, 'publishSchedule').mockResolvedValue([]);

    const fixture = TestBed.createComponent(CuadranteComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component['selectedYear'].set(2026);
    component['selectedMonth'].set(6);

    component['publish']();
    await Promise.resolve(); // allow microtask queue to flush

    expect(publishSpy).toHaveBeenCalledWith('sched-1');
  });
});

describe('CuadranteComponent — Schedule PDF button (T11)', () => {
  let downloadScheduleMock: ReturnType<typeof vi.fn>;

  function createMockReportsApi() {
    downloadScheduleMock = vi.fn(() => of(undefined));
    return { downloadSchedule: downloadScheduleMock };
  }

  function createMockAuthStore(role: string | null = 'ADMIN') {
    return {
      role: () => role,
      user: () => ({ employeeId: 'emp-test' }),
    };
  }

  function createMockApiService() {
    return {
      get: vi.fn(() => of([])),
      post: vi.fn(() => of({})),
      patch: vi.fn(() => of({})),
    };
  }

  async function setup(role: string | null = 'ADMIN') {
    downloadScheduleMock = vi.fn(() => of(undefined));
    await TestBed.configureTestingModule({
      imports: [CuadranteComponent],
      providers: [
        { provide: SchedulesStore, useValue: createMockStore() },
        {
          provide: ShiftsApi,
          useValue: {
            ...createMockApi(),
            listSwaps: vi.fn(() => of([])),
          },
        },
        { provide: AuthStore, useValue: createMockAuthStore(role) },
        { provide: ReportsApi, useValue: { downloadSchedule: downloadScheduleMock } },
        { provide: ApiService, useValue: createMockApiService() },
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    }).compileComponents();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('should render schedule PDF button for all roles', async () => {
    await setup('EMPLOYEE');
    const fixture = TestBed.createComponent(CuadranteComponent);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('p-button');
    const pdfBtn = Array.from(buttons).find((el: Element) =>
      el.getAttribute('label') === 'Schedule PDF',
    );
    expect(pdfBtn).toBeTruthy();
  });

  it('should call reportsApi.downloadSchedule with selectedYear and selectedMonth', async () => {
    await setup();
    const fixture = TestBed.createComponent(CuadranteComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component['selectedYear'].set(2026);
    component['selectedMonth'].set(6);

    await component.onDownloadSchedule();

    expect(downloadScheduleMock).toHaveBeenCalledWith(
      expect.objectContaining({ year: 2026, month: 6 }),
    );
  });

  it('should set downloadingSchedule=true during download', async () => {
    let resolveDownload!: () => void;
    const pending$ = new Promise<void>(r => { resolveDownload = r; });

    await TestBed.resetTestingModule();
    const pendingDownload = vi.fn(
      () => new Observable<void>(sub => {
        void pending$.then(() => { sub.next(undefined); sub.complete(); });
      }),
    );
    await TestBed.configureTestingModule({
      imports: [CuadranteComponent],
      providers: [
        { provide: SchedulesStore, useValue: createMockStore() },
        {
          provide: ShiftsApi,
          useValue: { ...createMockApi(), listSwaps: vi.fn(() => of([])) },
        },
        { provide: AuthStore, useValue: createMockAuthStore() },
        { provide: ReportsApi, useValue: { downloadSchedule: pendingDownload } },
        { provide: ApiService, useValue: createMockApiService() },
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CuadranteComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    const downloadPromise = component.onDownloadSchedule();
    expect(component.downloadingSchedule()).toBe(true);

    resolveDownload();
    await downloadPromise;
    expect(component.downloadingSchedule()).toBe(false);
  });

  it('should set downloadingSchedule=false after download completes', async () => {
    await setup();
    const fixture = TestBed.createComponent(CuadranteComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    await component.onDownloadSchedule();

    expect(component.downloadingSchedule()).toBe(false);
  });

  it('should set downloadingSchedule=false if download fails', async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [CuadranteComponent],
      providers: [
        { provide: SchedulesStore, useValue: createMockStore() },
        {
          provide: ShiftsApi,
          useValue: { ...createMockApi(), listSwaps: vi.fn(() => of([])) },
        },
        { provide: AuthStore, useValue: createMockAuthStore() },
        {
          provide: ReportsApi,
          useValue: {
            downloadSchedule: vi.fn(() => throwError(() => new Error('Network error'))),
          },
        },
        { provide: ApiService, useValue: createMockApiService() },
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CuadranteComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    await component.onDownloadSchedule();

    expect(component.downloadingSchedule()).toBe(false);
  });
});
