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

/* NEM TODO `plain_grey` É LATARIA — 2026-08-17.
   ---------------------------------------------------------------------------
   O bloco acima acertou o diagnóstico (cor de origem assada no
   `baseColorFactor`) e errou o remédio para uma parte da lista. Relato: *"a cor
   do cavalo é aplicada ao Scania na frontal"*.

   MEDIDO o `baseColorFactor` de todos os `plain_grey` da frota, que é o que
   separa os dois grupos de verdade:

     LATARIA — laranja assado, e a tinta por cima é o conserto certo:
       · `f_fender_mat_0002`  (0.315, 0.182, 0.022)   R/S 2016
       · `s_panel_mat_0002`   (0.234, 0.135, 0.017)   R/S 2016
       · `r_bumper_mat_0008`  (0.315, 0.182, 0.022)   R/S 2016
       · `cabin_mat_0001`     neutro, e é A cabine

     NÃO É LATARIA — pintar põe a cor do cavalo onde ela nunca vai:
       · `chassis_mat_0011`     (0.526, 0.304, 0.037)  longarina
       · `chassis_mat_0012`     (0.290, 0.053, 0.007)  longarina
       · `f_light_mid_mat_0006` (0.215, 0.039, 0.005)  FAROL — o relato
       · `doorstep_mat_0000`    (0.358, 0.362, 0.358)  já neutro, degrau

   As duas saídas óbvias estão erradas: pintar leva a cor do cavalo para a
   frente, e simplesmente não pintar devolve o laranja de origem que a regra de
   09/08 existia para matar. O certo é o terceiro caminho — tirar da tinta E
   DESSATURAR a cor assada (`neutralizeBakedChroma()`), que é o que essas peças
   são num caminhão de verdade: cinza/preto, não laranja e não da cor da cabine.

   `carpaint` no nome AFIRMA ser tinta; `plain_grey` é só o nome da TEXTURA que
   dezenas de peças compartilham. Por isso o filtro cai sobre o segundo. Medido:
   nenhum material da frota casa `carpaint` e esta lista ao mesmo tempo, então
   aplicá-lo aos dois é inócuo hoje e mais seguro amanhã. */
const NEVER_BODY_RE = /chassis|f_light|r_light|light_|lamp|doorstep/;

/**
 * Peça estrutural com a cor do caminhão de ORIGEM assada no `baseColorFactor`:
 * troca o croma por cinza de mesma luminância. Sem isto, tirar a peça da tinta
 * (ver `NEVER_BODY_RE`) faria voltar a grade laranja de 2026-08-09.
 *
 * Só mexe em quem casa os dois filtros e ainda tem croma — é idempotente, e um
 * material já neutro sai intacto.
 */
export function neutralizeBakedChroma(m: THREE.Material | null | undefined): boolean {
  if (!m) return false;
  const name = (m.name || '').toLowerCase();
  if (!PAINT_NAME_RE.test(name) || !NEVER_BODY_RE.test(name)) return false;
  const col = (m as THREE.MeshStandardMaterial).color;
  if (!col) return false;
  const hsl = { h: 0, s: 0, l: 0 };
  col.getHSL(hsl);
  if (hsl.s <= 0.25) return false;
  col.setHSL(0, 0, hsl.l);
  m.needsUpdate = true;
  return true;
}

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
  /* O denylist vale SÓ para o atalho por nome. A assinatura de shader abaixo é
     medição do bake, não convenção de nomenclatura: se o artista deu clearcoat
     de tinta à peça, ela é tinta e o nome não desmente. */
  if (PAINT_NAME_RE.test(name)) return !NEVER_BODY_RE.test(name);
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
   size to be sitting in the truck's.

   ---------------------------------------------------------------------------
   PASSOU A SER LIDO DO PERFIL (2026-08-15), e o valor acima continua sendo o do
   nível ALTO — ou seja, nada mudou para quem aguenta.

   A aritmética inteira acima continua valendo: 5 cm é o corte INVISÍVEL, o que
   o núcleo do PCF prova estar abaixo do que ele consegue mostrar. Os níveis
   Média (10 cm) e Baixa (20 cm) cortam ACIMA disso, e aí a honestidade obriga a
   dizer o que está sendo trocado: a partir de 7,8 cm o corte deixa de ser
   demonstravelmente invisível e passa a ser uma degradação escolhida — a mesma
   classe de decisão que `vehicle/lod.ts` documenta para o `lodMinPx`, e pelo
   mesmo tipo de razão (a máquina não dá conta). A direção do erro continua
   segura: `tsWorldDiameter` é COTA SUPERIOR (ver o bloco A MEDIDA FICA
   GUARDADA), então quem corta por ele corta de MENOS, nunca de mais.

   FUNÇÃO e não mais constante porque o nível muda no meio da sessão, e um valor
   congelado no tempo de import entregaria para sempre o corte do nível em que a
   página abriu — a mesma lição de `textureAnisotropy()` logo acima.

   ⚠️ `shadowCasterMinM` é declarado por `core/quality.ts`. Enquanto ele não
   existir, a rede devolve o 0,05 de sempre e este arquivo se comporta como
   antes desta mudança, linha por linha. */
