import { Router } from 'express';
import { requireRole } from '../../middleware/require-role.js';
import { validate } from '../../middleware/validate.js';
import { CreateEmployeeSchema, UpdateEmployeeSchema } from '@tempora/shared';
import {
  listEmployeesHandler,
  createEmployeeHandler,
  getEmployeeHandler,
  updateEmployeeHandler,
  getContractHandler,
  terminateEmployeeHandler,
} from './employees.controller.js';

export const employeesRouter = Router();

// All routes require authenticate + tenantContext (applied in app.ts)

employeesRouter.get('/', listEmployeesHandler);
employeesRouter.post(
  '/',
  requireRole(['ADMIN']),
  validate(CreateEmployeeSchema),
  createEmployeeHandler,
);
employeesRouter.get('/:id', getEmployeeHandler);
employeesRouter.patch(
  '/:id',
  requireRole(['ADMIN']),
  validate(UpdateEmployeeSchema),
  updateEmployeeHandler,
);
employeesRouter.get('/:id/contract', requireRole(['ADMIN', 'MANAGER']), getContractHandler);
employeesRouter.post('/:id/terminate', requireRole(['ADMIN']), terminateEmployeeHandler);
