/* Preparo de MATERIAL e de SOMBRA de uma malha recém-carregada.
   ---------------------------------------------------------------------------
   Extraído de vehicle/models.ts em 2026-08-09, sem uma linha de mudança de
   comportamento. O motivo é o pipeline OFFLINE de renders de card
   (`tools/studio-render/`): ele monta a própria cena — não pode importar
   models.ts, que arrasta `scene/scene.ts` e com ele a construção de um
   WebGLRenderer no tempo de import — mas TEM de preparar a cabine exatamente
   como o app a prepara, ou o card deixa de prometer o que a cena entrega.

   A alternativa era copiar estas 200 linhas para o pipeline. Uma cópia é uma
   segunda definição de "o que é uma tinta neste .glb" e de "quem projeta
   sombra", mantida por quem mexer no app e esquecida por quem mexer no
   render — e o sintoma seria um card sutilmente diferente da cena, que é
   justamente o defeito que os renders pré-produzidos existem para não ter.

   Este módulo é FOLHA de propósito: importa só o three e `core/dom`. Qualquer
   coisa que precise da cena, do catálogo ou do engate fica em models.ts.

   models.ts reexporta o que já exportava daqui, então nada que o importava
   precisou mudar. */
import * as THREE from 'three';
import { registerVehicleLights } from './lights';
import { registerRetroreflective } from './retroreflect';
/* Folha, e por isso importável de qualquer lugar sem risco de ciclo — ver o
   cabeçalho de `core/quality.ts`. */
import { getProfile } from '../core/quality';

/* ---------------- material / mesh setup ---------------- */
const GLASS_RE = /glass|vidro|windshield|window|winscreen|cristal|glazing/i;

/* ---------------- QUEM ACEITA TINTA, e por que não é mais só o nome --------
   `nome.includes('carpaint')` era uma verdade sobre TRÊS geometrias curadas —
   as de `models/vehicles/`, cujo bake RENOMEIA o corpo para `carpaint` porque
   ali o nome do material é FUNCIONAL (ver o cabeçalho de tools/iveco-bake).
   As 49 cabines de `models/trucks/` nunca passaram por esse renomeio: são rips
   SCS/ETS2 no padrão `<peça>_mat_<NNNN>_<textura-fonte>`, e a chapa pintável se
   chama `plain_grey`, `color` ou `carpaint*` conforme o ano do modelo.

   MEDIDO nos 49 arquivos: pelo nome, 26 deles não têm UM material de tinta —
   escolher uma cor não muda absolutamente nada — e entre os 23 restantes o
   casamento às vezes pega só a capa do retrovisor (DAF XF Euro6) ou só a saia
   lateral (Iveco Hi-Way).

   ENTÃO A PERGUNTA MUDA DE "COMO SE CHAMA" PARA "QUE SHADER É". Toda tinta de
   caminhão da SCS sai do exportador com a mesma assinatura, e ela sobrevive ao
   renomeio de qualquer pipeline: KHR_materials_clearcoat com fator 1, roughness
   0,089 e metalness 0,15 ou 0,55. Conferido contra os 49 arquivos: acerta 100%
   dos materiais que hoje casam por `carpaint` e encontra o equivalente exato
   nos 26 que não casavam nada.

   O nome CONTINUA valendo, em OU — este teste é um SUPERCONJUNTO do anterior,
   de propósito. Nada que pinta hoje deixa de pintar; o que era invisível passa
   a ser alcançado. Vidro fica de fora explicitamente: ele também pode sair com
   clearcoat, e pintar a janela seria pior que não pintar a lataria. */
