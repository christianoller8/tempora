import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildComplianceXlsx } from './compliance-xlsx.builder';
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
        employeeName: 'Smith, John',
        category: 'MEDICO',
        date: '2025-01-15',
        clockIn: '08:00',
        clockOut: null,
        durationHours: null,
        source: 'terminal',
      },
    ],
    auditLog: [
      {
        timestamp: '2025-01-15T12:00:00.000Z',
        actor: 'admin-1',
        entityId: 'entry-id-1',
        action: 'UPDATE',
        before: '{"x":1}',
        after: '{"x":2}',
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildComplianceXlsx', () => {
  it('returns a non-empty Buffer', async () => {
    const buf = await buildComplianceXlsx(makeData());
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('produces a valid XLSX (readable by ExcelJS)', async () => {
    const buf = await buildComplianceXlsx(makeData());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    expect(wb.worksheets.length).toBe(2);
  });

  it('Sheet 1 is named "Time Entries" (FR-EXP-09)', async () => {
    const buf = await buildComplianceXlsx(makeData());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    expect(wb.getWorksheet('Time Entries')).toBeDefined();
  });

  it('Sheet 2 is named "Audit Log" (FR-EXP-10)', async () => {
    const buf = await buildComplianceXlsx(makeData());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    expect(wb.getWorksheet('Audit Log')).toBeDefined();
  });

  it('Sheet 1 has data rows matching input length', async () => {
    const data = makeData();
    const buf = await buildComplianceXlsx(data);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const sheet = wb.getWorksheet('Time Entries')!;
    // row 1 = header, rows 2..n = data
    expect(sheet.rowCount).toBe(data.rows.length + 1);
  });

  it('Sheet 2 has audit rows matching input length', async () => {
    const data = makeData();
    const buf = await buildComplianceXlsx(data);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const sheet = wb.getWorksheet('Audit Log')!;
    expect(sheet.rowCount).toBe(data.auditLog.length + 1);
  });

  it('null clockOut renders as "—" in Sheet 1 (FR-EXP-09)', async () => {
    const buf = await buildComplianceXlsx(makeData());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const sheet = wb.getWorksheet('Time Entries')!;
    // Row 2 = first entry (Jane Doe — has clockOut), Row 3 = Smith (null clockOut)
    const clockOutCell = sheet.getRow(3).getCell(5); // column 5 = Clock Out
    expect(clockOutCell.value).toBe('—');
  });

  it('null durationHours renders as "—" in Sheet 1', async () => {
    const buf = await buildComplianceXlsx(makeData());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const sheet = wb.getWorksheet('Time Entries')!;
    const durationCell = sheet.getRow(3).getCell(6); // column 6 = Duration (h)
    expect(durationCell.value).toBe('—');
  });

  it('Sheet 1 header row is bold (FR-EXP-11)', async () => {
    const buf = await buildComplianceXlsx(makeData());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const sheet = wb.getWorksheet('Time Entries')!;
    const headerFont = sheet.getRow(1).getCell(1).font;
    expect(headerFont?.bold).toBe(true);
  });

  it('Sheet 2 header row is bold (FR-EXP-11)', async () => {
    const buf = await buildComplianceXlsx(makeData());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const sheet = wb.getWorksheet('Audit Log')!;
    const headerFont = sheet.getRow(1).getCell(1).font;
    expect(headerFont?.bold).toBe(true);
  });

  it('handles empty rows and auditLog without throwing', async () => {
    const data = makeData({ rows: [], auditLog: [] });
    const buf = await buildComplianceXlsx(data);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });
});
