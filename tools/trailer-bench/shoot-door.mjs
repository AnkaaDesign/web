/* Serve a bancada da PORTA, abre no Chromium do Playwright e salva os PNGs.
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
const OUT = join(HERE, 'shots-porta');

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
  entryPoints: [join(HERE, 'doorprobe.ts')],
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

const HTML = `<!doctype html><meta charset="utf-8"><title>doorcheck</title>
<style>html,body{margin:0;background:#222}canvas{display:block}</style>
<script type="module" src="/doorprobe.js"></script>`;

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
    if (path === '/doorprobe.js') {
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
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', null, { timeout: 300000 });

const err = await page.evaluate('window.__error || null');
if (err) {
  console.log('\n!! ERRO NA PÁGINA:\n' + err);
  await browser.close();
  await new Promise((ok) => server.close(ok));
  process.exit(1);
}

/* Varredura de raios pela linha média da porta: qual malha ocupa cada faixa do
   contorno, com nome, material e cor. É o diagnóstico que fecha a discussão
   sobre "essa moldura clara é o quê" sem depender de reconhecer a peça na foto. */
console.log('\n===== VARREDURA DE RAIOS =====');
const varredura = await page.evaluate('window.__ray ? window.__ray() : null');
console.log((varredura || ['(sem __ray)']).join('\n'));

console.log('\n===== DIAGNÓSTICO =====');
console.log(JSON.stringify(await page.evaluate('window.__diag || null'), null, 1));

/* Enquadramentos: o 3/4 mostra a moldura em relevo e a sombra do vão; o
   rasante é o que denuncia z-fighting, porque é onde folha e chapa ficam mais
   perto em ângulo; o de conjunto situa a porta no baú. */
const SHOTS = [
  ['porta-3-4', [1.0, 0.35, 0.55], null, 5.0, false],
  ['porta-frontal', [1, 0, 0], null, 4.2, false],
  ['porta-rasante', [1, 0.06, 0.55], null, 2.6, false],
  ['porta-ferragem', [1, 0.10, -0.45], null, 1.4, false],
  ['conjunto', [1, 0.30, 0.85], null, 12, false],
  /* Pintado, que é como o estúdio entrega: a folha leva a tinta junto com a
     chapa (ela É a chapa), moldura e ferragem não. Branco sobre branco é o
     pior caso de leitura e não pode ser o único julgado. */
  ['pintado-3-4', [1.0, 0.35, 0.55], null, 5.0, true],
  ['pintado-conjunto', [1, 0.30, 0.85], null, 12, true],
  /* Sonda: cada família chapada. Ver `flat()` em doorprobe.ts. */
  ['sonda-cores', [1, 0, 0], null, 4.2, false, true],
  /* A TRASEIRA, que é a fonte do kit — o único julgamento honesto da lateral é
     contra ela. Enquadramentos irmãos dos de cima: conjunto, ferragem do varão
     e canto inferior, que é onde o encaixe e a alavanca moram. */
  ['traseira-conjunto', [0.30, 0.16, -1], [0.30, 2.80, -7.45], 5.2, false],
  ['traseira-ferragem', [0.55, 0.05, -1], [0.30, 2.60, -7.45], 1.9, false],
  ['traseira-canto', [0.45, 0.10, -1], [0.25, 1.80, -7.45], 1.2, false],
  /* E os mesmos dois na LATERAL, para comparar peça a peça. A porta da bancada
     nasce em `sillY + DOOR_REVEAL` = 1,622 e vai a 3,972; o varão fica na
     borda dianteira da folha, z 3,215. */
  ['lateral-canto', [1, 0.10, 0.35], [1.30, 1.78, 3.10], 1.2, false],
  ['lateral-guia', [1, 0.02, 0.30], [1.30, 2.47, 3.11], 1.0, false],
  ['lateral-topo', [1, -0.10, 0.30], [1.30, 3.90, 3.10], 1.2, false],
  /* Sem o marco e sem a borracha: quem some é quem estava ali. */
  ['sem-marco', [1, 0, 0], null, 4.2, false, false, 'PORTA_MARCO'],
  ['sem-borracha', [1, 0, 0], null, 4.2, false, false, 'PORTA_BORRACHA'],
];
for (const [name, dir, target, dist, paint, diag, hide] of SHOTS) {
  const data = await page.evaluate(
    ([d, t, k, p, g, h]) => window.__shot(d, t || [], k, p, g, h),
    [dir, target, dist, paint, diag, hide || null]);
  await writeFile(join(OUT, name + '.png'),
    Buffer.from(String(data).split(',')[1], 'base64'));
  console.log('shot', name);
}

await browser.close();
await new Promise((ok) => server.close(ok));
console.log('pronto →', OUT);
