import { z } from 'zod';

export const CreateOrganizationSchema = z.object({
  name: z.string().min(1).max(200),
  cif: z.string().max(20).optional(),
});

export const UpdateOrganizationSchema = CreateOrganizationSchema.partial();

export const OrganizationResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  cif: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const CreateCenterSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
});

export const UpdateCenterSchema = CreateCenterSchema.partial();

export const CenterResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  address: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const CreateDepartmentSchema = z.object({
  centerId: z.string().uuid(),
  name: z.string().min(1).max(200),
});

export const UpdateDepartmentSchema = CreateDepartmentSchema.partial().omit({ centerId: true });

export const DepartmentResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  centerId: z.string().uuid(),
  name: z.string(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
