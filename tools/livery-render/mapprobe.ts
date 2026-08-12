/* Sonda do MAPEAMENTO — a arte do editor cai onde no implemento?
   ---------------------------------------------------------------------------
   A PERGUNTA QUE ELA RESPONDE, e por que ela precisa existir

   O dono do produto pediu uma garantia exata: um quadrado posto no topo
   esquerdo do painel tem de aparecer no topo esquerdo da PARTE BRANCA do baú,
   sem nada cortado. Isso é uma afirmação sobre a cadeia inteira — recorte da
   chapa → `uv1` → régua em milímetros → retângulo da tela no palco — e cada elo
   dela tem hoje um número próprio para "a altura do painel". Enquanto forem
   números diferentes, a arte fica plausível e errada.

   Então esta sonda não desenha nada: ela LÊ o runtime de verdade e imprime os
   elos lado a lado. Nenhuma conta aqui é reimplementada — `TrailerRig`,
   `buildLiveryPanels()` e `attachOverlays()` são os do app. Replicá-las daria
   uma medição que concorda consigo mesma e não com o que a tela mostra, que é
   o modo de falha que já custou uma rodada inteira deste trabalho.

   O QUE ELA IMPRIME

     A. o perfil do bake (piso, teto, pontas, meia-largura);
     B. a caixa de cada chapa recortada e o que `uv1` cobre;
     C. o CANTO: para uv1 (0,0), (1,0), (0,1) e (1,1), o ponto em MUNDO —
        é a resposta literal à pergunta do quadrado;
     D. as réguas que deveriam concordar: `PANEL_MM`, as dims do rig, o
        `designHeight` do manifesto e a faixa pintável;
     E. a janela da FOTO, que é quem posiciona a tela hoje. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { TrailerRig } from '@/pages/tools/truck-studio/engine/vehicle/trailer-rig';

declare global {
  interface Window {
    __ready?: boolean;
    __error?: string;
    __report?: () => unknown;
    __shotSeam?: (yLo: number, yHi: number, ppm: number) => string;
  }
}

const r4 = (n: number) => +n.toFixed(4);

/** Caixa em MUNDO pelo atributo — `setFromObject` superestima. */
function worldBox(mesh: THREE.Mesh): THREE.Box3 | null {
  const pos = mesh.geometry?.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos?.count) return null;
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  mesh.updateWorldMatrix(true, false);
  for (let i = 0; i < pos.count; i++) {
    b.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
  }
  return b.isEmpty() ? null : b;
}

/**
 * O vértice cujo `uv1` mais se aproxima do alvo, com o ponto dele em mundo.
 *
 * É a medição do CANTO, e ela é feita por busca em vez de por inversão da
 * fórmula de propósito: inverter `addLiveryUV()` responderia o que aquela
 * função PROMETE, e o que interessa é o que a malha ENTREGA depois de recorte,
 * empilhamento de friso e vão de porta.
 */
function cornerOf(mesh: THREE.Mesh, u: number, v: number) {
  const geo = mesh.geometry;
  const uv = geo.getAttribute('uv1') as THREE.BufferAttribute | undefined;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!uv || !pos) return null;
  mesh.updateWorldMatrix(true, false);
  let best = Infinity, bi = -1;
  for (let i = 0; i < uv.count; i++) {
    const du = uv.getX(i) - u, dv = uv.getY(i) - v;
    const d = du * du + dv * dv;
    if (d < best) { best = d; bi = i; }
  }
  if (bi < 0) return null;
  const p = new THREE.Vector3().fromBufferAttribute(pos, bi).applyMatrix4(mesh.matrixWorld);
  return {
    uvPedido: [u, v],
    uvAchado: [r4(uv.getX(bi)), r4(uv.getY(bi))],
    erroUV: r4(Math.sqrt(best)),
    mundo: { x: r4(p.x), y: r4(p.y), z: r4(p.z) },
  };
}