/* OS NOMES DE CHAPA PINTÁVEL DA SCS — os três que o comentário acima já
   nomeia, e não mais só `carpaint`.
   ---------------------------------------------------------------------------
   `plain_grey` entrou em 2026-08-09, e o sintoma que o trouxe foi um Scania
   S 2024 elétrico com a grade LARANJA em todas as cores do catálogo.

   A causa não é o logo: são materiais `plain_grey` que a rip assou com a cor do
   caminhão de ORIGEM (um Scania laranja) no `baseColorFactor`, e que NÃO
   carregam a assinatura de shader que `looksLikeTruckPaint()` procura — vêm sem
   clearcoat, com roughness 0,27 a 0,32 e metalness 0. Ou seja: são chapa
   pintada, mas foscas, então o teste por shader não as alcança e elas guardam o
   laranja para sempre.

   MEDIDO nos 50 .glb: 21 materiais em 8 arquivos — as sete Scania R/S 2016 e a
   S 2024e. São todos peça EXTERNA (`f_fender`, `s_panel`, `tank`, `doorstep`,
   `chassis`, `f_light_mid`), ou seja exatamente o que numa carroceria de
   verdade sai na cor do caminhão. Os outros 47 materiais com cor assada que a
   detecção não alcança são INTERIOR (couro, carpete, plástico) e continuam de
   fora, porque nenhum deles se chama `plain_grey`.

   `_color` no fim do nome NÃO entra. O comentário acima o cita como o terceiro
   apelido, mas medido não sobra nenhum caso: os `*_color` desta frota todos já
   casam pela assinatura de shader, e a regra pegaria junto `carpaint_net_color`
   e `flake_color` de outros bakes. Uma regra que não resolve nada e amplia o
   alcance é só risco. */
const PAINT_NAME_RE = /carpaint|plain_grey/;

const PAINT_ROUGHNESS = 0.089;
const PAINT_METALNESS = [0.15, 0.55];
const PAINT_TOL = 0.02;

/** A assinatura do shader de tinta da SCS, independente de como o bake nomeou. */
function looksLikeTruckPaint(m: THREE.Material): boolean {
  const p = m as THREE.MeshPhysicalMaterial;
  /* `clearcoat` só existe em MeshPhysicalMaterial — o GLTFLoader promove o
     material a Physical justamente quando a extensão está presente, então esta
     checagem é a leitura do KHR_materials_clearcoat depois do parse. */
  if (typeof p.clearcoat !== 'number' || p.clearcoat < 0.9) return false;
  if (Math.abs((p.roughness ?? 1) - PAINT_ROUGHNESS) > PAINT_TOL) return false;
  return PAINT_METALNESS.some((v) => Math.abs((p.metalness ?? 0) - v) <= PAINT_TOL);
}

/**
 * Este material recebe a tinta do configurador?
 *
 * `authored` (de `paintMaterials`, no brands.json) é EXCLUSIVO quando existe:
 * uma lista escrita à mão é a medição daquele bake específico e não pode ser
 * sobreposta por convenção nenhuma. E `[]` é uma declaração legítima — "esta
 * geometria não tem lataria pintável" —, não um pedido de padrão; por isso o
 * teste é a presença da lista, não o seu tamanho.
 */
export function isPaintableMaterial(
  m: THREE.Material | null | undefined, authored?: string[] | null,
): boolean {
  if (!m) return false;
  const name = (m.name || '').toLowerCase();
  if (GLASS_RE.test(name)) return false;
  if (authored) return authored.some((s) => name.includes(s.toLowerCase()));
  if (PAINT_NAME_RE.test(name)) return true;
  return looksLikeTruckPaint(m);
}

/** Todo nome de material sob uma raiz — o que um diagnóstico precisa para
 *  dizer, no console, como ESTE bake chama as coisas. */
export function materialNamesOf(root: THREE.Object3D): string[] {
  const out = new Set<string>();
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.material) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (m) out.add(m.name || '(sem nome)');
    }
  });
  return [...out].sort();
}

