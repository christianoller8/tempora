import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../../db-context';
import type { AuthUser } from '../../types/auth';

type RequestWithUser = Request & { user: AuthUser };
import {
  createEmployee,
  updateEmployee,
  terminateEmployee,
  listEmployees,
  getEmployee,
  getContract,
} from './employees.service';

export async function listEmployeesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb();
    const query = req.query as Record<string, string | undefined>;
    const activeOnly = query['activeOnly'] === 'true';
    const centerId = query['centerId'];

    const employees = await listEmployees({ activeOnly, centerId }, db);
    res.json(employees);
  } catch (err) {
    next(err);
  }
}

export async function createEmployeeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb();
    const employee = await createEmployee(
      req.body,
      (req as RequestWithUser).user.organizationId,
      (req as RequestWithUser).user.userId,
      db,
    );
    res.status(201).json(employee);
  } catch (err) {
    next(err);
  }
}

export async function getEmployeeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb();
    const employee = await getEmployee(req.params['id'] as string, db);
    res.json(employee);
  } catch (err) {
    next(err);
  }
}

export async function updateEmployeeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb();
    const employee = await updateEmployee(
      req.params['id'] as string,
      req.body,
      (req as RequestWithUser).user.organizationId,
      (req as RequestWithUser).user.userId,
      db,
    );
    res.json(employee);
  } catch (err) {
    next(err);
  }
}

export async function getContractHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb();
    const contract = await getContract(req.params['id'] as string, db);
    res.json(contract);
  } catch (err) {
    next(err);
  }
}

export async function terminateEmployeeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb();
    await terminateEmployee(
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
