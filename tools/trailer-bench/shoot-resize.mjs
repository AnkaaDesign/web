/* Driver da bancada do RESIZE — serve, fotografa a matriz de alturas, grava.
   ---------------------------------------------------------------------------
   Irmão de `shoot-door.mjs` e com a mesma higiene: caminhos DERIVADOS de
   `import.meta.url`, esbuild do `.pnpm`, `playwright-core` do repo, Chromium do
   cache do Playwright. Ver o cabeçalho de lá para o porquê de cada uma.

   Uso:  node tools/trailer-bench/shoot-resize.mjs
   Saída: tools/trailer-bench/shots-resize/  */
import { createServer } from 'node:http';
import { stat, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const WEB = resolve(HERE, '..', '..');
const PUBLIC = join(WEB, 'public');
const OUT = join(HERE, 'shots-resize');

/* A matriz: alturas em metros (0 = fábrica) × janelas de close em metros
   relativos ao piso (null = painel inteiro). A base FICA na matriz — a linha
   só é linha em comparação com a mesma vista sem o defeito. */
const HEIGHTS = [0];
const WINDOWS = [null];

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

/* `playwright-core` está declarado no repo mas o pnpm não o expõe no topo do
   `node_modules` — mesma resolução pela loja do `.pnpm` que o esbuild usa. */
async function loadPlaywrightCore() {
  try { return await import('playwright-core'); } catch { /* loja */ }
  const store = join(WEB, 'node_modules', '.pnpm');
  const dirs = (await readdir(store)).filter((d) => d.startsWith('playwright-core@'));
  if (!dirs.length) throw new Error('playwright-core não encontrado em node_modules/.pnpm');
  const main = join(store, dirs[0], 'node_modules', 'playwright-core', 'index.mjs');
  return import(pathToFileURL(main).href);
}

const esbuild = await loadEsbuild();
const { chromium } = await loadPlaywrightCore();

const built = await esbuild.build({
  entryPoints: [join(HERE, 'resizeprobe.ts')],
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

const HTML = `<!doctype html><meta charset="utf-8"><title>resizecheck</title>
<style>html,body{margin:0;background:#222}canvas{display:block}</style>
<script type="module" src="/resizeprobe.js"></script>`;

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
    if (path === '/resizeprobe.js') {
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

console.log('\n===== DIAGNÓSTICO =====');
console.log(JSON.stringify(await page.evaluate('window.__diag || null'), null, 1));

for (const height of HEIGHTS) {
  for (const [wi, win] of WINDOWS.entries()) {
    const tag = height ? `h${height.toFixed(2).replace('.', '')}` : 'fabrica';
    const name = win ? `${tag}-close${wi}` : `${tag}-painel`;
    const data = await page.evaluate(
      ([hh, ww]) => window.__shot(hh, ww), [height, win]);
    await writeFile(join(OUT, name + '.png'),
      Buffer.from(String(data).split(',')[1], 'base64'));
    console.log('shot', name);
  }
}

/* A JANELA DA COSTURA, e por que ela mudou.
   ---------------------------------------------------------------------------
   A primeira rodada mirou o canto traseiro-baixo (y 0,05–0,95) e saiu LIMPA:
   os 323 degraus que o scan achou eram o friso legítimo — passo 53 mm,
   amplitude ±0,75 mm — e as duas alturas produziram varreduras BYTE A BYTE
   idênticas. O print do dono do produto, ampliado, põe a linha em outro lugar:
   logo acima da faixa lisa inferior, ou seja na junta entre a SAIA e o PRIMEIRO
   FRISO (y 1,5669 absoluto = 0,175 acima do piso). É lá que `sliceRibbed()`
   separa `skirt` de `unit`, e é a fronteira que o empilhamento tem de fechar.

   Daí a janela apertada e a densidade alta: uma costura de décimos de milímetro
   precisa de px/m suficiente para não sumir na reamostragem. */
const SEAM = { yLo: 1.02, yHi: 1.15, zLo: -6.0, zHi: -5.4, ppm: 4000 };
const scans = {};
for (const height of [0, 2.5]) {
  const tag = height ? `h${height.toFixed(2).replace('.', '')}` : 'fabrica';
  const data = await page.evaluate(
    ([hh, s]) => window.__closeup(hh, s.yLo, s.yHi, s.zLo, s.zHi, s.ppm), [height, SEAM]);
  await writeFile(join(OUT, `${tag}-seam.png`),
    Buffer.from(String(data).split(',')[1], 'base64'));
  console.log('costura', tag);

  const nrm = await page.evaluate(
    ([hh, s]) => window.__closeupNormals(hh, s.yLo, s.yHi, s.zLo, s.zHi, s.ppm), [height, SEAM]);
  await writeFile(join(OUT, `${tag}-seam-normals.png`),
    Buffer.from(String(nrm).split(',')[1], 'base64'));
  console.log('normais', tag);

  /* Passo de 0,2 mm: o relevo do friso é 5,20 mm e a chapa 0,80 mm, então
     1 mm de passo (a rodada anterior) não resolve uma fresta de espessura de
     chapa. */
  const scan = await page.evaluate(
    ([hh]) => window.__scanY(hh, -5.75, 1.00, 1.18, 0.1), [height]);
  scans[tag] = scan;
  const lines = [];
  for (let i = 1; i < scan.length; i++) {
    const a = scan[i - 1], b = scan[i];
    if (a.x == null || b.x == null) {
      if ((a.x == null) !== (b.x == null)) lines.push(`y ${b.y}: BURACO (${a.x} → ${b.x})`);
      continue;
    }
    if (a.obj !== b.obj) lines.push(`y ${b.y}: ${a.obj} → ${b.obj} (x ${a.x} → ${b.x})`);
  }
  console.log(`scan ${tag}: ${scan.length} raios, ${lines.length} trocas de objeto`);
  for (const l of lines) console.log('  ', l);
  await writeFile(join(OUT, `${tag}-scan.json`), JSON.stringify(scan));
}

/* O DIFF ENTRE AS DUAS ALTURAS — o único juiz que separa friso de defeito.
   O perfil legítimo produz degraus em x nas duas alturas, nas MESMAS alturas
   relativas ao piso. Um degrau que só existe numa delas, ou que muda de lugar,
   é a costura. Comparar por objeto (a rodada anterior) não bastava: dos dois
   lados da junta o objeto é `TRAILER_BODY`. */
const A = scans.fabrica, B = scans.h250;
if (A && B) {
  const stepsOf = (s) => {
    const out = new Map();
    for (let i = 1; i < s.length; i++) {
      if (s[i].x == null || s[i - 1].x == null) continue;
      const d = (s[i].x - s[i - 1].x) * 1000;
      if (Math.abs(d) > 0.05) out.set(s[i].y.toFixed(4), +d.toFixed(4));
    }
    return out;
  };
  const sa = stepsOf(A), sb = stepsOf(B);
  const only = (m, other, tag) => {
    const hits = [...m].filter(([y]) => !other.has(y));
    console.log(`\ndegraus só em ${tag}: ${hits.length}`);
    for (const [y, d] of hits.slice(0, 30)) console.log(`   y ${y}  dx ${d > 0 ? '+' : ''}${d} mm`);
  };
  only(sa, sb, 'fabrica');
  only(sb, sa, 'h250');
  const moved = [...sa].filter(([y, d]) => sb.has(y) && Math.abs(sb.get(y) - d) > 0.05);
  console.log(`\ndegraus que MUDARAM de tamanho: ${moved.length}`);
  for (const [y, d] of moved.slice(0, 30)) console.log(`   y ${y}  ${d} → ${sb.get(y)} mm`);
  /* A fresta: dois raios vizinhos que caem em x muito distantes é chapa
     ABERTA, não perfil. O relevo do friso é 5,20 mm — acima disso não há
     perfil que justifique. */
  for (const [tag, s] of Object.entries({ fabrica: A, h250: B })) {
    const gaps = [];
    for (let i = 1; i < s.length; i++) {
      if (s[i].x == null || s[i - 1].x == null) continue;
      const d = Math.abs(s[i].x - s[i - 1].x) * 1000;
      if (d > 5.2) gaps.push(`y ${s[i].y} salto de ${d.toFixed(2)} mm`);
    }
    console.log(`saltos acima do relevo do friso em ${tag}: ${gaps.length}`);
    for (const g of gaps.slice(0, 12)) console.log('   ', g);
  }
}

await browser.close();
await new Promise((ok) => server.close(ok));
console.log('pronto →', OUT);
