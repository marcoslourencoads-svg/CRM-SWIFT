-- AlterTable
ALTER TABLE "organizations"
  ADD COLUMN "industry" TEXT,
  ADD COLUMN "team_size" TEXT,
  ADD COLUMN "main_goal" TEXT,
  ADD COLUMN "lead_sources_initial" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "onboarded_at" TIMESTAMP(3);
