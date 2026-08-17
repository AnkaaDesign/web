/* O FURO DE PINO — a régua do engate por estação, no engine de verdade.
   ===========================================================================
   Rodar:

       STUDIO_BENCH_ASSETS=/srv/files/Estudio3D/v1 \
       node tools/studio-bench/bench.mjs --geometry --checks checks-engate-furo-pino.mjs

   `--geometry` é OBRIGATÓRIO: o assunto aqui é a malha do implemento (os furos
   da chapa são medidos por forma) e a caixa que `boot.ts` põe no lugar do
   caminhão não tem pino nenhum. Sem a flag, tudo abaixo passa por vacuidade.

   O QUE ELE MEDE, e por que cada linha existe.

   1. **A chapa tem DOIS furos, e eles estão a 800 mm.** É a premissa de tudo o
      mais: se `measureKingpinStations()` voltar com um furo só, não há escolha a
      fazer e o conserto inteiro é letra morta — sem que nada quebre. Um baú
      re-assado que perca a flange cega cai exatamente assim, em silêncio, e esta
      é a linha que o denuncia.

   2. **O pino MUDA DE LUGAR na malha, não só na conta.** `measureKingpin()`
      OBSERVA onde o pino está; se a troca de estação mexesse só num número, o
      pino ficaria pendurado no vazio a 800 mm da quinta roda — visível de
      qualquer ângulo baixo. A prova é `anchorsDebug.kingpinZ` andar junto com a
      estação escolhida, porque ele é medido da geometria depois da troca.

   3. **A folga cai ~800 mm quando o furo traseiro é o escolhido.** É o efeito
      que o usuário pediu: recuar o pino aumenta o balanço até a testeira e, como
      o pino é a âncora do conjunto, é a testeira que vem para a frente.

   4. **O pino continua encostado na garganta nos TRÊS eixos.** `kingpinResidual`
      é o que separa "aproximou" de "desengatou". Trocar de furo é mover a âncora;
      um resíduo que crescesse aqui seria um conjunto acoplado no vazio, e é o
      defeito que este arquivo existe para tornar impossível de passar calado.

   5. **Cavalo curto continua no furo dianteiro.** A regra não é "4x2 usa A, 6x2
      usa B" — é a folga mínima, e quem a consome é o THERMO KING: a unidade
      avança 451 mm da testeira na direção da cabine. Dos seis do recorte, DOIS
      ficam no furo dianteiro: o Iveco S-Way 4x2 e o Volvo FH16 2009 4x2, os de
      quinta roda mais colada na cabine. Se este número mudar, mudou o limiar
      (`defaults.cabTrailerClearance`) ou a unidade — e a linha diz isso em vez
      de deixar o Thermo King entrar na cabine.

      ⚠️ A UNIDADE É MEDIDA NA LARGURA DELA. `rearProfiles` (a escada de
      larguras de `coupling.ts`) existe porque a traseira de uma cabine não é um
      plano em x: nas alturas do Thermo King quem está mais atrás é a ASA do
      defletor, entre |x| 1,0 e 1,3 — por fora dos 1,996 m da unidade. Medindo
      tudo junto, a asa respondia por uma folga que a unidade nunca teve de
      vencer, e o FH 2021 4x2 era reprovado por 10 mm num furo que lhe dá 268. */
const out = [];
const B = window.__bench;

const mm = (v) => (v === null || v === undefined || !Number.isFinite(v)
  ? '—' : `${(v * 1000).toFixed(0)} mm`);

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);

async function settle() {
  const overlay = document.getElementById('ts-selector');
  if (!overlay) return true;
  for (let step = 0; step < 12; step++) {
    if (overlay.classList.contains('hidden')) return true;
    const cards = [...overlay.querySelectorAll('.ts-card:not([disabled])')];
    if (!cards.length) break;
    cards[0].click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  return overlay.classList.contains('hidden');
}
out.push(['seletor atravessado', await settle()]);
out.push(['__studio de pé', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;
out.push(['implemento carregado', await B.until(() => !!S.state.trailerRig, 300000)]);

const M = S;
const rig = M.state.trailerRig;
if (!rig) return out;
await B.frame(); await B.frame();

/* ---- 1. os furos ---- */
const furos = rig.kingpinStations || [];
out.push(['furos medidos na chapa', furos.length]);
out.push(['★ SÃO DOIS', String(furos.length === 2)]);
for (const f of furos) {
  out.push([`  furo z ${f.z.toFixed(4)}`, f.hasPin ? 'COM PINO' : 'flange cega']);
}
if (furos.length === 2) {
  const d = Math.abs(furos[0].z - furos[1].z);
  out.push(['★ DISTÂNCIA ENTRE FUROS', mm(d)]);
  out.push(['★ BATE COM A CHAPA (800 mm ±5)', String(Math.abs(d - 0.800) < 0.005)]);
}

/* ---- a frota ---- */
const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const m of (mk.models || [])) {
    for (const c of (m.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, m, c });
    }
  }
}
/* Um recorte, e ele é escolhido: os dois CURTOS que devem ficar no furo
   dianteiro, mais um 4x2 e um 6x2 de cada extremo da folga. Carregar as 47
   cabines sob SwiftShader é uma hora de bancada e não acrescenta um fato. */
