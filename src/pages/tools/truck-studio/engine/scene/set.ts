/* Cenários de GEOMETRIA REAL — o "set" 3D que substitui o chão procedural.
   ---------------------------------------------------------------------------
   POR QUE ESTE MÓDULO EXISTE.

   Até aqui um cenário era uma FOTO (equirect HDR) mais um chão procedural: um
   disco de asfalto de raio 26 m com fade alpha, uma orla de grama, tufos
   espalhados e postes gerados em código (nearGround + scatter em
   environment.ts). Isso funciona, e a calibração de `tintRgb` em
   environments.json existe justamente para casar o CG com a foto — mas o olho
   rejeita a transição por quatro motivos que nenhum ajuste de cor resolve:
   o disco é redondo, o chão é plano, os tufos não têm arranjo, e NADA oclui o
   horizonte. O caminhão fica sobre um disco dentro de uma foto infinita.

   Um `set` troca essa banda inteira por geometria de verdade: prédios, pista,
   meio-fio, faixas pintadas, contêineres. O HDRI continua sendo o céu e a
   fonte de reflexo; o que muda é que os primeiros 100 m passam a ser 3D.

   O QUE ESTE MÓDULO NÃO FAZ. Ele não ilumina nada. O rig de luz
   (scene.ts + presets.ts) continua sendo o dono absoluto de key/rim/hemi/fog,
   e os materiais do set são PBR normais que respondem a ele — é por isso que
   um set atravessa os seis presets e o ciclo dia/noite sem nenhum tratamento
   especial. Sets FOTOGRAMÉTRICOS (albedo com sol assado dentro) precisariam do
   multiplicador linear por preset descrito em REAL_ENVIRONMENT_PLAN.md; os
   dois sets que existem hoje são modelados, então não precisam.

   MATERIAIS NOMEADOS. O .glb sai do Blender com materiais de chão SEM textura
   — só nomes (`ASPHALT_YARD`, `CONCRETE_APRON`, ...). O manifesto liga cada
   nome a um conjunto PBR de `/textures/`, que o app JÁ baixa para os cenários
   antigos. Sem isso, cada set carregaria a sua própria cópia do mesmo asfalto
   4k: o `distrito-industrial` fecha em 7,8 MB porque o chão dele pesa zero. */
import * as THREE from 'three';
import { scene, renderer } from './scene';
import { loadGLB } from '../vehicle/models';
import { assetUrl } from '../catalog/catalog';
import { canvasTex, makeMacroCanvas } from './textures';

/** Um conjunto PBR ligado a um material nomeado do .glb. */
export interface SetMaterialDef {
  diffuse?: string;
  rough?: string;
  normal?: string;
  ao?: string;
  /** repetição UV final; o build autora UV em metros/`uv_scale` */
  repeat?: number;
  /**
   * Força do normal map (material.normalScale). O padrão do three é 1, e para
   * um chão a céu aberto isso é pouco: o relevo do concreto e do asfalto é o que
   * QUEBRA o lobo especular, e sem ele a superfície devolve o céu inteiro numa
   * direção só — que é a leitura de "chão espelhado". Subir isto tira brilho sem
   * mexer no reflexo, porque espalha o que já existe.
   */
  normalScale?: number;
  /**
   * Variação macro: um segundo mapa, de período MUITO maior que o ladrilho,
   * multiplicado no albedo. É o que impede o olho de achar a repetição.
   * `scale` é multiplicado na UV do chão (que está em metros / 8), então o
   * período em metros é 8 / scale — 0.09 dá ~89 m. `amount` é quanto da variação
   * entra (0 = nada, 1 = a mancha inteira).
   */
  macro?: { scale: number; amount: number };
  /** multiplicadores LINEARES escritos em material.color (mesma semântica de nearGround.tintRgb) */
  tintRgb?: [number, number, number];
  roughness?: number;
  metalness?: number;
  /** multiplicador do reflexo do ambiente (material.envMapIntensity, padrão 1).
   *  ROUGHNESS SOZINHA NÃO TIRA O BRILHO DO CHÃO. Um dielétrico com roughness
   *  0.97 ainda integra o hemisfério inteiro do HDRI, e sob céu aberto ao
   *  meio-dia isso é um lençol de luz especular sobre a laje — foi o "ground
   *  tiles are reflecting too much". Este é o botão certo para isso: reduz o
   *  quanto o ambiente entra, sem mexer no difuso nem na nitidez. */
  envIntensity?: number;
}

