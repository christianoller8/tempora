import type { WorkingCalendar, Employee } from '@prisma/client';
import type { TenantClient } from '../../db/tenant.js';
import type { z } from 'zod';
import type { CreateWorkingCalendarSchema } from '@tempora/shared';
import { ApiError } from '../../middleware/error.js';

type WorkingCalendarInput = z.infer<typeof CreateWorkingCalendarSchema>;

export async function createCalendar(
  dto: WorkingCalendarInput,
  organizationId: string,
  db: TenantClient,
): Promise<WorkingCalendar> {
  return db.workingCalendar.create({
    data: {
      organizationId,
      name: dto.name,
      year: dto.year,
      annualHours: dto.annualHours,
      holidays: dto.holidays as object,
    },
  });
}

export async function listCalendars(db: TenantClient): Promise<WorkingCalendar[]> {
  return db.workingCalendar.findMany({ orderBy: [{ year: 'desc' }, { name: 'asc' }] });
}

export async function assignCalendar(
  employeeId: string,
  calendarId: string,
  db: TenantClient,
): Promise<Employee> {
  const calendar = await db.workingCalendar.findUnique({ where: { id: calendarId } });
  if (!calendar) {
    throw new ApiError(404, 'NOT_FOUND', `WorkingCalendar ${calendarId} not found`);
  }

  return db.employee.update({
    where: { id: employeeId },
    data: { workingCalendarId: calendarId },
  });
}
