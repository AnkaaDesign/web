/* A PLACA DE LICENCIAMENTO — o portão, e as fotos.
   ===========================================================================
       DISPLAY= STUDIO_BENCH_GPU_ARGS='--use-gl=angle --use-angle=gles-egl --enable-gpu --ignore-gpu-blocklist' \
         node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-placa-0816.mjs

   ⚠️ `--geometry` NÃO É OPCIONAL AQUI. O padrão da bancada bloqueia `*.glb` e
   põe uma CAIXA no lugar do conjunto (ver o cabeçalho de `bench.mjs`), e uma
   caixa não tem para-choque nem porta-placa: sem a geometria de verdade este
   arquivo mede o nada e passa.

   O QUE ELE VERIFICA, e por que cada item existe:

     1. **o manifesto chegou, e com os 49.** `plates.json` é a única fonte do
        sítio dianteiro; sem ele todo cavalo fica sem placa, em silêncio.
     2. **a placa do cavalo entrou, no sítio do manifesto.** Compara a posição
        LOCAL da peça com `pos` do manifesto — é o par que prova que o espaço
        cru do arquivo foi respeitado.
     3. **a placa do implemento achou o PORTA-PLACA** — o painel raso sob a
        lanterna traseira, e não o para-choque (foi a correção do Kennedy em
        2026-08-16; ver o cabeçalho de `license-plate.ts`). Ela é MEDIDA, não
        declarada, então o que se verifica é a medida: quantas peças do painel
        entraram na conta, de que lado, e a que altura a placa parou.
     4. **a arte decodificou.** Separa "a peça está lá" de "a peça está lá com a
        placa desenhada". Uma textura 404 dá uma chapa branca, e uma chapa
        branca de 40 cm no para-choque passa despercebida em toda verificação
        geométrica.
     5. **ela acompanha o redimensionamento.** O comprimento do baú cresce para
        trás; a placa tem de andar o mesmo tanto que a traseira. Este é o item
        que a versão congelada em manifesto reprovaria.
     6. **ela NÃO entra na fusão.** Um balde assaria os vértices na pose do
        instante — e aí o item 5 passaria uma vez e falharia no segundo resize.
     7. **e a troca de cavalo repõe a placa** no sítio do cavalo NOVO.

   Mais as fotos: dianteira de perto em três chassis de fabricantes diferentes,
   e a traseira do implemento. Elas são o juiz do que nenhum número responde. */
const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);
await B.settleSelector();
await B.until(() => !!window.__studio, 300000);
const S = window.__studio;
if (!S) return [['sem __studio', false]];
out.push(['implemento carregado', await B.until(() => !!S.trailerRig, 300000)]);
out.push(['entrou no cenário estúdio', await B.enterStudio()]);
await new Promise((r) => setTimeout(r, 2500));

const THREE = S.THREE;
const camera = S.camera;
const controls = S.controls;
const r3 = (v) => Math.round(v * 1000) / 1000;
const perto = (a, b, tol) => Math.abs(a - b) <= tol;

/* ---------------- 1. o manifesto ---------------- */
let info = S.placa.info();
out.push(['1. manifesto com 49 cavalos', info.manifesto]);

/* ---------------- 2. a placa do cavalo ---------------- */
const arquivo = S.models.state.cabDef?.file || '';
const sitio = S.placa.sitio(arquivo);
out.push(['2. cavalo em cena', arquivo]);
out.push(['2. sítio declarado', sitio
  ? `y=${r3(sitio.alturaSolo)} vão=${Math.round((sitio.vao || 0) * 1000)}mm ${sitio.fonte}`
  : 'NENHUM']);
out.push(['2. placa montada no cavalo', !!info.cavalo]);
if (info.cavalo && sitio) {
  const d = info.cavalo.local.map((v, i) => Math.abs(v - sitio.pos[i]));
  out.push(['2. posição local = manifesto (mm)', d.map((v) => Math.round(v * 1000)).join(', ')]);
  out.push(['2. bate', d.every((v) => v < 1e-4)]);
}

