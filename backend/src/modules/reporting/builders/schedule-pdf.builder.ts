import PDFDocument from 'pdfkit';
import type { ScheduleExportData } from '../reporting.service';

// ---------------------------------------------------------------------------
// schedule-pdf.builder — FR-EXP-12..13 [RDL 8/2019]
//
// Produces an A4 portrait PDF with:
//   Header: employee full name (bold 16pt) + month/year subtitle
//   Body: table Date | Shift | Start | End, sorted by date ascending
//   Empty case: renders "No assignments in this month." (valid PDF, no data rows)
// ---------------------------------------------------------------------------

const MARGIN = 40;
const ROW_HEIGHT = 16;
const HEADER_FONT = 'Helvetica-Bold';
const BODY_FONT = 'Helvetica';

const COL_WIDTHS = {
  date: 100,
  shift: 175,
  start: 120,
  end: 120,
} as const;

function drawTableHeader(doc: InstanceType<typeof PDFDocument>): void {
  const colWidths = Object.values(COL_WIDTHS);
  const headers = ['Date', 'Shift', 'Start', 'End'];
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

export function buildSchedulePdf(data: ScheduleExportData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // -----------------------------------------------------------------------
    // Header (FR-EXP-12)
    // -----------------------------------------------------------------------
    doc.fontSize(16).font(HEADER_FONT).text(data.employeeName, { align: 'left' });
    doc.fontSize(11).font(BODY_FONT).text(data.monthLabel, { align: 'left' });
    doc.moveDown(0.7);

    // -----------------------------------------------------------------------
    // Body table (FR-EXP-13)
    // -----------------------------------------------------------------------
    if (data.rows.length === 0) {
      doc.fontSize(9).font(BODY_FONT).text('No assignments in this month.');
    } else {
      const colWidths = Object.values(COL_WIDTHS);
      drawTableHeader(doc);

      for (const row of data.rows) {
        const bottom = doc.page.height - doc.page.margins.bottom;
        if (doc.y + ROW_HEIGHT > bottom) {
          doc.addPage();
          drawTableHeader(doc);
        }

        const y = doc.y;
        const x0 = doc.page.margins.left;
        doc.fontSize(8).font(BODY_FONT);

        const cells = [row.date, row.shiftName, row.startTime, row.endTime];
        let x = x0;
        cells.forEach((cell, idx) => {
          doc.text(String(cell), x, y, { width: colWidths[idx], lineBreak: false });
          x += colWidths[idx]!;
        });
        doc.moveDown(0.25);
      }
    }

    doc.end();
  });
}
