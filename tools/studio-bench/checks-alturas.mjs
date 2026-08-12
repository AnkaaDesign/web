/* ALTURAS × LATERAL — a régua de regressão para os dois defeitos do resize.
   ---------------------------------------------------------------------------
   Roda pela bancada com a geometria e o caminho REAIS do editor:

       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-alturas.mjs

   CONTEXTO. Dois consertos estão em andamento: (A) a banda inferior da
   lateral que aparece FORA do recorte da chapa e (B) o desalinhamento do
   metálico lateral×testeira. O relato do usuário liga os dois ao RESIZE.
   Este arquivo não conserta nada: ele MEDE, em [fábrica, 2.4, 2.6, 3.0,
   3.5] m, tudo o que os dois defeitos tocam, e fotografa. Rodado antes e
   depois dos consertos, a diferença dos números É a prova.

   O que ele mede por altura, e por quê:

     1. Topo/fundo LOCAIS do SIDE_L — o datum de tudo (a chapa recortada,
        piso→teto; ver truck-studio-livery-per-piece-2026-08-11). O pé tem de
        ficar IMÓVEL entre alturas (o piso não anda) e a altura da caixa tem
        de bater com trailerDims.height.
     2. Rebites da emenda: contagem instanciada (SIDE_L_RIVETS,
        userData.rivets) × grade publicada (getPlateGrid), y do mais baixo e
        do mais alto, e BURACOS na coluna (vão > 1,6× o passo mediano =
        fileira faltando).
     3. Topo do trilho lateral × topo da testeira — malhas METÁLICAS do
        assembly, caixa em coordenada LOCAL do conjunto (o rig GIRA no
        engate; caixa de mundo é a mentira já documentada). Degrau ≠ 0 é o
        defeito B em número.
     4. Faixas de corpo branco no SLAB da lateral que NÃO pertencem ao
        SIDE_L: triângulos brancos do TRAILER_BODY com |x − crista| < 100 mm,
        agrupados por faixa de y. Profundidade < 45 mm = NA FRENTE do plano
        da chapa = visível = defeito A. As três fitas de recobrimento a
        ~66 mm (1083/1868/2673 mm do pé) são ESPERADAS e ficam atrás da pele
        — o relatório as nomeia para ninguém as reconfundir com defeito.
     5. Fotos ortográficas: lateral inteira (com 0,55 m abaixo do pé, onde
        moram trilho/soleira/risca) e canto DIANTEIRO inteiro (onde lateral e
        testeira se encontram). Câmera pelos uv1 da própria malha e LUZ
        PRÓPRIA durante a foto — o distrito à noite esconde qualquer defeito.

   NADA AQUI USA COORDENADA DE MUNDO para geometria: sondas e caixas são
   levadas ao referencial LOCAL do conjunto por matrizes relativas. Só a
   câmera usa mundo, ancorada nos próprios cantos uv1 da malha. */
const out = [];
const B = window.__bench;

/* O SELETOR AINDA NÃO EXISTE quando este arquivo começa a rodar — sem esperar
   `is-open`, settle() devolve true por VACUIDADE e o boot trava no seletor
   para sempre (o "__studio de pé FALHA" com o passo Cenário intocado). */
await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);

/* Atravessa o seletor PREFERINDO os modelos cujo GLB existe em `web/public`
   (scania/volvo/iveco) — o primeiro card da grade pode apontar um arquivo que
   só existe na árvore da API. */
