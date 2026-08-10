/* Bancada do Truck Studio — sobe o engine num navegador de verdade e mede.
   ===========================================================================
   POR QUE ELA EXISTE. Quase tudo que o estúdio faz é invisível para o `tsc` e
   para o vitest: o laço de render constrói um `WebGLRenderer` no tempo de
   IMPORT, então nenhum módulo de `scene/**` pode sequer ser importado sob jsdom.
   O resultado prático é que o rig de luz, a órbita, o ciclorama e a captura —
   ou seja, o produto — não tinham como ser verificados a não ser abrindo o app
   e olhando.

   O QUE ELA NÃO É: um substituto para olhar. Ela responde perguntas de FATO
   ("o piso de distância entrou?", "o PNG saiu com alfa?", "a face do HUD
   trocou?"), não perguntas de gosto ("a luz ficou bonita?").

   COMO RODAR

       node tools/studio-bench/bench.mjs            # roda e imprime o relatório
       node tools/studio-bench/bench.mjs --keep     # deixa o servidor de pé
       node tools/studio-bench/bench.mjs --shot x.png   # e salva um print

   Ela reusa três decisões de `tools/studio-render/serve.mjs`, e o cabeçalho de
   lá as explica: esbuild vindo do vite (para não acrescentar dependência), o
   alias `@` (o engine importa `@/config/assets` e nada mais de fora) e TUDO na
   MESMA ORIGEM (o GLTFLoader pede com `crossOrigin=anonymous`, e um canvas lido
   de volta com textura de outra origem contamina o buffer).

   DUAS DIFERENÇAS EM RELAÇÃO ÀQUELA BANCADA, e as duas importam:

   1. A raiz de assets padrão é `web/public`, não `/srv/studio-assets`. Aqui a
      árvore local basta e ninguém precisa configurar nada para rodar.
   2. `*.glb` e `*.fbx` são BLOQUEADOS. O implemento são 31 MB de Draco sobre
      2 151 malhas, e sob SwiftShader o parse síncrono starva os próprios
      temporizadores do teste — a mesma armadilha já documentada no harness de
      plotagem. O que a bancada mede é função de uma CAIXA, e `boot.ts` põe uma.
      `--geometry` desliga o bloqueio para quem quiser o caminhão de verdade. */
import { createServer } from 'node:http';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const require_ = createRequire(import.meta.url);
const esbuild = require_(require_.resolve('esbuild', {
  paths: [require_.resolve('vite/package.json').replace(/package\.json$/, '')],
}));

const HERE = fileURLToPath(new URL('.', import.meta.url));
const WEB = resolve(HERE, '../..');
const ARGV = process.argv.slice(2);
const flag = (n) => ARGV.includes('--' + n);
const opt = (n, d) => { const i = ARGV.indexOf('--' + n); return i >= 0 ? ARGV[i + 1] : d; };

/* `web/public` e não a árvore da API: a cópia local já tem models/,
   environments/ e textures/, e uma bancada que exige configuração é uma
   bancada que ninguém roda. */
const ASSETS_ROOT = process.env.STUDIO_BENCH_ASSETS || join(WEB, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.hdr': 'image/vnd.radiance',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.bin': 'application/octet-stream',
};

async function bundle() {
  const out = await esbuild.build({
    entryPoints: [join(HERE, 'boot.ts')],
    bundle: true, write: false, format: 'esm', target: 'es2022',
    /* `outdir` é obrigatório assim que um `.css` entra no grafo: o esbuild
       precisa de um caminho para o SEGUNDO arquivo de saída. Com `write:false`
       nada chega ao disco — o caminho só nomeia os `outputFiles`. */
    outdir: HERE,
    sourcemap: 'inline', logLevel: 'warning',
    alias: { '@': join(WEB, 'src') },
    loader: { '.css': 'css' },
    /* As fontes de plotagem são `url('/fonts/livery/…woff2')`, ou seja URLs de
       RAIZ DE SITE — elas não são para o bundler resolver, são para o navegador
       buscar. Sem isto o esbuild tenta achá-las no disco e falha. O servidor
       abaixo serve `/fonts/` de `web/public`, então elas carregam de verdade. */
    external: ['/fonts/*', '/vendor/*'],
    define: { 'import.meta.env.VITE_STUDIO_ASSETS_BASE': '"/studio-assets/v1"' },
  });
  const js = out.outputFiles.find((f) => f.path.endsWith('.js'));
  const css = out.outputFiles.find((f) => f.path.endsWith('.css'));
  return { js: js ? js.text : '', css: css ? css.text : '' };
}

function safeJoin(root, rel) {
  const p = resolve(root, '.' + rel);
  return (p === root || p.startsWith(root + sep)) ? p : null;
}

const PAGE = `<!doctype html><meta charset="utf-8">
<title>Truck Studio — bancada</title>
<link rel="stylesheet" href="/boot.css">
<style>html,body{margin:0;height:100%;background:#1c1c1c}#host{height:100vh}</style>
<div id="host"></div>
<script type="module" src="/boot.js"></script>`;

