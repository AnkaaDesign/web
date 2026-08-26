/* Serve a bancada do IMPLEMENTO NOVO, abre o Chromium e salva os PNGs.
   ---------------------------------------------------------------------------
   Irmão de `shoot-door.mjs` — mesma serventia de origem única, mesmos aliases
   de esbuild, mesma busca de Chromium no cache do Playwright. A diferença é o
   ALVO: aqui o `.glb` é argumento, porque a pergunta desta bancada ("o baú
   paramétrico sabe ler este bake?") só faz sentido para um arquivo que ainda
   não está aprovado.

       node tools/trailer-bench/shoot-impl.mjs [arquivo.glb]

   Padrão: `sobrechassi_frigorifico_gancheiro.glb`.

   O ORIGINAL abaixo, preservado do irmão:
   ---------------------------------------------------------------------------
   Irmão de `shoot.mjs`, com uma diferença que vale registrar: os caminhos aqui
   são DERIVADOS, não escritos. O `shoot.mjs` original tem `/home/kennedy/...` e
   `/srv/studio-assets` no corpo do arquivo, e por isso ele só roda numa máquina.
   Aqui a raiz do repo sai de `import.meta.url`, o esbuild e o playwright saem de
   `node_modules` por resolução, e o Chromium sai do cache do Playwright do
   sistema — Windows e Linux, sem edição.

   E ela serve `web/public` na RAIZ, não `/studio-assets/v1`: esta bancada só
   precisa de `/models/vehicles/trailer.glb` e de `/vendor/draco/`, que moram
   os dois ali. */
import { createServer } from 'node:http';
import { stat, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const WEB = resolve(HERE, '..', '..');
const PUBLIC = join(WEB, 'public');
const OUT = join(HERE, 'shots-implemento');
/** O `.glb` sob julgamento, relativo a `public/models/vehicles/`. */
const IMPL = process.argv[2] || 'sobrechassi_frigorifico_gancheiro.glb';
/** `sillMaterial` do `implements.json` — lido do próprio manifesto para a
 *  bancada julgar o que o app vai montar, e não uma variante escrita à mão. */
const CAT = JSON.parse(await (await import('node:fs/promises')).readFile(
  join(PUBLIC, 'models', 'vehicles', 'implements.json'), 'utf8'));
const DEF = (CAT.implements || []).find((d) => d.file === IMPL) || {};
const SILL = process.argv[3] || DEF.sillMaterial || DEF.frameMaterial || '';
const FRAME = DEF.frameMaterial || DEF.sillMaterial || '';
/** As remoções de bake saem do MESMO manifesto que o app lê. */
const PORTA = DEF.bakedSideDoor ? '1' : '0';
const MARCA = DEF.makerBranding ? '1' : '0';
const BANDA = DEF.lowFrameSkin ? '1' : '0';
const FITA = DEF.cornerTape ? '1' : '0';
const TRILHO = DEF.lowFrameRail ? '1' : '0';
const MANG = DEF.singleRearHose ? '1' : '0';
const TUBOS = DEF.strayConduits ? '1' : '0';
/** `?ss=` — ver a nota de superamostragem em `implprobe.ts`. */
const SS = process.env.SS || '1';

/** O primeiro `esbuild` que o pnpm tiver desdobrado — a versão não importa. */
async function loadEsbuild() {
  const store = join(WEB, 'node_modules', '.pnpm');
  const dirs = (await readdir(store)).filter((d) => d.startsWith('esbuild@'));
  if (!dirs.length) throw new Error('esbuild não encontrado em node_modules/.pnpm');
  const main = join(store, dirs[0], 'node_modules', 'esbuild', 'lib', 'main.js');
  const mod = await import(pathToFileURL(main).href);
  return mod.default ?? mod;
}

/** O Chromium do cache do Playwright, na plataforma em que estamos. */
async function findChromium() {
  const home = process.env.USERPROFILE || process.env.HOME;
  const roots = [
    join(home, 'AppData', 'Local', 'ms-playwright'),
    join(home, '.cache', 'ms-playwright'),
  ];
  for (const root of roots) {
    let entries;
    try { entries = await readdir(root); } catch { continue; }
    const builds = entries.filter((d) => /^chromium-\d+$/.test(d))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const b of builds) {
      for (const rel of [
        ['chrome-win64', 'chrome.exe'],
        ['chrome-win', 'chrome.exe'],
        ['chrome-linux64', 'chrome'],
        ['chrome-linux', 'chrome'],
      ]) {
        const p = join(root, b, ...rel);
        try { await stat(p); return p; } catch { /* próximo */ }
      }
    }
  }
  throw new Error('Chromium do Playwright não encontrado no cache');
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.bin': 'application/octet-stream',
};

/**
 * O driver do Playwright.
 *
 * `playwright-core` é dependência de desenvolvimento DESTE repositório, que é
 * onde a bancada mora. O `shoot.mjs` ao lado importa de
 * `../api/node_modules/playwright` — um repositório vizinho onde o pacote nunca
 * foi declarado, só instalado à mão. Isso sobreviveu enquanto ninguém apagou
 * aquele `node_modules`; quando apagaram, a bancada morreu junto e a causa não
 * tinha nada a ver com ela. `core` e não o pacote cheio porque os navegadores já
 * estão no cache do sistema e `launch({ executablePath })` não baixa nada. */
const esbuild = await loadEsbuild();
const { chromium } = await import('playwright-core');

