#!/usr/bin/env node
/* Calibra a LUZ do rig por medida. Nada mais.
   ===========================================================================
       node tools/studio-render/tune.mjs [--only <regex>]

   POR QUE UM SCRIPT SÓ PARA ISTO. Uma varredura de renders custa meia hora;
   ajustar luz no olho contra esse laço é inviável. O rig mede a própria
   exposição dentro da página (`__rig.measure`), e aqui a gente varre receitas
   e lê a tabela em segundos.

   O QUE O LAÇO JÁ ENSINOU, na ordem em que doeu:

   1. NÍVEL não era o problema. A primeira leva com softbox saiu com a lataria
      branca em p50 226 / p90 242 — quatro níveis de separação. Varrendo o
      ganho de 1,0 a 0,12 o histograma inteiro desceu e a separação ficou entre
      5 e 12 em TODOS os pontos.
   2. PROPORÇÃO entre as fontes também não. Seis receitas (sem painel lateral,
      paredes escuras, sem hemi/ambiente…) — nenhuma passou de 15.
   3. Era a DIREÇÃO DA KEY. `keyAz` do preset `ciclorama` é 138°, autorado para
      a CENA, onde a câmera orbita; no card ela é fixa em az 38°, pela frente,
      e a 138° a key fica ATRÁS do veículo. A face frontal — metade do que o
      card mostra — só recebia difusa, que chega igual em toda parte. Trazendo
      para 25°/52° o histograma abriu.
   4. MEDIR SÓ O TOPO enterra o resto. A calibração seguinte mirou apenas a
      lataria clara (L > 90), acertou o alvo dela e produziu uma leva ESCURA:
      no veículo inteiro o p50 caiu de 191 para 63-87, e chassi, pneu, grade e
      todo o lado da sombra viraram massa preta. Por isso o alvo de hoje tem
      DOIS lados, e cada render é medido DUAS vezes. */
import pw from '@playwright/test';
import { join, resolve } from 'node:path';
import { readdir, access } from 'node:fs/promises';
import { startServer, ASSETS_ROOT } from './serve.mjs';
import { buildMatrix } from './matrix.mjs';

const { chromium } = pw;

/* ---------------- o alvo ----------------
   Os números são a leitura direta do pedido: "uma luz ambiente como de
   estúdio, não tão forte, e uma focal para dar dimensão, também não tão forte
   — está faltando ambiente para deixar tudo visível". Ou seja: sombra
   LEGÍVEL, lataria com folga até o branco, contraste no meio.

   A foto de catálogo NÃO serve de régua para o lado escuro: o arquivo não tem
   alfa, então o p50 dela mede o gradiente do fundo, não o caminhão. Ela
   continua valendo para a lataria clara, que é onde o recorte L > 90 a isola. */
const ALVO = {
  /** veículo inteiro: onde a massa da imagem tem de cair */
  todoP50: 172,
  /** lataria clara (L > 90): perto do branco, sem encostar nele */
  latariaP50: 205,
  latariaP90: 216,
  /**
   * A DISTÂNCIA ENTRE O OMBRO E O FLANCO, na lataria (L > 60): `p95 - p25`.
   *
   * É a medida do que sobrou de errado depois da leva 3: numa tinta METÁLICA a
   * curva que liga a frente à lateral pegava a focal e estourava, enquanto o
   * flanco caía longe na cor — "as laterais ficam muito longe na coloração".
   * Isso não é nível nem cor: é a RAZÃO entre a luz que bate na face voltada
   * para a key e a que bate na face voltada para o fill. Um estúdio de verdade
   * trabalha essa razão perto de 3:1; o rig estava em muito mais.
   *
   * Medido na leva 3, no `Prata Artico`: 118. O alvo abaixo é o mesmo corpo com
   * a face do fill subindo até a diferença virar modelagem em vez de recorte.
   */
  spread: 74,
};

/* NÃO EXISTE ALVO DE p10, e a tentativa de ter um foi o terceiro erro de
   método deste arquivo.
   ---------------------------------------------------------------------------
   Mirar `todoP10 = 38` parecia a correção óbvia para "está faltando ambiente
   para deixar tudo visível". Só que a varredura seguinte mostrou p10 entre 1 e
   8 e `escuro%` entre 17 e 27 em TODAS as seis receitas, inclusive triplicando
   hemi, ambiente e ambiente refletido — as três juntas mal moveram o número.
   O motivo é que aqueles pixels não são SOMBRA: são pneu, tela de grade,
   plástico preto e vidro, que são pretos por ALBEDO. Luz de preenchimento não
   acende um pneu preto, e não deve.
   O termo virou um piso inalcançável que dominava o erro (toda linha marcava
   490-550) e escondia a diferença real entre as receitas. `crush` fica só como
   GUARDA — se passar de 30 % alguma coisa quebrou de verdade. */

