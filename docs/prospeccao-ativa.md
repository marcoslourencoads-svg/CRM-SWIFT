# Prospecção ativa (outbound)

Módulo para abordar negócios frios — Instagram, WhatsApp, e-mail ou ligação —
insistir com follow-up e medir o funil. Substitui a planilha de prospecção do
Google Sheets.

Prospect **não** é lead. Ele vive em tabelas próprias e só vira `Lead` do
pipeline de vendas quando esquenta, para que centenas de contatos frios não
entrem no kanban nem na contagem do dashboard.

## Por que não foi feito como um pipeline

O CRM já tem `Pipeline` + `PipelineStatus`, e seria mais barato criar um
funil "Prospecção Ativa". Três coisas impediram:

1. **Cadência ilimitada.** Cada follow-up precisa ser um registro com data,
   canal, script e resultado. Como custom field, isso trava no número de
   campos criados — foi exatamente o limite da planilha (3 FUPs).
2. **Funil por coorte.** O `dashboard.service.ts` conta lead **parado** em
   cada status. Para prospecção isso mente: quem fechou contrato desapareceria
   dos degraus anteriores e a taxa de resposta pareceria menor do que é.
3. **Volume frio.** 500 perfis não abordados poluiriam o board de vendas e a
   contagem de leads do mês.

## Modelo

| Tabela | Papel |
|---|---|
| `prospects` | O contato frio. Etapa, qualificação, carimbos e cadência. |
| `prospect_touches` | Um registro por toque. Substitui as 6 colunas de FUP. |
| `prospect_lists` | O lote/campanha. Guarda a **cadência**. |
| `prospect_approaches` | Catálogo de scripts do primeiro toque. |
| `prospect_notes` | Diário de bordo: uma anotação por vez, com a etapa carimbada. |

### A etapa é um campo, não uma inferência

Na planilha a etapa era deduzida de 11 booleanos independentes, que podiam se
contradizer ("Fechou Contrato: Sim" com "RESPONDEU: Não"). Aqui existe
`ProspectStage`, e **quem a deriva é sempre o service** — o DTO de update nem
aceita `stage` ou carimbos crus (`forbidNonWhitelisted` recusa).

```
NEW → CONTACTED → FOLLOW_UP → RESPONDED → MEETING_SET → MEETING_DONE → WON
                                                      ↘ LOST / DISQUALIFIED
```

Avançar para um posto preenche **para trás** todo carimbo ainda vazio
(`stampsFor`). É isso que garante que "fez reunião" implique "respondeu" e
"foi abordado". `LOST`/`DISQUALIFIED` ficam fora da escala: dá para perder em
qualquer ponto, e sair de lá limpa `lostAt`/`lostReasonId`/`lostNote`.

### A cadência agenda sozinha

`ProspectList.cadenceDays` (padrão `[2, 4, 7]`) são os intervalos **entre** os
toques. Ao registrar o toque `n`, o servidor grava
`nextActionAt = sentAt + cadenceDays[n-1]`.

```
abordagem ──2d──> FUP 1 ──4d──> FUP 2 ──7d──> FUP 3 ──> cadência esgotada
```

Esgotada a cadência, `nextActionAt` fica nulo e o prospect cai no balde
"cadência esgotada" da fila — **sinalizado, não morto**. Quem decide enterrar
é o operador.

Resposta (positiva **ou** negativa) interrompe a cadência e leva para
`RESPONDED`. Recusar é responder: as duas entram na taxa de resposta do funil;
enterrar é ato separado.

`@@unique([prospect_id, sequence])` impede toque duplicado na mesma posição se
duas requisições chegarem juntas.

### O diário de bordo

Cada anotação guarda **a etapa em que o prospect estava no momento da
escrita**. É uma cópia de propósito: avançar de etapa depois não pode
reescrever o passado. A ficha mostra o diário do mais recente para o mais
antigo, acima da trilha de toques.

Antes existia um único campo de texto solto (`prospects.notes`), de uma
linha só, em que cada edição apagava a anterior. A migração
`20260905170000` move o que estava escrito para a primeira entrada do
diário e derruba a coluna — não há dois lugares para escrever a mesma
coisa.

A observação preenchida **no cadastro** vira essa primeira entrada, em
vez de exigir que se abra a ficha logo em seguida.

### Compromisso com hora

`nextActionAt` guarda dia **e hora**. Três coisas dependem dele:

1. **Fila do dia** — os baldes de atrasado / hoje.
2. **Calendário** — `GET /prospects/agenda?from&to` alimenta a mesma
   grade das tarefas, em âmbar.
3. **Sino** — `ProspectReminderScheduler` roda de 5 em 5 minutos e cria
   uma notificação `PROSPECT_DUE` 30 minutos antes da hora marcada, para
   o dono do prospect. Tem guarda contra repetir o mesmo aviso dentro da
   janela.

