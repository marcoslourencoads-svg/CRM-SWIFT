/**
 * Verificação visual das telas de prospecção, num navegador de verdade.
 *
 * As páginas do CRM são client components atrás do AuthGuard, então
 * `curl` só enxerga o spinner. Este roteiro faz login pela tela, navega
 * pelas quatro telas de prospecção, confere o que aparece e salva um PNG
 * de cada uma.
 *
 * Uso:
 *   node scripts/verificar-ui-prospeccao.mjs
 *
 * Precisa da API (3333) e do front (3000) no ar.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const WEB = process.env.WEB_URL || 'http://localhost:3000';
const EMAIL = process.env.UI_EMAIL || 'demo@swift.test';
const SENHA = process.env.UI_PASSWORD || 'verificacao123';
const SAIDA = process.env.UI_SHOTS || 'shots';

let falhas = 0;
let checks = 0;

function conferir(rotulo, ok, detalhe = '') {
  checks += 1;
  if (ok) {
    console.log(`  ok    ${rotulo}${detalhe ? ` — ${detalhe}` : ''}`);
  } else {
    falhas += 1;
    console.log(`  FALHA ${rotulo}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

async function temTexto(page, texto) {
  return (await page.getByText(texto, { exact: false }).count()) > 0;
}

// O app mantém uma conexão SSE aberta para notificações, então
// `networkidle` nunca dispara. Espera-se o texto-âncora da tela.
async function irPara(page, rota, ancora, conteudo) {
  await page.goto(`${WEB}${rota}`, { waitUntil: 'domcontentloaded' });
  try {
    await page.getByText(ancora, { exact: false }).first().waitFor({ timeout: 25000 });
  } catch {
    console.log(`  aviso âncora "${ancora}" não apareceu em ${rota}`);
  }
  // O cabeçalho aparece antes da chamada à API terminar. Sem esperar um
  // pedaço do DADO, a captura sai com o skeleton e a conferência falha
  // por lentidão, não por defeito.
  if (conteudo) {
    try {
      await page.locator(conteudo).first().waitFor({ timeout: 25000 });
    } catch {
      console.log(`  aviso conteúdo "${conteudo}" não carregou em ${rota}`);
    }
  }
  await page.waitForTimeout(900);
}

async function main() {
  mkdirSync(SAIDA, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  const erros = [];
  page.on('console', (m) => {
    if (m.type() === 'error') erros.push(m.text());
  });
  page.on('pageerror', (e) => erros.push(String(e)));

  // ── Login pela tela ──────────────────────────────────────────
  console.log('\n\x1b[1m1. Login\x1b[0m');
  await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').waitFor({ timeout: 25000 });
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(SENHA);
  // Enter no campo de senha submete o form — evita depender da
  // estabilidade visual do botão, que o Playwright espera antes de clicar.
  await page.locator('input[type="password"]').press('Enter');
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 });
  conferir('autenticou e saiu do /login', true, page.url());

  // ── Menu lateral ─────────────────────────────────────────────
  console.log('\n\x1b[1m2. Menu lateral\x1b[0m');
  // O sidebar busca os pipelines na API antes de montar. Sem esperar,
  // as primeiras conferencias reprovam por lentidao, nao por defeito.
  await page.locator('aside a', { hasText: 'Funil' }).first().waitFor({ timeout: 25000 });

  conferir('grupo "Prospecção" no menu',
    (await page.locator('aside button', { hasText: 'Prospecção' }).count()) > 0);
  for (const item of ['Fila do dia', 'Quadro', 'Listas', 'Funil']) {
    const link = page.locator('aside a', { hasText: item });
    conferir(`item "${item}"`, (await link.count()) > 0);
  }

  // ── Fila do dia ──────────────────────────────────────────────
  console.log('\n\x1b[1m3. Fila do dia\x1b[0m');
  await irPara(page, '/prospecting', 'Fila do dia');
  conferir('título', await temTexto(page, 'Fila do dia'));
  conferir('seção de atrasados', await temTexto(page, 'Atrasados'));
  conferir('cartão "Cadência esgotada"', await temTexto(page, 'Cadência esgotada'));
  const cards = await page.locator('text=/\\d+ toques?/').count();
  conferir('cartões de prospect renderizados', cards > 0, `${cards} cartões`);
  conferir('badge de atraso visível', await temTexto(page, 'atrasado'));
  conferir('botão de registrar toque', await temTexto(page, 'Respondeu'));
  await page.screenshot({ path: `${SAIDA}/1-fila.png`, fullPage: false });

  // ── Quadro ───────────────────────────────────────────────────
  console.log('\n\x1b[1m4. Quadro\x1b[0m');
  await irPara(page, '/prospecting/board', 'Quadro de prospecção', 'text=/\\d+ toques?/');
  conferir('título', await temTexto(page, 'Quadro de prospecção'));
  for (const col of ['Abordado', 'Em follow-up', 'Respondeu', 'Fechou contrato']) {
    conferir(`coluna "${col}"`, await temTexto(page, col));
  }
  await page.screenshot({ path: `${SAIDA}/2-quadro.png` });

  // ── Funil ────────────────────────────────────────────────────
  console.log('\n\x1b[1m5. Funil\x1b[0m');
  await irPara(page, '/prospecting/funnel', 'Funil de prospecção', 'svg.recharts-surface');
  conferir('título', await temTexto(page, 'Funil de prospecção'));
  for (const degrau of ['Abordados', 'Responderam', 'Reuniões agendadas', 'Fechamentos']) {
    conferir(`degrau "${degrau}"`, await temTexto(page, degrau));
  }
  conferir('dupla porcentagem por degrau', await temTexto(page, 'da anterior'));
  conferir('métrica-âncora presente', await temTexto(page, 'Taxa de resposta por toque'));
  conferir('gráfico renderizou', (await page.locator('svg.recharts-surface').count()) > 0);
  conferir('total em contratos', await temTexto(page, 'Total em contratos'));
  conferir('ticket médio', await temTexto(page, 'Ticket médio'));
  conferir('no-show', await temTexto(page, 'No-show'));
  conferir('corte por anúncio', await temTexto(page, 'Tem anúncio?'));

  // Os filtros precisam mostrar o rótulo, não o valor cru. Este Select
  // não resolve o texto do item sozinho — sem children ele imprime
  // "all" na tela, e nenhuma checagem de conteúdo pegaria isso.
  const filtros = page.locator('[data-slot="select-value"]');
  const rotulos = await filtros.allInnerTexts();
  conferir(
    'filtros mostram rótulo, não o valor cru',
    rotulos.length > 0 && !rotulos.some((t) => ['all', 'none', 'unknown'].includes(t.trim())),
    rotulos.join(' | '),
  );

  // Os números da coorte montada pelo roteiro de API têm que aparecer.
  const corpo = await page.locator('body').innerText();
  conferir('40 abordados na tela', /\b40\b/.test(corpo));
  conferir('taxa de 30% (12 de 40)', /30(,00)?%/.test(corpo), 'responderam / abordados');
  conferir('R$ 5.000,00 em contratos', /5\.000,00/.test(corpo));
  conferir('ticket médio R$ 2.500,00', /2\.500,00/.test(corpo));
  await page.screenshot({ path: `${SAIDA}/3-funil.png`, fullPage: true });

  // ── Listas ───────────────────────────────────────────────────
  console.log('\n\x1b[1m6. Listas e abordagens\x1b[0m');
  await irPara(page, '/prospecting/lists', 'Listas e abordagens', 'text=Elogio + pergunta');
  conferir('título', await temTexto(page, 'Listas e abordagens'));
  conferir('editor de cadência', await temTexto(page, 'Cadência (dias'));
  conferir('explicação da cadência', await temTexto(page, 'toques no total'));
  conferir('catálogo de abordagens', await temTexto(page, 'Elogio + pergunta'));
  await page.screenshot({ path: `${SAIDA}/4-listas.png`, fullPage: true });

  // ── Importar ─────────────────────────────────────────────────
  console.log('\n\x1b[1m7. Importar planilha\x1b[0m');
  await irPara(page, '/prospecting/import', 'Importar planilha');
  conferir('título', await temTexto(page, 'Importar planilha'));
  conferir('mapa das colunas da planilha', await temTexto(page, 'Data do FUP'));
  await page.screenshot({ path: `${SAIDA}/5-importar.png` });

  // ── Regressão do resto do app ────────────────────────────────
  console.log('\n\x1b[1m8. O resto do CRM continua de pé\x1b[0m');
  await irPara(page, '/dashboard', 'Dashboard');
  conferir('dashboard abre', await temTexto(page, 'Dashboard'));
  await irPara(page, '/leads', 'Todos os leads');
  conferir('lista de leads abre', await temTexto(page, 'Todos os leads'));

  // ── Erros de console ─────────────────────────────────────────
  console.log('\n\x1b[1m9. Console do navegador\x1b[0m');
  const relevantes = erros.filter(
    (e) => !/favicon|404 \(Not Found\)|Download the React DevTools/i.test(e),
  );
  conferir('sem erro de JavaScript', relevantes.length === 0, relevantes.slice(0, 3).join(' | '));

  await browser.close();

  console.log(`\n\x1b[1mResultado\x1b[0m`);
  console.log(`  ${checks - falhas}/${checks} conferências passaram`);
  console.log(`  capturas em ${SAIDA}/`);
  if (falhas > 0) {
    console.log(`\n\x1b[31m${falhas} FALHA(S)\x1b[0m`);
    process.exit(1);
  }
  console.log('\n\x1b[32mUI verificada.\x1b[0m');
}

main().catch((e) => {
  console.error(`\n\x1b[31mERRO: ${e.message}\x1b[0m`);
  process.exit(1);
});
