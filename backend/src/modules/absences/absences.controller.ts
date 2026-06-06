import type { Request, Response } from 'express';
import { getDb, getUser } from '../../db-context';
import {
  createAbsence,
  approveAbsence,
  rejectAbsence,
  getAbsence,
  listAbsences,
  getBalance,
} from './absences.service';
import type { AbsenceStatus, AbsenceType } from '@prisma/client';

// ---------------------------------------------------------------------------
// Absences controller — satisfies FR-ABS-1..7 [GDPR] [COMPLIANCE]
//
// GDPR invariant enforced in service layer:
//   - causeEncrypted is NEVER serialized in any response.
//   - listAbsences does NOT decrypt or return cause.
//   - getAbsence writes READ audit BEFORE decrypting cause.
// ---------------------------------------------------------------------------

/**
 * GET /absences
 * Lists absences with optional filters.
 * causeEncrypted is never included — only getAbsence (single-record) triggers GDPR audit.
 */
export async function handleListAbsences(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();
  const q = req.query as {
    employeeId?: string;
    status?: string;
    type?: string;
  };

  // FR-ABS-27 / D2: self-scoping enforced in controller (service is auth-agnostic).
  // D3: fail-closed — EMPLOYEE without employeeId on token sees an empty list.
  let employeeId = q.employeeId;
  if (user.role === 'EMPLOYEE') {
    employeeId = user.employeeId ?? '__none__';
  }

  const absences = await listAbsences(
    {
      employeeId,
      status: q.status as AbsenceStatus | undefined,
      type: q.type as AbsenceType | undefined,
    },
    db,
  );
  res.json({ data: absences });
}

/**
 * POST /absences
 * Creates an absence request.
 */
export async function handleCreateAbsence(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();
  const body = req.body as {
    employeeId?: string;
    type: AbsenceType;
    startDate: string;
    endDate: string;
    cause?: string;
  };

  // FR-ABS-23: EMPLOYEE can only create absences for themselves — always override.
  // Manager/admin can specify employeeId freely.
  const employeeId = user.role === 'EMPLOYEE'
    ? (user.employeeId ?? user.userId)
    : (body.employeeId ?? user.employeeId ?? user.userId);

  const { absence } = await createAbsence(
    { employeeId, type: body.type, startDate: body.startDate, endDate: body.endDate, cause: body.cause },
    user.userId,
    user.role,
    user.organizationId,
    db,
  );
  res.status(201).json({ data: absence });
}

/**
 * GET /absences/balance
 * Returns vacation balance for an employee for the given year.
 * Must be mounted BEFORE /:id route to avoid "balance" being treated as an ID param.
 */
export async function handleGetBalance(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();
  const q = req.query as { employeeId?: string; year?: string };

  const employeeId = q.employeeId ?? user.employeeId ?? user.userId;
  const year = q.year ? parseInt(q.year, 10) : new Date().getFullYear();

  const balance = await getBalance(employeeId, year, user.organizationId, db);
  res.json({ data: balance });
}

/**
 * GET /absences/:id
 * Returns a single absence.
 * GDPR: if causeEncrypted is present, triggers READ audit before decryption.
 */
export async function handleGetAbsence(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();

  // D7: pass requesterEmployeeId for EMPLOYEE role so the service guards ownership
  // BEFORE the GDPR audit/decrypt block (avoids auditing an unauthorized read).
  const requesterEmployeeId = user.role === 'EMPLOYEE' ? (user.employeeId ?? '__none__') : undefined;

  const absence = await getAbsence(req.params['id'] as string, user.organizationId, user.userId, db, requesterEmployeeId);
  res.json({ data: absence });
}

/**
 * POST /absences/:id/approve
 * MANAGER/ADMIN only — transitions PENDING → APPROVED.
 */
export async function handleApproveAbsence(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();
  const body = req.body as { comment?: string };

  const absence = await approveAbsence(req.params['id'] as string, user.userId, user.organizationId, db, body.comment);
  res.json({ data: absence });
}

/**
 * POST /absences/:id/reject
 * MANAGER/ADMIN only — transitions PENDING → REJECTED.
 */
export async function handleRejectAbsence(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();
  const body = req.body as { comment?: string };

  const absence = await rejectAbsence(req.params['id'] as string, user.userId, user.organizationId, db, body.comment);
  res.json({ data: absence });
}
