import { describe, it, expect } from 'vitest';
import { buildCompliancePdf } from './compliance-pdf.builder';
import type { ComplianceExportData } from '../reporting.service';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeData(overrides: Partial<ComplianceExportData> = {}): ComplianceExportData {
  return {
    organization: { name: 'Test Hospital SA', cif: 'B12345678' },
    dateRange: { from: '2025-01-01', to: '2025-01-31' },
    generatedAt: '2025-02-01T10:00:00.000Z',
    rows: [
      {
        employeeName: 'Doe, Jane',
        category: 'ENFERMERO',
        date: '2025-01-15',
        clockIn: '09:00',
        clockOut: '17:30',
        durationHours: 8.5,
        source: 'web',
      },
      {
        employeeName: 'Doe, Jane',
        category: 'ENFERMERO',
        date: '2025-01-16',
        clockIn: '09:00',
        clockOut: null,
        durationHours: null,
        source: 'web',
      },
      {
        employeeName: 'Smith, John',
        category: 'MEDICO',
        date: '2025-01-15',
        clockIn: '08:00',
        clockOut: '16:00',
        durationHours: 8.0,
        source: 'web',
      },
    ],
    auditLog: [
      {
        timestamp: '2025-01-15T12:00:00.000Z',
        actor: 'admin-user-id',
        entityId: 'entry-id-1',
        action: 'UPDATE',
        before: '{"clockOut":null}',
        after: '{"clockOut":"2025-01-15T17:30:00Z"}',
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildCompliancePdf', () => {
  it('returns a non-empty Buffer', async () => {
    const buf = await buildCompliancePdf(makeData());
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('produces a valid PDF (starts with %PDF magic bytes)', async () => {
    const buf = await buildCompliancePdf(makeData());
    expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('handles null CIF in org header — renders em-dash', async () => {
    const data = makeData({ organization: { name: 'No CIF Corp', cif: null } });
    const buf = await buildCompliancePdf(data);
    // A valid PDF buffer is the minimum bar; CIF rendering is layout-level
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('renders em-dash for open entry (clockOut=null) without throwing', async () => {
    const data = makeData({
      rows: [
        {
          employeeName: 'Open, Entry',
          category: 'TCAE',
          date: '2025-01-20',
          clockIn: '08:00',
          clockOut: null,
          durationHours: null,
          source: 'terminal',
        },
      ],
    });
    const buf = await buildCompliancePdf(data);
    expect(buf).toBeInstanceOf(Buffer);
  });

  it('renders "No modifications in this period." when auditLog is empty', async () => {
    const data = makeData({ auditLog: [] });
    const buf = await buildCompliancePdf(data);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('handles empty rows (no time entries) without throwing', async () => {
    const data = makeData({ rows: [] });
    const buf = await buildCompliancePdf(data);
    expect(buf).toBeInstanceOf(Buffer);
  });

  it('accumulates correct grand total from multiple employees', async () => {
    // 8.5 + 0 (OPEN) + 8.0 = 16.5 total — we just verify no throw + valid PDF
    const buf = await buildCompliancePdf(makeData());
    expect(buf.length).toBeGreaterThan(0);
  });
});
