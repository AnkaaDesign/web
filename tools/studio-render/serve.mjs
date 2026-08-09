/* Servidor da bancada de render — três origens, uma porta.
   ===========================================================================
   O `rig.ts` é código do app: importa `three`, os módulos do engine e o alias
   `@/`. Nada disso roda cru no navegador, então ele é EMPACOTADO por esbuild
   (o mesmo que o vite usa, já em node_modules) e servido como `/rig.js`.

   MESMA ORIGEM PARA TUDO, e não é conveniência. `GLTFLoader` marca os pedidos
   com `crossOrigin="anonymous"`: sem cabeçalho de CORS o carregamento FALHA,
   não só contamina. E o canvas é lido de volta com `toDataURL()` — uma única
   textura de outra origem sem CORS contamina o buffer e a leitura lança. Por
   isso os três caminhos abaixo saem todos daqui:

     /                 a página (index.html)
     /rig.js           o pacote
     /vendor/draco/    o decodificador Draco, de web/public (é o mesmo do app)
     /studio-assets/v1 a árvore de assets, do disco

   A árvore vem do DISCO e não da API de propósito: renderizar 900 imagens
   passando por HTTP+nginx+Nest para ler os mesmos 400 MB é tempo gasto onde
   não há nada a validar. `STUDIO_ASSETS_ROOT` aponta para a raiz que contém
   `v1/`, exatamente como a variável de mesmo nome na API. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

/* esbuild VEM DO VITE, e por isso não está no package.json deste repositório.
   Ele é dependência direta do vite (que é dependência de build daqui), então
   está sempre instalado — mas o pnpm não o iça para a raiz de `node_modules`,
   e um `import 'esbuild'` daqui não o encontra. Resolver a partir do vite é o
   que torna esta bancada instalável com o `pnpm install` que o repositório já
   faz, sem uma dependência nova só para empacotar uma ferramenta interna. */
const require_ = createRequire(import.meta.url);
const esbuild = require_(require_.resolve('esbuild', {
  paths: [require_.resolve('vite/package.json').replace(/package\.json$/, '')],
}));

const HERE = fileURLToPath(new URL('.', import.meta.url));
const WEB = resolve(HERE, '../..');

export const ASSETS_ROOT = process.env.STUDIO_ASSETS_ROOT || '/srv/studio-assets';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.hdr': 'image/vnd.radiance',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.ktx2': 'image/ktx2', '.bin': 'application/octet-stream',
};

/** Empacota `rig.ts`. Um alvo só, um arquivo só, sem minificar — quando algo
 *  quebra dentro do rig, a pilha do navegador tem de apontar para uma linha
 *  legível. */
async function bundle() {
  const out = await esbuild.build({
    entryPoints: [join(HERE, 'rig.ts')],
    bundle: true, write: false, format: 'esm', target: 'es2022',
    sourcemap: 'inline', logLevel: 'warning',
    /* O mesmo alias do vite.config.ts. Só o `@` é preciso: o engine importa
       `@/config/assets` (via core/paths.ts) e nada mais de fora. */
    alias: { '@': join(WEB, 'src') },
    /* `three/addons/*` é um subpath export do pacote three; o esbuild o
       resolve sozinho pelo package.json. Nada a declarar. */
    define: { 'import.meta.env.VITE_STUDIO_ASSETS_BASE': '"/studio-assets/v1"' },
  });
  return out.outputFiles[0].text;
}

/** Impede que um `..` no caminho da URL saia da raiz servida. */
function safeJoin(root, rel) {
  const p = resolve(root, '.' + rel);
  return (p === root || p.startsWith(root + sep)) ? p : null;
}

export async function startServer(port = 0) {
  let js = await bundle();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const path = decodeURIComponent(url.pathname);
    try {
      if (path === '/' || path === '/index.html') {
        const html = await readFile(join(HERE, 'index.html'));
        res.writeHead(200, { 'content-type': MIME['.html'] });
        return res.end(html);
      }
      if (path === '/favicon.ico') {
        /* O Chromium pede o favicon sozinho, e o 404 dele aparecia no console
           da página a cada aba aberta. Um aviso de rede que não significa nada
           treina quem depura a ignorar os que significam. */
        res.writeHead(204);
        return res.end();
      }
      if (path === '/rig.js') {
        res.writeHead(200, { 'content-type': MIME['.js'] });
        return res.end(js);
      }
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
        /* Mesma origem, então nenhum cabeçalho de CORS é necessário — mas o
           `Access-Control-Allow-Origin` fica porque custa nada e torna a
           bancada utilizável a partir de um vite dev server em outra porta. */
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
    /* Re-empacota sem derrubar o servidor — é o que torna afinar a luz um
       ciclo de segundos em vez de um restart. */
    async rebuild() { js = await bundle(); },
    close: () => new Promise((ok) => server.close(ok)),
  };
}
