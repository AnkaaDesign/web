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
   multiplicador linear por preset descrito em ARCHITECTURE.md; os
   dois sets que existem hoje são modelados, então não precisam.

   MATERIAIS NOMEADOS. O .glb sai do Blender com materiais de chão SEM textura
   — só nomes (`ASPHALT_YARD`, `CONCRETE_APRON`, ...). O manifesto liga cada
   nome a um conjunto PBR de `/textures/`, que o app JÁ baixa para os cenários
   antigos. Sem isso, cada set carregaria a sua própria cópia do mesmo asfalto
   4k: o `distrito-industrial` fecha em 7,8 MB porque o chão dele pesa zero. */
import * as THREE from 'three';
import { scene, renderer, registerGroundMaterials } from './scene';
import type { GroundMatEntry, GroundSurface } from './scene';
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
  /**
   * Família de molhagem desta superfície: `asphalt | concrete | gravel | dirt |
   * grass`. É o que decide quanto o albedo cai e quanto a rugosidade colapsa
   * quando o preset `Chuvoso` entra — grama não vira espelho, asfalto vira.
   *
   * OPCIONAL: sem ele, set.ts infere pelo NOME do material (ver SURFACE_BY_NAME),
   * o que já acerta os cenários atuais. Autore quando o nome mentir.
   */
  surface?: 'asphalt' | 'concrete' | 'gravel' | 'dirt' | 'grass';
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

/* UMA BASE POR ARQUIVO, UM CLONE POR MATERIAL — e a chave do cache não carrega
   mais o `repeat`.
   ---------------------------------------------------------------------------
   Ela carregava: `url|s|repeat`. O efeito era um UPLOAD INTEIRO por período de
   ladrilho. No `distrito-industrial` o mesmo conjunto de concreto é pedido com
   repeat 1 (GROUND_CONCRETE, KERB_CONCRETE) e com repeat 2 (CONCRETE_APRON), e
   os quatro mapas (diffuse, rough, normal, ao) são 2048² — ou seja, ~22 MB de
   VRAM cada com mipmaps, e a segunda cópia custava ~90 MB para desenhar
   exatamente os mesmos pixels num período diferente.

   O `repeat` NÃO é estado de GPU: ele vive no uniforme `uvTransform` do
   material, não na textura. Confirmado no three 0.179 — getTextureCacheKey()
   lista wrap, filtros, anisotropia, formato, tipo, mipmaps, flipY e espaço de
   cor, e não offset/repeat —, então dois CLONES que compartilham `source` e
   diferem só no repeat compartilham UM objeto de textura da GL, com contagem de
   uso. É o mesmo mecanismo em que scene/environment.ts já se apoia para as
   cópias privadas do near-ground.

   Logo: `texCache` guarda a textura BASE, que nunca é ligada a material nenhum
   (e portanto nunca sobe para a GPU), e cada material recebe um clone com o
   período dele. Quem descarta o clone é disposeTree(), junto com o material que
   o usava; quem descarta a base — e com ela a imagem decodificada, que é o custo
   de RAM — é disposeSetTextures(). */
function cloneFor(base: THREE.Texture, repeat: number): THREE.Texture {
  const t = base.clone();
  t.repeat.set(repeat, repeat);
  return t;
}

/**
 * Carrega uma textura de chão do set.
 *
 * AGUARDADA, e isso é a correção de 2026-08-03. Esta função devolvia a textura
 * SÍNCRONA (`texLoader.load(url)` sem callbacks), e o material era montado com
 * ela na hora. Uma textura do three nesse estado tem `image === undefined`, e o
 * renderer liga um placeholder 1x1 RGBA(0,0,0,0) no lugar — ou seja, durante
 * todo o download o chão do cenário renderizava PRETO (`map` = 0) e
 * ESPELHADO (`roughnessMap` = 0 ⇒ rugosidade 0). No `distrito-industrial` são
 * 16 arquivos e ~22 MB: cerca de nove segundos de chão preto espelhado a
 * 20 Mbit/s, com a cortina de carregamento JÁ ABAIXADA. Era o "o mapa carrega
 * mas não completamente" — e o espelho era metade do "o chão está reflexivo
 * demais", porque rugosidade zero não é o material, é a ausência dele.
 *
 * Também não havia callback de ERRO: um 404 deixava a textura naquele estado
 * para sempre, sem aviso e sem repetição. Agora resolve `null` e o material
 * simplesmente fica sem aquele mapa, que é degradação visível mas honesta.
 *
 * @param onProgress fração 0..1 desta textura, para a barra da cortina.
 */
