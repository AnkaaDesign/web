/* Baú paramétrico — a costura das duas metades, e a ÂNCORA DE ENGATE do lado
   do implemento.
   ---------------------------------------------------------------------------
   Contraparte web de `truck-studio-desktop/src/studio/trailer.ts`. Só a classe
   `TrailerRig` viajou: a `LiverySurface` de lá pinta um canvas único na malha
   branca, e aqui a arte tem outro dono — `vehicle/livery.ts`, com três telas
   fabric e a LiveryUV (TEXCOORD_1) dos painéis recortados. Trazer as duas
   implementações para o mesmo arquivo seria trazer duas verdades sobre onde a
   pintura mora.

   O que este arquivo é: um par. `TrailerBody` regenera o BRANCO;
   `TrailerAssembly` move o que não é branco (teto, cantoneira, frame traseiro,
   varões, dobradiças, lanternas) para acompanhá-lo. Um sem o outro é sempre
   errado — subir a altura só no branco abre um vão embaixo do teto e deixa a
   ferragem das portas amontoada no pé; alongar só o branco deixa as lanternas
   flutuando no meio do vão.

   Fora do baú NADA escala: chassi, rodagem, para-lamas e a quinta roda ficam
   onde estão, que é o pedido. E o comprimento cresce PARA TRÁS — a dianteira
   carrega o pino-rei, e mexer nela desengataria o conjunto (ver `mapZ()` em
   trailer-geometry.ts, comportamento `front`).

   A largura não é editável: é padrão 2,60 m.

   ===========================================================================
   O ACESSOR DE ENGATE — `get hitch()`, e por que ele é CALCULADO e não lido.

   `models/vehicles/hitch.json` traz o lado CAVALO congelado, com `sha256` dos
   bytes em que cada número foi medido. Isso é o certo para o caminhão: o GLB
   dele não muda em runtime.

   O implemento é o oposto. Ele é PARAMÉTRICO: `TrailerBody` + `TrailerAssembly`
   regeneram a geometria a cada medida digitada. Uma entrada estática de
   implemento em `hitch.json` estaria errada no instante seguinte ao primeiro
   resize, e errada EM SILÊNCIO — o pino continuaria "no lugar" segundo o
   manifesto enquanto a geometria andou. Por isso `implements: {}` no manifesto
   é uma decisão, não uma pendência.

   O acessor remede o conjunto vivo em `measureAnchors()`, chamado no construtor
   e no fim de todo `set()`. Repare que ele NÃO assume que o pino fica parado:
   ele OBSERVA onde o pino está. É mais forte que a suposição, e é o que faz o
   engate seguir a geometria em vez de acreditar nela — a sonda
   `verify-coupling.mjs` varre a faixa de medidas justamente para exercitar isso.

   Nada aqui sai de `Box3.setFromObject` como MEDIDA. A caixa de um nó girado é
   a caixa de uma caixa girada, estritamente maior que a real e sem limite de
   quanto — é o que fazia o implemento pairar ~230 mm. Ela aparece uma única
   vez, como REJEIÇÃO barata de malha longe da região de interesse, onde errar
   para mais só custa varrer vértice à toa. */
import * as THREE from 'three';
import { TrailerBody, type TrailerDims } from './trailer-geometry';
import { TrailerAssembly } from './trailer-assembly';
import { deriveImplementHitch, type ImplementHitch, type ImplementMeasurements } from './coupling';

export type { TrailerDims };
export type { ImplementHitch };

