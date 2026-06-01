export const ROLES = ['ADMIN', 'MANAGER', 'EMPLOYEE'] as const;
export type RoleName = (typeof ROLES)[number];
