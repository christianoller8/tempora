import type { RoleName } from './roles.js';

export const PERMISSIONS = {
  'employees:write': ['ADMIN'],
  'employees:read': ['ADMIN', 'MANAGER'],
  'shifts:write': ['ADMIN', 'MANAGER'],
  'shifts:publish': ['ADMIN', 'MANAGER'],
  'time:approve': ['ADMIN', 'MANAGER'],
  'time:clock-self': ['ADMIN', 'MANAGER', 'EMPLOYEE'],
  'swaps:request': ['ADMIN', 'MANAGER', 'EMPLOYEE'],
  'swaps:approve': ['ADMIN', 'MANAGER'],
  'absences:approve': ['ADMIN', 'MANAGER'],
  'reports:export': ['ADMIN', 'MANAGER'],
  'centers:manage': ['ADMIN'],
} as const satisfies Record<string, readonly RoleName[]>;

export type Permission = keyof typeof PERMISSIONS;