async function settle() {
  const overlay = document.getElementById('ts-selector');
  if (!overlay) return true;
  for (let step = 0; step < 12; step++) {
    if (overlay.classList.contains('hidden')) return true;
    const cards = [...overlay.querySelectorAll('.ts-card:not([disabled])')];
    if (!cards.length) break;
    const local = cards.find((c) => /scania|volvo|iveco/i.test(c.dataset.id || ''));
    (local || cards[0]).click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  return overlay.classList.contains('hidden');
}

out.push(['seletor atravessado', await settle()]);
out.push(['__studio de pé', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;
out.push(['implemento carregado', await B.until(() => !!S.trailerRig, 240000)]);
if (!S.trailerRig) return out;
await B.frame(); await B.frame();

const THREE = S.THREE;
const scene = S.scene;
const M = S.models;

/* Renderizador PRÓPRIO: câmera e canvas do app ficam intactos. */
const canvas = document.createElement('canvas');
const rr = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
rr.setPixelRatio(1);
rr.outputColorSpace = THREE.SRGBColorSpace;
rr.toneMapping = S.renderer.toneMapping;
rr.toneMappingExposure = S.renderer.toneMappingExposure;

const panelOf = (name) => S.trailer?.getObjectByName(name) ?? null;
const mm = (v) => Math.round(v * 1000);
const matNamesOf = (o) => (Array.isArray(o.material) ? o.material : [o.material])
  .map((m) => (m && m.name) || '?').join('+');

/** Caixa LOCAL pelo atributo de posição — o referencial que não gira. */
function localBox(mesh) {
  const pos = mesh.geometry.getAttribute('position');
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) b.expandByPoint(v.fromBufferAttribute(pos, i));
  return b;
}

/** O vértice cujo uv1 mais se aproxima do alvo, em MUNDO (só para a foto). */
function cornerOf(mesh, u, v) {
  const uv = mesh.geometry.getAttribute('uv1');
  const pos = mesh.geometry.getAttribute('position');
  if (!uv || !pos) return null;
  mesh.updateWorldMatrix(true, false);
  let best = Infinity, bi = -1;
  for (let i = 0; i < uv.count; i++) {
    const du = uv.getX(i) - u, dv = uv.getY(i) - v;
    const d = du * du + dv * dv;
    if (d < best) { best = d; bi = i; }
  }
  const p = new THREE.Vector3().fromBufferAttribute(pos, bi).applyMatrix4(mesh.matrixWorld);
  return { p, erroUV: Math.sqrt(best) };
}

/* MATÉRIA METÁLICA do assembly — menos rodas/pneus, que não interessam a
   trilho nenhum. Os nomes vêm SEM âncora de propósito: desde 2026-08-12 o
   engine clona `inox-ferragem` e `metal-pouco-polido` em `…__polido` e
   `…__caixa` (ver `splitTrailerHardware()` em models.ts), e esta lista quer as
   três variantes — o que se mede aqui é GEOMETRIA, e ela não se dividiu. Por
   isso esta não é mais a mesma lista de `TRAILER_STRUCT_METAL_RE`, que hoje
   nomeia só o acabamento acetinado. */
const METAL_RE = /galvanizado|estrutura-principal|inox|metal-pouco-polido|metal-claro/i;
/* O branco do corpo paramétrico (o clone ganha sufixo `__parametric`). */
const WHITE_RE = /Cor_padrao_branco|metalBranco/i;
/* O que NUNCA é assembly: as chapas de livery e o que buildLiveryPanels cria. */
const NOT_ASSEMBLY_RE = /^(SIDE_L|SIDE_R|REAR|TRAILER_BODY|bench-stand-in)$|_RIVETS$|^LIVERY_(SILL|HEM)_[LR]$/;

/**
 * Caixas das malhas METÁLICAS do assembly, no referencial LOCAL do conjunto.
 * `refInv` é a inversa da matriz de mundo do `trailer` — a MESMA base em que
 * as posições do SIDE_L já estão escritas (buildLiveryPanels transforma a
 * sopa por trailer.matrixWorld⁻¹ e pendura a malha sem transform próprio),
 * então tudo aqui é comparável com a caixa local da chapa, gire o engate o
 * quanto girar. InstancedMesh entra instância a instância.
 */
function metalBoxes(refInv) {
  const found = [];
  const rel = new THREE.Matrix4();
  const tmp = new THREE.Matrix4();
  const v = new THREE.Vector3();
  S.trailer.updateWorldMatrix(true, true);
  S.trailer.traverse((node) => {
    const o = node;
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    if (NOT_ASSEMBLY_RE.test(o.name || '')) return;
    const mats = matNamesOf(o);
    if (!METAL_RE.test(mats)) return;
    o.geometry.computeBoundingBox();          // o assembly REESCREVE posições no resize
    const gb = o.geometry.boundingBox;
    if (!gb || !isFinite(gb.min.x)) return;
    rel.copy(refInv).multiply(o.matrixWorld);
    const box = new THREE.Box3();
    const corners = [];
    for (const x of [gb.min.x, gb.max.x]) {
      for (const y of [gb.min.y, gb.max.y]) {
        for (const z of [gb.min.z, gb.max.z]) corners.push([x, y, z]);
      }
    }
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        tmp.fromArray(o.instanceMatrix.array, i * 16).premultiply(rel);
        for (const c of corners) box.expandByPoint(v.set(c[0], c[1], c[2]).applyMatrix4(tmp));
      }
    } else {
      for (const c of corners) box.expandByPoint(v.set(c[0], c[1], c[2]).applyMatrix4(rel));
    }
    found.push({ name: o.name || '(sem nome)', mats, box });
  });
  return found;
}

