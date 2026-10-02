/* AS CINCO VARIANTES DO IMPLEMENTO — no engine de verdade, pelo caminho do card.
   ===========================================================================
   `tools/implement-bake/variants.mjs` assa três GLBs novos trocando o perfil
   superior entre os dois bakes. O retrato do ARQUIVO (sem engine) prova que a
   peça está lá; esta bancada prova o que importa: que o engine inteiro —
   `TrailerBody`, `measureTopRail()`, `dressTopRail()`, o inox do trilho de topo,
   as emendas e os rebites de `buildLiveryPanels()`, a fita de canto, o Thermo
   King — faz com cada variante o que faz com os dois bakes de fábrica.

   A TROCA passa por `applyChoice({ …, implementId })`, que é exatamente o que o
   seletor novo do card de Configurações chama (`onImplementSwitch` em
   studio.ts). E o conjunto é o de verdade: semirreboque atrás de cavalo,
   sobrechassi num rígido.

       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-variantes-0929.mjs

   Saída: o perfil medido de cada variante (fileiras de friso, arremate, pé do
   perfil de topo, cascas frisadas) e as fotos em `shots/variante-*`. */
const out = [];
const B = window.__bench;
/* O console da página, para o portão da FUSÃO: `placeThermoKing()` avisa
   quando mede a testeira com a fusão de pé — e é esse aviso que denunciava a
   troca de variante sem soltar a fusão (o Thermo King descia 370 mm). */
const avisos = [];
{
  const w = console.warn;
  console.warn = (...a) => { avisos.push(a.map(String).join(' ')); w.apply(console, a); };
}
await B.until(() => { const o = document.getElementById('ts-selector'); return !!o && o.classList.contains('is-open'); }, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 12; i++) await B.frame();
const THREE = S.THREE;

const acha = (pred) => {
  for (const mk of (S.catalog.catalog?.manufacturers || []))
    for (const mo of (mk.models || []))
      for (const ch of (mo.chassis || [])) if (ch.available !== false && pred(mo, ch)) return { mk, mo, ch };
  return null;
};
/* Um cavalo e um rígido do catálogo — os da foto de referência das rodadas
   anteriores quando existem. */
const cavalo = acha((mo, ch) => !mo.rigid && /4x2/.test(ch.id)) || acha((mo) => !mo.rigid);
/* O 8x2 e não o 6x2: é o do relato de 2026-09-29, e é nele que o baú é
   ESTICADO (8,38 → 9,5 m) — o esticamento é o que deslocava a chapa Ankaa. */
const rigido = acha((mo, ch) => mo.id === 'scania-p' && ch.id === '8x2r') || acha((mo) => mo.rigid);
out.push(['veiculos', `cavalo ${cavalo?.mo.id}/${cavalo?.ch.id} · rígido ${rigido?.mo.id}/${rigido?.ch.id}`]);

/* Rodar só algumas: liste os ids aqui (vazio = as cinco). */
const SO = [];
const VARIANTES = [
  ['semirreboque-frigorifico-paleteiro', cavalo],
  ['semirreboque-frigorifico-gancheiro', cavalo],
  ['sobrechassi-frigorifico-gancheiro', rigido],
  ['sobrechassi-frigorifico-paleteiro', rigido],
  ['sobrechassi-isotermico-paleteiro', rigido],
  ['sobrechassi-isotermico-gancheiro', rigido],
  /* DE NOVO o primeiro, no fim: é a QUARTA carga de sobrechassi da sessão, e
     era a partir da segunda que a chapa Ankaa saía do lugar. */
  ['sobrechassi-frigorifico-gancheiro', rigido],
].filter(([id]) => !SO.length || SO.includes(id));

/* CLOSE POR ZOOM ÓPTICO, não por aproximação. A órbita do estúdio tem coleira
   de distância e EXPULSA a câmera da caixa do veículo (`setVehicleFocus()`):
   a primeira versão, com a câmera a 1 m do perfil, saiu com o enquadramento
   aberto de sempre — ou com a tela toda branca, de dentro do baú. Longe e com
   o campo de visão estreito, a coleira não tem o que corrigir. */
const foto = async (nome, alvo, de, dist, fov) => {
  const fov0 = S.camera.fov;
  S.camera.fov = fov;
  S.camera.updateProjectionMatrix();
  S.camera.position.copy(alvo).addScaledVector(de.clone().normalize(), dist);
  S.controls.target.copy(alvo);
  S.controls.update();
  for (let i = 0; i < 16; i++) await B.frame();
  out.push([nome, S.renderer.domElement.toDataURL('image/png')]);
  S.camera.fov = fov0;
  S.camera.updateProjectionMatrix();
};

