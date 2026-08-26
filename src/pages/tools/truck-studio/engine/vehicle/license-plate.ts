/* A PLACA DE LICENCIAMENTO — uma no cavalo, uma no implemento.
   ===========================================================================
   O PEDIDO (2026-08-16): *"crie uma placa 3D com essa imagem, e adicione em
   todos os modelos 3D do meu truck studio, todos os cavalos e o implemento,
   garanta que ira cobrir todos os modelos, achar todos os locais que sao
   necessarios para estarem corretamente posicionados"*.

   ⚠️ "PLACA" JÁ SIGNIFICA OUTRAS DUAS COISAS NESTA BASE, e confundi-las custa
   caro. A **chapa** da carroceria do implemento (`PLATE_PITCH`, `plateSeams()`,
   `PlateGrid` em `vehicle/models.ts`) e o **prato** da quinta roda
   (`fifthWheel.plateTopY` em `hitch.json`). Este arquivo não tem nada a ver com
   nenhuma das duas: aqui é a placa do DETRAN, padrão Mercosul, 400 x 130 mm.

   ---------------------------------------------------------------------------
   ONDE CADA METADE MORA, E POR QUE ELAS SÃO DIFERENTES

   | metade      | onde a posição sai            | por quê                    |
   |---|---|---|
   | 49 cavalos  | `models/vehicles/plates.json` | o .glb não muda em runtime |
   | implemento  | MEDIDA aqui, a cada rebuild   | ele é PARAMÉTRICO          |

   É a mesma divisão que `hitch.json` já faz — o lado do cavalo congelado com o
   sha256 dos bytes, `implements: {}` porque o baú anda a cada medida digitada.
   Uma posição de traseira congelada estaria errada no primeiro redimensionamento
   e errada EM SILÊNCIO, que é o modo de falhar que esta base mais evita.

   O manifesto é produzido por `tools/placa/probe.mjs`, que rasteriza a casca
   dianteira de cada bake num z-buffer de 5 mm e ajusta um plano à pegada da
   placa. O cabeçalho de lá explica as cinco decisões da medida; o que interessa
   deste lado é o formato: `pos` e `normal` em ESPAÇO CRU DO ARQUIVO, mais um
   `vao`.

   ---------------------------------------------------------------------------
   O `vao`, E POR QUE A PLACA TEM UM BERÇO

   Nenhum para-choque de caminhão é um plano de 400 x 130 mm. Medido nos 49:
   a mediana do afastamento entre a chapa e a superfície NO CONTORNO da placa é
   10 mm, mas sete modelos passam de 29 mm — o DAF XF 105 não tem 130 mm planos
   em ponto nenhum da dianteira (a face externa do para-choque tem 70 mm e logo
   acima começa a grade).

   Encostar a placa no ponto mais saliente e deixar o resto no ar dá uma placa
   FLUTUANDO. Então ela ganha o que um caminhão de verdade tem: um **berço** —
   uma bandeja rasa, escura, atrás dela, com a profundidade que aquele modelo
   pediu. Onde o vão é de 3 mm o berço é um aro; onde é de 45 mm ele é o suporte
   que aquele para-choque exigiria de fato. A placa nunca interpenetra e nunca
   paira: as duas propriedades saem da mesma medida.

   ---------------------------------------------------------------------------
   ELA REFLETE, E ISSO NÃO É EFEITO — É O QUE A PLACA É

   Placa Mercosul brasileira é película retrorrefletiva com caracteres
   estampados por cima. `vehicle/retroreflect.ts` já implementa exatamente esse
   lóbulo, e a última linha do shader de lá é

       reflectedLight.directSpecular += tsRetro * diffuseColor.rgb;

   ou seja o retorno é multiplicado pelo ALBEDO do fragmento. Numa placa isso é
   fisicamente certo de graça: o fundo branco devolve, os caracteres pretos não.
   Por isso o material se chama `placa-retrorrefletiva` — o nome CASA
   `FITA_RE` de lá, e é assim que a injeção acontece sem uma linha nova de GLSL.

   ⚠️ O NOME DO MATERIAL É FUNCIONAL. Renomeá-lo para algo que não case
   `/retro.?reflet/i` apaga a retrorreflexão sem erro nenhum, e o sintoma é uma
   placa que some à noite.

   ---------------------------------------------------------------------------
   ⚠️ POR QUE UM GRUPO PRÓPRIO, FORA DA FUSÃO

   Mesmo motivo da patola (ver `vehicle/landing-gear.ts`): `vehicle/merge.ts`
   funde por material e ASSA os vértices na pose do instante da fusão. A placa do
   implemento anda a cada redimensionamento — fundida, ela ficaria congelada no
   comprimento antigo, dentro de um balde que atravessa o conjunto. O grupo
   `PLACA` dá à exclusão um nome estável.

   Custo: **duas chamadas de desenho por placa** — a arte e o casco escuro são
   dois materiais na mesma geometria. Quatro no conjunto engatado, de 552.

   ⚠️ E ELA NÃO É LATARIA. O material não casa `PAINT_NAME_RE` nem a assinatura
   de `looksLikeTruckPaint()`, então `setPaint()` não a alcança — uma placa que
   mudasse de cor com o caminhão seria o defeito óbvio deste arquivo. */
import * as THREE from 'three';
import { assetUrl } from '../catalog/catalog';
import { VEHICLES_DIR } from '../core/paths';
import { registerRetroreflective } from './retroreflect';

/** O nome do grupo que carrega a placa. Estável: é ele que a exclusão da fusão
 *  casa, e é por ele que a bancada acha a peça. */
export const LICENSE_PLATE_GROUP = 'PLACA';

/**
 * O que a fusão por material NÃO pode encostar, escrito por quem é dono da
 * peça. `studio.ts` junta esta lista com as de `trim.ts`, `models.ts` e
 * `landing-gear.ts`. Ver `MergePolicy` em `vehicle/merge.ts`.
 *
 * ⚠️ HOJE ELA É REDE, NÃO A TRAVA QUE DISPARA — e o registro evita uma
 * "simplificação" futura. `merge.ts` testa as exclusões ESTRUTURAIS antes das
 * de dono, e a primeira é `Array.isArray(o.material)`: a placa tem DOIS
 * materiais (a arte e o casco), então ela já sai do balde por aí. No dia em que
 * alguém unificar os dois — um atlas, um shader só —, essa proteção evapora sem
 * erro nenhum, e é esta regra que passa a segurar a peça. Medido na bancada: a
 * tabela `mergeInfo().excluidas` não contabiliza nada em nome desta lista, e a
 * placa continua fora da fusão.
 */
