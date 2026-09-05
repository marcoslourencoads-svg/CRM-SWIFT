/**
 * Verifica as 4 melhorias pedidas, contra a API de verdade.
 *
 *   1. "Já abordei" no cadastro — registra o toque junto
 *   2. Compromisso com hora que entra na agenda e dispara o sino
 *   3. Diário de bordo com a etapa carimbada
 *   4. Observação no cadastro
 *
 * E o bug relatado junto: cadastrar com a data de hoje marcava o
 * prospect como ATRASADO no ato.
 *
 * Uso:
 *   npm run melhorias:verificar
 */
require('dotenv/config');

const API = process.env.API_URL || `http://localhost:${process.env.API_PORT || 3333}`;
const OFFSET = new Date().getTimezoneOffset();

let token = '';
let falhas = 0;
let checks = 0;

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
    throw new Error(`${metodo} ${rota} -> ${res.status}: ${JSON.stringify(json?.message ?? json)}`);
  }
  return json?.data !== undefined ? json.data : json;
}

function conferir(rotulo, ok, detalhe = '') {
  checks += 1;
  if (ok) {
    console.log(`  ok    ${rotulo}${detalhe ? ` — ${detalhe}` : ''}`);
  } else {
    falhas += 1;
    console.log(`  FALHA ${rotulo}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

function titulo(t) {
  console.log(`\n\x1b[1m${t}\x1b[0m`);
}

/** Monta o instante como o front monta: data e hora em horário LOCAL. */
function paraInstante(data, hora) {
  const [a, m, d] = data.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  return new Date(a, m - 1, d, h, mi, 0, 0).toISOString();
}

function hojeLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function main() {
  console.log(`Verificando melhorias em ${API}`);

  // Sonda de deploy: /prospect-notes NAO pode ser confundida com outra
  // rota. Ja /prospects/agenda casa com GET /prospects/:id (id="agenda")
  // e devolve 401 pelo guard mesmo no codigo ANTIGO — usar essa como
  // prova de deploy da falso positivo. Aprendido na pratica.
  titulo('0. A versão no ar tem as melhorias?');
  const sonda = await fetch(`${API}/prospect-notes/x`, { method: 'PATCH' });
  conferir(
    'rota do diário existe (401, não 404)',
    sonda.status === 401,
    `HTTP ${sonda.status}`,
  );
  if (sonda.status === 404) {
    console.log('  A versao publicada ainda e a antiga. Pare aqui.');
    process.exit(1);
  }

  titulo('0. Organização nova');
  const selo = Date.now();
  const registro = await req('POST', '/auth/register', {
    name: 'Verificador',
    email: `melhorias+${selo}@exemplo.test`,
    password: 'verificacao123',
    organizationName: `Org melhorias ${selo}`,
  });
  token = registro.accessToken;
  console.log('  ok    org criada');

  const abordagens = await req('GET', '/prospect-approaches');

  // ── 4 + 1: observação e "já abordei" no cadastro ────────────
  titulo('1 e 4. Cadastro com observação e "já abordei"');

  const comTudo = await req('POST', '/prospects', {
    name: 'Rafael Souza',
    business: 'Barbearia Imperial',
    niche: 'Barbearia',
    channel: 'WHATSAPP',
    observacao: 'Fatura ~80k/mes. Nao anuncia. Decisor e o proprio dono.',
    jaAbordado: true,
    primeiroToqueResultado: 'REPLIED_POSITIVE',
    approachId: abordagens[0]?.id,
    nextActionAt: paraInstante(hojeLocal(), '23:30'),
  });

  conferir('observação virou entrada do diário', comTudo.notes.length === 1);
  conferir(
    'diário carimbou a etapa',
    comTudo.notes[0]?.stage === 'NEW',
    `etapa=${comTudo.notes[0]?.stage}`,
  );
  conferir(
    'conteúdo preservado',
    comTudo.notes[0]?.content?.startsWith('Fatura ~80k'),
  );
  conferir('primeiro toque registrado junto', comTudo.touchCount === 1);
  conferir('toque marcou a abordagem usada', !!comTudo.touches[0]?.approach);
  conferir(
    'etapa avançou sozinha (respondeu)',
    comTudo.stage === 'RESPONDED',
    comTudo.stage,
  );
  conferir('quem cadastrou virou dono', !!comTudo.owner);

  // ── O bug: nasce atrasado? ──────────────────────────────────
  titulo('BUG RELATADO: cadastro com data de hoje nascia atrasado');

  const fila = await req('GET', `/prospects/queue?tzOffset=${OFFSET}`);
  const idsAtrasados = fila.atrasados.map((p) => p.id);
  conferir(
    'compromisso de hoje NÃO está em atrasados',
    !idsAtrasados.includes(comTudo.id),
    `atrasados=${fila.counts.atrasados}`,
  );

  const semToque = await req('POST', '/prospects', {
    name: 'Pizzaria do Ze',
    nextActionAt: paraInstante(hojeLocal(), '23:30'),
  });
  const fila2 = await req('GET', `/prospects/queue?tzOffset=${OFFSET}`);
  conferir(
    'prospect cadastrado para hoje cai em "hoje", não em "atrasados"',
    fila2.hoje.some((p) => p.id === semToque.id) &&
      !fila2.atrasados.some((p) => p.id === semToque.id),
    `hoje=${fila2.counts.hoje} atrasados=${fila2.counts.atrasados}`,
  );

  // ── 2: agenda e hora do compromisso ─────────────────────────
  titulo('2. Compromisso com hora, na agenda');

  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const p = (n) => String(n).padStart(2, '0');
  const dataAmanha = `${amanha.getFullYear()}-${p(amanha.getMonth() + 1)}-${p(amanha.getDate())}`;
  const compromisso = paraInstante(dataAmanha, '14:00');

  await req('PATCH', `/prospects/${semToque.id}`, { nextActionAt: compromisso });
  const recarregado = await req('GET', `/prospects/${semToque.id}`);
  const marcado = new Date(recarregado.nextActionAt);

  conferir('a HORA foi preservada (14:00 local)', marcado.getHours() === 14, marcado.toLocaleString('pt-BR'));

  const de = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const ate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const agenda = await req('GET', `/prospects/agenda?from=${de}&to=${ate}`);
  conferir(
    'compromisso aparece na agenda do calendário',
    agenda.some((x) => x.id === semToque.id),
    `${agenda.length} na janela`,
  );

  const vazia = await req(
    'GET',
    `/prospects/agenda?from=${new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString()}&to=${new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString()}`,
  );
  conferir('janela sem compromisso volta vazia', vazia.length === 0);

  // ── 3: diário de bordo ──────────────────────────────────────
  titulo('3. Diário de bordo por etapa');

  await req('POST', `/prospects/${semToque.id}/notes`, {
    content: 'Primeira ligacao: nao atendeu.',
  });
  await req('PATCH', `/prospects/${semToque.id}/stage`, { stage: 'MEETING_SET' });
  await req('POST', `/prospects/${semToque.id}/notes`, {
    content: 'Agendou para quinta. Quer ver casos de barbearia.',
  });

  const comDiario = await req('GET', `/prospects/${semToque.id}`);
  conferir('duas anotações no diário', comDiario.notes.length === 2);

  const etapaDe = (prefixo) =>
    comDiario.notes.find((n) => n.content.startsWith(prefixo))?.stage;

  // Este é o ponto do diário: mudar de etapa depois NÃO pode reescrever
  // em que ponto a observação foi feita.
  conferir(
    'a anotação antiga manteve a etapa em que foi escrita',
    etapaDe('Primeira ligacao') === 'NEW',
    `veio ${etapaDe('Primeira ligacao')}`,
  );
  conferir(
    'a nova ficou na etapa atual',
    etapaDe('Agendou para') === 'MEETING_SET',
    `veio ${etapaDe('Agendou para')}`,
  );
  conferir('anotação registra o autor', !!comDiario.notes[0]?.user?.name);
  conferir('mais recente vem primeiro', comDiario.notes[0].content.startsWith('Agendou'));

  const alvo = comDiario.notes[1].id;
  await req('DELETE', `/prospect-notes/${alvo}`);
  const depois = await req('GET', `/prospects/${semToque.id}`);
  conferir('remover some da lista', depois.notes.length === 1);
  conferir('e não apaga a outra', depois.notes[0].content.startsWith('Agendou'));

  // ── Resultado ───────────────────────────────────────────────
  titulo('Resultado');
  console.log(`  ${checks - falhas}/${checks} conferências passaram`);
  if (falhas > 0) {
    console.log(`\n\x1b[31m${falhas} FALHA(S)\x1b[0m`);
    process.exit(1);
  }
  console.log('\n\x1b[32mTudo certo.\x1b[0m');
}

main().catch((e) => {
  console.error(`\n\x1b[31mERRO: ${e.message}\x1b[0m`);
  process.exit(1);
});
