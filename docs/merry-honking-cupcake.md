# CRM SaaS — Arquitetura & Plano de Engenharia

## 1. Contexto & Visao de Produto

**O que:** CRM SaaS para gestao de pipeline comercial com multiplos pipelines, campos customizaveis, rastreamento de origem, automacoes e operacao via terminal (MCP).

**Stack:** NestJS + Next.js App Router + PostgreSQL/Prisma + Redis + Tailwind/shadcn + Docker + JWT (padrao Bravy).

**Diferenciais arquiteturais:**
- Operacao 100% via Claude Code (MCP Server + Skill)
- Custom KPIs com query engine visual
- Lead lifecycle como state machine (nao apenas CRUD)
- Rastreamento de origem profissional (UTM + first/last touch attribution)
- Automacoes rule-based nativas

---

## 2. Modelo de Dominio (DDD)

### 2.1 — Bounded Contexts

```
┌─────────────────────────────────────────────────────────────┐
│                        IDENTITY                             │
│  Organization, User, Membership, Invitation, ApiKey, RBAC   │
└─────────────────────────────────────────────────────────────┘
         │ orgId permeia tudo (tenant boundary)
         ▼
┌─────────────────────────────────────────────────────────────┐
│                     PIPELINE ENGINE                          │
│  Pipeline, PipelineStatus (state machine), TransitionRule    │
└────────────────────────────────────────────────────────────��┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                      LEAD LIFECYCLE                          │
│  Lead, Contact, Company, LeadSource, LeadTracking,           │
│  CustomFieldDefinition, CustomFieldValue, Tag, LeadTag       │
└────────────────────────────────────��────────────────────────┘
         │
         ├──────────────────────┐
         ▼                      ▼
┌──────────────────┐  ┌──────────────────────────────────────┐
│   ENGAGEMENT     │  │          AUTOMATION ENGINE            │
│  Activity,       │  │  AutomationRule, AutomationAction,    │
│  Note, Task,     │  │  AutomationLog, LeadScoring           │
│  Attachment       │  │                                      │
└──────────────────┘  └──────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────��───────────────────────────────┐
│                     ANALYTICS ENGINE                         │
│  CustomKpi, MonthlyInvestment, Dashboard, SnapshotDaily      │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────��──────────────────────────────���─────┐
│                   NOTIFICATION BUS                           │
│  Notification, NotificationPreference, WebSocket Gateway     │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                   INTEGRATION LAYER                          │
│  MCP Server, Public API, Webhooks (outbound), API Keys       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 — Aggregate Roots & Invariantes

| Aggregate | Root Entity | Invariantes (regras que NUNCA podem quebrar) |
|-----------|-------------|----------------------------------------------|
| Organization | Organization | Slug unico global. Sempre tem pelo menos 1 OWNER. Nao pode deletar se tiver membros ativos. |
| Pipeline | Pipeline | Sempre tem pelo menos 1 status. Sempre tem exatamente 1 status com `isDefault: true`. Nao pode deletar status que contem leads (precisa mover antes). Posicoes de status sao contíguas (sem gaps). |
| Lead | Lead | Sempre pertence a exatamente 1 pipeline e 1 status. `statusId` deve pertencer ao mesmo pipeline do lead. Transicao de status deve respeitar `TransitionRule` (se existir). `estimatedValue` >= 0. Email, se informado, deve ser valido. Lead deletado (soft) nao aparece em queries normais. |
| Contact | Contact | Email unico dentro da Organization (para dedup). Pode estar vinculado a 0..N leads. |
| Company | Company | Nome unico dentro da Organization. Pode ter 0..N contacts. |
| CustomField | CustomFieldDefinition | Nome unico dentro do pipeline. SELECT/MULTI_SELECT devem ter pelo menos 1 opcao. Nao pode deletar field que tem valores (precisa confirmar: deleta valores junto). |

---

## 3. Entidades Detalhadas

### 3.1 — Identity Context

**Organization**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID (cuid) | PK |
| name | String | Nome da empresa |
| slug | String | Unico global, usado na URL. Gerado do name, editavel |
| logoUrl | String? | Logo da org |
| settings | Json | Config global: timezone, currency, dateFormat, defaultPipelineId |
| plan | Enum: FREE, PRO, ENTERPRISE | Para feature gating futuro |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| deletedAt | DateTime? | Soft delete |

**Indices:** `@@unique([slug])`, `@@index([deletedAt])`

**User**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| name | String | |
| email | String | Unico global |
| passwordHash | String | bcrypt, rounds 12 |
| avatarUrl | String? | |
| lastLoginAt | DateTime? | Para auditoria e leads parados |
| isActive | Boolean | Admin pode desativar sem deletar |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indices:** `@@unique([email])`

**Membership** (User <-> Organization, M:N com role)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| userId | UUID | FK → User |
| organizationId | UUID | FK → Organization |
| role | Enum: OWNER, ADMIN, MANAGER, MEMBER | MANAGER: pode ver reports mas nao settings |
| permissions | Json? | Override granular (futuro): `{ canDeleteLeads: true, canExport: true }` |
| createdAt | DateTime | |

**Indices:** `@@unique([userId, organizationId])`

**Invitation**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| organizationId | UUID | FK |
| invitedBy | UUID | FK → User que convidou |
| email | String | |
| role | Enum | Role que tera ao aceitar |
| token | String | Crypto random, 32 bytes hex |
| status | Enum: PENDING, ACCEPTED, EXPIRED, REVOKED | |
| expiresAt | DateTime | Default: 7 dias |
| acceptedAt | DateTime? | |
| createdAt | DateTime | |

**Indices:** `@@unique([token])`, `@@index([organizationId, status])`

**ApiKey** (para API publica e integracoes)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| organizationId | UUID | FK |
| createdBy | UUID | FK → User |
| name | String | Ex: "Landing page site", "Typeform webhook" |
| keyHash | String | Hash da key. A key real so aparece na criacao |
| prefix | String | Primeiros 8 chars da key, para identificacao visual: `sk_live_Ab3x...` |
| scopes | Json | `["leads:create", "leads:read"]` — granularidade de permissao |
| lastUsedAt | DateTime? | |
| expiresAt | DateTime? | Nullable = nunca expira |
| isActive | Boolean | Pode desativar sem deletar |
| createdAt | DateTime | |

**Indices:** `@@unique([keyHash])`, `@@index([organizationId, isActive])`

### 3.2 — Pipeline Engine

**Pipeline**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| organizationId | UUID | FK |
| name | String | |
| description | String? | |
| position | Int | Ordem na sidebar |
| currency | String | Default "BRL". Pode ter pipeline em USD |
| isArchived | Boolean | Arquivado: nao aparece na sidebar mas dados preservados |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| deletedAt | DateTime? | |

**Indices:** `@@index([organizationId, deletedAt])`

**PipelineStatus**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| pipelineId | UUID | FK |
| name | String | |
| color | String | Hex (#3B82F6) |
| position | Int | Ordem no board |
| isDefault | Boolean | Status onde leads novos entram. Exatamente 1 por pipeline |
| isFinal | Boolean | Encerra o lead (ganho ou perdido) |
| isWon | Boolean | So relevante se isFinal=true. True=ganho, False=perdido |
| isMql | Boolean | Marca lead como Marketing Qualified Lead |
| isMeeting | Boolean | Marca que reuniao foi agendada |
| autoAssign | Boolean | Auto-distribui leads novos (round-robin entre membros) |
| staleAfterDays | Int? | Dias sem movimentacao para considerar "parado". Null=nao monitorar |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indices:** `@@index([pipelineId, position])`

**TransitionRule** (regras de transicao entre status — opcional)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| pipelineId | UUID | FK |
| fromStatusId | UUID | FK → PipelineStatus |
| toStatusId | UUID | FK → PipelineStatus |
| isAllowed | Boolean | True=permitido, False=bloqueado. Se nao existir regra, tudo e permitido |
| requiredFields | Json? | Campos obrigatorios para transicionar: `["email", "phone", "cf_budget"]` |
| createdAt | DateTime | |

**Indices:** `@@unique([pipelineId, fromStatusId, toStatusId])`

**Por que TransitionRule?** Impede que o vendedor pule etapas. Ex: nao pode ir de "Novo" direto para "Proposta" sem passar por "Qualificacao". E pode exigir campos preenchidos: "para mover para Proposta, precisa ter telefone e valor estimado".

### 3.3 — Lead Lifecycle

**Contact** (pessoa fisica, separada do Lead)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| organizationId | UUID | FK |
| name | String | |
| email | String? | |
| phone | String? | |
| avatarUrl | String? | |
| companyId | UUID? | FK → Company |
| jobTitle | String? | Cargo |
| metadata | Json? | Campos extras livres |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| deletedAt | DateTime? | |

**Indices:** `@@index([organizationId, email])`, `@@index([organizationId, phone])`, `@@index([companyId])`

**Por que separar Contact de Lead?** Um contact pode virar lead em multiplos pipelines. Ex: "Joao da Empresa X" pode estar no pipeline "Vendas B2B" e no "Pos-venda" simultaneamente. Ou ser um lead que perdeu e depois volta — reutiliza o contact, cria novo lead.

**Company** (empresa/account)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| organizationId | UUID | FK |
| name | String | |
| domain | String? | Ex: empresa.com.br — usado para auto-match e dedup |
| industry | String? | Setor |
| size | Enum? | MICRO, SMALL, MEDIUM, LARGE, ENTERPRISE |
| website | String? | |
| address | Json? | { street, city, state, zip, country } |
| metadata | Json? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| deletedAt | DateTime? | |

**Indices:** `@@index([organizationId, domain])`, `@@unique([organizationId, name])`

**Lead** (oportunidade dentro de um pipeline)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| organizationId | UUID | FK — desnormalizado para queries rapidas |
| pipelineId | UUID | FK |
| statusId | UUID | FK → PipelineStatus. DEVE pertencer ao mesmo pipeline |
| contactId | UUID? | FK → Contact. Nullable para leads criados rapido (so nome) |
| companyId | UUID? | FK → Company. Desnormalizado do Contact para queries |
| assigneeId | UUID? | FK → User (responsavel) |
| sourceId | UUID? | FK → LeadSource |
| title | String | Titulo da oportunidade. Ex: "Projeto CRM Empresa X" |
| estimatedValue | Int | Centavos. 0 se nao informado |
| probability | Int? | 0-100%. Usado para forecast: valor * probabilidade |
| position | Int | Ordem dentro do status (para Kanban) |
| priority | Enum: LOW, MEDIUM, HIGH, URGENT | |
| temperature | Enum: COLD, WARM, HOT | Temperatura do lead |
| expectedCloseDate | DateTime? | Previsao de fechamento |
| wonAt | DateTime? | Data que ganhou (preenchido automaticamente ao mover para status won) |
| lostAt | DateTime? | Data que perdeu |
| lostReason | String? | Motivo da perda (select ou texto livre) |
| lastActivityAt | DateTime | Atualizado a cada interacao. Usado para "leads parados" |
| lastStatusChangedAt | DateTime | Para calcular velocity (tempo em cada etapa) |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| deletedAt | DateTime? | |

**Indices criticos:**
```
@@index([organizationId, pipelineId, statusId, deletedAt])  -- query principal do Kanban
@@index([organizationId, assigneeId, deletedAt])             -- "meus leads"
@@index([organizationId, sourceId])                          -- relatorio por origem
@@index([pipelineId, statusId, position])                    -- ordenacao no board
@@index([organizationId, lastActivityAt])                    -- leads parados
@@index([organizationId, createdAt])                         -- leads por periodo
@@index([organizationId, expectedCloseDate])                 -- forecast
```

**LeadTracking** (dados de rastreamento de origem)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| leadId | UUID | FK → Lead. One-to-one |
| utmSource | String? | google, facebook, instagram, newsletter |
| utmMedium | String? | cpc, organic, social, email, referral |
| utmCampaign | String? | black-friday-2026, lancamento-x |
| utmTerm | String? | palavra-chave (Google Ads) |
| utmContent | String? | variacao do anuncio |
| referrerUrl | String? | URL completa de onde veio |
| landingPage | String? | Pagina de conversao |
| gclid | String? | Google Click ID |
| fbclid | String? | Facebook Click ID |
| firstTouchSource | String? | Primeiro canal que trouxe o contact (persiste entre leads) |
| firstTouchMedium | String? | |
| firstTouchCampaign | String? | |
| ip | String? | IP do visitante (para geolocalizacao futura) |
| userAgent | String? | Device/browser |
| createdAt | DateTime | |

**Indices:** `@@unique([leadId])`, `@@index([utmSource])`, `@@index([utmCampaign])`

**Por que tabela separada?** Evita poluir a tabela Lead com 15 campos nullable que so 30% dos leads terao. Join so quando precisa (detalhe do lead, relatorios). O Kanban nao precisa desses dados.

**First Touch vs Last Touch:** O `LeadTracking` do lead registra o **last touch** (de onde veio NESTE lead). O `firstTouchSource/Medium/Campaign` vem do Contact — foi o primeiro canal que trouxe essa pessoa pra org, mesmo que ela tenha voltado por outro canal. Isso permite analise de **atribuicao multi-touch**.

**LeadSource**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| organizationId | UUID | FK |
| name | String | "Google Ads", "Indicacao", "WhatsApp" |
| type | Enum: ORGANIC, PAID, REFERRAL, DIRECT, OUTBOUND, EVENT, OTHER | Categoriza para reports |
| color | String | Hex |
| icon | String? | Nome do icone (lucide) |
| isDefault | Boolean | Source default quando nao informada |
| isActive | Boolean | Desativar sem deletar |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indices:** `@@index([organizationId, isActive])`

### 3.4 — Custom Fields

**CustomFieldDefinition**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| pipelineId | UUID | FK |
| name | String | Nome de exibicao |
| slug | String | Gerado do name, kebab-case. Usado em filtros/API |
| type | Enum: TEXT, TEXTAREA, NUMBER, CURRENCY, DATE, DATETIME, SELECT, MULTI_SELECT, CHECKBOX, URL, PHONE, EMAIL, RATING, PERCENTAGE | 14 tipos |
| options | Json? | Para SELECT/MULTI_SELECT: `[{ value: "op1", label: "Opcao 1", color: "#hex" }]` |
| defaultValue | String? | Valor padrao ao criar lead |
| isRequired | Boolean | Obrigatorio ao salvar lead? |
| isVisibleOnCard | Boolean | Aparece no LeadCard do Kanban? (max 3 campos) |
| isFilterable | Boolean | Disponivel como opcao de filtro? |
| position | Int | Ordem de exibicao |
| validationRules | Json? | `{ min: 0, max: 100, regex: "^\\d+$" }` |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indices:** `@@unique([pipelineId, slug])`, `@@index([pipelineId, position])`

**CustomFieldValue** (EAV — valores)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| leadId | UUID | FK |
| fieldDefinitionId | UUID | FK |
| textValue | String? | Para TEXT, TEXTAREA, URL, PHONE, EMAIL, SELECT |
| numberValue | Float? | Para NUMBER, CURRENCY, RATING, PERCENTAGE |
| dateValue | DateTime? | Para DATE, DATETIME |
| booleanValue | Boolean? | Para CHECKBOX |
| jsonValue | Json? | Para MULTI_SELECT (array de values) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indices:** `@@unique([leadId, fieldDefinitionId])`, `@@index([fieldDefinitionId, textValue])`, `@@index([fieldDefinitionId, numberValue])`

**Por que colunas tipadas ao inves de um unico `value: String`?** Porque permite queries nativas no PostgreSQL: `WHERE numberValue > 1000` e nao precisa de cast. Filtro por custom field numerico funciona com operadores (>, <, =, between). Filtro por texto funciona com ILIKE. Filtro por data funciona com range.

### 3.5 — Tags

**Tag**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| organizationId | UUID | FK |
| name | String | |
| color | String | Hex |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indices:** `@@unique([organizationId, name])`

**LeadTag** (pivot M:N)
| Campo | Tipo | Notas |
|-------|------|-------|
| leadId | UUID | FK |
| tagId | UUID | FK |
| createdAt | DateTime | |

**Indices:** `@@unique([leadId, tagId])`, `@@index([tagId])`

### 3.6 — Engagement

**Activity** (audit trail imutavel)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| leadId | UUID | FK |
| userId | UUID? | FK → User. Null = acao automatica (sistema/automacao) |
| type | Enum | Ver lista abaixo |
| metadata | Json | Payload da acao. Estrutura depende do type |
| createdAt | DateTime | Imutavel — nao tem updatedAt |

**Activity Types & metadata:**
```
CREATED         → { source: "manual" | "api" | "import" | "automation" }
STATUS_CHANGED  → { fromStatusId, toStatusId, fromStatusName, toStatusName }
ASSIGNED        → { fromUserId?, toUserId, fromUserName?, toUserName }
FIELD_UPDATED   → { fieldName, oldValue, newValue, fieldType }
CUSTOM_FIELD_UPDATED → { fieldId, fieldName, oldValue, newValue }
TAG_ADDED       → { tagId, tagName }
TAG_REMOVED     → { tagId, tagName }
NOTE_ADDED      → { noteId, content (truncado 200 chars) }
ATTACHMENT_ADDED → { attachmentId, fileName }
PIPELINE_MOVED  → { fromPipelineId, toPipelineId, fromPipelineName, toPipelineName }
LEAD_WON        → { value, statusName }
LEAD_LOST       → { reason, statusName }
EMAIL_SENT      → { subject, to } (futuro)
AUTOMATION_FIRED → { ruleId, ruleName, actions[] }
```

**Indices:** `@@index([leadId, createdAt DESC])` — timeline e paginada DESC

**Note** (comentarios/notas manuais)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| leadId | UUID | FK |
| userId | UUID | FK → User que escreveu |
| content | String | Texto rico (markdown ou HTML simples) |
| isPinned | Boolean | Fixar no topo |
| mentions | Json? | `[{ userId, name }]` — para notificar mencionados |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| deletedAt | DateTime? | |

**Indices:** `@@index([leadId, isPinned, createdAt DESC])`

**LeadTask** (tarefas/follow-ups vinculados ao lead)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| leadId | UUID | FK |
| assigneeId | UUID | FK → User responsavel |
| createdBy | UUID | FK → User que criou |
| title | String | Ex: "Enviar proposta", "Ligar segunda" |
| description | String? | |
| dueDate | DateTime? | |
| completedAt | DateTime? | Null = pendente |
| priority | Enum: LOW, MEDIUM, HIGH | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indices:** `@@index([leadId])`, `@@index([assigneeId, completedAt, dueDate])` — "minhas tarefas pendentes"

**Attachment** (arquivos vinculados ao lead)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| leadId | UUID | FK |
| userId | UUID | FK → quem fez upload |
| fileName | String | Nome original |
| fileKey | String | Path no S3/MinIO |
| mimeType | String | |
| sizeBytes | Int | |
| createdAt | DateTime | |

**Indices:** `@@index([leadId, createdAt DESC])`

### 3.7 — Automation Engine

**AutomationRule** (WHEN trigger THEN action)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| organizationId | UUID | FK |
| pipelineId | UUID? | FK. Null = aplica a todos os pipelines |
| name | String | "Auto-assign novos leads", "Notificar gerente em Proposta" |
| description | String? | |
| isActive | Boolean | |
| trigger | Json | Ver estrutura abaixo |
| conditions | Json? | Condicoes extras (AND): `[{ field, operator, value }]` |
| actions | Json | Array de acoes a executar |
| executionCount | Int | Quantas vezes disparou (metricas) |
| lastExecutedAt | DateTime? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Trigger types:**
```json
{ "type": "LEAD_CREATED" }
{ "type": "STATUS_CHANGED", "fromStatusId": "...", "toStatusId": "..." }
{ "type": "STATUS_CHANGED", "toStatusId": "..." }  // qualquer → destino
{ "type": "FIELD_UPDATED", "field": "estimatedValue" }
{ "type": "LEAD_ASSIGNED" }
{ "type": "LEAD_STALE", "days": 7 }  // executado por cron
{ "type": "TAG_ADDED", "tagId": "..." }
```

**Condition operators:**
```json
{ "field": "estimatedValue", "operator": "GREATER_THAN", "value": 500000 }
{ "field": "source.type", "operator": "EQUALS", "value": "PAID" }
{ "field": "tag", "operator": "CONTAINS", "value": "Enterprise" }
{ "field": "customField.budget", "operator": "BETWEEN", "value": [100000, 500000] }
```

**Action types:**
```json
{ "type": "MOVE_TO_STATUS", "statusId": "..." }
{ "type": "ASSIGN_TO", "userId": "..." }
{ "type": "ASSIGN_ROUND_ROBIN" }  // distribui entre membros
{ "type": "ADD_TAG", "tagId": "..." }
{ "type": "REMOVE_TAG", "tagId": "..." }
{ "type": "SET_FIELD", "field": "priority", "value": "HIGH" }
{ "type": "SET_CUSTOM_FIELD", "fieldId": "...", "value": "..." }
{ "type": "CREATE_TASK", "title": "...", "assigneeId": "...", "dueDays": 3 }
{ "type": "SEND_NOTIFICATION", "recipientId": "...", "message": "..." }
{ "type": "FIRE_WEBHOOK", "url": "...", "payload": "..." }
{ "type": "SET_TEMPERATURE", "value": "HOT" }
```

**AutomationLog** (historico de execucoes)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| ruleId | UUID | FK → AutomationRule |
| leadId | UUID | FK → Lead |
| status | Enum: SUCCESS, FAILED, SKIPPED | |
| executedActions | Json | Acoes que rodaram |
| error | String? | Se falhou, o motivo |
| executionTimeMs | Int | Performance tracking |
| createdAt | DateTime | |

**Indices:** `@@index([ruleId, createdAt DESC])`, `@@index([leadId])`

**LeadScore** (pontuacao automatica)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| leadId | UUID | FK. One-to-one |
| score | Int | 0-100 |
| factors | Json | `[{ factor: "tem email", points: 10 }, { factor: "valor > 50k", points: 25 }]` |
| calculatedAt | DateTime | |

**ScoringRule** (regras de pontuacao)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| organizationId | UUID | FK |
| name | String | |
| condition | Json | Mesma estrutura de conditions das automacoes |
| points | Int | Positivo ou negativo |
| isActive | Boolean | |
| createdAt | DateTime | |

**Indices:** `@@index([organizationId, isActive])`

### 3.8 — Analytics Engine

**MonthlyInvestment** (para CPL)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| organizationId | UUID | FK |
| sourceId | UUID? | FK → LeadSource. Null = investimento geral |
| month | String | "YYYY-MM" |
| amount | Int | Centavos |
| description | String? | "Google Ads - Campanha Black Friday" |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indices:** `@@unique([organizationId, sourceId, month])`

**CustomKpi**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| organizationId | UUID | FK |
| createdById | UUID | FK → User |
| name | String | |
| metric | Enum: COUNT, SUM, AVERAGE, MIN, MAX, CONVERSION_RATE, VELOCITY | |
| metricField | String? | "estimatedValue", "cf_budget", etc |
| groupBy | Enum: STATUS, ASSIGNEE, SOURCE, TAG, PERIOD, PIPELINE, CUSTOM_FIELD, PRIORITY, TEMPERATURE | |
| groupByFieldId | String? | Para CUSTOM_FIELD: o fieldId |
| periodGranularity | Enum: DAY, WEEK, MONTH, QUARTER | Para groupBy=PERIOD |
| chartType | Enum: NUMBER, BAR, HORIZONTAL_BAR, LINE, AREA, PIE, DONUT, FUNNEL, TABLE, GAUGE | 10 tipos |
| filters | Json | `{ pipelineId?, statusIds[], assigneeIds[], sourceIds[], tagIds[], dateRange }` |
| position | Json | `{ x, y, w, h }` — grid layout |
| compareWithPrevious | Boolean | Mostra variacao % vs periodo anterior |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**SnapshotDaily** (snapshot diario para historico e graficos rapidos)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| organizationId | UUID | FK |
| pipelineId | UUID | FK |
| date | Date | |
| statusId | UUID | FK |
| leadCount | Int | |
| totalValue | Int | Centavos |
| newLeads | Int | Criados neste dia |
| wonLeads | Int | Ganhos neste dia |
| lostLeads | Int | Perdidos neste dia |
| avgVelocityHours | Int? | Tempo medio em horas que leads ficaram neste status |
| createdAt | DateTime | |

**Indices:** `@@unique([organizationId, pipelineId, statusId, date])`, `@@index([date])`

**Por que SnapshotDaily?** Queries de dashboard que fazem COUNT/SUM sobre milhares de leads sao lentas. O snapshot pre-calcula os numeros diariamente (cron job as 00:05). O dashboard le do snapshot. Leads do dia atual = snapshot de ontem + delta real-time. Historico de meses vira instantaneo.

### 3.9 — Notification Bus

**Notification**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| organizationId | UUID | FK |
| recipientId | UUID | FK → User |
| type | Enum: LEAD_ASSIGNED, STATUS_CHANGED, NOTE_ADDED, MENTION, TASK_DUE, LEAD_STALE, INVITE, AUTOMATION, LEAD_WON | |
| title | String | |
| body | String | |
| metadata | Json | `{ leadId, pipelineId, statusId }` — para deep link |
| isRead | Boolean | Default false |
| readAt | DateTime? | |
| createdAt | DateTime | |

**Indices:** `@@index([recipientId, isRead, createdAt DESC])` — query principal: nao lidas primeiro

**NotificationPreference**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| userId | UUID | FK |
| eventType | Enum | Mesmo que Notification.type |
| inApp | Boolean | Default true |
| email | Boolean | Default false |
| push | Boolean | Default false (futuro) |

**Indices:** `@@unique([userId, eventType])`

### 3.10 — Webhooks (outbound)

**Webhook** (integracao de saida)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| organizationId | UUID | FK |
| name | String | "Notificar Slack", "Enviar para n8n" |
| url | String | URL destino |
| secret | String | HMAC secret para assinar payloads |
| events | Json | `["lead.created", "lead.status_changed", "lead.won"]` |
| headers | Json? | Headers customizados |
| isActive | Boolean | |
| lastTriggeredAt | DateTime? | |
| failureCount | Int | Consecutive failures. Desativa automaticamente depois de 10 |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**WebhookLog**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID | PK |
| webhookId | UUID | FK |
| event | String | "lead.created" |
| payload | Json | O que foi enviado |
| responseStatus | Int? | HTTP status da resposta |
| responseBody | String? | Truncado a 1000 chars |
| success | Boolean | |
| executionTimeMs | Int | |
| createdAt | DateTime | |

---

## 4. Seguranca & Multi-tenancy

### 4.1 — Isolamento de Dados

**Row-Level Security via Prisma Middleware:**
- TODA query recebe `WHERE organizationId = ?` automaticamente
- Middleware no Prisma intercepta find/update/delete e injeta o filtro
- Nenhum endpoint acessa dados sem organizationId no contexto
- Testes automatizados validam que nenhuma query escapa o tenant

**Guard chain (ordem de execucao):**
```
Request
  → JwtAuthGuard (valida token, extrai userId)
  → OrgContextMiddleware (extrai orgId do header X-Organization-Id ou do token)
  → OrgMemberGuard (verifica se user pertence a org)
  → RolesGuard (verifica role minimo para a rota)
  → ResourceOwnerGuard (opcional: verifica se o recurso pertence a org)
  → Controller
