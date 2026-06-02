import type { Request, Response } from 'express';
import { getDb, getUser } from '../../db-context';
import {
  clockIn,
  clockOut,
  listEntries,
  createCorrection,
  approveCorrection,
  rejectCorrection,
} from './time.service';

/**
 * POST /time-entries/clock-in
 * Satisfies FR-TIME-1, FR-TIME-3; acceptance: AC-TIME-1, AC-TIME-3
 */
export async function handleClockIn(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();
  const source = (req.body as { source?: string }).source ?? 'web';

  // Employee clocks in on their own behalf; employeeId comes from their auth token.
  // Admin/manager may specify a target employeeId in the body for kiosk/proxy use.
  const employeeId = (req.body as { employeeId?: string }).employeeId ?? user.employeeId ?? user.userId;

  const entry = await clockIn(employeeId, user.organizationId, db, source);
  res.status(201).json({ data: entry });
}

/**
 * POST /time-entries/clock-out
 */
export async function handleClockOut(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();

  const employeeId = (req.body as { employeeId?: string }).employeeId ?? user.employeeId ?? user.userId;

  const { entry, warnings } = await clockOut(employeeId, user.organizationId, db);
  res.status(200).json({ data: entry, warnings });
}

/**
 * GET /time-entries
 * Satisfies FR-TIME-10; acceptance: AC-TIME-4 (UPDATE attempt throws via trigger)
 */
export async function handleListEntries(req: Request, res: Response): Promise<void> {
  const db = getDb();
  const q = req.query as { employeeId?: string; from?: string; to?: string; status?: string };

  const entries = await listEntries(
    {
      employeeId: q.employeeId,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      status: q.status as 'OPEN' | 'CLOSED' | undefined,
    },
    db,
  );
  res.json({ data: entries });
}

/**
 * POST /time-corrections
 * Satisfies FR-TIME-5; acceptance: AC-TIME-5
 */
export async function handleCreateCorrection(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();
  const body = req.body as {
    timeEntryId: string;
    justification: string;
    proposedClockIn?: string;
    proposedClockOut?: string;
  };

  const correction = await createCorrection(
    {
      timeEntryId: body.timeEntryId,
      requestedById: user.userId,
      justification: body.justification,
      proposedClockIn: body.proposedClockIn ? new Date(body.proposedClockIn) : undefined,
      proposedClockOut: body.proposedClockOut ? new Date(body.proposedClockOut) : undefined,
    },
    user.organizationId,
    db,
  );
  res.status(201).json({ data: correction });
}

/**
 * POST /time-corrections/:id/approve
 * Satisfies FR-TIME-6, FR-TIME-7 [COMPLIANCE]; acceptance: AC-TIME-6
 */
export async function handleApproveCorrection(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();

  const correction = await approveCorrection(
    req.params['id'] as string,
    user.userId,
    user.organizationId,
    db,
  );
  res.json({ data: correction });
}

/**
 * POST /time-corrections/:id/reject
 */
export async function handleRejectCorrection(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();

  const correction = await rejectCorrection(
    req.params['id'] as string,
    user.userId,
    user.organizationId,
    db,
  );
  res.json({ data: correction });
}
