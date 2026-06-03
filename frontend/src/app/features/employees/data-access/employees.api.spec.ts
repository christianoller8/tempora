import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EmployeesApi, CentersApi } from './employees.api';
import type { EmployeeDto, CreateEmployeeDto, UpdateEmployeeDto, CenterDto } from './employees.api';
import { API_BASE_URL } from '../../../core/http/api.tokens';

const BASE = 'http://localhost:3000';

const mockEmployee: EmployeeDto = {
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
};

const mockCenter: CenterDto = {
  id: 'center-1',
  name: 'Centro Norte',
};

describe('EmployeesApi', () => {
  let api: EmployeesApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        EmployeesApi,
      ],
    });

    api = TestBed.inject(EmployeesApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('list()', () => {
    it('sends GET /employees and returns bare array (no .data unwrap)', () => {
      const employees = [mockEmployee];
      let result: EmployeeDto[] | undefined;

      api.list().subscribe((res) => {
        result = res;
      });

      const req = httpMock.expectOne(`${BASE}/employees`);
      expect(req.request.method).toBe('GET');
      req.flush(employees);

      // AC-EMP-18: result is the bare array, not wrapped in { data: [...] }
      expect(result).toEqual(employees);
      expect(Array.isArray(result)).toBe(true);
    });

    it('sends ?activeOnly=true when param is set', () => {
      api.list({ activeOnly: true }).subscribe();

      const req = httpMock.expectOne(`${BASE}/employees?activeOnly=true`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getById()', () => {
    it('sends GET /employees/:id and returns single EmployeeDto', () => {
      let result: EmployeeDto | undefined;

      api.getById('emp-1').subscribe((res) => {
        result = res;
      });

      const req = httpMock.expectOne(`${BASE}/employees/emp-1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockEmployee);

      expect(result).toEqual(mockEmployee);
    });
  });

  describe('create()', () => {
    it('sends POST /employees with body and returns EmployeeDto', () => {
      const dto: CreateEmployeeDto = {
        firstName: 'Ana',
        lastName: 'García',
        category: 'ENFERMERO',
        contractType: 'INDEFINIDO',
        contractedHoursPerWeek: 40,
        primaryCenterId: 'center-1',
        hireDate: '2023-01-15',
      };
      let result: EmployeeDto | undefined;

      api.create(dto).subscribe((res) => {
        result = res;
      });

      const req = httpMock.expectOne(`${BASE}/employees`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush(mockEmployee);

      expect(result).toEqual(mockEmployee);
    });
  });

  describe('update()', () => {
    it('sends PATCH /employees/:id with body and returns EmployeeDto', () => {
      const dto: UpdateEmployeeDto = { firstName: 'Ana Maria' };
      let result: EmployeeDto | undefined;

      api.update('emp-1', dto).subscribe((res) => {
        result = res;
      });

      const req = httpMock.expectOne(`${BASE}/employees/emp-1`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(dto);
      req.flush({ ...mockEmployee, firstName: 'Ana Maria' });

      expect(result?.firstName).toBe('Ana Maria');
    });
  });

  describe('terminate()', () => {
    it('sends POST /employees/:id/terminate and returns void (no body assertion)', () => {
      let completed = false;

      api.terminate('emp-1').subscribe(() => {
        completed = true;
      });

      const req = httpMock.expectOne(`${BASE}/employees/emp-1/terminate`);
      expect(req.request.method).toBe('POST');
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(completed).toBe(true);
    });
  });
});

describe('CentersApi', () => {
  let api: CentersApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        CentersApi,
      ],
    });

    api = TestBed.inject(CentersApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('sends GET /centers and returns bare CenterDto array', () => {
    const centers = [mockCenter];
    let result: CenterDto[] | undefined;

    api.list().subscribe((res) => {
      result = res;
    });

    const req = httpMock.expectOne(`${BASE}/centers`);
    expect(req.request.method).toBe('GET');
    req.flush(centers);

    expect(result).toEqual(centers);
    expect(Array.isArray(result)).toBe(true);
  });
});