export const LICENSE_PLATE_MERGE_EXCLUSIONS: {
  nodes: { re: RegExp; label: string }[];
} = {
  nodes: [{ re: new RegExp(`^${LICENSE_PLATE_GROUP}(_TRASEIRA)?$`), label: 'placa: acompanha a traseira' }],
};

/* ---------------------------------------------------------------------------
   AS MEDIDAS, EM METROS

   Resolução CONTRAN 780/2019: 400 x 130 mm para automóvel, caminhão e reboque.
   Os cantos têm raio de 12 mm, que é o que a própria arte traz — ajuste de
   círculo em oito linhas do PNG dá 57 px em 599 de altura, ou seja 12,4 mm. */
const LARGURA = 0.400;
const ALTURA = 0.130;
const RAIO = 0.012;
/** Espessura da chapa. Uma placa de alumínio tem ~1 mm; 2 mm é o que dá borda
 *  visível no raso e continua desprezível na silhueta. */
const ESPESSURA = 0.002;
/** Quanto o berço sobra da placa para cada lado — o aro que se vê de frente. */
const BERCO_SOBRA = 0.008;
/** Nunca menos que isto de berço, mesmo num para-choque perfeitamente plano:
 *  sem ele a chapa lê como adesivo. */
const BERCO_MIN = 0.004;
/** E nunca mais que isto: acima daqui o suporte vira caixa. Casa `VAO_MAX` da
 *  sonda — os dois números descrevem o mesmo limite e têm de andar juntos. */
const BERCO_MAX = 0.045;
/** Segmentos por canto do contorno arredondado. 6 dá 28 pontos no perímetro. */
const SEG_CANTO = 6;

/* Acabamento. Placa é película sobre alumínio: nada de metalness, e uma
   rugosidade média-baixa que ainda pega o reflexo do céu de raspão. */
const PLACA_ROUGHNESS = 0.34;
const PLACA_ENV = 0.9;
/** O berço é suporte pintado de preto fosco, e é ele que dá a sombra do vão. */
const BERCO_COR = 0x14161a;
const BERCO_ROUGHNESS = 0.72;

const ARTE = VEHICLES_DIR + 'placa_mercosul_ankaa.webp';
const ARTE_NOR = VEHICLES_DIR + 'placa_mercosul_ankaa_nor.webp';
const MANIFESTO = VEHICLES_DIR + 'plates.json';

/* ------------------------------------------------------------------ manifesto */

export interface PlateSite {
  /** Centro da placa, no espaço CRU do .glb. */
  pos: [number, number, number];
  /** Para onde ela olha, no mesmo espaço. */
  normal: [number, number, number];
  /** Profundidade do berço, em metros — ver o cabeçalho. */
  vao?: number;
  alturaSolo?: number;
  fonte?: string;
  motivo?: string;
}

interface PlateManifest {
  schema?: string;
  tractors: Record<string, PlateSite>;
}

let manifesto: PlateManifest | null = null;
let manifestoReq: Promise<PlateManifest | null> | null = null;

/** Normaliza a chave do manifesto do mesmo jeito que `coupling.ts` normaliza a
 *  do engate: barras e `./` iniciais não podem decidir se a placa existe. */
const chave = (file: string) => String(file || '').replace(/^\.?\/+/, '').replace(/\\/g, '/');

/**
 * Baixa `plates.json` uma vez. Ausência NÃO é erro fatal: sem manifesto o
 * cavalo simplesmente fica sem placa, e o console diz por quê — o mesmo
 * contrato de `hitch.json`.
 */
export function loadPlateManifest(): Promise<PlateManifest | null> {
  if (manifestoReq) return manifestoReq;
  manifestoReq = fetch(assetUrl(MANIFESTO), { cache: 'no-cache' })
    .then((r) => {
      if (!r.ok) throw new Error(r.status + '');
      return r.json();
    })
    .then((j: PlateManifest) => {
      manifesto = j;
      console.info('[placa] plates.json —', Object.keys(j.tractors || {}).length, 'cavalos.');
      return j;
    })
    .catch((e: unknown) => {
      console.warn('[placa] plates.json indisponível — os cavalos ficam sem placa dianteira.',
        e instanceof Error ? e.message : String(e));
      manifesto = null;
      return null;
    });
  return manifestoReq;
}

/** O sítio declarado para um arquivo de cavalo, ou `null`. */
export function plateSiteFor(file: string): PlateSite | null {
  const t = manifesto?.tractors;
  if (!t) return null;
  const k = chave(file);
  return t[k] || t['models/trucks/' + k.split('/').pop()] || null;
}

/* ------------------------------------------------------------------ geometria */

/**
 * O contorno de um retângulo de cantos arredondados, no sentido anti-horário.
 *
 * Anti-horário visto de +z é o que faz o leque da face frontal sair com a
 * normal em +z sem precisar de `side: DoubleSide` em lugar nenhum — e
 * `DoubleSide` numa peça que recebe sombra é justamente o que o cabeçalho de
 * `tools/iveco-bake/bake.mjs` documenta como estragando AO e sombra.
 */