```

### 4.2 — RBAC Detalhado

| Acao | OWNER | ADMIN | MANAGER | MEMBER |
|------|-------|-------|---------|--------|
| Gerenciar org (nome, logo, billing) | X | | | |
| Deletar org | X | | | |
| Gerenciar membros (invite, remove, change role) | X | X | | |
| Gerenciar pipelines (CRUD) | X | X | | |
| Gerenciar statuses | X | X | | |
| Gerenciar custom fields | X | X | | |
| Gerenciar automacoes | X | X | | |
| Gerenciar webhooks | X | X | | |
| Gerenciar API keys | X | X | | |
| Ver dashboard e reports | X | X | X | |
| CRUD de leads | X | X | X | X |
| Mover leads | X | X | X | X |
| Atribuir leads | X | X | X | |
| Ver todos os leads | X | X | X | Apenas os seus* |
| Exportar dados | X | X | X | |
| Importar leads | X | X | | |

*MEMBER so ve leads atribuidos a ele (visibilidade restrita). Configuravel por org.

### 4.3 — Seguranca da API Publica

- API keys com prefixo `sk_live_` e `sk_test_`
- Key hasheada no banco (SHA-256). Nunca armazenada em texto
- Scopes granulares: `leads:create`, `leads:read`, `leads:update`
- Rate limiting por key: 100 req/min (configuravel por plano)
- Validacao de origem: whitelist de IPs ou domains (opcional)
- Payload assinado com HMAC para webhooks outbound
- Logs de uso por key para auditoria

### 4.4 — LGPD & Compliance

- Export de todos os dados de um Contact (right to access)
- Anonimizacao de Contact (right to erasure) — preserva Lead para reports mas remove PII
- Consent tracking (metadata no Contact)
- Data retention policy configuravel por org (auto-delete leads apos X meses)
- Audit trail imutavel (Activity nunca e deletado)

---

## 5. Performance & Escalabilidade

### 5.1 — Caching (Redis)

| O que | TTL | Invalidacao |
|-------|-----|-------------|
| Lista de pipelines da org | 10min | On pipeline CRUD |
| Statuses de um pipeline | 10min | On status CRUD |
| Membros da org | 5min | On membership change |
| Custom field definitions | 10min | On field CRUD |
| Tags da org | 10min | On tag CRUD |
| Lead sources da org | 30min | On source CRUD |
| Dashboard KPIs default | 2min | On lead change (debounced) |
| Unread notification count | 30s | On new notification |
| User session data | Duração do token | On logout |

**Pattern:** Cache-aside. Prisma middleware verifica cache antes de query. Invalidacao por event bus interno (EventEmitter2).

### 5.2 — Query Optimization

**Kanban (query mais frequente):**
```sql
-- NAO fazer: 1 query por coluna (N+1)
-- FAZER: 1 query com todos os leads do pipeline, agrupar no app
SELECT l.*, ps.name as statusName, ps.color, u.name as assigneeName
FROM leads l
JOIN pipeline_statuses ps ON l.status_id = ps.id
LEFT JOIN users u ON l.assignee_id = u.id
WHERE l.pipeline_id = ? AND l.deleted_at IS NULL
ORDER BY l.status_id, l.position
```

**Paginacao:**
- Kanban: sem paginacao (carrega todos os leads do pipeline, max ~500)
- Se pipeline tiver >500 leads: lazy load por coluna com scroll infinito
- List view: cursor-based pagination (offset-based e instavel com insercoes concorrentes)
- Cursor = `(lastActivityAt, id)` ou `(createdAt, id)` — evita problemas de empate

**Bulk operations:**
- Move multiplos leads de status: 1 query UPDATE com `WHERE id IN (...)`
- Assign multiplos leads: idem
- Delete multiplos: idem (soft delete)
- Nao processar >100 leads por batch (chunk e processar em fila se necessario)

### 5.3 — Concorrencia

**Problema:** Dois usuarios arrastam o mesmo lead simultaneamente.

**Solucao: Optimistic Locking**
- Lead tem campo `version: Int` (auto-increment a cada update)
- Frontend envia `version` junto com o update
- Backend faz: `UPDATE ... WHERE id = ? AND version = ?`
- Se `affectedRows = 0` → conflito → retorna 409 Conflict
- Frontend recarrega o lead e mostra toast: "Este lead foi alterado por [nome]"

**Reordenacao (position):**
- Ao arrastar lead no Kanban, envia: `{ leadId, newStatusId, newPosition }`
- Backend recalcula positions dos leads afetados em transaction
- Se gap ficar grande (>1000), normaliza positions em background

---

## 6. Arquitetura Backend (NestJS)

```
src/
├── modules/
│   ├── auth/                  # Register, Login, Refresh, OAuth (futuro)
│   ├── organizations/         # CRUD org, settings, LGPD export
│   ├── memberships/           # Invite, accept, manage members
│   ├── api-keys/              # CRUD API keys, auth middleware
│   ├── pipelines/             # CRUD pipelines + statuses + transition rules
│   ├── leads/                 # CRUD leads, move, assign, bulk ops, import/export
│   ├── contacts/              # CRUD contacts, dedup, merge
│   ├── companies/             # CRUD companies
│   ├── custom-fields/         # Definitions + Values + validation
│   ├── tags/                  # CRUD + associacao
│   ├── lead-sources/          # CRUD sources
│   ├── lead-tracking/         # UTM capture, attribution
│   ├── activities/            # Audit trail (append-only)
│   ├── notes/                 # CRUD notas, mentions
│   ├── lead-tasks/            # Follow-ups e tarefas
│   ├── attachments/           # Upload S3/MinIO, presigned URLs
│   ├── automations/           # Rule engine, execution, logs
│   ├── lead-scoring/          # Score calculation, rules
│   ├── notifications/         # CRUD + WebSocket gateway + preferences
│   ├── webhooks/              # CRUD + delivery + retry + logs
│   ├── investments/           # Monthly investment CRUD (CPL)
│   ├── custom-kpis/           # KPI builder + query engine
│   ├── dashboard/             # KPIs default, snapshots, aggregations
│   └── public-api/            # Endpoints publicos (API key auth)
├── common/
│   ├── guards/                # Jwt, OrgMember, Roles, ResourceOwner, ApiKey
│   ├── decorators/            # @CurrentUser, @CurrentOrg, @Roles, @Public
│   ├── interceptors/          # ResponseEnvelope, Logging, OrgScope
│   ├── filters/               # HttpException, PrismaException
│   ├── middleware/             # OrgContext, RateLimit
│   ├── pipes/                 # Validation, ParseUUID
│   ├── events/                # Event bus (lead.created, lead.moved, etc.)
│   └── utils/                 # Pagination, slug, date, currency
├── jobs/                      # Cron jobs
│   ├── stale-leads.job.ts     # Detectar leads parados
│   ├── daily-snapshot.job.ts  # Gerar SnapshotDaily
│   ├── score-recalc.job.ts    # Recalcular lead scores
│   └── webhook-retry.job.ts   # Retry webhooks falhados
└── prisma/
    ├── schema.prisma
    ├── migrations/
    └── seed.ts