/* Os pneus, pelo mesmo critério de `models.ts`: nome OU material. */
const TYRE_RE = /pneu|tire/i;
/** Banda de contato — `defaults.tyreContactBand` do manifesto. */
const CONTACT_BAND = 0.05;
/** Meia-largura da faixa da linha de centro onde o pino-rei cabe. */
const KP_HALF_X = 0.25;
/**
 * Profundidade da busca do pino, MEDIDA DA TESTEIRA PARA TRÁS.
 *
 * O que havia aqui era `zLo = (z0 + z1) / 2` — a metade dianteira inteira,
 * 7,35 m neste baú. Não é uma janela: é quase o modelo todo, e dentro dela o
 * ponto mais baixo da linha de centro abaixo do piso NÃO é o pino. São os
 * `RIVET_LOW_L/R` (`inox-ferragem`), os frisos de rebite que correm rentes ao
 * chão do começo ao fim. Medido no app rodando: o "pino" saía em z 0,000 com
 * chapa 0,986 m e uma saliência de 989 mm — contra 6,4274 m / 1,242 m / 87 mm
 * do pino de verdade. Como o solver encosta ESSE ponto na garganta, o conjunto
 * inteiro engatava 6,43 m fora do lugar, em todo modelo do catálogo.
 *
 * O pino-rei fica a 0,8 m da testeira neste baú, e a prática não passa de
 * ~2,5 m em nenhum semirreboque. 3,0 m é folgado para o que existe e estreito
 * para o que não é pino — e é ancorado na TESTEIRA, que é o datum imóvel do
 * `mapZ()` (o comprimento cresce para trás), então a janela não anda com o
 * resize. Verificado no app: 2, 3 e 4 m dão o mesmo pino.
 */
const KP_SEARCH_DEPTH = 3.0;
/** Uma saliência menor que isto não é o pino, é rebarba de malha. */
const KP_MIN_DROP = 0.04;
/**
 * E uma saliência MAIOR que isto também não é o pino.
 *
 * Um pino de 2" desce ~85 mm; o deste modelo desce 87. O teto existe porque a
 * ausência dele foi metade do defeito acima: com só um piso, um friso que
 * descia 989 mm passou por pino-rei sem uma linha de aviso. Prefira recusar a
 * âncora — o caminho legado é ruim, mas ele DIZ que é.
 */
const KP_MAX_DROP = 0.20;
/** Anel em que a chapa de apoio é votada, medido do eixo do pino. */
const PLATE_RING = [0.08, 0.30] as const;

interface Anchors {
  contactY: number;
  centerX: number;
  bogieZMin: number;
  bogieZMax: number;
  kingpinX: number;
  kingpinZ: number;
  plateBottomY: number;
  /** diagnóstico: saliência medida do pino abaixo da chapa */
  pinDrop: number;
  /** quantos vértices de pneu caíram na banda de contato */
  contactVerts: number;
}

export class TrailerRig {
  readonly body: TrailerBody;
  readonly assembly: TrailerAssembly;
  /** As medidas de fábrica, para o `reset()` e para a interface se ancorar. */
  readonly base: TrailerDims;

  private readonly root: THREE.Object3D;
  private anchors: Anchors | null = null;

  /**
   * @param root o nó do implemento. As ÂNCORAS DE ENGATE medem no referencial
   *   DESTA RAIZ (ver `rigMatrixOf`), então elas não dependem mais de onde o
   *   conjunto está na cena. `TrailerAssembly`, esse sim, continua decidindo em
   *   espaço de mundo contra números do construtor ("encosta no teto?"), então
   *   todo `set()` ainda tem de rodar na pose de carga — quem garante isso é
   *   `setTrailerDims()` em `vehicle/models.ts`, que é o dono da pose.
   */
  constructor(root: THREE.Object3D) {
    this.root = root;
    this.body = new TrailerBody(root);
    this.base = this.body.profile.base;
    root.add(this.body.group);

    const p = this.body.profile;
    this.assembly = new TrailerAssembly(root, {
      floorY: p.floorY, roofY: p.roofY, z0: p.z0, z1: p.z1,
      baseHeight: p.base.height, baseLength: p.base.length,
    });

    /* DEPOIS de `TrailerAssembly`: o construtor dele roda `roundOutScales()`,
       que devolve a redondeza aos pneus e SOBE a linha de contato em 25 mm.
       Medir antes disso seria medir um pneu ovalizado — e os 25 mm entrariam
       inteiros na altura de engate. É exatamente essa a diferença entre os
       1,2418 m que `trailer_meta.json` declara e o 1,2170 m medido aqui. */
    this.measureAnchors();
  }

