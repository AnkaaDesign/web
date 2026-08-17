#!/usr/bin/env node
/* A SONDA DO FURO DE PINO — a frota inteira, sem navegador.
   ===========================================================================
   Rodar:

       node tools/trailer-bench/pinprobe.mjs
       node tools/trailer-bench/pinprobe.mjs --assets /srv/files/Estudio3D/v1

   POR QUE ELA EXISTE, e por que não é a bancada. `checks-engate-furo-pino.mjs`
   sobe o engine num navegador de verdade e prova o CAMINHO — que a malha do
   pino anda, que a fusão não engole a mudança, que o resíduo continua zero.
   Isso custa ~50 min sob SwiftShader e cabem seis cabines. A pergunta que sobra
   é de COBERTURA: as 47 cabines do catálogo escolhem o furo certo? Essa é
   aritmética pura, e esta sonda a responde em segundos.

   O QUE ELA NÃO FAZ, e é deliberado: ela não reimplementa a escolha. Ela
   TRANSPILA `engine/vehicle/coupling.ts` e chama `pickKingpinStation()` — a
   mesma função que o app chama. Uma tabela que exercita uma transcrição do
   algoritmo não prova nada sobre o algoritmo que roda no app; é o que o
   cabeçalho de `coupling.ts` já cobra, e vale igual aqui.

   AS DUAS ENTRADAS, e de onde cada uma vem:

     · o lado CAVALO sai de `models/vehicles/hitch.json` (congelado, com sha256)
       mais o PERFIL DA TRASEIRA de cada cabine, que `hitch.json` não traz —
       `rearBody.profile` é `null` nas 47 entradas e o `rearBody.z` de lá é a
       ponta do chassi, 1,6 m atrás da quinta roda. O perfil é medido do GLB, em
       bandas de 100 mm, pela mesma regra de `measureCabRearProfile()`.
     · o lado IMPLEMENTO sai da medição do `trailer.glb` — pino, chapa, bogie,
       testeira e OS DOIS FUROS.

   Medir GLB aqui dentro exigiria um leitor de Draco em node. Em vez disso a
   sonda LÊ um arquivo de medidas (`--medidas`), produzido pelo Blender, e
   FALHA se ele não existir: um número inventado é pior que uma sonda que não
   roda. O script que o produz está no cabeçalho de `--medidas`. */
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const esbuild = require_(require_.resolve('esbuild', {
  paths: [require_.resolve('vite/package.json').replace(/package\.json$/, '')],
}));

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '../..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };

const ASSETS = resolve(opt('assets', '/srv/files/Estudio3D/v1'));
const MEDIDAS = resolve(opt('medidas', join(HERE, 'pinprobe-medidas.json')));

if (!existsSync(MEDIDAS)) {
  console.error(`sem o arquivo de medidas: ${MEDIDAS}

Ele é produzido pelo Blender (o GLB é Draco e node não o lê), e o formato está
documentado em tools/trailer-bench/pinprobe-medidas.README.md.`);
  process.exit(2);
}

/* O MÓDULO DE VERDADE, transpilado. Nada de reimplementar a escolha. */
const src = join(WEB, 'src/pages/tools/truck-studio/engine/vehicle/coupling.ts');
const js = esbuild.transformSync(readFileSync(src, 'utf8'), {
  loader: 'ts', format: 'esm', target: 'node18',
}).code;
const dir = mkdtempSync(join(tmpdir(), 'pinprobe-'));
const mod = join(dir, 'coupling.mjs');
writeFileSync(mod, js);
const { pickKingpinStation, solveCoupling, withKingpinAt, findTractor, defaultsOf } =
  await import(pathToFileURL(mod).href);

const manifest = JSON.parse(readFileSync(join(ASSETS, 'models/vehicles/hitch.json'), 'utf8'));
const brands = JSON.parse(readFileSync(join(ASSETS, 'brands/trucks/brands.json'), 'utf8'));
const med = JSON.parse(readFileSync(MEDIDAS, 'utf8'));
const defaults = defaultsOf(manifest);

