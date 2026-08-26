/* Bancada do IMPLEMENTO NOVO — o baú paramétrico aceita este bake?
   ---------------------------------------------------------------------------
   `probe.ts` mede a rodagem, `doorprobe.ts` mede a porta lateral do
   semirreboque. Esta responde a pergunta que só aparece quando um implemento
   NOVO entra no catálogo, e que nenhuma das duas cobre: **`TrailerBody` sabe
   ler este baú?**

   Ela existe porque `TrailerBody` é dirigido por MEDIDA, não por nome de peça —
   ele decompõe o material branco em cascas conexas e classifica cada uma
   (RIBBED / SPAN / REAR / FRONT / LOCAL). Isso é o que o torna portável entre
   bakes, e é também o que faz a falha ser SILENCIOSA quando ele não é: um baú
   em que nenhuma casca é reconhecida como frisada não lança erro nenhum —
   `buildTrailerRig()` engole a exceção de propósito ("o implemento carrega, só
   não redimensiona") e o usuário descobre no primeiro arrasto do controle de
   altura.

   O QUE ELA IMPRIME, e por que cada linha é uma decisão que pode dar errado:

     perfil      cascas, quantas frisadas, passo do friso e a caixa base. Duas
                 frisadas é o esperado (as duas laterais). ZERO significa que a
                 chapa deste bake não é extrusão pura em Z, e aí o
                 redimensionamento em Z está errado, não ausente.
     batente     `measureSill()`. Ele casa `FRAME_MAT_RE`
                 (`metal-galvanizado-mantido`), que é o nome do perfil de saia
                 NO SEMIRREBOQUE. Um bake que chame a mesma peça de outra coisa
                 cai no aviso "perfil inferior não encontrado" e a porta nasce
                 na linha do piso, dentro da cantoneira — o defeito 4 do
                 `PORTA-LATERAL-HANDOFF.md`, de volta.
     faixa_baixa levantamento POR MATERIAL do que existe entre o piso e 600 mm
                 abaixo dele, na pele. É daqui que sai o nome certo para
                 `FRAME_MAT_RE` quando o de cima falha.
     porta       nasce? com quantos triângulos? e sobrevive a um resize?
     resize      +300 mm de altura e +1 m de comprimento, e volta.

   USO
       node tools/trailer-bench/shoot-impl.mjs [arquivo.glb]
   O padrão é o sobrechassi; qualquer `.glb` de `public/models/vehicles/` serve. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TrailerBody } from '@/pages/tools/truck-studio/engine/vehicle/trailer-geometry';
import { markShared } from '@/pages/tools/truck-studio/engine/vehicle/geometry-share';
import {
  removeBakedSideDoor, removeMakerBranding, fixLowFrameSkin, fixCornerTape,
  fixLowFrameRail, removeExtraRearHose, removeStrayConduits,
} from '@/pages/tools/truck-studio/engine/vehicle/trailer-bake-fixes';

declare global {
  interface Window {
    __ready?: boolean;
    __error?: string;
    __diag?: unknown;
    __shot?: (dir: number[], target: number[] | null, dist: number, cru?: boolean) => string;
    __shotRel?: (u: number, v: number, w: number, dir: number[], distH: number) => string;
  }
}

const W = 1280, H = 860;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
/* SUPERAMOSTRAGEM OPCIONAL — `?ss=2` dobra a densidade de pixel.
   Ela existe para UM diagnóstico, e ele não é estético: cintilação que SOME
   com mais pixel é geometria sub-pixel (aliasing), e cintilação que FICA é
   empate de z-buffer. As duas parecem a mesma coisa numa foto, e o conserto de
   cada uma é em lugar diferente — decimar a malha contra separar dois planos. */
renderer.setPixelRatio(Math.max(1, Math.min(4, +(new URLSearchParams(location.search).get('ss') || 1))));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2d31);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.DirectionalLight(0xffffff, 2.2).translateY(0), new THREE.AmbientLight(0xffffff, 0.35));
(scene.children[0] as THREE.DirectionalLight).position.set(6, 8, 5);

const camera = new THREE.PerspectiveCamera(35, W / H, 0.05, 300);

const triCount = (m: THREE.Mesh | undefined | null) => {
  const p = m?.geometry?.getAttribute('position') as THREE.BufferAttribute | undefined;
  return p ? p.count / 3 : 0;
};