const QUERO = [
  'iveco_metallica_4x2',      // S-Way — o mais curto do acervo
  'volvo_fh16_2009_4x2',      // o outro curto
  'volvo_fh_2021_4x2',        // o caso que o usuário apontou
  'volvo_fh_2021_6x2_t',
  'mercedes_actros2014_6x2_tl', // o mais folgado do acervo
  'daf_xd_6x2s_sl',
];
const sel = QUERO
  .map((n) => alvos.find((a) => (a.c.file || '').includes(n)))
  .filter(Boolean);
out.push(['cavalos no recorte', sel.length]);

async function trocarPara(a) {
  const ok = await S.applyChoice({
    envId: S.choice?.envId || 'estudio',
    manufacturerId: a.mk.id, modelId: a.m.id, chassisId: a.c.id,
    colorId: null, finishId: null, trim: null,
  }, { curtain: false });
  if (!ok) return false;
  const chegou = await B.until(() => (M.state.cabDef?.file || '') === a.c.file, 240000);
  for (let i = 0; i < 8; i++) await B.frame();
  return chegou;
}

let residuoMax = 0;
let curtosNoDianteiro = 0;
const dianteiro = Math.max(...furos.map((f) => f.z));

for (const a of sel) {
  const nome = a.c.file.split('/').pop().replace('.glb', '');
  const foi = await trocarPara(a);
  if (!foi) { out.push([nome, 'NÃO CARREGOU']); continue; }
  const sol = M.state.coupled;
  const anc = rig.anchorsDebug;
  const z = rig.kingpinStationZ;
  if (!sol || !anc || z === null) { out.push([nome, 'sem solução de engate']); continue; }

  /* 2. o pino ANDOU: a âncora medida da malha tem de estar no furo escolhido. */
  const grudado = Math.abs(anc.kingpinZ - z) < 0.01;
  const res = Math.hypot(sol.kingpinResidual.x, sol.kingpinResidual.y, sol.kingpinResidual.z);
  residuoMax = Math.max(residuoMax, res);
  const noDianteiro = Math.abs(z - dianteiro) < 1e-4;
  if (noDianteiro) curtosNoDianteiro++;

  out.push([nome, `furo ${noDianteiro ? 'DIANTEIRO' : 'traseiro'} (z ${z.toFixed(3)})`
    + ` · balanço ${(rig.profile.z1 - z).toFixed(3)} m`
    + ` · folga ${mm(sol.clearance.gap)}`
    + ` · pino medido ${grudado ? 'no furo' : 'FORA DO FURO'}`
    + ` · resíduo ${(res * 1000).toFixed(2)} mm`]);
}

/* 4. o engate continua fechado — a linha que separa "aproximou" de "soltou". */
out.push(['★ RESÍDUO MÁXIMO DO PINO', `${(residuoMax * 1000).toFixed(2)} mm`]);
out.push(['★ ENGATE FECHADO EM TODOS (< 1 mm)', String(residuoMax < 0.001)]);

/* 5. quem não cabe ficou no furo dianteiro. Ver o item 5 do cabeçalho.

   ⚠️ ESTE NÚMERO SÓ VALE COM O PORTÃO DE IMPLANTAÇÃO ABERTO
   (`KINGPIN_STATION_ROLLOUT = null` em `vehicle/models.ts`, que é o estado de
   hoje). Se alguém voltar a recortar a frota, quem ficar de fora vai para o
   furo dianteiro por RECORTE e não por geometria, e este número sobe sem que
   nada esteja errado. A cobertura das 47 cabines é de
   `tools/trailer-bench/pinprobe.mjs`, que chama a mesma `pickKingpinStation()`
   sem passar pelo portão. */
out.push(['★ CAVALOS NO FURO DIANTEIRO',
  `${curtosNoDianteiro} · esperado 2 com o portão ABERTO: o Iveco S-Way 4x2 e o`
  + ' Volvo FH16 2009 4x2, os dois de quinta roda mais colada na cabine']);

return out;