/* O lado implemento, montado das medidas — a mesma forma que `TrailerRig.hitch`
   entrega, inclusive `kingpinStations`. */
const T = med.trailer;
const bandas = 12;
const frontProfile = [];
for (let k = 0; k < bandas; k++) {
  const y = T.floorY + (T.roofY - T.floorY) * (k / (bandas - 1));
  frontProfile.push({ y: y - T.contactY, z: T.frontWallZ });
}
const baseImplement = {
  orientYaw: 0,
  groundY: T.contactY,
  centerX: T.centerX,
  kingpin: { x: T.kingpinX, y: T.plateBottomY, z: T.stations[0].z, plateBottomY: T.plateBottomY },
  bogie: {
    centerZ: (T.bogieZMin + T.bogieZMax) / 2,
    halfSpan: (T.bogieZMax - T.bogieZMin) / 2,
    contactY: T.contactY,
  },
  frontWallZ: T.frontWallZ,
  frontProfile,
  swingRadius: 0,     // recomputado por withKingpinAt()
  landingGear: null,
  dims: { width: T.width, height: T.roofY - T.floorY, length: T.length },
  kingpinStations: T.stations,
};

const dianteiro = T.stations.reduce((a, b) => (b.z > a.z ? b : a)).z;
const vaoEntreFuros = Math.abs(T.stations[0].z - T.stations[1].z);

/* O THERMO KING ENTRA NA CONTA, e ele é quem manda.
   ---------------------------------------------------------------------------
   A unidade fica pendurada na testeira e avança 451 mm NA DIREÇÃO DA CABINE, e
   ela não é opcional: `loadTrailer()` chama `attachThermoKing()` sempre. Rodar
   esta sonda sem `tkDepth` foi o que fez a primeira tabela discordar da bancada
   em ~450 mm em TODAS as linhas — a mesma diferença nas 47, que é a assinatura
   de uma parcela faltando e não de um erro de medida. `solveCoupling()` desconta
   `tkDepth` de toda banda do perfil, então a folga que sai daqui é da cabine à
   FACE DO THERMO KING, e é essa que decide o furo. */
const opts = { tkDepth: med.tkDepth ?? 0, tkHalfWidth: med.tkHalfWidth };

const nomes = new Map();
for (const mk of brands.manufacturers) {
  for (const m of mk.models) {
    for (const c of m.chassis) nomes.set(c.file.split('/').pop(), [m.id, c.id]);
  }
}

const linhas = [];
let semPerfil = 0, naoCabe = 0, noDianteiro = 0, residuoMax = 0;

for (const [id, raw] of Object.entries(manifest.tractors)) {
  const t = findTractor(manifest, { id, file: raw.sourceFile });
  if (!t) continue;
  const perfil = med.rearProfiles[id];
  if (!perfil) { semPerfil++; continue; }
  t.rearProfile = perfil;
  /* A ESCADA DE LARGURAS. Sem ela o Thermo King é medido contra a ASA da
     cabine, que passa por fora dele — e um furo que cabe é reprovado. */
  t.rearProfiles = med.rearLadders?.[id] ?? null;

  const escolha = pickKingpinStation(t, baseImplement, T.stations, defaults, opts);
  const sol = solveCoupling(t, withKingpinAt(baseImplement, escolha.z), defaults, opts);
  const res = Math.hypot(
    sol.kingpinResidual.x, sol.kingpinResidual.y, sol.kingpinResidual.z);
  residuoMax = Math.max(residuoMax, res);
  if (escolha.reason === 'nenhum-cabe') naoCabe++;
  const frente = Math.abs(escolha.z - dianteiro) < 1e-4;
  if (frente) noDianteiro++;

  const [modelo, chassi] = nomes.get((raw.sourceFile || '').split('/').pop()) || ['?', '?'];
  const antes = escolha.ranked.find((r) => Math.abs(r.z - dianteiro) < 1e-4);
  linhas.push({
    modelo, chassi, cfg: raw.axles?.config ?? '?',
    antes: antes ? antes.gap : NaN,
    depois: sol.clearance.gap,
    furo: frente ? 'DIANTEIRO' : 'traseiro',
    balanco: escolha.overhang,
    res,
    reason: escolha.reason,
  });
}

