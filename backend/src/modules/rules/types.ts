import type { RuleViolation } from '@tempora/shared';

// ---------------------------------------------------------------------------
// Rules Engine — domain types (design §6)
// Pure TypeScript, no Express/Prisma imports.
// ---------------------------------------------------------------------------

export type RuleSeverity = 'block' | 'warn';

export interface RuleCheckResult {
  type: RuleSeverity;
  code: RuleViolation;
  message: string;
  meta?: Record<string, unknown>;
}

export interface RuleSetConfig {
  minRestHours: number;
  maxDailyHours: number;
  maxAnnualOvertime: number;
  weeklyRestDays: number;
  params: Record<string, unknown>;
}

// Context assembled by the calling service BEFORE invoking the engine.
// No I/O happens inside rule functions — all facts are pre-fetched here.
export interface AssignmentCandidate {
  kind: 'assignment';
  date: string;       // ISO date: "2026-06-15"
  startsAt: string;   // wall-clock: "07:00"
  endsAt: string;     // wall-clock: "15:00"  (< startsAt → crosses midnight)
}

export interface TimeEntryCandidate {
  kind: 'timeEntry';
  clockIn: string;    // ISO datetime
  clockOut?: string;  // ISO datetime (present on clock-out)
}

export type Candidate = AssignmentCandidate | TimeEntryCandidate;

export interface RecentAssignment {
  date: string;       // ISO date
  startsAt: string;   // wall-clock
  endsAt: string;     // wall-clock
}

export interface WeekAssignment {
  date: string;       // ISO date
  restDay: boolean;
}

export interface ApprovedAbsence {
  startDate: string; // ISO date: "2026-06-10"
  endDate: string;   // ISO date: "2026-06-14"
}

export interface RuleContext {
  organizationId: string;
  employeeId: string;
  candidate: Candidate;
  // Pre-fetched surrounding facts (no I/O inside rules):
  recentAssignments: RecentAssignment[];
  weekAssignments: WeekAssignment[];
  annualOvertimeHours: number;
  // Approved absences for the employee in the relevant period (FR-RULES-6).
  // Rules that count working days exclude days fully covered by an absence.
  approvedAbsences?: ApprovedAbsence[];
}

export interface Rule {
  code: RuleViolation;
  evaluate(ctx: RuleContext, cfg: RuleSetConfig): RuleCheckResult | null;
}

export interface RuleEngine {
  check(context: RuleContext, ruleSet: RuleSetConfig): RuleCheckResult[];
}
