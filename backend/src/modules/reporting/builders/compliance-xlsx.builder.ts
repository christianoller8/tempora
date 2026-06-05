import ExcelJS from 'exceljs';
import type { ComplianceExportData } from '../reporting.service';

// ---------------------------------------------------------------------------
// compliance-xlsx.builder — FR-EXP-09..11 [RDL 8/2019]
//
// Produces a two-sheet XLSX workbook:
//   Sheet 1 "Time Entries" — one row per entry, frozen + bold header, auto-width
//   Sheet 2 "Audit Log"    — one row per audit entry, same formatting
// ---------------------------------------------------------------------------

function applyAutoWidth(sheet: ExcelJS.Worksheet): void {
  sheet.columns.forEach((col) => {
    if (!col.key) return;
    let maxLength = String(col.header ?? '').length;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = cell.value != null ? String(cell.value).length : 0;
      if (len > maxLength) maxLength = len;
    });
    col.width = maxLength + 4;
  });
}

function freezeAndBoldHeader(sheet: ExcelJS.Worksheet): void {
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.commit();
}

export async function buildComplianceXlsx(data: ComplianceExportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  // -------------------------------------------------------------------------
  // Sheet 1: Time Entries (FR-EXP-09)
  // -------------------------------------------------------------------------
  const entriesSheet = wb.addWorksheet('Time Entries');

  entriesSheet.columns = [
    { header: 'Employee Name', key: 'employeeName', width: 20 },
    { header: 'Category', key: 'category', width: 16 },
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Clock In', key: 'clockIn', width: 10 },
    { header: 'Clock Out', key: 'clockOut', width: 10 },
    { header: 'Duration (h)', key: 'durationHours', width: 14 },
    { header: 'Source', key: 'source', width: 12 },
  ];

  freezeAndBoldHeader(entriesSheet);

  for (const row of data.rows) {
    entriesSheet.addRow({
      employeeName: row.employeeName,
      category: row.category,
      date: row.date,
      clockIn: row.clockIn,
      clockOut: row.clockOut ?? '—',
      durationHours: row.durationHours != null ? row.durationHours : '—',
      source: row.source,
    });
  }

  applyAutoWidth(entriesSheet);

  // -------------------------------------------------------------------------
  // Sheet 2: Audit Log (FR-EXP-10)
  // -------------------------------------------------------------------------
  const auditSheet = wb.addWorksheet('Audit Log');

  auditSheet.columns = [
    { header: 'Timestamp (UTC)', key: 'timestamp', width: 24 },
    { header: 'Actor', key: 'actor', width: 16 },
    { header: 'Entity ID', key: 'entityId', width: 20 },
    { header: 'Action', key: 'action', width: 12 },
    { header: 'Before (JSON)', key: 'before', width: 24 },
    { header: 'After (JSON)', key: 'after', width: 24 },
  ];

  freezeAndBoldHeader(auditSheet);

  for (const entry of data.auditLog) {
    auditSheet.addRow({
      timestamp: entry.timestamp,
      actor: entry.actor,
      entityId: entry.entityId,
      action: entry.action,
      before: entry.before,
      after: entry.after,
    });
  }

  applyAutoWidth(auditSheet);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