/* ---------------- 3. a placa do implemento ---------------- */
out.push(['3. placa montada no implemento', !!info.implemento]);
out.push(['3. peças do porta-placa achadas', info.implemento?.pecasDoPortaPlaca ?? 0]);
out.push(['3. lado', info.implemento?.lado ?? '—']);
out.push(['3. posição local no baú', info.implemento?.local?.join(', ') ?? '—']);
/* O porta-placa medido no bake fica em y 0,913…1,098 no referencial do
   implemento, e o implemento assenta com o contato dos pneus em y ≈ −0,02.
   Uma placa fora de 0,90…1,15 m do chão não está no painel. */
const yPlaca = info.implemento?.mundo?.y ?? -1;
out.push(['3. altura do chão (m)', r3(yPlaca)]);
out.push(['3. na faixa 0,90…1,15 m', yPlaca > 0.90 && yPlaca < 1.15]);
/* E FORA DA LINHA DE CENTRO: o painel é lateral. Uma placa em x ≈ 0 é a versão
   antiga, do para-choque — o defeito que esta rodada consertou. */
const xPlaca = info.implemento?.local?.[0] ?? 0;
out.push(['3. x local (não pode ser 0)', xPlaca]);
out.push(['3. fora do eixo', Math.abs(xPlaca) > 0.5]);

/* ---------------- 4. a arte ---------------- */
out.push(['4. arte decodificada', await B.until(() => S.placa.info().arteCarregada, 30000)]);
out.push(['4. material (tem de casar FITA_RE de retroreflect)', S.placa.info().material]);
const retro = S.lighting.getRetroreflective ? S.lighting.getRetroreflective() : null;
out.push(['4. materiais com retrorreflexão', retro ? retro.materiais : 'sem afordance']);

/* A peça existe na cena, com dois grupos (arte + casco) e nome estável? */
let achou = null;
S.scene.traverse((o) => { if (o.name === 'PLACA' && !achou) achou = o; });
const chapa = achou?.children?.[0];
out.push(['4. grupo PLACA na cena', !!achou]);
out.push(['4. dois materiais na chapa', Array.isArray(chapa?.material) ? chapa.material.length : 0]);
out.push(['4. dois grupos na geometria', chapa?.geometry?.groups?.length ?? 0]);
if (chapa) {
  /* ⚠️ A caixa da GEOMETRIA, não `setFromObject()`. A placa é INCLINADA — no
     Scania R 2009 ela deita 20° para acompanhar o para-choque —, e a caixa de
     mundo de um sólido girado é a caixa de uma caixa girada: os mesmos
     416 × 146 × 32 mm saem como 416 × 148 × 80. A primeira versão deste portão
     media assim e passou por causa da tolerância, não por estar certa. */
  chapa.geometry.computeBoundingBox();
  const s = chapa.geometry.boundingBox.getSize(new THREE.Vector3());
  out.push(['4. medidas da peça (mm)', [s.x, s.y, s.z].map((v) => Math.round(v * 1000)).join(' x ')]);
  /* 400 × 130 mm mais a sobra do berço (8 mm por lado). */
  out.push(['4. 400x130 mm + aro', perto(s.x, 0.416, 0.001) && perto(s.y, 0.146, 0.001)]);
  /* A espessura é a chapa mais o berço daquele modelo — e ele sai do manifesto. */
  const bercoEsperado = Math.min(Math.max(sitio?.vao ?? 0.004, 0.004), 0.045);
  out.push(['4. espessura = chapa + berço do manifesto',
    `${Math.round(s.z * 1000)} mm (esperado ${Math.round((0.002 + bercoEsperado) * 1000)})`]);
  out.push(['4. berço confere', perto(s.z, 0.002 + bercoEsperado, 0.0005)]);
}

/* ---------------- 5. ela acompanha o baú ----------------
   ⚠️ NÃO SE MEDE PELO NOME DO NÓ, e a primeira versão deste bloco fez isso e
   PASSOU EM FALSO. Ela lia `getWorldPosition()` das lanternas — que devolve a
   ORIGEM do nó, e não a geometria — e concluía "a placa andou o mesmo que a
   lanterna: 0 mm" quando na verdade nenhuma das duas tinha andado. O que
   responde é a caixa por VÉRTICE de cada peça, que é o que `placa.info()`
   publica em `portaPlacaCaixa`.

   E as DUAS malhas do porta-placa entram, uma a uma: o defeito que esta rodada
   consertou (`HEAVY_VERTS` em `trailer-assembly.ts`) movia só uma delas. */
