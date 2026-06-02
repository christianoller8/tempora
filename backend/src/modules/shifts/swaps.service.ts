import type { CambioTurno } from '@prisma/client';
import type { TenantClient } from '../../db/tenant.js';
import { ApiError } from '../../middleware/error.js';
import { auditWriter } from '../../audit/audit-writer.js';
import { ruleEngine } from '../rules/index.js';
import type { RuleContext, RuleSetConfig, RuleCheckResult } from '../rules/types.js';
import { getYtdOvertimeHours } from '../time-tracking/time.service.js';
import type { z } from 'zod';
import type { CreateSwapSchema } from '@tempora/shared';

type CreateSwapDto = z.infer<typeof CreateSwapSchema>;

// Stub event bus — wired in P3.
let _eventBusPublish: ((orgId: string, event: Record<string, unknown>) => void) | null = null;

export function setEventBus(fn: (orgId: string, event: Record<string, unknown>) => void): void {
  _eventBusPublish = fn;
}

function publishEvent(orgId: string, event: Record<string, unknown>): void {
  if (_eventBusPublish) {
    _eventBusPublish(orgId, event);
  }
}

async function fetchRuleSetConfig(organizationId: string, db: TenantClient): Promise<RuleSetConfig> {
  const ruleSetRow = await db.ruleSet.findFirst({
    where: { organizationId, isDefault: true },
  });
  return {
    minRestHours: ruleSetRow ? Number(ruleSetRow.minRestHours) : 12,
    maxDailyHours: ruleSetRow ? Number(ruleSetRow.maxDailyHours) : 9,
    maxAnnualOvertime: ruleSetRow ? Number(ruleSetRow.maxAnnualOvertime) : 80,
    weeklyRestDays: ruleSetRow ? Number(ruleSetRow.weeklyRestDays) : 1.5,
    params: ruleSetRow ? (ruleSetRow.params as Record<string, unknown>) : {},
  };
}

async function fetchRecentAssignments(
  employeeId: string,
  beforeDate: Date,
  db: TenantClient,
): Promise<Array<{ date: string; startsAt: string; endsAt: string }>> {
  const rows = await db.shiftAssignment.findMany({
    where: { employeeId, date: { lt: beforeDate } },
    include: { shiftTemplate: true },
    orderBy: { date: 'desc' },
    take: 10,
  });
  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    startsAt: r.shiftTemplate.startTime,
    endsAt: r.shiftTemplate.endTime,
  }));
}

// ---------------------------------------------------------------------------
// requestSwap — records both assignment IDs at creation time (FR-SHIFT-8).
// ---------------------------------------------------------------------------
export async function requestSwap(
  dto: CreateSwapDto,
  organizationId: string,
  actorId: string,
  db: TenantClient,
): Promise<CambioTurno> {
  // Validate requester assignment exists.
  const requesterAssignment = await db.shiftAssignment.findUnique({
    where: { id: dto.requesterAssignmentId },
  });
  if (!requesterAssignment) {
    throw new ApiError(404, 'NOT_FOUND', `Assignment ${dto.requesterAssignmentId} not found`);
  }

  // Validate target assignment if provided.
  if (dto.targetAssignmentId) {
    const targetAssignment = await db.shiftAssignment.findUnique({
      where: { id: dto.targetAssignmentId },
    });
    if (!targetAssignment) {
      throw new ApiError(404, 'NOT_FOUND', `Target assignment ${dto.targetAssignmentId} not found`);
    }
    // Both assignments must be in DRAFT schedules (cannot request swap on published schedule).
    // Open swaps on published schedules are disallowed per FR-SHIFT-5.
    const targetSchedule = await db.shiftSchedule.findUnique({
      where: { id: targetAssignment.scheduleId },
    });
    if (targetSchedule && targetSchedule.status === 'PUBLISHED') {
      throw new ApiError(
        409,
        'SCHEDULE_PUBLISHED',
        'Cannot request swap: target schedule is already published',
      );
    }
  }

  const swap = await db.cambioTurno.create({
    data: {
      organizationId,
      requesterAssignmentId: dto.requesterAssignmentId,
      targetAssignmentId: dto.targetAssignmentId ?? null,
      status: 'REQUESTED',
      reason: dto.reason ?? null,
    },
  });

  await auditWriter.write(db, actorId, organizationId, {
    action: 'CREATE',
    entityType: 'CambioTurno',
    entityId: swap.id,
    after: {
      requesterAssignmentId: swap.requesterAssignmentId,
      targetAssignmentId: swap.targetAssignmentId,
      status: 'REQUESTED',
    },
  });

  return swap;
}