```

### Event Bus Interno

Toda mutacao em Lead emite um evento. Listeners desacoplados reagem:

```
lead.created       → Activity log, Automation engine, Notification, Webhook, Score calc
lead.status_changed → Activity log, Automation engine, Notification, Webhook, Score calc, Snapshot invalidation
lead.assigned      → Activity log, Notification, Automation engine
lead.field_updated → Activity log, Automation engine, Score calc
lead.won           → Activity log, Notification, Webhook, Snapshot
lead.lost          → Activity log, Notification, Webhook, Snapshot
lead.deleted       → Cascade cleanup
```

**Implementacao:** `@nestjs/event-emitter` (EventEmitter2). Sincrono para Activity (precisa estar no mesmo transaction). Assincrono para Notification, Webhook, Score (nao bloqueia o response).

---

## 7. Arquitetura Frontend (Next.js App Router)

```
app/
├── (auth)/
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── forgot-password/page.tsx
│   ├── reset-password/[token]/page.tsx
│   └── invite/[token]/page.tsx
├── (app)/                              # Layout autenticado
│   ├── layout.tsx                      # Sidebar + Header + NotificationBell + Socket
│   ├── dashboard/page.tsx              # KPIs default + custom grid
│   ├── pipelines/
│   │   └── [pipelineId]/
│   │       ├── board/page.tsx          # Kanban
│   │       └── list/page.tsx           # Table view
│   ├── leads/
│   │   └── [leadId]/page.tsx           # Detalhe completo (ou drawer)
│   ├── contacts/page.tsx               # Lista de contacts
│   ├── companies/page.tsx              # Lista de companies
│   ├── tasks/page.tsx                  # Minhas tarefas pendentes
│   ├── notifications/page.tsx          # Historico completo
│   └── settings/
│       ├── organization/page.tsx
│       ├── pipelines/page.tsx          # Pipelines + statuses + transition rules
│       ├── custom-fields/page.tsx
│       ├── tags/page.tsx
│       ├── lead-sources/page.tsx
│       ├── automations/page.tsx        # Rule builder visual
│       ├── lead-scoring/page.tsx
│       ├── team/page.tsx
│       ├── api-keys/page.tsx
│       ├── webhooks/page.tsx
│       ├── investments/page.tsx        # Input de investimento mensal (CPL)
│       └── import-export/page.tsx
```

### Componentes Criticos

**KanbanBoard:**
- dnd-kit com DragOverlay (ghost card enquanto arrasta)
- Optimistic update: move instantaneamente, reverte se API falhar
- Collision detection: `closestCenter` para colunas, `pointerWithin` para posicao
- Virtual scrolling por coluna se >50 leads (react-virtual)
- Skeleton loading por coluna

**LeadDrawer:**
- Painel lateral (Sheet do shadcn) com tabs: Detalhes | Timeline | Notas | Tasks | Attachments
- Custom fields renderizados dinamicamente pelo type
- Inline editing (click para editar, blur para salvar)
- Debounce de 500ms em campos texto

**DashboardGrid:**
- react-grid-layout com breakpoints responsivos
- KPIs default fixos no topo (nao arrastaveis)
- Custom KPIs abaixo, arastaveis e redimensionaveis
- Cada widget carrega dados independentemente (Suspense + React Query)
- Skeleton por widget enquanto carrega

**AutomationBuilder:**
- UI visual: "WHEN [trigger dropdown] AND [conditions] THEN [actions]"
- Cada bloco e um componente: TriggerSelector, ConditionRow, ActionRow
- Preview de leads afetados: "Esta automacao afetaria 23 leads atualmente"

---

## 8. Deduplicacao de Leads

### Estrategia

**Na criacao (automatica):**
1. Busca Contact existente por email (exact match) ou phone (normalizado)
2. Se encontrar → mostra modal: "Este contato ja existe. Criar novo lead ou vincular ao existente?"
3. Via API publica → merge automatico (configurable): cria lead novo vinculado ao Contact existente

**Merge manual:**
- Seleciona 2+ leads/contacts para merge
- Escolhe qual e o "master" (ou mescla campos)
- Leads do contact "perdedor" sao transferidos para o master
- Activity trail preserva historico de ambos
- Contact duplicado e soft-deleted com referencia ao master

**Deteccao em background:**
- Job semanal busca contacts com mesmo email, mesmo telefone, ou nome similar (Levenshtein distance < 3)
- Gera lista de "possiveis duplicatas" para o admin revisar
- Nao faz merge automatico (risco alto)

---

## 9. Import/Export

### Import (CSV/XLSX)

**Fluxo:**
1. Upload do arquivo
2. Preview das primeiras 10 linhas
3. **Column mapping:** usuario mapeia cada coluna do CSV para um campo do CRM (built-in ou custom field)
4. **Validacao:** mostra erros por linha (email invalido, campo obrigatorio vazio)
5. **Dedup check:** marca linhas que ja existem (por email/phone)
6. **Opcoes de conflito:** pular duplicatas, atualizar existentes, criar novos
7. Processamento em background (BullMQ job) com progress bar
8. Relatorio final: X importados, Y atualizados, Z erros

**Limites:** 10.000 linhas por import (FREE), 100.000 (PRO).

### Export

- CSV ou XLSX
- Filtros aplicados (exporta o que esta na tela)
- Inclui custom fields como colunas
- Background job para exports grandes
- Link para download via email quando pronto

---

## 10. MCP Server & Skill

### Arquitetura

```
Claude Code terminal
    │
    ├── Skill /crm → interpreta linguagem natural → chama MCP tools
    │
    └── MCP Server (crm-mcp-server)
            │
            └── HTTP → API REST do CRM (NestJS)
