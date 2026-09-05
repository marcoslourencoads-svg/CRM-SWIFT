-- Prospecção Ativa (outbound).
-- Substitui a planilha onde cada follow-up era um par de colunas
-- (data + "fez?"), o que travava a cadência em 3 toques e deixava a
-- etapa do prospect implícita em 11 booleanos independentes.

-- CreateEnum
CREATE TYPE "ProspectStage" AS ENUM ('NEW', 'CONTACTED', 'FOLLOW_UP', 'RESPONDED', 'MEETING_SET', 'MEETING_DONE', 'WON', 'LOST', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "ProspectChannel" AS ENUM ('INSTAGRAM', 'WHATSAPP', 'EMAIL', 'PHONE', 'OTHER');

-- CreateEnum
CREATE TYPE "TouchOutcome" AS ENUM ('NO_REPLY', 'REPLIED_POSITIVE', 'REPLIED_NEGATIVE', 'NO_ANSWER', 'BOUNCED');

-- CreateTable
CREATE TABLE "prospect_lists" (
    "id"              TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "description"     TEXT,
    "niche"           TEXT,
    "cadence_days"    INTEGER[] DEFAULT ARRAY[2, 4, 7]::INTEGER[],
    "created_by"      TEXT,
    "archived_at"     TIMESTAMP(3),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospect_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospect_approaches" (
    "id"              TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "body"            TEXT,
    "is_active"       BOOLEAN NOT NULL DEFAULT true,
    "position"        INTEGER NOT NULL DEFAULT 0,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospect_approaches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospects" (
    "id"                 TEXT NOT NULL,
    "organization_id"    TEXT NOT NULL,
    "list_id"            TEXT,
    "owner_id"           TEXT,
    "name"               TEXT NOT NULL,
    "business"           TEXT,
    "handle"             TEXT,
    "profile_url"        TEXT,
    "phone"              TEXT,
    "email"              TEXT,
    "city"               TEXT,
    "has_ads"            BOOLEAN,
    "niche"              TEXT,
    "followers"          INTEGER,
    "stage"              "ProspectStage" NOT NULL DEFAULT 'NEW',
    "channel"            "ProspectChannel" NOT NULL DEFAULT 'INSTAGRAM',
    "touch_count"        INTEGER NOT NULL DEFAULT 0,
    "last_touch_at"      TIMESTAMP(3),
    "next_action_at"     TIMESTAMP(3),
    "first_contacted_at" TIMESTAMP(3),
    "responded_at"       TIMESTAMP(3),
    "meeting_set_at"     TIMESTAMP(3),
    "meeting_held_at"    TIMESTAMP(3),
    "won_at"             TIMESTAMP(3),
    "lost_at"            TIMESTAMP(3),
    "deal_value"         INTEGER NOT NULL DEFAULT 0,
    "lost_reason_id"     TEXT,
    "lost_note"          TEXT,
    "lead_id"            TEXT,
    "contact_id"         TEXT,
    "notes"              TEXT,
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMP(3) NOT NULL,
    "deleted_at"         TIMESTAMP(3),

    CONSTRAINT "prospects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospect_touches" (
    "id"          TEXT NOT NULL,
    "prospect_id" TEXT NOT NULL,
    "user_id"     TEXT,
    "sequence"    INTEGER NOT NULL,
    "channel"     "ProspectChannel" NOT NULL,
    "approach_id" TEXT,
    "template_id" TEXT,
    "message"     TEXT,
    "outcome"     "TouchOutcome" NOT NULL DEFAULT 'NO_REPLY',
    "sent_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospect_touches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prospect_lists_organization_id_archived_at_idx" ON "prospect_lists"("organization_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "prospect_approaches_organization_id_name_key" ON "prospect_approaches"("organization_id", "name");

-- CreateIndex
CREATE INDEX "prospect_approaches_organization_id_position_idx" ON "prospect_approaches"("organization_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "prospects_lead_id_key" ON "prospects"("lead_id");

-- CreateIndex
CREATE INDEX "prospects_organization_id_stage_deleted_at_idx" ON "prospects"("organization_id", "stage", "deleted_at");

-- A fila do dia sai deste índice: tudo com next_action_at vencido.
CREATE INDEX "prospects_organization_id_next_action_at_idx" ON "prospects"("organization_id", "next_action_at");

-- CreateIndex
CREATE INDEX "prospects_organization_id_owner_id_stage_idx" ON "prospects"("organization_id", "owner_id", "stage");

-- O funil é por coorte de abordagem, não por etapa atual: este índice
-- é o que sustenta o recorte "abordados entre X e Y".
CREATE INDEX "prospects_organization_id_first_contacted_at_idx" ON "prospects"("organization_id", "first_contacted_at");

-- CreateIndex
CREATE INDEX "prospects_list_id_idx" ON "prospects"("list_id");

-- Um toque por posição na cadência: impede FUP duplicado no mesmo número.
CREATE UNIQUE INDEX "prospect_touches_prospect_id_sequence_key" ON "prospect_touches"("prospect_id", "sequence");

-- CreateIndex
CREATE INDEX "prospect_touches_prospect_id_sent_at_idx" ON "prospect_touches"("prospect_id", "sent_at");

-- CreateIndex
CREATE INDEX "prospect_touches_approach_id_idx" ON "prospect_touches"("approach_id");

-- AddForeignKey
ALTER TABLE "prospects"
  ADD CONSTRAINT "prospects_list_id_fkey"
  FOREIGN KEY ("list_id") REFERENCES "prospect_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospects"
  ADD CONSTRAINT "prospects_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospect_touches"
  ADD CONSTRAINT "prospect_touches_prospect_id_fkey"
  FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospect_touches"
  ADD CONSTRAINT "prospect_touches_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospect_touches"
  ADD CONSTRAINT "prospect_touches_approach_id_fkey"
  FOREIGN KEY ("approach_id") REFERENCES "prospect_approaches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
