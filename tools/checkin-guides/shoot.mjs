/* Dispara o jogo de guias e escreve PNG + manifesto.
   ---------------------------------------------------------------------------
   Saída (padrão `web/public/guias-foto/`, para o app standalone servir da
   mesma origem):

     guias-foto/guia/<pose>.png     desenho de linha, branco pré-multiplicado
     guias-foto/render/<pose>.png   sombreado, fundo transparente
     guias-foto/manifest.json       poses, rótulos, regras e metadados de câmera

   Opções:
     --out <dir>     raiz de saída
     --only <regex>  filtra por nome de pose
     --kind guide|shaded|both
     --length <m>    redimensiona o baú antes (TrailerRig.set) — o guia de um
                     truck de 9 m não é o de uma carreta de 14,7 m
     --tag <sufixo>  sufixo de diretório, para guardar uma leva sem sobrescrever */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { openBench, WEB, TOOL } from './harness.mjs';
import { buildPoses, REGRAS } from './poses.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf('--' + k);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};

const tag = opt('tag', '');
const OUT = opt('out', join(WEB, 'public', 'guias-foto' + (tag ? '-' + tag : '')));
const only = opt('only', null);
const kind = opt('kind', 'both');
const length = opt('length', null);

let poses = buildPoses();
if (only) {
  const re = new RegExp(only, 'i');
  poses = poses.filter((p) => re.test(p.name));
}
if (!poses.length) { console.error('nenhuma pose casou com', only); process.exit(1); }

await mkdir(join(OUT, 'guia'), { recursive: true });
await mkdir(join(OUT, 'render'), { recursive: true });

/* O quadro maior do jogo: a página é dimensionada uma vez e o rig só troca o
   tamanho do renderer. Um viewport menor que o canvas não corta nada (o canvas
   é offscreen para efeito de leitura), mas manter os dois coerentes evita
   surpresa de `devicePixelRatio`. */
const { page, close } = await openBench('guide-rig.ts', { width: 1200, height: 800 });

const diag = await page.evaluate('window.__diag');
console.log('\n===== CLASSIFICAÇÃO =====');
console.log(JSON.stringify(diag, null, 1));

let dims = await page.evaluate('window.__dims');
if (length) {
  dims = await page.evaluate((L) => window.__setDims({ length: L }), Number(length));
  console.log('redimensionado →', JSON.stringify(dims));
}

const png = (dataUrl) => Buffer.from(String(dataUrl).split(',')[1], 'base64');
const feitas = [];

/* As soluções de câmera já resolvidas, por nome de pose. É daqui que sai a
   SIMETRIA: `espelhoDe` não re-resolve nada, ele troca o sinal do X da câmera e
   da mira da pose base. Duas fotos do "mesmo ângulo" em lados opostos passam a
   ter a mesma distância, a mesma altura e o mesmo FOV por construção — e não
   por dois ajustes independentes convergirem para números parecidos.

   `--only` pode deixar uma pose base de fora; nesse caso o espelho é resolvido
   sozinho e AVISA, porque a garantia de simetria se perdeu. */
const solucoes = new Map();
const espelha = (c) => ({
  dist: c.dist, fov: c.fov,
  aim: [-c.aim[0], c.aim[1], c.aim[2]],
  pos: [-c.pos[0], c.pos[1], c.pos[2]],
});

for (let p of poses) {
  const t0 = Date.now();
  let cam = null;
  if (p.espelhoDe) {
    const base = solucoes.get(p.espelhoDe);
    if (base) cam = espelha(base);
    else console.warn(`  ! ${p.name}: base ${p.espelhoDe} não foi disparada — ajustando sozinha, SEM garantia de simetria`);
  } else if (p.mesmaDistanciaQue) {
    const base = solucoes.get(p.mesmaDistanciaQue);
    if (base) p = { ...p, dist: base.dist };
    else console.warn(`  ! ${p.name}: base ${p.mesmaDistanciaQue} não foi disparada — distância própria`);
  }
  const r = await page.evaluate(([pose, k, c]) => window.__shot(pose, k, c), [p, kind, cam]);
  solucoes.set(p.name, r.meta);
  if (r.guide) await writeFile(join(OUT, 'guia', p.name + '.png'), png(r.guide));
  if (r.shaded) await writeFile(join(OUT, 'render', p.name + '.png'), png(r.shaded));
  feitas.push({
    name: p.name, grupo: p.grupo, lado: p.lado, ordem: p.ordem, rotulo: p.rotulo,
    espelhoDe: p.espelhoDe ?? null,
    w: p.w, h: p.h, azDeg: p.azDeg, camY: p.camY, fovLongDeg: p.fovLongDeg,
    camera: r.meta,
    guia: `guia/${p.name}.png`, render: `render/${p.name}.png`,
  });
  const marca = p.espelhoDe ? 'espelho' : p.mesmaDistanciaQue ? 'd herdada' : 'ajuste';
  console.log(`shot ${p.name.padEnd(28)} ${String(p.w) + 'x' + p.h} d=${r.meta.dist.toFixed(2)}m x=${r.meta.pos[0].toFixed(2)} ${marca.padEnd(9)} ${Date.now() - t0}ms`);
}

await close();

/* O manifesto é MESCLADO, não sobrescrito.
   `--only` dispara um recorte, e escrever só o que foi disparado apagaria as
   outras poses do manifesto enquanto os PNGs delas continuam no disco — um
   estado em que o app mostra menos fotos do que existem e nada indica por quê.
   As poses redisparadas substituem as antigas; a ordem é a de `buildPoses()`,
   que é a ordem em que o operador fotografa. */
let anterior = null;
try {
  anterior = JSON.parse(await readFile(join(OUT, 'manifest.json'), 'utf8'));
} catch { /* primeira leva */ }

const porNome = new Map((anterior?.poses ?? []).map((p) => [p.name, p]));
for (const f of feitas) porNome.set(f.name, f);
const ordem = new Map(buildPoses().map((p, i) => [p.name, i]));
const todas = [...porNome.values()]
  .filter((p) => ordem.has(p.name))
  .sort((a, b) => ordem.get(a.name) - ordem.get(b.name));

await writeFile(join(OUT, 'manifest.json'), JSON.stringify({
  gerado: new Date().toISOString(),
  modelo: 'models/vehicles/trailer.glb',
  dims: dims ?? anterior?.dims,
  regras: REGRAS.map((r) => ({
    grupos: r.grupos, re: r.re.source, mais: r.mais ? r.mais.source : null,
  })),
  poses: todas,
}, null, 1));
if (todas.length !== feitas.length) {
  console.log(`manifesto mesclado: ${feitas.length} redisparadas, ${todas.length} no total`);
}

console.log('\npronto →', OUT);
console.log('(inventário do modelo em', join(TOOL, 'inventario.json') + ')');
