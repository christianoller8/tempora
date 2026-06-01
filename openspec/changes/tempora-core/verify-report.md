# Verification Report: tempora-core Phase 1

**Verdict:** PARTIAL - 2 CRITICAL / 8 WARNING / 3 SUGGESTION

---

## A. Build Evidence

- npm run build:shared: PASS (CJS+ESM+DTS)
- tsc shared: PASS
- tsc backend: WARNING (TS5107,TS5101 missing ignoreDeprecations)
- prisma validate: PASS
- prisma migrate status: PASS - 20260601105235_initial applied
- Docker tempora-postgres: PASS - healthy

---

## B. Tests

Backend (Strict TDD ACTIVE): EXIT 1 - No test files found
Frontend ng test: FAILED - 13 TypeScript errors, 0 tests ran

Frontend error causes:
1. auth.store.spec.ts: use InstanceType<typeof AuthStore> not AuthStore as type
2. authInterceptor: inject(AuthStore) returns unknown; needs explicit cast
3. @ngrx/signals hoisted to root without @angular/core alongside it

---

## C. Task Completion

P1-1 to P1-22: DONE
P1-23 (migrate dev): DONE - migration applied; apply-progress.md stale (shows DEFERRED)
P1-24: DONE DEVIATION - files at prisma/rls/ not migrations/rls/
P1-25 to P1-26: DONE
P1-27 to P1-45: DONE
P1-46 to P1-54: DONE (WARNING: frontend specs fail type-check)
All 54 tasks have code artifacts.

---

## D. Spec Compliance (P1-scope)

FR-AUTH-1: WARNING - COOKIE_SAMESITE defaults to lax not strict
FR-AUTH-2: PASS - jti org role in signAccessToken
FR-AUTH-3: PASS - isBlocklisted() before token issue
FR-AUTH-4: WARNING - Logout PASS; Termination isActive=false not JTI blocklist
FR-AUTH-5: PASS - requireRole middleware
FR-AUTH-6: PASS - tenantContext + RLS
FR-AUTH-7: PASS - argon2id; no plaintext
FR-AUTH-8: CRITICAL - No CSRF mitigation implemented
FR-AUTH-9: WARNING - No blocklist cleanup job
FR-AUTH-10: PASS - GET /auth/me present
FR-AUDIT-3: PASS - INSERT-only grant on audit_logs
FR-AUDIT-5: PASS - RLS on AuditLog
FR-AUDIT-7: PASS - withTenant sets tx-local config
FR-ORG-1: PASS - Org/Center/Dept models
FR-ORG-2: PASS
FR-ORG-3: PASS - requireRole(ADMIN)
FR-ORG-6: PASS - employee count check before delete
FR-ORG-7: WARNING - Center hard delete (guarded); no deletedAt column
FR-EMP-1: PASS
FR-EMP-2: PASS - superRefine
FR-EMP-3: PASS
FR-EMP-5: PASS
FR-EMP-6: PASS
FR-EMP-7: PASS
FR-EMP-8: PASS
FR-EMP-9: WARNING - isActive=false; 15-min in-flight token window
FR-EMP-10: PASS
Cross-cut RLS 16 tables: PASS
Cross-cut Zod schemas: PASS
Cross-cut Error envelope: PASS
Cross-cut Pagination: WARNING - schemas exist but list endpoints not paginated

---

## E. Design Coherence

ADR-1 workspaces: PASS
ADR-3 Zod schemas: PASS
ADR-6 RLS fail-closed: PASS
Design 3.2 withTenant: PASS - set_config tx-local
Design 3.3 auth fallback: PASS
Design 3.4 middleware order: PASS
Design 8.1 RLS SQL: PASS - 16 tables
Design 8.2 TimeEntry trigger: PASS - BEFORE UPDATE/DELETE
RLS path (migrations/rls vs prisma/rls): TRACKED DEVIATION - run-rls.ts correct
AuditWriter 5-param sig: TRACKED DEVIATION - extra orgId; additive
Termination isActive=false: TRACKED DEVIATION - 15-min window
Center hard delete: TRACKED DEVIATION - no deletedAt
COOKIE_SAMESITE lax default: UNTRACKED DEVIATION - change to strict
CSRF not implemented: MISSING - FR-AUTH-8 violation

---

## F. Issues

### CRITICAL

CRIT-1: No backend unit tests (Strict TDD violation)
  Zero test files in backend/. vitest exits non-zero.
  P1-19 acceptance required: unit test verifies set_config call inside transaction.
  P1-20 acceptance required: getDb() throws when called without ALS store.
  Minimum tests before archive:
    - withTenant wraps fn in tx and calls set_config
    - getDb() throws outside tenant context
    - requireRole(ADMIN) rejects MANAGER (HTTP 403)
    - authenticate returns 401 on missing or invalid token
    - AuditWriter.write inserts exactly one row in same tx
    - CreateEmployeeSchema rejects TIEMPO_PARCIAL without contractedHoursPerWeek

CRIT-2: FR-AUTH-8 CSRF not implemented
  POST /auth/refresh reads httpOnly cookie with no CSRF mitigation.
  COOKIE_SAMESITE defaults to lax (spec requires Strict per FR-AUTH-1).
  Fix: change COOKIE_SAMESITE default to strict in env.ts.

### WARNING

WARN-1: backend/tsconfig.json missing ignoreDeprecations 6.0 (TS5107 TS5101)
WARN-2: Frontend spec type errors (13); use InstanceType<typeof AuthStore> not AuthStore as type
WARN-3: @ngrx/signals hoisting conflict; run tests via ng test from frontend/ only
WARN-4: Termination does not revoke in-flight tokens (isActive=false; 15-min window)
WARN-5: COOKIE_SAMESITE defaults to lax; FR-AUTH-1 requires Strict
WARN-6: listCenters and listEmployees not paginated; cross-cutting requirement
WARN-7: apply-progress.md marks P1-23 DEFERRED (stale; migration is applied)
WARN-8: softDeleteCenter is hard delete; Center model has no deletedAt column

### SUGGESTION

SUGG-1: Add .env.example documenting all required environment variables
SUGG-2: organizationRouter at /centers only; verify /centers/:id/departments covers AC-ORG-2
SUGG-3: AuditWriter atomicity (audit + mutation same tx) is asserted in comments but not tested

---

## G. Final Verdict

Status: PARTIAL
Critical: 2 | Warning: 8 | Suggestion: 3
Build: PASS (shared) / WARNING (backend tsconfig)
Tests: FAIL (0 backend test files; 0 frontend tests ran)
Schema: PASS (valid + migrated against live DB)
RLS: PASS (16 tables covered; applied via npm run db:rls)
Next recommended: sdd-apply (targeted) to write backend unit tests, fix CSRF default, fix frontend spec type annotations, add ignoreDeprecations to backend tsconfig
