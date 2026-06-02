import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TimeStore } from './time.store';
import { TimeApi } from './time.api';
import { SseService } from '../../../core/sse/sse.service';
import { API_BASE_URL } from '../../../core/http/api.tokens';
import type { TimeEntryDto } from './time.api';

const openEntry: TimeEntryDto = {
  id: 'entry-1',
  employeeId: 'emp-1',
  clockIn: new Date().toISOString(),
  clockOut: null,
  status: 'OPEN',
  source: 'web',
};

const closedEntry: TimeEntryDto = {
  ...openEntry,
  clockOut: new Date().toISOString(),
  status: 'CLOSED',
};

function createMockApi(): Partial<InstanceType<typeof TimeApi>> {
  return {
    clockIn: () => of(openEntry),
    clockOut: () => of(closedEntry),
    listEntries: () => of([openEntry]),
    createCorrection: () => of({}),
  };
}

function createMockSseService(): Partial<InstanceType<typeof SseService>> {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: () => false,
    lastEvent: () => null,
  } as unknown as Partial<InstanceType<typeof SseService>>;
}

describe('TimeStore', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: TimeApi, useValue: createMockApi() },
        { provide: SseService, useValue: createMockSseService() },
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        TimeStore,
      ],
    });
  });

  it('starts with null currentEntry', () => {
    const store = TestBed.inject(TimeStore);
    expect(store.currentEntry()).toBeNull();
  });

  it('clockIn() sets currentEntry to OPEN entry', async () => {
    const store = TestBed.inject(TimeStore);
    await store.clockIn();
    expect(store.currentEntry()?.status).toBe('OPEN');
  });

  it('clockOut() sets currentEntry to CLOSED entry', async () => {
    const store = TestBed.inject(TimeStore);
    await store.clockIn();
    await store.clockOut();
    expect(store.currentEntry()?.status).toBe('CLOSED');
  });

  it('isClockedIn computed is true when currentEntry is OPEN', async () => {
    const store = TestBed.inject(TimeStore);
    await store.clockIn();
    expect(store.isClockedIn()).toBe(true);
  });

  it('loadEntries() populates entries and sets currentEntry from OPEN', async () => {
    const store = TestBed.inject(TimeStore);
    await store.loadEntries();
    expect(store.entries()).toHaveLength(1);
    expect(store.currentEntry()?.status).toBe('OPEN');
  });

  it('clockIn() sets error on failure', async () => {
    const api = TestBed.inject(TimeApi);
    vi.spyOn(api, 'clockIn').mockReturnValue(throwError(() => new Error('Network error')));
    const store = TestBed.inject(TimeStore);
    await store.clockIn();
    expect(store.error()).toBe('Network error');
    expect(store.isClocking()).toBe(false);
  });
});
