/* Driver da bancada de RENDER POR ELEMENTO — serve, fotografa, grava peças e
   manifesto.
   ---------------------------------------------------------------------------
   Uso:  node tools/livery-render/shoot.mjs            # grava direto no vivo
         node tools/livery-render/shoot.mjs --out DIR  # ensaia numa árvore à parte

   Saída: `public/models/vehicles/panels/` — os PNGs por peça e o
   `layout.json` (schema truck-studio/livery-art@2), que `vehicle/livery-art.ts`
   baixa. O manifesto é REESCRITO a partir do que foi fotografado nesta rodada
   (a mesma doutrina do renders.json do studio-render: manifesto que sobra
   anunciando arquivo velho é pior que nenhum).

   Higiene de caminhos idêntica a `trailer-bench/shoot-door.mjs` (o cabeçalho de
   lá explica cada decisão): tudo derivado de `import.meta.url`, esbuild e
   playwright-core resolvidos da loja do pnpm, Chromium do cache do Playwright. */
import { createServer } from 'node:http';
import { stat, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const WEB = resolve(HERE, '..', '..');
const PUBLIC = join(WEB, 'public');

const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const OUT = outIdx >= 0 && argv[outIdx + 1]
  ? resolve(argv[outIdx + 1])
  : join(PUBLIC, 'models', 'vehicles', 'panels');

async function loadEsbuild() {
  const store = join(WEB, 'node_modules', '.pnpm');
  const dirs = (await readdir(store)).filter((d) => d.startsWith('esbuild@'));
  if (!dirs.length) throw new Error('esbuild não encontrado em node_modules/.pnpm');
  const main = join(store, dirs[0], 'node_modules', 'esbuild', 'lib', 'main.js');
  const mod = await import(pathToFileURL(main).href);
  return mod.default ?? mod;
}

async function loadPlaywrightCore() {
  try { return await import('playwright-core'); } catch { /* loja */ }
  const store = join(WEB, 'node_modules', '.pnpm');
  const dirs = (await readdir(store)).filter((d) => d.startsWith('playwright-core@'));
  if (!dirs.length) throw new Error('playwright-core não encontrado em node_modules/.pnpm');
  const main = join(store, dirs[0], 'node_modules', 'playwright-core', 'index.mjs');
  return import(pathToFileURL(main).href);
}

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
        ['chrome-win64', 'chrome.exe'], ['chrome-win', 'chrome.exe'],
        ['chrome-linux64', 'chrome'], ['chrome-linux', 'chrome'],
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

const esbuild = await loadEsbuild();
const { chromium } = await loadPlaywrightCore();

const built = await esbuild.build({
  entryPoints: [join(HERE, 'paneprobe.ts')],
  bundle: true, write: false, format: 'esm', target: 'es2022',
  sourcemap: 'inline', logLevel: 'warning',
  alias: {
    '@': join(WEB, 'src'),
    three: join(WEB, 'node_modules', 'three', 'build', 'three.module.js'),
    'three/addons': join(WEB, 'node_modules', 'three', 'examples', 'jsm'),
  },
  nodePaths: [join(WEB, 'node_modules')],
  absWorkingDir: WEB,
});
const js = built.outputFiles[0].text;

const HTML = `<!doctype html><meta charset="utf-8"><title>panecheck</title>
<style>html,body{margin:0;background:
repeating-conic-gradient(#333 0% 25%, #3c3c3c 0% 50%) 0 0/24px 24px}
canvas{display:block}</style>
<script type="module" src="/paneprobe.js"></script>`;

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
    if (path === '/paneprobe.js') {
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

const plan = await page.evaluate('window.__plan()');
console.log('\n===== PERFIL =====');
console.log(JSON.stringify(plan.perfil));
for (const n of plan.notas) console.log('  ·', n);

/* Fotografa cada peça. Uma falha derruba a rodada INTEIRA de propósito: um
   manifesto que anuncia 17 peças e entrega 15 é um painel com buracos que
   ninguém relatou. */
const shots = new Map();
for (const p of plan.pecas) {
  const r = await page.evaluate(
    ([id]) => window.__shoot(id), [`${p.face}/${p.id}`]);
  await writeFile(join(OUT, p.file), Buffer.from(r.png.split(',')[1], 'base64'));
  shots.set(`${p.face}/${p.id}`, r);
  console.log(`shot ${p.face}/${p.id}  ${r.wPx}×${r.hPx}  → ${p.file}`);
}

/* O manifesto, reescrito do que esta rodada fotografou. */
const manifest = {
  schema: 'truck-studio/livery-art@2',
  source: 'models/vehicles/trailer.glb — renders ortográficos por elemento (tools/livery-render)',
  note: 'Grade por face, MEDIDA do bake. `anchorX`/`anchorY` dizem o que NÃO '
    + 'deforma; `tile` é o passo de ladrilho em metros e `span` a largura '
    + 'desenhada de um ladrilho (fita: segmento < passo). Em peças presas ao '
    + 'teto, `y` é quanto o PÉ da peça fica abaixo do TETO; nas demais, é '
    + 'medido do PISO (negativo = desce para a saia; o compositor recorta). '
    + 'w/h nulos = acompanhe a medida do painel.',
  faces: {},
};
for (const [face, meta] of Object.entries(plan.faces)) {
  manifest.faces[face] = {
    ...meta,
    pieces: plan.pecas.filter((p) => p.face === face).map((p) => ({
      id: p.id, plane: p.plane, file: p.file,
      x: p.x, y: p.y, w: p.w, h: p.h,
      ...(p.anchorX ? { anchorX: p.anchorX } : {}),
      ...(p.anchorY ? { anchorY: p.anchorY } : {}),
      ...(p.tile ? { tile: p.tile } : {}),
      ...(p.span ? { span: p.span } : {}),
      ...(p.phase !== undefined ? { phase: p.phase } : {}),
      pxPerM: Math.round(shots.get(`${p.face}/${p.id}`).wPx / p.janela_m[0]),
    })),
  };
}
await writeFile(join(OUT, 'layout.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('\nlayout.json escrito em', OUT);

await browser.close();
await new Promise((ok) => server.close(ok));
console.log('pronto →', OUT);
