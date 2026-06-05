import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ReportsApi } from './reports.api';
import { API_BASE_URL } from '../../../core/http/api.tokens';

describe('ReportsApi — downloadTimeEntries', () => {
  let api: ReportsApi;
  let httpMock: HttpTestingController;
  let downloadSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ReportsApi,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    });
    api = TestBed.inject(ReportsApi);
    httpMock = TestBed.inject(HttpTestingController);
    downloadSpy = vi.spyOn(api, 'downloadReport').mockImplementation(() => undefined);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  it('POSTs to /reports/time-entries/pdf for pdf format', () => {
    let completed = false;
    api.downloadTimeEntries({ from: '2025-01-01', to: '2025-01-31', format: 'pdf' })
      .subscribe(() => { completed = true; });

    const req = httpMock.expectOne('http://localhost:3000/reports/time-entries/pdf');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ from: '2025-01-01', to: '2025-01-31' });
    expect(req.request.withCredentials).toBe(true);
    req.flush(new Blob(['%PDF'], { type: 'application/pdf' }));

    expect(completed).toBe(true);
    expect(downloadSpy).toHaveBeenCalledWith(
      expect.any(Blob),
      'time-entries-2025-01-01-2025-01-31.pdf',
    );
  });

  it('POSTs to /reports/time-entries/excel for excel format', () => {
    let completed = false;
    api.downloadTimeEntries({ from: '2025-01-01', to: '2025-01-31', format: 'excel' })
      .subscribe(() => { completed = true; });

    const req = httpMock.expectOne('http://localhost:3000/reports/time-entries/excel');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ from: '2025-01-01', to: '2025-01-31' });
    expect(req.request.withCredentials).toBe(true);
    req.flush(new Blob(['PK'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));

    expect(completed).toBe(true);
    expect(downloadSpy).toHaveBeenCalledWith(
      expect.any(Blob),
      'time-entries-2025-01-01-2025-01-31.xlsx',
    );
  });

  it('includes employeeId in body when provided', () => {
    api.downloadTimeEntries({ from: '2025-01-01', to: '2025-01-31', format: 'pdf', employeeId: 'emp-123' })
      .subscribe();

    const req = httpMock.expectOne('http://localhost:3000/reports/time-entries/pdf');
    expect(req.request.body).toEqual({ from: '2025-01-01', to: '2025-01-31', employeeId: 'emp-123' });
    req.flush(new Blob());
  });

  it('omits employeeId from body when not provided', () => {
    api.downloadTimeEntries({ from: '2025-01-01', to: '2025-01-31', format: 'pdf' })
      .subscribe();

    const req = httpMock.expectOne('http://localhost:3000/reports/time-entries/pdf');
    expect(req.request.body).not.toHaveProperty('employeeId');
    req.flush(new Blob());
  });
});

describe('ReportsApi — downloadSchedule', () => {
  let api: ReportsApi;
  let httpMock: HttpTestingController;
  let downloadSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ReportsApi,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    });
    api = TestBed.inject(ReportsApi);
    httpMock = TestBed.inject(HttpTestingController);
    downloadSpy = vi.spyOn(api, 'downloadReport').mockImplementation(() => undefined);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  it('POSTs to /reports/schedule/pdf with year and month', () => {
    let completed = false;
    api.downloadSchedule({ year: 2025, month: 6 })
      .subscribe(() => { completed = true; });

    const req = httpMock.expectOne('http://localhost:3000/reports/schedule/pdf');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ year: 2025, month: 6 });
    expect(req.request.withCredentials).toBe(true);
    req.flush(new Blob(['%PDF'], { type: 'application/pdf' }));

    expect(completed).toBe(true);
    expect(downloadSpy).toHaveBeenCalledWith(
      expect.any(Blob),
      'schedule-2025-6.pdf',
    );
  });

  it('includes employeeId in body when provided', () => {
    api.downloadSchedule({ year: 2025, month: 6, employeeId: 'emp-456' })
      .subscribe();

    const req = httpMock.expectOne('http://localhost:3000/reports/schedule/pdf');
    expect(req.request.body).toEqual({ year: 2025, month: 6, employeeId: 'emp-456' });
    req.flush(new Blob());
  });

  it('omits employeeId from body when not provided', () => {
    api.downloadSchedule({ year: 2025, month: 12 })
      .subscribe();

    const req = httpMock.expectOne('http://localhost:3000/reports/schedule/pdf');
    expect(req.request.body).not.toHaveProperty('employeeId');
    req.flush(new Blob());
  });
});