/** Recorta a LATARIA CLARA. Um caminhão tem pneu, grade e chassi pretos, e a
 *  mediana do veículo inteiro mede a proporção entre eles. 90 é onde o preto
 *  do pneu acaba. */
const MINLUM = 90;

const GANHOS = [0.62, 0.52, 0.44];

const BASE = {
  key: 0.55, top: 1, side: 0.22, kick: 0.85, rimF: 1,
  hemiF: 0.3, ambF: 0.25, env: 0.85, room: 0.12,
  keyAz: 25, keyEl: 52, sideAz: 90, panel: 1,
};

const RECEITAS = {
  /* A que está no ar (leva 3). Linha de base da comparação. */
  'leva3': { ...BASE, hemiF: 1.3, ambF: 1.1, env: 1.25, key: 0.38, top: 0.75, kick: 0.6 },
  /* MAIS AMBIENTE, MENOS FOCAL. Cada linha aperta a razão key/fill um passo
     mais: é ela que decide a distância entre o ombro iluminado e o flanco. */
  'r1': { ...BASE, hemiF: 1.8, ambF: 1.6, env: 1.5, key: 0.28, top: 0.60, kick: 0.5 },
  'r2': { ...BASE, hemiF: 2.4, ambF: 2.1, env: 1.7, key: 0.22, top: 0.50, kick: 0.45 },
  'r3': { ...BASE, hemiF: 3.0, ambF: 2.6, env: 1.9, key: 0.16, top: 0.42, kick: 0.4 },
  /* O painel LATERAL sobe junto: ele é quem ilumina o flanco de frente para a
     câmera, ou seja exatamente a face que está caindo longe. */
  'r2-lado': { ...BASE, hemiF: 2.4, ambF: 2.1, env: 1.7, key: 0.22, top: 0.50,
    kick: 0.45, side: 0.55 },
  'r3-lado': { ...BASE, hemiF: 3.0, ambF: 2.6, env: 1.9, key: 0.16, top: 0.42,
    kick: 0.4, side: 0.7 },
};

/* ---------------- plumbing ---------------- */
const exists = (p) => access(p).then(() => true, () => false);

async function findChromium() {
  const env = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (env && await exists(env)) return env;
  const cache = join(process.env.HOME || '', '.cache/ms-playwright');
  const dirs = (await readdir(cache).catch(() => []))
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const d of dirs) {
    for (const rel of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const p = join(cache, d, rel);
      if (await exists(p)) return p;
    }
  }
  throw new Error('nenhum Chromium encontrado.');
}

const R = (v, n) => String(v).padStart(n);
const L = (v, n) => String(v).padEnd(n);

const V1 = join(resolve(ASSETS_ROOT), 'v1');
const { jobs } = await buildMatrix({ assetsRoot: V1 });

const alvoChave = process.argv.includes('--only')
  ? new RegExp(process.argv[process.argv.indexOf('--only') + 1], 'i')
  : /^scania\/scania-s-2016\/4x2$/;
const doAlvo = jobs.filter((j) => alvoChave.test(j.key));
if (!doAlvo.length) { console.error('nenhum chassi casou'); process.exit(1); }

/* O branco fixa o nível (é o pior caso do ombro do ACES); o preto confirma que
   o corte não enterrou o outro extremo. */
const branco = doAlvo.find((j) => /branco/i.test(j.label)) ?? doAlvo[1] ?? doAlvo[0];
/* O SEGUNDO CORPO DE PROVA VIROU UMA METÁLICA, e não mais um preto.
   O preto servia para conferir que o corte de luz não enterrava o outro
   extremo; esse risco já está coberto pelo `crush`. O que precisa de olho agora
   é a metálica: o floco do shader multiplica a diferença entre a face da key e
   a face do fill, então é nela que o ombro estoura primeiro. */
const metalica = doAlvo.find((j) => /prata artico|silver|prata/i.test(j.label))
  ?? doAlvo.find((j) => /cinza|gray|grey/i.test(j.label)) ?? doAlvo.at(-1);

