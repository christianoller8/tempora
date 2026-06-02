import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AbsenceRequestComponent } from './absence-request.component';
import { AbsencesStore } from '../data-access/absences.store';

describe('AbsenceRequestComponent', () => {
  let storeSpy: {
    loading: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    createAbsence: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    storeSpy = {
      loading: vi.fn().mockReturnValue(false),
      error: vi.fn().mockReturnValue(null),
      createAbsence: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      imports: [AbsenceRequestComponent],
      providers: [{ provide: AbsencesStore, useValue: storeSpy }],
    });
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(AbsenceRequestComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the absence type selector', () => {
    const fixture = TestBed.createComponent(AbsenceRequestComponent);
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('#type') as HTMLSelectElement;
    expect(select).toBeTruthy();
  });

  it('shows cause textarea only when type is IT', async () => {
    const fixture = TestBed.createComponent(AbsenceRequestComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    // Default is VACACIONES — no cause field.
    expect(fixture.nativeElement.querySelector('#cause')).toBeNull();

    // Change to IT.
    component['form'].controls.type.setValue('IT');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('#cause')).toBeTruthy();
  });

  it('calls store.createAbsence on valid submit', async () => {
    const fixture = TestBed.createComponent(AbsenceRequestComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component['form'].setValue({
      type: 'VACACIONES',
      startDate: '2026-06-10',
      endDate: '2026-06-14',
      cause: '',
    });

    await component['onSubmit']();
    expect(storeSpy.createAbsence).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'VACACIONES', startDate: '2026-06-10' }),
    );
  });

  it('does not submit when form is invalid', async () => {
    const fixture = TestBed.createComponent(AbsenceRequestComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    // Leave dates empty (required).
    component['form'].controls.startDate.setValue('');
    component['form'].controls.endDate.setValue('');

    await component['onSubmit']();
    expect(storeSpy.createAbsence).not.toHaveBeenCalled();
  });
});
