# Integração CRM → Meta (API de Conversões)

Envia os estágios do funil do CRM-SWIFT para a Meta, para que as campanhas
otimizem por lead qualificado e por venda fechada — não só por clique.

- **Dataset:** `1046663431035766` — "LEAD - SWIFT"
- **Portfólio:** Agencia Swift | Marketing Digital (`1677323072873878`)
- **Conta de anúncios:** CA - Marcos Lourenço (`1134573018629004`)
- **Endpoint:** `POST https://graph.facebook.com/v26.0/1046663431035766/events`

## Mapa de eventos

Não há regra hardcoded: o evento sai das flags que a coluna do funil já tem
em `PipelineStatus`. Marque a flag no funil e o evento passa a disparar.

| Flag da coluna | Evento na Meta | Valor |
|---|---|---|
| `isWon` | `Purchase` | `estimatedValue / 100` em BRL |
| `isMeeting` | `Schedule` | — |
| `isMql` | `Lead` | — |
| nenhuma | não dispara | — |

`isWon` tem precedência quando mais de uma flag está ligada.

## Como dispara

O `MetaCapiListener` escuta o barramento que já existia (`lead.created` e
`lead.status_changed`). Nenhum serviço de lead foi alterado.

O envio é best-effort: falha não bloqueia a request do usuário, fica no log e
na tabela `meta_capi_events`.

## Deduplicação

A unique `[leadId, eventName]` em `meta_capi_events` garante **um evento por
estágio por lead**. Um replay não consegue inflar a conversão dentro da Meta.

Para reenviar algo que falhou, use `force: true` no endpoint de envio manual.

## Configuração

```bash
META_CAPI_ENABLED=true
META_CAPI_DATASET_ID=1046663431035766
META_CAPI_ACCESS_TOKEN=<token do dataset>
META_CAPI_API_VERSION=v26.0
META_CAPI_LEAD_EVENT_SOURCE=CRM SWIFT
META_CAPI_TEST_EVENT_CODE=          # só durante o teste; VAZIO em produção
```

Enquanto `META_CAPI_ENABLED=false`, nada é enviado e nada é gravado.

O token sai do Gerenciador de Eventos → dataset LEAD - SWIFT → Configurações →
API de Conversões → Gerar token de acesso. Ele **não** é persistido em lugar
nenhum: só a carga entra em `meta_capi_events.payload`.

## Endpoints (ADMIN)

| Método | Rota | Para quê |
|---|---|---|
| `GET` | `/meta-capi/stats` | estado da integração e placar por evento/status |
| `GET` | `/meta-capi/events?status=FAILED` | últimos envios |
| `GET` | `/meta-capi/leads/:leadId/events` | histórico de um lead |
| `POST` | `/meta-capi/leads/:leadId/send` | envio manual — `{ eventName, force }` |

## Qualidade da correspondência

A Meta casa o evento com a conta da pessoa nesta ordem de força:

1. **`lead_id`** — o `leadgen_id` de Formulário Instantâneo (15–17 dígitos).
   É o sinal mais forte que existe. Vai como número, sem hash.
2. **`fbc`** — o click id. Vem do cookie `_fbc` ou é reconstruído do `fbclid`.
3. **`em`** / **`ph`** — email e telefone em SHA-256.

Se o lead não tiver **nenhuma** dessas chaves, o evento é marcado `SKIPPED` e
não é enviado — mandar sem chave só sujaria o diagnóstico.

### O que o formulário precisa mandar

O `_fbp` só existe no navegador e não dá para reconstruir depois. Se o seu
formulário não mandar, esse sinal está perdido para sempre naquele lead.

```html
<script>
  function cookie(nome) {
    return document.cookie.match('(^|;)\\s*' + nome + '\\s*=\\s*([^;]+)')?.pop() || '';
  }
  // Anexe ao POST de criação do lead na API pública:
  payload.fbp = cookie('_fbp');
  payload.fbc = cookie('_fbc');
  payload.fbclid = new URLSearchParams(location.search).get('fbclid') || '';
  // Só para lead vindo de Formulário Instantâneo da Meta:
  payload.meta_lead_id = '<leadgen_id>';
</script>
```

## Testar antes de valer

```bash
npm run meta:testar
```

Manda um evento `Lead` de teste direto para a Meta e imprime a resposta. Se o
token estiver faltando, o próprio script diz onde gerar.

1. Preencha `META_CAPI_TEST_EVENT_CODE` com o código da aba **Eventos de teste**
   do Gerenciador de Eventos.
2. Rode `npm run meta:testar`, ou mova um lead para uma coluna com flag.
3. O evento aparece na aba Eventos de teste quase na hora.
4. **Apague a variável** — com ela preenchida o evento não conta como conversão
   de verdade.

O evento de teste confirma a conexão, não a qualidade dos dados. A precisão
aparece depois em Gerenciador de Eventos → Diagnóstico.