```

### MCP Tools (~25 tools)

**Leads:**
- `crm_create_lead` — name, email?, phone?, company?, pipelineId, sourceId?, value?
- `crm_list_leads` — pipelineId?, status?, assignee?, tag?, source?, search?, limit?
- `crm_get_lead` — leadId (retorna tudo: campos, custom fields, tags, ultimo activity)
- `crm_update_lead` — leadId, fields parciais
- `crm_move_lead` — leadId, statusId
- `crm_assign_lead` — leadId, assigneeId (resolve nome → id)
- `crm_delete_lead` — leadId
- `crm_add_note` — leadId, content
- `crm_bulk_move` — leadIds[], statusId
- `crm_bulk_assign` — leadIds[], assigneeId

**Pipelines:**
- `crm_list_pipelines`
- `crm_create_pipeline` — name, description?
- `crm_get_pipeline` — pipelineId (com statuses e contagens)
- `crm_create_status` — pipelineId, name, color, flags

**Tags & Sources:**
- `crm_list_tags`
- `crm_create_tag` — name, color
- `crm_tag_lead` / `crm_untag_lead`
- `crm_list_sources`

**Team:**
- `crm_list_members`
- `crm_invite_member` — email, role

**Dashboard:**
- `crm_dashboard` — KPIs default completos. Params: pipelineId?, period?
- `crm_funnel` — pipelineId (conversao entre etapas + velocity)
- `crm_leads_by_source` — period?
- `crm_stale_leads` — days?
- `crm_cpl` — month?
- `crm_conversion_rates` — pipelineId?, period?

**Notificacoes:**
- `crm_notifications` — lista nao lidas
- `crm_mark_read` — notificationId ou "all"

### Skill `/crm`

Resolve nomes → IDs inteligentemente. Exemplos:
```
/crm cria lead "Joao Silva" no pipeline Vendas B2B, origem Google Ads, valor 50k
/crm lista leads em Negociacao do pipeline Inbound
/crm move lead 123 pra Proposta Enviada
/crm atribui lead 123 pro Marcelao
/crm dashboard do mes
/crm funil do pipeline Vendas B2B
/crm leads parados ha mais de 7 dias
/crm nota no lead 123: "Reuniao confirmada para segunda 14h"
/crm convida marcelo@empresa.com
/crm cpl de marco
```

### Estrutura MCP Server

```
packages/mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Entry point, registra tools
│   ├── config.ts             # API URL, API key
│   ├── api-client.ts         # HTTP client tipado
│   ├── name-resolver.ts      # Resolve "Marcelao" → userId, "Vendas B2B" → pipelineId
│   └── tools/
│       ├── leads.ts
│       ├── pipelines.ts
│       ├── tags.ts
│       ├── team.ts
│       ├── dashboard.ts
│       └── notifications.ts
```

---

## 11. Endpoints REST (resumo)

### Autenticados (JWT)
- Auth: register, login, refresh, forgot-password, reset-password
- Organizations: CRUD, settings
- Memberships: list, invite, accept, update role, remove
- Pipelines: CRUD + statuses + transition rules
- Leads: CRUD, move, assign, bulk ops, filter, search
- Contacts: CRUD, merge, dedup suggestions
- Companies: CRUD
- Custom Fields: definitions CRUD + values set/get
- Tags: CRUD + associate/disassociate
- Lead Sources: CRUD
- Notes: CRUD, pin
- Lead Tasks: CRUD, complete
- Attachments: upload (presigned URL), list, delete
- Activities: list by lead (paginado DESC)
- Automations: CRUD rules + logs
- Lead Scoring: rules CRUD + manual recalc
- Notifications: list, read, read-all, preferences
- Webhooks: CRUD + logs + test
- Investments: CRUD
- Custom KPIs: CRUD + data endpoint + layout save
- Dashboard: KPIs, funnel, conversion rates
- Import/Export: upload, mapping, execute, download

### Publicos (API Key)
- `POST /public/v1/leads` — criar lead com UTMs
- `GET /public/v1/leads/:id` — consultar lead (se scope permitir)

### WebSocket (Socket.IO)
- Auth via JWT no handshake
- Room por `user:{userId}`
- Events: `notification:new`, `notification:count`, `lead:updated` (para live Kanban)

---

## 12. Sprint Backlog

**Executor:** LLM (Claude Code)
**Sprint duration:** Cada sprint e uma unidade atomica de entrega. O JP revisa e aprova ao final de cada sprint antes de iniciar o proximo.
**Definition of Done (DoD) global:** Codigo compila, lint passa, funcionalidade testavel no browser ou terminal, sem regressao nos sprints anteriores.

---

### SPRINT 1 — Infraestrutura & Boilerplate
**Goal:** Projeto rodando em Docker com hot-reload. Zero funcionalidade de negocio — apenas esqueleto.

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 1.1 | Criar repo `crm-jp-api` (NestJS) com estrutura de pastas padrao Bravy | Infra | `npm run start:dev` sobe API |
| 1.2 | Criar repo `crm-jp-web` (Next.js App Router) com estrutura de pastas padrao Bravy | Infra | `npm run dev` sobe frontend |
| 1.3 | Docker-compose na raiz (`crm-jp/`): api + web + postgres + redis + pgadmin. Monta os 2 repos como volumes | Infra | `docker-compose up` sobe tudo, pgadmin acessivel |
| 1.4 | Prisma setup no `crm-jp-api`: datasource, client generation, base config | Infra | `npx prisma generate` roda sem erro |
| 1.5 | ESLint + Prettier configurados em cada repo | Infra | `npm run lint` passa em ambos |
| 1.6 | Env config: `@nestjs/config` + `.env.example` + validacao Zod (api) | Infra | App falha com erro claro se .env incompleto |
| 1.7 | Response envelope interceptor: `{ data, meta }` | Backend | Toda response segue o padrao |
| 1.8 | Global exception filter: `{ statusCode, message, error, timestamp, path }` | Backend | Erros retornam formato padrao |
| 1.9 | Health check endpoint: `GET /health` | Backend | Retorna { status: "ok", db: "ok", redis: "ok" } |
| 1.10 | Axios HTTP client com interceptors (web) | Frontend | Base client configurado para API |
| 1.11 | Tailwind + shadcn/ui inicializados | Frontend | Um componente Button renderiza corretamente |

**Dependencias:** Nenhuma (sprint inicial)
**Risco:** Nenhum
**Teste de aceite:** `docker-compose up` na raiz → API responde em `/health` (porta 3000) → Web renderiza pagina em branco com Button (porta 3001)

### Estrutura de Repositorios

```
~/www/
├── crm-jp/                  # Orquestrador (docker-compose, docs, plano)
│   ├── docker-compose.yml   # Sobe api + web + postgres + redis + pgadmin
│   ├── docker-compose.prod.yml
│   ├── .env.example
│   └── docs/
├── crm-jp-api/              # Repo backend (NestJS)
│   ├── src/
│   ├── prisma/
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
├── crm-jp-web/              # Repo frontend (Next.js)
│   ├── src/
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
└── crm-jp-mcp/              # Repo MCP server (Sprint 21)
    ├── src/
    └── package.json
