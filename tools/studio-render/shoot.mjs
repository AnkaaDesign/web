/* O DRIVER DA BANCADA DE CARDS — o `shoot.mjs` que rig.ts sempre citou.
   ===========================================================================
   `rig.ts` e `serve.mjs` estavam no disco; este arquivo, não. O cabeçalho do
   rig fala dele por nome ("quem a carrega é o Playwright em shoot.mjs") e a
   receita de card ficou sem como ser executada — foi o que apareceu quando o
   S-Way 480 mudou de id e o `catalog-resolves.test.ts` cobrou o render neutro
   que ninguém mais sabia produzir.

   Ele NÃO reimplementa nada da receita: enquadramento, luz, pose e o alfa saem
   de `rig.ts`, que por sua vez reusa `vehicle/paint.ts`, `material-setup.ts`,
   `coupling.ts`, `scene/view.ts` e o preset `ciclorama`. Aqui só há a lista do
   que fotografar e onde gravar.

   USO
     node tools/studio-render/shoot.mjs                      # tudo que falta
     node tools/studio-render/shoot.mjs iveco/iveco-s-way-480 # só um modelo
     node tools/studio-render/shoot.mjs --force              # refaz o que existe
     node tools/studio-render/shoot.mjs --cores              # + as cores da paleta
     node tools/studio-render/shoot.mjs --cores --out DIR    # grava fora do vivo

   O DESTINO é `STUDIO_ASSETS_ROOT/v1/renders/trucks/<marca>/<modelo>/<chassi>/`
   e o manifesto `renders/renders.json` é reescrito no fim — ele é o que a
   interface consulta ANTES de montar qualquer URL, então um arquivo gravado e
   não anunciado é um arquivo que não existe.

   O NEUTRO É O PADRÃO; `--cores` acrescenta a matriz. O neutro é o que todo
   card usa como fallback e é o que o teste de manifesto exige, então ele sai
   sozinho e rápido. Com `--cores` entram, por chassi:

     - um card por ACABAMENTO de fábrica (`ModelDef.finishes`) — a película, com
       `paintMaterials: []`, que é a mesma regra de `paintMaterialsOf()` no
       catálogo: acabamento escolhido ⇒ a tinta não toca a lataria;
     - um card por TINTA da paleta da montadora, com a receita traduzida do
       `previewConfig` — a mesma tradução que `paintEffectFrom()` faz no app,
       reusada de `matrix.mjs` para não existir uma segunda.

   São ~820 imagens e algumas dezenas de minutos em renderizador de software.
   `--out DIR` grava numa árvore à parte em vez da viva, para a página não
   servir metade de uma leva enquanto a outra metade ainda está sendo feita. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, ASSETS_ROOT } from './serve.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const WEB = resolve(HERE, '../..');
const V1 = join(resolve(ASSETS_ROOT), 'v1');
const NEUTRAL = 'neutro';
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || '/home/kennedy/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome';

const argv = process.argv.slice(2);
const force = argv.includes('--force');
const cores = argv.includes('--cores');
/* `--out DIR` desloca a árvore de saída INTEIRA, inclusive o manifesto: os dois
   têm de andar juntos, ou o manifesto da árvore viva passa a anunciar arquivos
   que estão noutro lugar. */
const outIdx = argv.indexOf('--out');
const OUT_ROOT = outIdx >= 0 && argv[outIdx + 1]
  ? resolve(argv[outIdx + 1]) : join(V1, 'renders');
const only = argv.filter((a, i) => !a.startsWith('--') && i !== outIdx + 1);

const brands = JSON.parse(
  await readFile(join(V1, 'brands/trucks/brands.json'), 'utf8'));

/* A PALETA vem da MESMA rota pública que o estúdio consome, e a tradução
   `previewConfig` -> receita é a de `matrix.mjs`, que por sua vez espelha
   `paintEffectFrom()` em pages/tools/truck-studio/index.tsx. Reusar em vez de
   reescrever: três cópias da mesma tradução divergem na primeira tinta nova. */
const palette = cores ? await (await import('./matrix.mjs')).fetchColors() : [];
if (cores) console.log(`paleta: ${palette.length} tintas`);

/* `colorsFor()` do engine: a paleta de uma montadora é a das tintas amarradas
   a ela e, SEM NENHUMA, o catálogo inteiro. Desde que toda montadora ganhou um
   branco no banco esse ramo não deve disparar — se disparar, avisa, porque são
   500+ cards por chassi e não um detalhe. */
function paletaDe(manId) {
  const mine = palette.filter((c) => c.manufacturer === manId);
  if (mine.length) return mine;
  if (palette.length) {
    console.warn(`  AVISO [${manId}] sem tinta amarrada no banco — cairia no `
      + `catálogo inteiro (${palette.length}). Pulando as cores desta montadora.`);
  }
  return [];
}

/* A MESMA RESOLUÇÃO DE ARQUIVO DO APP: `chassis.file ?? model.file`. Duplicá-la
   aqui é o risco conhecido deste script; o antídoto é ela ser UMA linha e estar
   ao lado do comentário que diz de onde veio (catalog.ts → fileOf()). */
const fileOf = (model, chassis) => chassis.file || model.file || null;