const built = await esbuild.build({
  entryPoints: [join(HERE, 'implprobe.ts')],
  bundle: true, write: false, format: 'esm', target: 'es2022',
  sourcemap: 'inline', logLevel: 'warning',
  /* Aliases explícitos: o esbuild resolve `three` a partir do ARQUIVO que
     importa, não do `absWorkingDir`. */
  alias: {
    '@': join(WEB, 'src'),
    three: join(WEB, 'node_modules', 'three', 'build', 'three.module.js'),
    'three/addons': join(WEB, 'node_modules', 'three', 'examples', 'jsm'),
  },
  nodePaths: [join(WEB, 'node_modules')],
  absWorkingDir: WEB,
});
const js = built.outputFiles[0].text;

const HTML = `<!doctype html><meta charset="utf-8"><title>implcheck</title>
<style>html,body{margin:0;background:#222}canvas{display:block}</style>
<script type="module" src="/implprobe.js"></script>`;

const safeJoin = (root, rel) => {
  const p = resolve(root, '.' + rel);
  return (p === root || p.startsWith(root + sep)) ? p : null;
};

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    if (path === '/' || path === '/index.html') {
      res.writeHead(200, { 'content-type': MIME['.html'] });
      return res.end(HTML);
    }
    if (path === '/implprobe.js') {
      res.writeHead(200, { 'content-type': MIME['.js'] });
      return res.end(js);
    }
    if (path === '/favicon.ico') { res.writeHead(204); return res.end(); }
    const file = safeJoin(PUBLIC, path);
    if (!file) { res.writeHead(404); return res.end('404'); }
    const s = await stat(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': s.size,
    });
    createReadStream(file).pipe(res);
  } catch (e) {
    res.writeHead(e?.code === 'ENOENT' ? 404 : 500);
    res.end(String(e?.message || e));
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${server.address().port}`;
console.log('servindo', url, '←', PUBLIC);

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: await findChromium(),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--disable-gpu-sandbox', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
page.on('console', (m) => console.log('  [browser]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.goto(url + '?impl=' + encodeURIComponent(IMPL)
  + (SILL ? '&sill=' + encodeURIComponent(SILL) : '')
  + (FRAME ? '&frame=' + encodeURIComponent(FRAME) : '')
  + `&porta=${PORTA}&marca=${MARCA}&banda=${BANDA}&fita=${FITA}&trilho=${TRILHO}&mangueira=${MANG}&tubos=${TUBOS}&ss=${SS}`, { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', null, { timeout: 300000 });

const err = await page.evaluate('window.__error || null');
if (err) {
  console.log('\n!! ERRO NA PÁGINA:\n' + err);
  await browser.close();
  await new Promise((ok) => server.close(ok));
  process.exit(1);
}

console.log('\n===== DIAGNÓSTICO =====');
console.log(JSON.stringify(await page.evaluate('window.__diag || null'), null, 1));

/* Enquadramentos: o 3/4 mostra a moldura em relevo e a sombra do vão; o
   rasante é o que denuncia z-fighting, porque é onde folha e chapa ficam mais
   perto em ângulo; o de conjunto situa a porta no baú. */
/* O par `-cru` é o A/B do z-buffer: MESMO enquadramento, corpo paramétrico
   escondido e chapas de fábrica de volta. Cintilação que aparece nos dois é do
   bake; nos dois é a resposta que interessa, porque ela decide se o conserto é
   no asset ou no código. */
const SHOTS = [
  ['conjunto-3-4', [1.0, 0.35, 0.85], null, 0, false],
  ['lateral', [1, 0.05, 0.0], null, 0, false],
  ['traseira-3-4', [-0.9, 0.35, -0.9], null, 0, false],
  ['porta-3-4', [1.0, 0.30, 0.45], null, 5.0, false],
  ['rasante', [1, 0.05, 0.62], null, 3.2, false],
  ['rasante-cru', [1, 0.05, 0.62], null, 3.2, true],
  ['topo', [0.35, 1.4, 0.35], null, 0, false],
];
/* As vistas RELATIVAS: mesma região, mesma escala aparente, nos dois
   implementos. `[u, v, w, dir, distância em alturas de baú]`. */
const REL = [
  ['rel-topo-frente', 0.92, 0.92, 1, [1, 0.35, 0.55], 0.9],
  ['rel-base-frente', 0.92, 0.10, 1, [1, 0.25, 0.55], 0.9],
  ['rel-topo-meio', 0.50, 0.93, 1, [1, 0.45, 0.10], 0.8],
  ['rel-base-meio', 0.50, 0.08, 1, [1, 0.35, 0.10], 0.8],
  ['rel-traseira', 0.06, 0.55, 0, [0.35, 0.20, -1], 1.9],
  ['rel-frente-canto', 1.0, 0.55, 1, [0.9, 0.20, 0.7], 1.6],
];
for (const [name, u, v, w, dir, dh] of REL) {
  const data = await page.evaluate(
    ([a, b, c, d, e]) => window.__shotRel(a, b, c, d, e), [u, v, w, dir, dh]);
  await writeFile(join(OUT, name + '.png'), Buffer.from(data.split(',')[1], 'base64'));
  console.log('  ->', join(OUT, name + '.png'));
}

for (const [name, dir, target, dist, cru] of SHOTS) {
  const data = await page.evaluate(
    ([d, t, k, c]) => window.__shot(d, t || null, k, c),
    [dir, target, dist, cru]);
  await writeFile(join(OUT, name + '.png'), Buffer.from(data.split(',')[1], 'base64'));
  console.log('  ->', join(OUT, name + '.png'));
}

await browser.close();
await new Promise((ok) => server.close(ok));
