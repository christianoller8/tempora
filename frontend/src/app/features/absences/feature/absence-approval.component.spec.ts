import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AbsenceApprovalComponent } from './absence-approval.component';
import { AbsencesStore } from '../data-access/absences.store';
import { signal } from '@angular/core';

describe('AbsenceApprovalComponent', () => {
  const pendingAbsence = {
    id: 'abs-1',
    employeeId: 'emp-1',
    type: 'VACACIONES' as const,
    startDate: '2026-06-10',
    endDate: '2026-06-14',
    status: 'PENDING' as const,
  };

  let storeSpy: {
    loading: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    absences: ReturnType<typeof vi.fn>;
    loadAbsences: ReturnType<typeof vi.fn>;
    approveAbsence: ReturnType<typeof vi.fn>;
    rejectAbsence: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    storeSpy = {
      loading: vi.fn().mockReturnValue(false),
      error: vi.fn().mockReturnValue(null),
      absences: vi.fn().mockReturnValue([pendingAbsence]),
      loadAbsences: vi.fn().mockResolvedValue(undefined),
      approveAbsence: vi.fn().mockResolvedValue(undefined),
      rejectAbsence: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      imports: [AbsenceApprovalComponent],
      providers: [{ provide: AbsencesStore, useValue: storeSpy }],
    });
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(AbsenceApprovalComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('calls loadAbsences with PENDING filter on init', () => {
    const fixture = TestBed.createComponent(AbsenceApprovalComponent);
    fixture.detectChanges();
    expect(storeSpy.loadAbsences).toHaveBeenCalledWith({ status: 'PENDING' });
  });

  it('displays pending absences in table', () => {
    const fixture = TestBed.createComponent(AbsenceApprovalComponent);
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('tbody tr') as NodeList;
    expect(rows.length).toBe(1);
  });

  it('calls approveAbsence when approve button clicked', async () => {
    const fixture = TestBed.createComponent(AbsenceApprovalComponent);
    fixture.detectChanges();

    const approveBtn = fixture.nativeElement.querySelector('button[aria-label*="Approve"]') as HTMLButtonElement;
    approveBtn.click();
    await fixture.whenStable();

    expect(storeSpy.approveAbsence).toHaveBeenCalledWith('abs-1');
  });

  it('calls rejectAbsence when reject button clicked', async () => {
    const fixture = TestBed.createComponent(AbsenceApprovalComponent);
    fixture.detectChanges();

    const rejectBtn = fixture.nativeElement.querySelector('button[aria-label*="Reject"]') as HTMLButtonElement;
    rejectBtn.click();
    await fixture.whenStable();

    expect(storeSpy.rejectAbsence).toHaveBeenCalledWith('abs-1');
  });

  it('shows empty state when no pending absences', () => {
    storeSpy.absences.mockReturnValue([]);
    const fixture = TestBed.createComponent(AbsenceApprovalComponent);
    fixture.detectChanges();
    const empty = fixture.nativeElement.querySelector('p') as HTMLElement;
    expect(empty?.textContent).toContain('No pending');
  });
});
