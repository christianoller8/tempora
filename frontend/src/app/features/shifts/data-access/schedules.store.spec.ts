import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SchedulesStore } from './schedules.store';
import { ShiftsApi } from './shifts.api';
import type { ShiftSchedule, RuleCheckResult } from './shifts.api';

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

const mockPublishedSchedule: ShiftSchedule = {
  ...mockSchedule,
  status: 'PUBLISHED',
  publishedAt: new Date().toISOString(),
  publishedBy: 'user-1',
};

const mockWarnings: RuleCheckResult[] = [
  { type: 'warn', code: 'MAX_DAILY_9H', message: 'Daily hours exceeded' },
];

function createMockApi(overrides: Partial<InstanceType<typeof ShiftsApi>> = {}): Partial<InstanceType<typeof ShiftsApi>> {
  return {
    listSchedules: () => of([mockSchedule]),
    createSchedule: () => of(mockSchedule),
    publishSchedule: () => of({ schedule: mockPublishedSchedule, warnings: [] }),
    ...overrides,
  };
}

describe('SchedulesStore', () => {
  let store: InstanceType<typeof SchedulesStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SchedulesStore,
        { provide: ShiftsApi, useValue: createMockApi() },
      ],
    });
    store = TestBed.inject(SchedulesStore);
  });

  it('loads schedules and populates entities', async () => {
    await store.loadSchedules();
    expect(store.schedules()).toHaveLength(1);
    expect(store.schedules()[0]?.id).toBe('sched-1');
  });

  it('loading flag is false after successful load', async () => {
    await store.loadSchedules();
    expect(store.loading()).toBe(false);
  });

  it('sets error state when loadSchedules fails', async () => {
    TestBed.overrideProvider(ShiftsApi, {
      useValue: createMockApi({
        listSchedules: () => throwError(() => new Error('Network error')),
      }),
    });
    store = TestBed.inject(SchedulesStore);
    await store.loadSchedules();
    expect(store.error()).toBe('Network error');
    expect(store.loading()).toBe(false);
  });

  it('creates schedule and adds to entity collection', async () => {
    await store.createSchedule({ centerId: 'c-1', year: 2026, month: 6 });
    expect(store.schedules()).toHaveLength(1);
  });

  it('publishSchedule transitions schedule to PUBLISHED and returns warnings', async () => {
    TestBed.overrideProvider(ShiftsApi, {
      useValue: createMockApi({
        publishSchedule: () => of({ schedule: mockPublishedSchedule, warnings: mockWarnings }),
      }),
    });
    store = TestBed.inject(SchedulesStore);
    await store.loadSchedules();
    const warnings = await store.publishSchedule('sched-1');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.code).toBe('MAX_DAILY_9H');
    expect(store.schedules()[0]?.status).toBe('PUBLISHED');
  });

  it('publishSchedule stores warnings in lastWarnings state', async () => {
    TestBed.overrideProvider(ShiftsApi, {
      useValue: createMockApi({
        publishSchedule: () => of({ schedule: mockPublishedSchedule, warnings: mockWarnings }),
      }),
    });
    store = TestBed.inject(SchedulesStore);
    await store.publishSchedule('sched-1');
    expect(store.lastWarnings()).toHaveLength(1);
  });

  it('draftSchedules computed filters only DRAFT schedules', async () => {
    await store.loadSchedules();
    expect(store.draftSchedules()).toHaveSize(1);
    expect(store.publishedSchedules()).toHaveSize(0);
  });

  it('clearWarnings resets lastWarnings to empty array', async () => {
    TestBed.overrideProvider(ShiftsApi, {
      useValue: createMockApi({
        publishSchedule: () => of({ schedule: mockPublishedSchedule, warnings: mockWarnings }),
      }),
    });
    store = TestBed.inject(SchedulesStore);
    await store.publishSchedule('sched-1');
    store.clearWarnings();
    expect(store.lastWarnings()).toHaveSize(0);
  });
});