export interface SetDef {
  /** caminho absoluto do .glb (Draco) */
  url: string;
  /** nome do material no .glb → conjunto PBR */
  materials?: Record<string, SetMaterialDef>;
  /** grau do rotacionamento Y aplicado ao set (alinha com envRotation) */
  rotationY?: number;
  /** o set é um interior com casca single-sided (ver build_warehouse.py) */
  interior?: boolean;
  /** caixa que prende a câmera dentro do set, em metros de mundo */
  bounds?: { halfX: number; halfZ: number; minY: number; maxY: number };
}

const group = new THREE.Group();
group.name = 'ts-set';
scene.add(group);

const texLoader = new THREE.TextureLoader();
const texCache = new Map<string, THREE.Texture>();

let currentUrl: string | null = null;
let loading = 0;
let stats = { meshes: 0, triangles: 0, materials: 0, bound: 0 };

function loadTex(url: string, srgb: boolean, repeat: number): THREE.Texture {
  const key = url + '|' + (srgb ? 's' : 'l') + '|' + repeat;
  const hit = texCache.get(key);
  if (hit) return hit;
  const t = texLoader.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  /* Anisotropia no máximo do device: um pátio de asfalto é visto em ângulo
     rasante quase o tempo todo, que é exatamente o caso em que a filtragem
     trilinear vira um borrão cinza a dez metros do capô. */
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

/* ---------------- variação macro ----------------
   O ladrilho do chão tem 6 a 8 m. Numa área de 180 m isso são vinte e tantas
   repetições da MESMA mancha, e o olho acha esse ritmo antes de achar qualquer
   outra coisa — é o que faz um pátio corretamente texturizado ainda parecer
   papel de parede.

   A correção é clássica e barata: um segundo mapa, de período dezenas de vezes
   maior, multiplicado no albedo. Ele não acrescenta detalhe nenhum; ele tira a
   PERIODICIDADE, porque duas frequências que não são múltiplas só voltam a
   coincidir muito longe.

   O mapa é o mesmo makeMacroCanvas() que o chão procedural já usa (cinza médio
   com manchas), então não entra asset novo. Cinza médio 0,5 vezes 2 = 1, ou
   seja: onde não há mancha, o albedo passa intocado.

   Uma textura só, compartilhada por todos os materiais: são 256², e uma cópia
   por material seria desperdício puro. */
let macroTex: THREE.Texture | null = null;
function getMacroTex(): THREE.Texture {
  if (!macroTex) {
    /* Linear, não sRGB: isto é um MULTIPLICADOR, não uma cor — passá-lo pela
       conversão de sRGB dobraria a mancha na parte escura. */
    macroTex = canvasTex(makeMacroCanvas(), 1, 1, THREE.LinearSRGBColorSpace);
  }
  return macroTex;
}

const MACRO_GLSL = /* glsl */`
#ifdef USE_MAP
{
  vec3 tsMacro = texture2D( uMacroMap, vMapUv * uMacroScale ).rgb;
  diffuseColor.rgb *= mix( vec3( 1.0 ), tsMacro * 2.0, uMacroAmount );
}
#endif
`;

/* Depois de <map_fragment>, que é onde `diffuseColor` já tem o albedo do mapa e
   ainda não passou por nada mais. `vMapUv` é a varying que o three publica para
   o mapa (era `vUv` antes de r152); ela já traz o `repeat` do ladrilho aplicado,
   e é por isso que `uMacroScale` é um multiplicador dela e não um valor
   absoluto. */
function installMacro(mat: THREE.MeshStandardMaterial, cfg: { scale: number; amount: number }) {
  const tex = getMacroTex();
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uMacroMap = { value: tex };
    shader.uniforms.uMacroScale = { value: cfg.scale };
    shader.uniforms.uMacroAmount = { value: cfg.amount };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n'
        + 'uniform sampler2D uMacroMap;\nuniform float uMacroScale;\nuniform float uMacroAmount;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + MACRO_GLSL);
  };
  /* Sem isto o three reaproveita o programa do material SEM a injeção (a chave
     de cache não conhece onBeforeCompile), e a variação some em metade dos
     materiais sem erro nenhum. */
  mat.customProgramCacheKey = () => 'ts-set-macro-v1';
}