/* ANISOTROPY ON EVERY SLOT, not only on the albedo.
   ---------------------------------------------------------------------------
   The flanks of a tractor-trailer are what the camera spends its whole orbit
   looking at edge-on, and a grazing angle is the one case where trilinear
   filtering collapses: the mip level chosen for the axis that is compressed in
   screen space blurs the axis that is not, along with it. `map` was already at
   8, so the ALBEDO stayed sharp down the length of the truck — but normalMap,
   roughnessMap and metalnessMap kept the default of 1, and those are the maps
   that carry the micro-detail the specular lobe is built from. The panel grain,
   the scuffing, the brushed direction on the rails: all of it smeared into a
   flat wash a few metres out while the paint under it stayed crisp.

   That is a LIGHTING difference, not a texture nicety, and it is a quality gain
   rather than an optimisation — it costs sampler bandwidth and nothing else.
   No `needsUpdate` is needed: this runs before the first render, so the textures
   have not been uploaded yet and the value is read at upload time. three clamps
   it to the device's own maximum there too, so 8 is a ceiling, never a demand.

   ---------------------------------------------------------------------------
   PASSOU A SER LIDO DO PERFIL (2026-08-13), e continua valendo 8 no nível Alto —
   ou seja, nada mudou para quem aguenta. FUNÇÃO e não mais constante porque o
   nível pode mudar no meio da sessão, e um valor congelado no tempo de import
   entregaria a anisotropia do nível em que a página abriu para sempre.

   Ela é lida no momento em que cada textura é preparada, então o valor novo
   vale para o que CARREGAR depois — trocar de caminhão ou de cenário. As
   texturas já na GPU ficam como estão, de propósito: reamostrá-las exigiria um
   reupload de ~200 texturas no meio de um arrasto, que é exatamente o engasgo
   que a adaptação existe para evitar. */
export const textureAnisotropy = () => getProfile().anisotropyVehicle;

/* SHADOW CASTERS ARE CHOSEN BY SIZE — and here is the arithmetic, so the number
   below survives the next person who reads it.
   ---------------------------------------------------------------------------
   The key light is a 3072² shadow map over a ±24 m ortho frustum (scene/scene.ts
   spells out why those two numbers are what they are): 3072 / 48 = 64 texels per
   metre, i.e. 1.56 cm per texel. It renders through PCFSoftShadowMap with
   `shadow.radius` running 2–12, so even at the TIGHTEST rig setting the filter
   kernel spans roughly five texels — about 7.8 cm — and every sample it averages
   is a sample of mostly-not-this-object.

   An occluder whose world diameter is smaller than that kernel therefore cannot
   put a visible shadow anywhere: whatever depth it writes is diluted below the
   quantisation of the filtered result before it can reach a pixel. Drawing it
   into the shadow map is pure cost with a provably empty output.

   MEASURED on trailer.glb by walking its node hierarchy and applying each node's
   world transform to its POSITION accessor bounds — 5852 nodes, 2151 of them
   carrying a mesh, 2157 three.js Mesh objects once multi-primitive meshes are
   split, 5.31 M triangles in total. At least 640 of those meshes come out under
   5 cm across, carrying 788 k triangles — 29.7 % of the meshes and 14.8 % of the
   triangles — and 483 of the 640 are literally named
   `stitch_result_stitch_all_parafusos_*`. "At least", because that measurement
   uses the diagonal of each primitive's local box as the sphere diameter, which
   is an UPPER bound on the radius `computeBoundingSphere()` actually derives
   from the vertices; the runtime figure can only be higher.

   So this removes ~640+ draw calls and ~0.79 M triangles from every shadow pass.
   "Every pass" is not "every frame" here: the renderer runs with
   `shadowMap.autoUpdate = false`, so it means every load, every scenario change,
   and every frame of a time-of-day drag — which is exactly where the frame time
   is already worst.

   5 cm sits below the 7.8 cm kernel with margin, so the cut is invisible by
   construction and not merely by inspection. `receiveShadow` stays TRUE on
   everything: a bolt is far too small to cast a shadow and exactly the right
   size to be sitting in the truck's. */
const SHADOW_CASTER_MIN_M = 0.05;

const _casterSphere = new THREE.Sphere();

