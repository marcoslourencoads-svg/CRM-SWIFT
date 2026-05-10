-- CreateEnum
CREATE TYPE "MetaReportChannel" AS ENUM ('TELEGRAM', 'EVOLUTION_WA', 'ZAPI_WA', 'MANUAL');

-- CreateTable
CREATE TABLE "meta_ad_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "ad_account_id" TEXT NOT NULL,
    "access_token_enc" TEXT NOT NULL,
    "report_channel" "MetaReportChannel" NOT NULL DEFAULT 'TELEGRAM',
    "report_target" TEXT NOT NULL,
    "schedule_cron" TEXT NOT NULL DEFAULT '0 8 * * *',
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_ad_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_reports" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "raw_text" TEXT NOT NULL,
    "raw_data" JSONB NOT NULL,
    "total_spend" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMP(3),
    "sent_channel" TEXT,
    "send_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meta_ad_accounts_organization_id_active_idx" ON "meta_ad_accounts"("organization_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "meta_ad_accounts_organization_id_ad_account_id_key" ON "meta_ad_accounts"("organization_id", "ad_account_id");

-- CreateIndex
CREATE INDEX "meta_reports_account_id_created_at_idx" ON "meta_reports"("account_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "meta_reports" ADD CONSTRAINT "meta_reports_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "meta_ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