/** Liga os conjuntos PBR do manifesto aos materiais nomeados do .glb. */
function bindMaterials(root: THREE.Object3D, defs: Record<string, SetMaterialDef>) {
  let bound = 0;
  const seen = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial;
      if (!mat || seen.has(mat)) continue;
      seen.add(mat);
      const def = defs[mat.name];
      if (!def) continue;
      const rep = typeof def.repeat === 'number' && def.repeat > 0 ? def.repeat : 1;
      if (def.diffuse) mat.map = loadTex(assetUrl(def.diffuse), true, rep);
      if (def.rough) mat.roughnessMap = loadTex(assetUrl(def.rough), false, rep);
      if (def.normal) mat.normalMap = loadTex(assetUrl(def.normal), false, rep);
      if (def.ao) mat.aoMap = loadTex(assetUrl(def.ao), false, rep);
      if (Array.isArray(def.tintRgb) && def.tintRgb.length === 3) {
        mat.color.setRGB(def.tintRgb[0], def.tintRgb[1], def.tintRgb[2]);
      }
      if (typeof def.roughness === 'number') mat.roughness = def.roughness;
      if (typeof def.metalness === 'number') mat.metalness = def.metalness;
      if (typeof def.envIntensity === 'number') mat.envMapIntensity = def.envIntensity;
      /* Só faz sentido com normal map — sem ele o three ignora, e escrever
         mesmo assim esconderia um manifesto errado. */
      if (typeof def.normalScale === 'number' && mat.normalMap) {
        mat.normalScale.set(def.normalScale, def.normalScale);
      }
      if (def.macro && typeof def.macro.scale === 'number') installMacro(mat, def.macro);
      mat.needsUpdate = true;
      bound++;
    }
  });
  return bound;
}

/**
 * Sombras.
 *
 * `castShadow` em TUDO seria caro e errado: o mapa de sombra do rig cobre a
 * vizinhança do caminhão, não 600 m de pátio, então um prédio a 90 m só
 * consumiria resolução do atlas sem projetar nada visível. Chão sempre
 * RECEBE (é onde a sombra do caminhão cai); geometria vertical dentro do raio
 * do mapa também PROJETA.
 */
const SHADOW_CAST_RADIUS = 60;

function setupShadows(root: THREE.Object3D) {
  const c = new THREE.Vector3();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    mesh.receiveShadow = true;
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    const bs = mesh.geometry.boundingSphere;
    if (!bs) return;
    c.copy(bs.center).applyMatrix4(mesh.matrixWorld);
    mesh.castShadow = Math.hypot(c.x, c.z) - bs.radius < SHADOW_CAST_RADIUS;
  });
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      /* As texturas vivem em texCache e são COMPARTILHADAS entre sets (os dois
         cenários usam o mesmo asphalt_diff). Descartar o material sem descartar
         os mapas é o comportamento correto; texCache só é esvaziado por
         disposeSetTextures(). */
      (m as THREE.Material)?.dispose();
    }
  });
}

/** Remove o set atual da cena e libera geometria/materiais. */
export function disposeSet() {
  for (const child of [...group.children]) {
    group.remove(child);
    disposeTree(child);
  }
  currentUrl = null;
  stats = { meshes: 0, triangles: 0, materials: 0, bound: 0 };
}

/** Libera o cache de texturas do set. Só na saída do studio. */
export function disposeSetTextures() {
  for (const t of texCache.values()) t.dispose();
  texCache.clear();
}

/**
 * Carrega e aplica um set. Idempotente por URL: reaplicar o mesmo cenário não
 * rebaixa nada.
 *
 * @returns true se há um set na cena ao final (inclusive por já estar lá).
 */
export async function applySet(def: SetDef | null | undefined): Promise<boolean> {
  const url = def && typeof def.url === 'string' ? assetUrl(def.url) : null;
  if (!url) {
    disposeSet();
    return false;
  }
  if (url === currentUrl) return true;

  const token = ++loading;
  let root: THREE.Group;
  try {
    root = await loadGLB(url);          // loadGLB devolve gltf.scene, não o GLTF
  } catch (err) {
    console.warn('[set] falhou ao carregar', url, err);
    return currentUrl !== null;
  }
  /* Uma troca de cenário durante o download vence: descarta o que chegou
     tarde em vez de empilhar dois sets na cena. */
  if (token !== loading) {
    disposeTree(root);
    return currentUrl !== null;
  }

  disposeSet();
  if (typeof def!.rotationY === 'number') root.rotation.y = def!.rotationY;
  root.updateMatrixWorld(true);

  const bound = def!.materials ? bindMaterials(root, def!.materials) : 0;
  setupShadows(root);

  let meshes = 0, triangles = 0;
  const mats = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    meshes++;
    const idx = mesh.geometry.index;
    const pos = mesh.geometry.attributes.position;
    triangles += Math.floor((idx ? idx.count : (pos ? pos.count : 0)) / 3);
    const mm = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mm) if (m) mats.add(m as THREE.Material);
  });

  group.add(root);
  currentUrl = url;
  stats = { meshes, triangles, materials: mats.size, bound };
  return true;
}

export function setSetVisible(v: boolean) { group.visible = !!v; }
export function hasSet() { return currentUrl !== null; }
export function getSetInfo() { return { url: currentUrl, visible: group.visible, ...stats }; }
