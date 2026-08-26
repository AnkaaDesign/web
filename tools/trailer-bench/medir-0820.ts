/* MEDIDOR DA RODADA DE 2026-08-20 — as cinco pendências do sobrechassi.
   ---------------------------------------------------------------------------
   Irmã de `implprobe.ts`, e pela mesma razão dela: nada aqui se resolve lendo
   código. O que resolve é MEDIR as duas peças e comparar por cota, com o
   MESMO caminho que o app percorre.

   O que ela responde, uma seção por pendência do
   `HANDOFF-SOBRECHASSI-2026-08-19.md`:

     A_engate    as malhas de engate têm DUAS componentes conexas, ou o
                 `stitch_all` soldou os vértices? (é a pergunta que escolhe
                 entre as três hipóteses do handoff)
     B_perfil    o perfil do friso DOBRA A DOBRA, dobrado pelo passo — a
                 cross-section exata, e daí a fase da CRISTA contra `row0`
     C_baixo     o inventário do que existe abaixo do trilho de piso, por
                 material e por cota, com a distribuição por flanco
     D_trilho    a face do trilho contra a face da pele, POR FLANCO, antes e
                 depois de `fixLowFrameRail()`
     E_fitas     toda fita retrorrefletiva com a caixa dela, e todo montante
                 de canto — para tirar o DELTA fita↔montante do semirreboque

   USO
       node tools/trailer-bench/medir-0820.mjs [arquivo.glb]
   Sem argumento roda os DOIS implementos, um depois do outro. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { TrailerBody } from '@/pages/tools/truck-studio/engine/vehicle/trailer-geometry';
import { markShared } from '@/pages/tools/truck-studio/engine/vehicle/geometry-share';
import {
  removeBakedSideDoor, removeMakerBranding, fixLowFrameSkin, fixCornerTape,
  fixLowFrameRail, removeExtraRearHose, splitEngateHardware, removeStrayConduits,
  fixRegistroAndHose, removeSideDoorCatches, seatFlankCatches,
  dressTopRail,
} from '@/pages/tools/truck-studio/engine/vehicle/trailer-bake-fixes';

declare global {
  interface Window { __ready?: boolean; __error?: string; __diag?: unknown }
}

const r3 = (v: number) => +v.toFixed(4);
const mm = (v: number) => +(v * 1000).toFixed(1);

/**
 * Caixa de uma malha em espaço de MUNDO.
 *
 * ⚠️ E é MUNDO de propósito, não o local da raiz: `TrailerBody.profile` mede em
 * mundo (`floorY`, `roofY`, `row0`), e uma sonda que misturasse os dois
 * compararia número de referenciais diferentes — foi exatamente o que fez a
 * primeira volta desta medição ler o montante de canto 717 mm abaixo do piso
 * do baú, que é a translação de `groundAndCenter()`.
 */
function boxIn(o: THREE.Mesh, _ignorado?: unknown): THREE.Box3 | null {
  o.updateWorldMatrix(true, false);
  if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
  const gb = o.geometry.boundingBox;
  if (!gb) return null;
  return gb.clone().applyMatrix4(o.matrixWorld);
}

const matNames = (o: THREE.Mesh) =>
  (Array.isArray(o.material) ? o.material : [o.material])
    .map((m) => m?.name || '(sem nome)').join('+');

