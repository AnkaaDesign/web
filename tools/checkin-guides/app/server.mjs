/* Servidor do app de teste dos guias de foto.
   ---------------------------------------------------------------------------
   Três coisas numa porta só:

     /                     a página (app/)
     /guias/...            a saída de `shoot.mjs` (guia/, render/, manifest.json)
     /api/...              proxy para a API do Ankaa

   O PROXY EXISTE PARA NÃO MENTIR SOBRE CORS. Servir a página de `file://` ou de
   outra origem e chamar a API direto funcionaria só enquanto a API estivesse
   com CORS aberto para essa origem — e a de produção não está. Com o proxy, o
   navegador só conversa com este servidor; quem fala com a API é o node, que
   não tem política de origem. O token vai e volta pelo header `Authorization`
   normalmente: este servidor não guarda credencial nenhuma.

   Uso:
     node tools/checkin-guides/app/server.mjs
     ANKAA_API=https://api.ankaadesign.com.br node .../server.mjs --port 8130

   O padrão aponta para o IP da LAN (192.168.10.180:3030), que é a MESMA API de
   produção — ver a nota de acesso ao servidor. Trocar por `localhost:3030` roda
   contra a API local. */
import { createServer } from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, extname, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOL = resolve(HERE, '..');
const WEB = resolve(TOOL, '..', '..');
const GUIAS = process.env.GUIAS_DIR || join(WEB, 'public', 'guias-foto');

const argv = process.argv.slice(2);
const optNum = (k, d) => {
  const i = argv.indexOf('--' + k);
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : d;
};
const PORT = optNum('port', 8130);
const API = (process.env.ANKAA_API || 'http://192.168.10.180:3030').replace(/\/+$/, '');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};

const safeJoin = (root, rel) => {
  const p = resolve(root, '.' + rel);
  return (p === root || p.startsWith(root + sep)) ? p : null;
};

async function sendFile(res, file) {
  const s = await stat(file);
  res.writeHead(200, {
    'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
    'content-length': s.size,
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
}

/** Corpo cru da requisição, para repassar POST/PATCH sem interpretar. */
function body(req) {
  return new Promise((ok, err) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => ok(Buffer.concat(chunks)));
    req.on('error', err);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = decodeURIComponent(url.pathname);

  try {
    /* ---- proxy da API ---------------------------------------------------- */
    if (path === '/api' || path.startsWith('/api/')) {
      const alvo = API + path.slice(4) + url.search;
      const headers = {};
      for (const h of ['authorization', 'content-type', 'accept', 'range']) {
        if (req.headers[h]) headers[h] = req.headers[h];
      }
      const init = { method: req.method, headers };
      if (!['GET', 'HEAD'].includes(req.method)) init.body = await body(req);
      let up;
      try {
        up = await fetch(alvo, init);
      } catch (e) {
        res.writeHead(502, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ erro: 'API inalcançável', alvo, detalhe: String(e) }));
      }
      const out = {};
      for (const [k, v] of up.headers) {
        if (['content-encoding', 'transfer-encoding', 'connection'].includes(k)) continue;
        out[k] = v;
      }
      res.writeHead(up.status, out);
      return res.end(Buffer.from(await up.arrayBuffer()));
    }

    /* ---- guias ----------------------------------------------------------- */
    if (path.startsWith('/guias/')) {
      const f = safeJoin(GUIAS, path.slice(6));
      if (!f) { res.writeHead(404); return res.end('404'); }
      return await sendFile(res, f);
    }

    /* ---- as regras de mapeamento, servidas do MESMO módulo do disparador --- */
    if (path === '/regras.mjs') {
      const src = await readFile(join(TOOL, 'poses.mjs'), 'utf8');
      res.writeHead(200, { 'content-type': MIME['.mjs'], 'cache-control': 'no-store' });
      return res.end(src);
    }

    /* ---- página ---------------------------------------------------------- */
    const rel = path === '/' ? '/index.html' : path;
    const f = safeJoin(HERE, rel);
    if (!f) { res.writeHead(404); return res.end('404'); }
    return await sendFile(res, f);
  } catch (e) {
    res.writeHead(e?.code === 'ENOENT' ? 404 : 500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(String(e?.message || e));
  }
});

server.listen(PORT, () => {
  console.log(`app dos guias  → http://127.0.0.1:${PORT}`);
  console.log(`  guias        ← ${GUIAS}`);
  console.log(`  API (proxy)  → ${API}`);
});
