/* Bancada da PORTA LATERAL — o vão, a folha, a moldura e a ferragem.
   ---------------------------------------------------------------------------
   Mesma doutrina de `probe.ts`, e pelo mesmo motivo que o README dá: "uma medida
   que não vira imagem não prova aparência". Aqui a medida que precisa virar
   imagem é o recorte — um vão pode estar geometricamente certo e visualmente
   arruinado por z-fighting, por friso desalinhado ou por uma normal invertida
   que apaga a peça com `FrontSide`.

   Roda O CÓDIGO DE VERDADE: importa `TrailerBody` de `engine/vehicle/`, não uma
   cópia. Não sobe o rig inteiro — `TrailerRig` traz `TrailerAssembly` e a
   medição de engate, que não têm nada a ver com porta e só acrescentariam
   maneiras de a bancada falhar por motivo alheio.

   O que ela mede, além de fotografar:

     · triângulos do corpo com e sem porta (o vão TIRA chapa e a folha DEVOLVE,
       então a conta não é monotônica — e é justamente por isso que vale medir);
     · a folga em X entre a folha e a crista do friso da parede, contra os
       ~0,149 mm que o z-buffer resolve a 25 m;
     · se as três malhas de peça nasceram e com quantos triângulos;
     · se a porta sobrevive a um resize (é o que `stageDoors`/`rebuild` prometem). */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TrailerBody } from '@/pages/tools/truck-studio/engine/vehicle/trailer-geometry';
import { DOOR_REVEAL } from '@/pages/tools/truck-studio/engine/vehicle/trailer-door';

declare global {
  interface Window {
    __ready?: boolean;
    __error?: string;
    __diag?: unknown;
    __shot?: (dir: number[], target: number[], dist: number, paint?: boolean, diag?: boolean, hide?: string) => string;
    __ray?: () => unknown;
  }
}

const W = 1280, H = 860;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2d31);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(6, 8, 5);
scene.add(key, new THREE.AmbientLight(0xffffff, 0.35));

const camera = new THREE.PerspectiveCamera(35, W / H, 0.05, 200);

/** Caixa de um conjunto de triângulos lida do ATRIBUTO, não de `setFromObject`. */
function boxOfAttr(geo: THREE.BufferGeometry) {
  const p = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!p || !p.count) return null;
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) b.expandByPoint(v.fromBufferAttribute(p, i));
  return b;
}

const triCount = (m: THREE.Mesh) => {
  const p = m.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  return p ? p.count / 3 : 0;
};

/* `leafClearance()` morava aqui: media o menor X entre a folha e a chapa para
   decidir se a porta piscava. Ela pressupunha folha e parede na MESMA faixa de
   Y/Z, que deixou de ser verdade quando o vão passou a ser recortado — hoje há
   94,5 mm de batente entre uma e outra e elas não têm como brigar no z-buffer.
   Ver o bloco `batente` em `__diag`, que é o que ocupou o lugar dela. */