function contorno(w: number, h: number, r: number): [number, number][] {
  const R = Math.min(r, w / 2, h / 2);
  const x = w / 2 - R, y = h / 2 - R;
  const pts: [number, number][] = [];
  const cantos: [number, number, number][] = [
    [x, y, 0], [-x, y, Math.PI / 2], [-x, -y, Math.PI], [x, -y, -Math.PI / 2],
  ];
  for (const [cx, cy, a0] of cantos) {
    for (let s = 0; s <= SEG_CANTO; s++) {
      const a = a0 + (s / SEG_CANTO) * (Math.PI / 2);
      pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
  }
  return pts;
}

/**
 * A placa inteira numa geometria só, com DOIS grupos:
 *
 *   grupo 0 → a face da frente, com UV de 0..1 na arte;
 *   grupo 1 → todo o resto (canto da chapa, aro do berço, parede e fundo).
 *
 * O eixo local é: face visível em z = 0 olhando para +z, chapa ocupando
 * z ∈ [−ESPESSURA, 0], berço descendo até z = −ESPESSURA − `berco`.
 *
 * Duas chamadas de desenho, e é o mínimo possível: a arte e o casco escuro são
 * materiais diferentes por definição.
 */
function construirGeometria(berco: number): THREE.BufferGeometry {
  const face = contorno(LARGURA, ALTURA, RAIO);
  const aro = contorno(LARGURA + 2 * BERCO_SOBRA, ALTURA + 2 * BERCO_SOBRA, RAIO + BERCO_SOBRA);
  const n = face.length;

  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const arte: number[] = [];
  const casco: number[] = [];

  const push = (p: [number, number, number], nv: [number, number, number], u: [number, number]) => {
    pos.push(p[0], p[1], p[2]);
    nor.push(nv[0], nv[1], nv[2]);
    uv.push(u[0], u[1]);
    return pos.length / 3 - 1;
  };
  const uvDa = (x: number, y: number): [number, number] =>
    [x / LARGURA + 0.5, y / ALTURA + 0.5];

  /* 1. A FACE. Leque a partir do centro — a peça é convexa, então um leque é
        uma triangulação válida e o UV sai linear em toda ela. */
  const centro = push([0, 0, 0], [0, 0, 1], [0.5, 0.5]);
  const anel0: number[] = face.map(([x, y]) => push([x, y, 0], [0, 0, 1], uvDa(x, y)));
  for (let i = 0; i < n; i++) arte.push(centro, anel0[i], anel0[(i + 1) % n]);

  /* Daqui para baixo é tudo casco. O UV não importa (o material do casco não tem
     mapa), mas o atributo precisa existir para os dois grupos compartilharem
     buffers — e (0,0) é mais honesto do que lixo. */
  const zChapa = -ESPESSURA;
  const zFundo = -ESPESSURA - berco;

  /* 2. O CANTO DA CHAPA — parede de z=0 a z=−ESPESSURA. */
  const anelA: number[] = [], anelB: number[] = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = face[i];
    const L = Math.hypot(x, y) || 1;
    const nv: [number, number, number] = [x / L, y / L, 0];
    anelA.push(push([x, y, 0], nv, [0, 0]));
    anelB.push(push([x, y, zChapa], nv, [0, 0]));
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    casco.push(anelA[i], anelB[i], anelB[j], anelA[i], anelB[j], anelA[j]);
  }

  /* 3. O ARO DO BERÇO — o anel plano em z=−ESPESSURA entre a chapa e o berço.
        É a moldura escura que se vê em volta da placa. */
  const aroInt: number[] = face.map(([x, y]) => push([x, y, zChapa], [0, 0, 1], [0, 0]));
  const aroExt: number[] = aro.map(([x, y]) => push([x, y, zChapa], [0, 0, 1], [0, 0]));
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    casco.push(aroInt[i], aroExt[i], aroExt[j], aroInt[i], aroExt[j], aroInt[j]);
  }

  /* 4. A PAREDE DO BERÇO e 5. O FUNDO. O fundo encosta na lataria e não se vê;
        ele existe para a peça ser um sólido fechado — malha aberta lançando
        sombra é o que produz vazamento de sombra em `PCFSoftShadowMap`. */
  const paredeA: number[] = [], paredeB: number[] = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = aro[i];
    const L = Math.hypot(x, y) || 1;
    const nv: [number, number, number] = [x / L, y / L, 0];
    paredeA.push(push([x, y, zChapa], nv, [0, 0]));
    paredeB.push(push([x, y, zFundo], nv, [0, 0]));
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    casco.push(paredeA[i], paredeB[i], paredeB[j], paredeA[i], paredeB[j], paredeA[j]);
  }
  const fundoC = push([0, 0, zFundo], [0, 0, -1], [0.5, 0.5]);
  const fundo: number[] = aro.map(([x, y]) => push([x, y, zFundo], [0, 0, -1], [0, 0]));
  for (let i = 0; i < n; i++) casco.push(fundoC, fundo[(i + 1) % n], fundo[i]);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(arte.concat(casco));
  g.addGroup(0, arte.length, 0);
  g.addGroup(arte.length, casco.length, 1);
  g.computeBoundingSphere();
  return g;
}

/* ------------------------------------------------------------------ materiais */

let matArte: THREE.MeshStandardMaterial | null = null;
let matCasco: THREE.MeshStandardMaterial | null = null;
let texArte: THREE.Texture | null = null;
let texNor: THREE.Texture | null = null;

/**
 * Os dois materiais, criados uma vez e compartilhados pelas duas placas.
 *
 * A textura é carregada de forma ASSÍNCRONA e o material não espera por ela: o
 * `TextureLoader` preenche `map.image` e marca `needsUpdate` quando chegar, e
 * até lá a placa aparece branca. Isso é deliberado — segurar a montagem da peça
 * numa segunda requisição atrasaria a cortina por 190 kB.
 */
function materiais(): [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial] {
  if (matArte && matCasco) return [matArte, matCasco];
  const loader = new THREE.TextureLoader();
  texArte = loader.load(assetUrl(ARTE));
  texArte.colorSpace = THREE.SRGBColorSpace;
  texArte.anisotropy = 8;
  texArte.flipY = true;
  texNor = loader.load(assetUrl(ARTE_NOR));
  texNor.colorSpace = THREE.NoColorSpace;   // normal map é DADO, não cor
  texNor.anisotropy = 8;
  texNor.flipY = true;

  matArte = new THREE.MeshStandardMaterial({
    /* ⚠️ FUNCIONAL: casa `FITA_RE` de retroreflect.ts. Ver o cabeçalho. */
    name: 'placa-retrorrefletiva',
    map: texArte,
    normalMap: texNor,
    /* O relevo é de 1 mm em caracteres de 65 mm — em escala 1 o mapa já traz a
       inclinação certa, então o multiplicador é 1. */
    normalScale: new THREE.Vector2(1, 1),
    color: 0xffffff,
    roughness: PLACA_ROUGHNESS,
    metalness: 0,
  });
  matArte.envMapIntensity = PLACA_ENV;
  matCasco = new THREE.MeshStandardMaterial({
    name: 'placa-berco',
    color: new THREE.Color(BERCO_COR),
    roughness: BERCO_ROUGHNESS,
    metalness: 0.1,
  });
  matCasco.envMapIntensity = 0.5;
  return [matArte, matCasco];
}

/* ------------------------------------------------------------------ montagem */

const _n = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();

