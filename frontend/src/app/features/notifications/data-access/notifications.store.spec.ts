import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { NotificationsStore } from './notifications.store';
import { SseService } from '../../../core/sse/sse.service';
import { API_BASE_URL } from '../../../core/http/api.tokens';
import { of } from 'rxjs';
import type { NotificationItem } from './notifications.store';

const n1: NotificationItem = {
  id: 'n-1',
  organizationId: 'org-1',
  userId: 'user-1',
  type: 'CLOCK_IN',
  payload: {},
  read: false,
  createdAt: new Date().toISOString(),
};

const n2: NotificationItem = { ...n1, id: 'n-2', read: true };

function createMockHttp(notifications: NotificationItem[] = [n1, n2]): Partial<InstanceType<typeof HttpClient>> {
  return {
    get: vi.fn().mockReturnValue(of({ data: notifications })),
    patch: vi.fn().mockReturnValue(of({ data: { ...n1, read: true } })),
  };
}

function createMockSse(): Partial<InstanceType<typeof SseService>> {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: () => false,
    lastEvent: () => null,
  };
}

describe('NotificationsStore', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        NotificationsStore,
        { provide: HttpClient, useValue: createMockHttp() },
        { provide: SseService, useValue: createMockSse() },
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    });
  });

  it('initial state has empty notifications and loading=false', () => {
    const store = TestBed.inject(NotificationsStore);
    expect(store.notifications()).toEqual([]);
    expect(store.loading()).toBe(false);
  });

  it('loadNotifications populates notifications from API', async () => {
    const store = TestBed.inject(NotificationsStore);
    await store.loadNotifications();
    expect(store.notifications().length).toBe(2);
  });

  it('unreadCount reflects unread notifications', async () => {
    const store = TestBed.inject(NotificationsStore);
    await store.loadNotifications();
    // n1 is unread, n2 is read => unreadCount = 1
    expect(store.unreadCount()).toBe(1);
  });

  it('markRead transitions notification to read locally', async () => {
    const store = TestBed.inject(NotificationsStore);
    await store.loadNotifications();
    await store.markRead('n-1');
    const updated = store.notifications().find((n) => n.id === 'n-1');
    expect(updated?.read).toBe(true);
  });

  it('unreadCount is 0 when all notifications are read', async () => {
    TestBed.overrideProvider(HttpClient, {
      useValue: createMockHttp([{ ...n1, read: true }, { ...n2, read: true }]),
    });
    const store = TestBed.inject(NotificationsStore);
    await store.loadNotifications();
    expect(store.unreadCount()).toBe(0);
  });
});
