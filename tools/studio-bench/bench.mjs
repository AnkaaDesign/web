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
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-estudio.mjs
                                                    # o caminhão de verdade, na placa

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
  /* ⚠️ `.mp4` ENTROU COM A VINHETA DE ENCERRAMENTO (2026-08-16), e a falta dele
     não dava 404 — dava `application/octet-stream`, com o qual o `<video>` lê os
     metadados e NUNCA chega a `canplaythrough`. O sintoma foi uma gravação
     inteira preta, porque a espera pelo evento que não vinha acontecia no meio
     da preparação, com o laço já parado. Um tipo errado é pior que um arquivo
     ausente: ele passa por meio-certo. */
  '.mp4': 'video/mp4', '.webm': 'video/webm',
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
    /* `DEV` FALSO, e a escolha é deliberada: a bancada valida a FORMA QUE
       SOBE, e o que sobe é o build de produção. Com `DEV` verdadeiro ela
       exercitaria o bloco de diagnóstico do painel de qualidade — que em
       produção o Rollup remove da árvore — e passaria a garantir um caminho que
       nenhum usuário executa.
       Vale acrescentar `import.meta.env.DEV: 'true'` à mão para depurar o outro
       ramo. Ver a nota de `buildQualitySection()` em ui/hud.ts. */
    define: {
      'import.meta.env.VITE_STUDIO_ASSETS_BASE': '"/studio-assets/v1"',
      'import.meta.env.DEV': 'false',
    },
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
      } else if (path.startsWith('/vendor/') || path.startsWith('/fonts/')
        /* `/branding/` entrou em 2026-08-16 com a MARCA D'ÁGUA do vídeo. Como o
           decodificador Draco e as fontes, o logotipo é servido pelo WEB e não
           pela árvore do studio (ver `BRAND_LOGO` em `core/paths.ts`) — uma
           bancada que não o servisse faria toda gravação sair com a ressalva "a
           marca d'água não pôde ser carregada", que é o caminho de degradação
           passando por certo e escondendo o que se queria medir. */
        || path.startsWith('/branding/')) {
        file = safeJoin(join(WEB, 'public'), path);
      }
      if (!file) { res.writeHead(404); return res.end('404'); }
      const s = await stat(file);
      /* ---------------- REQUISIÇÃO PARCIAL (HTTP Range) ----------------
         ⚠️ ENTROU COM A VINHETA DE ENCERRAMENTO (2026-08-16), e a falta dela não
         dava erro nenhum: dava um `<video>` com `readyState 4`, a duração certa,
         e **`seekable` vazio** — ou seja, `currentTime = 3` era silenciosamente
         aparado para 0. O laço offline da vinheta busca quadro a quadro, então o
         fecho saía CONGELADO no primeiro quadro, sete segundos de fundo parado.

         Um navegador só habilita a busca em mídia quando o servidor anuncia
         `Accept-Ranges` — ter o arquivo inteiro em memória não basta. Todo host
         estático de verdade (o Vite, o Nginx da API) responde a Range; uma
         bancada que não respondesse mediria um comportamento que a produção não
         tem, que é exatamente o que ela existe para não fazer. */
      const tipo = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (range) {
        const ini = range[1] ? Number(range[1]) : 0;
        const fim = range[2] ? Math.min(Number(range[2]), s.size - 1) : s.size - 1;
        if (ini >= s.size || fim < ini) {
          res.writeHead(416, { 'content-range': `bytes */${s.size}` });
          return res.end();
        }
        res.writeHead(206, {
          'content-type': tipo,
          'content-length': fim - ini + 1,
          'content-range': `bytes ${ini}-${fim}/${s.size}`,
          'accept-ranges': 'bytes',
          'access-control-allow-origin': '*',
        });
        return createReadStream(file, { start: ini, end: fim }).pipe(res);
      }
      res.writeHead(200, {
        'content-type': tipo,
        'content-length': s.size,
        'accept-ranges': 'bytes',
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
   ferramenta interna é uma razão a menos para ela parar de rodar.

   O shell é PROCURADO no cache, não cravado: o caminho antigo apontava a build
   1234 do macOS e a bancada só rodava naquela máquina — a mesma armadilha que
   `trailer-bench/shoot-door.mjs` já tinha matado do lado do Playwright. */
import { readdirSync, statSync } from 'node:fs';

function findShell() {
  const home = process.env.USERPROFILE || process.env.HOME;
  const roots = [
    join(home, 'Library', 'Caches', 'ms-playwright'),
    join(home, '.cache', 'ms-playwright'),
    join(home, 'AppData', 'Local', 'ms-playwright'),
  ];
  for (const root of roots) {
    let entries = [];
    try { entries = readdirSync(root); } catch { continue; }
    const builds = entries.filter((d) => /^chromium_headless_shell-\d+$/.test(d))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const b of builds) {
      for (const rel of [
        ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell'],
        ['chrome-headless-shell-mac-x64', 'chrome-headless-shell'],
        ['chrome-headless-shell-linux64', 'chrome-headless-shell'],
        ['chrome-linux', 'headless_shell'],
        ['chrome-linux64', 'headless_shell'],
        ['chrome-headless-shell-win64', 'chrome-headless-shell.exe'],
        ['chrome-win64', 'chrome-headless-shell.exe'],
      ]) {
        const p = join(root, b, ...rel);
        try { statSync(p); return p; } catch { /* próximo */ }
      }
    }
  }
  throw new Error('chrome-headless-shell não encontrado no cache do Playwright');
}
const SHELL = findShell();

/* SwiftShader é o padrão porque é o que roda em QUALQUER máquina — inclusive um
   CI sem placa. Mas ele é um rasterizador de software: o implemento de verdade
   (2 151 malhas, 5,4 M triângulos) leva minutos por quadro nele, e é por isso
   que `--geometry` existe com um aviso e que o padrão é uma caixa.

   `--gpu` troca o backend para a placa da máquina via ANGLE/OpenGL. MEDIDO
   nesta estação (Radeon RX 570): o mesmo quadro que o SwiftShader não fecha sai
   a ~36 fps, o que é a diferença entre "dá para olhar a cena" e "não dá". Use-o
   para julgar APARÊNCIA — luz, chão, reflexo — e deixe o padrão para as
   verificações de fato, que não dependem de placa e têm de rodar em todo lugar.

   `--use-angle=gl` e não `vulkan`: os dois funcionam aqui, mas o caminho GL é o
   que o Chromium usa em desktop Linux quando a placa é aceita, ou seja é o mais
   próximo do que o usuário final vê. */
/* ---------------- E O CAMINHO SEM TELA NENHUMA (2026-08-14) ----------------
   O parágrafo acima está certo para uma estação com X. Numa máquina headless
   com Mesa — este servidor, um CI com placa, um contêiner — `--use-angle=gl`
   devolve **WebGL2 indisponível**, e o Chromium cai calado no llvmpipe: a
   bancada roda, relata `renderer` de software e mede um fps que não responde
   pergunta nenhuma.

   MEDIDO aqui, nas quatro combinações, com uma sonda de uma página:

     --use-gl=egl                       webgl2: false
     --ozone-platform=headless --use-gl=egl   webgl2: false
     --use-angle=vulkan                 ANGLE (AMD, Vulkan … RADV RAVEN)   ✔
     --use-angle=gles-egl               ANGLE (AMD, radeonsi raven ACO)    ✔

   `gles-egl` é o que se adota quando alguém pede, porque ele expõe também
   `ASTC` e `KHR_parallel_shader_compile`, que o caminho Vulkan não expôs.

   ⚠️ O PADRÃO NÃO MUDOU, de propósito: quem tem X continua recebendo
   `--use-angle=gl`, que é o que o Chromium de desktop Linux usa de verdade e
   portanto o mais próximo do que o usuário final vê. O caminho headless é uma
   ESCOLHA explícita, por variável de ambiente, porque ele é menos representativo
   e não deve virar o padrão de ninguém sem querer.

     STUDIO_BENCH_GPU_ARGS='--use-gl=angle --use-angle=gles-egl --enable-gpu --ignore-gpu-blocklist' \
       node tools/studio-bench/bench.mjs --gpu --geometry

   E o `DISPLAY` abaixo: com a variável definida, `browserEnv()` não inventa o
   `:1`, então basta exportar `DISPLAY=` vazio — ou usar a variável acima, que é
   o caminho documentado. */
const GPU_ARGS = process.env.STUDIO_BENCH_GPU_ARGS
  ? process.env.STUDIO_BENCH_GPU_ARGS.split(/\s+/).filter(Boolean)
  : ['--use-gl=angle', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist'];
const SOFT_ARGS = ['--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader'];

/* DISPLAY SÓ QUANDO ELE EXISTE, e só no caminho da placa.
   `DISPLAY: process.env.DISPLAY || ':1'` era o atalho da estação que tem um X
   naquele número. Fora dela — sessão por SSH, CI, este contêiner — o `:1` é um
   socket que não existe, e o ANGLE responde com

     Could not create a WebGL context, VENDOR = 0x1002, DEVICE = 0x15d8 …
     ErrorMessage = BindToCurrentSequence failed

   ou seja: um erro que nomeia a PLACA quando o que falta é a tela, e que
   aparece ATÉ no caminho de software, onde nenhuma das duas é necessária. O
   SwiftShader não abre display nenhum; quem precisa de um é `--gpu`, e para
   esse o `:1` continua sendo o palpite útil. */
function browserEnv() {
  const env = { ...process.env };
  if (flag('gpu') && !env.DISPLAY) env.DISPLAY = ':1';
  return env;
}

async function launch() {
  const proc = spawn(SHELL, [
    '--headless', '--no-sandbox', '--hide-scrollbars',
    '--remote-debugging-port=0', '--window-size=1440,900',
    /* Sem um destes o headless não tem WebGL2 e o engine morre no
       `new WebGLRenderer()`, que roda no tempo de import. */
    ...(flag('gpu') ? GPU_ARGS : SOFT_ARGS),
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'], env: browserEnv() });

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
/* A LINHA DE COMANDO CHEGA À PÁGINA, e é por isso que um check pode ser
   PARAMETRIZADO. Sem isto, um check que precise rodar em lotes (a frota da
   placa são 47 cabines, ~50 s cada, muito além de qualquer prazo razoável numa
   corrida só) só tinha um caminho: editar o arquivo entre as corridas. `argv` é
   o array cru, e o check lê com o helper que quiser:

       const marca = (window.__benchArgv || []).includes('--marca')
         ? window.__benchArgv[window.__benchArgv.indexOf('--marca') + 1] : null;

   Não muda nada para quem não lê — é uma variável a mais no escopo global da
   página de teste. */
async function evalIn(send, session, expr) {
  const argv = JSON.stringify(ARGV);
  const r = await send('Runtime.evaluate', {
    expression: `(async () => { window.__benchArgv = ${argv}; ${expr} })()`,
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
    if (m.method === 'Runtime.consoleAPICalled'
      && (m.params.type === 'error' || flag('verbose'))) {
      logs.push(`[${m.params.type}] `
        + m.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  });

  await send('Page.enable', {}, sessionId).catch(() => {});
  await send('Runtime.evaluate', { expression: `location.href = '${server.url}'` }, sessionId);

  /* `--checks arquivo.mjs` roda OUTRA sequência no lugar da padrão — é o que
     permite usar a mesma bancada para investigações pontuais (o resize, por
     exemplo) sem inchar o checks.mjs de verificação de regressão. */
  const checks = await readFile(join(HERE, opt('checks', 'checks.mjs')), 'utf8');
  const ready = await evalIn(send, sessionId,
    'return await new Promise(r => { const t=setInterval(()=>{ if(window.__bench){clearInterval(t);r(true);} },100); setTimeout(()=>{clearInterval(t);r(false);},30000); });');
  if (!ready) {
    /* O console da página SAI JUNTO. A mensagem manda olhá-lo, e até aqui não
       havia por onde: os `console.error` da página estão coletados em `logs`,
       que só era impresso depois do relatório — ou seja, nunca no caminho em
       que o boot falha, que é justamente quando eles são a única pista. */
    if (logs.length) {
      console.error('console da página:');
      for (const l of logs.slice(-40)) console.error('   ', l);
    } else {
      console.error('(o console da página não registrou erro nenhum —'
        + ' tente --verbose para ver todas as linhas)');
    }
    throw new Error('__bench não apareceu — o boot falhou (veja o console da página)');
  }

  const report = await evalIn(send, sessionId, checks);

  let bad = 0;
  for (const [name, value] of report) {
    /* Um valor `data:image/...` é uma IMAGEM produzida pelo check — vai para o
       disco, não para o terminal (um dataURL de 2 MB no stdout não informa). */
    if (typeof value === 'string' && value.startsWith('data:image/')) {
      const ext = value.startsWith('data:image/webp') ? '.webp' : '.png';
      const file = join(HERE, 'shots', name.replace(/[^\w.-]+/g, '_') + ext);
      await (await import('node:fs/promises')).mkdir(join(HERE, 'shots'), { recursive: true });
      await writeFile(file, Buffer.from(value.split(',')[1], 'base64'));
      console.log(`  =    ${name} → ${file}`);
      continue;
    }
    /* ---- VÍDEO, pelo mesmo motivo e com um a mais (2026-08-15) ----
       O gravador passou a montar o arquivo à mão (WebCodecs + mediabunny), e
       validar isso DENTRO do navegador que o produziu é fraco: se o carimbo de
       tempo estiver errado por um fator de 10⁶, o mesmo motor que escreveu o
       erro é quem leria o arquivo de volta. Gravando em disco, o juiz passa a
       ser externo — `ffprobe -show_entries stream=r_frame_rate,nb_frames`. */
    if (typeof value === 'string' && value.startsWith('data:video/')) {
      const ext = /mp4/.test(value.slice(0, 30)) ? '.mp4' : '.webm';
      const file = join(HERE, 'shots', name.replace(/[^\w.-]+/g, '_') + ext);
      await (await import('node:fs/promises')).mkdir(join(HERE, 'shots'), { recursive: true });
      const bytes = Buffer.from(value.split(',')[1], 'base64');
      await writeFile(file, bytes);
      console.log(`  =    ${name} → ${file} (${(bytes.length / 1048576).toFixed(2)} MB)`);
      continue;
    }
    const info = value === true || value === false ? '' : ' → ' + JSON.stringify(value);
    if (value === false) bad++;
    console.log(`  ${value === true ? 'ok  ' : value === false ? 'FALHA' : '=   '} ${name}${info}`);
  }
  if (logs.length) {
    console.log('\nconsole da página:');
    for (const l of logs.slice(-40)) console.log('   ', l);
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