async function main() {
  const draco = new DRACOLoader();
  draco.setDecoderPath('/vendor/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  const gltf = await loader.loadAsync('/models/vehicles/trailer.glb');
  const root = gltf.scene;
  root.updateWorldMatrix(true, true);
  scene.add(root);

  const body = new TrailerBody(root);
  root.add(body.group);
  /* Nenhum asset de porta: o kit é extraído do PRÓPRIO implemento pelo
     construtor de `TrailerBody`. Ver `extractDoorKit()`. */
  const prof = body.profile;

  /* Levantamento da FAIXA BAIXA da lateral: que peça está entre o piso do baú e
     meio metro abaixo dele, e até onde ela sobe. É daqui que sai o batente
     inferior — a porta tem de nascer ACIMA do perfil metálico, não em cima
     dele. Por material, porque é o material que diz o que a peça é. */
  const lower: Record<string, { yMax: number; yMin: number; n: number }> = {};
  {
    const v = new THREE.Vector3();
    const fy = body.profile.floorY;
    const skin = body.profile.base.width / 2 - 0.06;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible || !m.geometry?.attributes?.position) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const name = mats.map((x) => x?.name || '?').join('+');
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        if (Math.abs(v.x) < skin) continue;
        if (v.y > fy + 0.05 || v.y < fy - 0.60) continue;
        const e = lower[name] ?? (lower[name] = { yMax: -Infinity, yMin: Infinity, n: 0 });
        if (v.y > e.yMax) e.yMax = v.y;
        if (v.y < e.yMin) e.yMin = v.y;
        e.n++;
      }
    });
  }

  const before = triCount(body.mesh);

  /* Uma porta plausível de paletteiro: 1,10 × 2,10 m, começando 4,00 m atrás da
     testeira. Do lado `right` porque é a face de MAIOR X (ver o tipo `Face`) —
     e é para ela que a câmera aponta. */
  const door = { position: 4.0, width: 0.87, height: 2.35 };   // a medida do modelo
  body.setDoors('right', [door]);
  const after = triCount(body.mesh);

  /* AS PEÇAS SÃO RELIDAS A CADA USO, e isso é o conserto de um defeito que
     custou três renders: `rebuild()` DESCARTA e RECRIA as malhas de marco e
     borracha (ver `rebuildJambs`), então uma lista capturada aqui fica apontando
     para objetos que já saíram da cena. O teste de esconder o marco não mudava
     nada na imagem — porque escondia um marco morto — e a leitura foi "o marco
     não é isso que estou vendo", que é falso. */
  const partsOf = () => body.group.children.filter(
    (o) => (o as THREE.Mesh).isMesh && o.name.startsWith('PORTA_'),
  ) as THREE.InstancedMesh[];
  const parts = partsOf();

  /* A crista da lateral `right` é o MAIOR x do corpo. Lida do perfil e não
     suposta em `width / 2`: o baú não é obrigado a estar centrado em x = 0, e
     esta medida é comparada contra folgas de milímetros. */
  const skinR = prof.base.width / 2;
  const z1 = prof.z1;
  /* O BATENTE — a peça que fechou o vão, e a que esta bancada existe para
     conferir hoje.

     A métrica antiga daqui era `folga_folha_parede`: partia a pele `right` em
     duas famílias pelo X e checava se a folha estava longe o bastante da parede
     para não brigar no z-buffer. Ela fazia sentido enquanto folha e parede
     ocupavam a MESMA faixa de Y/Z (folha desenhada por cima da chapa inteira).
     Com o vão recortado elas são disjuntas — entre uma e outra há 94,5 mm de
     batente — e o número virou ruído: a 5,1 mm de recuo, o VALE da parede
     (5,2 mm de relevo) cai atrás da CRISTA da folha e nenhum plano em X separa
     as duas famílias. Ela devolvia 0,289 mm e um `aprovado: false` que não
     apontava defeito nenhum.

     O que precisa de prova agora é outro: o batente EXISTE, cobre o vão inteiro
     e tem a profundidade medida. Um vão sem batente é um furo para dentro do
     baú, e é o defeito que mandou esta feature de volta. */
  const jamb = body.group.children.find(
    (o) => o.name.startsWith('PORTA_MARCO'),
  ) as THREE.Mesh | undefined;
  const jambBox = (() => {
    if (!jamb) return null;
    const g = jamb.geometry as THREE.BufferGeometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const b = g.boundingBox as THREE.Box3;
    return {
      z: [+b.min.z.toFixed(4), +b.max.z.toFixed(4)],
      y: [+b.min.y.toFixed(4), +b.max.y.toFixed(4)],
      profundidade_mm: +((skinR - b.min.x) * 1000).toFixed(1),
      material: (jamb.material as THREE.Material).name,
      /* Cor e metalness do marco: é por eles que ele lê como perfil escuro ou
         como espelho. Um `color` escuro num metal puro não escurece nada — a
         cor tinge o REFLEXO, e o reflexo é a sala branca do ambiente. Sem estes
         dois números, "o marco continua claro" não distingue entre "a tinta não
         foi aplicada" e "a tinta foi aplicada e não adianta". */
      acabamento: (() => {
        const s = jamb.material as THREE.MeshStandardMaterial;
        return {
          cor: '#' + s.color.getHexString(),
          metalness: +s.metalness.toFixed(3),
          roughness: +s.roughness.toFixed(3),
          tem_map: !!s.map, tem_metalnessMap: !!s.metalnessMap,
          /* As camadas por cima da cor. Um `clearcoat` ligado reflete a sala
             branca do ambiente e ignora a cor de base — sem esta linha,
             "escureci o marco e ele continua claro" não tem explicação. */
          clearcoat: (s as THREE.MeshPhysicalMaterial).clearcoat,
          sheen: (s as THREE.MeshPhysicalMaterial).sheen,
          envMapIntensity: s.envMapIntensity,
          tipo: s.type,
        };
      })(),
      tris: triCount(jamb),
    };
  })();

  /* Sobrevive ao resize? Sobe 30 cm e alonga 1 m, e a porta tem de continuar lá
     — com a MESMA distância da testeira, porque o baú cresce para trás. */
  const grown = body.set({ height: prof.base.height + 0.30, length: prof.base.length + 1.0 });
  const afterResize = triCount(body.mesh);
  const partsAfter = parts.map((m) => `${m.name}×${m.count}`);
  /* O Z do BATENTE depois do resize — é ele que prova a âncora dianteira.
     Antes esta leitura vinha das matrizes de instância dos montantes, que não
     existem mais desde que a moldura saliente deu lugar ao batente recuado; ela
     devolvia `null` calada, e um `null` não reprova nada. O batente é malha
     simples e em espaço de mundo, então a caixa dele JÁ é a resposta.

     A caixa é a do VÃO, não a da folha: ela abre `DOOR_REVEAL` além da folha em
     cada lado, e é por isso que o esperado abaixo desconta o mesmo. */
  const doorBoxAfter = (() => {
    const m = body.group.children.find(
      (o) => o.name.startsWith('PORTA_MARCO'),
    ) as THREE.Mesh | undefined;
    if (!m) return null;
    const g = m.geometry as THREE.BufferGeometry;
    g.computeBoundingBox();
    const b = g.boundingBox as THREE.Box3;
    return { lo: b.min.z + DOOR_REVEAL, hi: b.max.z - DOOR_REVEAL };
  })();
  body.set({ height: prof.base.height, length: prof.base.length });

  /* ============================ O VÉU CINZA DO EDITOR ======================
     Réplica de `measurePaintable()` (vehicle/livery.ts), rodada AQUI porque o
     defeito que ela produz — "adicionei uma porta e metade do painel virou
     cinza" — só aparece no editor, e abrir o editor não é um teste.

     O conjunto de candidatos é o MESMO do aplicativo: a função ignora as chapas
     recortadas, as sobreposições de arte e tudo que for branco, e essas três
     famílias são justamente as que esta bancada não tem. O que sobra — perfis,
     ferragem, e agora as malhas `PORTA_*` — é idêntico.

     A caixa do painel é sintetizada como `buildLiveryPanels()` a recorta:
     triângulo cujo menor x está a menos de `LIVERY_SKIN_SIDE` da face. */
  const veu = (() => {
    const SKIN_REACH = 0.02, SKIN_OUT = 0.20;
    const RAIL_SPAN = 0.5, MIN_BAND = 0.15, SKIN_SIDE = 0.04;
    const bodyGeo = body.mesh.geometry as THREE.BufferGeometry;
    const bp = bodyGeo.getAttribute('position') as THREE.BufferAttribute;
    const pb = new THREE.Box3();
    const t0 = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3();
    const full = boxOfAttr(bodyGeo);
    if (!full) return null;
    for (let i = 0; i < bp.count; i += 3) {
      t0.fromBufferAttribute(bp, i); t1.fromBufferAttribute(bp, i + 1); t2.fromBufferAttribute(bp, i + 2);
      if (Math.min(t0.x, t1.x, t2.x) < full.max.x - SKIN_SIDE) continue;
      pb.expandByPoint(t0); pb.expandByPoint(t1); pb.expandByPoint(t2);
    }
    const spanY = pb.max.y - pb.min.y;
    /* A face EXTERNA da chapa. Esta bancada fotografa a lateral `right`, que
       `buildLiveryPanels()` recorta no MAIOR x — o mesmo datum de lá. */
    const face = pb.max.x;
    const lo = pb.min.z, hi = pb.max.z, runLen = hi - lo;

    root.updateWorldMatrix(true, true);
    const toLocal = root.matrixWorld.clone().invert();
    const bx = new THREE.Box3(), mm = new THREE.Matrix4();
    const bands: [number, number][] = [];
    const blame: string[] = [];
    root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.visible || !o.geometry) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some((m) => !!m && /cor_padrao_branco|metalbranco/i.test(m.name || ''))) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const gb = o.geometry.boundingBox;
      if (!gb) return;
      bx.copy(gb).applyMatrix4(mm.multiplyMatrices(toLocal, o.matrixWorld));
      if (bx.isEmpty()) return;
      if (bx.max.x < face - SKIN_REACH) return;   // fica atrás da pele
      if (bx.min.x > face + SKIN_OUT) return;     // fica longe demais dela
      const cover = Math.min(bx.max.z, hi) - Math.max(bx.min.z, lo);
      if (cover < runLen * RAIL_SPAN) return;
      const y0 = Math.max(bx.min.y, pb.min.y), y1 = Math.min(bx.max.y, pb.max.y);
      if (y1 <= y0) return;
      bands.push([y0, y1]);
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      blame.push(`${o.name || '(sem nome)'} [${mat?.name || '?'}] `
        + `v ${((y0 - pb.min.y) * 1000).toFixed(0)}–${((y1 - pb.min.y) * 1000).toFixed(0)} mm`
        + ` · x ${bx.min.x.toFixed(3)}…${bx.max.x.toFixed(3)}`
        + ` · z ${bx.min.z.toFixed(2)}…${bx.max.z.toFixed(2)}`
        + ` · tris ${((o.geometry.getAttribute('position')?.count ?? 0) / 3).toFixed(0)}`);
    });
    bands.sort((a, b) => a[0] - b[0]);
    let cursor = pb.min.y, bestLo = pb.min.y, bestHi = pb.max.y, best = -1;
    const consider = (a: number, b: number) => {
      if (b - a > best) { best = b - a; bestLo = a; bestHi = b; }
    };
    for (const [a2, b2] of bands) {
      if (a2 > cursor) consider(cursor, a2);
      if (b2 > cursor) cursor = b2;
    }
    consider(cursor, pb.max.y);
    return {
      painel_x: [+pb.min.x.toFixed(4), +pb.max.x.toFixed(4)],
      painel_y: [+pb.min.y.toFixed(4), +pb.max.y.toFixed(4)],
      painel_z: [+lo.toFixed(3), +hi.toFixed(3)],
      faixa: best < MIN_BAND ? 'medida implausível → cai no contorno de reserva'
        : [+((bestLo - pb.min.y) / spanY).toFixed(3), +((bestHi - pb.min.y) / spanY).toFixed(3)],
      pintavel_pct: +((best / spanY) * 100).toFixed(1),
      culpados: blame,
    };
  })();

  window.__diag = {
    veu,
    perfil: {
      frisos: prof.ribCount, passo_mm: +(prof.pitch * 1000).toFixed(2),
      piso: +prof.floorY.toFixed(4), teto: +prof.roofY.toFixed(4),
      batente: +prof.sillY.toFixed(4),
      batente_acima_do_piso_mm: +((prof.sillY - prof.floorY) * 1000).toFixed(1),
      base: {
        c: +prof.base.length.toFixed(3), a: +prof.base.height.toFixed(3),
        l: +prof.base.width.toFixed(3),
      },
    },
    faixa_baixa_lateral: Object.entries(lower)
      .sort((a, b) => b[1].yMax - a[1].yMax)
      .map(([k, e]) => `${k}: y ${e.yMin.toFixed(4)}…${e.yMax.toFixed(4)} (${e.n} v)`),
    porta: door,
    triangulos: { sem_porta: before, com_porta: after, delta: after - before },
    kit: body.kitParts,
    pecas: parts.map((m) => ({
      nome: m.name, copias: m.count, tris_por_copia: triCount(m),
      /* PARA QUE LADO A PEÇA OLHA — o número que faltava quando o kit inteiro
         saiu virado para dentro da parede.

         A caixa não serve: as peças `centro` são centradas em 0 por construção,
         então `boundingBox` é simétrica esteja a peça certa ou do avesso. O que
         distingue é a MASSA. Uma ferragem tem a chapa de fixação atrás (contra
         a porta) e o corpo à frente, então a média dos vértices em X fica do
         lado da chapa, ou seja NEGATIVA num kit orientado para fora. Positiva,
         a peça está do avesso — e é isso que a tela lê como "a porta está
         virada para dentro". Em fração da profundidade, para comparar peças de
         tamanhos diferentes. */
      massa_x: (() => {
        const p = m.geometry.getAttribute('position') as THREE.BufferAttribute;
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        const b = m.geometry.boundingBox as THREE.Box3;
        const d = b.max.x - b.min.x;
        if (!(d > 1e-6)) return null;
        let s = 0;
        for (let i = 0; i < p.count; i++) s += p.getX(i);
        return +((s / p.count - (b.min.x + b.max.x) / 2) / d).toFixed(3);
      })(),
      /* O NOME do material resolvido, porque `findMaterial()` pode não achar e
         cair no de reserva — e as duas situações rendem cinza na tela. Sem esta
         linha, "a moldura está clara demais" não distingue entre o material do
         GLB e um `MeshStandardMaterial` inventado. */
      material: (m.material as THREE.Material).name,
    })),
    batente: jambBox && {
      ...jambBox,
      /* O marco é um anel ESCALONADO: o perfil visível (4 caixas) mais o
         retorno do fundo (4 caixas), 12 triângulos cada = 96 por porta. Menos
         que isso é um anel faltando, e o retorno que falta é uma fresta
         contínua para dentro do baú.

         Esteve escrito 24, de quando a moldura era uma casca de quadriláteros
         soltos, e 73,0 mm de fundura, de quando `FRAME_DEPTH` era outro. Os
         dois davam `aprovado: false` sem apontar defeito nenhum — uma asserção
         que reprova sempre é uma asserção que ninguém lê. */
      tris_esperados: 96,
      profundidade_esperada_mm: 71.1,
      aprovado: jambBox.tris === 96
        && Math.abs(jambBox.profundidade_mm - 71.1) < 0.5
        && !/MeshStandardMaterial|^marco__/.test(jambBox.material),
    },
    apos_resize: {
      medidas: { c: +grown.length.toFixed(3), a: +grown.height.toFixed(3) },
      tris_corpo: afterResize,
      tris_pecas: partsAfter,
      batente_z: doorBoxAfter
        ? [+doorBoxAfter.lo.toFixed(3), +doorBoxAfter.hi.toFixed(3)]
        : null,
      /* A porta foi cadastrada a 4,00 m da testeira; a testeira é `z1` e não
         anda. Logo o batente tem de fechar em z1−5,10 … z1−4,00 em QUALQUER
         comprimento. É esta linha que prova a âncora dianteira. */
      esperado_z: [+(z1 - (door.position + door.width)).toFixed(3), +(z1 - door.position).toFixed(3)],
    },
  };

  /* Reaplica a porta para as fotos (o `set()` acima já a manteve; isto é só
     para fotografar o estado de fábrica com porta). */
  const focus = new THREE.Vector3(
    prof.width / 2, prof.sillY + door.height / 2,
    z1 - door.position - door.width / 2,
  );

  /**
   * O baú PINTADO.
   *
   * Não é enfeite de bancada: no estúdio o corpo branco recebe tinta e livery, e
   * a folha da porta vai junto (ela É a chapa). Moldura e ferragem NÃO — são
   * outras malhas, outros materiais. Julgar a porta só em branco sobre branco é
   * julgar o caso em que ela é menos legível de propósito, e foi assim que a
   * primeira leva de fotos escondeu o quanto a moldura sumia.
   */
  const bodyMat = body.mesh.material as THREE.MeshStandardMaterial;
  const paintOn = () => {
    bodyMat.color.setHex(0xa4131b);
    bodyMat.metalness = 0.35;
    bodyMat.roughness = 0.34;
    bodyMat.needsUpdate = true;
  };
  const paintOff = () => {
    bodyMat.color.setHex(0xffffff);
    bodyMat.metalness = 0.05;
    bodyMat.needsUpdate = true;
  };

  /**
   * Cada família de peça numa cor chapada.
   *
   * É uma sonda, não um render: com `metalness = 1` num ambiente de sala branca,
   * galvanizado e tinta branca devolvem quase a mesma luminância, e "a moldura
   * sumiu" fica indistinguível de "a moldura não existe". Chapando a cor, a
   * pergunta vira geométrica e tem resposta em um disparo.
   */
  const flat = (on: boolean) => {
    for (const m of partsOf()) {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.userData.c ??= mat.color.getHex();
      mat.userData.m ??= mat.metalness;
      /* Marco em magenta, vedação em amarelo, ferragem em azul. Os nomes
         `PORTA_MONTANTE`/`PORTA_TRAVESSA`/`PORTA_VEDACAO` que estavam aqui
         morreram com a moldura saliente, e a sonda vinha pintando o baú inteiro
         de azul sem que ninguém notasse. */
      const hex = m.name.startsWith('PORTA_MARCO') ? 0xff00c8
        : m.name.startsWith('PORTA_BORRACHA') ? 0xffd400 : 0x00b0ff;
      mat.color.setHex(on ? hex : (mat.userData.c as number));
      mat.metalness = on ? 0 : (mat.userData.m as number);
      mat.needsUpdate = true;
    }
  };

  /**
   * Esconde uma família e fotografa sem ela.
   *
   * É o teste que distingue "esta peça está com o acabamento errado" de "esta
   * peça nem é a que eu estou olhando". A moldura clara em volta da porta foi
   * dada como sendo o marco por três renders seguidos, com o marco já pintado
   * de escuro e o diagnóstico confirmando a cor — quem some quando se esconde a
   * malha é a resposta, e ela cabe num disparo.
   */
  const oculto = (re: RegExp | null) => {
    for (const m of partsOf()) m.visible = re ? !re.test(m.name) : true;
  };

  window.__shot = (dir, target, dist, paint, diag, hide) => {
    if (paint) paintOn(); else paintOff();
    oculto(hide ? new RegExp(hide) : null);
    flat(!!diag);
    const t = target.length === 3 ? new THREE.Vector3(target[0], target[1], target[2]) : focus;
    const d = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
    camera.position.copy(t).addScaledVector(d, dist);
    camera.lookAt(t);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  };

  /**
   * QUEM ESTÁ NAQUELE PIXEL — a pergunta que três renders não responderam.
   *
   * Uma varredura de raios pela linha média da porta, da parede à folha, com o
   * NOME e a COR do primeiro objeto atingido. É o único diagnóstico que não
   * depende de eu reconhecer a peça pela aparência dela, que é justamente o que
   * estava falhando: a moldura clara foi atribuída ao marco, ao vão e à chapa,
   * e o marco continuava com a cor escura no relatório.
   */
  window.__ray = () => {
    const ray = new THREE.Raycaster();
    const cam = new THREE.PerspectiveCamera(35, W / H, 0.05, 200);
    cam.position.set(focus.x + 4.2, focus.y, focus.z);
    cam.lookAt(focus);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    const out: string[] = [];
    let last = '';
    for (let i = 0; i <= 120; i++) {
      const ndc = new THREE.Vector2(-1 + (2 * i) / 120, 0);
      ray.setFromCamera(ndc, cam);
      const hit = ray.intersectObjects([root], true)
        .filter((h) => (h.object as THREE.Mesh).visible)[0];
      const mat = hit && ((Array.isArray((hit.object as THREE.Mesh).material)
        ? ((hit.object as THREE.Mesh).material as THREE.Material[])[0]
        : (hit.object as THREE.Mesh).material) as THREE.MeshStandardMaterial);
      const tag = hit
        ? `${hit.object.name || '(sem nome)'} [${mat?.name}] `
          + `cor=#${mat?.color ? mat.color.getHexString() : '?'} `
          + `metal=${mat?.metalness?.toFixed?.(2)} z=${hit.point.z.toFixed(4)}`
        : '(vazio)';
      const key = tag.replace(/ z=.*/, '');
      if (key !== last) { out.push(`ndc ${ndc.x.toFixed(3)}  ${tag}`); last = key; }
    }
    return out;
  };

  window.__ready = true;
}

