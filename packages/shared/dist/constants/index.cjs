"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/constants/index.ts
var constants_exports = {};
__export(constants_exports, {
  ABSENCE_STATUS_VALUES: () => ABSENCE_STATUS_VALUES,
  ABSENCE_TYPE_VALUES: () => ABSENCE_TYPE_VALUES,
  AUDIT_ACTION_VALUES: () => AUDIT_ACTION_VALUES,
  CONTRACT_TYPE_VALUES: () => CONTRACT_TYPE_VALUES,
  CORRECTION_STATUS_VALUES: () => CORRECTION_STATUS_VALUES,
  EMPLOYEE_CATEGORY_VALUES: () => EMPLOYEE_CATEGORY_VALUES,
  ENTRY_STATUS_VALUES: () => ENTRY_STATUS_VALUES,
  ERROR_CODES: () => ERROR_CODES,
  PERMISSIONS: () => PERMISSIONS,
  ROLES: () => ROLES,
  ROLE_VALUES: () => ROLE_VALUES,
  RULE_VIOLATION_VALUES: () => RULE_VIOLATION_VALUES,
  SCHEDULE_STATUS_VALUES: () => SCHEDULE_STATUS_VALUES,
  SHIFT_TYPE_VALUES: () => SHIFT_TYPE_VALUES,
  SWAP_STATUS_VALUES: () => SWAP_STATUS_VALUES
});
module.exports = __toCommonJS(constants_exports);

// src/constants/roles.ts
var ROLES = ["ADMIN", "MANAGER", "EMPLOYEE"];

// src/constants/permissions.ts
var PERMISSIONS = {
  "employees:write": ["ADMIN"],
  "employees:read": ["ADMIN", "MANAGER"],
  "shifts:write": ["ADMIN", "MANAGER"],
  "shifts:publish": ["ADMIN", "MANAGER"],
  "time:approve": ["ADMIN", "MANAGER"],
  "time:clock-self": ["ADMIN", "MANAGER", "EMPLOYEE"],
  "swaps:request": ["ADMIN", "MANAGER", "EMPLOYEE"],
  "swaps:approve": ["ADMIN", "MANAGER"],
  "absences:approve": ["ADMIN", "MANAGER"],
  "reports:export": ["ADMIN", "MANAGER"],
  "centers:manage": ["ADMIN"]
};

// src/constants/enums.ts
var ROLE_VALUES = ["ADMIN", "MANAGER", "EMPLOYEE"];
var EMPLOYEE_CATEGORY_VALUES = [
  "MEDICO",
  "ENFERMERO",
  "TCAE",
  "FISIOTERAPEUTA",
  "TERAPEUTA_OCUPACIONAL",
  "PSICOLOGO",
  "TRABAJADOR_SOCIAL",
  "CELADOR",
  "ADMINISTRATIVO",
  "COCINERO",
  "AUXILIAR_SERVICIOS"
];
var CONTRACT_TYPE_VALUES = [
  "INDEFINIDO",
  "TEMPORAL",
  "INTERINIDAD",
  "OBRA_Y_SERVICIO",
  "TIEMPO_PARCIAL"
];
var SHIFT_TYPE_VALUES = [
  "MANANA",
  "TARDE",
  "NOCHE",
  "GUARDIA",
  "RETEN",
  "REFUERZO",
  "LIBRANZA"
];
var SCHEDULE_STATUS_VALUES = ["DRAFT", "PUBLISHED", "ARCHIVED"];
var ABSENCE_TYPE_VALUES = [
  "VACACIONES",
  "IT",
  "PERMISO_RETRIBUIDO",
  "AUSENCIA_INJUSTIFICADA",
  "LACTANCIA",
  "REDUCCION_JORNADA"
];
var ABSENCE_STATUS_VALUES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
var ENTRY_STATUS_VALUES = ["OPEN", "CLOSED"];
var CORRECTION_STATUS_VALUES = ["PENDING", "APPROVED", "REJECTED"];
var SWAP_STATUS_VALUES = ["REQUESTED", "APPROVED", "REJECTED", "CANCELLED"];
var RULE_VIOLATION_VALUES = [
  "MIN_REST_12H",
  "MAX_DAILY_9H",
  "MAX_ANNUAL_OT_80H",
  "WEEKLY_REST_1_5_DAYS",
  "CATEGORY_COVERAGE",
  "SHIFT_OVERLAP"
];
var AUDIT_ACTION_VALUES = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "READ",
  "APPROVE",
  "REJECT",
  "PUBLISH",
  "LOGIN",
  "LOGOUT"
];

// src/constants/error-codes.ts
var ERROR_CODES = {
  // Generic
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  // Auth
  UNAUTHENTICATED: "UNAUTHENTICATED",
  INVALID_TOKEN: "INVALID_TOKEN",
  FORBIDDEN: "FORBIDDEN",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  TOKEN_BLOCKLISTED: "TOKEN_BLOCKLISTED",
  // Tenant
  NO_TENANT_CONTEXT: "NO_TENANT_CONTEXT",
  TENANT_MISMATCH: "TENANT_MISMATCH",
  // Rules engine
  RULE_VIOLATION: "RULE_VIOLATION",
  // Business
  DUPLICATE_CLOCK_IN: "DUPLICATE_CLOCK_IN",
  NO_OPEN_ENTRY: "NO_OPEN_ENTRY",
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  OVERLAPPING_ABSENCE: "OVERLAPPING_ABSENCE",
  SCHEDULE_ALREADY_PUBLISHED: "SCHEDULE_ALREADY_PUBLISHED",
  DEPENDENCY_CONFLICT: "DEPENDENCY_CONFLICT"
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ABSENCE_STATUS_VALUES,
  ABSENCE_TYPE_VALUES,
  AUDIT_ACTION_VALUES,
  CONTRACT_TYPE_VALUES,
  CORRECTION_STATUS_VALUES,
  EMPLOYEE_CATEGORY_VALUES,
  ENTRY_STATUS_VALUES,
  ERROR_CODES,
  PERMISSIONS,
  ROLES,
  ROLE_VALUES,
  RULE_VIOLATION_VALUES,
  SCHEDULE_STATUS_VALUES,
  SHIFT_TYPE_VALUES,
  SWAP_STATUS_VALUES
});
