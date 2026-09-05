/**
 * Verificação ponta a ponta da prospecção ativa, contra a API de verdade.
 *
 * Monta uma coorte com números escolhidos a mão, exercita a API por HTTP
 * (fila, cadência, etapas, conversão, funil) e confere cada número que o
 * servidor devolve contra o valor calculado aqui. Falha com exit 1.
 *
 * Uso:
 *   npm run prospeccao:verificar
 *
 * Precisa da API no ar (npm run start:dev) e do banco migrado.
 */
require('dotenv/config');

const API = process.env.API_URL || `http://localhost:${process.env.API_PORT || 3333}`;
const DIA = 24 * 60 * 60 * 1000;
const agora = Date.now();
const diasAtras = (n) => new Date(agora - n * DIA).toISOString();

let token = '';
let falhas = 0;
let checks = 0;

// ─── Utilitários ──────────────────────────────────────────────

async function req(metodo, rota, corpo) {
  const res = await fetch(`${API}${rota}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
  });

  const texto = await res.text();
  let json;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = texto;
  }

  if (!res.ok) {
    const msg = json?.message ?? json ?? res.statusText;
    throw new Error(`${metodo} ${rota} -> ${res.status}: ${JSON.stringify(msg)}`);
  }
  return json?.data !== undefined ? json.data : json;
}

function conferir(rotulo, obtido, esperado) {
  checks += 1;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (ok) {
    console.log(`  ok   ${rotulo}: ${JSON.stringify(obtido)}`);
  } else {
    falhas += 1;
    console.log(`  FALHA ${rotulo}: esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);
  }
}

function titulo(t) {
  console.log(`\n\x1b[1m${t}\x1b[0m`);
}

// ─── A coorte ─────────────────────────────────────────────────
//
// 40 abordados. As respostas foram plantadas em toques diferentes de
// propósito: é o que prova a métrica que a planilha não produzia —
// a resposta por número de toque.
//
//   grupo   qtd  toques  responde no
//   A1        4     2        toque 2
//   A2        5     3        toque 3
//   A3        3     4        toque 4
//   B1       16     1        nunca
//   B2        8     2        nunca
//   B3        4     3        nunca
//
// Daí: 12 respostas, e por toque ->
//   seq 1: 40 enviados,  0 respostas =   0,00%
//   seq 2: 24 enviados,  4 respostas =  16,67%
//   seq 3: 12 enviados,  5 respostas =  41,67%
//   seq 4:  3 enviados,  3 respostas = 100,00%
const GRUPOS = [
  { nome: 'A1', qtd: 4, toques: 2, respondeNoToque: 2 },
  { nome: 'A2', qtd: 5, toques: 3, respondeNoToque: 3 },
  { nome: 'A3', qtd: 3, toques: 4, respondeNoToque: 4 },
  { nome: 'B1', qtd: 16, toques: 1, respondeNoToque: null },
  { nome: 'B2', qtd: 8, toques: 2, respondeNoToque: null },
  { nome: 'B3', qtd: 4, toques: 3, respondeNoToque: null },
];

const TOTAL = 40;
const RESPONDERAM = 12;
const AGENDARAM = 6;
const COMPARECERAM = 4;
const FECHARAM = 2;
const VALORES = [300000, 200000]; // centavos: R$ 3.000 e R$ 2.000

