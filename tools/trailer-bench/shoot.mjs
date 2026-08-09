/* Serve a bancada, abre no Chromium do Playwright e salva os PNGs. */
import { createServer } from 'node:http';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, extname, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const WEB = '/home/kennedy/repositories/web';
const ASSETS_ROOT = '/srv/studio-assets';
const OUT = join(HERE, 'shots');

const esbuild = (await import(
  WEB + '/node_modules/.pnpm/esbuild@0.25.10/node_modules/esbuild/lib/main.js')).default
  ?? await import(WEB + '/node_modules/.pnpm/esbuild@0.25.10/node_modules/esbuild/lib/main.js');
const { chromium } = await import('/home/kennedy/repositories/api/node_modules/playwright/index.mjs');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.bin': 'application/octet-stream',
};

async function bundle() {
  const out = await esbuild.build({
    entryPoints: [join(HERE, 'probe.ts')],
    bundle: true, write: false, format: 'esm', target: 'es2022',
    sourcemap: 'inline', logLevel: 'warning',
    /* Aliases explícitos: o esbuild resolve `three` a partir do ARQUIVO que
       importa (que mora em /tmp), não do `absWorkingDir`. */
    alias: {
      '@': join(WEB, 'src'),
      three: join(WEB, 'node_modules/three/build/three.module.js'),
      'three/addons': join(WEB, 'node_modules/three/examples/jsm'),
    },
    nodePaths: [join(WEB, 'node_modules')],
    absWorkingDir: WEB,
    define: { 'import.meta.env.VITE_STUDIO_ASSETS_BASE': '"/studio-assets/v1"' },
  });
  return out.outputFiles[0].text;
}

const safeJoin = (root, rel) => {
  const p = resolve(root, '.' + rel);
  return (p === root || p.startsWith(root + sep)) ? p : null;
};

const js = await bundle();
const HTML = `<!doctype html><meta charset="utf-8"><title>wheelcheck</title>
<style>html,body{margin:0;background:#222}canvas{display:block}</style>
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
    let file = null;
    if (path.startsWith('/studio-assets/v1/')) {
      file = safeJoin(resolve(ASSETS_ROOT), '/v1/' + path.slice('/studio-assets/v1/'.length));
    } else if (path.startsWith('/vendor/')) {
      file = safeJoin(join(WEB, 'public'), path);
    }
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
console.log('servindo', url);

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/home/kennedy/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--disable-gpu-sandbox', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 820 } });
page.on('console', (m) => console.log('  [browser]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', null, { timeout: 240000 });

const err = await page.evaluate('window.__error || null');
if (err) { console.log('\n!! ERRO NA PÁGINA:\n' + err); }

const diag = await page.evaluate('window.__diag || null');
console.log('\n===== DIAGNÓSTICO =====');
console.log(JSON.stringify(diag, null, 1));

const SHOTS = [
  ['novo-3-4', 'novo', [1.1, 0.45, 0.8], 0.75],
  ['novo-lateral', 'novo', [1, 0.08, 0.06], 0.8],
  ['escuro-3-4', 'escuro', [1.1, 0.45, 0.8], 0.75],
  ['sonda-semambiente', 'semambiente', [1.1, 0.45, 0.8], 0.75],
  ['sonda-ambientex4', 'ambientex4', [1.1, 0.45, 0.8], 0.75],
  ['sonda-corvermelha', 'corvermelha', [1.1, 0.45, 0.8], 0.75],
  ['original-3-4', 'original', [1.1, 0.45, 0.8], 0.75],
  ['original-lateral', 'original', [1, 0.08, 0.06], 0.8],
];
for (const [name, what, dir, fill] of SHOTS) {
  const data = await page.evaluate(
    ([w, d, f]) => window.__shot(w, d, f), [what, dir, fill]);
  await writeFile(join(OUT, name + '.png'),
    Buffer.from(String(data).split(',')[1], 'base64'));
  const lum = await page.evaluate('window.__lastLum');
  console.log('shot', name, '· borracha:', JSON.stringify(lum));
}

await browser.close();
await new Promise((ok) => server.close(ok));
console.log('pronto →', OUT);