/** Foto ortográfica ancorada nos cantos uv1 do SIDE_L, com luz própria. */
function shoot(mesh, cA, uDir, vDir, nDir, cx, cy, w, h, ppm, name) {
  const centre = cA.p.clone().addScaledVector(uDir, cx).addScaledVector(vDir, cy);
  const wPx = Math.min(3600, Math.round(w * ppm));
  const hPx = Math.min(3600, Math.round(h * ppm));
  rr.setSize(wPx, hPx, false);
  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.05, 9);
  cam.position.copy(centre).addScaledVector(nDir, 4);
  cam.up.copy(vDir).negate();
  cam.lookAt(centre);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  /* LUZ DE BANCADA só durante a foto — o distrito à noite esconde tudo. */
  const lamp = new THREE.DirectionalLight(0xffffff, 2.5);
  lamp.position.copy(cam.position);
  lamp.target.position.copy(centre);
  const amb = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(lamp, lamp.target, amb);
  rr.render(scene, cam);
  scene.remove(lamp, lamp.target, amb);
  const cc = document.createElement('canvas');
  cc.width = wPx; cc.height = hPx;
  cc.getContext('2d').drawImage(canvas, 0, 0);
  out.push([name, cc.toDataURL('image/png')]);
}

/* O pé de fábrica, capturado na primeira bateria — o piso não anda, então
   qualquer deriva do pé entre alturas é defeito por si. */
let footFabrica = null;

