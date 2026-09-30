/* A PORTA LATERAL NO PAINEL DE FIBRA — a pilha de profundidade, camada a camada.
   ===========================================================================
   *"a porta continua quebrada, analise melhor os níveis z dos elementos"* —
   Kennedy, 2026-09-29, com print da porta do isotérmico: só a moldura e a
   ferragem apareciam, soltas na frente de um painel inteiro.

   A porta de `trailer-door.ts` é uma PILHA medida contra o plano da pele
   (`xSkin`), em milímetros para fora (+) ou para dentro (−):

       moldura galvanizada   +5,0 … −6,2   (anel em volta do vão)
       folha                 −5,1           (a pele recortada, levada para dentro)
       faixas lisas da folha −10,3          (só na chapa frisada)
       marco                 −6,0 … −77,1   (o fundo do vão)
       ferragem              a partir da folha

   Esta bancada abre UMA porta de cada lado pelo caminho do formulário (`addDoor(face)`,
   o mesmo do botão "Adicionar porta") e dispara raios de fora para dentro numa
   grade que atravessa a folha, o vão e a pele em volta. Cada raio diz o que
   bate primeiro e a que profundidade. Roda a chapa e a fibra do MESMO arranjo,
   porque a chapa é a referência de como a porta deve sair.

       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-porta-fibra-0929.mjs */
const out = [];
const B = window.__bench;
await B.until(() => { const o = document.getElementById('ts-selector'); return !!o && o.classList.contains('is-open'); }, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 12; i++) await B.frame();
const THREE = S.THREE;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const acha = (pred) => {
  for (const mk of (S.catalog.catalog?.manufacturers || []))
    for (const mo of (mk.models || []))
      for (const ch of (mo.chassis || [])) if (ch.available !== false && pred(mo, ch)) return { mk, mo, ch };
  return null;
};
const rigido = acha((mo, ch) => mo.id === 'scania-p' && ch.id === '8x2r') || acha((mo) => mo.rigid);

const SO = [];
const DEPURA = false;
const VARIANTES = [
  'sobrechassi-frigorifico-paleteiro',
  'sobrechassi-isotermico-paleteiro',
  'sobrechassi-frigorifico-gancheiro',
  'sobrechassi-isotermico-gancheiro',
].filter((id) => !SO.length || SO.includes(id));

const visivel = (o) => { for (let n = o; n; n = n.parent) if (!n.visible) return false; return true; };
const rotulo = (o) => {
  const nome = o.name || '';
  /* A arte do cliente é uma SOBREPOSIÇÃO que divide a geometria com a chapa
     (`livery.ts`, `renderOrder` 2) — coplanar por construção, não disputa. */
  if (o.userData?.liveryOverlay) return 'arte';
  const mat = (Array.isArray(o.material) ? o.material[0] : o.material)?.name || '';
  if (/^PORTA_MOLDURA/.test(nome)) return 'moldura';
  if (/^PORTA_MARCO/.test(nome)) return 'marco';
  if (/__parametric/.test(mat)) return 'branco';
  if (o.isInstancedMesh) return `ferragem(${nome})`;
  const m0 = Array.isArray(o.material) ? o.material[0] : o.material;
  return `${nome || '?'}[${mat}|${m0?.type}|cw${m0?.colorWrite ? 1 : 0}|pai ${o.parent?.name}|${o.geometry?.attributes?.position?.count}v]`;
};

const fotoCanto = async (nome, alvo, de, dist, fov) => {
  for (let i = 0; i < 4; i++) await B.frame();
  const cam = new THREE.PerspectiveCamera(fov, S.camera.aspect, 0.02, 400);
  cam.position.copy(alvo).addScaledVector(de.clone().normalize(), dist);
  cam.lookAt(alvo);
  cam.updateMatrixWorld();
  S.renderer.render(S.scene, cam);
  out.push([nome, S.renderer.domElement.toDataURL('image/png')]);
};