  get current(): TrailerDims { return this.body.current; }
  get profile() { return this.body.profile; }

  /** Proporção do painel lateral — comprimento : altura da parte branca. */
  get sideAspect(): number {
    const d = this.body.current;
    return d.length / d.height;
  }

  /** Frisos na altura corrente, e o passo medido no modelo. */
  get ribs(): { count: number; pitch: number } {
    const { skirtHeight, capHeight, pitch } = this.body.profile;
    return {
      count: Math.round((this.body.current.height - skirtHeight - capHeight) / pitch),
      pitch,
    };
  }

  /** Altura mais próxima que fecha um número inteiro de frisos. */
  snapHeight(h: number) { return this.body.snapHeight(h); }

  /**
   * Quanto o teto subiu em relação ao modelo de fábrica, na altura corrente.
   *
   * Não é `height - base.height`: a chapa lisa grande estica a partir do PISO
   * pela razão `ky`, então a linha do teto anda por essa mesma razão e não pela
   * diferença bruta. Quem depende disso é o Thermo King, pendurado na parede
   * dianteira a uma folga fixa abaixo do teto — se ele não acompanhar por este
   * número exato, sobra ou falta exatamente o erro.
   */
  roofDelta(): number {
    const { floorY, roofY, base } = this.body.profile;
    const ky = this.body.current.height / base.height;
    return (floorY + (roofY - floorY) * ky) - roofY;
  }

  set(patch: { height?: number; length?: number }): TrailerDims {
    /* O branco primeiro: é ele que resolve a altura para um número inteiro de
       frisos (`snapHeight`), e o conjunto tem de seguir a altura EFETIVA, não a
       pedida. Passar `patch` direto para os dois deixaria a ferragem meio friso
       fora do lugar sempre que o pedido caísse entre dois passos. */
    const d = this.body.set(patch);
    this.assembly.set(d.height, d.length);
    /* E o engate remede. Custa uma varredura de vértice numa operação que já
       reescreveu milhões deles — e é o que substitui "o pino fica parado"
       (uma suposição) por "o pino está aqui" (uma medida). */
    this.measureAnchors();
    return d;
  }

  reset() { return this.set({ height: this.base.height, length: this.base.length }); }

  /* ------------------------------------------------------------- o engate */

  /**
   * O lado IMPLEMENTO do contrato de engate, na medida CORRENTE.
   *
   * `null` só se o construtor não conseguiu achar pneu nem pino — nesse caso
   * `models.ts` cai no engate legado e diz por quê, em vez de acoplar no vazio.
   */
  get hitch(): ImplementHitch | null {
    const a = this.anchors;
    if (!a) return null;
    const p = this.body.profile;
    const d = this.body.current;
    /* O teto acompanha a altura pela razão `ky` a partir do PISO — a mesma
       conta de `roofDelta()`. Ler `p.roofY` cru daria a linha de fábrica e o
       perfil da testeira ficaria curto em todo baú mais alto. */
    const roofY = p.roofY + this.roofDelta();
    const m: ImplementMeasurements = {
      contactY: a.contactY,
      centerX: a.centerX,
      bogieZMin: a.bogieZMin,
      bogieZMax: a.bogieZMax,
      kingpinX: a.kingpinX,
      kingpinZ: a.kingpinZ,
      plateBottomY: a.plateBottomY,
      floorY: p.floorY,
      roofY,
      /* A testeira NÃO anda: o comprimento cresce para trás (`front` em
         `mapZ()`), justamente para não desengatar. `z1` é o datum imóvel. */
      frontWallZ: p.z1,
      halfWidth: d.width / 2,
      dims: { ...d },
      landingGear: null,   // não existe nó de patola neste GLB; ver measureAnchors()
      profileBands: 12,
    };
    return deriveImplementHitch(m);
  }