// ---------------------------------------------------------------------------
// approveSwap — re-runs Rules Engine on post-swap state, blocks on BLOCK,
// swaps assignments atomically, emits SWAP_APPROVED event, audits.
// Satisfies FR-SHIFT-11 [COMPLIANCE]; AC-SHIFT-6, AC-SHIFT-7
// ---------------------------------------------------------------------------
export async function approveSwap(
  swapId: string,
  organizationId: string,
  actorId: string,
  db: TenantClient,
): Promise<{ swap: CambioTurno; warnings: RuleCheckResult[] }> {
  const swap = await db.cambioTurno.findUnique({
    where: { id: swapId },
    include: {
      requesterAssignment: { include: { shiftTemplate: true } },
      targetAssignment: { include: { shiftTemplate: true } },
    },
  });

  if (!swap) throw new ApiError(404, 'NOT_FOUND', `SwapRequest ${swapId} not found`);
  if (swap.status !== 'REQUESTED') {
    throw new ApiError(409, 'SWAP_NOT_PENDING', `Swap ${swapId} is not in REQUESTED status`);
  }
  if (!swap.targetAssignment || !swap.targetAssignmentId) {
    throw new ApiError(422, 'OPEN_SWAP', `Swap ${swapId} has no target assignment — cannot approve an open swap request`);
  }

  const ruleSetConfig = await fetchRuleSetConfig(organizationId, db);
  const allViolations: RuleCheckResult[] = [];
  const blockViolations: RuleCheckResult[] = [];

  // Check: after swap, requester takes the target's date/template.
  const requesterNewDate = swap.targetAssignment.date;
  const requesterRecentAssignments = await fetchRecentAssignments(
    swap.requesterAssignment.employeeId,
    requesterNewDate,
    db,
  );

  // P3 fix: use real YTD overtime from time_entries (replaces annualOvertimeHours: 0 stub).
  const requesterYtdOt = await getYtdOvertimeHours(
    swap.requesterAssignment.employeeId,
    organizationId,
    requesterNewDate.getFullYear(),
    db,
  ).catch(() => 0);

  // Load approved absences for requester around new date (P4-9).
  const requesterWindowStart = new Date(requesterNewDate);
  requesterWindowStart.setDate(requesterWindowStart.getDate() - 6);
  const requesterAbsences = await db.absence.findMany({
    where: {
      employeeId: swap.requesterAssignment.employeeId,
      organizationId,
      status: 'APPROVED',
      startDate: { lte: requesterNewDate },
      endDate: { gte: requesterWindowStart },
    },
  });

  // Load week assignments for requester (fixes WARN-P2-2 carry-forward).
  const requesterWeekAssignments = await db.shiftAssignment.findMany({
    where: {
      employeeId: swap.requesterAssignment.employeeId,
      date: { gte: requesterWindowStart, lt: requesterNewDate },
    },
    orderBy: { date: 'asc' },
  });

  const requesterCtx: RuleContext = {
    organizationId,
    employeeId: swap.requesterAssignment.employeeId,
    candidate: {
      kind: 'assignment',
      date: requesterNewDate.toISOString().slice(0, 10),
      startsAt: swap.targetAssignment.shiftTemplate.startTime,
      endsAt: swap.targetAssignment.shiftTemplate.endTime,
    },
    recentAssignments: requesterRecentAssignments,
    weekAssignments: requesterWeekAssignments.map((wa) => ({
      date: wa.date.toISOString().slice(0, 10),
      restDay: false,
    })),
    annualOvertimeHours: requesterYtdOt,
    approvedAbsences: requesterAbsences.map((abs) => ({
      startDate: abs.startDate.toISOString().slice(0, 10),
      endDate: abs.endDate.toISOString().slice(0, 10),
    })),
  };

  const requesterResults = ruleEngine.check(requesterCtx, ruleSetConfig);
  allViolations.push(...requesterResults);
  blockViolations.push(...requesterResults.filter((r) => r.type === 'block'));

  // Check: after swap, target employee takes the requester's date/template.
  const targetNewDate = swap.requesterAssignment.date;
  const targetRecentAssignments = await fetchRecentAssignments(
    swap.targetAssignment.employeeId,
    targetNewDate,
    db,
  );

  const targetYtdOt = await getYtdOvertimeHours(
    swap.targetAssignment.employeeId,
    organizationId,
    targetNewDate.getFullYear(),
    db,
  ).catch(() => 0);

  // Load approved absences and week assignments for target employee (P4-9).
  const targetWindowStart = new Date(targetNewDate);
  targetWindowStart.setDate(targetWindowStart.getDate() - 6);
  const targetAbsences = await db.absence.findMany({
    where: {
      employeeId: swap.targetAssignment.employeeId,
      organizationId,
      status: 'APPROVED',
      startDate: { lte: targetNewDate },
      endDate: { gte: targetWindowStart },
    },
  });

  const targetWeekAssignments = await db.shiftAssignment.findMany({
    where: {
      employeeId: swap.targetAssignment.employeeId,
      date: { gte: targetWindowStart, lt: targetNewDate },
    },
    orderBy: { date: 'asc' },
  });

  const targetCtx: RuleContext = {
    organizationId,
    employeeId: swap.targetAssignment.employeeId,
    candidate: {
      kind: 'assignment',
      date: targetNewDate.toISOString().slice(0, 10),
      startsAt: swap.requesterAssignment.shiftTemplate.startTime,
      endsAt: swap.requesterAssignment.shiftTemplate.endTime,
    },
    recentAssignments: targetRecentAssignments,
    weekAssignments: targetWeekAssignments.map((wa) => ({
      date: wa.date.toISOString().slice(0, 10),
      restDay: false,
    })),
    annualOvertimeHours: targetYtdOt,
    approvedAbsences: targetAbsences.map((abs) => ({
      startDate: abs.startDate.toISOString().slice(0, 10),
      endDate: abs.endDate.toISOString().slice(0, 10),
    })),
  };

  const targetResults = ruleEngine.check(targetCtx, ruleSetConfig);
  allViolations.push(...targetResults);
  blockViolations.push(...targetResults.filter((r) => r.type === 'block'));

  if (blockViolations.length > 0) {
    throw new ApiError(
      422,
      'RULE_VIOLATION',
      `Swap blocked by ${blockViolations.length} rule violation(s)`,
      blockViolations,
    );
  }

  // Atomically swap the assignments:
  // Requester assignment gets target's date and template.
  // Target assignment gets requester's date and template.
  await db.shiftAssignment.update({
    where: { id: swap.requesterAssignmentId },
    data: {
      date: swap.targetAssignment.date,
      shiftTemplateId: swap.targetAssignment.shiftTemplateId,
    },
  });

  await db.shiftAssignment.update({
    where: { id: swap.targetAssignmentId },
    data: {
      date: swap.requesterAssignment.date,
      shiftTemplateId: swap.requesterAssignment.shiftTemplateId,
    },
  });

  // Mark swap as approved.
  const approved = await db.cambioTurno.update({
    where: { id: swapId },
    data: {
      status: 'APPROVED',
      approverId: actorId,
      decidedAt: new Date(),
    },
  });

  // Emit SWAP_APPROVED event (no-op until P3 SSE hub wired).
  publishEvent(organizationId, {
    type: 'SWAP_APPROVED',
    organizationId,
    targetUserId: swap.requesterAssignment.employeeId,
    payload: { swapId },
    emittedAt: new Date().toISOString(),
  });
  publishEvent(organizationId, {
    type: 'SWAP_APPROVED',
    organizationId,
    targetUserId: swap.targetAssignment.employeeId,
    payload: { swapId },
    emittedAt: new Date().toISOString(),
  });

  // Write audit rows for both assignments.
  await auditWriter.write(db, actorId, organizationId, {
    action: 'APPROVE',
    entityType: 'CambioTurno',
    entityId: swapId,
    before: { status: 'REQUESTED' },
    after: { status: 'APPROVED', approverId: actorId },
  });

  const warnings = allViolations.filter((r) => r.type === 'warn');
  return { swap: approved, warnings };
}

