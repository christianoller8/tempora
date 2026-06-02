import { Router } from 'express';
import { requireRole } from '../../middleware/require-role';
import { validate } from '../../middleware/validate';
import {
  ShiftTemplateSchema,
  RotationPatternSchema,
  CreateScheduleSchema,
  ShiftAssignmentSchema,
  CreateSwapSchema,
} from '@tempora/shared';
import {
  listTemplatesHandler,
  createTemplateHandler,
  updateTemplateHandler,
  deleteTemplateHandler,
  listPatternsHandler,
  createPatternHandler,
  updatePatternHandler,
  deletePatternHandler,
  listSchedulesHandler,
  createScheduleHandler,
  getScheduleHandler,
  publishScheduleHandler,
  listAssignmentsHandler,
  createAssignmentHandler,
  listSwapsHandler,
  requestSwapHandler,
  approveSwapHandler,
  rejectSwapHandler,
} from './shifts.controller';

// All routes require authenticate + tenantContext (applied in app.ts).
// Specific routes apply requireRole guards as specified below.

export const shiftsRouter = Router();

// ---- ShiftTemplate routes (/shifts/templates) ----
// GET is open to all authenticated users (managers need to see templates).
// Write operations require ADMIN.
shiftsRouter.get('/templates', listTemplatesHandler);
shiftsRouter.post(
  '/templates',
  requireRole(['ADMIN']),
  validate(ShiftTemplateSchema),
  createTemplateHandler,
);
shiftsRouter.patch(
  '/templates/:id',
  requireRole(['ADMIN']),
  updateTemplateHandler,
);
shiftsRouter.delete(
  '/templates/:id',
  requireRole(['ADMIN']),
  deleteTemplateHandler,
);

// ---- RotationPattern routes (/shifts/rotation-patterns) ----
shiftsRouter.get('/rotation-patterns', listPatternsHandler);
shiftsRouter.post(
  '/rotation-patterns',
  requireRole(['ADMIN']),
  validate(RotationPatternSchema),
  createPatternHandler,
);
shiftsRouter.patch(
  '/rotation-patterns/:id',
  requireRole(['ADMIN']),
  updatePatternHandler,
);
shiftsRouter.delete(
  '/rotation-patterns/:id',
  requireRole(['ADMIN']),
  deletePatternHandler,
);

// ---- ShiftSchedule routes (/shifts/schedules) ----
// Manager can create schedules for their own center (service-layer scoping).
shiftsRouter.get('/schedules', listSchedulesHandler);
shiftsRouter.post(
  '/schedules',
  requireRole(['ADMIN', 'MANAGER']),
  validate(CreateScheduleSchema),
  createScheduleHandler,
);
shiftsRouter.get('/schedules/:id', getScheduleHandler);
shiftsRouter.post(
  '/schedules/:id/publish',
  requireRole(['ADMIN', 'MANAGER']),
  publishScheduleHandler,
);

// ---- ShiftAssignment routes (/shifts/assignments) ----
shiftsRouter.get('/assignments', listAssignmentsHandler);
shiftsRouter.post(
  '/assignments',
  requireRole(['ADMIN', 'MANAGER']),
  validate(ShiftAssignmentSchema),
  createAssignmentHandler,
);

// ---- CambioTurno (swap) routes (/shifts/swaps) ----
// P2-14: POST /swaps, POST /swaps/:id/approve, POST /swaps/:id/reject, GET /swaps
shiftsRouter.get('/swaps', listSwapsHandler);
shiftsRouter.post(
  '/swaps',
  requireRole(['ADMIN', 'MANAGER', 'EMPLOYEE']),
  validate(CreateSwapSchema),
  requestSwapHandler,
);
shiftsRouter.post(
  '/swaps/:id/approve',
  requireRole(['ADMIN', 'MANAGER']),
  approveSwapHandler,
);
shiftsRouter.post(
  '/swaps/:id/reject',
  requireRole(['ADMIN', 'MANAGER']),
  rejectSwapHandler,
);