const SHADOW_CASTER_MIN_M = 0.05;

interface PerfilDeSombra { shadowCasterMinM?: number }
const shadowCasterMin = () => {
  const v = (getProfile() as unknown as PerfilDeSombra).shadowCasterMinM;
  return typeof v === 'number' && v > 0 ? v : SHADOW_CASTER_MIN_M;
};

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
  const minM = shadowCasterMin();
  let cast = 0, skip = 0, baldes = 0;
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    o.receiveShadow = true;
    /* ---------------- O BALDE DECIDE PELA BANDA, NÃO PELO TAMANHO ----------
       `vehicle/merge.ts` funde as malhas por material E POR FAIXA DE TAMANHO
       justamente para que este corte continue valendo depois da fusão. Uma
       malha fundida tem o diâmetro do IMPLEMENTO — medi-la aqui responderia
       "projeta" para todo mundo e acenderia a sombra dos 483 parafusos que o
       bloco acima acabou de provar que ninguém vê.

       O que ela carrega é a borda INFERIOR da faixa dos membros, em
       `userData.tsMergeBand`, e é ela que entra na comparação. Como as bordas
       das faixas são exatamente os valores que `shadowCasterMinM` pode assumir,
       trocar de nível liga e desliga baldes inteiros sem refundir nada.

       ⚠️ O CONTRATO É POR `userData` DE PROPÓSITO. Este arquivo é FOLHA — o
       pipeline offline de renders (`tools/studio-render/`) e a bancada o
       importam para não arrastar `scene/scene.ts` junto —, então ele não pode
       importar `vehicle/merge.ts`, que precisa da cena. Um campo em `userData`
       atravessa a fronteira sem criar a dependência. */
    const banda = o.userData.tsMergeBand;
    if (typeof banda === 'number') {
      o.castShadow = banda >= minM;
      baldes++;
      if (o.castShadow) cast++; else skip++;
      return;
    }
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
    /* ---------------- A MEDIDA FICA GUARDADA (2026-08-14) ----------------
       Uma linha, e ela é o que torna o LOD por tamanho em tela (`vehicle/lod.ts`)
       gratuito: este laço já percorre as 2 157 malhas do implemento com as
       matrizes de mundo válidas e já paga o `computeBoundingSphere()`. Sem esta
       atribuição o número era calculado, usado na linha seguinte e jogado fora,
       e quem quisesse o mesmo diâmetro teria de repetir a varredura inteira —
       inclusive o `updateMatrixWorld(true)` acima, que é o caro.

       ⚠️ **É UMA COTA SUPERIOR, e o consumidor tem de saber disso.** O número é
       `boundingSphere.radius * 2` levado para mundo por `Sphere.applyMatrix4`,
       que escala o raio pelo MAIOR fator de escala da matriz. Ou seja: numa
       matriz com escala não uniforme ele superestima o eixo menor, e a esfera
       envolvente já é, por definição, maior que a caixa que os vértices ocupam
       (uma chapa de 1 m x 1 cm tem esfera de ~1 m de diâmetro). O mesmo aviso
       que o bloco SHADOW CASTERS ARE CHOSEN BY SIZE dá para a medida offline
       vale aqui: o valor RUNTIME nunca é menor que o real, então quem corta por
       ele corta de MENOS — nunca de mais. Para um corte de qualidade (esconder)
       essa é a direção segura do erro.

       ⚠️ E ELE ENVELHECE COM QUEM REESCALA. Quem mexer na escala de um nó depois
       daqui — `trailer-assembly.ts` ao redimensionar o baú é o caso real — tem de
       chamar `setShadowCasters()` de novo, e não por causa deste campo: o
       `castShadow` da linha abaixo ficaria igualmente errado. Ou seja, não há um
       dever novo; há um segundo consumidor do dever que já existia. */
    o.userData.tsWorldDiameter = diameter;
    o.castShadow = diameter >= minM;
    if (o.castShadow) cast++; else skip++;
  });
  if (skip) {
    console.info('[sombra] emissores:', cast, '· descartados', skip,
      `(< ${(minM * 100).toFixed(0)} cm)`,
      baldes ? `· ${baldes} baldes decididos pela banda` : '');
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
          /* ---------------------------------------------------------------
             ⚠️ E `m.transparent` CONTINUA `true` DE PROPÓSITO — a tentação de
             virá-lo para `false` foi medida e recusada em 2026-08-16.
             ---------------------------------------------------------------
             O CANDIDATO. Um material marcado transparente que não é transparente
             é o clássico "falso transparente": ele cai na lista TRANSPARENTE do
             three, que é ordenada de trás para frente por profundidade
             (`reversePainterSortStable`, three.module.js:7522) e portanto NÃO
             agrupa por material — ao contrário da lista opaca, que ordena por
             `material.id` (`painterSortStable`, :7506). Menos agrupamento é mais
             troca de programa; e mistura ligada é mais banda de ROP. Virar
             `transparent` para `false` devolveria as duas coisas.

             ⚠️ E O EFEITO É REAL NO PROGRAMA, o que corrige uma afirmação em
             sentido contrário registrada em `vehicle/headlight-cover.ts`: a
             chave de cache de programa do three **inclui** `transparent`, só
             que por um apelido. `getParameters()` publica
             `opaque = material.transparent === false && blending === Normal &&
             !alphaToCoverage`, e `getProgramCacheKeyBooleans()` acende o bit 17
             da segunda máscara com ele (three.module.js:7335). Ou seja: ligar e
             desligar `transparent` num material é recompilar aquele material.

             A MEDIÇÃO QUE DERRUBOU A IDEIA — os 55 .glb de veículo do acervo,
             lidos direto do chunk JSON (materiais glTF, alphaMode e alfa base):

                 3 118 materiais · 5 241 primitivas
                 alphaMode BLEND            385 materiais / 405 primitivas
                 destes, alfa base >= 0,99  197 materiais / 197 primitivas
                   · COM baseColorTexture   197
                   · SEM fonte de alfa        0

             Duas leituras, e cada uma sozinha já fecha a questão:

             1. **NENHUM dos 197 é um falso transparente COMPROVADO.** Todos têm
                `baseColorTexture`, ou seja o alfa pode estar na textura — que é
                precisamente o motivo de este ramo preservar o recorte por
                `alphaTest` em vez de descartá-lo. Provar o contrário exigiria
                ler os pixels de cada mapa, e um erro nessa leitura apaga um
                decalque (os dois piores casos nominais são
                `t_king_slx_mat_0002_decals_2` e `..._tk_logo_3`, do Thermo King,
                onde o alfa é o desenho);
             2. **a população é irrelevante no quadro.** Na cena de referência
                (Scania R 2009 4x2 + implemento + distrito) são **5 materiais /
                5 primitivas** — 3 do volante, 2 do Thermo King — contra 552
                chamadas de desenho pós-fusão. Menos de 1 %. E o implemento
                inteiro não tem nenhum: os únicos 2 materiais BLEND do
                `trailer.glb` são `lente-sinaleita-traseira` e
                `vidro-lanternas-pisca`, com alfa base 0,06 — transparentes de
                verdade, e é o ramo de baixo que cuida deles.

             Trabalho com risco de apagar decalque, por menos de 1 % das
             chamadas. Não entra.

             ⚠️ O QUE ESTA LINHA CUSTA, dito por inteiro, para quem for medir
             depois: `alphaTest > 0` num material que tem `map` faz
             `WebGLShadowMap.getDepthMaterial()` alocar um material de
             profundidade EXCLUSIVO para ele (a condição literal é
             `material.map && material.alphaTest > 0`), em vez de reusar o
             `_depthMaterial` compartilhado. São 5 materiais de profundidade e 5
             programas a mais no passe de sombra da cena de referência — o preço
             de o recorte da textura continuar valendo na sombra, que é o
             comportamento certo. */
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
