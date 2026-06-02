import { TestBed } from '@angular/core/testing';
import { NotificationListComponent } from './notification-list.component';
import { NotificationsStore } from '../data-access/notifications.store';
import { HttpClient } from '@angular/common/http';
import { SseService } from '../../../core/sse/sse.service';
import { API_BASE_URL } from '../../../core/http/api.tokens';
import type { NotificationItem } from '../data-access/notifications.store';

const n1: NotificationItem = {
  id: 'n-1',
  organizationId: 'org-1',
  userId: 'user-1',
  type: 'CLOCK_IN',
  payload: {},
  read: false,
  createdAt: new Date().toISOString(),
};

function createMockStore(): Partial<InstanceType<typeof NotificationsStore>> {
  return {
    notifications: () => [n1],
    loading: () => false,
    unreadCount: () => 1,
    loadNotifications: vi.fn().mockResolvedValue(undefined),
    markRead: vi.fn().mockResolvedValue(undefined),
  } as unknown as Partial<InstanceType<typeof NotificationsStore>>;
}

describe('NotificationListComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationListComponent],
      providers: [
        { provide: NotificationsStore, useValue: createMockStore() },
        {
          provide: HttpClient,
          useValue: { get: vi.fn(), patch: vi.fn() },
        },
        {
          provide: SseService,
          useValue: { connect: vi.fn(), disconnect: vi.fn(), connected: () => false, lastEvent: () => null },
        },
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    }).compileComponents();
  });

  it('renders the notification list section', () => {
    const fixture = TestBed.createComponent(NotificationListComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[aria-label="Notification list"]')).toBeTruthy();
  });

  it('renders a list item for each notification', () => {
    const fixture = TestBed.createComponent(NotificationListComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('li').length).toBe(1);
  });

  it('calls markRead when a notification is clicked', () => {
    const fixture = TestBed.createComponent(NotificationListComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const li = el.querySelector('li') as HTMLElement;
    li.click();
    const store = TestBed.inject(NotificationsStore) as unknown as ReturnType<typeof createMockStore>;
    expect(store.markRead).toHaveBeenCalledWith('n-1');
  });

  it('shows "No notifications" when list is empty', async () => {
    TestBed.overrideProvider(NotificationsStore, {
      useValue: {
        notifications: () => [],
        loading: () => false,
        unreadCount: () => 0,
        loadNotifications: vi.fn(),
        markRead: vi.fn(),
      },
    });
    const fixture = TestBed.createComponent(NotificationListComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No notifications');
  });
});