```

---

### SPRINT 2 — Identity: Schema + Auth Backend
**Goal:** Registro, login e JWT funcionando. Sem frontend ainda.

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 2.1 | Prisma schema: Organization, User, Membership, Invitation | Schema | Migration roda, seed cria org demo |
| 2.2 | Auth module: register (cria org + user OWNER) | Backend | POST /auth/register retorna tokens |
| 2.3 | Auth module: login (email + password) | Backend | POST /auth/login retorna access + refresh token |
| 2.4 | Auth module: refresh token (rotation) | Backend | POST /auth/refresh retorna novo par de tokens |
| 2.5 | Auth module: logout (blacklist refresh token no Redis) | Backend | POST /auth/logout invalida token |
| 2.6 | JwtAuthGuard: extrai user do token, injeta no request | Backend | Rotas protegidas retornam 401 sem token |
| 2.7 | OrgContextMiddleware: extrai orgId do token ou header | Backend | `req.orgId` disponivel em toda rota |
| 2.8 | OrgMemberGuard: valida que user pertence a org | Backend | Retorna 403 se user nao e membro |
| 2.9 | RolesGuard + @Roles() decorator | Backend | `@Roles('ADMIN')` barra MEMBER |
| 2.10 | Prisma tenant middleware: injeta `organizationId` em toda query | Backend | Impossivel acessar dados de outra org |
| 2.11 | @CurrentUser() e @CurrentOrg() decorators | Backend | Controllers acessam user e org sem boilerplate |
| 2.12 | Seed: org "Demo Corp" + user admin + 2 members | Data | `npx prisma db seed` popula dados |

**Dependencias:** Sprint 1
**Risco:** Refresh token rotation precisa de Redis funcionando
**Teste de aceite:** Via curl/Postman: register → login → acessar rota protegida → refresh → logout → token antigo falha

---

### SPRINT 3 — Identity: Auth Frontend
**Goal:** Telas de login/register funcionais. Apos login, usuario ve layout autenticado vazio.

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 3.1 | Pagina /login: form email + senha, submit, redirect | Frontend | Login funcional, redireciona para /dashboard |
| 3.2 | Pagina /register: form nome + email + senha + nome da org | Frontend | Cria conta e loga automaticamente |
| 3.3 | Auth provider: armazena tokens, refresh automatico via interceptor | Frontend | Token renova transparente antes de expirar |
| 3.4 | Middleware Next.js: protege rotas /app/*, redireciona para /login | Frontend | Acessar /dashboard sem token → /login |
| 3.5 | Layout autenticado: sidebar (vazia por enquanto) + header com avatar + logout | Frontend | Sidebar renderiza, logout funciona |
| 3.6 | Pagina /dashboard: placeholder "Dashboard em construcao" | Frontend | Rota acessivel apos login |
| 3.7 | Toast system (sonner) | Frontend | Feedback visual em acoes (login OK, erro, etc) |
| 3.8 | Loading states globais (skeleton) | Frontend | Skeleton aparece enquanto carrega |

**Dependencias:** Sprint 2
**Risco:** Nenhum
**Teste de aceite:** Abrir browser → /register → criar conta → ver layout com sidebar → logout → /login → entrar de volta

---

### SPRINT 4 — Pipeline Engine: Backend
**Goal:** CRUD de pipelines e statuses via API. Lead ainda nao existe.

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 4.1 | Prisma schema: Pipeline, PipelineStatus (com todas as flags) | Schema | Migration roda |
| 4.2 | Pipeline module: CRUD completo | Backend | GET/POST/PATCH/DELETE funcionam |
| 4.3 | Ao criar pipeline, cria 6 statuses default automaticamente | Backend | POST /pipelines retorna pipeline com statuses |
| 4.4 | PipelineStatus: CRUD + reordenacao (PATCH /statuses/reorder) | Backend | Mudar posicao funciona, posicoes recalculam |
| 4.5 | Validacao: nao deletar status que contem leads (futuro-proof) | Backend | DELETE /statuses/:id retorna 409 se tiver leads |
| 4.6 | Validacao: sempre manter exatamente 1 status `isDefault: true` | Backend | Erro se tentar remover o default sem definir outro |
| 4.7 | Prisma schema: TransitionRule | Schema | Migration roda |
| 4.8 | TransitionRule: CRUD + validacao de transicao | Backend | Se regra existir, transicao bloqueada retorna 422 |
| 4.9 | Seed: 2 pipelines ("Vendas B2B" com 6 statuses, "Inbound" com 5) | Data | Seed popula pipelines com statuses realistas |
| 4.10 | Cache Redis: pipelines e statuses por org (TTL 10min) | Backend | Segunda request vem do cache |

**Dependencias:** Sprint 2
**Risco:** Nenhum
**Teste de aceite:** Via API: criar pipeline → listar statuses → reordenar → criar transition rule → tentar transicao bloqueada

---

### SPRINT 5 — Lead Lifecycle: Backend
**Goal:** CRUD de leads, contacts, companies via API. Move entre statuses. Assign.

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 5.1 | Prisma schema: Contact, Company, Lead (com todos os campos e indices) | Schema | Migration roda, indices criados |
| 5.2 | Contact module: CRUD | Backend | GET/POST/PATCH/DELETE |
| 5.3 | Company module: CRUD | Backend | GET/POST/PATCH/DELETE |
| 5.4 | Lead module: create (vincula contact, company, pipeline, status default) | Backend | POST cria lead no status default do pipeline |
| 5.5 | Lead module: list com filtros (status, assignee, search, paginacao cursor) | Backend | GET /pipelines/:id/leads retorna leads paginados |
| 5.6 | Lead module: get detail (com contact, company, assignee) | Backend | GET /leads/:id retorna lead completo |
| 5.7 | Lead module: update campos | Backend | PATCH /leads/:id atualiza campos |
| 5.8 | Lead module: move status (valida pipeline, transition rule, required fields) | Backend | PATCH /leads/:id/move muda status + recalcula positions |
| 5.9 | Lead module: assign/reassign | Backend | PATCH /leads/:id/assign muda assignee |
| 5.10 | Lead module: soft delete | Backend | DELETE seta deletedAt, nao aparece em queries |
| 5.11 | Optimistic locking: campo `version`, check no update | Backend | Update com version errada retorna 409 |
| 5.12 | Lead module: bulk move + bulk assign + bulk delete | Backend | PATCH /leads/bulk com array de ids |
| 5.13 | Preencher `lastActivityAt` e `lastStatusChangedAt` automaticamente | Backend | Campos atualizados a cada mudanca |
| 5.14 | Preencher `wonAt`/`lostAt` ao mover para status final | Backend | Data preenchida automaticamente |
| 5.15 | Seed: 50 leads distribuidos nos 2 pipelines com contacts e companies | Data | Dados realistas para testar |

**Dependencias:** Sprint 4
**Risco:** Reordenacao de position em moves concorrentes — resolvido com transaction
**Teste de aceite:** Via API: criar contact → criar lead → mover entre statuses → assign → bulk move → soft delete → verificar version conflict

---

### SPRINT 6 — Kanban: Frontend
**Goal:** Board view funcional com drag-and-drop. O usuario VE e OPERA o pipeline.

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 6.1 | Sidebar: lista pipelines da org, click navega para /pipelines/:id/board | Frontend | Pipelines aparecem na sidebar |
| 6.2 | Pipeline selector no header (trocar pipeline rapido) | Frontend | Dropdown troca pipeline, URL atualiza |
| 6.3 | KanbanBoard: colunas = statuses, renderiza LeadCards | Frontend | Board mostra colunas com leads corretos |
| 6.4 | LeadCard: nome, valor formatado (R$), assignee avatar, priority badge | Frontend | Card exibe dados essenciais |
| 6.5 | Drag-and-drop: dnd-kit com DragOverlay (ghost card) | Frontend | Arrastar lead entre colunas funciona |
| 6.6 | Optimistic update: move instantaneo, reverte se API falhar | Frontend | Move parece instantaneo, toast se falhar |
| 6.7 | LeadDrawer (Sheet): abre ao clicar no card, mostra campos editaveis | Frontend | Click no card → drawer lateral com detalhes |
| 6.8 | Inline editing no LeadDrawer: click para editar, blur para salvar | Frontend | Editar nome/valor/empresa funciona inline |
| 6.9 | Criar lead: botao "+" na coluna, modal ou quick-add | Frontend | Novo lead aparece na primeira coluna |
| 6.10 | Assign lead: dropdown de membros no LeadDrawer | Frontend | Selecionar membro atualiza assignee |
| 6.11 | Delete lead: confirmar e remover do board | Frontend | Lead some do board apos confirmar |
| 6.12 | Empty states: pipeline sem leads, coluna vazia | Frontend | Mensagens amigaveis, CTA para criar |
| 6.13 | Skeleton loading: colunas com placeholders enquanto carrega | Frontend | UX nao trava enquanto carrega |
| 6.14 | React Query: cache do board, invalidacao ao mutar | Frontend | Dados sempre frescos apos acoes |

**Dependencias:** Sprint 5
**Risco:** Performance do dnd-kit com muitos cards — mitigado com virtualizacao na Sprint futura se necessario
**Teste de aceite:** Browser: abrir board → ver leads nas colunas → arrastar lead para outra coluna → abrir drawer → editar → criar lead → deletar

---

### SPRINT 7 — Custom Fields
**Goal:** Campos personalizados criados, preenchidos e filtrados.

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 7.1 | Prisma schema: CustomFieldDefinition (14 tipos) + CustomFieldValue (colunas tipadas) | Schema | Migration roda |
| 7.2 | CustomField module: CRUD definitions (por pipeline) | Backend | Criar campo TEXT, NUMBER, SELECT, etc |
| 7.3 | Validacao por tipo: SELECT precisa de options, NUMBER aceita min/max | Backend | Criar SELECT sem options retorna 422 |
| 7.4 | CustomField module: set/get valores por lead | Backend | PUT /leads/:id/custom-fields salva valores |
| 7.5 | Filtro por custom field: operadores tipados (=, >, <, contains, between) | Backend | GET /leads?cf_budget_gt=50000 filtra corretamente |
| 7.6 | Settings page: gerenciar custom fields por pipeline (criar, editar, reordenar, deletar) | Frontend | CRUD visual funcional |
| 7.7 | CustomFieldRenderer: renderiza input correto por tipo (text, number, select, date, etc) | Frontend | 14 tipos renderizam corretamente |
| 7.8 | Custom fields no LeadDrawer: secao dedicada com campos do pipeline | Frontend | Campos aparecem e sao editaveis |
| 7.9 | `isVisibleOnCard`: campos marcados aparecem no LeadCard do Kanban (max 3) | Frontend | Card mostra campos extras configurados |

**Dependencias:** Sprint 6
**Risco:** Nenhum
**Teste de aceite:** Settings: criar campo "Orcamento" (CURRENCY) → abrir lead → preencher → ver no card → filtrar leads com orcamento > 50k

---

### SPRINT 8 — Tags + Lead Sources
**Goal:** Etiquetas e fontes de origem funcionando no fluxo completo.

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 8.1 | Prisma schema: Tag, LeadTag, LeadSource | Schema | Migration roda |
| 8.2 | Tag module: CRUD (por org) + associar/desassociar de lead | Backend | POST /leads/:id/tags funciona |
| 8.3 | LeadSource module: CRUD (por org) com type e cor | Backend | CRUD funcional |
| 8.4 | Lead create: aceitar `sourceId` na criacao | Backend | Lead criado com origem |
| 8.5 | Filtro por tag e por source na listagem de leads | Backend | Query params filtram corretamente |
| 8.6 | Settings page: gerenciar tags (nome, cor) | Frontend | CRUD visual |
| 8.7 | Settings page: gerenciar lead sources (nome, tipo, cor) | Frontend | CRUD visual |
| 8.8 | Tags no LeadDrawer: adicionar/remover com autocomplete | Frontend | Selecionar tag, ver badge colorida |
| 8.9 | Tags no LeadCard: badges coloridas (max 3 visiveis) | Frontend | Tags aparecem no card do Kanban |
| 8.10 | Source no LeadDrawer: dropdown de selecao | Frontend | Origem selecionavel |
| 8.11 | Source no LeadCard: icone/label da origem | Frontend | Origem visivel no card |
| 8.12 | Filtro visual no board: FilterBar com dropdowns (status, assignee, tag, source) | Frontend | Filtros combinados funcionam |

**Dependencias:** Sprint 7
**Risco:** Nenhum
**Teste de aceite:** Criar tag "Enterprise" azul → associar a lead → ver no card → filtrar por tag → criar source "Google Ads" → associar → filtrar por source

---

### SPRINT 9 — Rastreamento de Origem (UTM + API Publica)
**Goal:** Leads criados por formularios externos chegam com tracking completo.

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 9.1 | Prisma schema: LeadTracking, ApiKey | Schema | Migration roda |
| 9.2 | ApiKey module: CRUD + hash + scopes + prefix | Backend | Criar key, ver prefix, key so aparece 1x |
| 9.3 | ApiKeyGuard: autentica request por header `X-API-Key` | Backend | Request com key invalida retorna 401 |
| 9.4 | Rate limiting por API key: 100 req/min | Backend | 101a request retorna 429 |
| 9.5 | Public API: `POST /public/v1/leads` (cria lead + contact + tracking) | Backend | Lead criado com UTMs via API key |
| 9.6 | LeadTracking: salva UTMs + referrer + landing page + gclid/fbclid | Backend | Dados persistidos na tabela separada |
| 9.7 | First touch attribution: se Contact ja existe, preserva first touch | Backend | Segundo lead do mesmo contact mantem first touch |
| 9.8 | LeadTracking visivel no LeadDrawer: secao "Origem" com todos os campos | Frontend | UTMs, referrer, landing page visiveis |
| 9.9 | Settings page: gerenciar API keys (criar, revogar, ver uso) | Frontend | CRUD visual com aviso "copie agora" |
| 9.10 | Script JS copiavel: snippet para embed em formularios | Backend | Gerar snippet com API key embutida |
| 9.11 | Relatorio basico: leads por source (endpoint GET /lead-sources/report) | Backend | Contagem e valor por source e por UTM |

**Dependencias:** Sprint 8
**Risco:** Rate limiting precisa Redis — ja disponivel desde Sprint 1
**Teste de aceite:** Criar API key → curl POST /public/v1/leads com UTMs → ver lead no board → abrir drawer → ver tracking completo → relatorio por source

---

### SPRINT 10 — Activity Log + Timeline
**Goal:** Toda acao no lead e registrada automaticamente. Timeline funcional.

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 10.1 | Prisma schema: Activity (com todos os types + metadata) | Schema | Migration roda |
| 10.2 | Event bus: `@nestjs/event-emitter` configurado | Backend | Events emitidos e recebidos |
| 10.3 | Activity listeners: lead.created, status_changed, assigned, field_updated, tag_added/removed | Backend | Cada mutacao gera Activity automaticamente |
| 10.4 | Activity endpoint: GET /leads/:id/activities (paginado DESC) | Backend | Timeline retorna com metadados corretos |
| 10.5 | LeadDrawer tab "Timeline": lista de atividades com icone, ator, descricao, hora | Frontend | Timeline renderiza bonita e paginada |
| 10.6 | Formatacao por type: "JP moveu de Novo para Qualificado", "Sistema atribuiu a Marcelao" | Frontend | Mensagens humanas, nao JSON |
| 10.7 | Timestamp relativo: "ha 5 min", "ontem as 14h", "12/04/2026" | Frontend | Datas legíveis |

**Dependencias:** Sprint 5 (events), Sprint 6 (drawer)
**Risco:** Nenhum
**Teste de aceite:** Criar lead → mover status → assign → editar campo → abrir timeline → ver todas as acoes registradas com ator e horario

---

### SPRINT 11 — Notas, Tasks e Attachments
**Goal:** Interacoes manuais com o lead: comentar, criar tarefa, anexar arquivo.

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 11.1 | Prisma schema: Note, LeadTask, Attachment | Schema | Migration roda |
| 11.2 | Note module: CRUD + pin + menções (@user no content) | Backend | Criar nota, fixar, mencionar user |
| 11.3 | LeadTask module: CRUD + complete + filtro "minhas tarefas" | Backend | Criar task com due date, marcar completa |
| 11.4 | Attachment module: presigned URL upload (S3/MinIO) + list + delete | Backend | Upload funciona, URL acessivel |
| 11.5 | LeadDrawer tab "Notas": lista de notas, form de nova nota | Frontend | Escrever e ver notas |
| 11.6 | LeadDrawer tab "Tasks": lista com checkbox, criar task inline | Frontend | Criar, completar, ver due date |
| 11.7 | LeadDrawer tab "Arquivos": upload drag-and-drop, lista com preview | Frontend | Arrastar arquivo, ver lista, download |
| 11.8 | Pagina /tasks: "Minhas tarefas" com filtros (pendentes, atrasadas, completas) | Frontend | Visao consolidada das tasks do user |
| 11.9 | Activities geradas: NOTE_ADDED, ATTACHMENT_ADDED geram entry na timeline | Backend | Timeline mostra notas e uploads |

**Dependencias:** Sprint 10
**Risco:** Upload precisa S3/MinIO configurado — usar MinIO local no docker-compose
**Teste de aceite:** Abrir lead → adicionar nota com @Marcelao → criar task "Ligar segunda" → upload proposta.pdf → ver tudo na timeline

---

### SPRINT 12 — Convites e Colaboracao
**Goal:** Convidar time, gerenciar membros, visibilidade por role.

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 12.1 | Invitation flow: POST /invitations envia email com link + token | Backend | Email enviado (Nodemailer, Mailtrap em dev) |
| 12.2 | Accept invite: GET /invite/:token → cria user + membership | Backend | Token valido → conta criada → logado |
| 12.3 | Frontend: pagina /invite/[token] com form de nome + senha | Frontend | Aceitar convite funcional |
| 12.4 | Settings page /team: listar membros, alterar role, desativar, remover | Frontend | CRUD de membros visual |
| 12.5 | Modal de convite: email + role selector | Frontend | Enviar convite pelo app |
| 12.6 | Visibilidade de leads por role: MEMBER so ve leads atribuidos a ele | Backend | Query filtra por assigneeId se role=MEMBER |
| 12.7 | RolesGuard aplicado em todas as rotas de settings (ADMIN+) | Backend | MEMBER nao acessa settings |
| 12.8 | Membership cache: invalidar ao alterar role ou remover | Backend | Mudancas refletem imediatamente |

**Dependencias:** Sprint 2 (auth), Sprint 6 (frontend base)
**Risco:** Email delivery em dev — usar Mailtrap ou MailHog no docker-compose
**Teste de aceite:** Convidar email → abrir link → criar conta → logar → ver apenas leads atribuidos → admin altera role → permissoes mudam

---

### SPRINT 13 — Notificacoes Real-Time
**Goal:** Notificacoes in-app via WebSocket. Marcelao recebe notificacao na hora.

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 13.1 | Prisma schema: Notification, NotificationPreference | Schema | Migration roda |
| 13.2 | Socket.IO gateway: auth JWT no handshake, room por user:{userId} | Backend | Conexao WebSocket autenticada |
| 13.3 | Notification service: cria no banco + emite via WebSocket | Backend | Notificacao salva E emitida |
| 13.4 | Event listeners: lead.assigned → notifica assignee | Backend | Atribuir lead gera notificacao |
| 13.5 | Event listeners: lead.status_changed → notifica assignee | Backend | Mover lead gera notificacao |
| 13.6 | Event listeners: note com @mention → notifica mencionado | Backend | Mencao gera notificacao |
| 13.7 | Endpoints: list (paginado), unread-count, mark-read, mark-all-read | Backend | CRUD de notificacoes funcional |
| 13.8 | Preferences: CRUD por tipo de evento | Backend | User pode desativar tipos |
| 13.9 | Frontend: Socket.IO client conecta ao montar layout | Frontend | Conexao WebSocket ativa |
| 13.10 | NotificationBell: sino no header com badge de nao lidas (real-time) | Frontend | Badge atualiza sem refresh |
| 13.11 | NotificationDropdown: lista recente com deep link para o lead | Frontend | Click na notificacao abre o lead |
| 13.12 | Pagina /notifications: historico completo paginado | Frontend | Historico acessivel |
| 13.13 | Settings: preferencias de notificacao (toggles por tipo) | Frontend | Configuravel pelo user |
| 13.14 | Cron job: leads parados ha X dias → notifica responsavel | Backend | Job roda, notificacoes geradas |

**Dependencias:** Sprint 10 (event bus), Sprint 12 (team)
**Risco:** WebSocket em producao precisa de sticky sessions ou Redis adapter — adicionar Redis adapter desde o inicio
**Teste de aceite:** User A atribui lead ao User B → User B recebe notificacao instantanea no sino → click abre o lead → marcar como lida → configurar preferencias

---

### SPRINT 14 — Automation Engine
**Goal:** Regras WHEN→THEN criadas e executadas automaticamente.

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 14.1 | Prisma schema: AutomationRule, AutomationLog | Schema | Migration roda |
| 14.2 | Automation module: CRUD de rules | Backend | Criar, editar, ativar/desativar regra |
| 14.3 | Trigger engine: escuta events e avalia se alguma rule matcha | Backend | Event lead.created → checa rules com trigger LEAD_CREATED |
| 14.4 | Condition evaluator: avalia conditions (field, operator, value) | Backend | Conditions AND funcionam |
| 14.5 | Action executor: MOVE_TO_STATUS | Backend | Lead movido automaticamente |
| 14.6 | Action executor: ASSIGN_TO + ASSIGN_ROUND_ROBIN | Backend | Lead atribuido (round-robin distribui entre membros) |
| 14.7 | Action executor: ADD_TAG, REMOVE_TAG | Backend | Tags manipuladas |
| 14.8 | Action executor: SET_FIELD, SET_CUSTOM_FIELD, SET_TEMPERATURE | Backend | Campos atualizados |
| 14.9 | Action executor: CREATE_TASK | Backend | Task criada vinculada ao lead |
| 14.10 | Action executor: SEND_NOTIFICATION | Backend | Notificacao gerada |
| 14.11 | AutomationLog: registra toda execucao (success/failed/skipped) | Backend | Log com tempo de execucao |
| 14.12 | AUTOMATION_FIRED activity type na timeline do lead | Backend | Timeline mostra "Automacao X executou" |
| 14.13 | Settings page: AutomationBuilder visual (trigger + conditions + actions) | Frontend | UI drag-and-drop ou form builder |
| 14.14 | Preview: "Esta regra afetaria X leads atualmente" | Frontend | Contagem antes de salvar |
| 14.15 | Log viewer: historico de execucoes por regra | Frontend | Ver quantas vezes disparou, erros |

**Dependencias:** Sprint 10 (event bus), Sprint 13 (notifications)
**Risco:** Loop infinito (automacao A move lead → trigga automacao B que move de volta). Mitigacao: max depth = 3 execucoes em cadeia por lead
**Teste de aceite:** Criar regra "lead criado com source Paid → assign round-robin + tag Hot + task Follow-up 24h" → criar lead via API → verificar assign + tag + task automaticos → ver log

---

### SPRINT 15 — Lead Scoring
**Goal:** Score calculado automaticamente baseado em regras configuraveis.

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 15.1 | Prisma schema: LeadScore, ScoringRule | Schema | Migration roda |
| 15.2 | ScoringRule module: CRUD (condition + points) | Backend | Criar regra "tem email = +10pts" |
| 15.3 | Score calculator: recalcula score quando lead muda | Backend | Score atualizado em cada mutacao |
| 15.4 | Score visivel no LeadCard (badge com numero + cor por faixa) | Frontend | 0-30 vermelho, 31-60 amarelo, 61-100 verde |
| 15.5 | Score visivel no LeadDrawer com breakdown dos fatores | Frontend | "Email preenchido: +10, Valor > 50k: +25" |
| 15.6 | Settings page: gerenciar scoring rules | Frontend | CRUD visual |
| 15.7 | Filtro por score range na listagem | Backend + Frontend | Filtrar leads com score > 70 |
| 15.8 | Cron job: recalcular scores em batch (para quando regras mudam) | Backend | Recalculo completo em background |

**Dependencias:** Sprint 7 (custom fields), Sprint 8 (tags/sources)
**Risco:** Nenhum
**Teste de aceite:** Criar 3 regras de scoring → criar lead → ver score calculado → editar lead (preencher email) → score atualiza → filtrar por score

---

### SPRINT 16 — Dashboard: KPIs Default
**Goal:** Dashboard com as 10 metricas fixas funcionando.

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 16.1 | Prisma schema: MonthlyInvestment, SnapshotDaily | Schema | Migration roda |
| 16.2 | Dashboard module: endpoint KPIs default (todas as 10 metricas) | Backend | GET /dashboard/kpis retorna tudo |
| 16.3 | KPI: Leads hoje + Leads do mes (contagem) | Backend | Contagem correta por periodo |
| 16.4 | KPI: MQL, Desqualificados, Reunioes agendadas, Vendas (baseado em flags) | Backend | Contagem por flags isMql, isMeeting, isWon |
| 16.5 | KPI: R$ por status do pipeline | Backend | Soma de estimatedValue agrupado por status |
| 16.6 | KPI: % Reuniao → Fechamento + % Agendamento → Reuniao → Fechamento | Backend | Conversoes calculadas corretamente |
| 16.7 | Investment module: CRUD investimento mensal (por source opcional) | Backend | Registrar investimento de marco em Google Ads |
| 16.8 | KPI: CPL geral + CPL por source | Backend | Investimento / leads do periodo |
| 16.9 | Filtro por periodo: hoje, semana, mes, trimestre, ano, custom | Backend | Query params dateFrom/dateTo |
| 16.10 | Cron job: SnapshotDaily (00:05 todo dia) | Backend | Snapshot gerado, queries historicas rapidas |
| 16.11 | Frontend: pagina /dashboard com cards de KPIs | Frontend | 10 cards com numeros, icones, cores |
| 16.12 | Filtro de periodo no header do dashboard | Frontend | Dropdown muda todos os KPIs |
| 16.13 | Funil visual: barras horizontais com conversao entre etapas | Frontend | Recharts funnel chart |
| 16.14 | Settings page: input de investimento mensal | Frontend | Tabela mes x source x valor |

**Dependencias:** Sprint 6 (dados de leads), Sprint 8 (sources)
**Risco:** Performance de queries agregadas — mitigado com SnapshotDaily
**Teste de aceite:** Dashboard mostra KPIs reais → mudar periodo → numeros mudam → registrar investimento → CPL atualiza → funil mostra conversoes

---

### SPRINT 17 — Dashboard: Custom KPIs
**Goal:** Usuario cria seus proprios graficos e monta o dashboard.

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 17.1 | Prisma schema: CustomKpi | Schema | Migration roda |
| 17.2 | CustomKpi module: CRUD | Backend | Criar, editar, deletar KPI |
| 17.3 | Query engine: transforma CustomKpi config em Prisma query dinamica | Backend | GET /custom-kpis/:id/data retorna dados agrupados |
| 17.4 | Metricas: COUNT, SUM, AVERAGE, MIN, MAX, CONVERSION_RATE, VELOCITY | Backend | Todas as metricas calculam corretamente |
| 17.5 | Agrupamentos: STATUS, ASSIGNEE, SOURCE, TAG, PERIOD, PIPELINE, CUSTOM_FIELD, PRIORITY, TEMPERATURE | Backend | Todos os group by funcionam |
| 17.6 | Layout save: PATCH /custom-kpis/layout (batch update positions) | Backend | Posicoes salvas no banco |
| 17.7 | KPI builder modal: selecionar metrica + group by + chart type + filtros | Frontend | Wizard step-by-step |
| 17.8 | Chart renderers: NUMBER, BAR, HORIZONTAL_BAR, LINE, AREA, PIE, DONUT, FUNNEL, TABLE, GAUGE | Frontend | 10 tipos de grafico com Recharts |
| 17.9 | Dashboard grid: react-grid-layout com drag + resize | Frontend | Arrastar e redimensionar widgets |
| 17.10 | Persistir layout: salvar posicao ao arrastar/redimensionar | Frontend | Layout preservado entre sessoes |
| 17.11 | Cada widget carrega independentemente (Suspense + skeleton) | Frontend | Widget lentos nao bloqueiam os outros |
| 17.12 | Variacao %: comparar com periodo anterior (se `compareWithPrevious`) | Backend + Frontend | "+12% vs mes passado" |

**Dependencias:** Sprint 16
**Risco:** Query engine complexa — limitar combinacoes iniciais, expandir iterativamente
**Teste de aceite:** Criar KPI "Leads por origem" (PIE) → criar "Valor por responsavel" (BAR) → arrastar widgets → redimensionar → recarregar → layout preservado

---

### SPRINT 18 — List View + Busca + Filtros Avancados
**Goal:** Visualizacao em tabela como alternativa ao Kanban. Busca full-text.

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 18.1 | Pagina /pipelines/:id/list: tabela com colunas configuráveis | Frontend | Tabela renderiza leads |
| 18.2 | Colunas: nome, empresa, valor, status, assignee, source, score, tags, created, last activity | Frontend | Todas as colunas renderizam |
| 18.3 | Colunas de custom fields: aparecem como colunas extras | Frontend | Campos custom visiveis na tabela |
| 18.4 | Ordenacao por coluna (click no header) | Frontend | ASC/DESC por qualquer coluna |
| 18.5 | Paginacao cursor-based com scroll infinito | Frontend | Scroll carrega mais leads |
| 18.6 | Filtros avancados: AND/OR composable (status + assignee + tag + source + custom field + score + date range) | Backend + Frontend | Filtros combinados funcionam |
| 18.7 | Busca full-text: PostgreSQL tsvector em name + email + company + notes | Backend | `?search=joao` retorna matches |
| 18.8 | Busca no header: search bar global | Frontend | Digitar e ver resultados instant |
| 18.9 | Toggle board/list: botoes para alternar visualizacao | Frontend | Switch preserva filtros |
| 18.10 | Bulk actions na list view: checkbox + barra de acoes (move, assign, tag, delete) | Frontend | Selecionar 10 leads → bulk move |

**Dependencias:** Sprint 6 (board), Sprint 7 (custom fields)
**Risco:** tsvector precisa de migration para criar indice GIN — incluir no schema
**Teste de aceite:** Abrir list view → ordenar por valor DESC → filtrar por tag + source → buscar "empresa x" → selecionar 5 leads → bulk assign

---

### SPRINT 19 — Webhooks Outbound
**Goal:** CRM envia eventos para URLs externas (n8n, Slack, custom).

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 19.1 | Prisma schema: Webhook, WebhookLog | Schema | Migration roda |
| 19.2 | Webhook module: CRUD + HMAC secret generation | Backend | Criar webhook com URL + events |
| 19.3 | Delivery engine: escuta events → envia POST para URLs registradas | Backend | Event lead.won → POST para URL |
| 19.4 | Payload assinado: header `X-Webhook-Signature` com HMAC-SHA256 | Backend | Assinatura validavel pelo receptor |
| 19.5 | Retry com backoff: 3 tentativas (1s, 30s, 5min) | Backend | Falha → retry → log |
| 19.6 | Auto-disable: 10 failures consecutivas → desativa webhook | Backend | Webhook desativado, notifica admin |
| 19.7 | Webhook test: POST /webhooks/:id/test (envia payload de teste) | Backend | Botao "Testar" envia ping |
| 19.8 | Settings page: CRUD webhooks + log viewer + test button | Frontend | UI completa |
| 19.9 | Cron job: retry fila de webhooks falhados | Backend | Retry em background |

**Dependencias:** Sprint 10 (event bus)
**Risco:** Nenhum
**Teste de aceite:** Criar webhook para webhook.site → criar lead → ver delivery no log → simular falha → ver retry → 10 falhas → auto-disable

---

### SPRINT 20 — Import/Export + Dedup
**Goal:** Importar leads em massa, exportar dados, detectar duplicatas.

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 20.1 | Import: upload CSV → preview 10 linhas → column mapping | Backend + Frontend | Wizard funcional |
| 20.2 | Import: validacao por linha (email invalido, campo obrigatorio vazio) | Backend | Erros mostrados por linha |
| 20.3 | Import: dedup check (por email/phone) → opcoes: pular, atualizar, criar | Backend + Frontend | Duplicatas detectadas |
| 20.4 | Import: processamento em background (BullMQ) com progress bar | Backend + Frontend | Import de 1000 leads com progresso |
| 20.5 | Import: relatorio final (X importados, Y atualizados, Z erros) | Frontend | Resumo pos-import |
| 20.6 | Export: CSV filtrado (exporta o que esta na tela) | Backend + Frontend | Botao "Exportar" gera CSV |
| 20.7 | Export: background job para grandes volumes + link por email | Backend | Export de 10k leads funciona |
| 20.8 | Dedup detection: busca contacts com email/phone/nome similar | Backend | Lista de possiveis duplicatas |
| 20.9 | Dedup merge: selecionar master, transferir leads, soft-delete duplicata | Backend + Frontend | Merge funcional |
| 20.10 | Settings page: /import-export com historico de imports | Frontend | Ver imports anteriores |

**Dependencias:** Sprint 5 (leads), Sprint 8 (tags/sources para mapping)
**Risco:** BullMQ precisa Redis (ja disponivel) — adicionar ao docker-compose
**Teste de aceite:** Upload CSV 100 leads → mapear colunas → ver preview → importar → ver leads no board → detectar duplicata → merge

---

### SPRINT 21 — MCP Server + Skill
**Goal:** CRM 100% operavel via Claude Code terminal.

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 21.1 | Criar repo `crm-jp-mcp`: package, tsconfig, @modelcontextprotocol/sdk | Infra | `npm run build` compila |
| 21.2 | Config: API URL + API key via env | Infra | Conecta na API |
| 21.3 | API client tipado: wrapper HTTP para todos os endpoints | MCP | Client funcional |
| 21.4 | Name resolver: "Marcelao" → userId, "Vendas B2B" → pipelineId | MCP | Resolve nomes fuzzy |
| 21.5 | Tools de Leads: create, list, get, update, move, assign, delete, add_note, bulk | MCP | ~10 tools funcionais |
| 21.6 | Tools de Pipelines: list, create, get, create_status | MCP | ~4 tools |
| 21.7 | Tools de Tags & Sources: list, create, tag/untag | MCP | ~5 tools |
| 21.8 | Tools de Team: list, invite | MCP | ~2 tools |
| 21.9 | Tools de Dashboard: kpis, funnel, leads_by_source, stale, cpl, conversion | MCP | ~6 tools |
| 21.10 | Tools de Notifications: list, mark_read | MCP | ~2 tools |
| 21.11 | Registrar MCP server no ~/.claude/settings.json | Config | Tools aparecem no Claude Code |
| 21.12 | Skill /crm: prompt com exemplos de uso e smart routing | Skill | `/crm dashboard` funciona |
| 21.13 | Testes end-to-end: todos os fluxos via terminal | QA | Criar lead → mover → assign → dashboard — tudo via CLI |

**Dependencias:** Todos os sprints anteriores (API completa)
**Risco:** Nenhum
**Teste de aceite:** `/crm cria lead "Joao" pipeline Vendas B2B origem Google Ads valor 50k` → `/crm move lead Joao pra Proposta` → `/crm atribui pro Marcelao` → `/crm dashboard`

---

### SPRINT 22 — Security, LGPD e Polish
**Goal:** Pronto para produção. Seguro. Compliance.

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 22.1 | Helmet: security headers | Backend | Headers presentes em toda response |
| 22.2 | CORS: configurado por env (whitelist de origins) | Backend | Apenas origins permitidos |
| 22.3 | Rate limiting global: 60 req/min por IP (autenticado: 120) | Backend | 429 apos limite |
| 22.4 | ValidationPipe global: whitelist + transform | Backend | Campos extras rejeitados |
| 22.5 | LGPD: export de dados de um Contact (JSON) | Backend | GET /contacts/:id/export retorna tudo |
| 22.6 | LGPD: anonimizar Contact (remove PII, preserva Lead para reports) | Backend | PATCH /contacts/:id/anonymize limpa dados |
| 22.7 | Forgot password: enviar email com link de reset | Backend + Frontend | Fluxo completo funcional |
| 22.8 | Responsividade: sidebar collapsible, Kanban scrollable em mobile | Frontend | Testado em viewport 375px |
| 22.9 | Dark mode (opcional, baseado no sistema) | Frontend | Toggle funciona |
| 22.10 | Error boundaries: paginas de erro amigaveis (404, 500, offline) | Frontend | Erros nao quebram o app |
| 22.11 | Performance audit: Lighthouse score > 80 | Frontend | Score aceitavel |

**Dependencias:** Todos os sprints anteriores
**Risco:** Nenhum
**Teste de aceite:** Lighthouse > 80 → rate limit funciona → LGPD export + anonymize → forgot password → mobile responsivo

---

### SPRINT 23 — Deploy & Go-Live
**Goal:** Aplicacao em producao, acessivel via URL.

**Backlog:**
| # | Item | Tipo | DoD |
|---|------|------|-----|
| 23.1 | Dockerfile NestJS: multi-stage build | Infra | Image < 200MB |
| 23.2 | Dockerfile Next.js: multi-stage standalone | Infra | Image < 300MB |
| 23.3 | docker-compose.prod.yml: api + web + postgres + redis + nginx | Infra | Stack completa sobe |
| 23.4 | nginx.conf: reverse proxy, SSL (certbot), gzip, security headers | Infra | HTTPS funcional |
| 23.5 | CI/CD: GitHub Actions (lint → test → build → deploy) | Infra | Push na main deploya |
| 23.6 | Backup PostgreSQL: pg_dump + rotacao (cron) | Infra | Backup diario funcionando |
| 23.7 | Health check + monitoring basico (uptime) | Infra | Alerta se cair |
| 23.8 | .env.production configurado | Infra | Secrets em env vars, nao no codigo |
| 23.9 | Seed de producao: org do JP + user admin | Data | Primeiro acesso funcional |
| 23.10 | Smoke test em producao: register → login → criar pipeline → criar lead → Kanban | QA | Fluxo golden path funciona em prod |

**Dependencias:** Sprint 22
**Risco:** DNS e SSL — configurar antes do deploy
**Teste de aceite:** Acessar URL publica → registrar → operar o CRM completo → tudo funciona em HTTPS

---

### Resumo do Backlog

| Sprint | Entrega | Depende de | Items |
|--------|---------|------------|-------|
| 1 | Infraestrutura & Boilerplate | — | 11 |
| 2 | Auth Backend | 1 | 12 |
| 3 | Auth Frontend | 2 | 8 |
| 4 | Pipeline Engine Backend | 2 | 10 |
| 5 | Lead Lifecycle Backend | 4 | 15 |
| 6 | Kanban Frontend | 5 | 14 |
| 7 | Custom Fields | 6 | 9 |
| 8 | Tags + Lead Sources | 7 | 12 |
| 9 | UTM + API Publica | 8 | 11 |
| 10 | Activity Log + Timeline | 5, 6 | 7 |
| 11 | Notas, Tasks, Attachments | 10 | 9 |
| 12 | Convites e Colaboracao | 2, 6 | 8 |
| 13 | Notificacoes Real-Time | 10, 12 | 14 |
| 14 | Automation Engine | 10, 13 | 15 |
| 15 | Lead Scoring | 7, 8 | 8 |
| 16 | Dashboard KPIs Default | 6, 8 | 14 |
| 17 | Dashboard Custom KPIs | 16 | 12 |
| 18 | List View + Busca + Filtros | 6, 7 | 10 |
| 19 | Webhooks Outbound | 10 | 9 |
| 20 | Import/Export + Dedup | 5, 8 | 10 |
| 21 | MCP Server + Skill | Todos | 13 |
| 22 | Security, LGPD, Polish | Todos | 11 |
| 23 | Deploy & Go-Live | 22 | 10 |
| **TOTAL** | | | **246 items** |

### Grafo de Dependencias (caminho critico)

```
Sprint 1 → 2 → 3 (auth completo)
                2 → 4 → 5 → 6 (Kanban funcional)
                              6 → 7 → 8 → 9 (personalizacao + tracking)
                         5 + 6 → 10 → 11 (engagement)
                              10 → 13 → 14 (notifications + automations)
                         2 + 6 → 12 (colaboracao)
                              7 + 8 → 15 (scoring)
                              6 + 8 → 16 → 17 (dashboard)
                              6 + 7 → 18 (list view)
                                  10 → 19 (webhooks)
                              5 + 8 → 20 (import/export)
                              Todos → 21 → 22 → 23
