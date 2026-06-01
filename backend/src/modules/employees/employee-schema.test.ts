import { describe, it, expect } from 'vitest';
import { CreateEmployeeSchema } from '@tempora/shared';

const baseValid = {
  firstName: 'Ana',
  lastName: 'García',
  category: 'ENFERMERO',
  contractType: 'INDEFINIDO',
  primaryCenterId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  hireDate: '2024-01-15',
} as const;

describe('CreateEmployeeSchema', () => {
  it('accepts a valid INDEFINIDO employee without contractedHoursPerWeek', () => {
    expect(CreateEmployeeSchema.safeParse(baseValid).success).toBe(true);
  });

  it('rejects TIEMPO_PARCIAL when contractedHoursPerWeek is absent', () => {
    const result = CreateEmployeeSchema.safeParse({
      ...baseValid,
      contractType: 'TIEMPO_PARCIAL',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('contractedHoursPerWeek');
    }
  });

  it('rejects TIEMPO_PARCIAL when contractedHoursPerWeek is zero', () => {
    const result = CreateEmployeeSchema.safeParse({
      ...baseValid,
      contractType: 'TIEMPO_PARCIAL',
      contractedHoursPerWeek: 0,
    });
    expect(result.success).toBe(false);
  });

  it('accepts TIEMPO_PARCIAL when contractedHoursPerWeek is positive', () => {
    const result = CreateEmployeeSchema.safeParse({
      ...baseValid,
      contractType: 'TIEMPO_PARCIAL',
      contractedHoursPerWeek: 20,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid hireDate format', () => {
    const result = CreateEmployeeSchema.safeParse({ ...baseValid, hireDate: '15-01-2024' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown category', () => {
    const result = CreateEmployeeSchema.safeParse({ ...baseValid, category: 'DESCONOCIDO' });
    expect(result.success).toBe(false);
  });
});
