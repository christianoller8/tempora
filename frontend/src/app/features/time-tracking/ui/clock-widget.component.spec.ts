import { TestBed } from '@angular/core/testing';
import { ClockWidgetComponent } from './clock-widget.component';
import type { TimeEntryDto } from '../data-access/time.api';

const openEntry: TimeEntryDto = {
  id: 'entry-1',
  employeeId: 'emp-1',
  clockIn: new Date(Date.now() - 3600_000).toISOString(), // 1h ago
  clockOut: null,
  status: 'OPEN',
  source: 'web',
};

describe('ClockWidgetComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClockWidgetComponent],
    }).compileComponents();
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(ClockWidgetComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('isClockedIn is false when no entry', () => {
    const fixture = TestBed.createComponent(ClockWidgetComponent);
    fixture.componentRef.setInput('currentEntry', null);
    fixture.detectChanges();
    expect(fixture.componentInstance.isClockedIn()).toBe(false);
  });

  it('isClockedIn is true when entry is OPEN', () => {
    const fixture = TestBed.createComponent(ClockWidgetComponent);
    fixture.componentRef.setInput('currentEntry', openEntry);
    fixture.detectChanges();
    expect(fixture.componentInstance.isClockedIn()).toBe(true);
  });

  it('emits clockIn event when clock-in button clicked', () => {
    const fixture = TestBed.createComponent(ClockWidgetComponent);
    fixture.componentRef.setInput('currentEntry', null);
    fixture.componentRef.setInput('isClocking', false);
    fixture.detectChanges();

    const clockInSpy = vi.fn();
    fixture.componentInstance.clockIn.subscribe(clockInSpy);

    const btn = fixture.nativeElement.querySelector('[aria-label="Clock in"]');
    expect(btn).toBeTruthy();
    btn.click();
    expect(clockInSpy).toHaveBeenCalledOnce();
  });

  it('emits clockOut event when clock-out button clicked', () => {
    const fixture = TestBed.createComponent(ClockWidgetComponent);
    fixture.componentRef.setInput('currentEntry', openEntry);
    fixture.componentRef.setInput('isClocking', false);
    fixture.detectChanges();

    const clockOutSpy = vi.fn();
    fixture.componentInstance.clockOut.subscribe(clockOutSpy);

    const btn = fixture.nativeElement.querySelector('[aria-label="Clock out"]');
    expect(btn).toBeTruthy();
    btn.click();
    expect(clockOutSpy).toHaveBeenCalledOnce();
  });

  it('disables buttons when isClocking is true', () => {
    const fixture = TestBed.createComponent(ClockWidgetComponent);
    fixture.componentRef.setInput('currentEntry', null);
    fixture.componentRef.setInput('isClocking', true);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('button');
    expect(btn.disabled).toBe(true);
  });

  it('shows error message when error input is set', () => {
    const fixture = TestBed.createComponent(ClockWidgetComponent);
    fixture.componentRef.setInput('error', 'Something went wrong');
    fixture.detectChanges();

    const errorEl = fixture.nativeElement.querySelector('[role="alert"]');
    expect(errorEl?.textContent).toContain('Something went wrong');
  });
});
