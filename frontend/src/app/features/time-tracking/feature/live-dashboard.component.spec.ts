import { TestBed } from '@angular/core/testing';
import { LiveDashboardComponent } from './live-dashboard.component';
import { TimeStore } from '../data-access/time.store';
import { SseService } from '../../../core/sse/sse.service';
import { API_BASE_URL } from '../../../core/http/api.tokens';
import type { TimeEntryDto } from '../data-access/time.api';

const openEntry: TimeEntryDto = {
  id: 'entry-1',
  employeeId: 'emp-1',
  clockIn: new Date().toISOString(),
  clockOut: null,
  status: 'OPEN',
  source: 'web',
};

const closedEntry: TimeEntryDto = {
  id: 'entry-2',
  employeeId: 'emp-2',
  clockIn: new Date(Date.now() - 3600_000).toISOString(),
  clockOut: new Date().toISOString(),
  status: 'CLOSED',
  source: 'web',
};

function createMockStore(): Partial<InstanceType<typeof TimeStore>> {
  return {
    entries: () => [openEntry, closedEntry],
    currentEntry: () => null,
    isClocking: () => false,
    error: () => null,
    isClockedIn: () => false,
    clockInTime: () => null,
    loadEntries: vi.fn().mockResolvedValue(undefined),
    clockIn: vi.fn(),
    clockOut: vi.fn(),
  } as unknown as Partial<InstanceType<typeof TimeStore>>;
}

describe('LiveDashboardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LiveDashboardComponent],
      providers: [
        { provide: TimeStore, useValue: createMockStore() },
        {
          provide: SseService,
          useValue: {
            connect: vi.fn(),
            disconnect: vi.fn(),
            connected: () => true,
            lastEvent: () => null,
          },
        },
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    }).compileComponents();
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(LiveDashboardComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('calls store.loadEntries on init', () => {
    const store = TestBed.inject(TimeStore);
    const fixture = TestBed.createComponent(LiveDashboardComponent);
    fixture.detectChanges();
    expect(store.loadEntries).toHaveBeenCalled();
  });

  it('renders a row for each time entry', () => {
    const fixture = TestBed.createComponent(LiveDashboardComponent);
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    // 2 entries in mock
    expect(rows.length).toBe(2);
  });

  it('shows connection status as Live when sse.connected() is true', () => {
    const fixture = TestBed.createComponent(LiveDashboardComponent);
    fixture.detectChanges();
    const statusEl = fixture.nativeElement.querySelector('.connection-status');
    expect(statusEl?.textContent?.trim()).toBe('Live');
  });

  it('entries computed returns store entries', () => {
    const fixture = TestBed.createComponent(LiveDashboardComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance['entries']()).toHaveLength(2);
  });
});
