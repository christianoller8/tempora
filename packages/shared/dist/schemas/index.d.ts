import { z } from 'zod';

declare const UuidSchema: z.ZodString;
declare const IsoDateSchema: z.ZodString;
declare const IsoDateTimeSchema: z.ZodString;
declare const PaginationQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
declare function PaginatedResultSchema<T extends z.ZodTypeAny>(itemSchema: T): z.ZodObject<{
    data: z.ZodArray<T, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodNumber;
    totalPages: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    data: T["_output"][];
    total: number;
    totalPages: number;
}, {
    page: number;
    pageSize: number;
    data: T["_input"][];
    total: number;
    totalPages: number;
}>;
declare const ErrorEnvelopeSchema: z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
    details: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    code: string;
    message: string;
    details?: unknown;
}, {
    code: string;
    message: string;
    details?: unknown;
}>;

declare const LoginRequestSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
declare const LoginResponseSchema: z.ZodObject<{
    accessToken: z.ZodString;
    user: z.ZodObject<{
        id: z.ZodString;
        email: z.ZodString;
        role: z.ZodEnum<["ADMIN", "MANAGER", "EMPLOYEE"]>;
        organizationId: z.ZodString;
        employeeId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        email: string;
        id: string;
        role: "ADMIN" | "MANAGER" | "EMPLOYEE";
        organizationId: string;
        employeeId: string | null;
    }, {
        email: string;
        id: string;
        role: "ADMIN" | "MANAGER" | "EMPLOYEE";
        organizationId: string;
        employeeId: string | null;
    }>;
}, "strip", z.ZodTypeAny, {
    accessToken: string;
    user: {
        email: string;
        id: string;
        role: "ADMIN" | "MANAGER" | "EMPLOYEE";
        organizationId: string;
        employeeId: string | null;
    };
}, {
    accessToken: string;
    user: {
        email: string;
        id: string;
        role: "ADMIN" | "MANAGER" | "EMPLOYEE";
        organizationId: string;
        employeeId: string | null;
    };
}>;
declare const RefreshResponseSchema: z.ZodObject<{
    accessToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    accessToken: string;
}, {
    accessToken: string;
}>;
declare const MeResponseSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    role: z.ZodEnum<["ADMIN", "MANAGER", "EMPLOYEE"]>;
    organizationId: z.ZodString;
    employeeId: z.ZodNullable<z.ZodString>;
    isActive: z.ZodBoolean;
    lastLoginAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    id: string;
    role: "ADMIN" | "MANAGER" | "EMPLOYEE";
    organizationId: string;
    employeeId: string | null;
    isActive: boolean;
    lastLoginAt: string | null;
}, {
    email: string;
    id: string;
    role: "ADMIN" | "MANAGER" | "EMPLOYEE";
    organizationId: string;
    employeeId: string | null;
    isActive: boolean;
    lastLoginAt: string | null;
}>;

declare const CreateOrganizationSchema: z.ZodObject<{
    name: z.ZodString;
    cif: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    cif?: string | undefined;
}, {
    name: string;
    cif?: string | undefined;
}>;
declare const UpdateOrganizationSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    cif: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    cif?: string | undefined;
}, {
    name?: string | undefined;
    cif?: string | undefined;
}>;
declare const OrganizationResponseSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    cif: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    cif: string | null;
    createdAt: string;
    updatedAt: string;
}, {
    id: string;
    name: string;
    cif: string | null;
    createdAt: string;
    updatedAt: string;
}>;
declare const CreateCenterSchema: z.ZodObject<{
    name: z.ZodString;
    address: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    address?: string | undefined;
}, {
    name: string;
    address?: string | undefined;
}>;
declare const UpdateCenterSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    address?: string | undefined;
}, {
    name?: string | undefined;
    address?: string | undefined;
}>;
declare const CenterResponseSchema: z.ZodObject<{
    id: z.ZodString;
    organizationId: z.ZodString;
    name: z.ZodString;
    address: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    organizationId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    address: string | null;
}, {
    id: string;
    organizationId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    address: string | null;
}>;
declare const CreateDepartmentSchema: z.ZodObject<{
    centerId: z.ZodString;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    centerId: string;
}, {
    name: string;
    centerId: string;
}>;
declare const UpdateDepartmentSchema: z.ZodObject<Omit<{
    centerId: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
}, "centerId">, "strip", z.ZodTypeAny, {
    name?: string | undefined;
}, {
    name?: string | undefined;
}>;
declare const DepartmentResponseSchema: z.ZodObject<{
    id: z.ZodString;
    organizationId: z.ZodString;
    centerId: z.ZodString;
    name: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    organizationId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    centerId: string;
}, {
    id: string;
    organizationId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    centerId: string;
}>;

