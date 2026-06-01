import { z } from 'zod';
import { ROLE_VALUES } from '../constants/enums.js';

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: z.enum(ROLE_VALUES),
    organizationId: z.string().uuid(),
    employeeId: z.string().uuid().nullable(),
  }),
});

export const RefreshResponseSchema = z.object({
  accessToken: z.string(),
});

export const MeResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(ROLE_VALUES),
  organizationId: z.string().uuid(),
  employeeId: z.string().uuid().nullable(),
  isActive: z.boolean(),
  lastLoginAt: z.string().datetime({ offset: true }).nullable(),
});
