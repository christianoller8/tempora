import PDFDocument from 'pdfkit';
import type { ComplianceExportData, ComplianceEntryRow } from '../reporting.service';

// ---------------------------------------------------------------------------
// compliance-pdf.builder — FR-EXP-04..08 [RDL 8/2019]
//
// Produces an A4 portrait PDF with:
//   1. Header block (org name, CIF, period, generated timestamp)
//   2. Entries table with per-employee subtotal rows
//   3. Grand total row
//   4. Modification log section (new page)
// ---------------------------------------------------------------------------

const MARGIN = 40;
const ROW_HEIGHT = 16;
const HEADER_FONT = 'Helvetica-Bold';
const BODY_FONT = 'Helvetica';

// Fixed column widths (sum = ~515pt usable width on A4 at 40pt margin)
const COL_WIDTHS = {
  employee: 110,
  category: 80,
  date: 70,
  clockIn: 42,
  clockOut: 42,
  hours: 42,
  source: 62,
} as const;

// Audit log column widths (sum = ~515pt)
const AUDIT_COL_WIDTHS = {
  timestamp: 110,
  actor: 80,
  entityId: 90,
  action: 55,
  before: 90,
  after: 90,
} as const;

function drawTableHeader(
  doc: InstanceType<typeof PDFDocument>,
  colWidths: number[],
  headers: string[],
): void {
  const x0 = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;

  doc.fontSize(8).font(HEADER_FONT);
  let x = x0;
  headers.forEach((h, i) => {
    doc.text(h, x, y, { width: colWidths[i], lineBreak: false });
    x += colWidths[i]!;
  });
  doc.moveDown(0.3);

  const lineY = doc.y;
  doc.moveTo(x0, lineY).lineTo(x0 + pageWidth, lineY).stroke();
  doc.moveDown(0.2);
}

function drawDataRow(
  doc: InstanceType<typeof PDFDocument>,
  colWidths: number[],
  cells: string[],
  bold = false,
): void {
  const x0 = doc.page.margins.left;
  const bottom = doc.page.height - doc.page.margins.bottom;

  if (doc.y + ROW_HEIGHT > bottom) {
    doc.addPage();
  }

  const y = doc.y;
  doc.fontSize(8).font(bold ? HEADER_FONT : BODY_FONT);
  let x = x0;
  cells.forEach((cell, i) => {
    doc.text(cell, x, y, { width: colWidths[i], lineBreak: false });
    x += colWidths[i]!;
  });
  doc.moveDown(0.25);
}

function formatTime(isoUtc: string): string {
  // Extract HH:mm from an ISO 8601 UTC string like "2025-01-15T09:00:00.000Z"
  return isoUtc.slice(11, 16);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildCompliancePdf(data: ComplianceExportData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // -----------------------------------------------------------------------
    // 1. Header block (FR-EXP-04)
    // -----------------------------------------------------------------------
    doc.fontSize(14).font(HEADER_FONT).text('Time Record — RDL 8/2019', { align: 'center' });
    doc.moveDown(0.4);

    doc
      .fontSize(10)
      .font(HEADER_FONT)
      .text(data.organization.name, { align: 'left' });
    doc
      .fontSize(9)
      .font(BODY_FONT)
      .text(`CIF: ${data.organization.cif ?? '—'}`);
    doc.text(`Period: ${data.dateRange.from} → ${data.dateRange.to}`);
    doc.text(`Generated (UTC): ${data.generatedAt}`);
    doc.moveDown(0.6);

    // -----------------------------------------------------------------------
    // 2. Entries table (FR-EXP-05, FR-EXP-06)
    // -----------------------------------------------------------------------
    const entryColWidths = Object.values(COL_WIDTHS);
    const entryHeaders = ['Employee', 'Category', 'Date', 'In', 'Out', 'Hours', 'Source'];

    drawTableHeader(doc, entryColWidths, entryHeaders);

    // Re-usable helper to print the column header after a page break
    const printEntryHeader = () => drawTableHeader(doc, entryColWidths, entryHeaders);

    let currentEmployee = '';
    let employeeTotal = 0;
    let grandTotal = 0;

    const rows = data.rows;

    for (let i = 0; i < rows.length; i++) {
      const row: ComplianceEntryRow = rows[i]!;

      // Detect employee change → emit subtotal for previous employee
      if (row.employeeName !== currentEmployee) {
        if (currentEmployee !== '') {
          // Subtotal row (FR-EXP-06)
          drawDataRow(
            doc,
            [entryColWidths.reduce((a, b) => a + b, 0)],
            [`  Subtotal — ${currentEmployee}: ${round2(employeeTotal).toFixed(2)} h`],
            true,
          );
          employeeTotal = 0;
        }
        currentEmployee = row.employeeName;

        // Re-print header if we just started a new page
        const bottom = doc.page.height - doc.page.margins.bottom;
        if (doc.y + ROW_HEIGHT * 3 > bottom) {
          doc.addPage();
          printEntryHeader();
        }
      }

      const clockOutStr = row.clockOut ?? '—';
      const hoursStr = row.durationHours != null ? row.durationHours.toFixed(2) : '—';
      const hoursVal = row.durationHours ?? 0;

      employeeTotal += hoursVal;
      grandTotal += hoursVal;

      drawDataRow(doc, entryColWidths, [
        row.employeeName,
        row.category,
        row.date,
        row.clockIn,
        clockOutStr,
        hoursStr,
        row.source,
      ]);
    }

    // Subtotal for last employee (FR-EXP-06)
    if (currentEmployee !== '') {
      drawDataRow(
        doc,
        [entryColWidths.reduce((a, b) => a + b, 0)],
        [`  Subtotal — ${currentEmployee}: ${round2(employeeTotal).toFixed(2)} h`],
        true,
      );
    }

    // Grand total (FR-EXP-08)
    doc.moveDown(0.2);
    drawDataRow(
      doc,
      [entryColWidths.reduce((a, b) => a + b, 0)],
      [`TOTAL: ${round2(grandTotal).toFixed(2)} h`],
      true,
    );

    // -----------------------------------------------------------------------
    // 3. Modification log (FR-EXP-07)
    // -----------------------------------------------------------------------
    doc.addPage();
    doc.fontSize(12).font(HEADER_FONT).text('Modification Log');
    doc.moveDown(0.5);

    if (data.auditLog.length === 0) {
      doc.fontSize(9).font(BODY_FONT).text('No modifications in this period.');
    } else {
      const auditColWidths = Object.values(AUDIT_COL_WIDTHS);
      const auditHeaders = ['Timestamp', 'Actor', 'Entity ID', 'Action', 'Before', 'After'];
      drawTableHeader(doc, auditColWidths, auditHeaders);

      for (const entry of data.auditLog) {
        const bottom = doc.page.height - doc.page.margins.bottom;
        if (doc.y + ROW_HEIGHT > bottom) {
          doc.addPage();
          drawTableHeader(doc, auditColWidths, auditHeaders);
        }

        const y = doc.y;
        const x0 = doc.page.margins.left;
        doc.fontSize(7).font(BODY_FONT);

        const cells = [
          entry.timestamp,
          entry.actor,
          entry.entityId,
          entry.action,
          entry.before,
          entry.after,
        ];

        let x = x0;
        cells.forEach((cell, idx) => {
          doc.text(String(cell), x, y, {
            width: auditColWidths[idx],
            lineBreak: false,
            ellipsis: true,
          });
          x += auditColWidths[idx]!;
        });
        doc.moveDown(0.25);
      }
    }

    doc.end();
  });
}
