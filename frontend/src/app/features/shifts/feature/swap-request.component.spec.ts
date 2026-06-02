import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { of, throwError } from 'rxjs';
import { SwapRequestComponent } from './swap-request.component';
import { ShiftsApi } from '../data-access/shifts.api';
import type { SwapRequest } from '../data-access/shifts.api';

const mockSwap: SwapRequest = {
  id: 'swap-1',
  organizationId: 'org-1',
  requesterAssignmentId: 'assign-req',
  targetAssignmentId: 'assign-tgt',
  status: 'REQUESTED',
  reason: 'Family event',
  approverId: null,
  decidedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function createMockApi(overrides: Partial<InstanceType<typeof ShiftsApi>> = {}): Partial<InstanceType<typeof ShiftsApi>> {
  return {
    listSwaps: () => of([]),
    requestSwap: () => of(mockSwap),
    ...overrides,
  };
}

describe('SwapRequestComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SwapRequestComponent],
      providers: [
        { provide: ShiftsApi, useValue: createMockApi() },
      ],
    }).compileComponents();
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(SwapRequestComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads pending swaps on init', () => {
    const api = TestBed.inject(ShiftsApi);
    const listSwapsSpy = vi.spyOn(api, 'listSwaps');
    const fixture = TestBed.createComponent(SwapRequestComponent);
    fixture.detectChanges();
    expect(listSwapsSpy).toHaveBeenCalledWith({ status: 'REQUESTED' });
  });

  it('submit() calls api.requestSwap with form values', () => {
    const api = TestBed.inject(ShiftsApi);
    const requestSwapSpy = vi.spyOn(api, 'requestSwap').mockReturnValue(of(mockSwap));
    const fixture = TestBed.createComponent(SwapRequestComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component['swapForm'].patchValue({
      requesterAssignmentId: 'assign-req',
      targetAssignmentId: 'assign-tgt',
      reason: 'Family event',
    });

    component['submit']();
    expect(requestSwapSpy).toHaveBeenCalledWith({
      requesterAssignmentId: 'assign-req',
      targetAssignmentId: 'assign-tgt',
      reason: 'Family event',
    });
  });

  it('shows success message after successful submission', () => {
    TestBed.overrideProvider(ShiftsApi, { useValue: createMockApi({ requestSwap: () => of(mockSwap) }) });
    const fixture = TestBed.createComponent(SwapRequestComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component['swapForm'].patchValue({ requesterAssignmentId: 'assign-req' });
    component['submit']();
    fixture.detectChanges();

    expect(component['successMessage']()).toBe('Swap request submitted successfully.');
  });

  it('shows error message on failed submission', () => {
    TestBed.overrideProvider(ShiftsApi, {
      useValue: createMockApi({ requestSwap: () => throwError(() => new Error('Network error')) }),
    });
    const fixture = TestBed.createComponent(SwapRequestComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component['swapForm'].patchValue({ requesterAssignmentId: 'assign-req' });
    component['submit']();
    fixture.detectChanges();

    expect(component['errorMessage']()).toBeTruthy();
  });

  it('does not submit when form is invalid (missing required field)', () => {
    const api = TestBed.inject(ShiftsApi);
    const requestSwapSpy = vi.spyOn(api, 'requestSwap');
    const fixture = TestBed.createComponent(SwapRequestComponent);
    fixture.detectChanges();

    // Form is invalid — requesterAssignmentId not set.
    fixture.componentInstance['submit']();
    expect(requestSwapSpy).not.toHaveBeenCalled();
  });
});
