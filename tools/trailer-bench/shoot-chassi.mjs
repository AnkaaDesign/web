/* Serve a sonda dos TRÊS CHASSIS RÍGIDOS, abre o Chromium e salva os PNGs.
   ---------------------------------------------------------------------------
   Irmão de `shoot-mount.mjs`, com uma diferença: ele mede UM caminhão por
   execução e este roda a LISTA, porque a pergunta desta rodada é comparativa —
   o Volvo está certo e o Scania não, e o que interessa é a coluna em que os
   dois discordam.

       node tools/trailer-bench/shoot-chassi.mjs                 # os três
       node tools/trailer-bench/shoot-chassi.mjs scania_p_8x2r.glb
       FOTO=0 node tools/trailer-bench/shoot-chassi.mjs          # só a medida

   Caminhos DERIVADOS (raiz do repo, esbuild, Playwright, Chromium), como no
   `shoot-impl.mjs` — roda em Windows e Linux sem edição. */
import { createServer } from 'node:http';
import { stat, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const WEB = resolve(HERE, '..', '..');
const PUBLIC = join(WEB, 'public');
const OUT = join(HERE, 'shots-chassi');

const PADRAO = ['volvo_vm_2015_6x2r.glb', 'scania_p_8x2r.glb', 'vw_titan_6x2_tl.glb'];
const ALVOS = process.argv.slice(2).length ? process.argv.slice(2) : PADRAO;
const SS = process.env.SS || '1';
const FOTO = process.env.FOTO !== '0';

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
    const builds = entries.filter((d) => /^chromium-\d+$/.test(d))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const b of builds) {
      for (const rel of [['chrome-win64', 'chrome.exe'], ['chrome-win', 'chrome.exe'],
        ['chrome-linux64', 'chrome'], ['chrome-linux', 'chrome']]) {
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
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.bin': 'application/octet-stream',
};

const esbuild = await loadEsbuild();
const { chromium } = await import('playwright-core');

const built = await esbuild.build({
  entryPoints: [join(HERE, 'chassiprobe.ts')],
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

const HTML = `<!doctype html><meta charset="utf-8"><title>chassicheck</title>
<style>html,body{margin:0;background:#222}canvas{display:block}</style>
<script type="module" src="/chassiprobe.js"></script>`;

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
    if (path === '/chassiprobe.js') {
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

/* `ENQUADRA` troca a lista por uma só: `nome:dx,dy,dz:tx,ty,tz:dist`. É como se
   pede um detalhe — "o para-lama do 2º eixo" não cabe em nenhum dos quatro
   enquadramentos de conjunto abaixo. */
const SHOTS = process.env.ENQUADRA
  ? process.env.ENQUADRA.split(';').map((s) => {
    const [nome, dir, alvo, dist] = s.split(':');
    return [nome, dir.split(',').map(Number),
      alvo ? alvo.split(',').map(Number) : null, dist ? Number(dist) : 0];
  })
  : [
    ['lateral', [1, 0.04, 0], null, 0],
    ['3-4-dianteira', [1, 0.32, -0.85], null, 0],
    ['encontro-cabine', [1, 0.18, -0.55], null, 5.0],
    ['3-4-traseira', [-0.95, 0.30, 0.9], null, 0],
  ];

for (const alvo of ALVOS) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('console', (m) => console.log('  [browser]', m.type(), m.text()));
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  /* `PINTA` sem valor = detecção automática (o app de hoje sem lista);
     `PINTA="pintura,vm_cab"` = a lista candidata para `chassis[].paintMaterials`.
     Aceita uma lista por caminhão, separada por `;`, na ordem de ALVOS. */
  const listas = (process.env.PINTA ?? '').split(';');
  const pinta = listas.length > 1 ? (listas[ALVOS.indexOf(alvo)] ?? '') : listas[0];
  const extra = (process.env.GAP ? `&gap=${process.env.GAP}` : '')
    + (process.env.PINTA !== undefined ? `&pinta=${encodeURIComponent(pinta)}` : '')
    + (process.env.DESTACA ? `&destaca=${encodeURIComponent(process.env.DESTACA)}` : '')
    + (process.env.SEM_CORRECAO === '1' ? '&semCorrecao=1' : '')
    + (process.env.TINGE_TRUCK === '1' ? '&tingeTruck=1' : '');
  await page.goto(`${url}?truck=${encodeURIComponent(alvo)}&ss=${SS}${extra}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', null, { timeout: 600000 });

  const err = await page.evaluate('window.__error || null');
  if (err) {
    console.log(`\n!! ERRO EM ${alvo}:\n` + err);
    await page.close();
    continue;
  }
  console.log(`\n======================== ${alvo} ========================`);
  console.log(JSON.stringify(await page.evaluate('window.__diag || null'), null, 1));

  if (FOTO) {
    const base = alvo.replace(/\.glb$/, '');
    for (const [name, dir, target, dist] of SHOTS) {
      const data = await page.evaluate(
        ([d, t, k]) => window.__shot(d, t || null, k), [dir, target, dist]);
      await writeFile(join(OUT, `${base}-${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
      console.log('  ->', join(OUT, `${base}-${name}.png`));
    }
  }
  await page.close();
}

await browser.close();
await new Promise((ok) => server.close(ok));
