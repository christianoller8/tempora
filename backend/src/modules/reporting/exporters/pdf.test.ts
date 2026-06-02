import { describe, it, expect } from 'vitest';
import { toPdf } from './pdf';

const columns = [
  { key: 'name', header: 'Name' },
  { key: 'hours', header: 'Hours' },
];

const rows = [
  { name: 'Alice', hours: 80 },
  { name: 'Bob', hours: 45 },
];

describe('toPdf', () => {
  it('returns a non-empty Buffer', async () => {
    const buf = await toPdf(rows, columns, 'Monthly Report');
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('produces a valid PDF binary (starts with %PDF magic bytes)', async () => {
    const buf = await toPdf(rows, columns, 'Monthly Report');
    const header = buf.slice(0, 4).toString('ascii');
    expect(header).toBe('%PDF');
  });
});
