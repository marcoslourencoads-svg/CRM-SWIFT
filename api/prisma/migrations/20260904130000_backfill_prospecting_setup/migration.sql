-- Backfill do setup de prospeccao para as organizacoes que ja existiam.
--
-- O bootstrap (organization-bootstrap.service.ts) so roda quando a org e
-- criada. Toda org anterior a este modulo ficaria sem:
--
--   1. uma lead source do tipo OUTBOUND — a conversao de prospect em lead
--      procura por ela e sairia com origem nula, some do relatorio por origem;
--   2. uma lista de prospeccao — e a cadencia mora na lista, entao sem ela
--      nenhum follow-up seria agendado e a fila do dia nasceria vazia para
--      sempre, sem erro nenhum na tela.
--
-- Idempotente: cada bloco so insere onde ainda nao existe.
-- Os ids sao gerados aqui porque cuid() e client-side no Prisma; o prefixo
-- "c" mantem o formato visualmente consistente com os demais registros.

-- ── 1. Origem OUTBOUND ───────────────────────────────────────
INSERT INTO "lead_sources" (
  "id", "organization_id", "name", "type", "color", "is_default", "is_active",
  "created_at", "updated_at"
)
SELECT
  'c' || replace(gen_random_uuid()::text, '-', ''),
  o."id",
  'Prospecção ativa',
  'OUTBOUND',
  '#F59E0B',
  false,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "organizations" o
WHERE o."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "lead_sources" s
    WHERE s."organization_id" = o."id" AND s."type" = 'OUTBOUND'
  );

-- ── 2. Lista padrao (e a cadencia junto) ─────────────────────
INSERT INTO "prospect_lists" (
  "id", "organization_id", "name", "description", "cadence_days",
  "created_at", "updated_at"
)
SELECT
  'c' || replace(gen_random_uuid()::text, '-', ''),
  o."id",
  'Prospecção geral',
  'Lista padrão. A cadência abaixo agenda os follow-ups sozinha.',
  ARRAY[2, 4, 7]::INTEGER[],
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "organizations" o
WHERE o."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "prospect_lists" l WHERE l."organization_id" = o."id"
  );

-- ── 3. Abordagens iniciais ───────────────────────────────────
INSERT INTO "prospect_approaches" (
  "id", "organization_id", "name", "body", "is_active", "position",
  "created_at", "updated_at"
)
SELECT
  'c' || replace(gen_random_uuid()::text, '-', ''),
  o."id",
  d."name",
  d."body",
  true,
  d."position",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "organizations" o
CROSS JOIN (
  VALUES
    ('Elogio + pergunta',
     'Elogia algo específico do perfil e termina com uma pergunta aberta sobre a operação.', 0),
    ('Diagnóstico gratuito',
     'Oferece uma análise rápida e sem custo do que está travando as vendas.', 1),
    ('Prova social do nicho',
     'Cita um resultado de um cliente do mesmo segmento e pergunta se faz sentido conversar.', 2)
) AS d("name", "body", "position")
WHERE o."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "prospect_approaches" a WHERE a."organization_id" = o."id"
  );