/**
 * Aponta a placa para `normal` mantendo o topo dela para cima.
 *
 * ⚠️ `setFromUnitVectors(+Z, n)` NÃO serve: ele resolve a direção e deixa o
 * ROLAMENTO indefinido — a rotação mínima entre dois vetores, que para uma
 * normal levemente fora do plano vertical devolve a placa TORTA. O que se quer
 * é uma base: a normal manda em z, o "para cima" do referencial manda no resto.
 */
function orientar(o: THREE.Object3D, normal: THREE.Vector3) {
  _n.copy(normal).normalize();
  _x.crossVectors(_up, _n);
  if (_x.lengthSq() < 1e-8) _x.set(1, 0, 0);      // normal vertical: caso impossível aqui
  _x.normalize();
  _y.crossVectors(_n, _x).normalize();
  _m.makeBasis(_x, _y, _n);
  o.quaternion.setFromRotationMatrix(_m);
}

function montar(berco: number): THREE.Mesh {
  const [arte, casco] = materiais();
  const mesh = new THREE.Mesh(
    construirGeometria(THREE.MathUtils.clamp(berco, BERCO_MIN, BERCO_MAX)),
    [arte, casco],
  );
  mesh.name = 'placa-chapa';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  /* A retrorreflexão é do MATERIAL e a injeção é idempotente, então chamar por
     placa é barato e garante que a segunda placa não nasça sem ela caso a
     primeira tenha sido descartada. */
  registerRetroreflective(mesh);
  return mesh;
}

/**
 * Solta uma placa da árvore e devolve a GEOMETRIA dela.
 *
 * ⚠️ **NUNCA os materiais.** Os dois são compartilhados pelas duas placas e
 * criados uma vez, na primeira cabine da sessão; liberá-los aqui apagaria a arte
 * que a outra placa está usando. É o mesmo contrato de `tsSharedSource` em
 * `models.ts`. A geometria, essa sim, é privada de cada placa — ela carrega a
 * profundidade do berço daquele modelo.
 */
function descartar(grupo: THREE.Object3D | null) {
  if (!grupo) return;
  grupo.parent?.remove(grupo);
  grupo.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.geometry?.dispose();
  });
}

/* ------------------------------------------------------------------ cavalo */

let placaCab: THREE.Group | null = null;
let sitioCab: PlateSite | null = null;

/**
 * Tira a placa da cabine ANTES de ela ser descartada.
 *
 * ⚠️ Chamada por `loadCab()` na troca de caminhão, e o motivo está lá: a placa
 * é filha da raiz da cabine e `disposeTree()` varre a raiz inteira liberando
 * material e textura. Sem esta chamada, a primeira troca de caminhão levaria
 * junto a arte que a placa do IMPLEMENTO ainda está usando.
 */
export function detachCabPlate() {
  descartar(placaCab);
  placaCab = null;
  sitioCab = null;
}

/**
 * Pendura a placa dianteira na raiz da cabine, no sítio que o manifesto declara.
 *
 * ⚠️ FILHA DA RAIZ DA CABINE, com transformação LOCAL. É isso que faz a placa
 * atravessar de graça tudo o que move a cabine — a normalização de `hitch.json`,
 * a pose do engate, a `RIG_PLACEMENT` e a inclinação que o solver escreve. Uma
 * posição em mundo estaria errada no primeiro engate, e errada de um jeito que
 * só aparece com implemento na cena.
 *
 * @returns `true` se a placa entrou.
 */
export function attachCabPlate(cab: THREE.Object3D, file: string): boolean {
  detachCabPlate();               // idempotente; a troca de cabine já chamou
  sitioCab = plateSiteFor(file);
  if (!sitioCab) {
    console.warn('[placa] sem sítio para', file,
      '— o cavalo fica sem placa. Rode `node tools/placa/probe.mjs`.');
    return false;
  }
  const g = new THREE.Group();
  g.name = LICENSE_PLATE_GROUP;
  g.add(montar(sitioCab.vao ?? BERCO_MIN));
  g.position.fromArray(sitioCab.pos);
  orientar(g, _n.set(sitioCab.normal[0], sitioCab.normal[1], sitioCab.normal[2]));
  g.updateMatrix();
  cab.add(g);
  placaCab = g;
  return true;
}

/* -------------------------------------------------------- traseira do RÍGIDO */

/* ---------------------------------------------------------------------------
   UM RÍGIDO CARREGA AS DUAS PLACAS, E A DE TRÁS É DELE

   Num cavalo mecânico a placa traseira é do IMPLEMENTO — o semirreboque tem a
   dele, emplacada em separado, e é por isso que este arquivo nasceu com duas
   metades e não três. Um rígido não: a carroceria é aparafusada, não emplacada,
   e a placa de trás fica no CHASSI, sob a lanterna.

   *"a placa traseira precisa ser substituída pela nossa"* — Kennedy,
   2026-08-22, com a foto da traseira do Scania P mostrando a placa BRASILEIRA
   DO RIP (`MAC 4U25`) montada no porta-placa do para-barro. Medido no app na
   mesma data: `licensePlateInfo()` devolvia `cavalo: null` e `implemento: null`
   — ou seja, o estúdio não tinha placa nenhuma em cena e o que se via era o
   desenho que veio no `.glb`.

   ⚠️ O SÍTIO NÃO VAI PARA `plates.json`, e a razão é a mesma que mantém o
   implemento fora de lá: aquele manifesto é medido por `tools/placa/probe.mjs`,
   que rasteriza a DIANTEIRA (o eixo direcional define a frente e a janela de
   busca sai dela). A traseira de um rígido não é um para-choque plano — é
   travessa, para-barro, lanterna e engate de reboque, e a peça em que a placa
   assenta é justamente a que o rip já desenhou. Então a régua é essa:

     **a placa nova vai EXATAMENTE onde a placa de fábrica está, e a de fábrica
     some no mesmo ato.**

   É medida (a caixa sai da malha), é auto-adaptativa (vale para qualquer rip
   que traga a peça) e é honesta: se o arquivo não tem placa de trás, não há
   sítio a inventar e o console diz isso.

   ⚠️ E O FALLBACK É A LUZ DE PLACA. O Volvo VM não traz placa desenhada, mas
   traz `luz_placa` — e uma luz de placa só existe onde há placa: por norma ela
   ilumina a placa de cima para baixo, a menos de 100 mm dela. Quando não há
   placa de fábrica, o sítio é o RETÂNGULO LOGO ABAIXO da luz. */

