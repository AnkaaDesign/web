/* Exporta o KIT DA PORTA para `models/vehicles/porta_kit_v1.glb`.
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
const OUT = join(HERE, 'shots-kit');
/** O `.glb` sob julgamento, relativo a `public/models/vehicles/`. */
/** De QUEM sai o kit. O padrão é o semirreboque, que é o bake COMPLETO — o
 *  sobrechassi tem 2 varões em vez de 4 e metade da ferragem não existe nele. */
const SRC = process.argv[2] || 'semirreboque_frigorifico_paleteiro.glb';
/** Para onde vai o asset. */
const DEST = process.argv[3] || join(PUBLIC, 'models', 'vehicles', 'porta_kit_v1.glb');

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
  entryPoints: [join(HERE, 'kitexport.ts')],
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

const HTML = `<!doctype html><meta charset="utf-8"><title>kitexport</title>
<style>html,body{margin:0;background:#222}canvas{display:block}</style>
<script type="module" src="/kitexport.js"></script>`;

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
    if (path === '/kitexport.js') {
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
await page.goto(`${url}?src=${encodeURIComponent(SRC)}`, { waitUntil: 'load' });
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
console.log('\n===== INVENTÁRIO DO KIT =====');
const diag = await page.evaluate('window.__diag || null');
console.log(JSON.stringify(diag, null, 1));

const glb = await page.evaluate('window.__glb || null');
if (!glb) {
  console.log('!! o exportador não devolveu bytes');
} else {
  const bytes = Buffer.from(glb.split(',')[1], 'base64');
  await writeFile(DEST, bytes);
  console.log(`\nESCRITO ${DEST}  ${(bytes.length / 1024).toFixed(0)} kB`);
}

await browser.close();
await new Promise((ok) => server.close(ok));