> **Fuso.** Data e hora escolhidas na tela são lidas como horário LOCAL.
> `new Date('2026-09-05')` seria meia-noite **UTC** — 21h do dia anterior
> no Brasil — e o cadastro nasceria vencido; foi exatamente o bug
> relatado. O helper `paraInstante()` monta o instante com o construtor
> de argumentos separados, que não tem essa armadilha.
>
> Pelo mesmo motivo `GET /prospects/queue` aceita `tzOffset` (minutos, o
> que `Date.getTimezoneOffset()` devolve): em produção a API roda em UTC,
> e sem isso o "hoje" do servidor não seria o "hoje" de quem olha.

## Telas

| Rota | Papel |
|---|---|
| `/prospecting` | **Fila do dia**: atrasados, hoje, não abordados, cadência esgotada |
| `/prospecting/board` | Kanban por etapa (dnd-kit) |
| `/prospecting/funnel` | O funil e os cruzamentos |
| `/prospecting/lists` | Listas, cadência e catálogo de abordagens |
| `/prospecting/import` | Importa o CSV da planilha antiga |

A fila do dia é a tela que a planilha nunca teve: lá a data do FUP era digitada
**depois** que ele acontecia, então não havia como perguntar "quem eu toco
hoje?".

## O funil

`GET /prospecting/funnel` e `GET /prospecting/analytics` (ambos `@Roles('MANAGER')`).

**A coorte é quem foi abordado no período** (`firstContactedAt BETWEEN from AND to`),
e cada degrau conta quem **algum dia** atingiu o carimbo:

```
Abordados          firstContactedAt != null
Responderam        respondedAt      != null
Reuniões agendadas meetingSetAt     != null
Reuniões feitas    meetingHeldAt    != null
Fechamentos        wonAt            != null
```

Cada degrau devolve `pctFromPrev` (onde se perde gente) **e** `pctFromTop`
(quanto sobra no fim). A planilha só mostrava uma das duas.

### `porToque` — a métrica-âncora

Taxa de resposta por número do toque: quantas respostas vieram na abordagem,
no FUP 1, no FUP 2, no FUP 3. É o número que decide se cada follow-up paga o
esforço, e a planilha não conseguia produzi-lo.

Contexto de origem: na planilha as colunas de FUP estavam quase todas vazias —
a operação parava no primeiro toque. Os 5,26% de resposta (1 em 19) mediam
*abordagem única sem follow-up*, não a prospecção do time.

### Cruzamentos

`porAbordagem` (script), `porResponsavel`, `porNicho`, `porAnuncio`,
`porCanal`, `porLista`, e `motivosPerda` agregado pelo catálogo `LostReason` —
não por texto livre.

`porAnuncio` e `porAbordagem` existem porque a planilha **coletava** "Tem
Anúncio?" e "Principal abordagem" e nunca cruzava nada com eles.

### Amostra

Todo degrau e todo corte devolve `amostraSuficiente` (n ≥ 30). Abaixo disso o
front marca "n baixo": uma resposta a mais ou a menos muda a taxa inteira.
Serve para não repetir a decisão tomada em cima de 19 registros.

### Métricas de tempo e dinheiro

`totalContratos`, `ticketMedio` (as duas células que estavam em `#REF!`),
`cicloMedioDias`, `tempoMedioAteRespostaHoras`, `toquesMedioAteResposta` e
`noShowRate` — a planilha tinha "Agendou reunião" e "Fez reunião" lado a lado
e nunca subtraía.

> Dinheiro em **centavos**, como no resto do CRM (`formatCurrency` divide por
> 100). `dealValue` é copiado direto para `Lead.estimatedValue` na conversão.

## Importar a planilha

`POST /prospects/import?listId=` (CSV, multipart). Os cabeçalhos originais são
reconhecidos com acento e caixa.

| Coluna da planilha | Vira |
|---|---|
| `Link do Instagram` | `profileUrl` + `handle` normalizado |
| `Tem Anuncio?` | `hasAds` |
| `Data da mensagem` | toque `sequence=1` + `firstContactedAt` |
| `Principal abordagem` | `ProspectApproach` (criada se não existir) |
| `Data do FUP 1..3` + `FEZ FUP?` | toques `sequence=2..4` |
| `RESPONDEU?` | `respondedAt` + etapa |
| `Agendou reunião?` / `Fez reunião?` | `meetingSetAt` / `meetingHeldAt` |
| `Fechou Contrato?` / `Valor` | `wonAt` / `dealValue` (× 100) |
| `Se não fechou, qual motivo?` | `lostNote` |

