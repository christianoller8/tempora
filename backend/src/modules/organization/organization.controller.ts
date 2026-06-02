import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../../db-context';
import type { AuthUser } from '../../types/auth';

type RequestWithUser = Request & { user: AuthUser };
import {
  createCenter,
  updateCenter,
  listCenters,
  softDeleteCenter,
  createDepartment,
  listDepartments,
} from './organization.service';

// ---------------------------------------------------------------------------
// Centers
// ---------------------------------------------------------------------------

export async function listCentersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb();
    const centers = await listCenters(db);
    res.json(centers);
  } catch (err) {
    next(err);
  }
}

export async function createCenterHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb();
    const center = await createCenter(req.body, (req as RequestWithUser).user.organizationId, (req as RequestWithUser).user.userId, db);
    res.status(201).json(center);
  } catch (err) {
    next(err);
  }
}

export async function updateCenterHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb();
    const center = await updateCenter(
      req.params['id'] as string,
      req.body,
      (req as RequestWithUser).user.organizationId,
      (req as RequestWithUser).user.userId,
      db,
    );
    res.json(center);
  } catch (err) {
    next(err);
  }
}

export async function deleteCenterHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb();
    await softDeleteCenter(
      req.params['id'] as string,
      (req as RequestWithUser).user.organizationId,
      (req as RequestWithUser).user.userId,
      db,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export async function listDepartmentsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb();
    const departments = await listDepartments(req.params['id'] as string, db);
    res.json(departments);
  } catch (err) {
    next(err);
  }
}

export async function createDepartmentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb();
    const department = await createDepartment(
      req.params['id'] as string,
      req.body,
      (req as RequestWithUser).user.organizationId,
      (req as RequestWithUser).user.userId,
      db,
    );
    res.status(201).json(department);
  } catch (err) {
    next(err);
  }
}
