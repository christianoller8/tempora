/**
 * Database seed — creates a demo org, admin user, employees, and sample data
 * so the Dashboard has something to show.
 *
 * Run:  npm run db:seed -w backend
 */
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const url = process.env['DIRECT_DATABASE_URL'] ?? process.env['DATABASE_URL'];
if (!url) {
  console.error('Neither DIRECT_DATABASE_URL nor DATABASE_URL is set in .env');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

// ── helpers ──────────────────────────────────────────────────────────────────

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3_600_000);
}

function daysAgo(d: number): Date {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  dt.setHours(8, 0, 0, 0);
  return dt;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const thisMonday = (() => {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  // ── Organization ──────────────────────────────────────────────────────────
  let org = await prisma.organization.findFirst({ where: { name: 'Tempora Demo' } });
  if (!org) {
    org = await prisma.organization.create({ data: { name: 'Tempora Demo', cif: 'B00000001' } });
    console.log(`  ✓ Organization  id=${org.id}`);
  } else {
    console.log(`  · Organization  id=${org.id}`);
  }

  // ── Center ─────────────────────────────────────────────────────────────────
  let center = await prisma.center.findFirst({ where: { organizationId: org.id, name: 'Main Clinic' } });
  if (!center) {
    center = await prisma.center.create({
      data: { organizationId: org.id, name: 'Main Clinic', address: 'Calle Mayor 1, Madrid' },
    });
    console.log(`  ✓ Center        id=${center.id}`);
  } else {
    console.log(`  · Center        id=${center.id}`);
  }

  // ── Admin employee (so the admin user can clock in) ────────────────────────
  let adminEmployee = await prisma.employee.findFirst({
    where: { organizationId: org.id, firstName: 'Admin', lastName: 'Tempora' },
  });
  if (!adminEmployee) {
    adminEmployee = await prisma.employee.create({
      data: {
        organizationId:        org.id,
        firstName:             'Admin',
        lastName:              'Tempora',
        category:              'ADMINISTRATIVO',
        contractType:          'INDEFINIDO',
        contractedHoursPerWeek: 40,
        primaryCenterId:       center.id,
        hireDate:              new Date('2023-01-01'),
        isActive:              true,
      },
    });
    console.log(`  ✓ Admin employee id=${adminEmployee.id}`);
  }

  // ── Admin user ─────────────────────────────────────────────────────────────
  const adminHash = await argon2.hash('Admin1234!', { type: argon2.argon2id });
  const adminUser = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: 'admin@tempora.com' } },
    update: { passwordHash: adminHash, role: 'ADMIN', isActive: true, employeeId: adminEmployee.id },
    create: {
      organizationId: org.id,
      email: 'admin@tempora.com',
      passwordHash: adminHash,
      role: 'ADMIN',
      isActive: true,
      employeeId: adminEmployee.id,
    },
  });
  console.log(`  ✓ Admin user    email=admin@tempora.com  password=Admin1234!  employeeId=${adminUser.employeeId}`);

  // ── Manager employee + user ────────────────────────────────────────────────
  let managerEmployee = await prisma.employee.findFirst({
    where: { organizationId: org.id, firstName: 'Marina', lastName: 'Manager' },
  });
  if (!managerEmployee) {
    managerEmployee = await prisma.employee.create({
      data: {
        organizationId:         org.id,
        firstName:              'Marina',
        lastName:               'Manager',
        category:               'ENFERMERO',
        contractType:           'INDEFINIDO',
        contractedHoursPerWeek: 40,
        primaryCenterId:        center.id,
        hireDate:               new Date('2022-01-01'),
        isActive:               true,
      },
    });
    console.log(`  ✓ Manager employee id=${managerEmployee.id}`);
  }

  const managerHash = await argon2.hash('Manager1234!', { type: argon2.argon2id });
  await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: 'manager@tempora.com' } },
    update: { passwordHash: managerHash, role: 'MANAGER', isActive: true, employeeId: managerEmployee.id },
    create: {
      organizationId: org.id,
      email:          'manager@tempora.com',
      passwordHash:   managerHash,
      role:           'MANAGER',
      isActive:       true,
      employeeId:     managerEmployee.id,
    },
  });
  console.log('  ✓ Manager user  email=manager@tempora.com  password=Manager1234!');

  // ── Demo employee + user ───────────────────────────────────────────────────
  let demoEmployee = await prisma.employee.findFirst({
    where: { organizationId: org.id, firstName: 'Emma', lastName: 'Employee' },
  });
  if (!demoEmployee) {
    demoEmployee = await prisma.employee.create({
      data: {
        organizationId:         org.id,
        firstName:              'Emma',
        lastName:               'Employee',
        category:               'ENFERMERO',
        contractType:           'INDEFINIDO',
        contractedHoursPerWeek: 40,
        primaryCenterId:        center.id,
        hireDate:               new Date('2024-01-01'),
        isActive:               true,
      },
    });
    console.log(`  ✓ Demo employee  id=${demoEmployee.id}`);
  }

  const employeeHash = await argon2.hash('Employee1234!', { type: argon2.argon2id });
  await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: 'employee@tempora.com' } },
    update: { passwordHash: employeeHash, role: 'EMPLOYEE', isActive: true, employeeId: demoEmployee.id },
    create: {
      organizationId: org.id,
      email:          'employee@tempora.com',
      passwordHash:   employeeHash,
      role:           'EMPLOYEE',
      isActive:       true,
      employeeId:     demoEmployee.id,
    },
  });
  console.log('  ✓ Employee user email=employee@tempora.com  password=Employee1234!');

  // ── Time entries for Emma: week history + open session today ──────────────
  for (let dayOffset = 1; dayOffset <= 4; dayOffset++) {
    const clockIn = new Date(thisMonday);
    clockIn.setDate(clockIn.getDate() + dayOffset - 1);
    clockIn.setHours(8, 0, 0, 0);
    if (clockIn >= new Date()) continue;
    const clockOut = new Date(clockIn);
    clockOut.setHours(16, 0, 0, 0);
    const exists = await prisma.timeEntry.findFirst({
      where: { employeeId: demoEmployee.id, clockIn: { gte: clockIn, lte: new Date(clockIn.getTime() + 3_600_000) } },
    });
    if (!exists) {
      await prisma.timeEntry.create({
        data: { organizationId: org.id, employeeId: demoEmployee.id, clockIn, clockOut, status: 'CLOSED', source: 'web' },
      });
    }
  }

  // Open session for Emma today (clocked in 2 h ago) — only create if not already open
  const emmaOpen = await prisma.timeEntry.findFirst({ where: { employeeId: demoEmployee.id, status: 'OPEN' } });
  if (!emmaOpen) {
    await prisma.timeEntry.create({
      data: { organizationId: org.id, employeeId: demoEmployee.id, clockIn: hoursAgo(2), status: 'OPEN', source: 'web' },
    });
    console.log('  ✓ Time entries  Emma: week history + open session today');
  }

  // ── Employees ──────────────────────────────────────────────────────────────
  const employeeData = [
    { firstName: 'Laura',   lastName: 'García',    category: 'ENFERMERO',      contractType: 'INDEFINIDO',    hours: 40 },
    { firstName: 'Carlos',  lastName: 'Martínez',  category: 'MEDICO',         contractType: 'INDEFINIDO',    hours: 40 },
    { firstName: 'Ana',     lastName: 'López',     category: 'TCAE',           contractType: 'INDEFINIDO',    hours: 40 },
    { firstName: 'Miguel',  lastName: 'Rodríguez', category: 'FISIOTERAPEUTA', contractType: 'TIEMPO_PARCIAL', hours: 20 },
    { firstName: 'Sofía',   lastName: 'Fernández', category: 'ENFERMERO',      contractType: 'INDEFINIDO',    hours: 40 },
    { firstName: 'David',   lastName: 'Sánchez',   category: 'CELADOR',        contractType: 'TEMPORAL',      hours: 40 },
  ] as const;

  const employees: { id: string; firstName: string; lastName: string }[] = [];
  for (const emp of employeeData) {
    let e = await prisma.employee.findFirst({
      where: { organizationId: org.id, firstName: emp.firstName, lastName: emp.lastName },
    });
    if (!e) {
      e = await prisma.employee.create({
        data: {
          organizationId:        org.id,
          firstName:             emp.firstName,
          lastName:              emp.lastName,
          category:              emp.category,
          contractType:          emp.contractType,
          contractedHoursPerWeek: emp.hours,
          primaryCenterId:       center.id,
          hireDate:              new Date('2023-01-01'),
          isActive:              true,
        },
      });
      console.log(`  ✓ Employee      ${emp.firstName} ${emp.lastName} (${emp.category})`);
    } else {
      console.log(`  · Employee      ${emp.firstName} ${emp.lastName}`);
    }
    employees.push({ id: e.id, firstName: emp.firstName, lastName: emp.lastName });
  }

  // ── Time entries: some currently clocked in, some history ─────────────────
  // 3 employees currently clocked in (OPEN)
  const clockedIn = employees.slice(0, 3);
  for (const emp of clockedIn) {
    const existing = await prisma.timeEntry.findFirst({
      where: { employeeId: emp.id, status: 'OPEN' },
    });
    if (!existing) {
      await prisma.timeEntry.create({
        data: {
          organizationId: org.id,
          employeeId:     emp.id,
          clockIn:        hoursAgo(Math.floor(Math.random() * 4) + 1), // 1–4 h ago
          status:         'OPEN',
          source:         'web',
        },
      });
      console.log(`  ✓ Clock-in      ${emp.firstName} ${emp.lastName} (OPEN)`);
    }
  }

  // Closed entries this week for the weekly chart
  for (const emp of employees) {
    for (let dayOffset = 0; dayOffset < 4; dayOffset++) {
      const clockIn = new Date(thisMonday);
      clockIn.setDate(clockIn.getDate() + dayOffset);
      clockIn.setHours(8, 0, 0, 0);
      const clockOut = new Date(clockIn);
      // Random 7.5–9.5 h shift
      const shiftH = 7.5 + Math.random() * 2;
      clockOut.setMinutes(clockIn.getMinutes() + Math.round(shiftH * 60));

      if (clockIn > new Date()) continue; // don't insert future entries

      const exists = await prisma.timeEntry.findFirst({
        where: { employeeId: emp.id, clockIn: { gte: clockIn, lte: new Date(clockIn.getTime() + 3_600_000) } },
      });
      if (!exists) {
        await prisma.timeEntry.create({
          data: {
            organizationId: org.id,
            employeeId:     emp.id,
            clockIn,
            clockOut,
            status:         'CLOSED',
            source:         'web',
          },
        });
      }
    }
  }
  console.log(`  ✓ Time entries  week history + 3 open sessions`);

  // ── Shift templates ───────────────────────────────────────────────────────
  const templateDefs = [
    { name: 'Mañana',   shiftType: 'MANANA',   startTime: '08:00', endTime: '15:00', crossesMidnight: false, breakMinutes: 30 },
    { name: 'Tarde',    shiftType: 'TARDE',    startTime: '15:00', endTime: '22:00', crossesMidnight: false, breakMinutes: 30 },
    { name: 'Noche',    shiftType: 'NOCHE',    startTime: '22:00', endTime: '08:00', crossesMidnight: true,  breakMinutes: 30 },
    { name: 'Guardia',  shiftType: 'GUARDIA',  startTime: '08:00', endTime: '20:00', crossesMidnight: false, breakMinutes: 60 },
    { name: 'Libranza', shiftType: 'LIBRANZA', startTime: '00:00', endTime: '00:00', crossesMidnight: false, breakMinutes: 0  },
  ] as const;

  const templateMap: Record<string, string> = {};
  for (const def of templateDefs) {
    let t = await prisma.shiftTemplate.findFirst({ where: { organizationId: org.id, name: def.name } });
    if (!t) {
      t = await prisma.shiftTemplate.create({
        data: { organizationId: org.id, name: def.name, shiftType: def.shiftType,
                startTime: def.startTime, endTime: def.endTime,
                crossesMidnight: def.crossesMidnight, breakMinutes: def.breakMinutes,
                categoryRequirements: {} },
      });
      console.log(`  ✓ Template      ${def.name} (${def.shiftType})`);
    }
    templateMap[def.shiftType] = t.id;
  }

  // ── Draft schedule + sample assignments ────────────────────────────────────
  const now  = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  let schedule = await prisma.shiftSchedule.findFirst({
    where: { organizationId: org.id, year, month, centerId: center.id },
  });
  if (!schedule) {
    schedule = await prisma.shiftSchedule.create({
      data: { organizationId: org.id, centerId: center.id, year, month, status: 'DRAFT' },
    });
    console.log(`  ✓ Schedule      DRAFT ${year}/${month}`);
  } else {
    console.log(`  · Schedule      ${schedule.status} ${year}/${month}`);
  }

  // Sample assignments: first 5 employees × first 14 days of the month
  const shiftRotation: Array<keyof typeof templateMap> = ['MANANA','TARDE','NOCHE','GUARDIA','LIBRANZA'];
  let assignCount = 0;
  for (let i = 0; i < Math.min(employees.length, 5); i++) {
    for (let d = 1; d <= 14; d++) {
      const date = new Date(year, month - 1, d);
      if (date > new Date()) break;
      const shiftType = shiftRotation[(i + d) % shiftRotation.length] as keyof typeof templateMap;
      const templateId = templateMap[shiftType];
      if (!templateId) continue;
      const existing = await prisma.shiftAssignment.findFirst({
        where: { scheduleId: schedule.id, employeeId: employees[i].id,
                 date: { gte: date, lte: date } },
      });
      if (!existing) {
        await prisma.shiftAssignment.create({
          data: { organizationId: org.id, scheduleId: schedule.id,
                  employeeId: employees[i].id, shiftTemplateId: templateId, date },
        });
        assignCount++;
      }
    }
  }
  if (assignCount > 0) console.log(`  ✓ Assignments   ${assignCount} sample cells filled`);

  // ── Upcoming shift assignments for Emma (next 7 days) ────────────────────
  const upcomingShiftTypes: Array<keyof typeof templateMap> = ['MANANA', 'TARDE', 'MANANA', 'NOCHE', 'LIBRANZA', 'MANANA', 'TARDE'];
  let emmaAssignCount = 0;
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i + 1);
    date.setHours(0, 0, 0, 0);
    const shiftType = upcomingShiftTypes[i % upcomingShiftTypes.length] as keyof typeof templateMap;
    const templateId = templateMap[shiftType];
    if (!templateId) continue;
    const existing = await prisma.shiftAssignment.findFirst({
      where: { scheduleId: schedule.id, employeeId: demoEmployee.id, date: { gte: date, lte: date } },
    });
    if (!existing) {
      await prisma.shiftAssignment.create({
        data: { organizationId: org.id, scheduleId: schedule.id, employeeId: demoEmployee.id, shiftTemplateId: templateId, date },
      });
      emmaAssignCount++;
    }
  }
  if (emmaAssignCount > 0) console.log(`  ✓ Shifts        Emma: ${emmaAssignCount} upcoming assignments`);

  // ── One approved absence today ─────────────────────────────────────────────
  const absentEmp = employees[3]; // Miguel
  const today     = new Date().toISOString().slice(0, 10);
  const absExists = await prisma.absence.findFirst({
    where: { employeeId: absentEmp.id, startDate: { lte: new Date(today) }, endDate: { gte: new Date(today) }, status: 'APPROVED' },
  });
  if (!absExists) {
    await prisma.absence.create({
      data: {
        organizationId: org.id,
        employeeId:     absentEmp.id,
        type:           'PERMISO_RETRIBUIDO',
        startDate:      new Date(today),
        endDate:        new Date(today),
        status:         'APPROVED',
        approverId:     adminUser.id,
        decidedAt:      new Date(),
      },
    });
    console.log(`  ✓ Absence       ${absentEmp.firstName} ${absentEmp.lastName} today (APPROVED)`);
  }

  console.log('');
  console.log('  Admin    admin@tempora.com     /  Admin1234!');
  console.log('  Manager  manager@tempora.com   /  Manager1234!');
  console.log('  Employee employee@tempora.com  /  Employee1234!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