async function startServer(port = 0) {
  const built = await bundle();
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    try {
      if (path === '/' || path === '/index.html') {
        res.writeHead(200, { 'content-type': MIME['.html'] });
        return res.end(PAGE);
      }
      if (path === '/favicon.ico') { res.writeHead(204); return res.end(); }
      if (path === '/boot.js') {
        res.writeHead(200, { 'content-type': MIME['.js'] });
        return res.end(built.js);
      }
      if (path === '/boot.css') {
        res.writeHead(200, { 'content-type': MIME['.css'] });
        return res.end(built.css);
      }
      let file = null;
      if (path.startsWith('/studio-assets/v1/')) {
        file = safeJoin(resolve(ASSETS_ROOT), '/' + path.slice('/studio-assets/v1/'.length));
      } else if (path.startsWith('/vendor/') || path.startsWith('/fonts/')) {
        file = safeJoin(join(WEB, 'public'), path);
      }
      if (!file) { res.writeHead(404); return res.end('404'); }
      const s = await stat(file);
      res.writeHead(200, {
        'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
        'content-length': s.size,
        /* O MESMO cabeçalho da API (api/src/main.ts). Não é cosmética: o
           pré-aquecimento do `core/prefetch.ts` só compensa se a resposta for
           armazenável, e uma bancada que servisse sem cache mediria um
           comportamento que a produção não tem. */
        'cache-control': extname(file) === '.json'
          ? 'no-cache, must-revalidate' : 'public, max-age=31536000, immutable',
        'access-control-allow-origin': '*',
      });
      createReadStream(file).pipe(res);
    } catch (e) {
      res.writeHead(e?.code === 'ENOENT' ? 404 : 500);
      res.end(String(e?.message || e));
    }
  });
  await new Promise((ok) => server.listen(port, '127.0.0.1', ok));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((ok) => server.close(ok)),
  };
}

/* ---------------- o navegador, por CDP cru ----------------
   Sem Playwright: o `chrome-headless-shell` do cache dele já está no disco, e o
   protocolo que precisamos são quatro comandos. Uma dependência a menos numa
   ferramenta interna é uma razão a menos para ela parar de rodar. */
const SHELL = join(process.env.HOME, 'Library/Caches/ms-playwright'
  + '/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell');

async function launch() {
  const proc = spawn(SHELL, [
    '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--remote-debugging-port=0', '--window-size=1440,900',
    /* SwiftShader: sem isto o headless não tem WebGL2 e o engine morre no
       `new WebGLRenderer()`, que roda no tempo de import. */
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const wsUrl = await new Promise((ok, fail) => {
    let buf = '';
    const t = setTimeout(() => fail(new Error('o navegador não anunciou a porta de depuração')), 20000);
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = /ws:\/\/[^\s]+/.exec(buf);
      if (m) { clearTimeout(t); ok(m[0]); }
    });
  });
  return { proc, wsUrl };
}

function cdp(ws) {
  let id = 0;
  const waiting = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    const w = waiting.get(msg.id);
    if (!w) return;
    waiting.delete(msg.id);
    if (msg.error) w.fail(new Error(msg.error.message));
    else w.ok(msg.result);
  });
  return (method, params = {}, sessionId) => new Promise((ok, fail) => {
    const n = ++id;
    waiting.set(n, { ok, fail });
    ws.send(JSON.stringify({ id: n, method, params, sessionId }));
  });
}

/** Avalia no navegador e devolve o valor. Erros da página viram erros aqui. */
async function evalIn(send, session, expr) {
  const r = await send('Runtime.evaluate', {
    expression: `(async () => { ${expr} })()`,
    awaitPromise: true, returnByValue: true,
  }, session);
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description
      || r.exceptionDetails.text || 'erro na página');
  }
  return r.result.value;
}

async function main() {
  const server = await startServer();
  console.log('bancada em', server.url, '· assets de', ASSETS_ROOT);
  if (flag('keep')) { console.log('(--keep: servidor de pé, Ctrl-C para sair)'); return; }

  const { proc, wsUrl } = await launch();
  const ws = new WebSocket(wsUrl);
  await new Promise((ok) => ws.addEventListener('open', ok, { once: true }));
  const send = cdp(ws);

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId);
  await send('Network.enable', {}, sessionId);
  if (!flag('geometry')) {
    await send('Network.setBlockedURLs', { urls: ['*.glb', '*.fbx'] }, sessionId);
  }
  const logs = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      logs.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  });

  await send('Page.enable', {}, sessionId).catch(() => {});
  await send('Runtime.evaluate', { expression: `location.href = '${server.url}'` }, sessionId);

  const checks = await readFile(join(HERE, 'checks.mjs'), 'utf8');
  const ready = await evalIn(send, sessionId,
    'return await new Promise(r => { const t=setInterval(()=>{ if(window.__bench){clearInterval(t);r(true);} },100); setTimeout(()=>{clearInterval(t);r(false);},30000); });');
  if (!ready) throw new Error('__bench não apareceu — o boot falhou (veja o console da página)');

  const report = await evalIn(send, sessionId, checks);

  let bad = 0;
  for (const [name, value] of report) {
    const ok = value === true;
    const info = value === true || value === false ? '' : ' → ' + JSON.stringify(value);
    if (value === false) bad++;
    console.log(`  ${value === true ? 'ok  ' : value === false ? 'FALHA' : '=   '} ${name}${info}`);
  }
  if (logs.length) {
    console.log('\nconsole.error da página:');
    for (const l of logs.slice(0, 10)) console.log('   ', l);
  }

  const shot = opt('shot', null);
  if (shot) {
    const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    await writeFile(shot, Buffer.from(data, 'base64'));
    console.log('\nprint em', shot);
  }

  ws.close();
  proc.kill();
  await server.close();
  console.log(bad ? `\n${bad} falha(s)` : '\ntudo certo');
  process.exit(bad ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
