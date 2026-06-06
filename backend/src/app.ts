import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler } from './middleware/error';
import { authenticate } from './middleware/auth';
import { tenantContext } from './middleware/tenant-context';
import { iamRouter } from './modules/iam/iam.router';
import { organizationRouter } from './modules/organization/organization.router';
import { employeesRouter } from './modules/employees/employees.router';
import { shiftsRouter } from './modules/shifts/shifts.router';
import { timeRouter } from './modules/time-tracking/time.router';
import { absencesRouter } from './modules/absences/absences.router';
import { rulesetRouter } from './modules/rules/ruleset.router';
import { notificationsRouter } from './modules/notifications/notifications.router';
import { reportingRouter } from './modules/reporting/reporting.router';
import { timesheetSignatureRouter } from './modules/timesheet-signature/timesheet-signature.router';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Public health check — no auth required.
  app.get('/healthz', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

  // Auth routes — login/refresh are public; logout/me use authenticate inside the router.
  app.use('/auth', iamRouter);

  // SSE endpoint — authenticate but NOT tenantContext (long-lived connection,
  // org is read from req.user directly by the stream handler).
  app.use('/notifications', authenticate, notificationsRouter);

  // All remaining routes require authentication + tenant context.
  app.use(authenticate);
  app.use(tenantContext);

  app.use('/centers', organizationRouter);
  app.use('/employees', employeesRouter);
  app.use('/shifts', shiftsRouter);

  // Time tracking — mounted on both prefixes per design §3.5.
  app.use('/time-entries', timeRouter);
  app.use('/time-corrections', timeRouter);

  // Absences — satisfies FR-ABS-1..7 [GDPR].
  app.use('/absences', absencesRouter);

  // RuleSet admin — satisfies FR-RULES-2, FR-RULES-4.
  app.use('/rule-sets', rulesetRouter);

  // Reporting — satisfies FR-REP-1..9 [GDPR] [COMPLIANCE].
  app.use('/reports', reportingRouter);

  // Timesheet Signature — satisfies FR-TSS-001..014 [COMPLIANCE].
  app.use('/timesheet-signatures', timesheetSignatureRouter);

  // Central error handler must be last.
  app.use(errorHandler);

  return app;
}