function loadTex(url: string, srgb: boolean, repeat: number,
  onProgress?: (f: number) => void): Promise<THREE.Texture | null> {
  const key = url + '|' + (srgb ? 's' : 'l');
  const hit = texCache.get(key);
  if (hit) { if (onProgress) onProgress(1); return Promise.resolve(cloneFor(hit, repeat)); }
  return new Promise((resolve) => {
    texLoader.load(url,
      (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        /* Anisotropia no máximo do device APENAS no albedo: um pátio de asfalto
           é visto em ângulo rasante quase o tempo todo, que é exatamente o caso
           em que a filtragem trilinear vira um borrão cinza a dez metros do
           capô. Nos mapas de rugosidade/normal/AO, 16x é banda de memória
           gasta para nada — o olho não resolve anisotropia num mapa que não é
           cor.
           FICA NA BASE, e é por isso que ela é parte da chave de cache da GL
           (getTextureCacheKey lista anisotropy): clone e base têm de concordar,
           senão o clone abriria um segundo objeto de textura e a economia acima
           não existiria. */
        t.anisotropy = srgb ? renderer.capabilities.getMaxAnisotropy()
          : Math.min(8, renderer.capabilities.getMaxAnisotropy());
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        texCache.set(key, t);
        if (onProgress) onProgress(1);
        resolve(cloneFor(t, repeat));
      },
      (e) => {
        if (onProgress && e && e.lengthComputable && e.total) {
          onProgress(Math.min(1, e.loaded / e.total));
        }
      },
      (err) => {
        console.warn('[set] textura ausente', url, err);
        if (onProgress) onProgress(1);
        resolve(null);
      });
  });
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
/* Famílias de molhagem, inferidas do NOME do material do set.
   ---------------------------------------------------------------------------
   O build do Blender já nomeia o chão pelo que ele é (`ASPHALT_ROAD`,
   `GROUND_CONCRETE`, `GRASS_VERGE`, `GRAVEL_SHOULDER`, `DIRT_WORN`), então a
   inferência acerta os dois cenários que existem sem nenhuma edição de
   manifesto. `surface` em SetMaterialDef existe para o caso em que não acerta —
   quem autora manda, a heurística só preenche a lacuna.

   Ordem IMPORTA: `CONCRETE_APRON` casa com concreto e `ASPHALT_ROAD` com
   asfalto, mas um `ASPHALT_CONCRETE` hipotético tem de ser asfalto — o mais
   específico vem primeiro. */
const SURFACE_BY_NAME: [RegExp, GroundSurface][] = [
  [/asphalt|asfalto/i, 'asphalt'],
  [/gravel|brita|pedrisco/i, 'gravel'],
  [/grass|grama|verge/i, 'grass'],
  [/dirt|terra|earth/i, 'dirt'],
  [/concrete|concreto|kerb|meio.?fio/i, 'concrete'],
];

/** Um material só entra na molhagem se for CHÃO. Uma parede não faz poça. */
const GROUND_NAME_RE = /ground|floor|chao|chão|road|asphalt|asfalto|grass|grama|verge|gravel|brita|dirt|terra|apron|kerb|piso/i;

function surfaceOf(name: string, def: SetMaterialDef): GroundSurface | null {
  if (def.surface && def.surface in WET_SURFACES) return def.surface;
  if (!GROUND_NAME_RE.test(name)) return null;
  for (const [re, kind] of SURFACE_BY_NAME) if (re.test(name)) return kind;
  /* É chão, mas de família desconhecida: concreto é o meio-termo seguro — nem
     o espelho do asfalto molhado, nem a recusa da grama em brilhar. */
  return 'concrete';
}

/** As chaves aceitas em `surface`; espelha WET_PROFILE de scene.ts. */
const WET_SURFACES = {
  asphalt: 1, concrete: 1, gravel: 1, dirt: 1, grass: 1,
} as const;

async function bindMaterials(root: THREE.Object3D, defs: Record<string, SetMaterialDef>,
  onProgress?: (f: number) => void) {
  let bound = 0;
  const ground: GroundMatEntry[] = [];
  const seen = new Set<THREE.Material>();

  /* UM passo: junta o trabalho antes de disparar. Precisamos da CONTAGEM de
     texturas para reportar progresso, e de todas as promessas juntas para saber
     quando o chão está pronto — as duas coisas exigem varrer a árvore primeiro. */
  interface Job { mat: THREE.MeshStandardMaterial; def: SetMaterialDef; rep: number; }
  const jobs: Job[] = [];
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
      jobs.push({ mat, def, rep });
    }
  });

  /* Progresso por ARQUIVO, não por material: um material com quatro mapas pesa
     quatro vezes mais que um com um, que é o que o usuário está esperando. */
  const slots: number[] = [];
  const bump = () => {
    if (!onProgress || !slots.length) return;
    let s = 0;
    for (const v of slots) s += v;
    onProgress(s / slots.length);
  };
  const slot = () => {
    const i = slots.length;
    slots.push(0);
    return (f: number) => { slots[i] = f; bump(); };
  };

  const pending: Promise<void>[] = [];
  for (const { mat, def, rep } of jobs) {
    /* As atribuições acontecem NO CALLBACK, não antes: atribuir uma textura
       ainda vazia é exatamente o bug que esta correção remove. */
    if (def.diffuse) {
      const p = loadTex(assetUrl(def.diffuse), true, rep, slot());
      pending.push(p.then((t) => { if (t) mat.map = t; }));
    }
    if (def.rough) {
      const p = loadTex(assetUrl(def.rough), false, rep, slot());
      pending.push(p.then((t) => { if (t) mat.roughnessMap = t; }));
    }
    if (def.normal) {
      const p = loadTex(assetUrl(def.normal), false, rep, slot());
      pending.push(p.then((t) => { if (t) mat.normalMap = t; }));
    }
    if (def.ao) {
      const p = loadTex(assetUrl(def.ao), false, rep, slot());
      pending.push(p.then((t) => { if (t) mat.aoMap = t; }));
    }
  }

  /* O PONTO DA CORREÇÃO: nada abaixo roda com textura pela metade, e applySet()
     não põe a raiz na cena antes disto voltar. */
  await Promise.all(pending);

  for (const { mat, def, rep } of jobs) {
    {
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

      /* DEPOIS de tudo acima: o que a molhagem fotografa como "seco" é o estado
         já configurado pelo manifesto. Fotografar antes gravaria os padrões do
         three e o cenário perderia o próprio envIntensity na primeira chuva. */
      const surface = surfaceOf(mat.name, def);
      if (surface) {
        ground.push({
          mat,
          surface,
          /* Só a via recebe máscara de poça: água empoça na trilha do pneu, não
             no meio da grama. */
          road: surface === 'asphalt' || surface === 'concrete',
          /* O `repeat` do material É quantos ladrilhos cobrem a superfície, que
             é a unidade em que as calhas da máscara foram autoradas. */
          tile: [rep, rep],
        });
      }
    }
  }
  /* UMA chamada, com o conjunto completo: registerGroundMaterials() substitui o
     registro anterior inteiro, então chamar por material deixaria só o último. */
  registerGroundMaterials(ground);
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

