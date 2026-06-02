import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { AbsenceBalanceComponent } from './absence-balance.component';
import { ComponentRef } from '@angular/core';

describe('AbsenceBalanceComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<AbsenceBalanceComponent>>;
  let componentRef: ComponentRef<AbsenceBalanceComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AbsenceBalanceComponent],
    });
    fixture = TestBed.createComponent(AbsenceBalanceComponent);
    componentRef = fixture.componentRef;
  });

  it('creates the component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows "Balance not available" when balance is null', () => {
    componentRef.setInput('balance', null);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Balance not available');
  });

  it('displays entitled, used, and remaining days', () => {
    componentRef.setInput('balance', { entitled: 22, used: 5, remaining: 17 });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('22');
    expect(text).toContain('5');
    expect(text).toContain('17');
  });

  it('shows low badge when remaining < 5', () => {
    componentRef.setInput('balance', { entitled: 22, used: 20, remaining: 2 });
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.low-badge') as HTMLElement;
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('Low');
  });

  it('does not show low badge when remaining >= 5', () => {
    componentRef.setInput('balance', { entitled: 22, used: 15, remaining: 7 });
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.low-badge') as HTMLElement;
    expect(badge).toBeNull();
  });
});
