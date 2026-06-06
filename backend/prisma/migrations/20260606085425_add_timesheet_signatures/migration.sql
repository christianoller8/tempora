-- CreateTable
CREATE TABLE "timesheet_signatures" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "confirmedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timesheet_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timesheet_signatures_organizationId_idx" ON "timesheet_signatures"("organizationId");

-- CreateIndex
CREATE INDEX "timesheet_signatures_organizationId_year_month_idx" ON "timesheet_signatures"("organizationId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_signatures_organizationId_employeeId_year_month_key" ON "timesheet_signatures"("organizationId", "employeeId", "year", "month");

-- AddForeignKey
ALTER TABLE "timesheet_signatures" ADD CONSTRAINT "timesheet_signatures_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_signatures" ADD CONSTRAINT "timesheet_signatures_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
