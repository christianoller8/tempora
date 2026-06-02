import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../../db-context';
import type { AuthUser } from '../../types/auth';

type RequestWithUser = Request & { user: AuthUser };
import {
  createTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
} from './templates.service';
import {
  createPattern,
  listPatterns,
  updatePattern,
  deletePattern,
} from './rotations.service';
import {
  createSchedule,
  getSchedule,
  listSchedules,
  publishSchedule,
} from './schedules.service';
import {
  createAssignment,
  listAssignments,
} from './assignments.service';
import {
  requestSwap,
  approveSwap,
  rejectSwap,
  listSwaps,
} from './swaps.service';

// ---- ShiftTemplate ----

export async function listTemplatesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await listTemplates(getDb()));
  } catch (err) { next(err); }
}

export async function createTemplateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const tmpl = await createTemplate(req.body, (req as RequestWithUser).user.organizationId, (req as RequestWithUser).user.userId, getDb());
    res.status(201).json(tmpl);
  } catch (err) { next(err); }
}

export async function updateTemplateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const tmpl = await updateTemplate(req.params['id'] as string, req.body, (req as RequestWithUser).user.organizationId, (req as RequestWithUser).user.userId, getDb());
    res.json(tmpl);
  } catch (err) { next(err); }
}

export async function deleteTemplateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteTemplate(req.params['id'] as string, (req as RequestWithUser).user.organizationId, (req as RequestWithUser).user.userId, getDb());
    res.status(204).send();
  } catch (err) { next(err); }
}

// ---- RotationPattern ----

export async function listPatternsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await listPatterns(getDb()));
  } catch (err) { next(err); }
}

export async function createPatternHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const pattern = await createPattern(req.body, (req as RequestWithUser).user.organizationId, (req as RequestWithUser).user.userId, getDb());
    res.status(201).json(pattern);
  } catch (err) { next(err); }
}

export async function updatePatternHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const pattern = await updatePattern(req.params['id'] as string, req.body, (req as RequestWithUser).user.organizationId, (req as RequestWithUser).user.userId, getDb());
    res.json(pattern);
  } catch (err) { next(err); }
}

export async function deletePatternHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await deletePattern(req.params['id'] as string, (req as RequestWithUser).user.organizationId, (req as RequestWithUser).user.userId, getDb());
    res.status(204).send();
  } catch (err) { next(err); }
}

// ---- ShiftSchedule ----

export async function listSchedulesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, string | undefined>;
    const schedules = await listSchedules(
      {
        centerId: q['centerId'],
        year: q['year'] ? Number(q['year']) : undefined,
        month: q['month'] ? Number(q['month']) : undefined,
      },
      getDb(),
    );
    res.json(schedules);
  } catch (err) { next(err); }
}

export async function createScheduleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const schedule = await createSchedule(req.body, (req as RequestWithUser).user.organizationId, (req as RequestWithUser).user.userId, getDb());
    res.status(201).json(schedule);
  } catch (err) { next(err); }
}

export async function getScheduleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await getSchedule(req.params['id'] as string, getDb()));
  } catch (err) { next(err); }
}

export async function publishScheduleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await publishSchedule(req.params['id'] as string, (req as RequestWithUser).user.organizationId, (req as RequestWithUser).user.userId, getDb());
    res.json(result);
  } catch (err) { next(err); }
}

// ---- ShiftAssignment ----

export async function listAssignmentsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, string | undefined>;
    res.json(await listAssignments({ scheduleId: q['scheduleId'], employeeId: q['employeeId'] }, getDb()));
  } catch (err) { next(err); }
}

export async function createAssignmentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await createAssignment(req.body, (req as RequestWithUser).user.organizationId, (req as RequestWithUser).user.userId, getDb());
    res.status(201).json(result);
  } catch (err) { next(err); }
}

// ---- Swaps ----

export async function listSwapsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, string | undefined>;
    res.json(await listSwaps({ status: q['status'] }, getDb()));
  } catch (err) { next(err); }
}

export async function requestSwapHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const swap = await requestSwap(req.body, (req as RequestWithUser).user.organizationId, (req as RequestWithUser).user.userId, getDb());
    res.status(201).json(swap);
  } catch (err) { next(err); }
}

export async function approveSwapHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await approveSwap(req.params['id'] as string, (req as RequestWithUser).user.organizationId, (req as RequestWithUser).user.userId, getDb());
    res.json(result);
  } catch (err) { next(err); }
}

export async function rejectSwapHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await rejectSwap(req.params['id'] as string, (req as RequestWithUser).user.organizationId, (req as RequestWithUser).user.userId, getDb());
    res.status(204).send();
  } catch (err) { next(err); }
}
