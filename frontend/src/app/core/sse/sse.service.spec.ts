import { TestBed } from '@angular/core/testing';
import { SseService } from './sse.service';
import { API_BASE_URL } from '../http/api.tokens';

// We cannot test the real EventSource in a Node/jsdom environment,
// so we provide a minimal mock that exercises the service's signal state.

class MockEventSource {
  static lastInstance: MockEventSource | null = null;

  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;

  constructor(
    public readonly url: string,
    public readonly init?: { withCredentials?: boolean },
  ) {
    MockEventSource.lastInstance = this;
  }

  close = vi.fn();

  simulateOpen(): void {
    this.onopen?.();
  }

  simulateError(): void {
    this.onerror?.();
  }

  simulateMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

describe('SseService', () => {
  let service: SseService;
  let originalEventSource: typeof EventSource;

  beforeEach(() => {
    // Replace global EventSource with our mock.
    originalEventSource = globalThis.EventSource;
    (globalThis as Record<string, unknown>)['EventSource'] = MockEventSource;

    TestBed.configureTestingModule({
      providers: [
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        SseService,
      ],
    });

    service = TestBed.inject(SseService);
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>)['EventSource'] = originalEventSource;
    vi.useRealTimers();
  });

  it('starts disconnected', () => {
    expect(service.connected()).toBe(false);
    expect(service.lastEvent()).toBeNull();
  });

  it('connect() creates an EventSource with withCredentials:true', () => {
    service.connect();
    expect(MockEventSource.lastInstance).toBeTruthy();
    expect(MockEventSource.lastInstance!.url).toContain('/notifications/stream');
    expect(MockEventSource.lastInstance!.init?.withCredentials).toBe(true);
  });

  it('connected signal becomes true on open', () => {
    service.connect();
    MockEventSource.lastInstance!.simulateOpen();
    expect(service.connected()).toBe(true);
  });

  it('lastEvent signal updates when a valid SSE message arrives', () => {
    service.connect();
    MockEventSource.lastInstance!.simulateOpen();

    const fakeEvent = {
      type: 'CLOCK_IN',
      organizationId: 'org-1',
      payload: { employeeId: 'emp-1' },
      emittedAt: new Date().toISOString(),
    };

    MockEventSource.lastInstance!.simulateMessage(fakeEvent);
    expect(service.lastEvent()).toMatchObject({ type: 'CLOCK_IN' });
  });

  it('connected becomes false and re-schedules reconnect on error', () => {
    vi.useFakeTimers();
    service.connect();
    MockEventSource.lastInstance!.simulateOpen();
    expect(service.connected()).toBe(true);

    MockEventSource.lastInstance!.simulateError();
    expect(service.connected()).toBe(false);
    // A new EventSource should be created after the backoff delay.
    vi.advanceTimersByTime(1500);
    expect(MockEventSource.lastInstance).toBeTruthy();
  });

  it('connect() is a no-op when already connected', () => {
    service.connect();
    const first = MockEventSource.lastInstance;
    service.connect();
    expect(MockEventSource.lastInstance).toBe(first);
  });

  it('disconnect() closes the EventSource and sets connected to false', () => {
    service.connect();
    MockEventSource.lastInstance!.simulateOpen();
    expect(service.connected()).toBe(true);

    service.disconnect();
    expect(service.connected()).toBe(false);
  });
});