function caixaZ(re) {
  const t = S.models.state.trailer;
  t.updateWorldMatrix(true, true);
  const inv = t.matrixWorld.clone().invert();
  const v = new THREE.Vector3();
  let lo = Infinity, hi = -Infinity;
  t.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    let bate = false;
    for (let n = o; n; n = n.parent) { if (re.test(n.name || '')) { bate = true; break; } if (n === t) break; }
    if (!bate) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      if (v.z < lo) lo = v.z;
      if (v.z > hi) hi = v.z;
    }
  });
  return Number.isFinite(lo) ? { lo, hi } : null;
}
const antes = S.placa.info().implemento?.local?.[2];
const lanternaAntes = caixaZ(/lanterna-traseira/i);
const dimsBase = { ...S.trailerDims };
out.push(['5. medidas de base', `${r3(dimsBase.length)} x ${r3(dimsBase.height)} m`]);
const aplicou = S.setTrailerDims({ length: dimsBase.length + 2.0, height: dimsBase.height });
await B.frame();
out.push(['5. resize aplicado', aplicou ? `${r3(aplicou.length)} m` : 'FALHOU']);
const depois = S.placa.info().implemento?.local?.[2];
const lanternaDepois = caixaZ(/lanterna-traseira/i);
out.push(['5. z local da placa', `${antes} → ${depois}`]);
out.push(['5. z da lanterna', `${r3(lanternaAntes?.lo)} → ${r3(lanternaDepois?.lo)}`]);
out.push(['5. lanterna recuou 2,00 m', perto(lanternaAntes.lo - lanternaDepois.lo, 2.0, 0.01)]);
out.push(['5. placa recuou o mesmo (mm)',
  Math.round(Math.abs((antes - depois) - (lanternaAntes.lo - lanternaDepois.lo)) * 1000)]);
out.push(['5. placa colada na traseira', Math.abs((antes - depois) - (lanternaAntes.lo - lanternaDepois.lo)) < 0.002]);
/* E as DUAS malhas do porta-placa foram junto — ver o ⚠️ acima. */
const painel = S.placa.info().implemento?.portaPlacaCaixa || [];
out.push(['5. porta-placa, peça a peça', painel.join(' | ')]);
out.push(['5. nenhuma peça ficou para trás', painel.every((s) => /-9\.\d/.test(s))]);
S.setTrailerDims({ length: dimsBase.length, height: dimsBase.height });
await B.frame();
const volta = S.placa.info().implemento?.local?.[2];
out.push(['5. voltou ao lugar (mm de deriva)', Math.round(Math.abs((volta ?? 0) - (antes ?? 0)) * 1000)]);

/* ---------------- 6. fora da fusão ---------------- */
const fus = S.merge?.apply ? S.merge.apply() : null;
out.push(['6. fusão aplicada', !!fus]);
let sobreviveu = null;
S.scene.traverse((o) => { if (o.name === 'PLACA' && !sobreviveu) sobreviveu = o; });
out.push(['6. PLACA sobreviveu à fusão', !!sobreviveu && !!sobreviveu.children.length]);
/* ⚠️ A EXCLUSÃO POR NOME (`^PLACA$`) NÃO É A QUE DISPARA, e isso é correto.
   `merge.ts` testa as exclusões ESTRUTURAIS antes das de dono, e a primeira
   delas é `Array.isArray(o.material)` — a placa tem DOIS materiais (a arte e o
   casco), então ela sai do balde antes de o nome ser consultado. A regra de
   nome fica como rede: no dia em que alguém unificar os dois materiais, é ela
   que segura a peça fora da fusão. Por isso o portão verifica o RESULTADO — a
   peça sobreviveu, e sobreviveu inteira — e apenas RELATA a tabela de motivos. */
out.push(['6. motivos de exclusão da fusão',
  fus?.excluidas ? JSON.stringify(fus.excluidas) : 'sem afordance']);
out.push(['6. a chapa sobreviveu com os dois materiais',
  Array.isArray(sobreviveu?.children?.[0]?.material)
  && sobreviveu.children[0].material.length === 2]);

