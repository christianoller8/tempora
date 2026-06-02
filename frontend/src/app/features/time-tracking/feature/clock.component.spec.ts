import { TestBed } from '@angular/core/testing';
import { ClockComponent } from './clock.component';
import { TimeStore } from '../data-access/time.store';
import { TimeApi } from '../data-access/time.api';
import { SseService } from '../../../core/sse/sse.service';
import { API_BASE_URL } from '../../../core/http/api.tokens';
import { of } from 'rxjs';
import type { TimeEntryDto } from '../data-access/time.api';

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