/** O que é placa de fábrica (a arte e a base coplanar dela). */
const PLACA_FABRICA_RE = /brasilmercosul|baseplaca|mercosul|^placa_mat|_placa_mat/i;
/** A LUZ de placa — o fallback, e o que NÃO pode ser confundido com a placa. */
const LUZ_PLACA_RE = /luz_placa|licence_light|license_light/i;
/** Quanto abaixo da luz o centro da placa fica, quando o sítio sai da luz. */
const ABAIXO_DA_LUZ = 0.105;

let placaTraseiraCab: THREE.Group | null = null;

/** Tira a placa traseira do rígido antes de a cabine ser descartada. */
export function detachRigidRearPlate() {
  descartar(placaTraseiraCab);
  placaTraseiraCab = null;
}

/**
 * Monta a placa traseira de um CHASSI RÍGIDO e esconde a de fábrica.
 *
 * ⚠️ O SINAL DA FRENTE SAI DO SÍTIO DIANTEIRO, e não de `mounts.json`. A placa
 * da frente olha para a frente por definição, e `plates.json` já traz a normal
 * dela medida no espaço CRU do arquivo — nos três rígidos ela dá `z ≈ −1`,
 * porque os rips apontam para −Z e é por isso que `orientYaw` é π. Ler daqui
 * evita uma segunda verdade sobre a orientação, que é como este arquivo já
 * errou uma vez (ver o ⚠️ do lado do veículo em `acharPortaPlaca`).
 *
 * @param cab   a raiz do caminhão (espaço CRU do arquivo, como `attachCabPlate`)
 * @param file  o `.glb`, para achar a normal dianteira no manifesto
 * @returns `true` se a placa entrou.
 */
export function attachRigidRearPlate(cab: THREE.Object3D, file: string): boolean {
  detachRigidRearPlate();
  const frente = plateSiteFor(file);
  if (!frente) {
    console.warn('[placa] sem sítio dianteiro para', file,
      '— sem a normal dele não dá para saber onde é a traseira; o rígido fica sem placa atrás.');
    return false;
  }
  const frenteZ = frente.normal[2] >= 0 ? 1 : -1;
  cab.updateWorldMatrix(true, true);
  const paraCab = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const mm = new THREE.Matrix4();
  const bx = new THREE.Box3();

  /* A caixa de TUDO, para saber onde é "atrás". */
  const todo = new THREE.Box3();
  const fabrica: THREE.Mesh[] = [];
  const luzes: THREE.Mesh[] = [];
  cab.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const gb = o.geometry.boundingBox;
    if (!gb) return;
    bx.copy(gb).applyMatrix4(mm.multiplyMatrices(paraCab, o.matrixWorld));
    todo.union(bx);
    const mats = (Array.isArray(o.material) ? o.material : [o.material])
      .map((m) => m?.name || '').join('+');
    const rotulo = `${o.name || ''}[${mats}]`;
    /* Só a PENEIRA DE NOME aqui. Quem separa dianteira de traseira é a metade
       do caminhão, e ela só existe depois de a travessia acabar — ver o ⚠️
       logo abaixo. Isto importa: a placa dianteira do Scania usa os MESMOS dois
       materiais da traseira (`brasilmercosul`/`baseplaca`), então o material
       sozinho não separa as duas. */
    if (LUZ_PLACA_RE.test(rotulo)) { luzes.push(o); return; }
    if (PLACA_FABRICA_RE.test(rotulo)) fabrica.push(o);
  });

  /* ⚠️ SEGUNDA PASSADA. `todo` só está completa no fim da travessia, e o teste
     de "metade de trás" depende dela — decidir na primeira passada dependeria
     da ordem dos nós, que é o defeito que `medeChassi()` já documenta. */
  const meio = (todo.min.z + todo.max.z) / 2;
  const naMetadeDeTras = (o: THREE.Mesh): boolean => {
    const gb = o.geometry.boundingBox;
    if (!gb) return false;
    bx.copy(gb).applyMatrix4(mm.multiplyMatrices(paraCab, o.matrixWorld));
    return frenteZ > 0 ? bx.max.z < meio : bx.min.z > meio;
  };
  const placas = fabrica.filter(naMetadeDeTras);
  const luz = luzes.filter(naMetadeDeTras);

  const sitio = new THREE.Box3();
  let origem: string;
  if (placas.length) {
    for (const o of placas) {
      const gb = o.geometry.boundingBox;
      if (gb) sitio.union(bx.copy(gb).applyMatrix4(mm.multiplyMatrices(paraCab, o.matrixWorld)));
    }
    origem = `placa de fábrica (${placas.length} malha(s))`;
  } else if (luz.length) {
    for (const o of luz) {
      const gb = o.geometry.boundingBox;
      if (gb) sitio.union(bx.copy(gb).applyMatrix4(mm.multiplyMatrices(paraCab, o.matrixWorld)));
    }
    const c = sitio.getCenter(new THREE.Vector3());
    sitio.setFromCenterAndSize(
      new THREE.Vector3(c.x, c.y - ABAIXO_DA_LUZ, c.z),
      new THREE.Vector3(LARGURA, ALTURA, 0.004));
    origem = `${ABAIXO_DA_LUZ * 1000} mm abaixo da luz de placa (${luz.length} malha(s))`;
  } else {
    console.warn('[placa] o rígido não traz placa de fábrica nem luz de placa na traseira'
      + ' — sem sítio medido, ele fica sem placa atrás.');
    return false;
  }

  const c = sitio.getCenter(new THREE.Vector3());
  const g = new THREE.Group();
  g.name = LICENSE_PLATE_GROUP + '_TRASEIRA';
  /* Berço mínimo: a placa de fábrica JÁ está encostada na chapa em que a nossa
     vai — não há vão a preencher, e um berço fundo abriria uma caixa atrás dela
     onde a peça real tem 2 mm de alumínio. */
  g.add(montar(BERCO_MIN));
  g.position.copy(c);
  /* A normal aponta para TRÁS, que é o oposto da frente. */
  orientar(g, _n.set(0, 0, frenteZ > 0 ? -1 : 1));
  /* E ela sai 1 mm à frente da chapa que substitui, para não disputar o
     z-buffer com o que sobrar da peça de fábrica. */
  g.position.z += (frenteZ > 0 ? -1 : 1) * ((sitio.max.z - sitio.min.z) / 2 + 0.001);
  g.updateMatrix();
  cab.add(g);
  placaTraseiraCab = g;

  /* ⚠️ SÓ AGORA A DE FÁBRICA SOME, e a ordem é a garantia: uma placa escondida
     antes de a nossa ser montada deixaria o caminhão sem placa nenhuma se
     qualquer coisa acima falhasse. */
  for (const o of placas) o.visible = false;

  console.info('[placa] traseira do rígido —', origem, '· centro',
    c.toArray().map((v) => v.toFixed(3)).join(', '),
    '·', placas.length, 'malha(s) de fábrica escondida(s)');
  return true;
}

