import { describe, it, expect } from 'vitest';
import { toXlsx } from './xlsx';

const columns = [
  { key: 'name', header: 'Name' },
  { key: 'hours', header: 'Hours' },
];

const rows = [
  { name: 'Alice', hours: 80 },
  { name: 'Bob', hours: 45 },
];

describe('toXlsx', () => {
  it('returns a non-empty Buffer', async () => {
    const buf = await toXlsx(rows, columns);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('produces a valid XLSX binary (starts with PK zip magic bytes)', async () => {
    const buf = await toXlsx(rows, columns);
    // XLSX files are ZIP archives; first two bytes are 'PK' (0x50 0x4B)
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it('handles empty rows without throwing', async () => {
    const buf = await toXlsx([], columns);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });
});