/* ---------------- as fotos ---------------- */
function poseFrente(dist, alturaAlvo, elDeg, ladoDeg) {
  const rig = S.scene.getObjectByName('RIG');
  const box = new THREE.Box3().setFromObject(rig);
  const t = controls.target;
  /* A frente do conjunto: com `RIG_PLACEMENT.yaw = π`, o nariz da cabine é o
     extremo −z da caixa do rig. Mira-se a placa, não o caminhão. */
  t.set(0, alturaAlvo, box.min.z);
  const a = THREE.MathUtils.degToRad(180 + ladoDeg);
  const e = THREE.MathUtils.degToRad(elDeg);
  camera.position.set(
    t.x + Math.sin(a) * Math.cos(e) * dist,
    t.y + Math.sin(e) * dist,
    t.z + Math.cos(a) * Math.cos(e) * dist,
  );
  camera.lookAt(t);
  controls.update();
  S.lighting.invalidate();
}

function poseTras(dist, alvoMundo, elDeg, ladoDeg) {
  const rig = S.scene.getObjectByName('RIG');
  const box = new THREE.Box3().setFromObject(rig);
  const t = controls.target;
  /* Mira-se a PLACA, em mundo — ela é lateral, e um alvo na linha de centro
     deixaria a peça no canto do quadro. */
  t.set(alvoMundo?.x ?? 0, alvoMundo?.y ?? 1.0, box.max.z);
  const a = THREE.MathUtils.degToRad(ladoDeg);
  const e = THREE.MathUtils.degToRad(elDeg);
  camera.position.set(
    t.x + Math.sin(a) * Math.cos(e) * dist,
    t.y + Math.sin(e) * dist,
    t.z + Math.cos(a) * Math.cos(e) * dist,
  );
  camera.lookAt(t);
  controls.update();
  S.lighting.invalidate();
}

async function foto(nome) {
  await B.frame();
  await new Promise((r) => setTimeout(r, 800));
  await B.frame();
  const r = await B.captureViewport({ quality: 'baixa', background: 'cena' });
  const blob = r && r.blob ? r.blob : r;
  if (!(blob instanceof Blob)) { out.push([nome, 'sem blob']); return; }
  out.push([nome, await new Promise((ok) => {
    const fr = new FileReader();
    fr.onload = () => ok(fr.result);
    fr.readAsDataURL(blob);
  })]);
}

const alturaCab = S.placa.info().cavalo?.mundo?.y ?? 0.45;
poseFrente(2.2, alturaCab, 4, 0);
await foto('placa-cavalo-frente');
poseFrente(1.3, alturaCab, 10, 28);
await foto('placa-cavalo-tres-quartos');
poseTras(3.4, S.placa.info().implemento?.mundo, 4, 0);
await foto('placa-implemento-traseira');
poseTras(1.6, S.placa.info().implemento?.mundo, 6, 0);
await foto('placa-implemento-perto');

/* ---------------- a retrorreflexão, às 21h ----------------
   A afirmação a provar é a do cabeçalho de `license-plate.ts`: a película
   devolve e os CARACTERES não, porque o shader de `retroreflect.ts` multiplica
   o retorno pelo albedo. À meia-noite sem farol a placa tem de continuar
   LEGÍVEL — se ela virasse um retângulo branco, o efeito estaria somando em
   `outgoingLight` em vez de em `directSpecular`, e o texto sumiria. */
S.lighting.setHourOfDay(21, { animate: false });
for (let i = 0; i < 8; i++) await B.frame();
poseFrente(1.8, alturaCab, 4, 0);
await foto('placa-cavalo-noite');
poseTras(2.2, S.placa.info().implemento?.mundo, 5, 0);
await foto('placa-implemento-noite');
S.lighting.setHourOfDay(13, { animate: false });
for (let i = 0; i < 4; i++) await B.frame();

/* ---------------- 7. troca de cavalo ---------------- */
if (S.merge?.release) S.merge.release();
const marcas = S.catalog.catalog?.manufacturers || [];
const alvos = [];
for (const mk of marcas) {
  for (const m of (mk.models || [])) {
    for (const c of (m.chassis || [])) {
      if (c.available !== false && c.file) alvos.push({ mk, m, c });
    }
  }
}
/* Um por fabricante, e sempre o primeiro chassi — cobre as cinco procedências
   de rip sem transformar o portão numa corrida de 49 downloads. */
