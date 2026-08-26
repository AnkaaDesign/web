/* Driver do medidor de 2026-08-20 — serve `public/`, abre o Chromium e
   despeja o JSON. Sem foto: esta bancada é de NÚMERO.
   ---------------------------------------------------------------------------
   Irmão de `shoot-impl.mjs` (mesma origem única, mesmos aliases de esbuild,
   mesma busca de Chromium no cache do Playwright), com uma diferença: aqui não
   há WebGL nem canvas, então ela sobe em segundos e não deixa Chromium órfão
   queimando CPU.

       node tools/trailer-bench/medir-0820.mjs                 # os DOIS
       node tools/trailer-bench/medir-0820.mjs <arquivo.glb>   # um só
*/
import { createServer } from 'node:http';
import { stat, readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const WEB = resolve(HERE, '..', '..');
const PUBLIC = join(WEB, 'public');
const OUT = join(HERE, 'medidas-0820');

const CAT = JSON.parse(await readFile(
  join(PUBLIC, 'models', 'vehicles', 'implements.json'), 'utf8'));
const ALVOS = process.argv[2]
  ? [process.argv[2]]
  : CAT.implements.map((d) => d.file);

async function loadEsbuild() {
  const store = join(WEB, 'node_modules', '.pnpm');
  const dirs = (await readdir(store)).filter((d) => d.startsWith('esbuild@'));
  if (!dirs.length) throw new Error('esbuild não encontrado em node_modules/.pnpm');
  const main = join(store, dirs[0], 'node_modules', 'esbuild', 'lib', 'main.js');
  const mod = await import(pathToFileURL(main).href);
  return mod.default ?? mod;
}

async function findChromium() {
  const home = process.env.USERPROFILE || process.env.HOME;
  const roots = [join(home, 'AppData', 'Local', 'ms-playwright'), join(home, '.cache', 'ms-playwright')];
  for (const root of roots) {
    let entries;
    try { entries = await readdir(root); } catch { continue; }
    const builds = entries.filter((d) => /^chromium(-headless-shell)?-\d+$/.test(d))
      .sort((a, b) => Number(b.split('-').pop()) - Number(a.split('-').pop()));
    for (const b of builds) {
      for (const rel of [
        ['chrome-win64', 'chrome.exe'], ['chrome-win', 'chrome.exe'],
        ['chrome-linux64', 'chrome'], ['chrome-linux', 'chrome'],
        ['chrome-headless-shell-linux64', 'chrome-headless-shell'],
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
  '.webp': 'image/webp', '.png': 'image/png', '.bin': 'application/octet-stream',
};

const esbuild = await loadEsbuild();
const { chromium } = await import('playwright-core');
const built = await esbuild.build({
  entryPoints: [join(HERE, 'medir-0820.ts')],
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
const HTML = `<!doctype html><meta charset="utf-8"><title>medir</title>
<script type="module" src="/medir-0820.js"></script>`;

const safeJoin = (root, rel) => {
  const p = resolve(root, '.' + rel);
  return (p === root || p.startsWith(root + sep)) ? p : null;
};
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    if (path === '/' || path === '/index.html') {
      res.writeHead(200, { 'content-type': MIME['.html'] }); return res.end(HTML);
    }
    if (path === '/medir-0820.js') {
      res.writeHead(200, { 'content-type': MIME['.js'] }); return res.end(js);
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

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: await findChromium(),
  args: ['--no-sandbox', '--disable-gpu-sandbox', '--use-gl=angle',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

for (const IMPL of ALVOS) {
  const DEF = (CAT.implements || []).find((d) => d.file === IMPL) || {};
  const qs = new URLSearchParams({
    impl: IMPL,
    sill: DEF.sillMaterial || DEF.frameMaterial || '',
    frame: DEF.frameMaterial || DEF.sillMaterial || '',
    porta: DEF.bakedSideDoor ? '1' : '0',
    marca: DEF.makerBranding ? '1' : '0',
    banda: DEF.lowFrameSkin ? '1' : '0',
    fita: DEF.cornerTape ? '1' : '0',
    trilho: DEF.lowFrameRail ? '1' : '0',
    mangueira: DEF.singleRearHose ? '1' : '0',
    tubos: DEF.strayConduits ? '1' : '0',
    encosto: DEF.sideDoorCatches ? '1' : '0',
    assenta: DEF.flankCatchOnFlat ? '1' : '0',
    topo: DEF.topRailDressing ? '1' : '0',
    foto: process.env.FOTO === '1' ? '1' : '0',
    /* ⚠️ `alvo`, e NÃO `marca`: `marca` já é a bandeira de `removeMakerBranding`
       e uma segunda chave com o mesmo nome no `URLSearchParams` apaga a
       primeira — a remoção da marca do fabricante deixava de rodar em silêncio
       toda vez que se pedia foto. */
    alvo: process.env.ALVO || '',
    cota: process.env.COTA || '',
    tol: process.env.TOL || '',
  });
  const page = await browser.newPage();
  const log = [];
  page.on('console', (m) => log.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => log.push(`[pageerror] ${e.message}`));
  console.log('\n══════ ' + IMPL + ' ══════');
  await page.goto(url + '?' + qs, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', null, { timeout: 300000 });
  const err = await page.evaluate('window.__error || null');
  const diag = await page.evaluate('window.__diag || null');
  console.log('--- console da página ---');
  for (const l of log) console.log('  ' + l);
  if (err) console.log('!! ERRO:\n' + err);
  /* As fotos saem para PNG e não para o JSON — um dataURL de 2 MB por
     enquadramento torna o relatório ilegível e não se abre. */
  if (diag && diag.fotos) {
    for (const [nome, url] of Object.entries(diag.fotos)) {
      const png = join(OUT, IMPL.replace(/\.glb$/, '') + '-' + nome + '.png');
      await writeFile(png, Buffer.from(String(url).split(',')[1], 'base64'));
      console.log('    foto →', png);
    }
    diag.fotos = Object.keys(diag.fotos);
  }
  const dest = join(OUT, IMPL.replace(/\.glb$/, '') + '.json');
  await writeFile(dest, JSON.stringify(diag, null, 1), 'utf8');
  console.log('--- medidas → ' + dest);
  await page.close();
}

await browser.close();
await new Promise((ok) => server.close(ok));
console.log('\npronto.');
