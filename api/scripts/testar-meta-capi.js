/**
 * Manda um evento de teste REAL para a Meta e mostra a resposta.
 *
 * Uso:
 *   npm run meta:testar
 *
 * Precisa de META_CAPI_ACCESS_TOKEN e META_CAPI_TEST_EVENT_CODE no .env.
 * O evento aparece em Gerenciador de Eventos -> dataset -> Eventos de teste.
 */
require('dotenv/config');
const { createHash } = require('node:crypto');

const {
  META_CAPI_DATASET_ID: dataset,
  META_CAPI_ACCESS_TOKEN: token,
  META_CAPI_API_VERSION: versao = 'v26.0',
  META_CAPI_LEAD_EVENT_SOURCE: origem = 'CRM SWIFT',
  META_CAPI_TEST_EVENT_CODE: codigoTeste,
} = process.env;

const erro = (msg) => {
  console.error(`\n  ERRO: ${msg}\n`);
  process.exit(1);
};

if (!dataset) erro('META_CAPI_DATASET_ID não está no .env');
if (!token) {
  erro(
    'META_CAPI_ACCESS_TOKEN está vazio no .env.\n' +
      '  Gere em: business.facebook.com/events_manager\n' +
      '  -> dataset LEAD - SWIFT -> Configurações -> API de Conversões\n' +
      '  -> Gerar token de acesso',
  );
}

const hash = (v) => createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');

const evento = {
  event_name: 'Lead',
  event_time: Math.floor(Date.now() / 1000),
  event_id: `teste-${Date.now()}`,
  action_source: 'system_generated',
  user_data: {
    em: [hash('teste@exemplo.com.br')],
    ph: [hash('5511999998888')],
  },
  custom_data: {
    event_source: 'crm',
    lead_event_source: origem,
  },
};

const corpo = { data: [evento] };
if (codigoTeste) corpo.test_event_code = codigoTeste;

const url = `https://graph.facebook.com/${versao}/${dataset}/events`;

(async () => {
  console.log(`\n  Dataset .......... ${dataset}`);
  console.log(`  Endpoint ......... ${url}`);
  console.log(
    `  Modo ............. ${codigoTeste ? `TESTE (${codigoTeste})` : 'PRODUÇÃO — conta como conversão de verdade'}`,
  );
  console.log('\n  Carga enviada:');
  console.log(JSON.stringify(corpo, null, 2).split('\n').map((l) => '    ' + l).join('\n'));

  const res = await fetch(`${url}?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });

  const texto = await res.text();
  console.log(`\n  Resposta HTTP ${res.status}:`);
  try {
    console.log(JSON.stringify(JSON.parse(texto), null, 2).split('\n').map((l) => '    ' + l).join('\n'));
  } catch {
    console.log('    ' + texto);
  }

  if (res.ok && !texto.includes('"error"')) {
    console.log(
      codigoTeste
        ? '\n  OK. Abra a aba "Eventos de teste" do dataset — deve aparecer em segundos.\n'
        : '\n  OK. O evento foi para produção.\n',
    );
  } else {
    console.log('\n  A Meta recusou. O campo "message" acima diz o motivo.\n');
    process.exit(1);
  }
})().catch((e) => erro(e.message));