/**
 * Decide quem projeta sombra, pelo tamanho em ESPAÇO DE MUNDO.
 *
 * A medida tem de ser em MUNDO, nunca na geometria local, e não é teoria: a
 * Scania chega do FBXLoader nas unidades da rip e é reescalada por ~1/100 na
 * raiz (ver loadScaniaOriginal), e o próprio implemento traz nós com escala de
 * maior eixo indo de 0,0012 a 1,0022 — três ordens de grandeza dentro do mesmo
 * arquivo. Um diâmetro local aqui não erraria por pouco: ele diria que um
 * parafuso tem metros.
 */
export function setShadowCasters(root: THREE.Object3D) {
  /* setupCommon() roda ANTES de a raiz entrar no grupo dela, e os carregadores
     deixam `matrixWorld` por escrever (o GLTFLoader compõe `matrix` e para por
     aí). Sem esta linha toda esfera abaixo voltaria medida pela identidade.
     Solta do grafo, "mundo" é o espaço da própria raiz — que é onde a escala da
     raiz vive, e é essa a escala que importa. */
  root.updateMatrixWorld(true);
  /* O computeBoundingSphere() abaixo não é trabalho NOVO: o three já o faria,
     preguiçosamente, na primeira vez que o frustum testasse cada malha — ou
     seja, no primeiro quadro. Fazê-lo aqui só o move para dentro da cortina de
     carregamento, onde ninguém está olhando o contador de quadros. E ele lê o
     atributo de posição, não o índice, então continua correto depois de
     buildLiveryPanels() reescrever índices (os vértices ficam onde estão). */
  let cast = 0, skip = 0;
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    o.receiveShadow = true;
    const g = o.geometry;
    if (!g) { o.castShadow = false; return; }
    if (!g.boundingSphere) g.computeBoundingSphere();
    const bs = g.boundingSphere;
    /* Geometria degenerada ou com NaN: continua projetando. A falha barata é uma
       chamada de desenho desperdiçada; a cara é uma sombra que sumiu. */
    if (!bs || !Number.isFinite(bs.radius)) { o.castShadow = true; cast++; return; }
    /* Sphere.applyMatrix4 escala o raio pelo maior fator de escala da matriz —
       é a conversão para mundo que interessa aqui. */
    const diameter = _casterSphere.copy(bs).applyMatrix4(o.matrixWorld).radius * 2;
    o.castShadow = diameter >= SHADOW_CASTER_MIN_M;
    if (o.castShadow) cast++; else skip++;
  });
  if (skip) {
    console.info('[sombra] emissores:', cast, '· descartados', skip,
      `(< ${SHADOW_CASTER_MIN_M * 100} cm — abaixo do filtro PCF de ~7,8 cm)`);
  }
}

/**
 * A MESMA TEXTURA, SÓ QUE BRANCA — o recorte sem o desenho.
 *
 * Um material de tinta às vezes PRECISA do mapa de origem, e não pela cor: as
 * tomadas de ar do S-Way são chapas retangulares em que o alfa da textura
 * vaza a colmeia (`*_colmeia`, `alphaTest 0.5`). Derrubar o mapa dessas
 * transformaria a grade numa chapa lisa; mantê-lo inteiro pinta a colmeia com
 * o desenho que estiver assado ali — no bake do Metallica, a película, que
 * reaparecia em amarelo na grade de um caminhão branco.
 *
 * Então o mapa sobrevive como MÁSCARA: RGB branco, alfa intacto. O canal que a
 * geometria precisa é preservado byte a byte e o que a tinta tem a dizer volta
 * a ser só da tinta.
 *
 * Devolve `null` quando a imagem ainda não decodificou ou o canvas 2D não está
 * disponível — o chamador cai no mapa original, que é o comportamento de antes
 * desta função e nunca é pior que não desenhar nada.
 */