const server = await startServer();
const browser = await chromium.launch({
  executablePath: await findChromium(),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=vulkan',
    '--ignore-gpu-blocklist', '--enable-gpu'],
});
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
page.on('pageerror', (e) => console.error('ERRO DE PÁGINA:', e.message));
await page.goto(server.url + '/', { waitUntil: 'load' });
await page.waitForFunction('window.__rigReady === true', null, { timeout: 120_000 });
await page.evaluate(() => window.__rig.init());
await page.evaluate(([f, c, m, pm]) => window.__rig.load(f, c, m, pm),
  [branco.file, branco.chassisId, branco.modelId, branco.paintMaterials]);

console.log(`chassi: ${branco.key}`);
console.log(`alvo: inteiro p50 ${ALVO.todoP50}  |  `
  + `lataria p50 ${ALVO.latariaP50} p90 ${ALVO.latariaP90}  |  `
  + `spread(metalica) ${ALVO.spread}\n`);
console.log(`${R('ganho', 6)}  ${L('cor', 20)} ${R('p10', 4)} ${R('p50', 4)} `
  + `${R('esc%', 6)}  |  ${R('p50', 4)} ${R('p90', 4)} ${R('clip%', 6)}  `
  + `${R('spread', 6)}   erro`);
console.log(`${' '.repeat(28)}-- veiculo inteiro --   -- lataria L>90 --`);

let melhor = null;
for (const [nome, mixBase] of Object.entries(RECEITAS)) {
  for (const g of GANHOS) {
    await page.evaluate((m) => window.__rig.setMix(m), { ...mixBase, gain: g });
    const linhas = [];
    for (const job of [branco, metalica]) {
      await page.evaluate((r) => window.__rig.shoot(r), job.recipe);
      /* DUAS MEDIDAS por render, e é essa a correção de método: uma no veículo
         INTEIRO (que enxerga a sombra) e outra só na lataria clara (que enxerga
         o ombro do ACES). Otimizar uma sem a outra foi o erro que produziu
         primeiro a leva estourada e depois a leva escura. */
      const todo = await page.evaluate(() => window.__rig.measure(0));
      const lat = await page.evaluate((m) => window.__rig.measure(m), MINLUM);
      /* L > 60 e não 90: aqui o recorte tem de INCLUIR o flanco na sombra, que
         é justamente a parte que está caindo longe. Com 90 ele ficaria de fora
         e o spread mediria só a metade iluminada. */
      const corpo = await page.evaluate(() => window.__rig.measure(60));
      linhas.push([job, todo, lat, corpo.p90 - corpo.p25]);
    }
    const [, tb, lb] = linhas[0];
    const spreadMet = linhas[1][3];                    // o spread da METÁLICA
    const erro = Math.abs(tb.p50 - ALVO.todoP50)
      + Math.abs(lb.p50 - ALVO.latariaP50) * 0.8
      + Math.abs(lb.p90 - ALVO.latariaP90) * 0.8
      + Math.abs(spreadMet - ALVO.spread) * 1.5        // o defeito que sobrou
      + (lb.clip > 0.3 ? 400 : 0)                      // estouro desqualifica
      + (tb.crush > 30 ? 400 : 0);                     // guarda, não alvo
    if (!melhor || erro < melhor.erro) {
      melhor = { nome, g, erro, todo: tb, lat: lb, mix: { ...mixBase, gain: g } };
    }
    for (const [job, todo, lat, sp] of linhas) {
      const cor = job.label.split('·').at(-1).trim().slice(0, 20);
      console.log(`${R(job === branco ? String(g) : '', 6)}  ${L(cor, 20)} `
        + `${R(todo.p10.toFixed(0), 4)} ${R(todo.p50.toFixed(0), 4)} `
        + `${R(todo.crush.toFixed(1), 6)}  |  ${R(lat.p50.toFixed(0), 4)} `
        + `${R(lat.p90.toFixed(0), 4)} ${R(lat.clip.toFixed(2), 6)}  `
        + `${R(sp.toFixed(0), 6)}`
        + (job === branco ? `   ${erro.toFixed(0)}` : ''));
    }
  }
  console.log(`   ^ receita: ${nome}\n`);
}

console.log(`MELHOR: ${melhor.nome} · ganho ${melhor.g}`);
console.log(`  inteiro: p10 ${melhor.todo.p10.toFixed(0)} `
  + `p50 ${melhor.todo.p50.toFixed(0)} escuro ${melhor.todo.crush.toFixed(1)}%`);
console.log(`  lataria: p50 ${melhor.lat.p50.toFixed(0)} `
  + `p90 ${melhor.lat.p90.toFixed(0)} clip ${melhor.lat.clip.toFixed(2)}%`);
console.log('  MIX =', JSON.stringify(melhor.mix));
console.log('Grave em MIX, em rig.ts.');

await browser.close();
await server.close();