declare const WorkingCalendarSchema: z.ZodObject<{
    id: z.ZodString;
    organizationId: z.ZodString;
    name: z.ZodString;
    year: z.ZodNumber;
    annualHours: z.ZodNumber;
    holidays: z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        date: string;
        label: string;
    }, {
        date: string;
        label: string;
    }>, "many">;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    organizationId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    year: number;
    annualHours: number;
    holidays: {
        date: string;
        label: string;
    }[];
}, {
    id: string;
    organizationId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    year: number;
    annualHours: number;
    holidays: {
        date: string;
        label: string;
    }[];
}>;
declare const CreateWorkingCalendarSchema: z.ZodObject<{
    name: z.ZodString;
    year: z.ZodNumber;
    annualHours: z.ZodNumber;
    holidays: z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        date: string;
        label: string;
    }, {
        date: string;
        label: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    year: number;
    annualHours: number;
    holidays: {
        date: string;
        label: string;
    }[];
}, {
    name: string;
    year: number;
    annualHours: number;
    holidays: {
        date: string;
        label: string;
    }[];
}>;
declare const CreateEmployeeSchema: z.ZodEffects<z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodString;
    nif: z.ZodOptional<z.ZodString>;
    category: z.ZodEnum<["MEDICO", "ENFERMERO", "TCAE", "FISIOTERAPEUTA", "TERAPEUTA_OCUPACIONAL", "PSICOLOGO", "TRABAJADOR_SOCIAL", "CELADOR", "ADMINISTRATIVO", "COCINERO", "AUXILIAR_SERVICIOS"]>;
    contractType: z.ZodEnum<["INDEFINIDO", "TEMPORAL", "INTERINIDAD", "OBRA_Y_SERVICIO", "TIEMPO_PARCIAL"]>;
    contractedHoursPerWeek: z.ZodOptional<z.ZodNumber>;
    primaryCenterId: z.ZodString;
    workingCalendarId: z.ZodOptional<z.ZodString>;
    hireDate: z.ZodString;
}, "strip", z.ZodTypeAny, {
    firstName: string;
    lastName: string;
    category: "MEDICO" | "ENFERMERO" | "TCAE" | "FISIOTERAPEUTA" | "TERAPEUTA_OCUPACIONAL" | "PSICOLOGO" | "TRABAJADOR_SOCIAL" | "CELADOR" | "ADMINISTRATIVO" | "COCINERO" | "AUXILIAR_SERVICIOS";
    contractType: "INDEFINIDO" | "TEMPORAL" | "INTERINIDAD" | "OBRA_Y_SERVICIO" | "TIEMPO_PARCIAL";
    primaryCenterId: string;
    hireDate: string;
    nif?: string | undefined;
    contractedHoursPerWeek?: number | undefined;
    workingCalendarId?: string | undefined;
}, {
    firstName: string;
    lastName: string;
    category: "MEDICO" | "ENFERMERO" | "TCAE" | "FISIOTERAPEUTA" | "TERAPEUTA_OCUPACIONAL" | "PSICOLOGO" | "TRABAJADOR_SOCIAL" | "CELADOR" | "ADMINISTRATIVO" | "COCINERO" | "AUXILIAR_SERVICIOS";
    contractType: "INDEFINIDO" | "TEMPORAL" | "INTERINIDAD" | "OBRA_Y_SERVICIO" | "TIEMPO_PARCIAL";
    primaryCenterId: string;
    hireDate: string;
    nif?: string | undefined;
    contractedHoursPerWeek?: number | undefined;
    workingCalendarId?: string | undefined;
}>, {
    firstName: string;
    lastName: string;
    category: "MEDICO" | "ENFERMERO" | "TCAE" | "FISIOTERAPEUTA" | "TERAPEUTA_OCUPACIONAL" | "PSICOLOGO" | "TRABAJADOR_SOCIAL" | "CELADOR" | "ADMINISTRATIVO" | "COCINERO" | "AUXILIAR_SERVICIOS";
    contractType: "INDEFINIDO" | "TEMPORAL" | "INTERINIDAD" | "OBRA_Y_SERVICIO" | "TIEMPO_PARCIAL";
    primaryCenterId: string;
    hireDate: string;
    nif?: string | undefined;
    contractedHoursPerWeek?: number | undefined;
    workingCalendarId?: string | undefined;
}, {
    firstName: string;
    lastName: string;
    category: "MEDICO" | "ENFERMERO" | "TCAE" | "FISIOTERAPEUTA" | "TERAPEUTA_OCUPACIONAL" | "PSICOLOGO" | "TRABAJADOR_SOCIAL" | "CELADOR" | "ADMINISTRATIVO" | "COCINERO" | "AUXILIAR_SERVICIOS";
    contractType: "INDEFINIDO" | "TEMPORAL" | "INTERINIDAD" | "OBRA_Y_SERVICIO" | "TIEMPO_PARCIAL";
    primaryCenterId: string;
    hireDate: string;
    nif?: string | undefined;
    contractedHoursPerWeek?: number | undefined;
    workingCalendarId?: string | undefined;
}>;
declare const UpdateEmployeeSchema: z.ZodObject<{
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    nif: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    category: z.ZodOptional<z.ZodEnum<["MEDICO", "ENFERMERO", "TCAE", "FISIOTERAPEUTA", "TERAPEUTA_OCUPACIONAL", "PSICOLOGO", "TRABAJADOR_SOCIAL", "CELADOR", "ADMINISTRATIVO", "COCINERO", "AUXILIAR_SERVICIOS"]>>;
    contractType: z.ZodOptional<z.ZodEnum<["INDEFINIDO", "TEMPORAL", "INTERINIDAD", "OBRA_Y_SERVICIO", "TIEMPO_PARCIAL"]>>;
    contractedHoursPerWeek: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    primaryCenterId: z.ZodOptional<z.ZodString>;
    workingCalendarId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    hireDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    firstName?: string | undefined;
    lastName?: string | undefined;
    nif?: string | undefined;
    category?: "MEDICO" | "ENFERMERO" | "TCAE" | "FISIOTERAPEUTA" | "TERAPEUTA_OCUPACIONAL" | "PSICOLOGO" | "TRABAJADOR_SOCIAL" | "CELADOR" | "ADMINISTRATIVO" | "COCINERO" | "AUXILIAR_SERVICIOS" | undefined;
    contractType?: "INDEFINIDO" | "TEMPORAL" | "INTERINIDAD" | "OBRA_Y_SERVICIO" | "TIEMPO_PARCIAL" | undefined;
    contractedHoursPerWeek?: number | undefined;
    primaryCenterId?: string | undefined;
    workingCalendarId?: string | undefined;
    hireDate?: string | undefined;
}, {
    firstName?: string | undefined;
    lastName?: string | undefined;
    nif?: string | undefined;
    category?: "MEDICO" | "ENFERMERO" | "TCAE" | "FISIOTERAPEUTA" | "TERAPEUTA_OCUPACIONAL" | "PSICOLOGO" | "TRABAJADOR_SOCIAL" | "CELADOR" | "ADMINISTRATIVO" | "COCINERO" | "AUXILIAR_SERVICIOS" | undefined;
    contractType?: "INDEFINIDO" | "TEMPORAL" | "INTERINIDAD" | "OBRA_Y_SERVICIO" | "TIEMPO_PARCIAL" | undefined;
    contractedHoursPerWeek?: number | undefined;
    primaryCenterId?: string | undefined;
    workingCalendarId?: string | undefined;
    hireDate?: string | undefined;
}>;
declare const EmployeeResponseSchema: z.ZodObject<{
    id: z.ZodString;
    organizationId: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    nif: z.ZodNullable<z.ZodString>;
    category: z.ZodEnum<["MEDICO", "ENFERMERO", "TCAE", "FISIOTERAPEUTA", "TERAPEUTA_OCUPACIONAL", "PSICOLOGO", "TRABAJADOR_SOCIAL", "CELADOR", "ADMINISTRATIVO", "COCINERO", "AUXILIAR_SERVICIOS"]>;
    contractType: z.ZodEnum<["INDEFINIDO", "TEMPORAL", "INTERINIDAD", "OBRA_Y_SERVICIO", "TIEMPO_PARCIAL"]>;
    contractedHoursPerWeek: z.ZodNumber;
    primaryCenterId: z.ZodString;
    workingCalendarId: z.ZodNullable<z.ZodString>;
    hireDate: z.ZodString;
    terminationDate: z.ZodNullable<z.ZodString>;
    isActive: z.ZodBoolean;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    organizationId: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    firstName: string;
    lastName: string;
    nif: string | null;
    category: "MEDICO" | "ENFERMERO" | "TCAE" | "FISIOTERAPEUTA" | "TERAPEUTA_OCUPACIONAL" | "PSICOLOGO" | "TRABAJADOR_SOCIAL" | "CELADOR" | "ADMINISTRATIVO" | "COCINERO" | "AUXILIAR_SERVICIOS";
    contractType: "INDEFINIDO" | "TEMPORAL" | "INTERINIDAD" | "OBRA_Y_SERVICIO" | "TIEMPO_PARCIAL";
    contractedHoursPerWeek: number;
    primaryCenterId: string;
    workingCalendarId: string | null;
    hireDate: string;
    terminationDate: string | null;
}, {
    id: string;
    organizationId: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    firstName: string;
    lastName: string;
    nif: string | null;
    category: "MEDICO" | "ENFERMERO" | "TCAE" | "FISIOTERAPEUTA" | "TERAPEUTA_OCUPACIONAL" | "PSICOLOGO" | "TRABAJADOR_SOCIAL" | "CELADOR" | "ADMINISTRATIVO" | "COCINERO" | "AUXILIAR_SERVICIOS";
    contractType: "INDEFINIDO" | "TEMPORAL" | "INTERINIDAD" | "OBRA_Y_SERVICIO" | "TIEMPO_PARCIAL";
    contractedHoursPerWeek: number;
    primaryCenterId: string;
    workingCalendarId: string | null;
    hireDate: string;
    terminationDate: string | null;
}>;