/* ------------------------------------------------------------------ implemento */

/* ---------------------------------------------------------------------------
   O IMPLEMENTO LEVA A PLACA NO PORTA-PLACA, NÃO NO PARA-CHOQUE

   ⚠️ A primeira versão pôs a placa no para-choque, centrada. Está errado, e o
   Kennedy corrigiu com uma captura: *"no implemento a placa vai essa placa a
   direita da imagem, em baixo da lanterna traseira, nao no parachoque"*.

   E o bake dá razão a ele — o porta-placa EXISTE, medido no `trailer.glb`:

       painel   x −1,167…−0,705   y 0,913…1,098   z −7,273…−7,213
       lanterna x −1,206…−0,648   y 1,089…1,254   z −7,328…−7,266

   ou seja um painel raso de **462 x 185 mm**, encostado por baixo na lanterna e
   alinhado com ela em x. Uma placa de 400 x 130 mm cabe ali com 23 mm de folga
   de cada lado e 27 mm em cima e embaixo. É um porta-placa, e é a única peça da
   traseira cujas medidas só fazem sentido como porta-placa.

   ⚠️ ELE É ACHADO POR GEOMETRIA, NÃO POR NOME. O nó se chama
   `stitch_result_stitch_all_plastico-preto_0_7`, e o `_7` é o índice de um
   export que o próximo re-bake renumera em silêncio — a mesma armadilha que o
   cabeçalho de `landing-gear.ts` documenta. A regra é a definição da peça:

     **é o painel raso que fica ABAIXO da lanterna traseira, alinhado com ela em
     x, e grande o bastante para uma placa.**

   ⚠️ E O LADO É O DA DIREITA DO VEÍCULO — que é o lado direito de QUEM OLHA a
   traseira, porque olhar a traseira é encarar a mesma direção para a qual o
   veículo aponta. Com a frente em +z e o topo em +y, a direita é
   `frente × topo = −x`. É o painel da captura.

   O bake nomeia lados de forma INCONSISTENTE (`PARABARRO-E` está em x < 0 e
   `registro-MangueidaTraseira-E` em x > 0), então nome de nó não decide isto —
   só a conta acima decide. */
const LANTERNA_TRASEIRA_RE = /lanterna-traseira/i;
/** O lado do veículo em que a placa vai: −1 = direita. Ver o ⚠️ acima. */
const LADO_DA_PLACA = -1;
/** Quanto o porta-placa pode estar abaixo da lanterna e ainda ser o dela. */
const ABAIXO_DA_LANTERNA = 0.20;
/** Quanto o painel pode divergir da lanterna em z e ainda ser da traseira. */
const MESMA_TRASEIRA = 0.25;
/** Um painel mais fundo que isto é caixa, não porta-placa. */
const PAINEL_RASO = 0.10;
/** Folga mínima de cada lado para a placa caber no painel. */
const FOLGA_NO_PAINEL = 0.005;

let placaTrailer: THREE.Group | null = null;
let portaPlaca: THREE.Mesh[] = [];
/** A raiz do implemento, guardada para o diagnóstico poder remedir sozinho. */
let raizTrailer: THREE.Object3D | null = null;

/** Um nó casa se ELE ou algum ancestral abaixo da raiz casar. */
function souOuAncestral(o: THREE.Object3D, re: RegExp, raiz: THREE.Object3D): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    if (re.test(n.name || '')) return true;
    if (n === raiz) break;
  }
  return false;
}

/**
 * A caixa de um conjunto de malhas NO REFERENCIAL DO IMPLEMENTO, por vértice.
 *
 * ⚠️ POR VÉRTICE, e não `Box3.setFromObject`. A caixa de um nó girado é a caixa
 * de uma caixa girada — estritamente maior que a real, e sem limite de quanto.
 * É o erro que já fez o implemento pairar 230 mm (ver o bloco O QUE FOI APAGADO
 * AQUI em `models.ts`), e aqui ele entraria direto na posição da placa.
 *
 * ⚠️ E NO REFERENCIAL DO IMPLEMENTO, não em mundo: o conjunto engatado carrega a
 * inclinação que o solver deriva da altura da quinta roda, ou seja um giro que
 * MUDA COM O CHASSI DO CAVALO. Medido em mundo, a placa do baú andaria ao trocar
 * de caminhão. É o mesmo contrato de `bboxInFrame()`/`placeThermoKing()`.
 */
function caixaLocal(
  trailer: THREE.Object3D, malhas: Iterable<THREE.Mesh>, alvo?: THREE.Box3,
): THREE.Box3 | null {
  trailer.updateWorldMatrix(true, true);
  return caixaCom(refDoImplemento(trailer), malhas, alvo);
}

/** A matriz que leva do MUNDO ao referencial do implemento. */
function refDoImplemento(trailer: THREE.Object3D): THREE.Matrix4 {
  return _inv.copy(trailer.matrixWorld).invert();
}
const _inv = new THREE.Matrix4();
const _v = new THREE.Vector3();

/** `caixaLocal()` com a inversa já na mão — ver `acharPortaPlaca()`. */
function caixaCom(
  inv: THREE.Matrix4, malhas: Iterable<THREE.Mesh>, alvo?: THREE.Box3,
): THREE.Box3 | null {
  const box = (alvo ?? new THREE.Box3()).makeEmpty();
  for (const o of malhas) {
    const pos = o.geometry?.attributes?.position as THREE.BufferAttribute | undefined;
    if (!pos) continue;
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      box.expandByPoint(_v);
    }
  }
  return box.isEmpty() ? null : box;
}

