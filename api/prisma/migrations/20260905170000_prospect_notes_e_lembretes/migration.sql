-- Diario de bordo do prospect + lembrete de compromisso.
--
-- Duas coisas nascem aqui:
--
--   1. prospect_notes — o diario. Antes existia um unico campo de texto
--      solto (prospects.notes): cada edicao apagava a anterior e nao
--      havia como saber quando nem em que etapa algo foi observado.
--      A ordem abaixo importa: cria a tabela, MOVE o conteudo que ja
--      existe para dentro dela e so entao derruba a coluna.
--
--   2. PROSPECT_DUE — o tipo de notificacao que o sino usa para avisar
--      que um compromisso chegou a hora.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROSPECT_DUE';

-- CreateTable
CREATE TABLE "prospect_notes" (
    "id"          TEXT NOT NULL,
    "prospect_id" TEXT NOT NULL,
    "user_id"     TEXT,
    "stage"       "ProspectStage" NOT NULL,
    "content"     TEXT NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    "deleted_at"  TIMESTAMP(3),

    CONSTRAINT "prospect_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prospect_notes_prospect_id_created_at_idx" ON "prospect_notes"("prospect_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "prospect_notes"
  ADD CONSTRAINT "prospect_notes_prospect_id_fkey"
  FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospect_notes"
  ADD CONSTRAINT "prospect_notes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserva o que ja estava escrito: vira a primeira entrada do diario,
-- carimbada com a etapa atual do prospect e com a data de criacao dele.
INSERT INTO "prospect_notes" (
  "id", "prospect_id", "user_id", "stage", "content", "created_at", "updated_at"
)
SELECT
  'c' || replace(gen_random_uuid()::text, '-', ''),
  p."id",
  p."owner_id",
  p."stage",
  p."notes",
  p."created_at",
  CURRENT_TIMESTAMP
FROM "prospects" p
WHERE p."notes" IS NOT NULL
  AND btrim(p."notes") <> '';

-- AlterTable
ALTER TABLE "prospects" DROP COLUMN "notes";