**Ressalva que o import devolve em `avisos`:** a planilha não registra *quando*
houve resposta, reunião ou fechamento — só *se* houve. Esses carimbos são
ancorados na data do último toque conhecido, então **ciclo médio e tempo até
resposta dos registros importados são aproximados**. Os dados criados dentro do
CRM têm data real.

`GET /prospects/export` devolve o CSV de volta, com valor em reais.

## Conversão em lead

`POST /prospects/:id/convert` cria (ou reaproveita, por e-mail/telefone) o
`Contact`, cria o `Lead` no pipeline escolhido com `temperature: HOT` e origem
`LeadSourceType.OUTBOUND`, registra `Activity` `CREATED` e emite `lead.created`
no `EventEmitter2` — automações, notificações e Meta CAPI continuam
funcionando sem saber que veio da prospecção.

`prospects.lead_id` é `@unique`: converter duas vezes devolve 409.

## Bootstrap e organizações que já existiam

`organization-bootstrap.service.ts` → `ensureProspecting()`, idempotente,
disparado no registro (`auth.service.ts`) e pelo `prisma db seed`:

- Garante uma `LeadSource` do tipo `OUTBOUND` — checada **pelo tipo**, porque
  as orgs existentes já têm origens semeadas e nenhuma delas era outbound; sem
  ela a conversão sairia sem origem.
- Cria a lista "Prospecção geral" com cadência `[2, 4, 7]`.
- Cria 3 abordagens iniciais.

Isso cobre org nova. Para as que **já existiam** há a migração
`20260904130000_backfill_prospecting_setup`, que faz o mesmo em SQL para
toda organização sem esses registros. Sem ela, uma org antiga abriria a
aba e nada seria agendado — a fila do dia nasceria vazia para sempre, sem
erro nenhum na tela.

Como terceira rede: um prospect fora de qualquer lista usa
`DEFAULT_CADENCE` (`[2, 4, 7]`) em vez de ficar sem follow-up.

## Testes e verificação

### Unitários — `cd api && npx jest src/modules/prospecting`

Sem banco, rápidos:

| Arquivo | Cobre |
|---|---|
| `prospecting-analytics.service.spec.ts` | funil por coorte, dupla porcentagem, resposta por toque, cortes, amostra mínima |
| `prospects.service.spec.ts` | carimbos monotônicos, ordem das etapas, cadência (inclusive o fallback), ações em massa |
| `prospect-import.service.spec.ts` | parsers de célula, reconstrução dos toques, importação com os cabeçalhos originais |
| `prospects.routes.spec.ts` | `/queue` e `bulk/*` não engolidos por `:id`, validação dos DTOs |

### E2E da API — `cd api && npm run test:e2e`

Sobe o `AppModule` inteiro contra o banco: `/health`, e que toda rota de
prospecção nasce protegida pelos guards globais.

### Ponta a ponta — `cd api && npm run prospeccao:verificar`

Precisa da API no ar. Registra uma organização nova (exercitando o
bootstrap), monta uma coorte de 40 prospects com números escolhidos a
mão e confere **45 asserções** contra o que a API devolve: cadência,
carimbos, fila, degraus do funil, ticket médio, no-show, resposta por
toque, recorte por coorte, conversão em lead e exportação.

A coorte é desenhada para provar a métrica-âncora:

```
grupo  qtd  toques  responde no      seq 1: 40 enviados,  0 respostas =   0,00%
A1       4     2       toque 2       seq 2: 24 enviados,  4 respostas =  16,67%
A2       5     3       toque 3       seq 3: 12 enviados,  5 respostas =  41,67%
A3       3     4       toque 4       seq 4:  3 enviados,  3 respostas = 100,00%
B1/2/3  28   1..3      nunca
```

### Melhorias — `cd api && npm run melhorias:verificar`

Precisa da API no ar. Exercita as quatro melhorias (observação no
cadastro, "já abordei", compromisso com hora na agenda, diário por etapa)
e o bug do cadastro nascendo atrasado. **19 asserções.**

### Interface — `cd web && npm run ui:verificar`

Precisa da API (3333) e do front (3000) no ar. Faz login num navegador
de verdade, percorre as cinco telas, confere **43 asserções** (inclusive
que os números do funil aparecem na tela e que os filtros mostram o
rótulo, não o valor cru) e salva PNGs em `web/shots/`.

> As páginas são client components atrás do `AuthGuard`, então `curl` só
> enxerga o spinner — verificar a UI exige navegador.

### Melhorias na tela — `cd web && npm run ui:melhorias`

Opera pelo formulário num navegador de verdade: liga o "já abordei",
escreve no diário, e confere que o cadastro **não** nasce atrasado —
coisa que só dá para ver com o relógio local. **26 asserções**, com
capturas.
