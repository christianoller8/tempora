import PDFDocument from 'pdfkit';

export interface ColumnDef {
  key: string;
  header: string;
}

/**
 * Converts an array of row objects to a PDF Buffer.
 * - Renders a title, bold column headers, and rows as a simple table.
 * - Returns a Buffer suitable for sending as application/pdf.
 *
 * Satisfies FR-REP-5; acceptance: AC-REP-7 (non-empty PDF).
 */
export function toPdf(
  rows: Record<string, unknown>[],
  columns: ColumnDef[],
  title: string,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title
    doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown(0.5);

    // Column widths — distribute evenly across usable page width
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = columns.length > 0 ? pageWidth / columns.length : pageWidth;
    const rowHeight = 18;

    // Header row
    doc.fontSize(10).font('Helvetica-Bold');
    let x = doc.page.margins.left;
    let y = doc.y;

    columns.forEach((col) => {
      doc.text(col.header, x, y, { width: colWidth, lineBreak: false });
      x += colWidth;
    });
    doc.moveDown(0.3);

    // Separator line
    const lineY = doc.y;
    doc
      .moveTo(doc.page.margins.left, lineY)
      .lineTo(doc.page.margins.left + pageWidth, lineY)
      .stroke();
    doc.moveDown(0.2);

    // Data rows
    doc.font('Helvetica').fontSize(9);
    for (const row of rows) {
      x = doc.page.margins.left;
      y = doc.y;

      // Page break guard
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;
      }

      columns.forEach((col) => {
        const value = row[col.key];
        const text = value != null ? String(value) : '';
        doc.text(text, x, y, { width: colWidth, lineBreak: false });
        x += colWidth;
      });
      doc.moveDown(0.3);
    }

    doc.end();
  });
}
