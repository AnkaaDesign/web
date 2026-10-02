/* Roda `checks-guias-checkin.mjs` para a frota inteira, UM veículo por
   processo (o retorno do CDP não aguenta o jogo todo numa rodada), e junta
   tudo em `public/guias-foto/v2/<veiculo>/<pose>.webp` + `manifest.json`.

       node tools/studio-bench/guias-checkin-lote.mjs
       node tools/studio-bench/guias-checkin-lote.mjs truck carreta-1550:on   # um recorte

   Sequencial de propósito: dois Chromium com o implemento de 21 MB cada não
   cabem juntos nos 8 GB desta máquina. */
import { spawnSync } from 'node:child_process';
import { mkdir, rename, writeFile, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const WEB = resolve(HERE, '../..');
/* `--bau-branco` gera a variante de MÁSCARA em `v2-branco/` */
const BRANCO = process.argv.includes('--bau-branco');
const OUT = join(WEB, 'public', 'guias-foto', BRANCO ? 'v2-branco' : 'v2');
const SHOTS = join(HERE, 'shots');

const TODOS = ['toco', 'truck', 'bitruck',
  'carreta-1450:off', 'carreta-1450:on', 'carreta-1550:off', 'carreta-1550:on'];
const livres = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const pedidos = livres.length ? livres : TODOS;

const manifestPath = join(OUT, 'manifest.json');
let manifest = { gerado: null, camera: {}, veiculos: {} };
try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); } catch { /* novo */ }
manifest.camera = {
  alturaM: 1.60,
  nota: 'pessoa de 1,80 m, celular nivelado na altura do peito; teto: em pé sobre o baú, 1 m da borda traseira',
  lentes: { '1x': { fovLongDeg: 68, usadaEm: 'rígidos' }, '0.5x': { fovLongDeg: 106, usadaEm: 'carretas' } },
  quadro: { paisagem: [1600, 900], retrato: [900, 1600] },
};

for (const p of pedidos) {
  const [veiculo, tk] = p.split(':');
  const args = ['tools/studio-bench/bench.mjs', '--gpu', '--geometry',
    '--checks', 'checks-guias-checkin.mjs', '--veiculo', veiculo];
  if (tk) args.push('--tk', tk);
  if (BRANCO) args.push('--bau-branco', 'on');
  console.log(`\n▶ ${p}`);
  const r = spawnSync('node', args, { cwd: WEB, encoding: 'utf8', maxBuffer: 64 << 20 });
  const txt = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 0 || /FALHA/.test(txt)) { console.log(txt.slice(-3000)); throw new Error(`${p} falhou`); }
  const info = {};
  const poses = [];
  const tag = veiculo + (veiculo.startsWith('carreta') ? (tk === 'on' ? '-com-tk' : '-sem-tk') : '');
  for (const linha of txt.split('\n')) {
    const m = linha.match(/^\s+=\s+(\S+) → (.*)$/);
    if (!m) continue;
    const [, nome, val] = m;
    if (nome.startsWith('guia-')) {
      const arq = val.trim();
      const base = arq.split('/').pop().replace(/\.webp$/, '');
      const pose = base.slice(5 + tag.length + 1);
      await mkdir(join(OUT, tag), { recursive: true });
      await rename(join(SHOTS, base + '.webp'), join(OUT, tag, pose + '.webp'));
      poses.push(pose);
      continue;
    }
    try { info[nome] = JSON.parse(val); } catch { info[nome] = val; }
  }
  manifest.veiculos[tag] = {
    veiculo, thermoKing: tk === 'on', bau: info.bau?.depois, escolha: info.escolha,
    poses: poses.map((pose) => ({
      nome: pose, arquivo: `${tag}/${pose}.webp`,
      orientacao: /traseira$|frontal|teto/.test(pose) ? 'retrato' : 'paisagem',
      camera: info[`${pose}-info`],
    })),
  };
  console.log(`  ${tag}: ${poses.length} poses`);
}
manifest.gerado = new Date().toISOString();
await mkdir(OUT, { recursive: true });
await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`\nmanifesto em ${manifestPath}`);
