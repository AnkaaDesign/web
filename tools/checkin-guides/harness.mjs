/* Arnês comum das bancadas de GUIA DE FOTO.
   ---------------------------------------------------------------------------
   Irmão de `trailer-bench/shoot-door.mjs`, extraído porque aqui são DUAS
   bancadas (o inventário e os renders) e copiar o servidor duas vezes é como o
   `shoot.mjs` original acabou com `/home/kennedy/...` no corpo.

   Três origens numa porta só — a página, o bundle esbuild do probe e
   `web/public` na raiz (é de lá que saem `/models/vehicles/trailer.glb` e
   `/vendor/draco/`). Mesma origem para tudo: sem isso o `GLTFLoader` falha por
   CORS e `toDataURL()` lança por canvas contaminado.

   Sobre o Chromium: o `headless_shell` do Playwright NÃO serve (vem sem pilha
   de GPU). Procuramos o Chrome for Testing do cache, e no macOS ele mora dentro
   de um `.app` — caminho que o `findChromium()` da bancada da porta não
   conhecia, porque aquela bancada nasceu em Linux. */
import { createServer } from 'node:http';
import { stat, readdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
export const WEB = resolve(HERE, '..', '..');
export const PUBLIC = join(WEB, 'public');
export const TOOL = HERE;

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
    join(home, 'Library', 'Caches', 'ms-playwright'),
  ];
  const rels = [
    ['chrome-win64', 'chrome.exe'],
    ['chrome-win', 'chrome.exe'],
    ['chrome-linux64', 'chrome'],
    ['chrome-linux', 'chrome'],
    ['chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'],
    ['chrome-mac', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'],
    ['chrome-mac-arm64', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
    ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
  ];
  for (const root of roots) {
    let entries;
    try { entries = await readdir(root); } catch { continue; }
    const builds = entries.filter((d) => /^chromium-\d+$/.test(d))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const b of builds) {
      for (const rel of rels) {
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

const safeJoin = (root, rel) => {
  const p = resolve(root, '.' + rel);
  return (p === root || p.startsWith(root + sep)) ? p : null;
};

/**
 * Empacota `probe`, sobe o servidor, abre o Chromium e espera `window.__ready`.
 * Devolve `{ page, close }` — quem chama é dono do que fizer com a página.
 */
export async function openBench(probe, { width = 1280, height = 860, timeout = 300000 } = {}) {
  const esbuild = await loadEsbuild();
  const { chromium } = await import('playwright-core');

  const built = await esbuild.build({
    entryPoints: [join(HERE, probe)],
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

  const HTML = `<!doctype html><meta charset="utf-8"><title>${probe}</title>
<style>html,body{margin:0;background:#151719}canvas{display:block}</style>
<script type="module" src="/probe.js"></script>`;

  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    try {
      if (path === '/' || path === '/index.html') {
        res.writeHead(200, { 'content-type': MIME['.html'] });
        return res.end(HTML);
      }
      if (path === '/probe.js') {
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

  const browser = await chromium.launch({
    executablePath: await findChromium(),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--disable-gpu-sandbox', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('console', (m) => console.log('  [browser]', m.type(), m.text()));
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', null, { timeout });

  const err = await page.evaluate('window.__error || null');
  if (err) {
    console.log('\n!! ERRO NA PÁGINA:\n' + err);
    await browser.close();
    await new Promise((ok) => server.close(ok));
    process.exit(1);
  }

  return {
    page,
    close: async () => {
      await browser.close();
      await new Promise((ok) => server.close(ok));
    },
  };
}
