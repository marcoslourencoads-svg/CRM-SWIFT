/**
 * Verificação visual das 4 melhorias, num navegador de verdade.
 *
 * Cria uma organização própria pela API, opera pela TELA (preenche o
 * formulário, liga o "já abordei", escreve no diário) e confere o que
 * aparece — inclusive o bug do cadastro nascendo atrasado, que só dá
 * para ver com o relógio local do navegador.
 *
 * Uso:
 *   node scripts/verificar-ui-melhorias.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const WEB = process.env.WEB_URL || 'http://localhost:3000';
const API = process.env.API_URL || 'http://localhost:3333';
const SAIDA = process.env.UI_SHOTS || 'shots';

let falhas = 0;
let checks = 0;

function conferir(rotulo, ok, detalhe = '') {
  checks += 1;
  if (ok) console.log(`  ok    ${rotulo}${detalhe ? ` — ${detalhe}` : ''}`);
  else {
    falhas += 1;
    console.log(`  FALHA ${rotulo}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

const titulo = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);
const temTexto = async (page, t) =>
  (await page.getByText(t, { exact: false }).count()) > 0;

async function main() {
  mkdirSync(SAIDA, { recursive: true });

  // Conta nova, para a tela nascer limpa
  const selo = Date.now();
  const email = `ui-melhorias+${selo}@exemplo.test`;
  const senha = 'verificacao123';
  const reg = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Verificador UI',
      email,
      password: senha,
      organizationName: `Org UI ${selo}`,
    }),
  });
  if (!reg.ok) throw new Error(`registro falhou: ${reg.status}`);
  const token = (await reg.json()).data.accessToken;
  await fetch(`${API}/onboarding/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const erros = [];
  page.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
  page.on('pageerror', (e) => erros.push(String(e)));

  titulo('1. Login');
  await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').waitFor({ timeout: 25000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(senha);
  await page.locator('input[type="password"]').press('Enter');
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 });
  conferir('autenticou', true);

  titulo('4. Observação no cadastro');
  await page.goto(`${WEB}/prospecting`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Fila do dia', { exact: false }).first().waitFor({ timeout: 25000 });
  await page.getByRole('button', { name: /Novo prospect/i }).first().click();
  await page.locator('#np-name').waitFor({ timeout: 15000 });

  conferir('campo de observação existe', (await page.locator('#np-obs').count()) > 0);
  conferir(
    'é caixa de várias linhas, não campo de uma linha',
    (await page.locator('textarea#np-obs').count()) > 0,
  );
  conferir('explica que vira o diário', await temTexto(page, 'primeira entrada do diário'));

  titulo('1. "Já abordei" no cadastro');
  conferir('opção existe', await temTexto(page, 'Já abordei este contato'));
  conferir(
    'resultado da abordagem escondido antes de ligar',
    !(await temTexto(page, 'Resultado da abordagem')),
  );
  // O Switch esconde o <input>; quem recebe o clique é o botão/rótulo,
  // que é também por onde o usuário liga a opção.
  await page.getByText('Já abordei este contato').click();
  await page.waitForTimeout(600);
  conferir('ao ligar, pede o resultado', await temTexto(page, 'Resultado da abordagem'));
  conferir('e a abordagem usada', await temTexto(page, 'Abordagem usada'));

  titulo('2. Compromisso com HORA');
  conferir('campo de data', (await page.locator('#np-data').count()) > 0);
  conferir('campo de hora', (await page.locator('input[type="time"]').count()) > 0);
  const campoHora = page.locator('input[type="time"]').first();
  const horaPadrao = await campoHora.inputValue();
  conferir('hora vem preenchida', /^\d{2}:\d{2}$/.test(horaPadrao), horaPadrao);

  // O input de hora traz o ícone do relógio junto. Estreito demais, ele
  // corta o texto e mostra "19:0" — nenhuma checagem de conteúdo pega
  // isso, só a medida do elemento.
  const corte = await campoHora.evaluate(
    (el) => el.scrollWidth - el.clientWidth,
  );
  conferir('campo de hora não corta o texto', corte <= 1, `sobra ${corte}px`);

  // ── Cadastra pela tela ──
  await page.locator('#np-name').fill('Rafael Souza');
  await page.locator('#np-business').fill('Barbearia Imperial');
  await page.locator('#np-obs').fill('Fatura ~80k/mes. Nao anuncia. Decisor e o dono.');
  await page.screenshot({ path: `${SAIDA}/m1-cadastro.png` });
  await page.getByRole('button', { name: /Adicionar prospect/i }).click();
  await page.waitForTimeout(2500);

  titulo('BUG: cadastro com data de hoje nascia atrasado');
  const corpoFila = await page.locator('body').innerText();
  const linhaAtrasados = corpoFila.match(/Atrasados\s*\n?\s*(\d+)/);
  conferir(
    'contador de atrasados está em zero',
    linhaAtrasados?.[1] === '0',
    `veio ${linhaAtrasados?.[1]}`,
  );
  conferir(
    'o card recém-criado NÃO tem badge de atraso',
    !(await temTexto(page, 'atrasado há')),
  );
  conferir('o prospect aparece na fila', await temTexto(page, 'Barbearia Imperial'));
  await page.screenshot({ path: `${SAIDA}/m2-fila.png` });

  titulo('3. Diário de bordo na ficha');
  await page.getByText('Barbearia Imperial', { exact: false }).first().click();
  await page.getByText('Observações', { exact: false }).first().waitFor({ timeout: 15000 });

  conferir('bloco de observações existe', await temTexto(page, 'Observações'));
  conferir(
    'caixa de escrita é de várias linhas',
    (await page.locator('[data-slot="sheet-content"] textarea, textarea').count()) > 0,
  );
  conferir(
    'a observação do cadastro está no diário',
    await temTexto(page, 'Fatura ~80k'),
  );
  conferir('diz em que etapa vai ficar salvo', await temTexto(page, 'Fica salvo na etapa'));
  conferir('avisa do lembrete', await temTexto(page, 'sino avisa 30 minutos antes'));
  conferir('campo de hora na ficha', (await page.locator('input[type="time"]').count()) > 0);

  // Escreve uma anotação nova pela tela
  const caixa = page.locator('textarea').first();
  await caixa.fill('Ligou hoje: pediu para retornar terca as 14h.');
  await page.getByRole('button', { name: /^Anotar$/ }).click();
  await page.waitForTimeout(2500);
  conferir('anotação nova aparece', await temTexto(page, 'pediu para retornar terca'));
  conferir('com a etapa carimbada', await temTexto(page, 'Abordado'));
  await page.screenshot({ path: `${SAIDA}/m3-diario.png`, fullPage: true });

  titulo('2. Compromisso no calendário');
  await page.goto(`${WEB}/calendar`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  conferir('calendário abriu', await temTexto(page, 'Dia todo'));
  conferir(
    'o compromisso do prospect aparece',
    await temTexto(page, 'Barbearia Imperial'),
  );
  await page.screenshot({ path: `${SAIDA}/m4-calendario.png` });

  titulo('5. Nome deixou de ser obrigatório');
  await page.goto(`${WEB}/prospecting`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Fila do dia', { exact: false }).first().waitFor({ timeout: 25000 });
  await page.getByRole('button', { name: /Novo prospect/i }).first().click();
  await page.locator('#np-name').waitFor({ timeout: 15000 });

  conferir('rótulo diz que é opcional', await temTexto(page, 'Nome do contato (opcional)'));
  conferir(
    'a ajuda explica que basta um identificador',
    await temTexto(page, 'Basta um jeito de identificar'),
  );

  const botao = page.getByRole('button', { name: /Adicionar prospect/i });
  conferir('botão desabilitado com o form vazio', await botao.isDisabled());

  // Só o @, sem nome nenhum
  await page.locator('#np-handle').fill('@barbeariaimperial');
  await page.waitForTimeout(300);
  conferir('só o @ já habilita o botão', await botao.isEnabled());
  await botao.click();
  await page.waitForTimeout(2500);

  conferir('cadastrou sem nome', !(await temTexto(page, 'Preencha ao menos um')));
  conferir(
    'o card mostra o @ em vez de ficar em branco',
    await temTexto(page, '@barbeariaimperial'),
  );
  conferir(
    'não aparece "Sem identificação"',
    !(await temTexto(page, 'Sem identificação')),
  );
  await page.screenshot({ path: `${SAIDA}/m5-sem-nome.png` });

  titulo('Console do navegador');
  const relevantes = erros.filter(
    (e) => !/favicon|404 \(Not Found\)|Download the React DevTools/i.test(e),
  );
  conferir('sem erro de JavaScript', relevantes.length === 0, relevantes.slice(0, 2).join(' | '));

  await browser.close();

  titulo('Resultado');
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
