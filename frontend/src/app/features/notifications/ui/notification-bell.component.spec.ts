import { TestBed } from '@angular/core/testing';
import { NotificationBellComponent } from './notification-bell.component';

describe('NotificationBellComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
    }).compileComponents();
  });

  it('renders the bell button', () => {
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('button')).toBeTruthy();
  });

  it('shows badge when count > 0', () => {
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.componentRef.setInput('count', 3);
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent.trim()).toBe('3');
  });

  it('hides badge when count is 0', () => {
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.componentRef.setInput('count', 0);
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.badge');
    expect(badge).toBeNull();
  });
});