/**
 * A caixa GROSSEIRA de uma malha no referencial do implemento — a rejeição
 * barata que evita varrer 5,4 milhões de vértices.
 *
 * ⚠️ Ela é estritamente MAIOR que a real (é a caixa da caixa girada), e é por
 * isso que ela só REJEITA: quem sobrevive a este teste é remedido por vértice.
 * Errar para mais aqui custa uma varredura a mais; errar para menos perderia a
 * peça. `boundingBox` da geometria é calculado uma vez pelo three e fica em
 * cache, então o custo por malha é oito pontos.
 */
function caixaGrosseira(o: THREE.Mesh, inv: THREE.Matrix4, alvo: THREE.Box3): THREE.Box3 | null {
  const geo = o.geometry;
  if (!geo) return null;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (!bb) return null;
  const box = alvo.makeEmpty();
  for (let i = 0; i < 8; i++) {
    _v.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z)
      .applyMatrix4(o.matrixWorld).applyMatrix4(inv);
    box.expandByPoint(_v);
  }
  return box;
}

/**
 * Acha o PORTA-PLACA: o painel raso sob a lanterna traseira do lado escolhido.
 *
 * Devolve as malhas dele, ou uma lista vazia com o motivo no console. Ver o
 * bloco O IMPLEMENTO LEVA A PLACA NO PORTA-PLACA acima para a regra e para os
 * números medidos.
 */
function acharPortaPlaca(trailer: THREE.Object3D): THREE.Mesh[] {
  const lanternas: THREE.Mesh[] = [];
  const todas: THREE.Mesh[] = [];
  trailer.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    todas.push(o);
    if (souOuAncestral(o, LANTERNA_TRASEIRA_RE, trailer)) lanternas.push(o);
  });
  if (!lanternas.length) {
    console.warn('[placa] o implemento não declara `lanterna-traseira` —'
      + ' sem datum para o porta-placa, ele fica sem placa.');
    return [];
  }
  /* ⚠️ UMA atualização de matriz para a busca inteira. `caixaLocal()` chama
     `updateWorldMatrix(true, true)` por conta própria, o que é certo para uma
     medida avulsa e é ruína aqui: são 2 151 malhas numa árvore de 5 852 nós,
     ou seja 12,6 milhões de recomposições de matriz para responder uma
     pergunta. Daqui para baixo a inversa viaja na mão. */
  trailer.updateWorldMatrix(true, true);
  const inv = refDoImplemento(trailer).clone();

  /* A lanterna do lado pedido. Uma caixa por malha, e agrupadas pelo SINAL de x:
     as duas lanternas são espelhadas e nunca cruzam a linha de centro. */
  const _b = new THREE.Box3();
  const doLado = lanternas.filter((o) => {
    const b = caixaCom(inv, [o], _b);
    return !!b && Math.sign((b.min.x + b.max.x) / 2) === LADO_DA_PLACA;
  });
  const lant = caixaCom(inv, doLado);
  if (!lant) {
    console.warn('[placa] nenhuma lanterna traseira do lado', LADO_DA_PLACA, '— placa não montada.');
    return [];
  }

  /* O painel: raso, abaixo da lanterna, sobreposto a ela em x, e do tamanho de
     uma placa. A janela em z é o que separa este painel do para-lamas, que passa
     em todos os outros testes e mora 1,8 m à frente. */
  const largura = LARGURA + 2 * BERCO_SOBRA + 2 * FOLGA_NO_PAINEL;
  const altura = ALTURA + 2 * BERCO_SOBRA + 2 * FOLGA_NO_PAINEL;
  /* A janela de interesse, com folga para a caixa grosseira errar para mais. */
  const yLo = lant.min.y - ABAIXO_DA_LANTERNA - altura - 0.05;
  const yHi = lant.min.y + 0.06;
  const zLo = lant.min.z - MESMA_TRASEIRA - PAINEL_RASO - 0.05;
  const zHi = lant.min.z + MESMA_TRASEIRA + 0.05;
  const grosso = new THREE.Box3();
  let melhor: { malhas: THREE.Mesh[]; box: THREE.Box3 } | null = null;
  let varridas = 0;
  for (const o of todas) {
    const g = caixaGrosseira(o, inv, grosso);
    if (!g) continue;
    if (g.max.y < yLo || g.min.y > yHi || g.max.z < zLo || g.min.z > zHi) continue;
    if (g.max.x < lant.min.x - 0.05 || g.min.x > lant.max.x + 0.05) continue;
    varridas++;
    const b = caixaCom(inv, [o]);
    if (!b) continue;
    const w = b.max.x - b.min.x, h = b.max.y - b.min.y, d = b.max.z - b.min.z;
    if (d > PAINEL_RASO || w < largura || h < altura) continue;
    if (b.max.y > lant.min.y + 0.01) continue;                    // tem de estar ABAIXO
    if (lant.min.y - b.max.y > ABAIXO_DA_LANTERNA) continue;      // e logo abaixo
    if (Math.abs(b.min.z - lant.min.z) > MESMA_TRASEIRA) continue;
    const sobre = Math.min(b.max.x, lant.max.x) - Math.max(b.min.x, lant.min.x);
    if (sobre < 0.6 * w) continue;
    /* Entre candidatos, o mais ALTO — é o que encosta na lanterna. */
    if (!melhor || b.max.y > melhor.box.max.y) melhor = { malhas: [o], box: b };
  }
  if (!melhor) {
    console.warn('[placa] não achei painel de porta-placa sob a lanterna'
      + ` (precisa de ${(largura * 1000).toFixed(0)} x ${(altura * 1000).toFixed(0)} mm rasos)`
      + ' — o implemento fica sem placa.');
    return [];
  }
  /* As peças COINCIDENTES entram junto: o bake traz o painel em DUAS malhas
     quase idênticas — a chapa furada e o fundo dela. Medir só uma não é
     inofensivo: foi exatamente aí que apareceu o defeito de `HEAVY_VERTS` em
     `trailer-assembly.ts` (uma recuava no redimensionamento e a outra não), e
     é a caixa das DUAS que denuncia isso em `licensePlateInfo()`. */
  const alvoBox = melhor.box;
  const grupo: THREE.Mesh[] = [];
  for (const o of todas) {
    const g = caixaGrosseira(o, inv, grosso);
    if (!g) continue;
    if (Math.abs(g.min.x - alvoBox.min.x) > 0.05 || Math.abs(g.max.y - alvoBox.max.y) > 0.05) continue;
    const b = caixaCom(inv, [o]);
    if (!b) continue;
    if (Math.abs(b.min.x - alvoBox.min.x) < 0.02 && Math.abs(b.max.x - alvoBox.max.x) < 0.02
      && Math.abs(b.min.y - alvoBox.min.y) < 0.02 && Math.abs(b.max.y - alvoBox.max.y) < 0.02) {
      grupo.push(o);
    }
  }
  console.info('[placa] porta-placa do implemento —', grupo.length || 1, 'peça(s),',
    varridas, 'malhas medidas de', todas.length,
    '· x', alvoBox.min.x.toFixed(3), '…', alvoBox.max.x.toFixed(3),
    '· y', alvoBox.min.y.toFixed(3), '…', alvoBox.max.y.toFixed(3));
  return grupo.length ? grupo : melhor.malhas;
}