const ferragens = new Map();
let n = 0;
for (const id of VARIANTES) {
  n++;
  /* Sai das portas da carga anterior: o formulário guarda a lista por face. */
  for (const face of ['left', 'right']) { try { S.measures.setDoorsFor?.(face, []); } catch { /* sem portas */ } }
  await S.applyChoice({
    envId: S.choice?.envId || 'estudio', manufacturerId: rigido.mk.id, modelId: rigido.mo.id,
    chassisId: rigido.ch.id, colorId: null, finishId: null, implementId: id,
  }, { curtain: false });
  await B.until(() => S.state.implement?.id === id && !!S.state.trailerRig, 180000).catch(() => null);
  const trocou = S.state.implement?.id === id;
  out.push([`trocou para ${id}`, trocou]);
  if (!trocou) continue;
  for (let i = 0; i < 40; i++) await B.frame();

  const rig = S.state.trailerRig;
  const body = rig.body;
  /* As DUAS laterais: a porta pode ir em qualquer uma, e cada uma tem o seu
     `skinX`, o seu sinal e a sua pele. */
  for (const face of ['left', 'right']) {
    const xSkin = body.skinX[face];
    const sign = face === 'right' ? 1 : -1;
    const F = face === 'right' ? 'D' : 'E';
    /* Profundidade em mm, positiva PARA FORA da pele. */
    const prof = (x) => +(((x - xSkin) * sign) * 1000).toFixed(2);

    /* A geometria do corpo está no espaço da MALHA do corpo (o grupo dele
       desfaz a matriz do implemento, e o conjunto é levado ao chassi depois):
       `skinX`, `doorHoles` e `profile` são desse espaço. O raio sai dele para o
       mundo e o ponto batido volta — senão o raio passa ao lado do baú e a
       grade inteira diz "nada". */
    body.mesh.updateWorldMatrix(true, false);
    const M = body.mesh.matrixWorld;
    const raycaster = new THREE.Raycaster();
    const raios = (y, z) => {
      const o = V(xSkin + sign * 1.0, y, z).applyMatrix4(M);
      const f = V(xSkin - sign * 0.3, y, z).applyMatrix4(M);
      const dir = f.clone().sub(o);
      raycaster.set(o, dir.clone().normalize());
      raycaster.near = 0; raycaster.far = dir.length();
      return raycaster.intersectObject(S.state.trailer, true)
        .filter((h) => visivel(h.object))
        .map((h) => ({ o: rotulo(h.object), d: prof(body.mesh.worldToLocal(h.point.clone()).x) }));
    };
    const primeiro = (y, z) => raios(y, z)[0] || { o: 'nada', d: NaN };

    /* A pele SEM porta, no meio do flanco: o plano de referência. */
    const p = rig.profile;
    const zMeio = (body.profile.z0 + body.profile.z1) / 2;
    const yMeio = (p.floorY + p.roofY) / 2;
    const pele = [];
    for (let k = 0; k < 12; k++) pele.push(primeiro(yMeio + k * 0.0045, zMeio + 1.3).d);
    out.push([`${n}${F}. pele sem porta (${id})`, JSON.stringify({
      skin: S.state.implement.skin || 'chapa', xSkin: +xSkin.toFixed(4),
      profMin: Math.min(...pele), profMax: Math.max(...pele),
    })]);

    /* A porta, pelo caminho do formulário. */
    S.measures.addDoor(face);
    await B.until(() => (body.doorHoles.get(face) || []).length > 0, 20000).catch(() => null);
    for (let i = 0; i < 30; i++) await B.frame();
    const hole = (body.doorHoles.get(face) || [])[0];
    out.push([`${n}${F}. porta aberta (${id})`, !!hole]);
    if (!hole) continue;
    const REV = 0.0944;
    const leaf = { y0: hole.y0 + REV, y1: hole.y1 - REV, z0: hole.z0 + REV, z1: hole.z1 - REV };
    if (DEPURA) out.push([`${n}${F}. [depura] folha y ${leaf.y0.toFixed(3)}…${leaf.y1.toFixed(3)} z ${leaf.z0.toFixed(3)}…${leaf.z1.toFixed(3)} · vão z ${hole.z0.toFixed(3)}…${hole.z1.toFixed(3)}`, true]);

    /* A GRADE: 5 colunas × 40 linhas por região. */
    const regioes = {
      folha: { ys: [leaf.y0 + 0.02, leaf.y1 - 0.02], zs: [leaf.z0 + 0.25, leaf.z1 - 0.25] },
      vao: { ys: [leaf.y0 + 0.2, leaf.y1 - 0.2], zs: [leaf.z0 - REV * 0.5, leaf.z0 - REV * 0.5] },
      moldura: { ys: [leaf.y0 + 0.2, leaf.y1 - 0.2], zs: [hole.z0 - 0.004, hole.z0 - 0.004] },
      pele: { ys: [leaf.y0 + 0.2, leaf.y1 - 0.2], zs: [hole.z0 - 0.25, hole.z0 - 0.25] },
    };
    for (const [nome, r] of Object.entries(regioes)) {
      const cont = new Map();
      let colados = 0, total = 0, exemplo = '';
      for (let i = 0; i < 40; i++) for (let j = 0; j < 5; j++) {
        const y = r.ys[0] + (r.ys[1] - r.ys[0]) * (i / 39);
        const z = r.zs[0] + (r.zs[1] - r.zs[0]) * (j / 4);
        const hs = raios(y, z).filter((x) => x.o !== 'arte');
        total++;
        const h = hs[0] || { o: 'nada', d: NaN };
        const chave = `${h.o}@${Number.isFinite(h.d) ? h.d.toFixed(1) : '—'}`;
        cont.set(chave, (cont.get(chave) || 0) + 1);
        /* DUAS superfícies de malhas diferentes a menos de 0,3 mm: disputa de
           profundidade — pisca ou "sangra". */
        if (hs[1] && hs[1].o !== h.o && Math.abs(hs[1].d - h.d) < 0.3) {
          colados++;
          if (!exemplo) exemplo = hs.slice(0, 4).map((x) => `${x.o}@${x.d}`).join(' / ');
        }
      }
      if (exemplo) out.push([`${n}${F}. ${nome}: exemplo de par colado → ${exemplo}`, true]);
      const lista = [...cont.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([k, v]) => `${k}×${v}`).join(' · ');
      out.push([`${n}${F}. ${nome}: ${lista}`, !cont.has('nada@—')]);
      /* O QUE CADA REGIÃO TEM DE MOSTRAR. Na fibra a folha é UM plano, a
         `LEAF_INSET` (5,1 mm) atrás da pele; na chapa ela é friso, e a chapa é a
         referência, não o alvo. Até 5 % dos raios podem bater em ferragem. */
      const fibra = S.state.implement.skin === 'fibra';
      const alvo = { folha: fibra ? 'branco@-5.1' : null, vao: 'marco@-6.0', moldura: 'moldura@5.0',
        pele: fibra ? 'branco@0.0' : null }[nome];
      if (alvo) {
        const acertos = cont.get(alvo) || 0;
        out.push([`${n}${F}. ${nome}: ${acertos}/${total} raios em ${alvo} (${id})`, acertos >= total * 0.95]);
      }
      out.push([`${n}${F}. ${nome}: pares colados (<0,3 mm) ${colados}/${total} (${id})`, colados === 0]);
    }

    /* A FERRAGEM, peça a peça. Para cada instância: a caixa dela em profundidade
       (costas e frente, em mm para fora da pele) e a superfície em que ela se
       apoia no centro da peça — a pele/folha, o marco ou a moldura, o que o raio
       de fora achar primeiro atrás da FRENTE da peça. `folga` = costas −
       apoio: ~0 ou negativa é peça parafusada; positiva é peça no ar; e a frente
       atrás do apoio é peça ENTERRADA (some). */
    /* A pele lateral NÃO mora mais em `body.mesh`: `buildLiveryPanels()`
       (models.ts) tira os triângulos dela para o painel `SIDE_L`, e o que sobra
       no corpo é forro e acabamento. Apoio é todo branco paramétrico visível
       (menos a arte, que é sobreposição) mais o marco e a moldura. */
    const apoios = [...body.jambs.values()];
    S.state.trailer.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.userData?.liveryOverlay || !visivel(o)) return;
      if (/__parametric/.test((Array.isArray(o.material) ? o.material[0] : o.material)?.name || '')) apoios.push(o);
    });
    const apoioEm = (y, z, frente) => {
      const o = V(xSkin + sign * 1.0, y, z).applyMatrix4(M);
      const f = V(xSkin - sign * 0.3, y, z).applyMatrix4(M);
      const dir = f.clone().sub(o);
      raycaster.set(o, dir.clone().normalize());
      raycaster.near = 0; raycaster.far = dir.length();
      const hs = raycaster.intersectObjects(apoios, false)
        .map((h) => ({ o: rotulo(h.object), d: prof(body.mesh.worldToLocal(h.point.clone()).x) }));
      return { primeiro: hs[0] || null, apoio: hs.find((h) => h.d <= frente + 0.05) || null };
    };
    const pecas = {};
    const Mi = new THREE.Matrix4();
    const caixa = new THREE.Box3();
    for (const [chave, im] of body.inst) {
      if (chave.split('|')[1] !== face) continue;
      const parte = chave.split('|')[0];
      im.updateWorldMatrix(true, false);
      im.geometry.computeBoundingBox();
      const r = pecas[parte] || (pecas[parte] = { n: 0, enterradas: 0, folgas: [], sobre: new Map(), fundos: [] });
      for (let i = 0; i < im.count; i++) {
        im.getMatrixAt(i, Mi);
        caixa.copy(im.geometry.boundingBox).applyMatrix4(Mi).applyMatrix4(im.matrixWorld);
        const cs = [];
        for (const cx of [caixa.min.x, caixa.max.x]) for (const cy of [caixa.min.y, caixa.max.y]) for (const cz of [caixa.min.z, caixa.max.z])
          cs.push(body.mesh.worldToLocal(V(cx, cy, cz)));
        const ds = cs.map((v) => prof(v.x));
        const costas = Math.min(...ds), frente = Math.max(...ds);
        const cy = cs.reduce((a, v) => a + v.y, 0) / 8, cz = cs.reduce((a, v) => a + v.z, 0) / 8;
        const { primeiro, apoio } = apoioEm(cy, cz, frente);
        r.n++;
        r.fundos.push(costas, frente);
        if (DEPURA && i === 0) {
          const todos = (() => {
            const o = V(xSkin - 1.0, cy, cz).applyMatrix4(M), f = V(xSkin + 0.3, cy, cz).applyMatrix4(M);
            const dir = f.clone().sub(o); raycaster.set(o, dir.clone().normalize()); raycaster.far = dir.length();
            return raycaster.intersectObjects(apoios, false).map((h) => `${rotulo(h.object)}@${prof(body.mesh.worldToLocal(h.point.clone()).x)}`).join(' ');
          })();
          out.push([`${n}${F}. [depura] ${parte}: costas ${costas} frente ${frente} y ${cy.toFixed(3)} z ${cz.toFixed(3)} · apoios: ${todos}`, true]);
        }
        if (primeiro && primeiro.d > frente + 0.05) r.enterradas++;
        if (apoio) {
          r.folgas.push(+(costas - apoio.d).toFixed(1));
          r.sobre.set(apoio.o, (r.sobre.get(apoio.o) || 0) + 1);
        }
      }
    }
    const resumo = {};
    for (const [parte, r] of Object.entries(pecas)) {
      const f = r.folgas.slice().sort((a, b) => a - b);
      resumo[parte] = { n: r.n, enterradas: r.enterradas, fundos: r.fundos,
        folgaMin: f.length ? f[0] : NaN, folgaMax: f.length ? f[f.length - 1] : NaN,
        folga: f.length ? `${f[0]}…${f[f.length - 1]}` : '—',
        sobre: [...r.sobre.entries()].map(([k, v]) => `${k}×${v}`).join(',') };
    }
    ferragens.set(`${id}|${face}`, resumo);
    for (const [parte, r] of Object.entries(resumo)) {
      out.push([`${n}${F}. ferragem ${parte}: ${r.n} peça(s), folga ${r.folga} mm sobre ${r.sobre}, ${r.enterradas} enterrada(s) (${id})`,
        r.enterradas === 0]);
    }
    /* A FIBRA CONTRA A CHAPA DO MESMO ARRANJO — dois portões, e nenhum deles é
       "a mesma folga". A folga na chapa é medida contra o que o raio acha no
       centro da peça: crista, vale ou faixa lisa (−10,3 mm), conforme a altura.
       Na fibra a folha é um plano só, a −5,1. Comparar as duas folgas reprova a
       fibra por não ter friso.

       1. A ferragem MORA NO MESMO LUGAR em relação à pele — costas e frente de
          cada instância iguais (±0,1 mm). A porta é montada contra `xSkin` nas
          duas, e é isso que prova que nada foi deslocado para acomodar a fibra.
       2. As BASES parafusadas na folha (a tala da dobradiça, o cabeçote, a guia
          e o suporte dela, o manípulo, a alavanca, o trinco) ficam ASSENTADAS
          na folha lisa: 0 a 1,5 mm de folga. Negativo é peça enterrada na folha;
          mais que isso é peça no ar. */
    if (S.state.implement.skin === 'fibra') {
      const ref = ferragens.get(`${id.replace('isotermico', 'frigorifico')}|${face}`);
      if (!ref) out.push([`${n}${F}. ferragem: sem a chapa do mesmo arranjo para comparar (${id})`, false]);
      else for (const [parte, r] of Object.entries(resumo)) {
        const a = ref[parte];
        if (!a || a.fundos.length !== r.fundos.length) {
          out.push([`${n}${F}. ferragem ${parte}: contagem difere da chapa (${a?.n ?? 0} × ${r.n}) (${id})`, false]);
          continue;
        }
        const dif = Math.max(...r.fundos.map((v, k) => Math.abs(v - a.fundos[k])));
        out.push([`${n}${F}. ferragem ${parte}: mesma profundidade da chapa (±${dif.toFixed(2)} mm) (${id})`, dif <= 0.1]);
      }
      for (const parte of ['TALA', 'CABECOTE', 'GUIA', 'SUPORTE_GUIA', 'MANIPULO', 'ALAVANCA', 'TRINCO']) {
        const r = resumo[parte];
        const ok = !!r && r.sobre === `branco×${r.n}` && r.folgaMin >= 0 && r.folgaMax <= 1.5;
        out.push([`${n}${F}. ${parte} assentada na folha lisa: folga ${r?.folga ?? '—'} mm (${id})`, ok]);
      }
    }

    const W = (x, y, z) => V(x, y, z).applyMatrix4(M);
    const Wd = (x, y, z) => V(x, y, z).transformDirection(M);
    const xc = xSkin;
    const yc = (leaf.y0 + leaf.y1) / 2;
    const zc = (leaf.z0 + leaf.z1) / 2;
    await fotoCanto(`porta-${n}${F}-${id}-1-frente`, W(xc, yc, zc), Wd(sign, 0.1, 0.05), 4.0, 40);
    await fotoCanto(`porta-${n}${F}-${id}-2-obliqua`, W(xc, yc, zc), Wd(sign * 0.6, 0.2, 0.8), 3.2, 45);
    await fotoCanto(`porta-${n}${F}-${id}-3-borda`, W(xc, leaf.y0 + 0.1, hole.z0), Wd(sign * 0.5, 0.25, -0.85), 1.2, 40);
    await fotoCanto(`porta-${n}${F}-${id}-4-rasante`, W(xc, yc, hole.z1), Wd(sign * 0.25, 0.05, 1.0), 1.8, 40);
    try { S.measures.setDoorsFor?.(face, []); } catch { /* ok */ }
    await B.until(() => !(body.doorHoles.get(face) || []).length, 20000).catch(() => null);
  }
}
return out;