async function main() {
  const q = new URLSearchParams(location.search);
  const file = q.get('impl') || 'sobrechassi_frigorifico_gancheiro.glb';
  /* O MESMO valor que `implements.json` declara — a bancada não adivinha, ela
     recebe. Sem isto ela mediria o batente com o material do semirreboque e
     reprovaria um implemento que o app monta certo. */
  const sillSrc = q.get('sill') || '';
  /** O perfil de arremate (quadro de cima e de baixo) — ver `frameMaterial`. */
  const frameSrc = q.get('frame') || sillSrc;
  /* As remoções de bake do implemento, na MESMA ordem do app: antes do
     `TrailerBody`. Sem elas a bancada julgaria uma parede que o estúdio não
     mostra — com a porta de fábrica ainda pendurada nela. */
  const tiraPorta = q.get('porta') === '1';
  const tiraMarca = q.get('marca') === '1';

  const draco = new DRACOLoader();
  draco.setDecoderPath('/vendor/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  const gltf = await loader.loadAsync('/models/vehicles/' + file);
  const root = gltf.scene;
  root.updateWorldMatrix(true, true);
  scene.add(root);

  /* ASSENTADO COMO O ENGINE ASSENTA. `TrailerBody` mede em espaço de MUNDO, e
     o engine só o constrói depois de `groundAndCenter()`. Sem isto a bancada
     mediria o baú na pose crua do bake e o `floorY` sairia de outro zero —
     comparar os números com os do app viraria adivinhação. Aqui basta o caso
     simples (centrar em X, pousar o ponto mais baixo em y = 0), porque o que
     está em julgamento é a DECOMPOSIÇÃO, que é invariante a translação. */
  {
    const b = new THREE.Box3().setFromObject(root);
    root.position.x -= (b.min.x + b.max.x) / 2;
    root.position.y -= b.min.y;
    root.updateWorldMatrix(true, true);
  }

  const diag: Record<string, unknown> = { arquivo: file, sillMaterial: sillSrc || '(padrão)' };
  /* ⚠️ `markShared()` ANTES de qualquer correção de vértice, como
     `buildTrailerRig()` faz. Sem ela uma correção sobre geometria
     COMPARTILHADA roda DUAS vezes — os dois trilhos de piso são o mesmo molde,
     e o perfil saía com 280 mm em vez de 210. Era a armadilha documentada no
     `HANDOFF-SOBRECHASSI-2026-08-19.md` ("nunca tire conclusão de cota de
     vértice a partir do shoot-impl"); agora dá para tirar. */
  diag.geometriaCompartilhada = markShared(root);
  if (tiraPorta) diag.portaDeFabricaRemovida = removeBakedSideDoor(root);
  if (tiraMarca) diag.marcaDoFabricanteRemovida = removeMakerBranding(root).removed;
  if (q.get('banda') === '1' && frameSrc) {
    diag.bandaDeBaixoVirouFrame = fixLowFrameSkin(root, new RegExp(frameSrc, 'i'));
  }
  const box = new THREE.Box3().setFromObject(root);

  /* ---- material: o inventário cru, que é o que explica todo o resto ---- */
  {
    const inv = new Map<string, { malhas: number; tris: number }>();
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const x of mats) {
        const k = x?.name || '(sem nome)';
        const e = inv.get(k) ?? { malhas: 0, tris: 0 };
        e.malhas++; e.tris += triCount(m);
        inv.set(k, e);
      }
    });
    diag.materiais = [...inv.entries()]
      .sort((a, b) => b[1].tris - a[1].tris)
      .map(([k, v]) => `${k}: ${v.malhas} malhas, ${Math.round(v.tris)} tris`);
  }

  /* ---- o baú paramétrico ---- */
  let body: TrailerBody | null = null;
  try {
    /* O KIT COMPARTILHADO, como o app carrega. Sem ele a bancada julgaria a
       porta que o bake local consegue montar, não a que o estúdio mostra. */
    let kit: THREE.Object3D | undefined;
    if (q.get('kit') !== '0') {
      try {
        kit = (await loader.loadAsync('/models/vehicles/porta_kit_v1.glb')).scene;
      } catch { /* opcional, como no app */ }
    }
    body = new TrailerBody(root, {
      ...(frameSrc ? { frameMaterial: new RegExp(frameSrc, 'i') } : {}),
      ...(sillSrc ? { sillMaterial: new RegExp(sillSrc, 'i') } : {}),
      ...(kit ? { kit } : {}),
    });
    root.add(body.group);
  } catch (e) {
    diag.perfil = 'FALHOU: ' + ((e as Error)?.message || String(e));
  }

  if (body) {
    const p = body.profile;
    diag.perfil = {
      cascas: p.shells,
      frisadas: p.ribbedShells,
      frisos: p.ribCount,
      passo_mm: +(p.pitch * 1000).toFixed(2),
      topo_do_perfil_y: p.topRailY === null ? null : +p.topRailY.toFixed(4),
      piso_y: +p.floorY.toFixed(4),
      base: {
        comprimento: +p.base.length.toFixed(3),
        altura: +p.base.height.toFixed(3),
        largura: +p.base.width.toFixed(3),
      },
      z0: +p.z0.toFixed(3), z1: +p.z1.toFixed(3),
      tris_corpo: Math.round(triCount(body.mesh)),
    };

    /* AS CASCAS, UMA A UMA — o diagnóstico que diz POR QUE nenhuma foi aceita
       como frisada. `shells` é privado só no compilador; aqui a bancada precisa
       ver a decomposição, que é justamente o que ela existe para julgar.
       O teste do engine é: estar na pele externa E atravessar 90 % do vão em Z
       E cobrir mais de metade da altura E exibir ≥ 20 fileiras no passo. */
    {
      const shells = (body as unknown as { shells: Array<{
        min: THREE.Vector3; max: THREE.Vector3; behaviour: string; tris: unknown[];
      }> }).shells;
      const bodyL = p.z1 - p.z0;
      const bodyH = p.roofY - p.floorY;
      const cx = 0;
      const half = p.base.width / 2;
      diag.cascas = shells
        .map((sh) => {
          const spanZ = sh.max.z - sh.min.z, spanY = sh.max.y - sh.min.y;
          const onSkin = Math.abs(sh.max.x - cx) > half - 0.05
            || Math.abs(sh.min.x - cx) > half - 0.05;
          return {
            comportamento: sh.behaviour,
            tris: sh.tris.length,
            dz: +spanZ.toFixed(3), dy: +spanY.toFixed(3), dx: +(sh.max.x - sh.min.x).toFixed(3),
            x: [+sh.min.x.toFixed(3), +sh.max.x.toFixed(3)],
            y: [+sh.min.y.toFixed(3), +sh.max.y.toFixed(3)],
            z: [+sh.min.z.toFixed(3), +sh.max.z.toFixed(3)],
            pele: onSkin,
            passa_z: spanZ > bodyL * 0.9,
            passa_y: spanY > bodyH * 0.5,
          };
        })
        .filter((c) => c.pele)
        .sort((a, b) => b.dy - a.dy)
        .map((c) => `${c.comportamento} tris ${c.tris} · dx ${c.dx} dy ${c.dy} dz ${c.dz}`
          + ` · x ${c.x[0]}…${c.x[1]} · y ${c.y[0]}…${c.y[1]} · z ${c.z[0]}…${c.z[1]}`
          + ` · z✓${c.passa_z ? 1 : 0} y✓${c.passa_y ? 1 : 0}`);
      diag.limiares = {
        bodyL: +bodyL.toFixed(3), z_minimo: +(bodyL * 0.9).toFixed(3),
        bodyH: +bodyH.toFixed(3), y_minimo: +(bodyH * 0.5).toFixed(3),
        meia_largura: +half.toFixed(3), pele_a_partir_de: +(half - 0.05).toFixed(3),
        total_cascas: shells.length,
      };
    }

    const floorY = p.floorY;
    /* Na MESMA janela do app: depois do `TrailerBody` (que mede piso e teto) e
       antes de qualquer medida de peça. Ver `TrailerRig`. */
    if (q.get('fita') === '1') diag.fitaDeCantoReancorada = fixCornerTape(root, p.floorY, p.roofY);
    /* O TRILHO DE PISO — a correção de 2026-08-19. O relatório traz a caixa
       ANTES e DEPOIS de cada perfil, que é o que separa "não achou" de
       "achou e mexeu pouco". */
    {
      const antes: number[][] = [];
      const depois: number[][] = [];
      const caixaDoTrilho = (destino: number[][]) => {
        const v = new THREE.Vector3();
        const inv = root.matrixWorld.clone().invert();
        root.updateWorldMatrix(true, true);
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh || !m.geometry?.attributes?.position) return;
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          if (!mats.some((x) => /^metal-galvanizado-mantido$/i.test(x?.name || ''))) return;
          const pos = m.geometry.attributes.position as THREE.BufferAttribute;
          const mm2 = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
          const b = new THREE.Box3();
          for (let i = 0; i < pos.count; i++) {
            b.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(mm2));
          }
          destino.push([b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]
            .map((n) => +n.toFixed(4)));
        });
      };
      caixaDoTrilho(antes);
      diag.trilhoAntes = antes;
      if (q.get('trilho') === '1') {
        diag.trilhoDePiso = fixLowFrameRail(root, p.floorY, p.floorY + p.skirtHeight);
        caixaDoTrilho(depois);
        diag.trilhoDepois = depois;
      }
      diag.pisoDoBau = +p.floorY.toFixed(4);
      const pele = new THREE.Box3();
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.geometry?.attributes?.position) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        if (!mats.some((x) => /Cor_padrao_branco|metalBranco/i.test(x?.name || ''))) return;
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        const gb = m.geometry.boundingBox;
        if (gb) pele.union(gb.clone().applyMatrix4(m.matrixWorld));
      });
      diag.peleX = [+pele.min.x.toFixed(4), +pele.max.x.toFixed(4)];
    }
    if (q.get('mangueira') === '1') diag.mangueiraRemovida = removeExtraRearHose(root);
    /* Os "caninhos" — sete tubos de 20 × 20 mm embutidos na parede. Ver
       `removeStrayConduits()`; no app eles saem antes do rig, aqui a posição é
       por coerência de foto (eles não entram em medida nenhuma). */
    if (q.get('tubos') === '1') diag.tubosRemovidos = removeStrayConduits(root);
  /* ---- faixa baixa da pele, POR MATERIAL — a fonte de FRAME_MAT_RE ---- */
  {
    const v = new THREE.Vector3();
    const skin = (box.max.x - box.min.x) / 2 - 0.06;
    const lower: Record<string, { yMin: number; yMax: number; n: number }> = {};
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible || !m.geometry?.attributes?.position) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const name = mats.map((x) => x?.name || '?').join('+');
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        if (Math.abs(v.x) < skin) continue;
        /* A MESMA JANELA DE `measureSill()`, e ela é relativa ao PISO DO BAÚ
           — não à base do modelo. Medir daquela outra referência foi o primeiro
           erro desta bancada: no semirreboque o piso fica 1,62 m acima do
           ponto mais baixo (a rodagem), então uma janela ancorada na base lia
           pneu e para-lama e não encostava no perfil que interessa. */
        if (v.y < floorY - 0.40 || v.y > floorY + 0.30) continue;
        const e = lower[name] ?? (lower[name] = { yMin: Infinity, yMax: -Infinity, n: 0 });
        if (v.y < e.yMin) e.yMin = v.y;
        if (v.y > e.yMax) e.yMax = v.y;
        e.n++;
      }
    });
    diag.faixa_baixa = Object.entries(lower)
      .sort((a, b) => b[1].yMax - a[1].yMax)
      .map(([k, e]) => `${k}: y ${e.yMin.toFixed(3)}…${e.yMax.toFixed(3)}`
        + ` (topo ${((e.yMax - floorY) * 1000).toFixed(0)} mm acima do piso, ${e.n} v)`);
  }


    /* O batente: `measureSill()` é privado, mas o valor dele sai no layout da
       porta. Uma porta a 2,0 m da testeira, 0,87 × 2,35 m — a medida do
       semirreboque, que é o padrão de fábrica da Ibiporã. */
    const before = triCount(body.mesh);
    let porta: unknown = null;
    try {
      body.setDoors('right', [{ position: 2.0, width: 0.87, height: 2.35 }]);
      const parts = body.group.children.filter(
        (o) => (o as THREE.Mesh).isMesh && o.name.startsWith('PORTA_'),
      ) as THREE.Mesh[];
      const marco = parts.find((o) => o.name.startsWith('PORTA_MARCO'));
      let base: number | null = null;
      if (marco) {
        const g = marco.geometry as THREE.BufferGeometry;
        g.computeBoundingBox();
        base = +(g.boundingBox as THREE.Box3).min.y.toFixed(4);
      }
      porta = {
        pecas: parts.map((o) => `${o.name}×${Math.round(triCount(o))}t`),
        tris_corpo_antes: Math.round(before),
        tris_corpo_depois: Math.round(triCount(body.mesh)),
        marco_base_y: base,
        /* A distância entre a base do vão e o piso do baú é o que o batente
           medido vale. ~0 significa que `measureSill()` não achou o perfil e
           caiu na linha do piso. */
        batente_mm: base === null ? null : +((base - p.floorY) * 1000).toFixed(1),
      };
    } catch (e) {
      porta = 'FALHOU: ' + ((e as Error)?.message || String(e));
    }
    diag.porta = porta;

    try {
      const grown = body.set({ height: p.base.height + 0.30, length: p.base.length + 1.0 });
      diag.resize = {
        pedido: { altura: +(p.base.height + 0.30).toFixed(3), comprimento: +(p.base.length + 1.0).toFixed(3) },
        efetivo: { altura: +grown.height.toFixed(3), comprimento: +grown.length.toFixed(3) },
        tris_corpo: Math.round(triCount(body.mesh)),
      };
      body.set({ height: p.base.height, length: p.base.length });
    } catch (e) {
      diag.resize = 'FALHOU: ' + ((e as Error)?.message || String(e));
    }
  }

  window.__diag = diag;

  const centre = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() / 2;
  /* O MODO CRU: esconde o corpo paramétrico e devolve as malhas brancas de
     fábrica à cena. É o A/B que separa "o bake já brigava no z-buffer" de "o
     corpo paramétrico introduziu a briga" — e sem ele a leitura de uma foto
     com cintilação é adivinhação. */
  const parametric = body ? body.group : null;
  const originals = (body as unknown as { originals?: THREE.Mesh[] } | null)?.originals ?? [];
  const setCru = (on: boolean) => {
    if (parametric) parametric.visible = !on;
    for (const m of originals) m.visible = on;
  };

  /* ===================== VISTAS RELATIVAS =====================
     Os dois implementos têm tamanhos diferentes (14,7 m contra 8,4 m de baú),
     então comparar por coordenada absoluta compara lugares diferentes. Estas
     vistas são ancoradas na CAIXA DO BAÚ em coordenadas normalizadas:

        u  0 = traseira, 1 = testeira   (ao longo de z)
        v  0 = piso,     1 = teto       (ao longo de y)
        w  −1 = flanco motorista, +1 = passageiro

     e a distância é dada em ALTURAS DE BAÚ, não em metros. Assim o mesmo
     comando enquadra a mesma REGIÃO nos dois modelos, na mesma escala
     aparente — que é a condição para uma comparação de imagem valer alguma
     coisa. */
  const bau = body
    ? new THREE.Box3(
      new THREE.Vector3(-body.profile.base.width / 2, body.profile.floorY, body.profile.z0),
      new THREE.Vector3(body.profile.base.width / 2, body.profile.roofY, body.profile.z1),
    )
    : box;
  window.__shotRel = (u, v, w, dir, distH) => {
    const t = new THREE.Vector3(
      w * (bau.max.x - bau.min.x) / 2,
      bau.min.y + v * (bau.max.y - bau.min.y),
      bau.min.z + u * (bau.max.z - bau.min.z),
    );
    const h = bau.max.y - bau.min.y;
    return (window.__shot as NonNullable<typeof window.__shot>)(dir, t.toArray(), distH * h);
  };

  window.__shot = (dir, target, dist, cru) => {
    setCru(!!cru);
    const t = target && target.length ? new THREE.Vector3(...target) : centre;
    const d = new THREE.Vector3(...dir).normalize();
    camera.position.copy(t).addScaledVector(d, dist || radius * 1.6);
    camera.lookAt(t);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    const png = renderer.domElement.toDataURL('image/png');
    setCru(false);
    return png;
  };
  window.__ready = true;
}

main().catch((e) => {
  window.__error = (e as Error)?.stack || String(e);
  window.__ready = true;
});
