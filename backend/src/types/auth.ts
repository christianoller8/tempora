export interface AuthUser {
  userId: string;
  organizationId: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  employeeId?: string;
  jti: string;
}