const jobs = [];
for (const man of brands.manufacturers) {
  for (const model of man.models || []) {
    if (model.available === false) continue;
    for (const chassis of model.chassis || []) {
      if (chassis.available === false) continue;
      const file = fileOf(model, chassis);
      if (!file) continue;
      const key = `${man.id}/${model.id}`;
      if (only.length && !only.some((o) => key.startsWith(o) || o === man.id)) continue;
      const out = join(OUT_ROOT, 'trucks', man.id, model.id, chassis.id, NEUTRAL + '.webp');
      if (!force && existsSync(out)) continue;
      /* SÓ `specialEdition` força `[]`. Um modelo com ACABAMENTOS continua
         pintável — o acabamento é um card no passo da cor, não o produto
         inteiro —, e o NEUTRO dele é justamente o caminhão liso. Passar `[]`
         aqui produzia um card neutro com a película da edição limitada, que
         é o card do acabamento, não o do modelo. */
      const pm = model.specialEdition
        ? [] : (chassis.paintMaterials ?? model.paintMaterials ?? null);
      const base = { man: man.id, model: model.id, chassis: chassis.id, file };
      const alvo = (id) => join(OUT_ROOT, 'trucks', man.id, model.id, chassis.id, id + '.webp');
      const enfileira = (id, extra) => {
        const o = alvo(id);
        if (!force && existsSync(o)) return;
        jobs.push({ ...base, out: o, id, paintMaterials: pm, recipe: null, ...extra });
      };

      enfileira(NEUTRAL, {});
      if (!cores) continue;

      /* ACABAMENTO: `paintMaterials: []` é a mesma regra que
         `paintMaterialsOf()` aplica no catálogo quando há `finishId` — a
         película é o acabamento, então a tinta não toca a lataria. Sem isso o
         three multiplica a arte pela cor e ela sai em tons dela. */
      for (const f of model.finishes || []) {
        enfileira(f.id, { paintMaterials: [], rotulo: f.name });
      }
      /* Uma edição especial não tem passo de cor; enfileirar tinta nela seria
         produzir um caminhão que não existe. */
      if (model.specialEdition) continue;
      for (const c of paletaDe(man.id)) {
        enfileira(c.id, { recipe: c.recipe, rotulo: c.name });
      }
    }
  }
}

if (!jobs.length) {
  console.log('nada a fazer (use --force para refazer o que já existe)');
  process.exit(0);
}
console.log(`${jobs.length} card(s) neutro(s) a produzir`);

const { chromium } = await import(WEB + '/../api/node_modules/playwright/index.mjs');
const server = await startServer();
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--disable-gpu-sandbox', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.goto(server.url, { waitUntil: 'load' });
await page.waitForFunction('window.__rigReady === true', null, { timeout: 240000 });
const info = await page.evaluate('window.__rig.init()');
console.log('rig pronto ·', JSON.stringify(info));

/* CARREGAR SÓ QUANDO MUDA. Um `.glb` custa de 3 a 20 s e uma cor custa uma
   escrita de uniform; recarregar por imagem multiplicaria a varredura por
   vinte. A chave inclui `paintMaterials` porque ele decide QUAIS materiais
   viram tinta — trocar de `null` para `[]` (o acabamento) exige recarregar. */
let carregado = null;
let feitos = 0;
const t0 = Date.now();
for (const j of jobs) {
  const chave = `${j.file}|${j.chassis}|${JSON.stringify(j.paintMaterials)}`;
  let report = null;
  if (chave !== carregado) {
    report = await page.evaluate(
      ([f, c, m, p]) => window.__rig.load(f, c, m, p),
      [j.file, j.chassis, j.model, j.paintMaterials]);
    carregado = chave;
  }
  /* `null` no NEUTRO e no ACABAMENTO, e a receita nas cores. No neutro `null`
     é o bake como ele é — passar tinta faria do "neutro" mais uma cor, e o
     fallback de todo card do modelo mostraria uma escolha que ninguém fez. No
     acabamento não há material de tinta registrado (`paintMaterials: []`),
     então `setPaint` não tem o que tocar e a película atravessa intacta. */
  const data = await page.evaluate((r) => window.__rig.shoot(r), j.recipe);
  await mkdir(join(j.out, '..'), { recursive: true });
  await writeFile(j.out, Buffer.from(String(data).split(',')[1], 'base64'));
  feitos++;
  if (j.id === NEUTRAL) {
    console.log('  ✓', `${j.man}/${j.model}/${j.chassis}`,
      '·', JSON.stringify(report).slice(0, 100));
  } else if (feitos % 25 === 0) {
    const s = (Date.now() - t0) / 1000;
    console.log(`  ${feitos}/${jobs.length} · ${(feitos / s).toFixed(2)} img/s`
      + ` · resta ${(((jobs.length - feitos) / (feitos / s)) / 60).toFixed(1)} min`);
  }
}

await browser.close();
await server.close();

/* O MANIFESTO É REESCRITO A PARTIR DO DISCO, nunca somando ao que estava lá: a
   verdade é o diretório, e um `have` que só cresce nunca perde a linha de uma
   combinação apagada — foi assim que `iveco-s-way-440` continuou anunciado
   depois de o modelo sair do catálogo. */
const { readdir } = await import('node:fs/promises');
const root = join(OUT_ROOT, 'trucks');
const have = {};
for (const man of await readdir(root)) {
  for (const model of await readdir(join(root, man))) {
    for (const chassis of await readdir(join(root, man, model))) {
      const files = (await readdir(join(root, man, model, chassis)))
        .filter((f) => f.endsWith('.webp'))
        .map((f) => f.slice(0, -5));
      if (files.length) {
        /* O neutro primeiro: é o fallback, e uma lista que começa por ele
           documenta isso para quem abrir o JSON. */
        files.sort((a, b) => (a === NEUTRAL ? -1 : b === NEUTRAL ? 1 : a.localeCompare(b)));
        have[`${man}/${model}/${chassis}`] = files;
      }
    }
  }
}
const manifestPath = join(OUT_ROOT, 'renders.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.have = have;
manifest.counts = {
  combinacoes: Object.keys(have).length,
  imagens: Object.values(have).reduce((n, v) => n + v.length, 0),
};
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('manifesto reescrito ·', JSON.stringify(manifest.counts));
