import { Router } from 'express';
import { requireRole } from '../../middleware/require-role.js';
import { validate } from '../../middleware/validate.js';
import { CreateCenterSchema, UpdateCenterSchema, CreateDepartmentSchema } from '@tempora/shared';
import {
  listCentersHandler,
  createCenterHandler,
  updateCenterHandler,
  deleteCenterHandler,
  listDepartmentsHandler,
  createDepartmentHandler,
} from './organization.controller.js';

export const organizationRouter = Router();

// Centers — all routes require authenticate + tenantContext (applied in app.ts)
organizationRouter.get('/', listCentersHandler);
organizationRouter.post('/', requireRole(['ADMIN']), validate(CreateCenterSchema), createCenterHandler);
organizationRouter.patch('/:id', requireRole(['ADMIN']), validate(UpdateCenterSchema), updateCenterHandler);
organizationRouter.delete('/:id', requireRole(['ADMIN']), deleteCenterHandler);

// Departments (nested under center)
organizationRouter.get('/:id/departments', listDepartmentsHandler);
organizationRouter.post(
  '/:id/departments',
  requireRole(['ADMIN']),
  validate(CreateDepartmentSchema),
  createDepartmentHandler,
);
