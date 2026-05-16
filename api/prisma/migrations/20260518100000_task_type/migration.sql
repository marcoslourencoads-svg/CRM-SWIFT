-- CreateEnum
CREATE TYPE "LeadTaskType" AS ENUM ('TASK', 'CALL', 'MEETING', 'EMAIL', 'DEADLINE', 'LUNCH');

-- AlterTable
ALTER TABLE "lead_tasks"
  ADD COLUMN "type" "LeadTaskType" NOT NULL DEFAULT 'TASK';