  /** Diagnóstico das âncoras cruas, para a HUD e para a sonda. */
  get anchorsDebug(): Readonly<Anchors> | null { return this.anchors; }

  /* --------------------------------------------------------------- medição */

  /**
   * Matriz que leva os vértices de `o` ao referencial DA RAIZ DO IMPLEMENTO.
   *
   * Era `o.matrixWorld` cru, e isso é uma armadilha viva: os limiares contra os
   * quais os vértices são comparados (`profile.z0/z1/floorY`) vivem no
   * referencial da raiz, então a medida só fechava enquanto a raiz estivesse na
   * identidade dentro de uma cadeia na identidade. Com o conjunto engatado
   * (`rigGroup` a 22 m e girado 180°, mais a inclinação de engate em X) TODO
   * vértice cai fora da janela e `measureAnchors()` devolve `null` em silêncio —
   * medido: um `set()` fora de `setTrailerDims()` derruba o engate inteiro para
   * o caminho legado. `setTrailerDims()` desfaz a pose antes de chamar, e por
   * isso o app escapava; a porta seguinte não escaparia.
   *
   * Com a inversa da raiz na conta o resultado é o MESMO na pose de carga (a
   * inversa é a identidade ali) e passa a ser o mesmo em qualquer outra.
   */
  private rigMatrixOf(o: THREE.Object3D, inv: THREE.Matrix4): THREE.Matrix4 {
    return new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
  }

  /** A inversa da matriz de mundo da raiz, recalculada a cada medição. */
  private rigInverse(): THREE.Matrix4 {
    this.root.updateWorldMatrix(true, true);
    return this.root.matrixWorld.clone().invert();
  }

  private measureAnchors(): void {
    this.root.updateWorldMatrix(true, true);
    const tyres = this.measureTyres();
    if (!tyres) {
      console.warn('[engate] nenhum pneu encontrado no implemento — '
        + 'sem plano de contato, o engate cai no caminho legado.');
      this.anchors = null;
      return;
    }
    const kp = this.measureKingpin(tyres.contactY);
    if (!kp) {
      console.warn('[engate] pino-rei não encontrado sob a dianteira — '
        + 'sem âncora de implemento, o engate cai no caminho legado.');
      this.anchors = null;
      return;
    }
    this.anchors = { ...tyres, ...kp };
    console.info('[engate] implemento medido — pino x', kp.kingpinX.toFixed(4),
      'z', kp.kingpinZ.toFixed(4), '· chapa', kp.plateBottomY.toFixed(4),
      `(${((kp.plateBottomY - tyres.contactY) * 1000).toFixed(0)} mm do solo)`,
      '· saliência do pino', (kp.pinDrop * 1000).toFixed(0), 'mm',
      '· bogie z', tyres.bogieZMin.toFixed(3), '…', tyres.bogieZMax.toFixed(3),
      `(halfSpan ${((tyres.bogieZMax - tyres.bogieZMin) / 2).toFixed(3)})`);
  }

