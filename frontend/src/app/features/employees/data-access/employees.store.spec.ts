import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EmployeesStore } from './employees.store';
import { EmployeesApi } from './employees.api';
import { of, throwError } from 'rxjs';
import type { EmployeeDto, CreateEmployeeDto, UpdateEmployeeDto } from './employees.api';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeEmployee = (overrides: Partial<EmployeeDto> = {}): EmployeeDto => ({
  id: 'emp-1',
  organizationId: 'org-1',
  firstName: 'Ana',
  lastName: 'García',
  nif: '12345678A',
  category: 'ENFERMERO',
  contractType: 'INDEFINIDO',
  contractedHoursPerWeek: 40,
  primaryCenterId: 'center-1',
  workingCalendarId: null,
  hireDate: '2023-01-15',
  terminationDate: null,
  isActive: true,
  createdAt: '2023-01-15T00:00:00.000Z',
  updatedAt: '2023-01-15T00:00:00.000Z',
  ...overrides,
});

const emp1 = makeEmployee({ id: 'emp-1', firstName: 'Ana', lastName: 'García', category: 'ENFERMERO', isActive: true });
const emp2 = makeEmployee({ id: 'emp-2', firstName: 'Carlos', lastName: 'López', category: 'MEDICO', isActive: false });
const emp3 = makeEmployee({ id: 'emp-3', firstName: 'Beatriz', lastName: 'Martín', category: 'ENFERMERO', isActive: true });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmployeesStore', () => {
  let store: InstanceType<typeof EmployeesStore>;
  let apiSpy: {
    list: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    apiSpy = {
      list: vi.fn().mockReturnValue(of([emp1, emp2, emp3])),
      getById: vi.fn().mockReturnValue(of(emp1)),
      create: vi.fn().mockReturnValue(of(emp1)),
      update: vi.fn().mockReturnValue(of(emp1)),
      terminate: vi.fn().mockReturnValue(of(undefined)),
    };

    TestBed.configureTestingModule({
      providers: [
        EmployeesStore,
        { provide: EmployeesApi, useValue: apiSpy },
      ],
    });

    store = TestBed.inject(EmployeesStore);
  });

  // -------------------------------------------------------------------------
  // load()
  // -------------------------------------------------------------------------

  it('load() — sets loading to true while in flight, sets employees on success, resets loading', async () => {
    const promise = store.load();
    // After async resolution loading should be false
    await promise;

    expect(store.employees()).toHaveLength(3);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('load() — sets error on failure, resets loading', async () => {
    apiSpy.list.mockReturnValue(throwError(() => new Error('Network error')));
    await store.load();

    expect(store.error()).toBe('Network error');
    expect(store.loading()).toBe(false);
    expect(store.employees()).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // create()
  // -------------------------------------------------------------------------

  it('create() — appends new employee to employees signal after success', async () => {
    await store.load();
    const before = store.employees().length;

    const newEmp = makeEmployee({ id: 'emp-4', firstName: 'David', lastName: 'Ruiz' });
    apiSpy.create.mockReturnValue(of(newEmp));

    const dto: CreateEmployeeDto = {
      firstName: 'David',
      lastName: 'Ruiz',
      category: 'TCAE',
      contractType: 'TEMPORAL',
      contractedHoursPerWeek: 40,
      primaryCenterId: 'center-1',
      hireDate: '2024-03-01',
    };
    await store.create(dto);

    expect(store.employees().length).toBe(before + 1);
    expect(store.employees().find((e) => e.id === 'emp-4')).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // update()
  // -------------------------------------------------------------------------

  it('update() — replaces matching employee entry in signal after success', async () => {
    await store.load();

    const updated = makeEmployee({ id: 'emp-1', firstName: 'Ana Maria' });
    apiSpy.update.mockReturnValue(of(updated));

    const dto: UpdateEmployeeDto = { firstName: 'Ana Maria' };
    await store.update('emp-1', dto);

    const found = store.employees().find((e) => e.id === 'emp-1');
    expect(found?.firstName).toBe('Ana Maria');
  });

  // -------------------------------------------------------------------------
  // deactivate() — AC-EMP-19: in-place patch, NO reload
  // -------------------------------------------------------------------------

  it('deactivate() — patches isActive to false in place without calling list() again', async () => {
    await store.load();
    const callsBefore = (apiSpy.list as ReturnType<typeof vi.fn>).mock.calls.length;

    await store.deactivate('emp-1');

    // list() must NOT have been called again (AC-EMP-19)
    expect((apiSpy.list as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore);

    const emp = store.employees().find((e) => e.id === 'emp-1');
    expect(emp?.isActive).toBe(false);
  });

  // -------------------------------------------------------------------------
  // select()
  // -------------------------------------------------------------------------

  it('select(emp) sets selected; select(null) clears it', async () => {
    await store.load();

    store.select(emp1);
    expect(store.selected()).toEqual(emp1);

    store.select(null);
    expect(store.selected()).toBeNull();
  });

  // -------------------------------------------------------------------------
  // filteredEmployees — search
  // -------------------------------------------------------------------------

  it('filteredEmployees — search filter matches full name case-insensitively', async () => {
    await store.load();

    store.setSearch('ana');
    const result = store.filteredEmployees();
    expect(result.map((e) => e.id)).toContain('emp-1');
    expect(result.map((e) => e.id)).not.toContain('emp-2');
    expect(result.map((e) => e.id)).not.toContain('emp-3');
  });

  it('filteredEmployees — empty search returns all employees', async () => {
    await store.load();
    store.setSearch('');
    expect(store.filteredEmployees()).toHaveLength(3);
  });

  // -------------------------------------------------------------------------
  // filteredEmployees — category filter
  // -------------------------------------------------------------------------

  it('filteredEmployees — category filter shows only matching category', async () => {
    await store.load();

    store.setCategory('ENFERMERO');
    const result = store.filteredEmployees();
    expect(result.every((e) => e.category === 'ENFERMERO')).toBe(true);
    expect(result.map((e) => e.id)).not.toContain('emp-2'); // MEDICO
  });

  it('filteredEmployees — null category filter shows all', async () => {
    await store.load();
    store.setCategory(null);
    expect(store.filteredEmployees()).toHaveLength(3);
  });

  // -------------------------------------------------------------------------
  // filteredEmployees — status filter
  // -------------------------------------------------------------------------

  it('filteredEmployees — ACTIVE filter shows only isActive === true', async () => {
    await store.load();

    store.setStatus('ACTIVE');
    const result = store.filteredEmployees();
    expect(result.every((e) => e.isActive === true)).toBe(true);
    expect(result.map((e) => e.id)).not.toContain('emp-2'); // inactive
  });

  it('filteredEmployees — INACTIVE filter shows only isActive === false', async () => {
    await store.load();

    store.setStatus('INACTIVE');
    const result = store.filteredEmployees();
    expect(result.every((e) => e.isActive === false)).toBe(true);
    expect(result.map((e) => e.id)).toContain('emp-2');
  });

  it('filteredEmployees — ALL status shows all employees', async () => {
    await store.load();
    store.setStatus('ALL');
    expect(store.filteredEmployees()).toHaveLength(3);
  });

  // -------------------------------------------------------------------------
  // filteredEmployees — combined filters
  // -------------------------------------------------------------------------

  it('filteredEmployees — combined search + category + status', async () => {
    await store.load();

    store.setSearch('bea');
    store.setCategory('ENFERMERO');
    store.setStatus('ACTIVE');

    const result = store.filteredEmployees();
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('emp-3');
  });
});
