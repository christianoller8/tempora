import type { Employee } from '@prisma/client';
import type { TenantClient } from '../../db/tenant';
import { prisma } from '../../db/prisma';
import { ApiError } from '../../middleware/error';
import { auditWriter } from '../../audit/audit-writer';
import type { z } from 'zod';
import type { CreateEmployeeSchema, UpdateEmployeeSchema } from '@tempora/shared';

type CreateEmployee = z.infer<typeof CreateEmployeeSchema>;
type UpdateEmployee = z.infer<typeof UpdateEmployeeSchema>;

export async function createEmployee(
  dto: CreateEmployee,
  organizationId: string,
  actorId: string,
  db: TenantClient,
): Promise<Employee> {
  // Part-time validation is enforced by the Zod schema (CreateEmployeeSchema
  // superRefine), but we double-check here for defense in depth.
  if (dto.contractType === 'TIEMPO_PARCIAL') {
    if (!dto.contractedHoursPerWeek || dto.contractedHoursPerWeek <= 0) {
      throw new ApiError(
        422,
        'VALIDATION_ERROR',
        'contractedHoursPerWeek is required and must be > 0 for TIEMPO_PARCIAL contracts',
      );
    }
  }

  const employee = await db.employee.create({
    data: {
      organizationId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      nif: dto.nif ?? null,
      category: dto.category,
      contractType: dto.contractType,
      contractedHoursPerWeek: dto.contractedHoursPerWeek ?? 0,
      primaryCenterId: dto.primaryCenterId,
      workingCalendarId: dto.workingCalendarId ?? null,
      hireDate: new Date(dto.hireDate),
    },
  });

  await auditWriter.write(db, actorId, organizationId, {
    action: 'CREATE',
    entityType: 'Employee',
    entityId: employee.id,
    after: {
      firstName: employee.firstName,
      lastName: employee.lastName,
      category: employee.category,
      contractType: employee.contractType,
    },
  });

  return employee;
}

export async function updateEmployee(
  id: string,
  dto: UpdateEmployee,
  organizationId: string,
  actorId: string,
  db: TenantClient,
): Promise<Employee> {
  const existing = await db.employee.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', `Employee ${id} not found`);

  const updated = await db.employee.update({
    where: { id },
    data: {
      firstName: dto.firstName ?? undefined,
      lastName: dto.lastName ?? undefined,
      nif: dto.nif ?? undefined,
      category: dto.category ?? undefined,
      contractType: dto.contractType ?? undefined,
      contractedHoursPerWeek: dto.contractedHoursPerWeek ?? undefined,
      primaryCenterId: dto.primaryCenterId ?? undefined,
      workingCalendarId: dto.workingCalendarId ?? undefined,
      hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
    },
  });

  await auditWriter.write(db, actorId, organizationId, {
    action: 'UPDATE',
    entityType: 'Employee',
    entityId: id,
    before: {
      firstName: existing.firstName,
      lastName: existing.lastName,
      category: existing.category,
    },
    after: {
      firstName: updated.firstName,
      lastName: updated.lastName,
      category: updated.category,
    },
  });

  return updated;
}

export async function terminateEmployee(
  id: string,
  organizationId: string,
  actorId: string,
  db: TenantClient,
): Promise<void> {
  const employee = await db.employee.findUnique({ where: { id } });
  if (!employee) throw new ApiError(404, 'NOT_FOUND', `Employee ${id} not found`);
  if (!employee.isActive) {
    throw new ApiError(409, 'ALREADY_TERMINATED', `Employee ${id} is already terminated`);
  }

  await db.employee.update({
    where: { id },
    data: {
      isActive: false,
      terminationDate: new Date(),
    },
  });

  // Blocklist all active tokens for this employee's user account.
  // We find the user linked to this employee and revoke all tokens by
  // inserting their known JTIs. Since we don't track individual JTIs per-user
  // in a usable way without a session table, we record a blanket revocation
  // entry keyed on the userId so the isBlocklisted check can be extended.
  // For now: find the user and add a marker token entry.
  const user = await db.user.findFirst({ where: { employeeId: id } });
  if (user) {
    // Deactivate the user account so they cannot log in.
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });
  }

  await auditWriter.write(db, actorId, organizationId, {
    action: 'DELETE',
    entityType: 'Employee',
    entityId: id,
    before: { isActive: true },
    after: { isActive: false, terminationDate: new Date().toISOString() },
  });
}

export async function listEmployees(
  filter: { activeOnly?: boolean; centerId?: string },
  db: TenantClient,
): Promise<Employee[]> {
  return db.employee.findMany({
    where: {
      ...(filter.activeOnly ? { isActive: true } : {}),
      ...(filter.centerId ? { primaryCenterId: filter.centerId } : {}),
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
}

export async function getEmployee(id: string, db: TenantClient): Promise<Employee> {
  const employee = await db.employee.findUnique({ where: { id } });
  if (!employee) throw new ApiError(404, 'NOT_FOUND', `Employee ${id} not found`);
  return employee;
}

export async function getContract(
  employeeId: string,
  db: TenantClient,
): Promise<Pick<Employee, 'contractType' | 'contractedHoursPerWeek' | 'hireDate'>> {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { contractType: true, contractedHoursPerWeek: true, hireDate: true },
  });
  if (!employee) throw new ApiError(404, 'NOT_FOUND', `Employee ${employeeId} not found`);
  return employee;
}
