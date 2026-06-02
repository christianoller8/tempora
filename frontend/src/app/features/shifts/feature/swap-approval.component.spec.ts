import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SwapApprovalComponent } from './swap-approval.component';
import { ShiftsApi } from '../data-access/shifts.api';
import type { SwapRequest, RuleCheckResult } from '../data-access/shifts.api';

const mockSwap: SwapRequest = {
  id: 'swap-1',
  organizationId: 'org-1',
  requesterAssignmentId: 'assign-req',
  targetAssignmentId: 'assign-tgt',
  status: 'REQUESTED',
  reason: null,
  approverId: null,
  decidedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockWarnings: RuleCheckResult[] = [
  { type: 'warn', code: 'MAX_DAILY_9H', message: 'Daily hours warning' },
];

function createMockApi(overrides: Partial<InstanceType<typeof ShiftsApi>> = {}): Partial<InstanceType<typeof ShiftsApi>> {
  return {
    listSwaps: () => of([mockSwap]),
    approveSwap: () => of({ swap: { ...mockSwap, status: 'APPROVED' as const }, warnings: [] }),
    rejectSwap: () => of(undefined),
    ...overrides,
  };
}

describe('SwapApprovalComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SwapApprovalComponent],
      providers: [
        { provide: ShiftsApi, useValue: createMockApi() },
      ],
    }).compileComponents();
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(SwapApprovalComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads pending swaps on init', () => {
    const fixture = TestBed.createComponent(SwapApprovalComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance['pendingSwaps']()).toHaveSize(1);
  });

  it('approve() removes swap from list on success', () => {
    const fixture = TestBed.createComponent(SwapApprovalComponent);
    fixture.detectChanges();

    fixture.componentInstance['approve']('swap-1');
    fixture.detectChanges();

    expect(fixture.componentInstance['pendingSwaps']()).toHaveSize(0);
  });

  it('approve() shows warnings when rule engine returns warn violations', () => {
    TestBed.overrideProvider(ShiftsApi, {
      useValue: createMockApi({
        approveSwap: () => of({ swap: { ...mockSwap, status: 'APPROVED' as const }, warnings: mockWarnings }),
      }),
    });
    const fixture = TestBed.createComponent(SwapApprovalComponent);
    fixture.detectChanges();

    fixture.componentInstance['approve']('swap-1');
    fixture.detectChanges();

    expect(fixture.componentInstance['violations']()).toHaveSize(1);
  });

  it('approve() sets error on HTTP error', () => {
    TestBed.overrideProvider(ShiftsApi, {
      useValue: createMockApi({
        approveSwap: () => throwError(() => new Error('Network error')),
      }),
    });
    const fixture = TestBed.createComponent(SwapApprovalComponent);
    fixture.detectChanges();

    fixture.componentInstance['approve']('swap-1');
    fixture.detectChanges();

    expect(fixture.componentInstance['error']()).toBeTruthy();
  });

  it('reject() removes swap from list on success', () => {
    const fixture = TestBed.createComponent(SwapApprovalComponent);
    fixture.detectChanges();

    fixture.componentInstance['reject']('swap-1');
    fixture.detectChanges();

    expect(fixture.componentInstance['pendingSwaps']()).toHaveSize(0);
  });

  it('clearViolations() resets violations signal', () => {
    const fixture = TestBed.createComponent(SwapApprovalComponent);
    fixture.detectChanges();

    fixture.componentInstance['violations'].set(mockWarnings);
    fixture.componentInstance['clearViolations']();

    expect(fixture.componentInstance['violations']()).toHaveSize(0);
  });
});