  /**
   * Plano de contato e bogie, POR VÉRTICE E POR ALTURA.
   *
   * Não por malha — e esta é a correção que o caminho antigo não tinha. Neste
   * bake os catorze pneus E o estepe estão soldados numa ÚNICA primitiva, então
   * o filtro por malha de `runningTyres()` não descarta nada: ele devolve o vão
   * inteiro, 2,622 m de meio-vão contra os 1,468 m reais, e o centro 819 mm
   * fora do lugar. Como é sobre esse centro que a inclinação de engate gira, o
   * erro entra direto na altura do prato.
   *
   * Quem separa o estepe do bogie é a ALTURA do vértice: o estepe fica
   * pendurado no chassi e nenhum vértice dele entra na banda de contato. O
   * critério vale em qualquer bake e não depende de nome de nó.
   */
  private measureTyres(): Pick<Anchors, 'contactY' | 'centerX' | 'bogieZMin' | 'bogieZMax' | 'contactVerts'> | null {
    const meshes: THREE.Mesh[] = [];
    this.root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.geometry?.attributes?.position) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (TYRE_RE.test(o.name) || mats.some((mm) => !!mm && TYRE_RE.test(mm.name || ''))) meshes.push(o);
    });
    if (!meshes.length) return null;

    const inv = this.rigInverse();               // ver rigMatrixOf()
    const mat = new Map<THREE.Mesh, THREE.Matrix4>();
    for (const o of meshes) mat.set(o, this.rigMatrixOf(o, inv));

    const v = new THREE.Vector3();
    let contactY = Infinity;
    for (const o of meshes) {
      const pos = o.geometry.attributes.position;
      const m = mat.get(o) as THREE.Matrix4;
      for (let k = 0; k < pos.count; k++) {
        v.fromBufferAttribute(pos, k).applyMatrix4(m);
        if (v.y < contactY) contactY = v.y;
      }
    }
    if (!Number.isFinite(contactY)) return null;

    const cut = contactY + CONTACT_BAND;
    let zMin = Infinity, zMax = -Infinity, xSum = 0, n = 0;
    for (const o of meshes) {
      const pos = o.geometry.attributes.position;
      const m = mat.get(o) as THREE.Matrix4;
      for (let k = 0; k < pos.count; k++) {
        v.fromBufferAttribute(pos, k).applyMatrix4(m);
        if (v.y > cut) continue;
        if (v.z < zMin) zMin = v.z;
        if (v.z > zMax) zMax = v.z;
        xSum += v.x; n++;
      }
    }
    if (!n) return null;
    return { contactY, centerX: xSum / n, bogieZMin: zMin, bogieZMax: zMax, contactVerts: n };
  }

  /**
   * O pino-rei e a chapa de apoio, medidos PELA FORMA.
   *
   * Não existe nó chamado "pino" neste GLB — ele está soldado no `stitch_all`
   * do `metal-preto`, junto com 924 mil vértices de estrado. Então mede-se o
   * que ele É: o único sólido da linha de centro, sob a dianteira, que desce
   * mais de 40 mm abaixo de tudo em volta. Um pino de 2" desce ~85 mm; o deste
   * modelo desce 87.
   *
   * A CHAPA é a face plana dominante num anel de 80 a 300 mm do eixo — o disco
   * que a quinta roda de fato toca. A votação é sobre o MÍNIMO DE CADA CÉLULA
   * de 50 mm e não sobre vértices: a densidade de malha varia de peça para peça
   * e uma travessa finamente tesselada ganharia a eleição sem cobrir área
   * nenhuma. (Foi assim que uma primeira medição devolveu 1,244 em vez de
   * 1,222 — a face certa está 22 mm abaixo, e 22 mm é folga de engate.)
   */
  private measureKingpin(
    contactY: number,
  ): Pick<Anchors, 'kingpinX' | 'kingpinZ' | 'plateBottomY' | 'pinDrop'> | null {
    const p = this.body.profile;
    const floorY = p.floorY;
    const zHi = p.z1;                          // a testeira, datum imóvel
    const zLo = Math.max(p.z0, zHi - KP_SEARCH_DEPTH);   // ver KP_SEARCH_DEPTH

    /* Rejeição barata: a caixa de `setFromObject` é grande demais, e é por isso
       que ela serve AQUI — descartar de menos só custa varrer vértice à toa. */
    const inv = this.rigInverse();               // ver rigMatrixOf()
    const box = new THREE.Box3();
    const meshes: THREE.Mesh[] = [];
    const mat = new Map<THREE.Mesh, THREE.Matrix4>();
    this.root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some((mm) => !!mm && TYRE_RE.test(mm.name || ''))) return;
      const m = this.rigMatrixOf(o, inv);
      /* A caixa também no referencial da raiz. `setFromObject` traria a de
         MUNDO, e comparar isso com `z0/z1/floorY` é o erro que rigMatrixOf()
         existe para apagar — aqui ele descartaria a malha do pino inteira. */
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const gb = o.geometry.boundingBox;
      if (!gb) return;
      box.copy(gb).applyMatrix4(m);
      if (box.isEmpty()) return;
      if (box.max.z < zLo || box.min.z > zHi) return;
      if (box.min.y > floorY) return;
      if (box.max.x < -KP_HALF_X || box.min.x > KP_HALF_X) return;
      meshes.push(o);
      mat.set(o, m);
    });
    if (!meshes.length) return null;

    const v = new THREE.Vector3();
    const visit = (fn: (x: number, y: number, z: number) => void) => {
      for (const o of meshes) {
        const pos = o.geometry.attributes.position;
        const m = mat.get(o) as THREE.Matrix4;
        for (let k = 0; k < pos.count; k++) {
          v.fromBufferAttribute(pos, k).applyMatrix4(m);
          if (Math.abs(v.x) > KP_HALF_X || v.z < zLo || v.z > zHi || v.y > floorY) continue;
          fn(v.x, v.y, v.z);
        }
      }
    };

    let yMin = Infinity;
    visit((_x, y) => { if (y < yMin) yMin = y; });
    if (!Number.isFinite(yMin)) return null;

    /* O pino: os 20 mm mais baixos da faixa. */
    let pxMin = Infinity, pxMax = -Infinity, pzMin = Infinity, pzMax = -Infinity, pn = 0;
    visit((x, y, z) => {
      if (y > yMin + 0.02) return;
      if (x < pxMin) pxMin = x; if (x > pxMax) pxMax = x;
      if (z < pzMin) pzMin = z; if (z > pzMax) pzMax = z;
      pn++;
    });
    if (!pn) return null;
    const kingpinX = (pxMin + pxMax) / 2;
    const kingpinZ = (pzMin + pzMax) / 2;

    /* A chapa: moda dos mínimos de célula no anel. */
    const cell = new Map<string, number>();
    visit((x, y, z) => {
      const d = Math.hypot(x - kingpinX, z - kingpinZ);
      if (d <= PLATE_RING[0] || d >= PLATE_RING[1]) return;
      const key = `${Math.round(x / 0.05)},${Math.round(z / 0.05)}`;
      const cur = cell.get(key);
      if (cur === undefined || y < cur) cell.set(key, y);
    });
    const hist = new Map<number, number>();
    for (const y of cell.values()) {
      const b = Math.round(y * 500);
      hist.set(b, (hist.get(b) ?? 0) + 1);
    }
    if (!hist.size) return null;
    let bestBin = 0, bestN = -1;
    for (const [b, c] of hist) if (c > bestN || (c === bestN && b < bestBin)) { bestBin = b; bestN = c; }
    const plateBottomY = bestBin / 500;

    const pinDrop = plateBottomY - yMin;
    if (pinDrop < KP_MIN_DROP || pinDrop > KP_MAX_DROP) {
      console.warn('[engate] saliência de', (pinDrop * 1000).toFixed(0),
        'mm sob a dianteira não é o pino-rei (esperado entre',
        (KP_MIN_DROP * 1000).toFixed(0), 'e', (KP_MAX_DROP * 1000).toFixed(0),
        'mm) — âncora recusada.');
      return null;
    }
    /* `contactY` entra só no log; a altura útil é `plateBottomY − groundY` e
       quem faz essa conta é o solver, com o mesmo `groundY` dos dois lados. */
    void contactY;
    return { kingpinX, kingpinZ, plateBottomY, pinDrop };
  }
}