/* ---------------- a bateria, uma por altura ---------------- */
async function battery(tag) {
  const mesh = panelOf('SIDE_L');
  if (!mesh) { out.push([`${tag}: SIDE_L`, false]); return; }
  const lb = localBox(mesh);
  const dims = S.trailerDims;
  const prof = S.trailerRig.profile;
  const crest = lb.min.x;                  // o lado de FORA do SIDE_L é o menor x local
  const foot = lb.min.y, top = lb.max.y;
  const zRear = lb.min.z, zFront = lb.max.z;   // mapZ prende a testeira: frente = maior z

  /* 1 — o datum. */
  out.push([`${tag}: SIDE_L y local topo/fundo (m)`,
    { topo: +top.toFixed(4), fundo: +foot.toFixed(4), altura_mm: mm(top - foot) }]);
  const dH = Math.abs((top - foot) - dims.height) * 1000;
  out.push([`${tag}: altura da chapa == trailerDims.height (Δmm)`, dH < 8 ? true : +dH.toFixed(1)]);
  if (footFabrica === null) footFabrica = foot;
  else {
    const drift = Math.abs(foot - footFabrica) * 1000;
    out.push([`${tag}: pé do SIDE_L imóvel vs fábrica (Δmm)`, drift < 3 ? true : +drift.toFixed(1)]);
  }

  /* 2 — os rebites: instância × grade, extremos e buracos. */
  const grid = M.getPlateGrid ? M.getPlateGrid() : null;
  const inst = mesh.getObjectByName('SIDE_L_RIVETS');
  if (!grid || !grid.seamsFromFront.length) {
    out.push([`${tag}: grade de chapas publicada`, false]);
  } else {
    const rows = grid.rivetRowsFromBottom.slice().sort((a, b) => a - b);
    const want = grid.seamsFromFront.length * rows.length;
    const got = inst ? (inst.userData.rivets ?? null) : null;
    out.push([`${tag}: fileiras de rebite (grade × instância)`, {
      fileiras: rows.length,
      emendas: grid.seamsFromFront.length,
      instanciados: got,
      esperados: want,
      bate: got === want,
    }]);
    /* Os extremos, pelos DOIS caminhos: a grade (fonte) e a geometria fundida
       dos rebites (produto) — a calota tem raio 9 mm em y. */
    const gLo = foot + rows[0], gHi = foot + rows[rows.length - 1];
    let vLo = Infinity, vHi = -Infinity;
    if (inst) {
      const rp = inst.geometry.getAttribute('position');
      for (let i = 0; i < rp.count; i++) {
        const y = rp.getY(i);
        if (y < vLo) vLo = y; if (y > vHi) vHi = y;
      }
    }
    out.push([`${tag}: rebite mais baixo/alto (y local, m)`, {
      grade: { baixo: +gLo.toFixed(4), alto: +gHi.toFixed(4) },
      malha: inst && isFinite(vLo)
        ? { baixo: +(vLo + 0.009).toFixed(4), alto: +(vHi - 0.009).toFixed(4) }
        : '(sem malha)',
      do_pe_mm: { baixo: mm(gLo - foot), alto: mm(gHi - foot) },
      do_topo_mm: mm(top - gHi),
    }]);
    /* A contagem esperada pela grade do friso — a mesma régua de
       checks-livery: ribs correntes ± a folga do topo sob a cantoneira. */
    const n = prof.ribCount + Math.round((dims.height - prof.base.height) / prof.pitch);
    out.push([`${tag}: um rebite por rebaixo (${n} frisos correntes)`,
      rows.length >= n - 5 && rows.length <= n + 1 ? true : rows.length]);
    /* Buracos: vão > 1,6× o passo mediano = fileira faltando ali. */
    if (rows.length >= 3) {
      const gaps = [];
      for (let i = 1; i < rows.length; i++) gaps.push(rows[i] - rows[i - 1]);
      const med = gaps.slice().sort((a, b) => a - b)[gaps.length >> 1];
      const holes = [];
      for (let i = 1; i < rows.length; i++) {
        const g = rows[i] - rows[i - 1];
        if (g > med * 1.6) {
          holes.push({ do_pe_mm: [mm(rows[i - 1]), mm(rows[i])], vao_mm: mm(g), passo_mm: mm(med) });
        }
      }
      out.push([`${tag}: buracos na coluna de rebites`, holes.length ? holes : true]);
    }
  }

  /* 3 — trilho lateral × testeira, por caixa LOCAL das malhas do assembly. */
  {
    mesh.updateWorldMatrix(true, false);
    const refInv = mesh.matrixWorld.clone().invert();   // = base local do conjunto
    const metal = metalBoxes(refInv);
    const near = (a, b, tol) => Math.abs(a - b) <= tol;
    /* Trilho LATERAL esquerdo: corrido em z, seção rasa, encostado na crista. */
    const sideRails = metal.filter((p) => {
      const b = p.box;
      return (b.max.z - b.min.z) >= 3
        && (b.max.x - b.min.x) <= 0.6
        && b.min.x <= crest + 0.25 && b.min.x >= crest - 0.30;
    });
    /* TESTEIRA: corrido em x (atravessa o baú), colado na frente. */
    const frontPieces = metal.filter((p) => {
      const b = p.box;
      return (b.max.x - b.min.x) >= 1.0
        && (b.max.z - b.min.z) <= 1.0
        && b.max.z >= zFront - 0.5;
    });
    const tops = (list) => list
      .filter((p) => p.box.max.y >= top - 0.6)
      .sort((a, b) => b.box.max.y - a.box.max.y);
    const feet = (list) => list
      .filter((p) => p.box.min.y <= foot + 0.15)
      .sort((a, b) => a.box.min.y - b.box.min.y);
    const sideTops = tops(sideRails), frontTops = tops(frontPieces);
    const describe = (p) => ({
      malha: p.name, material: p.mats,
      topo_y_m: +p.box.max.y.toFixed(4),
      do_topo_da_chapa_mm: mm(p.box.max.y - top),
    });
    out.push([`${tag}: trilho de TOPO lateral (candidatos)`,
      sideTops.length ? sideTops.slice(0, 5).map(describe) : '(nenhuma malha)']);
    out.push([`${tag}: topo da TESTEIRA (candidatos)`,
      frontTops.length ? frontTops.slice(0, 5).map(describe) : '(nenhuma malha)']);
    if (sideTops.length && frontTops.length) {
      const step = (sideTops[0].box.max.y - frontTops[0].box.max.y) * 1000;
      out.push([`${tag}: degrau lateral×testeira no TOPO (mm, + = lateral acima)`,
        near(step, 0, 6) ? true : +step.toFixed(1)]);
    }
    /* E o pé, para o registro — o trilho inferior também é metálico e também
       tem contraparte na testeira. */
    const sideFeet = feet(sideRails), frontFeet = feet(frontPieces);
    if (sideFeet.length && frontFeet.length) {
      const step = (sideFeet[0].box.min.y - frontFeet[0].box.min.y) * 1000;
      out.push([`${tag}: degrau lateral×testeira no PÉ (mm, + = lateral acima)`,
        near(step, 0, 6) ? true : +step.toFixed(1)]);
    }
  }

  /* 4 — faixas de corpo branco no slab da lateral, fora do SIDE_L. */
  {
    const body = panelOf('TRAILER_BODY');
    if (!body) out.push([`${tag}: TRAILER_BODY`, '(ausente)']);
    else if (!WHITE_RE.test(matNamesOf(body))) {
      out.push([`${tag}: TRAILER_BODY branco`, matNamesOf(body)]);
    } else {
      mesh.updateWorldMatrix(true, false);
      body.updateWorldMatrix(true, false);
      const rel = mesh.matrixWorld.clone().invert().multiply(body.matrixWorld);
      const bp = body.geometry.getAttribute('position');
      const bidx = body.geometry.index ? body.geometry.index.array : null;
      const tris = Math.floor((bidx ? bidx.length : bp.count) / 3);
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      const found = [];
      for (let t = 0; t < tris; t++) {
        const i0 = bidx ? bidx[t * 3] : t * 3;
        const i1 = bidx ? bidx[t * 3 + 1] : t * 3 + 1;
        const i2 = bidx ? bidx[t * 3 + 2] : t * 3 + 2;
        a.fromBufferAttribute(bp, i0).applyMatrix4(rel);
        b.fromBufferAttribute(bp, i1).applyMatrix4(rel);
        c.fromBufferAttribute(bp, i2).applyMatrix4(rel);
        const cx = (a.x + b.x + c.x) / 3;
        if (Math.abs(cx - crest) >= 0.1) continue;              // fora do slab
        const cz = (a.z + b.z + c.z) / 3;
        if (cz < zRear - 0.05 || cz > zFront + 0.05) continue;  // fora da lateral
        found.push({
          yMid: (a.y + b.y + c.y) / 3,
          yLo: Math.min(a.y, b.y, c.y), yHi: Math.max(a.y, b.y, c.y),
          dLo: Math.min(a.x, b.x, c.x) - crest, dHi: Math.max(a.x, b.x, c.x) - crest,
        });
      }
      found.sort((p, q) => p.yMid - q.yMid);
      const bands = [];
      for (const f of found) {
        const cur = bands[bands.length - 1];
        if (cur && f.yMid - cur.lastMid <= 0.06) {
          cur.lastMid = f.yMid;
          cur.yLo = Math.min(cur.yLo, f.yLo); cur.yHi = Math.max(cur.yHi, f.yHi);
          cur.dLo = Math.min(cur.dLo, f.dLo); cur.dHi = Math.max(cur.dHi, f.dHi);
          cur.tris++;
        } else {
          bands.push({ lastMid: f.yMid, yLo: f.yLo, yHi: f.yHi, dLo: f.dLo, dHi: f.dHi, tris: 1 });
        }
      }
      /* Profundidade < 45 mm = na frente do plano da chapa (slab de 40 mm +
         remonte) = VISÍVEL. As fitas de recobrimento moram a ~66 mm. */
      const report = bands.map((bd) => ({
        y_mm: [mm(bd.yLo), mm(bd.yHi)],
        do_pe_mm: [mm(bd.yLo - foot), mm(bd.yHi - foot)],
        prof_da_crista_mm: [mm(bd.dLo), mm(bd.dHi)],
        tris: bd.tris,
        visivel: bd.dLo < 0.045,
        nota: bd.dLo >= 0.045 && bd.dLo <= 0.09 && (bd.yHi - bd.yLo) < 0.15
          ? 'fita de recobrimento (esperada, atrás da pele)' : undefined,
      }));
      out.push([`${tag}: faixas brancas do CORPO no slab (|x−crista|<100mm)`,
        report.length ? report : '(nenhuma)']);
      const visible = report.filter((r) => r.visivel);
      out.push([`${tag}: nenhuma faixa branca VISÍVEL fora do SIDE_L`,
        visible.length ? visible : true]);
    }
  }

  /* 5 — as fotos: lateral inteira e canto dianteiro, luz própria. */
  {
    const cA = cornerOf(mesh, 0, 0), cB = cornerOf(mesh, 1, 0), cC = cornerOf(mesh, 1, 1);
    if (cA && cB && cC) {
      const uDir = new THREE.Vector3().subVectors(cB.p, cA.p);
      const len = uDir.length(); uDir.normalize();
      const vDir = new THREE.Vector3().subVectors(cC.p, cB.p);
      const hgt = vDir.length(); vDir.normalize();
      const nDir = new THREE.Vector3().crossVectors(vDir, uDir).normalize();
      /* Lateral inteira, com 0,55 m ABAIXO do pé (trilho, soleira, risca). */
      shoot(mesh, cA, uDir, vDir, nDir,
        len / 2, hgt / 2 + 0.2, len + 0.4, hgt + 0.7, 200, `${tag}-lateral`);
      /* Canto DIANTEIRO (u=1 é a frente — mapZ prende a testeira), inteiro do
         teto ao chassi, 0,2 m além da ponta para pegar a quina com a testeira. */
      shoot(mesh, cA, uDir, vDir, nDir,
        len - 0.9, hgt / 2 + 0.15, 2.2, hgt + 0.7, 700, `${tag}-canto-diant`);
    } else {
      out.push([`${tag}: cantos uv1 para a foto`, false]);
    }
  }
}

