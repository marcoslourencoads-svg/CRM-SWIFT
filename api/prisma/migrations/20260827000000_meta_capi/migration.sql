-- CreateEnum
CREATE TYPE "MetaCapiStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "lead_trackings"
  ADD COLUMN "fbc"          TEXT,
  ADD COLUMN "fbp"          TEXT,
  ADD COLUMN "meta_lead_id" TEXT,
  ADD COLUMN "clicked_at"   TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "lead_trackings_meta_lead_id_idx" ON "lead_trackings"("meta_lead_id");

-- CreateTable
CREATE TABLE "meta_capi_events" (
    "id"              TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "lead_id"         TEXT NOT NULL,
    "event_name"      TEXT NOT NULL,
    "event_id"        TEXT NOT NULL,
    "event_time"      TIMESTAMP(3) NOT NULL,
    "status"          "MetaCapiStatus" NOT NULL DEFAULT 'PENDING',
    "dataset_id"      TEXT,
    "match_keys"      JSONB,
    "payload"         JSONB,
    "response_body"   TEXT,
    "fb_trace_id"     TEXT,
    "attempts"        INTEGER NOT NULL DEFAULT 0,
    "sent_at"         TIMESTAMP(3),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_capi_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meta_capi_events_event_id_key" ON "meta_capi_events"("event_id");

-- Guarda de deduplicação: um evento por estágio por lead.
-- É isto que impede um replay de inflar a conversão dentro da Meta.
CREATE UNIQUE INDEX "meta_capi_events_lead_id_event_name_key" ON "meta_capi_events"("lead_id", "event_name");

-- CreateIndex
CREATE INDEX "meta_capi_events_organization_id_status_idx" ON "meta_capi_events"("organization_id", "status");

-- CreateIndex
CREATE INDEX "meta_capi_events_organization_id_created_at_idx" ON "meta_capi_events"("organization_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "meta_capi_events"
  ADD CONSTRAINT "meta_capi_events_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
