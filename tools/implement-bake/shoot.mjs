/* RETRATO DO ARQUIVO — o GLB carregado pelo `GLTFLoader` de verdade, sem engine.
   ---------------------------------------------------------------------------
   `tools/trailer-bench/` fotografa o implemento RODANDO o código do engine
   (`swapTrailerWheels()`, `TrailerBody`…) e é a medida certa para aparência de
   CENA. Esta aqui é a contraparte barata e de propósito burra: ela responde
   "o que tem dentro do arquivo", que é a pergunta de quem acabou de assar um
   bake e precisa saber se o material colou antes de gastar uma rodada de app.

   Serve tudo de UMA origem (a página, `three` de `node_modules/`, `/vendor/draco/`
   e a pasta do modelo) porque sem isso o `GLTFLoader` falha por CORS e o
   `toDataURL()` lança por canvas contaminado — a mesma armadilha registrada no
   README de `tools/trailer-bench/`.

   O renderizador nasce com `preserveDrawingBuffer: true`. Sem isso
   `domElement.toDataURL()` devolve branco (ver o GOTCHA em
   [[truck-studio-bake-fixes-2026-08-11]]); o estúdio não o liga, e por isso a
   foto na bancada dele passa por `captureViewport()`.

   USO
       node tools/implement-bake/shoot.mjs <glb|gltf> [dir] [pbr|color] [tag]
*/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);
const { chromium } = require_('playwright-core');

const S = path.dirname(new URL(import.meta.url).pathname);
/* A raiz do web — este arquivo mora em `web/tools/implement-bake/`. */
const WEB = path.resolve(S, '../..');
const modelPath = process.argv[2];
const outDir = process.argv[3] || path.join(S, 'shots');
const mode = process.argv[4] || 'pbr';
const tag = process.argv[5] || path.basename(modelPath).replace(/\.[^.]+$/, '');
fs.mkdirSync(outDir, { recursive: true });

const modelDir = path.dirname(path.resolve(modelPath));
const modelFile = path.basename(modelPath);
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.bin': 'application/octet-stream', '.wasm': 'application/wasm' };

const server = http.createServer((req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = null;
  if (u === '/' || u === '/index.html') file = path.join(S, 'page.html');
  else if (u.startsWith('/three/')) file = path.join(WEB, 'node_modules/three', u.slice(7));
  else if (u.startsWith('/vendor/')) file = path.join(WEB, 'public/vendor', u.slice(8));
  else if (u.startsWith('/model/')) file = path.join(modelDir, u.slice(7));
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nope ' + u); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROME || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-lcd-text'],
});
const page = await browser.newPage({ viewport: { width: 1300, height: 760 } });
page.on('console', m => { const t = m.text(); if (!/Download the React|three\.js/.test(t)) console.log('  [page]', t); });
page.on('pageerror', e => console.log('  [pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/?w=1280&h=720`);
await page.waitForFunction('window.__ready === true', null, { timeout: 60000 });
const r = await page.evaluate(async ([u, m]) => await window.__shoot(u, m),
  [`/model/${encodeURIComponent(modelFile)}`, mode]);
for (const [k, data] of Object.entries(r.shots)) {
  fs.writeFileSync(path.join(outDir, `${tag}-${mode}-${k}.png`), Buffer.from(data.split(',')[1], 'base64'));
}
console.log('bbox', JSON.stringify(r.bbox));
console.log('groups', r.groups.length);
r.groups.forEach(g => console.log('  ', g.name, g.meshes));
await browser.close(); server.close();