/* OS CANTOS, RENDERIZADOS À MÃO. Um canto de baú fica a 7 m do centro do
   conjunto, e a mira da órbita tem COLEIRA (`FOCUS_PAN_F` = 0,28 · r, ver
   scene.ts): posta no canto, ela é puxada de volta e a câmera acaba DENTRO do
   baú — a tela branca da segunda rodada. Aqui a órbita não participa: uma
   câmera própria, `renderer.render()` e a leitura no MESMO quadro (sem
   `preserveDrawingBuffer`, o buffer só vale até o próximo compositing). Sai
   sem o pós-processamento do laço — serve para geometria e material, que é o
   que se confere. */
const fotoCanto = async (nome, alvo, de, dist, fov) => {
  for (let i = 0; i < 4; i++) await B.frame();
  const cam = new THREE.PerspectiveCamera(fov, S.camera.aspect, 0.05, 400);
  cam.position.copy(alvo).addScaledVector(de.clone().normalize(), dist);
  cam.lookAt(alvo);
  cam.updateMatrixWorld();
  S.renderer.render(S.scene, cam);
  out.push([nome, S.renderer.domElement.toDataURL('image/png')]);
};

let carga = 0;
const tkPorId = new Map();
const mapasChapa = new Map();
for (const [id, v] of VARIANTES) {
  if (!v) { out.push([id, 'SEM VEÍCULO no catálogo']); continue; }
  await S.applyChoice({
    envId: S.choice?.envId || 'estudio', manufacturerId: v.mk.id, modelId: v.mo.id,
    chassisId: v.ch.id, colorId: null, finishId: null, implementId: id,
  }, { curtain: false });
  await B.until(() => S.state.implement?.id === id && !!S.state.trailer && !!S.state.trailerRig,
    180000).catch(() => null);
  /* ⚠️ A ESPERA NÃO REPROVA SOZINHA — ela devolve quando o prazo estoura. A
     primeira rodada desta bancada mediu CINCO vezes os dois bakes de fábrica e
     disse "tudo certo": o `implementId` morria em `resolveChoice()` e a cena
     nunca trocava. Daí o booleano explícito. */
  const trocou = S.state.implement?.id === id;
  const fusaoDePe = avisos.splice(0).filter((t) => /FUSÃO DE PÉ/.test(t));
  out.push([`trocou para ${id}`, trocou]);
  /* Um id repetido na lista NÃO é troca — `sameRig()` o descarta como a mesma
     escolha. Passar por outro implemento antes é o que o torna uma carga. */
  if (!trocou) continue;
  for (let i = 0; i < 40; i++) await B.frame();

  const rig = S.state.trailerRig;
  const p = rig.profile;
  const tb = new THREE.Box3();
  /* A caixa do BAÚ, não do implemento inteiro: rodagem, patola, mangueira e
     Thermo King ficam de fora — é o branco paramétrico que dá os cantos. */
  S.state.trailer.traverse((n) => {
    if (n.isMesh && n.visible && /metalBranco|__parametric|^SIDE_|^FRONT|^REAR/.test(`${n.name} ${n.material?.name || ''}`)) tb.expandByObject(n);
  });
  const c = tb.getCenter(new THREE.Vector3());
  out.push([`medida ${id}`, JSON.stringify({
    arquivo: S.state.implement.file,
    fileiras: p.ribCount, passo: +(p.pitch * 1000).toFixed(2),
    arremateMm: +(p.capHeight * 1000).toFixed(1),
    peDoPerfilDeTopoMm: p.topRailY == null ? null : +((p.roofY - p.topRailY) * 1000).toFixed(1),
    cascas: p.shells, frisadas: p.ribbedShells,
    base: p.base, thermoKing: !!S.state.tk,
  })]);

  /* A FRENTE É O LADO DA CABINE — o conjunto está girado no mundo, e a
     primeira versão desta bancada fotografou a testeira chamando-a de
     traseira. `dir` aponta da traseira para a frente. */
  const cab = new THREE.Box3().setFromObject(S.state.cab).getCenter(new THREE.Vector3());
  const dir = Math.sign(cab.z - c.z) || 1;
  const frente = dir > 0 ? tb.max.z : tb.min.z, tras = dir > 0 ? tb.min.z : tb.max.z;
  const x = tb.max.x, top = tb.max.y, piso = tb.min.y;
  const V = (a, b, cc) => new THREE.Vector3(a, b, cc);
  const n = ++carga;

  /* ---- PORTÃO 0: nenhuma medida com a fusão de pé, e o Thermo King no
     MESMO lugar em toda carga do mesmo implemento ---- */
  out.push([`${n}. sem medida com a fusão de pé (${id})`, fusaoDePe.length === 0]);
  if (S.state.tk) {
    S.state.trailer.updateWorldMatrix(true, true);
    const tkL = S.state.tk.position.clone();
    const antes = tkPorId.get(id);
    if (antes) {
      const d = antes.distanceTo(tkL);
      out.push([`${n}. Thermo King onde estava na 1ª carga de ${id}: desvio ${(d * 1000).toFixed(1)} mm`, d < 0.002]);
    } else tkPorId.set(id, tkL);
  }

  /* ---- PORTÃO 1: a chapa Ankaa colada na traseira, em TODA carga ----
     A medida é pelos VÉRTICES (caixa da malha), não pelo `position`: quem a
     deslocava era `TrailerAssembly` reescrevendo a geometria. */
  const placa = S.state.trailer.getObjectByName('PLACA_MARCA_ANKAA');
  if (S.state.implement.makerBranding) {
    const pb = placa ? new THREE.Box3().setFromObject(placa) : null;
    const d = pb ? (dir > 0 ? pb.min.z - tras : tras - pb.max.z) : NaN;
    out.push([`${n}. chapa Ankaa a ${Number.isFinite(d) ? (d * 1000).toFixed(0) : '?'} mm da traseira (${id})`,
      Number.isFinite(d) && Math.abs(d) < 0.08]);
  }

  /* ---- PORTÃO 2: os rebites da ferragem inferior EM CIMA do trilho ----
     Na fibra o trilho descia ~120 mm e a fileira ficava no painel liso. */
  {
    /* O topo do trilho como a RETA entre as duas pontas. O trilho é uma
       EXTRUSÃO — vértice só nas pontas —, então uma fatia de z no meio dele não
       tem vértice nenhum (a 1ª versão deste portão reprovou com "Infinity"); e
       o conjunto é inclinado (~8 cm de ponta a ponta no 8x2), então um topo
       global deixaria passar rebite acima do trilho na ponta baixa. */
    const pts = [];
    const pv = new THREE.Vector3();
    /* POR VÉRTICE, não por malha: a fusão do estúdio junta o trilho de baixo
       e a banda de cima do paleteiro numa malha só (`FUSAO__metal-galvanizado-
       mantido`, do piso ao teto), e um filtro pela caixa da malha a descartava
       inteira — a 1ª rodada deu "0/0" no semirreboque paleteiro. */
    S.state.trailer.traverse((m) => {
      if (!m.isMesh || m.isInstancedMesh || !m.visible || !/galvanizado-mantido/.test(m.material?.name || '')) return;
      const b = new THREE.Box3().setFromObject(m);
      if (b.max.z - b.min.z < 3 || b.max.x < x - 0.06) return;
      const pos = m.geometry.getAttribute('position');
      for (let k = 0; k < pos.count; k++) {
        pv.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld);
        if (pv.x > x - 0.06 && pv.y < piso + 0.5) pts.push(pv.clone());
      }
    });
    const zLo = Math.min(...pts.map((q) => q.z)), zHi = Math.max(...pts.map((q) => q.z));
    const topoPerto = (z0) => Math.max(...pts.filter((q) => Math.abs(q.z - z0) < 0.3).map((q) => q.y));
    const yLo = topoPerto(zLo), yHi = topoPerto(zHi);
    const topoEm = (z) => yLo + (yHi - yLo) * (z - zLo) / ((zHi - zLo) || 1);
    let acima = 0, total = 0, pior = -Infinity;
    const mm = new THREE.Matrix4(), pp = new THREE.Vector3();
    S.state.trailer.traverse((m) => {
      if (!m.isInstancedMesh || !/^RIVET_LOW_R/.test(m.name)) return;
      for (let k = 0; k < m.count; k++) {
        m.getMatrixAt(k, mm); pp.setFromMatrixPosition(mm).applyMatrix4(m.matrixWorld);
        if (pp.z < zLo || pp.z > zHi) continue;
        const folga = pp.y - topoEm(pp.z);
        total++; if (folga > 0) acima++; if (folga > pior) pior = folga;
      }
    });
    out.push([`${n}. rebites da ferragem inferior (flanco direito) no trilho: ${total - acima}/${total} · o mais alto a ${(pior * 1000).toFixed(0)} mm do topo do trilho (${id})`,
      total > 0 && acima === 0]);
  }

  /* ---- PORTÃO 3: nenhum quadro COBERTO pela pele ----
     *"a chapa está sangrando sobre os frames"* (2026-09-29): o painel de
     fibra ficava na frente da perna do Z, da cantoneira e do terço de cima do
     trilho de piso. Raios HORIZONTAIS contra o flanco direito, em 20 pontos ao
     longo do baú, a 12 e a 35 mm para dentro de cada quadro (acima do pé do
     perfil de cima, abaixo do topo do trilho de baixo): o primeiro objeto
     atingido tem de ser metal, nunca o branco. Tudo no referencial da RAIZ,
     onde o baú não está inclinado. */
  {
    const T = S.state.trailer;
    T.updateWorldMatrix(true, true);
    const inv = T.matrixWorld.clone().invert();
    const q = new THREE.Vector3();
    let peleX = -Infinity, peleY0 = Infinity, peleY1 = -Infinity, peleZ0 = Infinity, peleZ1 = -Infinity;
    T.traverse((m) => {
      if (!m.isMesh || m.name !== 'SIDE_R') return;
      const pos = m.geometry.getAttribute('position');
      for (let k = 0; k < pos.count; k++) {
        q.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld).applyMatrix4(inv);
        peleX = Math.max(peleX, q.x); peleY0 = Math.min(peleY0, q.y); peleY1 = Math.max(peleY1, q.y);
        peleZ0 = Math.min(peleZ0, q.z); peleZ1 = Math.max(peleZ1, q.z);
      }
    });
    /* O PLANO LISO da pele: na chapa a pele mais externa é a CRISTA, 5,2 mm à
       frente da parte lisa; na fibra é o próprio painel. Quadro de fora é quem
       chega a esse plano — a 1ª versão aceitava peça 20 mm para DENTRO da pele
       (cantoneira interna, marco da porta) e o pé do perfil de cima saía
       20 cm abaixo dele, reprovando até o gancheiro de fábrica. */
    const planoLiso = peleX - (S.state.implement.skin === 'fibra' ? 0 : 0.0052);
    let topoTrilho = -Infinity, peDoPerfil = Infinity, peDoPerfilTudo = Infinity;
    T.traverse((m) => {
      if (!m.isMesh || m.isInstancedMesh || !m.visible) return;
      const mat = m.material?.name || '';
      if (!/galvanizado-mantido|estrutura-principal/.test(mat)) return;
      const b = new THREE.Box3().setFromObject(m).applyMatrix4(inv);
      if (b.max.z - b.min.z < 2) return;
      const pos = m.geometry.getAttribute('position');
      for (let k = 0; k < pos.count; k++) {
        q.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld).applyMatrix4(inv);
        if (/galvanizado-mantido/.test(mat) && q.y < peleY0 + 0.3 && q.x >= peleX - 0.02) topoTrilho = Math.max(topoTrilho, q.y);
        /* NO MIOLO do baú, longe das pontas — lá moram portal traseiro,
           testeira e montantes, que puxavam a medida para baixo. Mas a banda do
           paleteiro é EXTRUSÃO, com vértice SÓ nas pontas: no semirreboque o
           miolo fica vazio, e aí vale a medida do baú inteiro (`peDoPerfilTudo`). */
        if (q.y > peleY1 - 0.3 && q.x >= planoLiso - 0.001) {
          peDoPerfilTudo = Math.min(peDoPerfilTudo, q.y);
          if (q.z > peleZ0 + 0.3 && q.z < peleZ1 - 0.3) peDoPerfil = Math.min(peDoPerfil, q.y);
        }
      }
    });
    if (!Number.isFinite(peDoPerfil)) peDoPerfil = peDoPerfilTudo;
    const alvosRaio = [];
    T.traverse((m) => { if (m.isMesh && m.visible) alvosRaio.push(m); });
    const ray = new THREE.Raycaster();
    const dirW = new THREE.Vector3(-1, 0, 0).transformDirection(T.matrixWorld);
    /* Duas perguntas por quadro:
       · ABSOLUTA — na faixa em que o quadro é visível por construção (35 e
         60 mm para dentro do perfil de cima; 12 e 35 mm abaixo do topo do
         trilho), o primeiro objeto é metal.
       · COMPARATIVA (só na fibra) — raio a raio, nas faixas rentes (12 e
         20 mm do pé do perfil; 5 e 12 mm do topo do trilho), o isotérmico
         deixa à vista TODO ponto de quadro que o frigorífico do mesmo arranjo
         deixa. É a forma exata da queixa ("a chapa sangra sobre os frames"),
         e é o que a pergunta absoluta não pode fazer sozinha: no bake de
         FÁBRICA a aba mais baixa do perfil Z já fica atrás da parte lisa da
         chapa (medido: 12 mm acima do pé, o raio bate na pele e não há metal
         atrás), então exigir metal ali reprovava o gancheiro aprovado. */
    const raio = (y, k) => {
      const z = peleZ0 + 0.5 + (peleZ1 - peleZ0 - 1.0) * k / 19;
      const o = new THREE.Vector3(peleX + 0.3, y, z).applyMatrix4(T.matrixWorld);
      ray.set(o, dirW);
      const h = ray.intersectObjects(alvosRaio, false)[0];
      if (!h) return null;
      return !/Cor_padrao_branco|metalBranco/.test(h.object.material?.name || '');
    };
    const faixas = {
      'perfil de cima': { abs: [peDoPerfil + 0.035, peDoPerfil + 0.060], rente: [peDoPerfil + 0.012, peDoPerfil + 0.020] },
      'trilho de piso': { abs: [topoTrilho - 0.012, topoTrilho - 0.035], rente: [topoTrilho - 0.005, topoTrilho - 0.012] },
    };
    for (const [rotulo, f] of Object.entries(faixas)) {
      if (![...f.abs, ...f.rente].every(Number.isFinite)) { out.push([`${n}. ${rotulo}: não medido (${id})`, false]); continue; }
      let metal = 0, total = 0;
      for (const y of f.abs) for (let k = 0; k < 20; k++) { const r = raio(y, k); if (r === null) continue; total++; if (r) metal++; }
      out.push([`${n}. ${rotulo} à vista na faixa dele: ${metal}/${total} raios batem no metal antes do branco (${id})`,
        total > 0 && metal === total]);
      const mapa = [];
      for (const y of f.rente) for (let k = 0; k < 20; k++) mapa.push(raio(y, k));
      const chave = `${S.state.implement.kind}|${S.state.implement.arrangement}|${rotulo}`;
      if (S.state.implement.skin !== 'fibra') { if (!mapasChapa.has(chave)) mapasChapa.set(chave, mapa); continue; }
      const ref = mapasChapa.get(chave);
      if (!ref) { out.push([`${n}. ${rotulo}: sem a chapa do mesmo arranjo para comparar (${id})`, false]); continue; }
      const cobertos = mapa.filter((r, i) => ref[i] === true && r !== true).length;
      const vistos = ref.filter((r) => r === true).length;
      out.push([`${n}. ${rotulo} rente à pele: a fibra cobre ${cobertos} de ${vistos} ponto(s) de quadro que a chapa deixa à vista (${id})`,
        cobertos === 0]);
    }
  }

  await foto(`variante-${n}-${id}-1-conjunto`, V(c.x, c.y - 0.2, c.z), V(12, 2.8, -dir * 6), 14, 40);
  await foto(`variante-${n}-${id}-2-perfil`, V(x, top - 0.12, c.z), V(1.0, 0.25, -dir * 0.9), 6, 7);
  await fotoCanto(`variante-${n}-${id}-3-canto-tras`, V(x - 0.1, top - 0.25, tras + dir * 0.25), V(1.0, 0.45, -dir * 0.9), 3.2, 30);
  await fotoCanto(`variante-${n}-${id}-4-canto-frente`, V(x - 0.1, top - 0.25, frente), V(1.0, 0.55, -dir * 0.9), 3.2, 30);
  await fotoCanto(`variante-${n}-${id}-5-testeira`, V(c.x, top - 0.7, frente), V(0.5, 0.7, dir * 1.0), 5.5, 35);
  /* Os três enquadramentos do relato de 2026-09-29. */
  await fotoCanto(`variante-${n}-${id}-6-flanco-rasante`, V(x, c.y + 0.3, c.z + dir * 1.5), V(0.5, 0.18, -dir * 1.0), 5.0, 55);
  await fotoCanto(`variante-${n}-${id}-7-pe-do-flanco`, V(x, piso + 0.1, c.z), V(1.0, 0.12, -dir * 0.35), 4.5, 42);
  await fotoCanto(`variante-${n}-${id}-8-traseira`, V(c.x, c.y - 0.4, tras), V(-0.55, 0.3, -dir * 1.0), 11, 35);
}
return out;