declare const ShiftTemplateSchema: z.ZodObject<{
    name: z.ZodString;
    shiftType: z.ZodEnum<["MANANA", "TARDE", "NOCHE", "GUARDIA", "RETEN", "REFUERZO", "LIBRANZA"]>;
    startTime: z.ZodString;
    endTime: z.ZodString;
    crossesMidnight: z.ZodDefault<z.ZodBoolean>;
    breakMinutes: z.ZodDefault<z.ZodNumber>;
    categoryRequirements: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    shiftType: "MANANA" | "TARDE" | "NOCHE" | "GUARDIA" | "RETEN" | "REFUERZO" | "LIBRANZA";
    startTime: string;
    endTime: string;
    crossesMidnight: boolean;
    breakMinutes: number;
    categoryRequirements?: Record<string, number> | undefined;
}, {
    name: string;
    shiftType: "MANANA" | "TARDE" | "NOCHE" | "GUARDIA" | "RETEN" | "REFUERZO" | "LIBRANZA";
    startTime: string;
    endTime: string;
    crossesMidnight?: boolean | undefined;
    breakMinutes?: number | undefined;
    categoryRequirements?: Record<string, number> | undefined;
}>;
declare const ShiftTemplateResponseSchema: z.ZodObject<{
    name: z.ZodString;
    shiftType: z.ZodEnum<["MANANA", "TARDE", "NOCHE", "GUARDIA", "RETEN", "REFUERZO", "LIBRANZA"]>;
    startTime: z.ZodString;
    endTime: z.ZodString;
    crossesMidnight: z.ZodDefault<z.ZodBoolean>;
    breakMinutes: z.ZodDefault<z.ZodNumber>;
    categoryRequirements: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
} & {
    id: z.ZodString;
    organizationId: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    organizationId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    shiftType: "MANANA" | "TARDE" | "NOCHE" | "GUARDIA" | "RETEN" | "REFUERZO" | "LIBRANZA";
    startTime: string;
    endTime: string;
    crossesMidnight: boolean;
    breakMinutes: number;
    categoryRequirements?: Record<string, number> | undefined;
}, {
    id: string;
    organizationId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    shiftType: "MANANA" | "TARDE" | "NOCHE" | "GUARDIA" | "RETEN" | "REFUERZO" | "LIBRANZA";
    startTime: string;
    endTime: string;
    crossesMidnight?: boolean | undefined;
    breakMinutes?: number | undefined;
    categoryRequirements?: Record<string, number> | undefined;
}>;
declare const RotationPatternSchema: z.ZodObject<{
    name: z.ZodString;
    cycleLength: z.ZodNumber;
    cycle: z.ZodArray<z.ZodObject<{
        day: z.ZodNumber;
        shiftTemplateId: z.ZodOptional<z.ZodString>;
        libranza: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        day: number;
        shiftTemplateId?: string | undefined;
        libranza?: boolean | undefined;
    }, {
        day: number;
        shiftTemplateId?: string | undefined;
        libranza?: boolean | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    cycleLength: number;
    cycle: {
        day: number;
        shiftTemplateId?: string | undefined;
        libranza?: boolean | undefined;
    }[];
}, {
    name: string;
    cycleLength: number;
    cycle: {
        day: number;
        shiftTemplateId?: string | undefined;
        libranza?: boolean | undefined;
    }[];
}>;
declare const RotationPatternResponseSchema: z.ZodObject<{
    name: z.ZodString;
    cycleLength: z.ZodNumber;
    cycle: z.ZodArray<z.ZodObject<{
        day: z.ZodNumber;
        shiftTemplateId: z.ZodOptional<z.ZodString>;
        libranza: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        day: number;
        shiftTemplateId?: string | undefined;
        libranza?: boolean | undefined;
    }, {
        day: number;
        shiftTemplateId?: string | undefined;
        libranza?: boolean | undefined;
    }>, "many">;
} & {
    id: z.ZodString;
    organizationId: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    organizationId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    cycleLength: number;
    cycle: {
        day: number;
        shiftTemplateId?: string | undefined;
        libranza?: boolean | undefined;
    }[];
}, {
    id: string;
    organizationId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    cycleLength: number;
    cycle: {
        day: number;
        shiftTemplateId?: string | undefined;
        libranza?: boolean | undefined;
    }[];
}>;
declare const CreateScheduleSchema: z.ZodObject<{
    centerId: z.ZodString;
    departmentId: z.ZodOptional<z.ZodString>;
    year: z.ZodNumber;
    month: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    centerId: string;
    year: number;
    month: number;
    departmentId?: string | undefined;
}, {
    centerId: string;
    year: number;
    month: number;
    departmentId?: string | undefined;
}>;
declare const PublishScheduleSchema: z.ZodObject<{
    scheduleId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    scheduleId: string;
}, {
    scheduleId: string;
}>;
declare const ScheduleResponseSchema: z.ZodObject<{
    id: z.ZodString;
    organizationId: z.ZodString;
    centerId: z.ZodString;
    departmentId: z.ZodNullable<z.ZodString>;
    year: z.ZodNumber;
    month: z.ZodNumber;
    status: z.ZodEnum<["DRAFT", "PUBLISHED", "ARCHIVED"]>;
    publishedAt: z.ZodNullable<z.ZodString>;
    publishedBy: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    id: string;
    organizationId: string;
    createdAt: string;
    updatedAt: string;
    centerId: string;
    year: number;
    departmentId: string | null;
    month: number;
    publishedAt: string | null;
    publishedBy: string | null;
}, {
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    id: string;
    organizationId: string;
    createdAt: string;
    updatedAt: string;
    centerId: string;
    year: number;
    departmentId: string | null;
    month: number;
    publishedAt: string | null;
    publishedBy: string | null;
}>;
declare const ShiftAssignmentSchema: z.ZodObject<{
    scheduleId: z.ZodString;
    employeeId: z.ZodString;
    shiftTemplateId: z.ZodString;
    departmentId: z.ZodOptional<z.ZodString>;
    date: z.ZodString;
}, "strip", z.ZodTypeAny, {
    date: string;
    employeeId: string;
    shiftTemplateId: string;
    scheduleId: string;
    departmentId?: string | undefined;
}, {
    date: string;
    employeeId: string;
    shiftTemplateId: string;
    scheduleId: string;
    departmentId?: string | undefined;
}>;
declare const ShiftAssignmentResponseSchema: z.ZodObject<{
    scheduleId: z.ZodString;
    employeeId: z.ZodString;
    shiftTemplateId: z.ZodString;
    departmentId: z.ZodOptional<z.ZodString>;
    date: z.ZodString;
} & {
    id: z.ZodString;
    organizationId: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    date: string;
    id: string;
    organizationId: string;
    employeeId: string;
    createdAt: string;
    updatedAt: string;
    shiftTemplateId: string;
    scheduleId: string;
    departmentId?: string | undefined;
}, {
    date: string;
    id: string;
    organizationId: string;
    employeeId: string;
    createdAt: string;
    updatedAt: string;
    shiftTemplateId: string;
    scheduleId: string;
    departmentId?: string | undefined;
}>;
declare const CreateSwapSchema: z.ZodObject<{
    requesterAssignmentId: z.ZodString;
    targetAssignmentId: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    requesterAssignmentId: string;
    targetAssignmentId?: string | undefined;
    reason?: string | undefined;
}, {
    requesterAssignmentId: string;
    targetAssignmentId?: string | undefined;
    reason?: string | undefined;
}>;
declare const ApproveSwapSchema: z.ZodObject<{
    swapId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    swapId: string;
}, {
    swapId: string;
}>;
declare const SwapResponseSchema: z.ZodObject<{
    id: z.ZodString;
    organizationId: z.ZodString;
    requesterAssignmentId: z.ZodString;
    targetAssignmentId: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["REQUESTED", "APPROVED", "REJECTED", "CANCELLED"]>;
    reason: z.ZodNullable<z.ZodString>;
    approverId: z.ZodNullable<z.ZodString>;
    decidedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "APPROVED" | "REJECTED" | "CANCELLED" | "REQUESTED";
    id: string;
    organizationId: string;
    createdAt: string;
    updatedAt: string;
    requesterAssignmentId: string;
    targetAssignmentId: string | null;
    reason: string | null;
    approverId: string | null;
    decidedAt: string | null;
}, {
    status: "APPROVED" | "REJECTED" | "CANCELLED" | "REQUESTED";
    id: string;
    organizationId: string;
    createdAt: string;
    updatedAt: string;
    requesterAssignmentId: string;
    targetAssignmentId: string | null;
    reason: string | null;
    approverId: string | null;
    decidedAt: string | null;
}>;

declare const ClockInSchema: z.ZodObject<{
    source: z.ZodOptional<z.ZodEnum<["web", "kiosk", "api"]>>;
    capturedAtClient: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    source?: "web" | "kiosk" | "api" | undefined;
    capturedAtClient?: string | undefined;
}, {
    source?: "web" | "kiosk" | "api" | undefined;
    capturedAtClient?: string | undefined;
}>;
declare const ClockOutSchema: z.ZodObject<{
    source: z.ZodOptional<z.ZodEnum<["web", "kiosk", "api"]>>;
    capturedAtClient: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    source?: "web" | "kiosk" | "api" | undefined;
    capturedAtClient?: string | undefined;
}, {
    source?: "web" | "kiosk" | "api" | undefined;
    capturedAtClient?: string | undefined;
}>;
declare const TimeEntryResponseSchema: z.ZodObject<{
    id: z.ZodString;
    organizationId: z.ZodString;
    employeeId: z.ZodString;
    clockIn: z.ZodString;
    clockOut: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["OPEN", "CLOSED"]>;
    source: z.ZodString;
    capturedAtClient: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "OPEN" | "CLOSED";
    id: string;
    organizationId: string;
    employeeId: string;
    createdAt: string;
    source: string;
    capturedAtClient: string | null;
    clockIn: string;
    clockOut: string | null;
}, {
    status: "OPEN" | "CLOSED";
    id: string;
    organizationId: string;
    employeeId: string;
    createdAt: string;
    source: string;
    capturedAtClient: string | null;
    clockIn: string;
    clockOut: string | null;
}>;
declare const CreateCorrectionSchema: z.ZodObject<{
    timeEntryId: z.ZodString;
    proposedClockIn: z.ZodOptional<z.ZodString>;
    proposedClockOut: z.ZodOptional<z.ZodString>;
    justification: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timeEntryId: string;
    justification: string;
    proposedClockIn?: string | undefined;
    proposedClockOut?: string | undefined;
}, {
    timeEntryId: string;
    justification: string;
    proposedClockIn?: string | undefined;
    proposedClockOut?: string | undefined;
}>;
declare const ApproveCorrectionSchema: z.ZodObject<{
    correctionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    correctionId: string;
}, {
    correctionId: string;
}>;
declare const CorrectionResponseSchema: z.ZodObject<{
    id: z.ZodString;
    organizationId: z.ZodString;
    timeEntryId: z.ZodString;
    requestedById: z.ZodString;
    proposedClockIn: z.ZodNullable<z.ZodString>;
    proposedClockOut: z.ZodNullable<z.ZodString>;
    justification: z.ZodString;
    status: z.ZodEnum<["PENDING", "APPROVED", "REJECTED"]>;
    approverId: z.ZodNullable<z.ZodString>;
    decidedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "PENDING" | "APPROVED" | "REJECTED";
    id: string;
    organizationId: string;
    createdAt: string;
    updatedAt: string;
    approverId: string | null;
    decidedAt: string | null;
    timeEntryId: string;
    proposedClockIn: string | null;
    proposedClockOut: string | null;
    justification: string;
    requestedById: string;
}, {
    status: "PENDING" | "APPROVED" | "REJECTED";
    id: string;
    organizationId: string;
    createdAt: string;
    updatedAt: string;
    approverId: string | null;
    decidedAt: string | null;
    timeEntryId: string;
    proposedClockIn: string | null;
    proposedClockOut: string | null;
    justification: string;
    requestedById: string;
}>;
declare const OvertimeQuerySchema: z.ZodObject<{
    employeeId: z.ZodOptional<z.ZodString>;
    year: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    year: number;
    employeeId?: string | undefined;
}, {
    year: number;
    employeeId?: string | undefined;
}>;

declare const CreateAbsenceSchema: z.ZodObject<{
    employeeId: z.ZodString;
    type: z.ZodEnum<["VACACIONES", "IT", "PERMISO_RETRIBUIDO", "AUSENCIA_INJUSTIFICADA", "LACTANCIA", "REDUCCION_JORNADA"]>;
    startDate: z.ZodString;
    endDate: z.ZodString;
    cause: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "VACACIONES" | "IT" | "PERMISO_RETRIBUIDO" | "AUSENCIA_INJUSTIFICADA" | "LACTANCIA" | "REDUCCION_JORNADA";
    employeeId: string;
    startDate: string;
    endDate: string;
    cause?: string | undefined;
}, {
    type: "VACACIONES" | "IT" | "PERMISO_RETRIBUIDO" | "AUSENCIA_INJUSTIFICADA" | "LACTANCIA" | "REDUCCION_JORNADA";
    employeeId: string;
    startDate: string;
    endDate: string;
    cause?: string | undefined;
}>;
declare const ApproveAbsenceSchema: z.ZodObject<{
    absenceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    absenceId: string;
}, {
    absenceId: string;
}>;
declare const AbsenceBalanceQuerySchema: z.ZodObject<{
    employeeId: z.ZodOptional<z.ZodString>;
    year: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    year: number;
    employeeId?: string | undefined;
}, {
    year: number;
    employeeId?: string | undefined;
}>;
declare const AbsenceResponseSchema: z.ZodObject<{
    id: z.ZodString;
    organizationId: z.ZodString;
    employeeId: z.ZodString;
    type: z.ZodEnum<["VACACIONES", "IT", "PERMISO_RETRIBUIDO", "AUSENCIA_INJUSTIFICADA", "LACTANCIA", "REDUCCION_JORNADA"]>;
    startDate: z.ZodString;
    endDate: z.ZodString;
    status: z.ZodEnum<["PENDING", "APPROVED", "REJECTED", "CANCELLED"]>;
    cause: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    approverId: z.ZodNullable<z.ZodString>;
    decidedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "VACACIONES" | "IT" | "PERMISO_RETRIBUIDO" | "AUSENCIA_INJUSTIFICADA" | "LACTANCIA" | "REDUCCION_JORNADA";
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
    id: string;
    organizationId: string;
    employeeId: string;
    createdAt: string;
    updatedAt: string;
    approverId: string | null;
    decidedAt: string | null;
    startDate: string;
    endDate: string;
    cause?: string | null | undefined;
}, {
    type: "VACACIONES" | "IT" | "PERMISO_RETRIBUIDO" | "AUSENCIA_INJUSTIFICADA" | "LACTANCIA" | "REDUCCION_JORNADA";
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
    id: string;
    organizationId: string;
    employeeId: string;
    createdAt: string;
    updatedAt: string;
    approverId: string | null;
    decidedAt: string | null;
    startDate: string;
    endDate: string;
    cause?: string | null | undefined;
}>;
declare const AbsenceBalanceResponseSchema: z.ZodObject<{
    employeeId: z.ZodString;
    year: z.ZodNumber;
    entitled: z.ZodNumber;
    used: z.ZodNumber;
    remaining: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    year: number;
    entitled: number;
    used: number;
    remaining: number;
}, {
    employeeId: string;
    year: number;
    entitled: number;
    used: number;
    remaining: number;
}>;

declare const RuleSetSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    isDefault: z.ZodDefault<z.ZodBoolean>;
    minRestHours: z.ZodDefault<z.ZodNumber>;
    maxDailyHours: z.ZodDefault<z.ZodNumber>;
    maxAnnualOvertime: z.ZodDefault<z.ZodNumber>;
    weeklyRestDays: z.ZodDefault<z.ZodNumber>;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    isDefault: boolean;
    minRestHours: number;
    maxDailyHours: number;
    maxAnnualOvertime: number;
    weeklyRestDays: number;
    params?: Record<string, unknown> | undefined;
    id?: string | undefined;
}, {
    name: string;
    params?: Record<string, unknown> | undefined;
    id?: string | undefined;
    isDefault?: boolean | undefined;
    minRestHours?: number | undefined;
    maxDailyHours?: number | undefined;
    maxAnnualOvertime?: number | undefined;
    weeklyRestDays?: number | undefined;
}>;
declare const RuleCheckResultSchema: z.ZodObject<{
    type: z.ZodEnum<["block", "warn"]>;
    code: z.ZodEnum<["MIN_REST_12H", "MAX_DAILY_9H", "MAX_ANNUAL_OT_80H", "WEEKLY_REST_1_5_DAYS", "CATEGORY_COVERAGE", "SHIFT_OVERLAP"]>;
    message: z.ZodString;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    code: "MIN_REST_12H" | "MAX_DAILY_9H" | "MAX_ANNUAL_OT_80H" | "WEEKLY_REST_1_5_DAYS" | "CATEGORY_COVERAGE" | "SHIFT_OVERLAP";
    message: string;
    type: "block" | "warn";
    meta?: Record<string, unknown> | undefined;
}, {
    code: "MIN_REST_12H" | "MAX_DAILY_9H" | "MAX_ANNUAL_OT_80H" | "WEEKLY_REST_1_5_DAYS" | "CATEGORY_COVERAGE" | "SHIFT_OVERLAP";
    message: string;
    type: "block" | "warn";
    meta?: Record<string, unknown> | undefined;
}>;
declare const OperationWithWarningsSchema: <T extends z.ZodTypeAny>(dataSchema: T) => z.ZodObject<{
    data: T;
    warnings: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["block", "warn"]>;
        code: z.ZodEnum<["MIN_REST_12H", "MAX_DAILY_9H", "MAX_ANNUAL_OT_80H", "WEEKLY_REST_1_5_DAYS", "CATEGORY_COVERAGE", "SHIFT_OVERLAP"]>;
        message: z.ZodString;
        meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        code: "MIN_REST_12H" | "MAX_DAILY_9H" | "MAX_ANNUAL_OT_80H" | "WEEKLY_REST_1_5_DAYS" | "CATEGORY_COVERAGE" | "SHIFT_OVERLAP";
        message: string;
        type: "block" | "warn";
        meta?: Record<string, unknown> | undefined;
    }, {
        code: "MIN_REST_12H" | "MAX_DAILY_9H" | "MAX_ANNUAL_OT_80H" | "WEEKLY_REST_1_5_DAYS" | "CATEGORY_COVERAGE" | "SHIFT_OVERLAP";
        message: string;
        type: "block" | "warn";
        meta?: Record<string, unknown> | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{
    data: T;
    warnings: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["block", "warn"]>;
        code: z.ZodEnum<["MIN_REST_12H", "MAX_DAILY_9H", "MAX_ANNUAL_OT_80H", "WEEKLY_REST_1_5_DAYS", "CATEGORY_COVERAGE", "SHIFT_OVERLAP"]>;
        message: z.ZodString;
        meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        code: "MIN_REST_12H" | "MAX_DAILY_9H" | "MAX_ANNUAL_OT_80H" | "WEEKLY_REST_1_5_DAYS" | "CATEGORY_COVERAGE" | "SHIFT_OVERLAP";
        message: string;
        type: "block" | "warn";
        meta?: Record<string, unknown> | undefined;
    }, {
        code: "MIN_REST_12H" | "MAX_DAILY_9H" | "MAX_ANNUAL_OT_80H" | "WEEKLY_REST_1_5_DAYS" | "CATEGORY_COVERAGE" | "SHIFT_OVERLAP";
        message: string;
        type: "block" | "warn";
        meta?: Record<string, unknown> | undefined;
    }>, "many">;
}>, any> extends infer T_1 ? { [k in keyof T_1]: T_1[k]; } : never, z.baseObjectInputType<{
    data: T;
    warnings: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["block", "warn"]>;
        code: z.ZodEnum<["MIN_REST_12H", "MAX_DAILY_9H", "MAX_ANNUAL_OT_80H", "WEEKLY_REST_1_5_DAYS", "CATEGORY_COVERAGE", "SHIFT_OVERLAP"]>;
        message: z.ZodString;
        meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        code: "MIN_REST_12H" | "MAX_DAILY_9H" | "MAX_ANNUAL_OT_80H" | "WEEKLY_REST_1_5_DAYS" | "CATEGORY_COVERAGE" | "SHIFT_OVERLAP";
        message: string;
        type: "block" | "warn";
        meta?: Record<string, unknown> | undefined;
    }, {
        code: "MIN_REST_12H" | "MAX_DAILY_9H" | "MAX_ANNUAL_OT_80H" | "WEEKLY_REST_1_5_DAYS" | "CATEGORY_COVERAGE" | "SHIFT_OVERLAP";
        message: string;
        type: "block" | "warn";
        meta?: Record<string, unknown> | undefined;
    }>, "many">;
}> extends infer T_2 ? { [k_1 in keyof T_2]: T_2[k_1]; } : never>;

