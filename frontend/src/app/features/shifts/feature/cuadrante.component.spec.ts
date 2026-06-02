import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CuadranteComponent } from './cuadrante.component';
import { SchedulesStore } from '../data-access/schedules.store';
import { ShiftsApi } from '../data-access/shifts.api';
import type { ShiftSchedule } from '../data-access/shifts.api';

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
