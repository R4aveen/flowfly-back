-- AlterEnum
ALTER TYPE "EntropyRiskLevel" ADD VALUE 'EXTRAORDINARY';

-- CreateTable
CREATE TABLE "SalaryHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "baseNetIncome" DECIMAL(10,2) NOT NULL,
    "monthlyWorkHours" INTEGER NOT NULL,
    "hourlyWage" DECIMAL(10,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalaryHistory_userId_startDate_idx" ON "SalaryHistory"("userId", "startDate");

-- AddForeignKey
ALTER TABLE "SalaryHistory" ADD CONSTRAINT "SalaryHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