/** Faixa coberta por um atributo, componente a componente. */
function range(a: THREE.BufferAttribute | undefined, comp: 0 | 1) {
  if (!a) return null;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < a.count; i++) {
    const v = comp === 0 ? a.getX(i) : a.getY(i);
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [r4(lo), r4(hi)];
}

async function main() {
  const draco = new DRACOLoader();
  draco.setDecoderPath('/vendor/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  const gltf = await loader.loadAsync('/models/vehicles/trailer.glb');
  const root = gltf.scene;
  root.updateWorldMatrix(true, true);

  /* O rig REAL, como `models.ts` o monta. A pose é a de carga (raiz na
     identidade), exigência de `assembly.set()`. */
  const rig = new TrailerRig(root);
  const prof = rig.profile;
  const dims = rig.current;

  /* As chapas: o app as cria em `buildLiveryPanels()`, que não é exportada.
     Em vez de replicá-la, a sonda procura o que ELA teria produzido — e se não
     achar, diz isso em vez de inventar. O bake atual pode já trazer as três
     malhas prontas (bake fundido), que é o caminho em que a função desiste. */
  const panels: Record<string, THREE.Mesh> = {};
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (o.isMesh && /^(SIDE_L|SIDE_R|REAR)$/.test(o.name)) panels[o.name] = o;
  });

  /* A extensão da CHAPA BRANCA, medida por material — é a "parte branca" do
     pedido, e o alvo contra o qual todo o resto é conferido. */
  const white = new THREE.Box3();
  const WHITE_RE = /Cor_padrao_branco|metalBranco/i;
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.visible) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some((m) => m && WHITE_RE.test(m.name || ''))) return;
    const b = worldBox(o);
    if (b) white.union(b);
  });

  const report: Record<string, unknown> = {
    A_perfil: {
      piso: r4(prof.floorY), teto: r4(prof.roofY),
      vao_piso_teto: r4(prof.roofY - prof.floorY),
      z: [r4(prof.z0), r4(prof.z1)],
      comprimento: r4(prof.z1 - prof.z0),
      meiaLargura: r4(prof.width / 2),
      frisos: prof.ribCount, passo_mm: r4(prof.pitch * 1000),
      saia_mm: r4(prof.skirtHeight * 1000), arremate_mm: r4(prof.capHeight * 1000),
    },
    A_dims_do_rig: {
      length: r4(dims.length), height: r4(dims.height), width: r4(dims.width),
      base: { length: r4(rig.base.length), height: r4(rig.base.height), width: r4(rig.base.width) },
      /* A divergência que já apareceu no diagnóstico do resize: `base.height`
         contra o vão real piso→teto. Se não for zero, TODA conta que usa
         `dims.height` como altura do painel está deslocada por ela. */
      base_height_menos_vao_mm: r4(((rig.base.height) - (prof.roofY - prof.floorY)) * 1000),
    },
    A_chapa_branca_mundo: {
      x: [r4(white.min.x), r4(white.max.x)],
      y: [r4(white.min.y), r4(white.max.y)],
      z: [r4(white.min.z), r4(white.max.z)],
      altura: r4(white.max.y - white.min.y),
    },
    B_chapas: {},
    C_cantos: {},
  };

  const achadas = Object.keys(panels);
  (report as Record<string, unknown>).B_chapas_encontradas = achadas.length ? achadas
    : 'NENHUMA — o bake não traz SIDE_L/SIDE_R/REAR prontas; elas nascem em '
      + 'buildLiveryPanels() no runtime do app, que esta sonda não executa.';

  for (const [name, mesh] of Object.entries(panels)) {
    const b = worldBox(mesh);
    const uv = mesh.geometry.getAttribute('uv1') as THREE.BufferAttribute | undefined;
    (report.B_chapas as Record<string, unknown>)[name] = {
      caixa_mundo: b ? {
        x: [r4(b.min.x), r4(b.max.x)],
        y: [r4(b.min.y), r4(b.max.y)],
        z: [r4(b.min.z), r4(b.max.z)],
        altura: r4(b.max.y - b.min.y),
        comprimento: r4(b.max.z - b.min.z),
      } : null,
      tem_uv1: !!uv,
      uv1_u: range(uv, 0), uv1_v: range(uv, 1),
      vertices: mesh.geometry.getAttribute('position')?.count ?? 0,
      /* Quanto a chapa recortada EXCEDE a chapa branca em altura. É o número
         que decide se `uv1 = 0` é o topo do branco ou o topo do arremate. */
      excede_branco_mm: b ? {
        acima: r4((b.max.y - white.max.y) * 1000),
        abaixo: r4((white.min.y - b.min.y) * 1000),
      } : null,
    };
    (report.C_cantos as Record<string, unknown>)[name] = {
      topo_esquerdo_uv_0_0: cornerOf(mesh, 0, 0),
      topo_direito_uv_1_0: cornerOf(mesh, 1, 0),
      base_esquerda_uv_0_1: cornerOf(mesh, 0, 1),
      base_direita_uv_1_1: cornerOf(mesh, 1, 1),
    };
  }

  /* ------------------------------------------------------------------ F
     A COSTURA: quem entra na chapa e quem fica no corpo, faixa de Y a faixa
     de Y.

     `buildLiveryPanels()` move para SIDE_L todo triângulo BRANCO cujo x máximo
     caiba em `box.min.x + 40 mm`. O que sobra continua no corpo, com o material
     do corpo — e a fronteira entre os dois é uma costura real: a chapa ganha
     material CLONADO e a textura do livery, o corpo não. O código já registra
     que esse defeito foi visto ("wrong in white, right in colour").

     Se existir uma FAIXA DE ALTURA em que a pele branca está recuada em x — a
     saia, o arremate, o rebaixo de um friso — os triângulos dela não alcançam
     o slab, ficam no corpo, e a costura vira uma LINHA HORIZONTAL correndo o
     implemento inteiro. É exatamente o defeito relatado.

     A regra abaixo é a MESMA de `buildLiveryPanels()` (o mesmo slab de 40 mm
     sobre a mesma caixa do corpo branco) — aqui ela só CONTA em vez de mover. */
  const LIVERY_SKIN_SIDE = 0.04;
  const body = new THREE.Box3();
  const brancas: THREE.Mesh[] = [];
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some((m) => m && WHITE_RE.test(m.name || ''))) return;
    brancas.push(o);
    const b = worldBox(o);
    if (b) body.union(b);
  });

  /* Bin de 5 mm em Y: fino o bastante para separar vale de crista (relevo de
     5,2 mm) e grosso o bastante para o relatório caber. */
  const BIN = 0.005;
  type Bin = { dentro: number; fora: number; z0: number; z1: number; xMax: number };
  const bins = new Map<number, Bin>();
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  for (const mesh of brancas) {
    const g = mesh.geometry;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const idx = g.index ? g.index.array : null;
    const tri = Math.floor((idx ? idx.length : pos.count) / 3);
    mesh.updateWorldMatrix(true, false);
    for (let t = 0; t < tri; t++) {
      const i0 = idx ? idx[t * 3] : t * 3;
      const i1 = idx ? idx[t * 3 + 1] : t * 3 + 1;
      const i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
      va.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld);
      vb.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld);
      vc.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld);
      /* Só o lado ESQUERDO (o menor x), que é o SIDE_L do app. Contar os dois
         lados no mesmo histograma somaria duas costuras diferentes. */
      const maxX = Math.max(va.x, vb.x, vc.x);
      const minX = Math.min(va.x, vb.x, vc.x);
      if (minX > body.min.x + 0.20) continue;          // não é pele deste lado
      /* SÓ A PELE, pela NORMAL. Sem isto o teto e o piso externos entram na
         conta: eles atravessam a largura inteira, então o `minX` deles também
         é a face extrema, e a primeira rodada os leu como "pele que ficou de
         fora do slab" — 145 triângulos num bin do topo que são o teto, não uma
         costura. Uma face de pele olha para ±x; teto e piso olham para ±y. */
      const ex1 = vb.x - va.x, ey1 = vb.y - va.y, ez1 = vb.z - va.z;
      const ex2 = vc.x - va.x, ey2 = vc.y - va.y, ez2 = vc.z - va.z;
      const nx = ey1 * ez2 - ez1 * ey2;
      const ny = ez1 * ex2 - ex1 * ez2;
      const nz = ex1 * ey2 - ey1 * ex2;
      const nl = Math.hypot(nx, ny, nz);
      if (!(nl > 1e-12) || Math.abs(nx / nl) < 0.5) continue;
      const yMid = (va.y + vb.y + vc.y) / 3;
      const k = Math.round(yMid / BIN);
      const cell = bins.get(k) || { dentro: 0, fora: 0, z0: Infinity, z1: -Infinity, xMax: -Infinity };
      if (maxX <= body.min.x + LIVERY_SKIN_SIDE) cell.dentro++;
      else {
        cell.fora++;
        /* A EXTENSÃO EM Z do que ficou de fora decide o diagnóstico: buraco
           concentrado numa ponta é dobra de canto e não se vê; buraco espalhado
           pelo comprimento inteiro É a linha horizontal do relato. */
        const zMin = Math.min(va.z, vb.z, vc.z), zMax = Math.max(va.z, vb.z, vc.z);
        if (zMin < cell.z0) cell.z0 = zMin;
        if (zMax > cell.z1) cell.z1 = zMax;
        if (maxX > cell.xMax) cell.xMax = maxX;
      }
      bins.set(k, cell);
    }
  }

  /* As faixas em que a pele NÃO entra na chapa, agrupadas em intervalos
     contíguos — cada intervalo é uma costura horizontal candidata. */
  const chaves = [...bins.keys()].sort((a, b) => a - b);
  const faixasFora: { y0: number; y1: number; tris: number }[] = [];
  let cur: { y0: number; y1: number; tris: number } | null = null;
  for (const k of chaves) {
    const c = bins.get(k) as Bin;
    const soFora = c.fora > 0 && c.dentro === 0;
    if (soFora) {
      if (cur && Math.abs(k * BIN - cur.y1) < BIN * 1.5) { cur.y1 = k * BIN; cur.tris += c.fora; }
      else { if (cur) faixasFora.push(cur); cur = { y0: k * BIN, y1: k * BIN, tris: c.fora }; }
    }
  }
  if (cur) faixasFora.push(cur);

  /* ------------------------------------------------------------------ G
     ENSAIO DO CRITÉRIO NOVO.

     O slab de 40 mm classifica pelo vértice MAIS FUNDO (`maxX`), então um
     triângulo que nasce na crista e mergulha para dentro — a DOBRA DA EMENDA
     entre duas chapas da pele — é reprovado inteiro e fica no corpo. São três
     emendas, e cada uma corre 99 % do baú: as três listras do relato.

     Alargar o slab não serve: a parede interna está a 62,8 mm e as emendas
     mergulham 65,5 e 88,7 mm, então qualquer limiar que pegue as emendas pega
     a parede. O discriminante não é profundidade, é ENCOSTAR: a dobra tem um
     vértice na crista e a parede interna não tem nenhum. Daí o par de testes —
     toca a pele (`minX`) e não vai fundo demais (`maxX`) — mais a normal, que
     rejeita o que olha para o lado.

     Este bloco só CONTA o que o critério novo mudaria. Aplicar sem medir é como
     este recorte já errou antes. */
  const SKIN_TOUCH = 0.012;
  const SKIN_SEAM = 0.10;
  const SKIN_FACING = 0.5;
  let ganhos = 0, ganhosCorridos = 0;
  const ganhosPorY = new Map<number, number>();
  let arrastaParede = 0;
  for (const mesh of brancas) {
    const g = mesh.geometry;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const idx = g.index ? g.index.array : null;
    const tri = Math.floor((idx ? idx.length : pos.count) / 3);
    mesh.updateWorldMatrix(true, false);
    for (let t = 0; t < tri; t++) {
      const i0 = idx ? idx[t * 3] : t * 3;
      const i1 = idx ? idx[t * 3 + 1] : t * 3 + 1;
      const i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
      va.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld);
      vb.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld);
      vc.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld);
      const minX = Math.min(va.x, vb.x, vc.x);
      const maxX = Math.max(va.x, vb.x, vc.x);
      if (maxX <= body.min.x + LIVERY_SKIN_SIDE) continue;   // já entrava
      const ex1 = vb.x - va.x, ey1 = vb.y - va.y, ez1 = vb.z - va.z;
      const ex2 = vc.x - va.x, ey2 = vc.y - va.y, ez2 = vc.z - va.z;
      const nx = ey1 * ez2 - ez1 * ey2;
      const ny = ez1 * ex2 - ex1 * ez2;
      const nz = ex1 * ey2 - ey1 * ex2;
      const nl = Math.hypot(nx, ny, nz);
      if (!(nl > 1e-12) || Math.abs(nx / nl) < SKIN_FACING) continue;
      if (minX <= body.min.x + SKIN_TOUCH && maxX <= body.min.x + SKIN_SEAM) {
        ganhos++;
        const yk = Math.round(((va.y + vb.y + vc.y) / 3) / BIN);
        ganhosPorY.set(yk, (ganhosPorY.get(yk) || 0) + 1);
        const zSpan = Math.max(va.z, vb.z, vc.z) - Math.min(va.z, vb.z, vc.z);
        if (zSpan > (prof.z1 - prof.z0) * 0.5) ganhosCorridos++;
      } else if (minX > body.min.x + SKIN_TOUCH && maxX <= body.min.x + SKIN_SEAM) {
        /* Encostava não, mergulhava sim: é a parede interna, e ela NÃO pode
           entrar. Este contador existe para provar que não entra. */
        arrastaParede++;
      }
    }
  }
  report.G_criterio_novo = {
    parametros: { SKIN_TOUCH, SKIN_SEAM, SKIN_FACING },
    triangulos_recuperados: ganhos,
    dos_quais_correm_meio_bau: ganhosCorridos,
    parede_interna_rejeitada: arrastaParede,
    alturas_recuperadas_mm: [...ganhosPorY.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 12)
      .map(([k, n]) => ({ mm_do_piso: r4((k * BIN - prof.floorY) * 1000), tris: n })),
  };

  report.F_costura = {
    regra: `x <= ${r4(body.min.x)} + ${LIVERY_SKIN_SIDE} (o slab de buildLiveryPanels)`,
    corpo_branco_x: [r4(body.min.x), r4(body.max.x)],
    total_bins: bins.size,
    /* O que interessa: alturas em que TODA a pele branca fica de fora do slab.
       Cada uma é uma listra horizontal em que a chapa de livery não existe e o
       corpo aparece com o material dele. */
    faixas_sem_chapa: faixasFora.map((f) => ({
      y: [r4(f.y0), r4(f.y1)],
      acima_do_piso_mm: [r4((f.y0 - prof.floorY) * 1000), r4((f.y1 - prof.floorY) * 1000)],
      triangulos: f.tris,
    })),
    /* E as alturas MISTAS: parte entra, parte fica. São as bordas serrilhadas,
       que produzem linha pontilhada em vez de contínua. */
    /* Ordenado pelo QUE MAIS CORRE: a fração do comprimento do baú que o
       buraco cobre. É esse número, e não a contagem de triângulos, que separa
       uma dobra de canto de uma listra de ponta a ponta. */
    buracos: chaves.filter((k) => (bins.get(k) as Bin).fora > 0).map((k) => {
      const c = bins.get(k) as Bin;
      const corre = (c.z1 - c.z0) / (prof.z1 - prof.z0);
      return {
        acima_do_piso_mm: r4((k * BIN - prof.floorY) * 1000),
        dentro: c.dentro, fora: c.fora,
        z: [r4(c.z0), r4(c.z1)],
        fracao_do_comprimento: r4(corre),
        mergulha_mm: r4((c.xMax - body.min.x) * 1000),
      };
    }).sort((a, b) => b.fracao_do_comprimento - a.fracao_do_comprimento).slice(0, 25),
  };

  /* ------------------------------------------------------------------ H
     A PROVA VISUAL.

     Os números dizem que 98 triângulos de pele ficam fora da chapa, mas número
     não prova aparência — a doutrina de `tools/trailer-bench`. Então aqui a
     classificação vira COR: verde o que vai para a chapa de livery, VERMELHO o
     que fica no corpo. Se o vermelho sair como listra contínua correndo o baú,
     a linha do relato é esta fronteira e não há mais o que discutir; se sair
     como pontinhos nas pontas, a causa é outra e o diagnóstico volta à estaca.

     Ortográfica e sem luz (`MeshBasicMaterial`): o que se quer ver é a
     CLASSIFICAÇÃO, e sombreamento só atrapalharia. */
  const dbgPos: number[] = [];
  const dbgCol: number[] = [];
  for (const mesh of brancas) {
    const g = mesh.geometry;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const idx = g.index ? g.index.array : null;
    const tri = Math.floor((idx ? idx.length : pos.count) / 3);
    mesh.updateWorldMatrix(true, false);
    for (let t = 0; t < tri; t++) {
      const i0 = idx ? idx[t * 3] : t * 3;
      const i1 = idx ? idx[t * 3 + 1] : t * 3 + 1;
      const i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
      va.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld);
      vb.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld);
      vc.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld);
      const minX = Math.min(va.x, vb.x, vc.x);
      if (minX > body.min.x + 0.20) continue;      // só a lateral esquerda
      const maxX = Math.max(va.x, vb.x, vc.x);
      const vai = maxX <= body.min.x + LIVERY_SKIN_SIDE;
      const [r, g2, b] = vai ? [0.15, 0.75, 0.25] : [1, 0, 0];
      for (const v of [va, vb, vc]) {
        dbgPos.push(v.x, v.y, v.z);
        dbgCol.push(r, g2, b);
      }
    }
  }
  const dbgGeo = new THREE.BufferGeometry();
  dbgGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dbgPos), 3));
  dbgGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(dbgCol), 3));
  const dbgScene = new THREE.Scene();
  dbgScene.background = new THREE.Color(0x101216);
  dbgScene.add(new THREE.Mesh(dbgGeo, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.DoubleSide,
  })));

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  document.body.appendChild(renderer.domElement);

  window.__shotSeam = (yLo: number, yHi: number, ppm: number) => {
    const z0 = prof.z0, z1 = prof.z1;
    const y0 = prof.floorY + yLo, y1 = prof.floorY + yHi;
    const w = z1 - z0, h = y1 - y0;
    const wPx = Math.min(4000, Math.round(w * ppm));
    const hPx = Math.max(8, Math.min(4000, Math.round(h * ppm)));
    renderer.setSize(wPx, hPx, false);
    const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 12);
    cam.position.set(body.min.x - 5, (y0 + y1) / 2, (z0 + z1) / 2);
    cam.lookAt(body.min.x, (y0 + y1) / 2, (z0 + z1) / 2);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    renderer.render(dbgScene, cam);
    return renderer.domElement.toDataURL('image/png');
  };

  window.__report = () => report;
  window.__ready = true;
}

main().catch((e) => {
  window.__error = (e && (e.stack || e.message)) || String(e);
  window.__ready = true;
});