export function maskOnly(tex: THREE.Texture | null | undefined): THREE.Texture | null {
  const img = tex?.image as (HTMLImageElement | ImageBitmap | undefined);
  const w = (img as ImageBitmap)?.width, h = (img as ImageBitmap)?.height;
  if (!tex || !img || !w || !h) return null;
  let canvas: HTMLCanvasElement;
  try {
    canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return null;
    ctx.drawImage(img as CanvasImageSource, 0, 0);
    const px = ctx.getImageData(0, 0, w, h);
    const d = px.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; }
    ctx.putImageData(px, 0, 0);
  } catch {
    return null;                      // canvas contaminado / sem DOM: mapa original
  }
  const out = new THREE.CanvasTexture(canvas);
  /* A amostragem tem de continuar idêntica, senão o recorte muda de forma: são
     as mesmas UVs, a mesma repetição e o mesmo espaço de cor da origem. */
  out.name = (tex.name || 'mask') + '__mascara';
  out.wrapS = tex.wrapS; out.wrapT = tex.wrapT;
  out.repeat.copy(tex.repeat); out.offset.copy(tex.offset);
  out.center.copy(tex.center); out.rotation = tex.rotation;
  out.flipY = tex.flipY;
  out.colorSpace = tex.colorSpace;
  out.anisotropy = tex.anisotropy;
  out.needsUpdate = true;
  return out;
}

export function setupCommon(root: THREE.Object3D) {
  setShadowCasters(root);
  /* AS LUZES, e é aqui porque é aqui que TODA raiz de veículo passa — cavalo,
     implemento, Thermo King e roda avulsa. Ver vehicle/lights.ts: o registro
     também as deixa APAGADAS, que corrige as lanternas brilhando ao meio-dia em
     todos os 49 bakes. */
  registerVehicleLights(root);
  /* E as FITAS REFLETIVAS, pelo mesmo motivo de estar aqui: é o ponto por onde
     toda raiz passa. Ver vehicle/retroreflect.ts — a fita não emite, ela devolve
     a luz na direção de onde ela veio, e sem fonte continua apagada. */
  registerRetroreflective(root);
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const raw of mats) {
      if (!raw) continue;
      /* The GLBs and the FBX rip both arrive as MeshStandard/MeshPhysical, so
         the PBR slots below always exist; `Material` is just the widest type
         `Mesh.material` can be declared as. */
      const m = raw as THREE.MeshStandardMaterial;
      m.envMapIntensity = 1.35;
      for (const tex of [m.map, m.normalMap, m.roughnessMap, m.metalnessMap]) {
        if (tex) tex.anisotropy = textureAnisotropy();
      }
      const isGlass = GLASS_RE.test(m.name || '');
      if (isGlass) {
        m.transparent = true;
        m.depthWrite = false;
        m.roughness = Math.min(m.roughness ?? 1, 0.12);
        o.renderOrder = Math.max(o.renderOrder, 20);   // glass last, over the body
      } else if (m.transparent) {
        if ((m.opacity ?? 1) >= 0.99 && !m.alphaMap) {
          // Body panels / decals wrongly flagged transparent: keep texture alpha
          // (alphaTest) but WRITE depth — depthWrite=false here is what made the
          // cab look foggy/blurred (interior blending through the shell).
          m.depthWrite = true;
          m.alphaTest = Math.max(m.alphaTest || 0, 0.02);
        } else {
          m.depthWrite = false;
          /* A genuinely see-through surface that does NOT write depth has to be
             drawn after everything it covers, and GLASS_RE alone does not find
             them all: the trailer's rear lamp cover is `lente-sinaleita-traseira`
             — no "glass"/"vidro" in the name — so it kept renderOrder 0 while the
             marker-lamp cover beside it (`vidro-lanternas-pisca`) got 20. Two
             covers on the same lamp cluster, sorted into different passes, is
             what made the rear lamps flicker between angles. The rule that
             matters is the one about DEPTH, not about the word in the name: no
             depth write ⇒ draw last. */
          o.renderOrder = Math.max(o.renderOrder, 20);
        }
      }
    }
  });
}