export { AbsenceBalanceQuerySchema, AbsenceBalanceResponseSchema, AbsenceResponseSchema, ApproveAbsenceSchema, ApproveCorrectionSchema, ApproveSwapSchema, CenterResponseSchema, ClockInSchema, ClockOutSchema, CorrectionResponseSchema, CreateAbsenceSchema, CreateCenterSchema, CreateCorrectionSchema, CreateDepartmentSchema, CreateEmployeeSchema, CreateOrganizationSchema, CreateScheduleSchema, CreateSwapSchema, CreateWorkingCalendarSchema, DepartmentResponseSchema, EmployeeResponseSchema, ErrorEnvelopeSchema, IsoDateSchema, IsoDateTimeSchema, LoginRequestSchema, LoginResponseSchema, MeResponseSchema, OperationWithWarningsSchema, OrganizationResponseSchema, OvertimeQuerySchema, PaginatedResultSchema, PaginationQuerySchema, PublishScheduleSchema, RefreshResponseSchema, RotationPatternResponseSchema, RotationPatternSchema, RuleCheckResultSchema, RuleSetSchema, ScheduleResponseSchema, ShiftAssignmentResponseSchema, ShiftAssignmentSchema, ShiftTemplateResponseSchema, ShiftTemplateSchema, SwapResponseSchema, TimeEntryResponseSchema, UpdateCenterSchema, UpdateDepartmentSchema, UpdateEmployeeSchema, UpdateOrganizationSchema, UuidSchema, WorkingCalendarSchema };