/**
 * Monta a placa traseira do implemento e a assenta na medida corrente.
 *
 * Chamado uma vez em `loadTrailer()`. Depois disso quem repõe a pose é
 * `placeTrailerPlate()`, e ele é chamado de todo caminho que mexe na traseira.
 */
/**
 * Solta a placa traseira e esquece o porta-placa.
 *
 * Contraparte de `detachCabPlate()`, e ela passou a ser necessária em
 * 2026-08-18: com mais de um implemento no catálogo, `loadTrailer()` deixou de
 * rodar uma vez só. Sem isto, a troca de implemento deixaria `placaTrailer`
 * apontando para um grupo já descartado e `portaPlaca` para malhas que saíram
 * da cena — e `placeTrailerPlate()` reporia a placa no lugar do implemento
 * ANTERIOR, sem erro nenhum.
 */
export function detachTrailerPlate() {
  descartar(placaTrailer);
  placaTrailer = null;
  portaPlaca = [];
  raizTrailer = null;
}

export function attachTrailerPlate(trailer: THREE.Object3D): boolean {
  descartar(placaTrailer);
  placaTrailer = null;
  raizTrailer = trailer;
  portaPlaca = acharPortaPlaca(trailer);
  if (!portaPlaca.length) return false;
  const g = new THREE.Group();
  g.name = LICENSE_PLATE_GROUP;
  /* O porta-placa é um painel plano de fábrica: berço de aro, sem vão a tapar. */
  g.add(montar(BERCO_MIN));
  trailer.add(g);
  placaTrailer = g;
  return placeTrailerPlate(trailer);
}

/**
 * Reassenta a placa traseira — REDERIVADA, nunca acumulada.
 *
 * O mesmo contrato de `placeThermoKing()`, e pelo mesmo motivo: a traseira anda
 * a cada `setTrailerDims()` (o comprimento cresce PARA TRÁS) e somar deltas
 * deixaria resíduo somado para sempre. Medir o para-choque e resolver as três
 * coordenadas de uma vez é idempotente por construção.
 */
export function placeTrailerPlate(trailer: THREE.Object3D | null | undefined): boolean {
  if (!placaTrailer || !trailer || !portaPlaca.length) return false;
  const box = caixaLocal(trailer, portaPlaca);
  if (!box) return false;
  /* A TRASEIRA É −Z no referencial do implemento: `trailer_meta.json` declara
     `frontZ = 7.175` como o MAIOR z das chapas, e é dele que `models.ts` tira
     `state.trailerBase.frontZ`. Logo a face que se vê de trás é `box.min.z`. */
  placaTrailer.position.set(
    (box.min.x + box.max.x) / 2,         // centrada no porta-placa, não no baú
    (box.min.y + box.max.y) / 2,
    box.min.z - ESPESSURA,               // encostada na face de trás do painel
  );
  orientar(placaTrailer, _n.set(0, 0, -1));
  placaTrailer.updateMatrix();
  placaTrailer.updateMatrixWorld(true);
  return true;
}

/* ------------------------------------------------------------------ diagnóstico */

/** Para o console e para a bancada. */
export function licensePlateInfo() {
  const caixa = (g: THREE.Group | null) => {
    if (!g) return null;
    const p = g.getWorldPosition(new THREE.Vector3());
    return { x: +p.x.toFixed(4), y: +p.y.toFixed(4), z: +p.z.toFixed(4) };
  };
  return {
    manifesto: manifesto ? Object.keys(manifesto.tractors || {}).length : 0,
    cavalo: placaCab ? {
      local: placaCab.position.toArray().map((v) => +v.toFixed(4)),
      mundo: caixa(placaCab),
      vao: sitioCab?.vao ?? null,
      fonte: sitioCab?.fonte ?? null,
      alturaSolo: sitioCab?.alturaSolo ?? null,
    } : null,
    /* A TRASEIRA DO RÍGIDO — nula num cavalo mecânico, que emplaca no
       implemento. Ver `attachRigidRearPlate()`. */
    rigidoTraseira: placaTraseiraCab ? {
      local: placaTraseiraCab.position.toArray().map((v) => +v.toFixed(4)),
      mundo: caixa(placaTraseiraCab),
    } : null,
    implemento: placaTrailer ? {
      local: placaTrailer.position.toArray().map((v) => +v.toFixed(4)),
      mundo: caixa(placaTrailer),
      pecasDoPortaPlaca: portaPlaca.length,
      lado: LADO_DA_PLACA < 0 ? 'direita do veículo' : 'esquerda do veículo',
      /* A caixa do painel, REMEDIDA agora. É o que separa "a placa não andou" de
         "o painel não andou" quando o baú é redimensionado. */
      /* A caixa do painel, REMEDIDA agora e PEÇA A PEÇA.
         ⚠️ Peça a peça e não a união, porque foi assim que o defeito apareceu:
         das duas malhas coincidentes do porta-placa, só uma recuava no
         redimensionamento (`HEAVY_VERTS` em `trailer-assembly.ts`), e a união
         das duas escondia isso num intervalo que parecia só "grande". */
      portaPlacaCaixa: raizTrailer && portaPlaca.length
        ? portaPlaca.map((o) => {
          const b = caixaLocal(raizTrailer as THREE.Object3D, [o]);
          return (o.name || '?') + ' z ' + (b ? b.min.z.toFixed(3) + '…' + b.max.z.toFixed(3) : '—');
        })
        : null,
    } : null,
    medidas: { larguraM: LARGURA, alturaM: ALTURA, espessuraM: ESPESSURA },
    material: matArte?.name ?? null,
    arteCarregada: !!texArte?.image,
  };
}