/* ---------------- a matriz de alturas ---------------- */

await battery('fabrica');

for (const h of [2.4, 2.6, 3.0, 3.5]) {
  const tag = 'h' + Math.round(h * 100);
  S.measures.setImplementMeasures({ height: h });
  /* A altura fecha em número inteiro de frisos (passo ~53 mm), então a
     tolerância é meio passo. */
  const okDims = await B.until(() => {
    const d = S.trailerDims;
    return !!d && Math.abs(d.height - h) < 0.06;
  }, 60000);
  out.push([`${tag}: resize assentou (pedido ${h} m)`, okDims
    ? +S.trailerDims.height.toFixed(4) : false]);
  /* E as CHAPAS renascem coalescidas depois das dims — esperar só as dims
     mediria a chapa da altura anterior. A caixa local é cara; sonda espaçada. */
  let okPanel = false;
  const t0 = performance.now();
  while (performance.now() - t0 < 45000) {
    const m2 = panelOf('SIDE_L');
    if (m2) {
      const b2 = localBox(m2);
      if (Math.abs((b2.max.y - b2.min.y) - S.trailerDims.height) < 0.09) { okPanel = true; break; }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  out.push([`${tag}: SIDE_L renascido na altura nova`, okPanel]);
  await B.frame(); await B.frame();
  await battery(tag);
}

return out;