const porMarca = new Map();
for (const a of alvos) if (!porMarca.has(a.mk.id)) porMarca.set(a.mk.id, a);
out.push(['7. fabricantes no catálogo', [...porMarca.keys()].join(', ')]);

let trocados = 0, falhas = [];
for (const [id, a] of porMarca) {
  const escolha = {
    ...(S.catalog.loadChoice ? S.catalog.loadChoice() : {}),
    envId: 'estudio',
    manufacturerId: a.mk.id, modelId: a.m.id, chassisId: a.c.id,
    colorId: null, finishId: null,
  };
  const ok = await S.applyChoice(escolha, { curtain: false });
  if (!ok) { falhas.push(id + ': applyChoice falhou'); continue; }
  await B.until(() => (S.models.state.cabDef?.file || '') === a.c.file, 300000);
  await B.frame();
  const i = S.placa.info();
  const st = S.placa.sitio(a.c.file);
  if (!i.cavalo || !st) { falhas.push(id + ': sem placa em ' + a.c.file); continue; }
  const d = i.cavalo.local.map((v, k) => Math.abs(v - st.pos[k]));
  if (!d.every((v) => v < 1e-4)) { falhas.push(id + ': posição fora do manifesto'); continue; }
  trocados++;
  out.push(['7. ' + id, `${a.c.file.split('/').pop()} · y=${r3(st.alturaSolo)}`
    + ` · vão=${Math.round((st.vao || 0) * 1000)}mm · mundo y=${r3(i.cavalo.mundo.y)}`]);
  poseFrente(2.0, i.cavalo.mundo.y, 4, 0);
  await foto('placa-' + id);
}
out.push(['7. cavalos trocados com placa', trocados]);
out.push(['7. falhas', falhas.length ? falhas.join(' | ') : 'nenhuma']);

/* ---------------- 8. os DOIS casos difíceis, em foto ----------------
   Nem todo modelo aparece no laço acima (ele pega o primeiro chassi de cada
   fabricante), e estes dois são justamente os que precisam ser OLHADOS:

     `daf_xf_105_4x2`   é o único `AUTORADOS` da sonda — a dianteira dele não
                        tem 130 mm planos em ponto nenhum, e a placa fica sobre
                        um berço de 45 mm. É a foto que diz se aquilo passa por
                        suporte ou por caixa.
     `scania_s_2024e_4x2` é o único chassi do modelo dele, então a folha de
                        contato da frota não tem irmão para cobri-lo — e ali o
                        enquadramento automático perdeu a placa. */
const dificeis = ['models/trucks/daf_xf_105_4x2.glb', 'models/trucks/scania_s_2024e_4x2.glb'];
for (const arq of dificeis) {
  let alvo2 = null;
  for (const mk of marcas) {
    for (const m of (mk.models || [])) {
      for (const c of (m.chassis || [])) if (c.file === arq) alvo2 = { mk, m, c };
    }
  }
  const curto = arq.split('/').pop().replace(/\.glb$/, '');
  if (!alvo2) { out.push(['8. ' + curto, 'NÃO ESTÁ NO CATÁLOGO']); continue; }
  const ok = await S.applyChoice({
    envId: 'estudio', manufacturerId: alvo2.mk.id, modelId: alvo2.m.id,
    chassisId: alvo2.c.id, colorId: null, finishId: null,
  }, { curtain: false });
  if (!ok || !await B.until(() => (S.models.state.cabDef?.file || '') === arq, 300000)) {
    out.push(['8. ' + curto, 'não carregou']);
    continue;
  }
  await B.frame();
  const i2 = S.placa.info();
  const st2 = S.placa.sitio(arq);
  out.push(['8. ' + curto, `y=${r3(st2?.alturaSolo)} · vão=${Math.round((st2?.vao || 0) * 1000)}mm`
    + ` · ${st2?.fonte}${st2?.motivo ? ' (' + st2.motivo + ')' : ''}`]);
  poseFrente(1.9, i2.cavalo?.mundo?.y ?? 0.45, 3, 0);
  await foto('placa-dificil-' + curto);
  poseFrente(1.2, i2.cavalo?.mundo?.y ?? 0.45, 8, 40);
  await foto('placa-dificil-' + curto + '-lado');
}

return out;