/* Os slots de mapa que um material de set pode carregar. `envMap` está FORA de
   propósito: ele é o reflexo do ambiente, de quem manda na cena (scene.ts /
   environment.ts), e descartá-lo aqui arrancaria o HDRI do cenário inteiro por
   causa de uma malha. Todo o resto é privado desta árvore. */
const MAT_MAPS = [
  'map', 'roughnessMap', 'metalnessMap', 'normalMap', 'aoMap',
  'emissiveMap', 'alphaMap', 'bumpMap', 'displacementMap', 'lightMap',
] as const;

function disposeTree(root: THREE.Object3D) {
  /* Um material aparece em várias malhas e um mapa pode aparecer em vários
     slots; descartar duas vezes é inofensivo no three, mas contar uma vez só
     mantém o custo linear no tamanho do set. */
  const seenMat = new Set<THREE.Material>();
  const seenTex = new Set<THREE.Texture>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const raw of mats) {
      const m = raw as THREE.MeshStandardMaterial | undefined;
      if (!m || seenMat.has(m)) continue;
      seenMat.add(m);
      /* OS MAPAS SÃO DESTA ÁRVORE, e agora são descartados com ela. Duas
         famílias, as duas privadas:
           · os CLONES que loadTex() cunha por material — a base fica em
             texCache, então o que morre aqui é só a contagem de uso do objeto
             de textura da GL. Enquanto outro set vivo usar o mesmo arquivo, o
             three mantém a textura; quando o último clone sai, ela sai junto.
           · as texturas EMBUTIDAS no .glb (fachadas, contêineres, telhado), que
             o GLTFLoader cria novas a cada parse e que ninguém descartava —
             cada troca de cenário vazava o conjunto inteiro delas.
         Antes desta linha o comentário aqui dizia que não descartar era o
         comportamento correto, e era: as texturas ERAM compartilhadas via
         texCache. Deixaram de ser quando o cache passou a servir clones. */
      for (const slot of MAT_MAPS) {
        const t = m[slot] as THREE.Texture | null | undefined;
        if (!t || seenTex.has(t)) continue;
        seenTex.add(t);
        t.dispose();
      }
      m.dispose();
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

/**
 * Solta as texturas BASE e a imagem decodificada de cada uma.
 *
 * `texCache` nunca despeja sozinho, e isso é deliberado: os dois cenários pedem
 * `asphalt_diff` e `concrete_diff`, e uma política de despejo por tamanho jogaria
 * fora justamente o que a próxima troca de cenário vai pedir de volta. O que ele
 * segura, porém, não é pequeno — uma base é a IMAGEM DECODIFICADA, 16 MB de RAM
 * para um 2048² —, então o ponto de liberação é a SAÍDA e não a troca. Quem
 * chama é disposeEnvironments(), armado pelo timer diferido de studio.ts.
 *
 * A VRAM em si já saiu antes daqui: as texturas ligadas a material são clones,
 * descartados por disposeTree() junto com o set. Uma base nunca é ligada a nada,
 * portanto nunca subiu para a GPU, e descartá-la só corta a referência à imagem.
 *
 * O mapa macro é a exceção e SÓ É SEGURO DEPOIS DE disposeSet(): ele vive num
 * uniforme, não num slot de material, então nenhum descarte de material o
 * alcança. disposeEnvironments() chama disposeSet() antes, e é essa ordem que
 * faz isto valer.
 */
export function disposeSetTextures() {
  for (const t of texCache.values()) t.dispose();
  texCache.clear();
  /* O mapa macro sai junto e é ANULADO, não só descartado: getMacroTex() o
     reconstrói na próxima vez que um manifesto pedir variação macro, e deixar a
     referência de pé entregaria uma textura já descartada ao onBeforeCompile do
     próximo set. São 256², mas o bug seria um chão sem albedo. */
  macroTex?.dispose();
  macroTex = null;
}

/**
 * Carrega e aplica um set. Idempotente por URL: reaplicar o mesmo cenário não
 * rebaixa nada.
 *
 * SÓ RESOLVE COM O CENÁRIO INTEIRO PRONTO — geometria na cena E todas as
 * texturas de chão decodificadas. Antes de 2026-08-03 ela resolvia assim que o
 * .glb chegava e deixava ~22 MB de mapas baixando por trás; quem esperava por
 * ela (applyEnvironment → a cortina) baixava a cortina sobre um chão preto.
 *
 * @param onProgress fração 0..1 do conjunto glb + texturas.
 * @returns true se há um set na cena ao final (inclusive por já estar lá).
 */
export async function applySet(def: SetDef | null | undefined,
  onProgress?: (f: number) => void): Promise<boolean> {
  const url = def && typeof def.url === 'string' ? assetUrl(def.url) : null;
  if (!url) {
    disposeSet();
    if (onProgress) onProgress(1);
    return false;
  }
  if (url === currentUrl) { if (onProgress) onProgress(1); return true; }

  /* Repartição do orçamento de progresso entre as duas fases. O .glb é 7,0 MB
     no distrito e 3,5 MB no armazém; as texturas somam 22 MB e 4,7 MB. Dois
     terços para as texturas é a média honesta dos dois, e errar aqui só faz a
     barra andar irregular — nunca voltar, porque as fases são sequenciais. */
  const P_GLB = 0.34;
  const step = (base: number, span: number) => (f: number) => {
    if (onProgress) onProgress(base + Math.max(0, Math.min(1, f)) * span);
  };

  const token = ++loading;
  let root: THREE.Group;
  try {
    root = await loadGLB(url, step(0, P_GLB));
  } catch (err) {
    console.warn('[set] falhou ao carregar', url, err);
    if (onProgress) onProgress(1);
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

  const bound = def!.materials
    ? await bindMaterials(root, def!.materials, step(P_GLB, 1 - P_GLB))
    : 0;
  if (onProgress) onProgress(1);
  /* Segunda checagem: as texturas levam segundos, e o usuário pode ter trocado
     de cenário DURANTE elas. Sem isto o set velho entraria na cena por cima do
     novo — a corrida que o token da primeira checagem só cobria até o .glb. */
  if (token !== loading) {
    disposeTree(root);
    return currentUrl !== null;
  }
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