main().catch((e) => {
  window.__error = (e && (e.stack || e.message)) || String(e);
  /**
   * QUEM ESTÁ NAQUELE PIXEL — a pergunta que três renders não responderam.
   *
   * Uma varredura de raios pela linha média da porta, da parede à folha, com o
   * NOME e a COR do primeiro objeto atingido. É o único diagnóstico que não
   * depende de eu reconhecer a peça pela aparência dela, que é justamente o que
   * estava falhando: a moldura clara foi atribuída ao marco, ao vão e à chapa,
   * e o marco continuava com a cor escura no relatório.
   */
  window.__ray = () => {
    const ray = new THREE.Raycaster();
    const cam = new THREE.PerspectiveCamera(35, W / H, 0.05, 200);
    cam.position.set(focus.x + 4.2, focus.y, focus.z);
    cam.lookAt(focus);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    const out: string[] = [];
    let last = '';
    for (let i = 0; i <= 120; i++) {
      const ndc = new THREE.Vector2(-1 + (2 * i) / 120, 0);
      ray.setFromCamera(ndc, cam);
      const hit = ray.intersectObjects([root], true)
        .filter((h) => (h.object as THREE.Mesh).visible)[0];
      const mat = hit && ((Array.isArray((hit.object as THREE.Mesh).material)
        ? ((hit.object as THREE.Mesh).material as THREE.Material[])[0]
        : (hit.object as THREE.Mesh).material) as THREE.MeshStandardMaterial);
      const tag = hit
        ? `${hit.object.name || '(sem nome)'} [${mat?.name}] `
          + `cor=#${mat?.color ? mat.color.getHexString() : '?'} `
          + `metal=${mat?.metalness?.toFixed?.(2)} z=${hit.point.z.toFixed(4)}`
        : '(vazio)';
      const key = tag.replace(/ z=.*/, '');
      if (key !== last) { out.push(`ndc ${ndc.x.toFixed(3)}  ${tag}`); last = key; }
    }
    return out;
  };

  window.__ready = true;
});
