import { describe, it, expect } from 'vitest';
import { buildSchedulePdf } from './schedule-pdf.builder';
import type { ScheduleExportData } from '../reporting.service';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeData(overrides: Partial<ScheduleExportData> = {}): ScheduleExportData {
  return {
    employeeName: 'John Smith',
    monthLabel: 'June 2025',
    year: 2025,
    month: 6,
    generatedAt: '2025-07-01T00:00:00.000Z',
    rows: [
      { date: '2025-06-02', shiftName: 'Morning', startTime: '08:00', endTime: '16:00' },
      { date: '2025-06-09', shiftName: 'Night', startTime: '22:00', endTime: '06:00' },
      { date: '2025-06-16', shiftName: 'Morning', startTime: '08:00', endTime: '16:00' },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildSchedulePdf', () => {
  it('returns a non-empty Buffer', async () => {
    const buf = await buildSchedulePdf(makeData());
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('produces a valid PDF (starts with %PDF magic bytes)', async () => {
    const buf = await buildSchedulePdf(makeData());
    expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('renders a valid PDF when rows are empty (FR-EXP-13 empty scenario)', async () => {
    const data = makeData({ rows: [] });
    const buf = await buildSchedulePdf(data);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('handles multiple rows without throwing', async () => {
    const data = makeData({
      rows: [
        { date: '2025-06-02', shiftName: 'Morning', startTime: '08:00', endTime: '16:00' },
        { date: '2025-06-03', shiftName: 'Afternoon', startTime: '14:00', endTime: '22:00' },
        { date: '2025-06-04', shiftName: 'Night', startTime: '22:00', endTime: '06:00' },
      ],
    });
    const buf = await buildSchedulePdf(data);
    expect(buf).toBeInstanceOf(Buffer);
  });

  it('uses the provided employee name in the document (no throw for any name)', async () => {
    const data = makeData({ employeeName: 'García, María José' });
    const buf = await buildSchedulePdf(data);
    expect(buf).toBeInstanceOf(Buffer);
  });
});