linhas.sort((a, b) => (a.modelo + a.chassi).localeCompare(b.modelo + b.chassi));

const m = (v) => (Number.isFinite(v) ? `${(v * 1000).toFixed(0)}`.padStart(6) : '     —');
console.log(`\nfuros medidos na chapa: ${T.stations.length}`
  + ` · ${T.stations.map((s) => s.z.toFixed(4)).join(' e ')}`
  + ` · vão ${(vaoEntreFuros * 1000).toFixed(1)} mm`);
console.log(`folga mínima do manifesto: ${(defaults.cabTrailerClearance * 1000).toFixed(0)} mm`);
console.log(`Thermo King: ${(opts.tkDepth * 1000).toFixed(0)} mm de profundidade`
  + ` · ${(opts.tkHalfWidth * 2000).toFixed(0)} mm de largura`
  + ` (a folga abaixo é da cabine à FACE da unidade, medida na largura dela)\n`);
console.log('modelo               chassi     cfg     folga ANTES  folga DEPOIS  furo        balanço');
console.log('-'.repeat(92));
for (const l of linhas) {
  console.log(`${l.modelo.padEnd(21)}${l.chassi.padEnd(11)}${l.cfg.padEnd(8)}`
    + `${m(l.antes)} mm  ${m(l.depois)} mm   ${l.furo.padEnd(11)}${l.balanco.toFixed(3)} m`);
}

const piorAntes = Math.max(...linhas.map((l) => l.antes).filter(Number.isFinite));
const piorDepois = Math.max(...linhas.map((l) => l.depois));
const menorDepois = Math.min(...linhas.map((l) => l.depois));

console.log('\n' + '='.repeat(92));
console.log(`cabines avaliadas ......................... ${linhas.length}`
  + (semPerfil ? ` (${semPerfil} sem perfil medido — PULADAS)` : ''));
console.log(`no furo traseiro .......................... ${linhas.length - noDianteiro}`);
console.log(`no furo dianteiro (cavalo curto) .......... ${noDianteiro}`);
console.log(`nenhum furo fecha a folga mínima .......... ${naoCabe}`);
console.log(`maior folga ANTES / DEPOIS ................ ${(piorAntes * 1000).toFixed(0)} mm`
  + ` / ${(piorDepois * 1000).toFixed(0)} mm`);
console.log(`menor folga DEPOIS ........................ ${(menorDepois * 1000).toFixed(0)} mm`);
console.log(`resíduo máximo do pino na garganta ........ ${(residuoMax * 1000).toFixed(4)} mm`);

/* Os PORTÕES. Falhar aqui é sair com código 1 — a sonda serve para CI. */
const portoes = [
  ['a chapa tem dois furos', T.stations.length === 2],
  ['o vão bate com a chapa (800 mm ±5)', Math.abs(vaoEntreFuros - 0.800) < 0.005],
  ['toda cabine do manifesto foi avaliada', semPerfil === 0],
  ['o pino fecha na garganta em todas (< 1 µm)', residuoMax < 1e-6],
  ['nenhuma cabine ficou sem folga mínima', naoCabe === 0],
  ['a folga depois nunca é MAIOR que antes',
    linhas.every((l) => !Number.isFinite(l.antes) || l.depois <= l.antes + 1e-9)],
];
console.log('');
let ok = true;
for (const [nome, passou] of portoes) {
  console.log(`${passou ? '  ok  ' : ' FALHA'} ${nome}`);
  ok = ok && passou;
}
process.exit(ok ? 0 : 1);