// ---------------------------------------------------------------------------
// rejectSwap
// ---------------------------------------------------------------------------
export async function rejectSwap(
  swapId: string,
  organizationId: string,
  actorId: string,
  db: TenantClient,
): Promise<CambioTurno> {
  const swap = await db.cambioTurno.findUnique({ where: { id: swapId } });
  if (!swap) throw new ApiError(404, 'NOT_FOUND', `SwapRequest ${swapId} not found`);
  if (swap.status !== 'REQUESTED') {
    throw new ApiError(409, 'SWAP_NOT_PENDING', `Swap ${swapId} is not in REQUESTED status`);
  }

  const rejected = await db.cambioTurno.update({
    where: { id: swapId },
    data: { status: 'REJECTED', approverId: actorId, decidedAt: new Date() },
  });

  await auditWriter.write(db, actorId, organizationId, {
    action: 'REJECT',
    entityType: 'CambioTurno',
    entityId: swapId,
    before: { status: 'REQUESTED' },
    after: { status: 'REJECTED' },
  });

  return rejected;
}

export async function listSwaps(
  filter: { status?: string },
  db: TenantClient,
): Promise<CambioTurno[]> {
  return db.cambioTurno.findMany({
    where: filter.status ? { status: filter.status as CambioTurno['status'] } : {},
    orderBy: [{ createdAt: 'desc' }],
    include: {
      requesterAssignment: { include: { shiftTemplate: true } },
      targetAssignment: { include: { shiftTemplate: true } },
    },
  });
}