```

**Caminho critico:** 1 → 2 → 4 → 5 → 6 → 7 → 8 → 9 → ... → 21 → 22 → 23

### Sprints paralelizaveis (se quiser acelerar)

Estes sprints NAO dependem um do outro e podem ser executados em paralelo:
- Sprint 10 + Sprint 12 (ambos dependem de 5/6, nao dependem entre si)
- Sprint 15 + Sprint 16 + Sprint 18 (scoring, dashboard, list view — independentes)
- Sprint 19 + Sprint 20 (webhooks e import — independentes)

---

## 14. Decisoes Tecnicas

| Decisao | Escolha | Justificativa |
|---------|---------|---------------|
| Multi-tenancy | Row-level (orgId) + Prisma middleware | Simples, 1 DB, sem overhead. Middleware garante isolamento |
| Custom fields storage | EAV com colunas tipadas | Queries nativas por tipo, sem cast. Filtros performaticos |
| Lead vs Contact | Entidades separadas | Contact reutilizavel entre pipelines e leads. Dedup por Contact |
| Drag-and-drop | dnd-kit | Leve, acessivel, collision customizavel, DragOverlay |
| Concorrencia | Optimistic locking (version) | Detecta conflito sem lock pessimista. UX com toast de conflito |
| Event handling | EventEmitter2 (sincrono + async) | Activity sincrono (transaction). Notification/Webhook async |
| Real-time | Socket.IO (@nestjs/websockets) | Bidirecional, rooms, reconexao, fallback polling |
| Caching | Redis (cache-aside) | TTL por recurso, invalidacao por event bus |
| Graficos | Recharts | React nativo, composavel, 10+ tipos, leve |
| Dashboard grid | react-grid-layout | Drag + resize, persist layout, breakpoints responsivos |
| State management | React Query (server) + Zustand (client) | Cache automatico, optimistic updates, revalidation |
| Formularios | React Hook Form + Zod | Validacao tipada, performatico, boa DX |
| HTTP client | Axios + interceptors | Token injection, refresh transparente, error handling |
| CLI/Terminal | MCP Server + Skill | Operacao nativa no Claude Code |
| MCP runtime | @modelcontextprotocol/sdk | SDK oficial TypeScript |
| Jobs/Cron | @nestjs/schedule | Snapshots, stale leads, score, webhook retry. Sem infra extra |
| Upload | S3/MinIO + presigned URLs | Upload direto do browser, sem passar pelo backend |
| Email | Nodemailer (dev) → SES/Resend (prod) | Convites, reset password, digest |
| Search (MVP) | PostgreSQL ILIKE + tsvector | Sem Elasticsearch inicialmente. Suficiente ate ~100k leads |
| Import processing | BullMQ | Background job com progress tracking |