/** A MESMA solda por posição de `componentesConexas()` em trailer-bake-fixes. */
function comps(geo: THREE.BufferGeometry): number[][] {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
  const idx = geo.getIndex();
  if (!pos || !idx) return [];
  const chave = new Map<string, number>();
  const pai = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 1e5)},${Math.round(pos.getY(i) * 1e5)},`
      + `${Math.round(pos.getZ(i) * 1e5)}`;
    const j = chave.get(k);
    if (j === undefined) { chave.set(k, i); pai[i] = i; } else pai[i] = j;
  }
  const acha = (i: number): number => {
    let r = i;
    while (pai[r] !== r) r = pai[r];
    while (pai[i] !== r) { const n = pai[i]; pai[i] = r; i = n; }
    return r;
  };
  const une = (a: number, b: number) => {
    const ra = acha(a), rb = acha(b);
    if (ra !== rb) pai[ra] = rb;
  };
  const tri = idx.count / 3;
  for (let t = 0; t < tri; t++) {
    une(idx.getX(t * 3), idx.getX(t * 3 + 1));
    une(idx.getX(t * 3 + 1), idx.getX(t * 3 + 2));
  }
  const g = new Map<number, number[]>();
  for (let t = 0; t < tri; t++) {
    const r = acha(idx.getX(t * 3));
    const e = g.get(r);
    if (e) e.push(t); else g.set(r, [t]);
  }
  return [...g.values()];
}

function caixaDeTris(geo: THREE.BufferGeometry, tris: number[]): THREE.Box3 {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const idx = geo.getIndex() as THREE.BufferAttribute;
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  for (const t of tris) {
    for (let k = 0; k < 3; k++) {
      const i = idx.getX(t * 3 + k);
      b.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)));
    }
  }
  return b;
}

async function main() {
  const q = new URLSearchParams(location.search);
  const file = q.get('impl') || 'sobrechassi_frigorifico_gancheiro.glb';
  const sillSrc = q.get('sill') || '';
  const frameSrc = q.get('frame') || sillSrc;
  const flag = (k: string) => q.get(k) === '1';

  const draco = new DRACOLoader();
  draco.setDecoderPath('/vendor/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  const gltf = await loader.loadAsync('/models/vehicles/' + file);
  const root = gltf.scene;
  root.updateWorldMatrix(true, true);
  {
    const b = new THREE.Box3().setFromObject(root);
    root.position.x -= (b.min.x + b.max.x) / 2;
    root.position.y -= b.min.y;
    root.updateWorldMatrix(true, true);
  }
  let toLocal = root.matrixWorld.clone().invert();

  const diag: Record<string, unknown> = { arquivo: file };

  /* =======================================================================
     0 — O INVENTÁRIO DE MATERIAL, com COR. É por aqui que se acha uma peça
     que renderiza na cor errada: a queixa chega como "tem uma parte marrom" e
     o que resolve é a lista de quem é bege neste bake e não é no outro.
     ======================================================================= */
  {
    const inv = new Map<string, {
      malhas: number; tris: number; cor: string; hsv: number[];
      metal: number; rough: number; tem: Record<string, boolean>;
    }>();
    root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.geometry) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const raw of mats) {
        const m = raw as THREE.MeshStandardMaterial | null;
        if (!m) continue;
        const k = m.name || '(sem nome)';
        let e = inv.get(k);
        if (!e) {
          const c = m.color ?? new THREE.Color(1, 1, 1);
          const hsl = { h: 0, s: 0, l: 0 };
          c.getHSL(hsl);
          e = {
            malhas: 0, tris: 0,
            cor: '#' + c.getHexString(),
            hsv: [+(hsl.h * 360).toFixed(0), +hsl.s.toFixed(2), +hsl.l.toFixed(2)],
            metal: +(m.metalness ?? -1).toFixed(2),
            rough: +(m.roughness ?? -1).toFixed(2),
            tem: { map: !!m.map, normal: !!m.normalMap, rough: !!m.roughnessMap, metal: !!m.metalnessMap },
          };
          inv.set(k, e);
        }
        e.malhas++;
        e.tris += (o.geometry.getIndex()?.count ?? 0) / 3;
      }
    });
    diag.materiais = [...inv.entries()]
      .sort((a, b) => b[1].tris - a[1].tris)
      .map(([k, v]) => ({ nome: k, ...v }));
  }

  /* =======================================================================
     A — O ENGATE: quantas componentes conexas cada peça tem?
     ======================================================================= */
  {
    const ENG_RE = /engate-(femea|macho)-preto|^metal-pouco-polido/i;
    const achados: unknown[] = [];
    root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.geometry) return;
      const nome = matNames(o);
      if (!/engate-(femea|macho)-preto/i.test(nome)) return;
      const b = boxIn(o, toLocal);
      if (!b) return;
      const cs = comps(o.geometry);
      achados.push({
        no: o.name, material: nome,
        tris: (o.geometry.getIndex()?.count ?? 0) / 3,
        d_mm: [mm(b.max.x - b.min.x), mm(b.max.y - b.min.y), mm(b.max.z - b.min.z)],
        centro: [r3((b.min.x + b.max.x) / 2), r3((b.min.y + b.max.y) / 2), r3((b.min.z + b.max.z) / 2)],
        componentes: cs.length,
        comps: cs.map((tris) => {
          const cb = caixaDeTris(o.geometry, tris);
          return {
            tris: tris.length,
            d_mm: [mm(cb.max.x - cb.min.x), mm(cb.max.y - cb.min.y), mm(cb.max.z - cb.min.z)],
            y_local: [r3(cb.min.y), r3(cb.max.y)],
            z_local: [r3(cb.min.z), r3(cb.max.z)],
            x_local: [r3(cb.min.x), r3(cb.max.x)],
          };
        }).sort((a, b2) => b2.tris - a.tris).slice(0, 6),
      });
      void ENG_RE;
    });
    /* E o PAR do semirreboque: as duas malhas separadas, para a régua. */
    const par: unknown[] = [];
    root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.geometry) return;
      const b = boxIn(o, toLocal);
      if (!b) return;
      const d = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
      /* Vizinhança das cotas medidas no handoff, em qualquer ordem de eixo. */
      const s = [...d].sort((x, y) => x - y).map(mm);
      const alvo = [[10, 39, 150], [12, 54, 65], [16, 38, 79], [17, 57, 79]];
      if (!alvo.some((a) => a.every((v, i) => Math.abs(v - s[i]) < 4))) return;
      par.push({
        no: o.name, material: matNames(o), assinatura_mm: s,
        centro: [r3((b.min.x + b.max.x) / 2), r3((b.min.y + b.max.y) / 2), r3((b.min.z + b.max.z) / 2)],
        componentes: comps(o.geometry).length,
      });
    });
    diag.A_engate = { por_material: achados, por_assinatura: par };
  }

  /* As remoções do bake, na ORDEM DO APP. */
  const nota: Record<string, unknown> = {};
  if (flag('porta')) nota.portaDeFabrica = removeBakedSideDoor(root);
  if (flag('encosto')) nota.encostoLateral = removeSideDoorCatches(root);
  if (flag('mangueira')) nota.mangueiraExtra = removeExtraRearHose(root);
  if (flag('tubos')) nota.tubosEmbutidos = removeStrayConduits(root);
  if (flag('marca')) nota.marca = removeMakerBranding(root).removed;
  if (flag('banda') && frameSrc) nota.banda = fixLowFrameSkin(root, new RegExp(frameSrc, 'i'));
  nota.engateDividido = splitEngateHardware(root);
  nota.registroEMangueira = fixRegistroAndHose(root);
  diag.remocoes = nota;
  root.updateWorldMatrix(true, true);
  toLocal = root.matrixWorld.clone().invert();

  /* Depois da divisão: `mesh.material` virou array? */
  {
    const dep: unknown[] = [];
    root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.geometry) return;
      if (!/engate-(femea|macho)-preto/i.test(matNames(o))) return;
      const g: unknown[] = [];
      const idx = o.geometry.getIndex();
      const pos = o.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (idx && pos) {
        const m4 = new THREE.Matrix4().multiplyMatrices(
          root.matrixWorld.clone().invert(), o.matrixWorld);
        for (const gr of o.geometry.groups) {
          const bb = new THREE.Box3();
          const vv = new THREE.Vector3();
          for (let i = gr.start; i < gr.start + gr.count; i++) {
            bb.expandByPoint(vv.fromBufferAttribute(pos, idx.getX(i)).applyMatrix4(m4));
          }
          g.push({
            tris: gr.count / 3, mat: gr.materialIndex,
            d_mm: [mm(bb.max.x - bb.min.x), mm(bb.max.y - bb.min.y), mm(bb.max.z - bb.min.z)],
          });
        }
      }
      dep.push({
        no: o.name, material: matNames(o),
        arrayDeMaterial: Array.isArray(o.material),
        grupos: o.geometry.groups.length, caixaDosGrupos: g,
      });
    });
    diag.A_depois = dep;
  }

  /* ⚠️ `markShared()` ANTES do rig, como `buildTrailerRig()` faz. Sem ela uma
     correção de vértice sobre geometria COMPARTILHADA (os dois trilhos de piso
     são o mesmo molde) roda DUAS vezes, e o perfil sai com 280 mm em vez de
     210 — o defeito documentado do `shoot-impl.mjs`. */
  diag.compartilhadas = markShared(root);

  /* O baú paramétrico — a mesma janela do app. */
  let kit: THREE.Object3D | undefined;
  try { kit = (await loader.loadAsync('/models/vehicles/porta_kit_v1.glb')).scene; } catch { /* opcional */ }
  const body = new TrailerBody(root, {
    ...(frameSrc ? { frameMaterial: new RegExp(frameSrc, 'i') } : {}),
    ...(sillSrc ? { sillMaterial: new RegExp(sillSrc, 'i') } : {}),
    ...(kit ? { kit } : {}),
  });
  root.add(body.group);
  const p = body.profile;
  diag.perfil = {
    pitch_mm: mm(p.pitch), frisos: p.ribCount,
    floorY: r3(p.floorY), roofY: r3(p.roofY),
    skirtHeight_mm: mm(p.skirtHeight), row0: r3(p.floorY + p.skirtHeight),
    topRailY: p.topRailY === null ? null : r3(p.topRailY),
    sillY: r3(p.sillY), z0: r3(p.z0), z1: r3(p.z1),
    largura: r3(p.base.width), valeInfo: body.valeInfo,
  };

  /* =======================================================================
     B — O PERFIL DO FRISO, dobrado pelo passo.
     ---------------------------------------------------------------------
     A pele extrudada só tem vértice NAS QUEBRAS do perfil, então a nuvem
     dobrada por `pitch` É a seção transversal — não uma amostragem dela.
     Cada agrupamento de fase é uma dobra, e o x dela é a profundidade.
     ======================================================================= */
  {
    const row0 = p.floorY + p.skirtHeight;
    const pitch = p.pitch;
    const out: Record<string, unknown> = {};
    for (const face of ['right', 'left'] as const) {
      const sgn = face === 'right' ? 1 : -1;
      /* A pele: vértices do corpo paramétrico com normal virada para ±x, no
         miolo do flanco (longe das pontas, onde a chapa enrola). */
      const geo = body.mesh.geometry;
      const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
      const nor = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
      if (!pos || !nor) continue;
      geo.computeBoundingBox();
      const gbb = geo.boundingBox as THREE.Box3;
      out[face + '_caixa_da_geometria'] = {
        x: [r3(gbb.min.x), r3(gbb.max.x)], y: [r3(gbb.min.y), r3(gbb.max.y)],
        z: [r3(gbb.min.z), r3(gbb.max.z)],
      };
      /* A JANELA EM Z SAI DA PRÓPRIA GEOMETRIA, não de `p.z0/z1`: o corpo
         paramétrico do semirreboque nasce com a testeira na origem e `z0/z1`
         medem a sopa ORIGINAL — 14,7 m de diferença de referencial, e o
         resultado é uma janela que não contém vértice nenhum, calada. */
      const zMid0 = gbb.min.z, zMid1 = gbb.max.z;
      const bal = new Map<number, { d: number; n: number }>();
      const alturas = new Map<number, number>();
      const cont = { total: pos.count, lado: 0, z: 0, y: 0,
        zjan: [r3(zMid0), r3(zMid1)], zmin: Infinity, zmax: -Infinity,
        ymin: Infinity, ymax: -Infinity };
      for (let i = 0; i < pos.count; i++) {
        /* ⚠️ SEM JANELA EM Z, e isso é a medida que a primeira volta desta
           sonda não tinha: a pele do semirreboque é UMA EXTRUSÃO, e a extrusão
           não tem vértice entre os dois planos de corte — 55 038 vértices no
           flanco direito e ZERO na janela central. Quem separa o flanco da
           testeira é a NORMAL (±x contra ±z), não a posição em z. No
           sobrechassi, que é feito de folhas de 1 m, os dois critérios
           concordam. */
        if (Math.abs(nor.getX(i)) < 0.7) continue;
        if (sgn * pos.getX(i) < 0.5) continue;
        cont.lado++;
        const z = pos.getZ(i);
        if (z < cont.zmin) cont.zmin = z;
        if (z > cont.zmax) cont.zmax = z;
        { const yy = pos.getY(i); if (yy < cont.ymin) cont.ymin = yy; if (yy > cont.ymax) cont.ymax = yy; }
        cont.z++;
        const y = pos.getY(i);
        if (y < row0 || y > row0 + pitch * (p.ribCount - 1)) continue;
        cont.y++;
        const fase = ((y - row0) % pitch + pitch) % pitch;
        const bin = Math.round(fase * 2000) / 2000;          // 0,5 mm
        const d = sgn * pos.getX(i);
        const e = bal.get(bin);
        if (!e) bal.set(bin, { d, n: 1 });
        else { if (d > e.d) e.d = d; e.n++; }
        alturas.set(bin, (alturas.get(bin) ?? 0) + 1);
      }
      const dobras = [...bal.entries()]
        .map(([fase, e]) => ({ fase_mm: mm(fase), x: r3(e.d), n: alturas.get(fase) ?? 0 }))
        .sort((a, b) => a.fase_mm - b.fase_mm);
      const crest = Math.max(...dobras.map((d) => d.x));
      /* A CRISTA: o trecho contíguo de fase cujo x está a menos de 0,3 mm do
         máximo. O centro dele é a fase que o rebite persegue. */
      const naCrista = dobras.filter((d) => crest - d.x < 0.0003).map((d) => d.fase_mm);
      out[face] = {
        contagem: cont,
        dobras,
        crista_fases_mm: naCrista,
        crista_x: r3(crest),
        crista_centro_mm: naCrista.length
          ? +((Math.min(...naCrista) + Math.max(...naCrista)) / 2).toFixed(2) : null,
        recuado_x: r3(Math.min(...dobras.map((d) => d.x))),
        relevo_mm: +(mm(crest) - mm(Math.min(...dobras.map((d) => d.x)))).toFixed(1),
      };
    }
    out.rowPhase_atual_mm = +(46.7 - mm(pitch) / 2).toFixed(2);
    out.RIB_FLAT_CENTER_mm = 46.7;
    diag.B_perfil = out;
  }

  /* =======================================================================
     D — O TRILHO DE PISO contra a PELE, antes e depois da correção.
     ======================================================================= */
  const trilhoAntes = medeTrilho(root, p.floorY);
  const fitasAntes = medeFitas(root);
  if (flag('fita')) nota.fitaDeCanto = fixCornerTape(root, p.floorY, p.roofY);
  if (flag('trilho')) nota.trilhoDePiso = fixLowFrameRail(root, p.floorY, p.floorY + p.skirtHeight);
  if (flag('assenta')) {
    const dirF = (diag.B_perfil as Record<string, unknown>).right as
      { crista_centro_mm: number | null } | undefined;
    const cr = dirF?.crista_centro_mm ?? null;
    if (cr !== null) {
      nota.encostoAssentado = seatFlankCatches(
        root, p.pitch, ((cr / 1000) + p.pitch / 2) % p.pitch);
    }
  }
  root.updateWorldMatrix(true, true);
  toLocal = root.matrixWorld.clone().invert();
  void toLocal;
  diag.D_trilho = { antes: trilhoAntes, depois: medeTrilho(root, p.floorY) };
  diag.E_antes = fitasAntes;

  /* =======================================================================
     T — O TRILHO DE TOPO: o que ele é, e onde estão os buracos de rebite.
     ---------------------------------------------------------------------
     *"nesse frame metálico lateral superior, crie um filete levemente elevado
     entre ele e a parte branca, de 5x8 mm, e feche os buracões que são para
     rebite, já que os rebites devem ser gerados sob demanda mais tarde de
     acordo com o tamanho do implemento"* — Kennedy, 2026-08-20.

     Duas perguntas, e nenhuma das duas se responde por caixa envolvente:

      1. ONDE É A JUNTA. O filete corre entre o trilho e a pele frisada, então
         é preciso a cota `y` da face de baixo do trilho e o `x` da face de
         fora dele — e a pele, que é uma extrusão, não tem vértice no meio.
      2. ONDE ESTÃO OS BURACOS. Um furo numa malha é um CICLO DE BORDA: aresta
         usada por UM triângulo só. A malha externa também tem borda (o
         contorno da chapa), então o que separa furo de contorno é o TAMANHO —
         um furo de rebite tem alguns milímetros, o contorno tem metros.
     ======================================================================= */
  {
    if (flag('topo')) nota.trilhoDeTopo = dressTopRail(root, p.roofY);
    /* ⚠️ SEM FILTRO DE MATERIAL, e a primeira volta tinha um. Com ele a sonda
       só via os perfis de 50 × 60 mm (68 triângulos, ZERO borda: caixa fechada,
       furo nenhum) e concluiu que não havia buraco no implemento — quando o que
       está furado é a CHAPA que o trilho prende, não o trilho. */
    const banda = p.topRailY === null ? p.roofY - 0.25 : p.topRailY;
    const achados: Record<string, unknown>[] = [];
    root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.geometry || !o.visible) return;
      if (/^TRAILER_/.test(o.name)) return;
      const b = boxIn(o);
      if (!b) return;
      if (b.max.y < p.roofY - 0.32) return;                // não é do topo
      if (Math.abs((b.min.x + b.max.x) / 2) < 0.9) return; // nem é do meio
      if (b.max.z - b.min.z < 0.5) return;                 // e é peça CORRIDA
      const geo = o.geometry as THREE.BufferGeometry;
      const idx = geo.getIndex();
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      /* AS BORDAS: aresta com um triângulo só. A chave solda por posição,
         senão a costura do bake vira "buraco" em toda parte. */
      const chave = new Map<string, number>();
      const sol = new Int32Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        const k = `${Math.round(pos.getX(i) * 1e5)},${Math.round(pos.getY(i) * 1e5)},`
          + `${Math.round(pos.getZ(i) * 1e5)}`;
        const j = chave.get(k);
        if (j === undefined) { chave.set(k, i); sol[i] = i; } else sol[i] = j;
      }
      const conta = new Map<string, number>();
      const nTri = idx ? idx.count / 3 : pos.count / 3;
      const vid = (q: number, k: number) => (idx ? sol[idx.getX(q * 3 + k)] : sol[q * 3 + k]);
      for (let q = 0; q < nTri; q++) {
        for (let k = 0; k < 3; k++) {
          const a = vid(q, k), c = vid(q, (k + 1) % 3);
          const kk = a < c ? `${a}_${c}` : `${c}_${a}`;
          conta.set(kk, (conta.get(kk) || 0) + 1);
        }
      }
      /* Os ciclos de borda, por união dos vértices que sobraram. */
      const pai = new Map<number, number>();
      const acha = (i: number): number => {
        let r = i;
        while ((pai.get(r) ?? r) !== r) r = pai.get(r) as number;
        return r;
      };
      let nBorda = 0;
      for (const [kk, n] of conta) {
        if (n !== 1) continue;
        nBorda++;
        const [a, c] = kk.split('_').map(Number);
        if (!pai.has(a)) pai.set(a, a);
        if (!pai.has(c)) pai.set(c, c);
        const ra = acha(a), rc = acha(c);
        if (ra !== rc) pai.set(ra, rc);
      }
      const ciclos = new Map<number, THREE.Box3>();
      const vv = new THREE.Vector3();
      const m4 = o.matrixWorld;
      for (const v of pai.keys()) {
        const r = acha(v);
        const cx = ciclos.get(r) ?? new THREE.Box3();
        cx.expandByPoint(vv.fromBufferAttribute(pos, v).applyMatrix4(m4));
        ciclos.set(r, cx);
      }
      const tam = [...ciclos.values()].map((cx) => {
        const d = cx.getSize(new THREE.Vector3());
        return { d: [mm(d.x), mm(d.y), mm(d.z)], maior: mm(Math.max(d.x, d.y, d.z)) };
      }).sort((a2, b2) => a2.maior - b2.maior);
      const furos = tam.filter((t) => t.maior <= 30);
      /* O PERFIL DA FACE DE FORA. Os "buracões" não têm borda: são rebaixos
         FECHADOS (furo com fundo), então contá-los por topologia dá zero. O
         que os denuncia é o histograma de |x|: a face de fora é UM plano com
         a esmagadora maioria dos vértices, e o fundo dos rebaixos é um segundo
         pico alguns milímetros para dentro. */
      const sgn = (b.min.x + b.max.x) / 2 > 0 ? 1 : -1;
      /* ⚠️ AS QUATRO FACES, e a primeira volta olhou UMA. O rebaixo de rebite
         não tem por que estar na face que eu escolhi: o perfil do topo é um U
         e o rebite pode estar na aba de baixo tanto quanto na de fora. Ter
         medido só o `x` externo foi o que me deixou declarar "fechados" com as
         marcas ainda na tela. */
      const faces: [string, (v: THREE.Vector3) => number][] = [
        ['xFora', (v) => (sgn > 0 ? b.max.x - v.x : v.x - b.min.x)],
        ['xDentro', (v) => (sgn > 0 ? v.x - b.min.x : b.max.x - v.x)],
        ['yBaixo', (v) => v.y - b.min.y],
        ['yCima', (v) => b.max.y - v.y],
      ];
      const perfis: Record<string, string[]> = {};
      for (const [nome, f] of faces) {
        const h = new Map<number, number>();
        for (let i = 0; i < pos.count; i++) {
          vv.fromBufferAttribute(pos, i).applyMatrix4(m4);
          const d2 = f(vv);
          if (d2 < -0.001 || d2 > 0.030) continue;
          const bin = Math.round(d2 * 10000) / 10;
          h.set(bin, (h.get(bin) || 0) + 1);
        }
        perfis[nome] = [...h.entries()].sort((a2, b2) => b2[1] - a2[1]).slice(0, 4)
          .map(([d2, n]) => `${d2}:${n}`);
      }
      const fora = sgn > 0 ? b.max.x : b.min.x;
      /* AS NORMAIS NO PLANO DA FACE: quantas ainda não olham para fora. É esta
         a conta que denuncia o anel que sobra depois de o relevo sumir. */
      let noPlano = 0, tortas = 0;
      {
        const nor = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
        const nm = new THREE.Matrix3().getNormalMatrix(m4);
        const nv = new THREE.Vector3();
        if (nor) {
          for (let i = 0; i < pos.count; i++) {
            vv.fromBufferAttribute(pos, i).applyMatrix4(m4);
            const d2 = (fora - vv.x) * sgn;
            if (d2 < 0.0055 || d2 > 0.0065) continue;
            noPlano++;
            nv.set(nor.getX(i), nor.getY(i), nor.getZ(i)).applyMatrix3(nm).normalize();
            if (nv.x * sgn <= 0.9) tortas++;
          }
        }
      }
      achados.push({
        faceDeFora_x: r3(fora),
        normais_noPlano: noPlano, normais_tortas: tortas,
        perfis,
        no: o.name.slice(0, 40), mat: matNames(o), tris: nTri,
        d: [mm(b.max.x - b.min.x), mm(b.max.y - b.min.y), mm(b.max.z - b.min.z)],
        x: r3((b.min.x + b.max.x) / 2), y: [r3(b.min.y), r3(b.max.y)],
        doTeto_mm: [mm(b.min.y - p.roofY), mm(b.max.y - p.roofY)],
        arestasDeBorda: nBorda, ciclos: ciclos.size,
        furos: furos.length,
        furo_diam_mm: furos.length
          ? [furos[0].maior, furos[furos.length - 1].maior] : null,
        maiores: tam.slice(-3).map((t) => t.maior),
      });
    });
    diag.T_trilhoDeTopo = { banda: r3(banda), roofY: r3(p.roofY), pecas: achados };
  }

  /* =======================================================================
     C — O QUE MORA NA LINHA DO PISO, por família, nos DOIS implementos.
     ---------------------------------------------------------------------
     ⚠️ A janela é RELATIVA a `floorY` e a medida é em MUNDO — o mesmo
     referencial de `profile`. A primeira volta desta sonda misturou os dois e
     leu a família das lanternas 800 mm abaixo de onde ela está.
     ======================================================================= */
  {
    const trilhoTopo = p.floorY + 0.1275;
    const fam = new Map<string, {
      n: number; d: number[]; y: number[]; itens: { x: number; z: number; y: number[] }[];
    }>();
    root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.geometry || !o.visible) return;
      if (o.name === 'TRAILER_BODY' || /^TRAILER_/.test(o.name)) return;
      const b = boxIn(o, toLocal);
      if (!b) return;
      if (b.min.y > trilhoTopo) return;                 // não está embaixo
      if (b.max.y < p.floorY - 0.40) return;            // nem pendura longe
      if (b.max.y > p.floorY + 0.60) return;            // e não sobe pelo flanco
      const d = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
      if (d[2] > 2) return;                             // travessa corrida não é "caninho"
      const chave = `${matNames(o)} ${mm(d[0])}×${mm(d[1])}×${mm(d[2])}`;
      const e = fam.get(chave) ?? { n: 0, d: d.map(mm), y: [r3(b.min.y), r3(b.max.y)], itens: [] };
      e.n++;
      e.itens.push({
        x: r3((b.min.x + b.max.x) / 2), z: r3((b.min.z + b.max.z) / 2),
        y: [r3(b.min.y), r3(b.max.y)],
      });
      fam.set(chave, e);
    });
    /* E as peças NOMEADAS que a varredura da faixa preta encontrou — a lista
       nominal, com a caixa de cada uma, para a decisão de remover não depender
       de casar uma família por cota. */
    {
      const nominal: unknown[] = [];
      root.traverse((node) => {
        const o = node as THREE.Mesh;
        if (!o.isMesh || !o.geometry || !o.visible) return;
        if (!/^metal-pouco-polido$/i.test(matNames(o))) return;
        const b = boxIn(o);
        if (!b) return;
        if (b.min.y > p.floorY + 0.10 || b.max.y < p.floorY - 0.35) return;
        nominal.push({
          no: o.name,
          d_mm: [mm(b.max.x - b.min.x), mm(b.max.y - b.min.y), mm(b.max.z - b.min.z)],
          x: [r3(b.min.x), r3(b.max.x)], z: [r3(b.min.z), r3(b.max.z)],
          y_do_piso_mm: [mm(b.min.y - p.floorY), mm(b.max.y - p.floorY)],
          tris: (o.geometry.getIndex()?.count ?? 0) / 3,
        });
      });
      diag.C_polidos_na_faixa = nominal;
      /* E TODO tubo esbelto que SOBROU, para a remoção não passar por completa
         sem ser: o varão da porta traseira é esbelto igual e tem de ficar. */
      const esbeltos: unknown[] = [];
      root.traverse((node) => {
        const o = node as THREE.Mesh;
        if (!o.isMesh || !o.geometry || !o.visible) return;
        const b = boxIn(o);
        if (!b) return;
        const dx = b.max.x - b.min.x, dy = b.max.y - b.min.y, dz = b.max.z - b.min.z;
        if (dy < 2.0 || dx > 0.05 || dz > 0.05) return;
        esbeltos.push({
          no: o.name, material: matNames(o), d_mm: [mm(dx), mm(dy), mm(dz)],
          x: r3((b.min.x + b.max.x) / 2), z: r3((b.min.z + b.max.z) / 2),
          y_do_piso_mm: [mm(b.min.y - p.floorY), mm(b.max.y - p.floorY)],
        });
      });
      diag.C_esbeltos_restantes = esbeltos;
    }
    diag.C_baixo = [...fam.entries()]
      .sort((a, b) => b[1].n - a[1].n)
      .map(([k, v]) => ({
        familia: k, n: v.n, y: v.y,
        itens: v.itens.sort((a, b) => a.z - b.z),
      }));
  }

  diag.E_fitas = medeFitas(root);

  /* =======================================================================
     F — A RODADA DE 10:30: registro, mangueira, e o QUADRO DE BAIXO INTEIRO
     (flanco E testeira), mais a fita 3M horizontal que viaja com ele.
     ======================================================================= */
  {
    const reg: unknown[] = [];
    const mang: unknown[] = [];
    const quadro: unknown[] = [];
    const fitaH: unknown[] = [];
    root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.geometry || !o.visible) return;
      const nome = matNames(o);
      const b = boxIn(o);
      if (!b) return;
      const d = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
      const linha = {
        no: o.name, material: nome, d_mm: d.map(mm),
        x: r3((b.min.x + b.max.x) / 2), z: r3((b.min.z + b.max.z) / 2),
        y_do_piso_mm: [mm(b.min.y - p.floorY), mm(b.max.y - p.floorY)],
      };
      if (/registro/i.test(nome) || /registro/i.test(o.name || '')) reg.push(linha);
      if (/mangueid|mangueir/i.test(o.name || '')) mang.push(linha);
      /* O QUADRO DE BAIXO: perfil de arremate perto do piso, de qualquer
         orientação — o de flanco corre em Z, o da testeira corre em X, e
         `fixLowFrameRail()` só conhece o primeiro. */
      if (/metal-galvanizado-mantido/i.test(nome)
        && b.min.y < p.floorY + 0.30 && b.max.y > p.floorY - 0.30
        && Math.max(d[0], d[2]) > 1 && d[1] < 0.30) {
        quadro.push({ ...linha, corre_em: d[2] > d[0] ? 'Z (flanco)' : 'X (testeira)' });
      }
      /* A FITA 3M HORIZONTAL de 50 mm — a que viaja colada no perfil. */
      if (/faixa.?3m/i.test(nome) && d[1] < 0.08 && Math.max(d[0], d[2]) > 0.2
        && b.min.y < p.floorY + 0.30) {
        fitaH.push({ ...linha, corre_em: d[2] > d[0] ? 'Z (flanco)' : 'X (testeira)' });
      }
    });
    diag.F_registro = reg;
    diag.F_mangueira = mang;
    diag.F_quadro_de_baixo = quadro;
    diag.F_fita_horizontal = (fitaH as { y_do_piso_mm: number[] }[])
      .sort((a, b2) => a.y_do_piso_mm[0] - b2.y_do_piso_mm[0]).slice(0, 8);

    /* As COMPONENTES de cada registro — para saber se dá para separar por
       topologia (como o engate NÃO dava) e qual é a região do tubo marrom. */
    const comp: unknown[] = [];
    root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.geometry) return;
      if (!/registro/i.test(matNames(o))) return;
      const b = boxIn(o);
      if (!b) return;
      const cs = comps(o.geometry);
      comp.push({
        no: o.name, material: matNames(o),
        d_mm: [mm(b.max.x - b.min.x), mm(b.max.y - b.min.y), mm(b.max.z - b.min.z)],
        centro: [r3((b.min.x + b.max.x) / 2), r3((b.min.y + b.max.y) / 2), r3((b.min.z + b.max.z) / 2)],
        tris: (o.geometry.getIndex()?.count ?? 0) / 3,
        componentes: cs.length,
        comps: cs.map((tris) => {
          const cb = caixaDeTris(o.geometry, tris);
          return { tris: tris.length, d_local_mm: [mm(cb.max.x - cb.min.x), mm(cb.max.y - cb.min.y), mm(cb.max.z - cb.min.z)] };
        }).sort((a, b2) => b2.tris - a.tris).slice(0, 6),
      });
    });
    diag.F_registro_componentes = comp;

    /* A BANDA BRANCA junto ao piso que NÃO corre em Z — a da testeira e a da
       traseira. `fixLowFrameSkin()` só reconhece a que atravessa o vão. */
    const branca: unknown[] = [];
    root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.geometry || !o.visible) return;
      if (!/Cor_padrao_branco|metalBranco/i.test(matNames(o))) return;
      const b = boxIn(o);
      if (!b) return;
      const d = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
      if (d[1] > 0.35) return;                       // é banda, não parede
      if (b.min.y > p.floorY + 0.30) return;         // junto ao piso
      branca.push({
        no: o.name, d_mm: d.map(mm),
        x: r3((b.min.x + b.max.x) / 2), z: r3((b.min.z + b.max.z) / 2),
        y_do_piso_mm: [mm(b.min.y - p.floorY), mm(b.max.y - p.floorY)],
        corre_em: d[2] > d[0] ? 'Z (flanco)' : 'X (testeira/traseira)',
      });
    });
    diag.F_banda_branca = branca;

    /* TODA fita 3M horizontal junto ao piso, por orientação. */
    const todas: unknown[] = [];
    root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.geometry || !o.visible) return;
      if (!/faixa.?3m/i.test(matNames(o))) return;
      const b = boxIn(o);
      if (!b) return;
      const d = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
      if (d[1] > 0.08) return;
      if (b.min.y > p.floorY + 0.35) return;
      todas.push({
        d_mm: d.map(mm), x: r3((b.min.x + b.max.x) / 2), z: r3((b.min.z + b.max.z) / 2),
        y_do_piso_mm: [mm(b.min.y - p.floorY), mm(b.max.y - p.floorY)],
        corre_em: d[2] > d[0] ? 'Z (flanco)' : 'X (face)',
      });
    });
    const porFaixa = new Map<string, number>();
    for (const t of todas as { corre_em: string; y_do_piso_mm: number[] }[]) {
      const k = `${t.corre_em} · piso ${t.y_do_piso_mm[0]}…${t.y_do_piso_mm[1]}`;
      porFaixa.set(k, (porFaixa.get(k) ?? 0) + 1);
    }
    diag.F_fitas_baixas = [...porFaixa.entries()].map(([k, n]) => `${k} · n=${n}`);

    /* TUDO o que atravessa a TESTEIRA (ou a traseira) junto ao piso, seja qual
       for o material — é aqui que se vê o que faz (ou não faz) o papel do
       perfil de arremate na face dianteira. */
    const face: unknown[] = [];
    root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.geometry || !o.visible) return;
      const b = boxIn(o);
      if (!b) return;
      const d = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
      if (d[0] < 1.5) return;                       // atravessa o baú em X
      if (d[1] > 0.35) return;                      // é banda
      if (b.min.y > p.floorY + 0.30 || b.max.y < p.floorY - 0.30) return;
      const cz = (b.min.z + b.max.z) / 2;
      const ponta = cz > (p.z0 + p.z1) / 2 ? 'FRENTE' : 'TRASEIRA';
      face.push({
        no: o.name, material: matNames(o), d_mm: d.map(mm),
        z: r3(cz), ponta,
        y_do_piso_mm: [mm(b.min.y - p.floorY), mm(b.max.y - p.floorY)],
      });
    });
    diag.F_travessa_da_face = face;

    /* ---- G — a FERRAGEM DE PORTA no flanco (borracha + fêmea) e a GRADE das
       faixas lisas, para saber em qual friso ela está e em qual deveria. ---- */
    {
      const ferr: unknown[] = [];
      root.traverse((node) => {
        const o = node as THREE.Mesh;
        if (!o.isMesh || !o.geometry || !o.visible) return;
        const nm = matNames(o);
        if (!/borracha-preta|engate-femea-preto|suporte-varao-preto/i.test(nm)) return;
        const b = boxIn(o);
        if (!b) return;
        const d = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
        if (Math.max(...d) > 0.15) return;                 // peça pequena
        if (Math.abs((b.min.x + b.max.x) / 2) < 1.0) return;  // no flanco
        ferr.push({
          no: o.name, material: nm, d_mm: d.map(mm),
          x: r3((b.min.x + b.max.x) / 2), z: r3((b.min.z + b.max.z) / 2),
          cy_do_piso_mm: mm((b.min.y + b.max.y) / 2 - p.floorY),
        });
      });
      diag.G_ferragem_flanco = (ferr as { z: number }[]).sort((a, b2) => a.z - b2.z);

      /* A GRADE das faixas lisas do friso, do piso para cima — a régua contra a
         qual "o terceiro friso" faz sentido. A fase sai do mesmo dobramento que
         `measureRibProfile()` usa (crista + meio passo). */
      const row0 = p.floorY + p.skirtHeight;
      const face2 = diag.B_perfil as Record<string, unknown>;
      const dir = face2.right as { crista_centro_mm: number | null } | undefined;
      const cr = dir?.crista_centro_mm ?? null;
      if (cr !== null) {
        const pitch = p.pitch;
        const fasePlana = ((cr / 1000) + pitch / 2) % pitch;
        /* O TOPO DO QUADRO é onde a chapa começa a aparecer — a régua contra a
           qual "o terceiro friso" faz sentido. Ver `RAIL_TOP_UNDER_ROW0`. */
        const topoDoQuadro = row0 - 0.0478;
        const bandas: string[] = [];
        let k = 0;
        for (let n = -3; n <= 8; n++) {
          const base = Math.floor((p.floorY - fasePlana) / pitch) * pitch + fasePlana;
          const y = base + n * pitch;
          const visivel = y > topoDoQuadro;
          if (visivel) k++;
          bandas.push(`${visivel ? `#${k}` : ' -'} piso ${mm(y - p.floorY)} · row0 ${mm(y - row0)}`);
        }
        diag.G_faixas_lisas = {
          fasePlana_mm: mm(fasePlana), row0_do_piso_mm: mm(row0 - p.floorY),
          topo_do_quadro_do_piso_mm: mm(topoDoQuadro - p.floorY), bandas,
        };
      }
    }

    /* RAIO NA BASE DA TESTEIRA E DO FLANCO — quem aparece ali, altura por
       altura. A caixa diz o que EXISTE; o raio diz o que se VÊ, e a queixa é
       sobre o que se vê. */
    {
      const rc = new THREE.Raycaster();
      const linhas: string[] = [];
      const alvo = new THREE.Vector3();
      for (const [rot, dir, base] of [
        ['TESTEIRA (de frente)', new THREE.Vector3(0, 0, -1), 'z'],
        ['FLANCO direito', new THREE.Vector3(-1, 0, 0), 'x'],
      ] as [string, THREE.Vector3, string][]) {
        for (let mmDoPiso = 160; mmDoPiso >= -220; mmDoPiso -= 20) {
          const y = p.floorY + mmDoPiso / 1000;
          if (base === 'z') alvo.set(0.35, y, p.z1 + 3);
          else alvo.set(2.0, y, 1.0);
          rc.set(alvo, dir);
          const hit = rc.intersectObject(root, true)[0];
          const o = hit?.object as THREE.Mesh | undefined;
          linhas.push(`${rot} · piso ${mmDoPiso >= 0 ? '+' : ''}${mmDoPiso} mm -> `
            + (o ? `${matNames(o)} | ${o.name.slice(0, 40)}` : '(vazio)'));
        }
      }
        /* QUEM DEFINE O `floorY` — a malha branca mais baixa. `body.min.y` é o
         mínimo sobre TODA malha branca, então basta UMA peça descer mais que as
         outras para a régua inteira descer com ela. */
      const brancas: unknown[] = [];
      root.traverse((node) => {
        const o = node as THREE.Mesh;
        /* ⚠️ SEM o filtro de `visible`: `TrailerBody` ESCONDE as chapas de
           fábrica, e são elas que definem `floorY` — medir só o que está
           visível devolve o corpo paramétrico e mais nada. */
        if (!o.isMesh || !o.geometry) return;
        if (!/Cor_padrao_branco|metalBranco/i.test(matNames(o))) return;
        if (/^TRAILER_/.test(o.name)) return;
        const bb = boxIn(o);
        if (!bb) return;
        brancas.push({
          no: o.name, d_mm: [mm(bb.max.x - bb.min.x), mm(bb.max.y - bb.min.y), mm(bb.max.z - bb.min.z)],
          x: r3((bb.min.x + bb.max.x) / 2), z: r3((bb.min.z + bb.max.z) / 2),
          y_do_piso_mm: [mm(bb.min.y - p.floorY), mm(bb.max.y - p.floorY)],
          tris: (o.geometry.getIndex()?.count ?? 0) / 3,
        });
      });
      diag.F_brancas = (brancas as { y_do_piso_mm: number[] }[])
        .sort((a, b2) => a.y_do_piso_mm[0] - b2.y_do_piso_mm[0]).slice(0, 14);
      diag.F_raio_da_base = linhas;

      /* ---- H — A TESTEIRA INTEIRA, peça a peça. A escada, o suporte dela, o
         cano acima do Thermo King e os fios que descem dele estão todos aqui. */
      const test: unknown[] = [];
      root.traverse((node) => {
        const o = node as THREE.Mesh;
        if (!o.isMesh || !o.geometry || !o.visible) return;
        const bb = boxIn(o);
        if (!bb) return;
        const cz = (bb.min.z + bb.max.z) / 2;
        if (cz < p.z1 - 0.35) return;                 // só a testeira
        const d = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];
        test.push({
          no: o.name, material: matNames(o), d_mm: d.map(mm),
          x: r3((bb.min.x + bb.max.x) / 2), z: r3(cz),
          y_do_piso_mm: [mm(bb.min.y - p.floorY), mm(bb.max.y - p.floorY)],
          tris: (o.geometry.getIndex()?.count ?? 0) / 3,
        });
      });
      diag.H_testeira = (test as { y_do_piso_mm: number[] }[])
        .sort((a, b2) => b2.y_do_piso_mm[1] - a.y_do_piso_mm[1]);

      /* ---- H2 — TODA peça de material BRANCO que não é a chapa: o suporte da
         escada é uma delas, e ela não aparece no inventário da testeira porque
         `platico-branco` é material de PEÇA e não de lataria. */
      const brancasPeca: unknown[] = [];
      root.traverse((node) => {
        const o = node as THREE.Mesh;
        if (!o.isMesh || !o.geometry || !o.visible) return;
        const nm = matNames(o);
        if (!/branco|branca/i.test(nm)) return;
        if (/Cor_padrao_branco/i.test(nm)) return;      // é lataria
        const bb = boxIn(o);
        if (!bb) return;
        brancasPeca.push({
          no: o.name, material: nm,
          d_mm: [mm(bb.max.x - bb.min.x), mm(bb.max.y - bb.min.y), mm(bb.max.z - bb.min.z)],
          x: r3((bb.min.x + bb.max.x) / 2), z: r3((bb.min.z + bb.max.z) / 2),
          y_do_piso_mm: [mm(bb.min.y - p.floorY), mm(bb.max.y - p.floorY)],
        });
      });
      diag.H2_pecas_brancas = brancasPeca;

      /* ---- H3 — O QUE ENCOSTA NA ESCADA. ⚠️ Só a sonda vê isto: no app a
         fusão por material junta a escada inteira num balde e a peça some da
         medida (ver a nota de `merge.ts`). A escada são dois montantes de
         `metal-pouco-polido` 17,9 × 2 645 × 30,9 em x 1,072 e 1,235, z 4,322. */
      const escada: unknown[] = [];
      root.traverse((node) => {
        const o = node as THREE.Mesh;
        if (!o.isMesh || !o.geometry || !o.visible) return;
        const bb = boxIn(o);
        if (!bb) return;
        const cxx = (bb.min.x + bb.max.x) / 2, czz = (bb.min.z + bb.max.z) / 2;
        if (czz < p.z1 + 0.05 || czz > p.z1 + 0.30) return;
        if (cxx < 0.95 || cxx > 1.40) return;
        escada.push({
          no: o.name, material: matNames(o),
          d_mm: [mm(bb.max.x - bb.min.x), mm(bb.max.y - bb.min.y), mm(bb.max.z - bb.min.z)],
          x: r3(cxx), z: r3(czz),
          y_do_piso_mm: [mm(bb.min.y - p.floorY), mm(bb.max.y - p.floorY)],
        });
      });
      diag.H3_escada = (escada as { y_do_piso_mm: number[] }[])
        .sort((a, b2) => b2.y_do_piso_mm[1] - a.y_do_piso_mm[1]);

      /* ---- H4 — e a LATARIA que mora no plano da escada. Sem o filtro de
         `visible`, porque `TrailerBody` esconde a chapa de fábrica e é
         justamente nela que um suporte modelado junto com a parede estaria. */
      const latEscada: unknown[] = [];
      root.traverse((node) => {
        const o = node as THREE.Mesh;
        if (!o.isMesh || !o.geometry) return;
        if (!/Cor_padrao_branco|metalBranco/i.test(matNames(o))) return;
        if (/^TRAILER_/.test(o.name)) return;
        const bb = boxIn(o);
        if (!bb) return;
        const czz = (bb.min.z + bb.max.z) / 2;
        if (czz < p.z1 - 0.05) return;
        latEscada.push({
          no: o.name, material: matNames(o),
          d_mm: [mm(bb.max.x - bb.min.x), mm(bb.max.y - bb.min.y), mm(bb.max.z - bb.min.z)],
          x: r3((bb.min.x + bb.max.x) / 2), z: r3(czz),
          y_do_piso_mm: [mm(bb.min.y - p.floorY), mm(bb.max.y - p.floorY)],
          tris: (o.geometry.getIndex()?.count ?? 0) / 3,
        });
      });
      diag.H4_lataria_da_testeira = latEscada;
    }
  }

  /* =======================================================================
     A PROVA VISUAL — só quando pedida (`?foto=1`).
     ---------------------------------------------------------------------
     Ela existe porque a identificação de uma peça por cota é uma HIPÓTESE até
     alguém olhar. A bancada do app (`bench.mjs --gpu`) faria a foto no
     enquadramento do dono, mas ela trava sob SwiftShader quando encadeia troca
     de chassi e captura; aqui sobe só o implemento e sai em segundos.
     ======================================================================= */
  if (q.get('foto') === '1') {
    const alvo = new RegExp(q.get('alvo') || '^metal-preto$', 'i');
    const cota = (q.get('cota') || '17,45,110').split(',').map(Number);
    const tol = Number(q.get('tol') || 6);
    const pintados: THREE.Mesh[] = [];
    root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.geometry || !o.visible) return;
      if (!alvo.test(matNames(o))) return;
      const b = boxIn(o);
      if (!b) return;
      const d = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z]
        .map((x) => x * 1000).sort((x, y) => x - y);
      const c = [...cota].sort((x, y) => x - y);
      if (!d.every((x, i) => Math.abs(x - c[i]) < tol)) return;
      pintados.push(o);
    });
    diag.foto_marcadas = pintados.length;
    const imagens = await fotografa(root, p, pintados) as Record<string, unknown>;
    diag.varredura_da_faixa = imagens.__varredura;
    delete imagens.__varredura;
    diag.fotos = imagens;
  }

  window.__diag = diag;
  window.__ready = true;
}

/**
 * Fotografa o flanco e a frente na linha do piso, em dois passes: como está, e
 * com `alvos` em magenta. Devolve `dataURL` por enquadramento.
 */
async function fotografa(
  root: THREE.Object3D, p: { floorY: number; z0: number; z1: number },
  alvos: THREE.Mesh[],
): Promise<Record<string, string>> {
  const W = 1400, H = 620;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(2);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9aa3ad);
  const sol = new THREE.DirectionalLight(0xffffff, 2.6);
  sol.position.set(6, 9, 5);
  scene.add(sol, new THREE.AmbientLight(0xffffff, 0.9));
  scene.add(root);
  const cam = new THREE.PerspectiveCamera(32, W / H, 0.05, 200);

  const y = p.floorY - 0.03;
  /* A "banda" é a ELEVAÇÃO do flanco inteiro na linha do piso, de longe e com
     lente longa — o enquadramento das fotos do dono (21-11-23). É nela que a
     comparação com o semirreboque tem sentido: mesma escala, mesma altura,
     mesma janela relativa ao piso. */
  const meio = (p.z0 + p.z1) / 2;
  /* Os enquadramentos são os DAS FOTOS DO DONO, e é isso que os torna úteis:
     `friso` repete a 21-10-05 (a coluna de rebites contra a parede vizinha),
     `canto-frente` a 21-12-37 (a fita vertical no montante) e `engate` a
     21-15-33 (a ferragem que prende a traseira na lateral). Comparar A/B em
     enquadramento diferente do da queixa é comparar outra coisa. */
  const vistas: [string, number[], number[], number][] = [
    ['banda-direita', [1.30, y, meio], [1, 0, 0], 26],
    ['banda-esquerda', [-1.30, y, meio], [-1, 0, 0], 26],
    ['flanco-direito', [1.30, y, -1.2], [1.0, 0.16, -0.5], 3.4],
    ['flanco-esquerdo', [-1.30, y, -1.2], [-1.0, 0.16, -0.5], 3.4],
    ['frente', [0, y, p.z1], [0.5, 0.20, 1.0], 3.4],
    ['traseira', [0, y, p.z0], [0.5, 0.20, -1.0], 3.4],
    ['friso', [1.30, p.floorY + 1.2, meio], [1.0, 0.10, -0.30], 2.0],
    ['canto-frente', [1.28, p.floorY + 0.25, p.z1 - 0.10], [0.75, 0.10, 0.66], 1.9],
    ['canto-traseiro', [1.28, p.floorY + 0.25, p.z0 + 0.10], [0.75, 0.10, -0.66], 1.9],
  ];
  /* O ENGATE FÊMEA é enquadrado onde ELE está, e não numa cota escrita: os dois
     implementos o penduram em alturas diferentes (semirreboque piso −29 mm,
     sobrechassi piso +282 mm) e num z diferente. Uma vista fixa fotografaria
     parede num dos dois. */
  {
    let alvoF: THREE.Box3 | null = null;
    root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.geometry || !o.visible || alvoF) return;
      if (!/engate-femea-preto/i.test(matNames(o))) return;
      const b = boxIn(o);
      if (b && b.max.x > 0) alvoF = b;
    });
    const bf = alvoF as THREE.Box3 | null;
    if (bf) {
      vistas.push(['engate-femea',
        [(bf.min.x + bf.max.x) / 2, (bf.min.y + bf.max.y) / 2, (bf.min.z + bf.max.z) / 2],
        [1.0, 0.10, -0.22], 0.55]);
    }
  }
  const tira = () => {
    const saida: Record<string, string> = {};
    for (const [nome, alvoP, dir, dist] of vistas) {
      const a = new THREE.Vector3(alvoP[0], alvoP[1], alvoP[2]);
      const d = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
      cam.position.copy(a.clone().addScaledVector(d, dist));
      cam.lookAt(a);
      /* Lente longa nas vistas de longe: o que interessa é a ELEVAÇÃO, e uma
         grande angular a 26 m encolheria o baú a um traço. */
      cam.fov = dist > 10 ? 8 : dist < 1.2 ? 26 : 32;
      cam.updateProjectionMatrix();
      renderer.render(scene, cam);
      saida[nome] = renderer.domElement.toDataURL('image/png');
    }
    return saida;
  };
  /* ---- QUEM APARECE NA FAIXA PRETA, por raio ----
     A foto mostra barras verticais claras atravessando a faixa preta do
     sobrechassi que o semirreboque não tem. Identificá-las por cota é chute;
     por RAIO é medida: uma grade de raios pela MESMA câmera da elevação diz,
     pixel a pixel, qual malha está ali. */
  const varredura: Record<string, unknown> = {};
  {
    const rc = new THREE.Raycaster();
    for (const [nome, alvoP, dir, dist] of vistas) {
      if (!nome.startsWith('banda-')) continue;
      const a = new THREE.Vector3(alvoP[0], alvoP[1], alvoP[2]);
      const d = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
      cam.position.copy(a.clone().addScaledVector(d, dist));
      cam.lookAt(a);
      cam.fov = 8;
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld(true);
      const achados = new Map<string, { n: number; ndc: number[] }>();
      /* A faixa preta ocupa uma fatia estreita em v; varre-se ela inteira em u. */
      for (let iu = 0; iu <= 560; iu++) {
        for (const v of [-0.06, -0.03, 0, 0.03, 0.06]) {
          const u = -1 + (2 * iu) / 560;
          rc.setFromCamera(new THREE.Vector2(u, v), cam);
          const hit = rc.intersectObject(root, true)[0];
          if (!hit) continue;
          const o = hit.object as THREE.Mesh;
          const k = `${matNames(o)} | ${o.name}`;
          const e = achados.get(k);
          if (e) { e.n++; } else achados.set(k, { n: 1, ndc: [+u.toFixed(3), v] });
        }
      }
      varredura[nome] = [...achados.entries()]
        .sort((x, y) => y[1].n - x[1].n)
        .map(([k, e]) => `${k} · ${e.n} raios · 1º u=${e.ndc[0]}`);
    }
  }

  const antes = tira();
  const magenta = new THREE.MeshBasicMaterial({ color: 0xff00ff });
  const guarda = alvos.map((o) => ({ o, m: o.material }));
  for (const o of alvos) o.material = magenta;
  const depois = tira();
  for (const g of guarda) g.o.material = g.m;
  renderer.dispose();
  const saida: Record<string, string> = {};
  for (const k of Object.keys(antes)) {
    saida[k + '-normal'] = antes[k];
    saida[k + '-marcado'] = depois[k];
  }
  (saida as unknown as { __varredura: unknown }).__varredura = varredura;
  return saida;
}

/**
 * Face externa do TRILHO DE PISO e da PELE, POR FLANCO.
 *
 * ⚠️ `floorY` é obrigatório, e é ele que separa os DOIS perfis de arremate: o
 * de piso e o de topo têm o mesmo material, a mesma espessura e a mesma altura
 * de 210 mm no semirreboque. Sem a âncora do pé, a primeira volta desta
 * medição leu o perfil DE CIMA (y 3,961…4,171) e concluiu que o trilho do
 * semirreboque sobressai 3,1 mm — o número certo pela peça errada.
 */
function medeTrilho(root: THREE.Object3D, floorY: number) {
  const RAIL_RE = /^metal-galvanizado-mantido$/i;
  const WHITE_RE = /Cor_padrao_branco|metalBranco/i;
  const out: Record<string, unknown> = {};
  for (const sgn of [1, -1]) {
    let trilho = -Infinity, pele = -Infinity;
    let tb: THREE.Box3 | null = null;
    const vistos: unknown[] = [];
    root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.geometry || !o.visible) return;
      const b = boxIn(o);
      if (!b) return;
      const nome = matNames(o);
      const outer = sgn > 0 ? b.max.x : -b.min.x;
      if (sgn > 0 ? b.max.x <= 0 : b.min.x >= 0) return;
      /* A PELE é medida na FAIXA DO TRILHO, não no flanco inteiro: a crista do
         friso e a testeira estão em x diferentes, e o que interessa é o plano
         que o perfil tem de cobrir. */
      if (WHITE_RE.test(nome) && b.min.y < floorY + 0.35 && b.max.y > floorY
        && (b.max.z - b.min.z) > 1 && outer > pele) pele = outer;
      if (!RAIL_RE.test(nome)) return;
      if ((b.max.z - b.min.z) < 1) return;
      if ((b.max.x - b.min.x) > 0.06) return;
      if ((b.max.y - b.min.y) > 0.30) return;
      vistos.push({ y: [r3(b.min.y), r3(b.max.y)], h_mm: mm(b.max.y - b.min.y), x: r3(outer) });
      if (b.min.y > floorY + 0.30) return;                    // é o de TOPO
      if (outer > trilho) { trilho = outer; tb = b.clone(); }
    });
    const c = tb as THREE.Box3 | null;
    out[sgn > 0 ? 'direita' : 'esquerda'] = {
      pele_x: r3(pele), trilho_x: isFinite(trilho) ? r3(trilho) : null,
      sobressai_mm: isFinite(trilho) && isFinite(pele) ? mm(trilho - pele) : null,
      trilho_y: c ? [r3(c.min.y), r3(c.max.y)] : null,
      trilho_altura_mm: c ? mm(c.max.y - c.min.y) : null,
      pe_do_piso_mm: c ? mm(c.min.y - floorY) : null,
      topo_do_piso_mm: c ? mm(c.max.y - floorY) : null,
      perfis_vistos: vistos,
    };
  }
  return out;
}

/** TODA fita e TODO montante de canto, com a caixa — em MUNDO. */
function medeFitas(root: THREE.Object3D) {
  const fitas: Record<string, unknown>[] = [];
  const montantes: Record<string, unknown>[] = [];
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry || !o.visible) return;
    const nome = matNames(o);
    const b = boxIn(o);
    if (!b) return;
    const d = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
    if (/faixa.?3m/i.test(nome)) {
      if (!(d[1] > d[0] && d[1] > d[2])) return;               // só as VERTICAIS
      fitas.push({
        no: o.name, d_mm: d.map(mm),
        x: [r3(b.min.x), r3(b.max.x)], y: [r3(b.min.y), r3(b.max.y)],
        z: [r3(b.min.z), r3(b.max.z)],
        cx: r3((b.min.x + b.max.x) / 2), cz: r3((b.min.z + b.max.z) / 2),
        plano: d[0] < 0.005 ? 'flanco' : d[2] < 0.005 ? 'face' : 'dobrada',
      });
    }
    if (/metal-estrutura-principal-padrao|metal-galvanizado-mantido/i.test(nome)
      && d[1] > 2.0 && d[0] < 0.15 && d[2] < 0.15
      && Math.abs((b.min.x + b.max.x) / 2) > 1.0) {
      montantes.push({
        no: o.name, d_mm: d.map(mm),
        x: [r3(b.min.x), r3(b.max.x)], y: [r3(b.min.y), r3(b.max.y)],
        z: [r3(b.min.z), r3(b.max.z)],
        cx: r3((b.min.x + b.max.x) / 2), cz: r3((b.min.z + b.max.z) / 2),
      });
    }
  });
  /* E o DELTA de cada fita para o montante de canto do MESMO lado e ponta —
     é ele que se reproduz, e não um centro escolhido a olho. */
  for (const f of fitas) {
    const lado = (f.cx as number) > 0 ? 1 : -1;
    let melhor: Record<string, unknown> | null = null, dist = Infinity;
    for (const m of montantes) {
      if (((m.cx as number) > 0 ? 1 : -1) !== lado) continue;
      const dz = Math.abs((m.cz as number) - (f.cz as number));
      if (dz < dist) { dist = dz; melhor = m; }
    }
    f.montante = melhor ? melhor.no : null;
    f.montante_d_mm = melhor ? melhor.d_mm : null;
    f.dz_ate_centro_mm = melhor ? mm((melhor.cz as number) - (f.cz as number)) : null;
    f.dx_ate_centro_mm = melhor ? mm((melhor.cx as number) - (f.cx as number)) : null;
    f.dy_base_mm = melhor ? mm((f.y as number[])[0] - (melhor.y as number[])[0]) : null;
    f.dy_topo_mm = melhor ? mm((f.y as number[])[1] - (melhor.y as number[])[1]) : null;
  }
  return { fitas: fitas.sort((a, b) => (a.y as number[])[0] - (b.y as number[])[0]), montantes };
}

main().catch((e) => { window.__error = (e as Error)?.stack || String(e); window.__ready = true; });