async function main() {
  console.log(`Verificando prospecção ativa em ${API}`);

  // ── Organização nova, pelo caminho real de registro ─────────
  //
  // Registrar em vez de logar numa org existente e proposital: e o
  // mesmo caminho que um cliente novo percorre, e passa pelo bootstrap
  // (lead sources, motivos de perda, lista de prospeccao). Se o
  // bootstrap regredir, a conversao em lead perde a origem e este
  // roteiro pega.
  titulo('1. Registro de organização nova (exercita o bootstrap)');
  const selo = Date.now();
  const email = process.env.VERIFY_EMAIL || `verificacao+${selo}@exemplo.test`;
  const registro = await req('POST', '/auth/register', {
    name: 'Verificador',
    email,
    password: 'verificacao123',
    organizationName: `Org de verificação ${selo}`,
  });
  token = registro.accessToken;
  console.log(`  ok   org criada e autenticada como ${email}`);

  const origens = await req('GET', '/lead-sources');
  const outbound = origens.filter((o) => o.type === 'OUTBOUND');
  conferir('bootstrap criou a origem OUTBOUND', outbound.length, 1);

  const listasIniciais = await req('GET', '/prospect-lists');
  conferir('bootstrap criou a lista padrão', listasIniciais.length >= 1, true);
  conferir(
    'lista padrão vem com cadência',
    listasIniciais.some((l) => l.cadenceDays.length > 0),
    true,
  );

  const abordagensIniciais = await req('GET', '/prospect-approaches');
  conferir('bootstrap criou as abordagens', abordagensIniciais.length, 3);

  // ── Lista com cadência conhecida ────────────────────────────
  titulo('2. Lista e cadência');
  const marca = `Verificação ${new Date().toISOString()}`;
  const lista = await req('POST', '/prospect-lists', {
    name: marca,
    niche: 'Hamburgueria',
    cadenceDays: [2, 4, 7],
  });
  conferir('cadência gravada', lista.cadenceDays, [2, 4, 7]);

  const abordagem = abordagensIniciais[0];

  // ── Cria a coorte ───────────────────────────────────────────
  titulo('3. Criando 40 prospects e registrando os toques');
  const criados = [];
  let n = 0;

  for (const grupo of GRUPOS) {
    for (let i = 0; i < grupo.qtd; i++) {
      n += 1;
      const p = await req('POST', '/prospects', {
        name: `Contato ${n}`,
        business: `Negócio ${n}`,
        niche: n % 2 === 0 ? 'Hamburgueria' : 'Pizzaria',
        handle: `negocio.${n}.${Date.now()}`,
        hasAds: n % 3 === 0,
        channel: 'INSTAGRAM',
        listId: lista.id,
      });

      // Toques com data no passado, o mais antigo primeiro.
      for (let seq = 1; seq <= grupo.toques; seq++) {
        const respondeAqui = grupo.respondeNoToque === seq;
        await req('POST', `/prospects/${p.id}/touches`, {
          outcome: respondeAqui ? 'REPLIED_POSITIVE' : 'NO_REPLY',
          sentAt: diasAtras(30 - (seq - 1) * 3),
          ...(seq === 1 && abordagem ? { approachId: abordagem.id } : {}),
        });
      }

      criados.push({ ...p, grupo: grupo.nome, respondeu: !!grupo.respondeNoToque });
    }
  }
  console.log(`  ok   ${criados.length} prospects criados`);

  // ── Avanço de etapa ─────────────────────────────────────────
  titulo('4. Reuniões e fechamentos');
  const responderam = criados.filter((p) => p.respondeu);
  conferir('quantos responderam', responderam.length, RESPONDERAM);

  for (let i = 0; i < AGENDARAM; i++) {
    await req('PATCH', `/prospects/${responderam[i].id}/stage`, { stage: 'MEETING_SET' });
  }
  for (let i = 0; i < COMPARECERAM; i++) {
    await req('PATCH', `/prospects/${responderam[i].id}/stage`, { stage: 'MEETING_DONE' });
  }
  for (let i = 0; i < FECHARAM; i++) {
    await req('PATCH', `/prospects/${responderam[i].id}/stage`, {
      stage: 'WON',
      dealValue: VALORES[i],
    });
  }
  console.log(`  ok   ${AGENDARAM} agendadas, ${COMPARECERAM} realizadas, ${FECHARAM} fechadas`);

  // ── Carimbos monotônicos ────────────────────────────────────
  titulo('5. Coerência dos carimbos (o que a planilha não garantia)');
  const fechado = await req('GET', `/prospects/${responderam[0].id}`);
  conferir('etapa', fechado.stage, 'WON');
  conferir('quem fechou tem carimbo de abordagem', !!fechado.firstContactedAt, true);
  conferir('quem fechou tem carimbo de resposta', !!fechado.respondedAt, true);
  conferir('quem fechou tem reunião agendada', !!fechado.meetingSetAt, true);
  conferir('quem fechou tem reunião realizada', !!fechado.meetingHeldAt, true);
  conferir('etapa terminal não tem próxima ação', fechado.nextActionAt, null);
  conferir('valor do contrato', fechado.dealValue, VALORES[0]);

  // ── Cadência ────────────────────────────────────────────────
  titulo('6. Cadência agendando sozinha');
  const semResposta = criados.find((p) => p.grupo === 'B1');
  const b1 = await req('GET', `/prospects/${semResposta.id}`);
  conferir('etapa após 1 toque', b1.stage, 'CONTACTED');
  conferir('toques', b1.touchCount, 1);
  const esperadoProximo = new Date(new Date(b1.lastTouchAt).getTime() + 2 * DIA).toISOString();
  conferir('próxima ação = último toque + 2 dias', b1.nextActionAt, esperadoProximo);

  const esgotado = criados.find((p) => p.grupo === 'B3');
  const b3 = await req('GET', `/prospects/${esgotado.id}`);
  conferir('etapa após 3 toques', b3.stage, 'FOLLOW_UP');
  conferir('cadência de 3 intervalos ainda agenda o 4º toque', !!b3.nextActionAt, true);

  const respondeu = await req('GET', `/prospects/${responderam[RESPONDERAM - 1].id}`);
  conferir('resposta interrompe a cadência', respondeu.nextActionAt, null);
  conferir('resposta leva para RESPONDED', respondeu.stage, 'RESPONDED');

  // ── Fila do dia ─────────────────────────────────────────────
  titulo('7. Fila do dia');
  const fila = await req('GET', '/prospects/queue');
  // Todos os toques foram datados no passado, então tudo que ainda está
  // na cadência tem que estar atrasado — nada pode ficar invisível.
  const naFila =
    fila.counts.atrasados + fila.counts.hoje + fila.counts.naoIniciados + fila.counts.cadenciaEsgotada;
  const aindaAtivos = TOTAL - AGENDARAM - (RESPONDERAM - AGENDARAM);
  conferir('atrasados aparecem na fila', fila.counts.atrasados >= aindaAtivos, true);
  conferir('fila não está vazia', naFila > 0, true);
  console.log(`  info fila: ${JSON.stringify(fila.counts)}`);

  // ── O funil ─────────────────────────────────────────────────
  titulo('8. Funil por coorte');
  const q = `listId=${lista.id}`;
  const funil = await req('GET', `/prospecting/funnel?${q}`);

  conferir('tamanho da coorte', funil.amostra, TOTAL);
  conferir('amostra suficiente (n >= 30)', funil.amostraSuficiente, true);

  const passos = funil.etapas.map((e) => [e.label, e.count, e.pctFromPrev, e.pctFromTop]);
  conferir('degraus do funil', passos, [
    ['Abordados', 40, 100, 100],
    ['Responderam', 12, 30, 30],
    ['Reuniões agendadas', 6, 50, 15],
    ['Reuniões realizadas', 4, 66.67, 10],
    ['Fechamentos', 2, 50, 5],
  ]);

  const m = funil.metricas;
  conferir('total em contratos', m.totalContratos, VALORES[0] + VALORES[1]);
  conferir('ticket médio', m.ticketMedio, (VALORES[0] + VALORES[1]) / 2);
  conferir('fechamentos', m.fechamentos, FECHARAM);
  conferir('no-show', m.noShowRate, 33.33);

  // ── A métrica-âncora ────────────────────────────────────────
  titulo('9. Resposta por número de toque (a métrica que a planilha não tinha)');
  const analytics = await req('GET', `/prospecting/analytics?${q}`);
  const porToque = analytics.porToque.map((t) => [t.label, t.enviados, t.respostas, t.taxaResposta]);
  conferir('resposta por toque', porToque, [
    ['Abordagem', 40, 0, 0],
    ['FUP 1', 24, 4, 16.67],
    ['FUP 2', 12, 5, 41.67],
    ['FUP 3', 3, 3, 100],
  ]);

  const anuncio = analytics.cortes.porAnuncio.reduce((s, c) => s + c.abordados, 0);
  conferir('corte por anúncio cobre a coorte inteira', anuncio, TOTAL);
  const nichos = analytics.cortes.porNicho.reduce((s, c) => s + c.abordados, 0);
  conferir('corte por nicho cobre a coorte inteira', nichos, TOTAL);
  conferir('corte marca amostra pequena', analytics.cortes.porNicho[0].amostraSuficiente, false);

  // ── Coorte é por data de abordagem ──────────────────────────
  titulo('10. A coorte é a data da abordagem, não a etapa atual');
  const hoje = new Date().toISOString().slice(0, 10);
  const soHoje = await req('GET', `/prospecting/funnel?${q}&from=${hoje}&to=${hoje}`);
  // Todos foram abordados há 30 dias; recortando só hoje, a coorte
  // esvazia — mesmo com prospects que MUDARAM de etapa hoje.
  conferir('coorte de hoje está vazia', soHoje.amostra, 0);

  const desdeOntem = new Date(agora - 40 * DIA).toISOString().slice(0, 10);
  const amplo = await req('GET', `/prospecting/funnel?${q}&from=${desdeOntem}&to=${hoje}`);
  conferir('coorte de 40 dias tem todos', amplo.amostra, TOTAL);

  // ── Conversão em lead ───────────────────────────────────────
  titulo('11. Conversão em lead');
  const pipelines = await req('GET', '/pipelines');
  const alvo = responderam[COMPARECERAM]; // agendou reunião, ainda não fechou
  const conv = await req('POST', `/prospects/${alvo.id}/convert`, {
    pipelineId: pipelines[0].id,
    estimatedValue: 150000,
  });
  conferir('lead criado', !!conv.lead.id, true);
  conferir('lead entra quente', conv.lead.temperature, 'HOT');
  conferir('prospect aponta para o lead', conv.prospect.leadId, conv.lead.id);
  conferir('contato criado', !!conv.lead.contactId, true);

  conferir('origem outbound', conv.lead.source?.type ?? null, 'OUTBOUND');
  conferir('origem nomeada', conv.lead.source?.name ?? null, 'Prospecção ativa');

  const lead = await req('GET', `/leads/${conv.lead.id}`);
  conferir('lead existe no pipeline', lead.id, conv.lead.id);

  let conflito = null;
  try {
    await req('POST', `/prospects/${alvo.id}/convert`, { pipelineId: pipelines[0].id });
  } catch (e) {
    conflito = e.message;
  }
  conferir('converter duas vezes é recusado', /409/.test(conflito ?? ''), true);

  // ── Export ──────────────────────────────────────────────────
  titulo('12. Exportação');
  const csvRes = await fetch(`${API}/prospects/export?listId=${lista.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const csv = await csvRes.text();
  const linhas = csv.trim().split('\n');
  conferir('CSV tem cabeçalho + 40 linhas', linhas.length, TOTAL + 1);
  conferir('CSV traz a coluna de anúncio', /Tem anuncio/i.test(linhas[0]), true);

  // ── Resultado ───────────────────────────────────────────────
  titulo('Resultado');
  console.log(`  ${checks - falhas}/${checks} conferências passaram`);
  if (falhas > 0) {
    console.log(`\n\x1b[31m${falhas} FALHA(S)\x1b[0m`);
    process.exit(1);
  }
  console.log('\n\x1b[32mTudo certo.\x1b[0m');
  console.log(`\nLista de verificação criada: "${marca}" (id ${lista.id})`);
  console.log('Apague pelo app se não quiser os dados de teste na base.');
}

main().catch((e) => {
  console.error(`\n\x1b[31mERRO: ${e.message}\x1b[0m`);
  process.exit(1);
});
