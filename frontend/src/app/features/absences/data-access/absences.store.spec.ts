import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AbsencesStore } from './absences.store';
import { AbsencesApi } from './absences.api';
import { of, throwError } from 'rxjs';
import type { AbsenceDto, AbsenceBalanceDto } from './absences.api';

const mockAbsence: AbsenceDto = {
  id: 'abs-1',
  employeeId: 'emp-1',
  type: 'VACACIONES',
  startDate: '2026-06-10',
  endDate: '2026-06-14',
  status: 'PENDING',
};

const mockBalance: AbsenceBalanceDto = { entitled: 22, used: 5, remaining: 17 };

describe('AbsencesStore', () => {
  let store: InstanceType<typeof AbsencesStore>;
  let apiSpy: {
    listAbsences: ReturnType<typeof vi.fn>;
    createAbsence: ReturnType<typeof vi.fn>;
    approveAbsence: ReturnType<typeof vi.fn>;
    rejectAbsence: ReturnType<typeof vi.fn>;
    getBalance: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    apiSpy = {
      listAbsences: vi.fn().mockReturnValue(of([mockAbsence])),
      createAbsence: vi.fn().mockReturnValue(of(mockAbsence)),
      approveAbsence: vi.fn().mockReturnValue(of({ ...mockAbsence, status: 'APPROVED' })),
      rejectAbsence: vi.fn().mockReturnValue(of({ ...mockAbsence, status: 'REJECTED' })),
      getBalance: vi.fn().mockReturnValue(of(mockBalance)),
    };

    TestBed.configureTestingModule({
      providers: [
        AbsencesStore,
        { provide: AbsencesApi, useValue: apiSpy },
      ],
    });

    store = TestBed.inject(AbsencesStore);
  });

  it('loads absences and updates state', async () => {
    await store.loadAbsences();
    expect(store.absences()).toHaveLength(1);
    expect(store.absences()[0]?.id).toBe('abs-1');
    expect(store.loading()).toBe(false);
  });

  it('creates absence and prepends to list', async () => {
    await store.loadAbsences();
    const before = store.absences().length;
    await store.createAbsence({ type: 'VACACIONES', startDate: '2026-07-01', endDate: '2026-07-05' });
    expect(store.absences().length).toBe(before + 1);
  });

  it('approves absence and updates status in list', async () => {
    await store.loadAbsences();
    await store.approveAbsence('abs-1');
    const absence = store.absences().find((a) => a.id === 'abs-1');
    expect(absence?.status).toBe('APPROVED');
  });

  it('rejects absence and updates status in list', async () => {
    await store.loadAbsences();
    await store.rejectAbsence('abs-1');
    const absence = store.absences().find((a) => a.id === 'abs-1');
    expect(absence?.status).toBe('REJECTED');
  });

  it('loads balance and updates balance signal', async () => {
    await store.loadBalance('emp-1', 2026);
    expect(store.balance()).toEqual(mockBalance);
    expect(store.remainingDays()).toBe(17);
    expect(store.isBalanceLoaded()).toBe(true);
  });

  it('sets error state when loadAbsences fails', async () => {
    apiSpy.listAbsences.mockReturnValue(throwError(() => new Error('Network error')));
    await store.loadAbsences();
    expect(store.error()).toBe('Network error');
    expect(store.loading()).toBe(false);
  });
});
