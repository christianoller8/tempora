import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { TimesheetStore } from './timesheet.store';
import { TimesheetApi } from './timesheet.api';
import type { TimesheetSummaryDto, TimesheetSignatureDto, ConfirmationStatusRowDto } from './timesheet.api';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockSummaryPending: TimesheetSummaryDto = {
  year: 2026,
  month: 3,
  employeeId: 'emp-1',
  hours: { regularHours: 168, overtimeHours: 4.5, partTimeDeviation: 0 },
  confirmed: false,
  confirmedAt: null,
  hasOpenEntry: false,
  totalAbsenceDays: 0,
};

const mockSummaryWithOpenEntry: TimesheetSummaryDto = {
  ...mockSummaryPending,
  hasOpenEntry: true,
};

const mockSummaryConfirmed: TimesheetSummaryDto = {
  ...mockSummaryPending,
  confirmed: true,
  confirmedAt: '2026-03-31T18:00:00Z',
};

const mockSignature: TimesheetSignatureDto = {
  id: 'sig-1',
  employeeId: 'emp-1',
  year: 2026,
  month: 3,
  confirmedAt: '2026-03-31T18:00:00Z',
  alreadyConfirmed: false,
};

const mockStatusRows: ConfirmationStatusRowDto[] = [
  { employeeId: 'emp-1', firstName: 'Ana', lastName: 'Garcia', confirmed: true, confirmedAt: '2026-03-31T18:00:00Z' },
  { employeeId: 'emp-2', firstName: 'Luis', lastName: 'Lopez', confirmed: false, confirmedAt: null },
];

// ---------------------------------------------------------------------------
// Tests (written BEFORE implementation — TDD RED phase)
// ---------------------------------------------------------------------------

describe('TimesheetStore', () => {
  let getSummarySpy: ReturnType<typeof vi.fn>;
  let confirmMonthSpy: ReturnType<typeof vi.fn>;
  let getConfirmationStatusSpy: ReturnType<typeof vi.fn>;

  function setupTestBed(): TimesheetStore {
    const apiSpy = {
      getSummary: getSummarySpy,
      confirmMonth: confirmMonthSpy,
      getConfirmationStatus: getConfirmationStatusSpy,
    };

    TestBed.configureTestingModule({
      providers: [
        TimesheetStore,
        { provide: TimesheetApi, useValue: apiSpy },
      ],
    });

    return TestBed.inject(TimesheetStore) as unknown as TimesheetStore;
  }

  beforeEach(() => {
    getSummarySpy = vi.fn().mockReturnValue(of(mockSummaryPending));
    confirmMonthSpy = vi.fn().mockReturnValue(of(mockSignature));
    getConfirmationStatusSpy = vi.fn().mockReturnValue(of(mockStatusRows));
  });

  afterEach(() => TestBed.resetTestingModule());

  // ── Initial state ───────────────────────────────────────────────────────

  it('starts with null summary and empty status list', () => {
    const store = setupTestBed();
    expect(store.summary()).toBeNull();
    expect(store.statusList()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  // ── isConfirmed computed ────────────────────────────────────────────────

  it('isConfirmed is false when summary is null', () => {
    const store = setupTestBed();
    expect(store.isConfirmed()).toBe(false);
  });

  it('isConfirmed reflects summary.confirmed', async () => {
    getSummarySpy.mockReturnValue(of(mockSummaryConfirmed));
    const store = setupTestBed();
    await store.loadSummary(2026, 3);
    expect(store.isConfirmed()).toBe(true);
  });

  // ── canConfirm computed ─────────────────────────────────────────────────

  it('canConfirm is false when isConfirmed is true', async () => {
    getSummarySpy.mockReturnValue(of(mockSummaryConfirmed));
    const store = setupTestBed();
    await store.loadSummary(2026, 3);
    expect(store.canConfirm()).toBe(false);
  });

  it('canConfirm is false when hasOpenEntry is true', async () => {
    getSummarySpy.mockReturnValue(of(mockSummaryWithOpenEntry));
    const store = setupTestBed();
    await store.loadSummary(2026, 3);
    expect(store.canConfirm()).toBe(false);
  });

  it('canConfirm is true when not confirmed and no open entry', async () => {
    const store = setupTestBed();
    await store.loadSummary(2026, 3);
    expect(store.canConfirm()).toBe(true);
  });

  // ── loadSummary ─────────────────────────────────────────────────────────

  it('loadSummary success: populates summary and clears loading', async () => {
    const store = setupTestBed();
    await store.loadSummary(2026, 3);
    expect(store.summary()).toEqual(mockSummaryPending);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('loadSummary error: sets error state and clears loading', async () => {
    getSummarySpy.mockReturnValue(throwError(() => new Error('Network error')));
    const store = setupTestBed();
    await store.loadSummary(2026, 3);
    expect(store.summary()).toBeNull();
    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('Network error');
  });

  // ── confirmMonth ────────────────────────────────────────────────────────

  it('confirmMonth success: sets isConfirmed to true via summary patch', async () => {
    const store = setupTestBed();
    await store.loadSummary(2026, 3);
    expect(store.isConfirmed()).toBe(false);
    expect(store.confirmedOverride()).toBeNull(); // confirmedOverride starts null
    await store.confirmMonth(2026, 3);
    // confirmedOverride should be true after successful confirm
    expect(store.confirmedOverride()).toBe(true);
    // isConfirmed derives from confirmedOverride OR summary.confirmed
    expect(store.isConfirmed()).toBe(true);
    expect(store.loading()).toBe(false);
  });

  it('confirmMonth idempotent (alreadyConfirmed=true): still sets isConfirmed to true', async () => {
    const idempotentSig: TimesheetSignatureDto = { ...mockSignature, alreadyConfirmed: true };
    confirmMonthSpy.mockReturnValue(of(idempotentSig));
    const store = setupTestBed();
    await store.loadSummary(2026, 3);
    await store.confirmMonth(2026, 3);
    expect(store.isConfirmed()).toBe(true);
  });

  it('confirmMonth error: sets error, keeps confirmed unchanged', async () => {
    confirmMonthSpy.mockReturnValue(throwError(() => new Error('OPEN_ENTRIES_EXIST')));
    const store = setupTestBed();
    await store.loadSummary(2026, 3);
    try {
      await store.confirmMonth(2026, 3);
    } catch {
      // store re-throws so component can show error toast; catch here to prevent test failure
    }
    expect(store.error()).toBe('OPEN_ENTRIES_EXIST');
    expect(store.isConfirmed()).toBe(false);
    expect(store.loading()).toBe(false);
  });

  // ── loadStatus ──────────────────────────────────────────────────────────

  it('loadStatus success: populates statusList', async () => {
    const store = setupTestBed();
    await store.loadStatus(2026, 3);
    expect(store.statusList()).toHaveLength(2);
    expect(store.statusList()[0]?.firstName).toBe('Ana');
    expect(store.loading()).toBe(false);
  });

  it('loadStatus error: sets error state', async () => {
    getConfirmationStatusSpy.mockReturnValue(throwError(() => new Error('Forbidden')));
    const store = setupTestBed();
    await store.loadStatus(2026, 3);
    expect(store.statusList()).toEqual([]);
    expect(store.error()).toBe('Forbidden');
  });

  // ── loading state ───────────────────────────────────────────────────────

  it('loading starts as false (initial state)', () => {
    const store = setupTestBed();
    expect(store.loading()).toBe(false);
  });
});
