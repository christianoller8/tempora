import ExcelJS from 'exceljs';

export interface ColumnDef {
  key: string;
  header: string;
}

/**
 * Converts an array of row objects to an XLSX Buffer.
 * - One worksheet with auto-width columns and bold header row.
 * - Returns a Buffer suitable for sending as application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.
 *
 * Satisfies FR-REP-5; acceptance: AC-REP-1 (valid XLSX buffer).
 */
export async function toXlsx(
  rows: Record<string, unknown>[],
  columns: ColumnDef[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Report');

  // Define columns with headers
  sheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: Math.max(col.header.length + 4, 14),
  }));

  // Bold header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.commit();

  // Add data rows
  for (const row of rows) {
    sheet.addRow(row);
  }

  // Auto-width: re-compute based on actual cell content
  sheet.columns.forEach((col) => {
    if (!col.key) return;
    let maxLength = (col.header ?? '').length;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const cellLength = cell.value != null ? String(cell.value).length : 0;
      if (cellLength > maxLength) maxLength = cellLength;
    });
    col.width = maxLength + 4;
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
