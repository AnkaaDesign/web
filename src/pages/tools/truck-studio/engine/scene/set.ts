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
import { scene, renderer, registerGroundMaterials, setCameraObstacles } from './scene';
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
  /** `break` = quanto quebrar a periodicidade do PRÓPRIO mapa (0 a 1). Só faz
   *  sentido em texturas com feição reconhecível — grama, concreto, brita. O
   *  asfalto não precisa e cada material que o liga paga uma leitura extra. */
  macro?: { scale: number; amount: number; break?: number };
  /** multiplicadores LINEARES escritos em material.color (mesma semântica de nearGround.tintRgb) */
  tintRgb?: [number, number, number];
  roughness?: number;
  /**
   * Piso de rugosidade, 0 a 1, aplicado DEPOIS do mapa: `r = mix(r, 1, floor)`.
   *
   * EXISTE PORQUE `roughness` NÃO É O QUE PARECE. Ela é um MULTIPLICADOR do
   * roughnessMap, então `roughness: 1` lê-se como "totalmente fosco" e significa
   * apenas "não mexas no mapa". Medido nos mapas que este cenário usa:
   *
   *     asfalto   mapa 0,933  x 0,94  ->  0,877
   *     concreto  mapa 0,514  x 1,00  ->  0,514   <-
   *     grama     mapa 0,686  x 0,93  ->  0,638
   *
   * A laje estava a correr com METADE da rugosidade do asfalto ao lado — 0,51 é
   * semi-brilhante — e foi isso o "o pátio reflete muita luz". Nenhum ajuste de
   * `envIntensity` chega lá: essa só escala o AMBIENTE, e o que produz o lençol
   * de luz numa superfície de 180 m é o lobo especular do SOL, que é luz direta.
   *
   * Um multiplicador também não serve: multiplicar 0,51 por qualquer coisa ≤ 1
   * só desce mais. O que falta é um PISO, e é isto. Com 0,82 o concreto sai a
   * 0,91 e conserva a variação do mapa, comprimida.
   */
  roughnessFloor?: number;
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
  /** afasta da rua, no carregamento, as malhas mais altas que `minHeight` */
  pushback?: { minHeight: number; distance: number; from?: number };
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

/* TRÊS OITAVAS, E ELAS EXISTEM PORQUE A MALHA DEIXOU DE AS CARREGAR.

   A variação do chão vinha quase toda do COLOR_0, assado por vértice no build.
   Um A/B de três renders mostrou que era ele — e não o ladrilho — a produzir os
   "vários quadrados seguidos": com o COLOR_0 branco as manchas desaparecem, com
   o ladrilho esticado 40× elas ficam. A causa é reconstrução, não ruído: a pista
   tem célula de 7,9 m e carregava uma oitava de 22 m, isto é 2,8 amostras por
   período, e interpolar linearmente a essa taxa devolve um mosaico de
   quadriláteros. O build passou a limitar o COLOR_0 a cinco amostras por
   período, o que o reduz à mancha LARGA e deixa um buraco no meio e no fino.

   Este é o buraco. O fragmento não tem malha, logo não tem célula: pode carregar
   qualquer frequência. As três leituras ficam em ~70 m, ~16 m e ~4,5 m de mundo.

   OS MULTIPLICADORES SÃO 4,3 e 15,5 e não são redondos de propósito. Períodos em
   razão inteira voltam a coincidir depressa e o olho encontra o batimento; em
   razão irracional só coincidem muito além do sítio. Girar importa tanto quanto
   escalar — dois campos com o mesmo eixo somam-se num terceiro com o mesmo eixo,
   e é o eixo comum que se lê como grelha.

   O CONTRASTE É REPOSTO porque a média de três amostras independentes tem 0,59
   do desvio de uma. Sem repor, trocar uma oitava por três TIRA variação em vez de
   acrescentar. A reposição é uma curva suave (x/(a+|x|)) e não um corte: um corte
   duro cria planaltos de tom uniforme com contorno nítido, que é outra vez uma
   mancha pintada.

   E A RUGOSIDADE ACOMPANHA. Uma mancha que só muda o brilho lê como TINTA — o
   chão fica com aspecto de pintado de duas cores. O que distingue asfalto gasto
   de asfalto novo, ou laje húmida de laje seca, é sobretudo quanto ela espelha;
   levar a mesma máscara à rugosidade é o que transforma a mancha em superfície.
   O sinal é atenuado (0,35) porque a rugosidade satura muito mais depressa que o
   albedo: a mesma amplitude ali daria poças. */
/* Ruido de valor PROCEDURAL — sem periodo nenhum.

   As oitavas media e fina do macro liam o `uMacroMap`, que e um canvas de 256²
   TILEAVEL. Com os multiplicadores 4,3 e 15,5 sobre um ladrilho de 6 m, a
   oitava fina repetia o campo inteiro de manchas a cada 3,5 METROS: cinquenta
   repeticoes identicas ao longo do patio, alinhadas numa grelha. Trocou-se a
   grelha da malha por uma grelha de textura, e o relato nao mudou.

   Rodar nao salva: uma rede periodica rodada continua periodica; o que a
   rotacao evita e apenas que ela partilhe eixo com o ladrilho por baixo.

   Isto nao repete. O hash e sobre a celula inteira, entao o campo so se
   repetiria quando as coordenadas voltassem ao mesmo valor em float — dezenas
   de quilometros daqui. Custa ~10 operacoes por amostra e nao le textura
   nenhuma, o que num chao que ocupa meio ecra e mais barato do que o fetch que
   substitui. */
const MACRO_NOISE_GLSL = /* glsl */`
float tsHash( vec2 p ) {
  vec3 q = fract( vec3( p.x, p.y, p.x ) * vec3( 0.1031, 0.1030, 0.0973 ) );
  q += dot( q, vec3( q.y, q.z, q.x ) + 33.33 );
  return fract( ( q.x + q.y ) * q.z );
}
float tsNoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( tsHash( i ), tsHash( i + vec2( 1.0, 0.0 ) ), u.x ),
              mix( tsHash( i + vec2( 0.0, 1.0 ) ),
                   tsHash( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
}
`;

/* QUEBRA DO LADRILHO — e a resposta a "a rua ate que esta boa, mas a grama e o
   patio estao muito falsos".

   Essa distincao e o diagnostico inteiro. Os periodos de ladrilho sao asfalto
   6 m, laje 8 m, grama 4 m — a grama repete MAIS depressa que a rua e mesmo
   assim so a rua passa. A diferenca nao esta no periodo, esta no CONTEUDO: o
   asfalto e quase sem feicao, e repetir ruido sem feicao e invisivel. A grama
   tem tufos e a laje tem manchas e juntas — feicoes que o olho reconhece e
   depois encontra outra vez, a distancia certa, indefinidamente.

   Nenhuma quantidade de variacao POR CIMA resolve isto: multiplicar uma mancha
   que repete por outra que nao repete continua a deixar a primeira la. O que
   tem de deixar de repetir e a leitura do proprio mapa.

   A tecnica e a mais barata que funciona: LER O MAPA DUAS VEZES, a segunda numa
   escala e rotacao incomensuraveis com a primeira, e escolher entre as duas com
   um campo de ruido de baixa frequencia. Onde o campo esta perto de 0 ou de 1 —
   que e quase em todo o lado, por causa do smoothstep — ve-se UM dos dois
   ladrilhos, nitido; a feicao reaparece, mas noutra escala e noutro angulo, e
   deixa de haver distancia a que ela volte igual.

   As UV das duas leituras sao transformacoes LINEARES de vMapUv, portanto as
   derivadas de mipmap continuam certas e nao ha costura nem `textureGrad`.

   uMacroBreak vem do manifesto por material, e e zero por omissao: a rua nao
   precisa e nao paga. */
const MACRO_GLSL = /* glsl */`
#ifdef USE_MAP
{
  vec2 tsP = vMapUv * uMacroScale;
  if ( uMacroBreak > 0.001 ) {
    vec2 tsUvB = mat2( 0.8090, -0.5878, 0.5878, 0.8090 ) * vMapUv * 0.6180
               + vec2( 17.31, 9.07 );
    float tsSel = smoothstep( 0.40, 0.60, tsNoise( tsP * 2.9 + 3.7 ) );
    diffuseColor.rgb = mix( diffuseColor.rgb,
                            texture2D( map, tsUvB ).rgb,
                            tsSel * uMacroBreak );
  }
  /* A oitava LARGA fica no mapa: com periodo de 55 a 90 m ela repete duas ou
     tres vezes no sitio todo, o que nao se le como ritmo, e as manchas
     desenhadas a mao tem uma forma que o ruido de valor nao tem. */
  float tsA = texture2D( uMacroMap, tsP ).g;
  /* DEFORMACAO DE DOMINIO antes das oitavas finas. Ruido de valor numa grelha
     de inteiros tem curvas de nivel quadradas; empurrar o ponto por um campo
     proprio e o que transforma quadrado arredondado em mancha com forma. */
  vec2 tsW = vec2( tsNoise( tsP * 2.7 + 11.3 ),
                   tsNoise( tsP * 2.7 + 71.7 ) ) - 0.5;
  vec2 tsQ = tsP + tsW * 0.40;
  float tsB = tsNoise( mat2( 0.8434, -0.5373, 0.5373, 0.8434 ) * tsQ * 4.3 );
  float tsC = tsNoise( mat2( 0.2837, -0.9589, 0.9589, 0.2837 ) * tsQ * 15.5 );
  float tsD = tsNoise( mat2( 0.6570, 0.7539, -0.7539, 0.6570 ) * tsQ * 43.0 );
  float tsV = tsA * 0.32 + tsB * 0.28 + tsC * 0.24 + tsD * 0.16;
  // devolver o contraste que a media das tres tirou, sem criar planalto
  float tsX = ( tsV - 0.5 ) * 1.95;
  tsV = 0.5 + 0.5 * tsX / ( 0.5 + abs( tsX ) );

  /* E A COR ANDA COM O VALOR, que e o que faltava para isto ler como chao.
     Ate aqui o macro so multiplicava um CINZENTO: as manchas diferiam em
     claro/escuro e em mais nada, e um chao que varia so em valor le como uma
     superficie unica mal iluminada — "padronizada". No mundo real o que muda a
     mancha e a HUMIDADE e o PO: molhado puxa para o frio e escuro, seco e
     poeirento puxa para o quente e claro. Sao dois campos independentes: uma
     zona pode estar clara e fria (betao lavado) ou escura e quente (oleo). Por
     isso o matiz sai de OUTRA oitava (tsB, girada) e nao do mesmo tsV. */
  vec3 tsWarm = vec3( 1.07, 1.00, 0.90 );
  vec3 tsCool = vec3( 0.93, 0.98, 1.08 );
  vec3 tsTint = mix( tsCool, tsWarm, smoothstep( 0.35, 0.65, tsB ) );
  vec3 tsMacro = vec3( tsV ) * tsTint;
  tsMacroK = tsV * 2.0;
  diffuseColor.rgb *= mix( vec3( 1.0 ), tsMacro * 2.0, uMacroAmount );
}
#endif
`;

/* A RUGOSIDADE SÓ SOBE — e a versão anterior fazia o contrário, o que produziu
   "o pátio reflete muita luz".

   Estava `roughnessFactor *= mix(1, 2 - tsMacroK, amount*0.35)`. Com tsMacroK a
   ir de 0 a 2, isso dava 0,75 nas manchas CLARAS: um quarto de rugosidade a
   menos em metade da laje. Numa superfície de 180 m sob sol direto, roughness
   0,75 num dielétrico é um lençol especular — e o sinal ainda estava trocado,
   porque quem fica liso é a mancha HÚMIDA (escura), não a seca.

   Agora o intervalo é 0,96 a 1,20: praticamente só endurece. A variação
   molhado/seco continua a existir, mas com 4 % em vez de 25 %, e o pior caso do
   erro deixa de ser "a laje virou espelho" e passa a ser "a laje está 4 % mais
   lisa numa mancha". Num chão, errar para o lado fosco não custa nada. */
const MACRO_ROUGH_GLSL = /* glsl */`
  // O PISO PRIMEIRO, e depois a variação — nesta ordem, para que a mancha
  // molhada/seca module um chão já fosco em vez de decidir se ele é fosco.
  roughnessFactor = mix( roughnessFactor, 1.0, uRoughFloor );
#ifdef USE_MAP
  roughnessFactor *= mix( 1.0, 0.96 + 0.28 * ( tsMacroK * 0.5 ), uMacroAmount );
#endif
  roughnessFactor = clamp( roughnessFactor, 0.04, 1.0 );
`;

/* Depois de <map_fragment>, que é onde `diffuseColor` já tem o albedo do mapa e
   ainda não passou por nada mais. `vMapUv` é a varying que o three publica para
   o mapa (era `vUv` antes de r152); ela já traz o `repeat` do ladrilho aplicado,
   e é por isso que `uMacroScale` é um multiplicador dela e não um valor
   absoluto. */
function installMacro(mat: THREE.MeshStandardMaterial,
                      cfg: { scale: number; amount: number; break?: number },
                      roughFloor = 0) {
  const tex = getMacroTex();
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uMacroMap = { value: tex };
    shader.uniforms.uMacroScale = { value: cfg.scale };
    shader.uniforms.uMacroAmount = { value: cfg.amount };
    shader.uniforms.uMacroBreak = { value: cfg.break ?? 0 };
    shader.uniforms.uRoughFloor = { value: roughFloor };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n'
        + 'uniform sampler2D uMacroMap;\nuniform float uMacroScale;\n'
        + 'uniform float uMacroAmount;\nuniform float uMacroBreak;\n'
        + 'uniform float uRoughFloor;\n'
        + MACRO_NOISE_GLSL)
      /* `tsMacroK` é declarado FORA do bloco do macro porque quem o consome —
         a rugosidade — só aparece várias inclusões mais à frente. Vale 1,0 por
         omissão, que é o neutro, para o caso de USE_MAP não estar definido. */
      .replace('#include <map_fragment>',
        'float tsMacroK = 1.0;\n#include <map_fragment>\n' + MACRO_GLSL)
      .replace('#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\n' + MACRO_ROUGH_GLSL);
  };
  /* Sem isto o three reaproveita o programa do material SEM a injeção (a chave
     de cache não conhece onBeforeCompile), e a variação some em metade dos
     materiais sem erro nenhum.
     A CHAVE MUDA COM O CÓDIGO INJETADO: mantê-la em v1 depois de mexer no GLSL
     é pedir ao three que sirva o programa antigo para o material novo. */
  mat.customProgramCacheKey = () => 'ts-set-macro-v5';
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
      if (def.macro && typeof def.macro.scale === 'number') {
        installMacro(mat, def.macro,
          typeof def.roughnessFloor === 'number' ? def.roughnessFloor : 0);
      }
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

/* ---------------- geometria sólida e recuo das construções ----------------
   Duas coisas que este módulo tem e scene.ts não: quais malhas são CHÃO e quais
   são construção, e a chance de mexer nelas antes de qualquer medida.

   O QUE É SÓLIDO. Não é uma heurística de tamanho — é o próprio manifesto.
   `def.materials` existe para dizer quais nomes de material são superfície de
   chão (é por eles que bindMaterials religa asfalto, concreto, meio-fio, faixa
   e grama). Logo: malha cujos materiais são TODOS de chão é chão; o resto é
   construção. Vale a pena ser exato aqui porque uma classificação errada vira
   uma câmera que se aproxima sozinha em pátio aberto.

   O ESPALHAMENTO FICA DE FORA. `EXT_mesh_gpu_instancing` neste set são os tufos
   de grama e a fiada de cerca. Grama não é obstáculo, e quem impede a câmera de
   sair do pátio é a caixa do interior, que é o perímetro dele. Um InstancedMesh
   também é o pior caso possível para o raycast: uma malha só, com todas as
   instâncias dentro. */
function collectSolids(root: THREE.Object3D, def: SetDef) {
  const ground = new Set(Object.keys(def.materials || {}));
  const out: THREE.Object3D[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if ((mesh as unknown as THREE.InstancedMesh).isInstancedMesh) return;
    const mm = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    /* TODOS de chão para ser chão: uma malha que mistura parede e piso é
       construção, e tratá-la como chão abriria um buraco numa parede. */
    if (mm.length && mm.every((m) => m && ground.has((m as THREE.Material).name))) return;
    out.push(mesh);
  });
  return out.length ? out : null;
}

/* ---------------- recuo das construções altas ----------------
   Afasta da rua as construções mais altas. Pedido de olho — "as construções
   altas ficam levemente mais para trás em relação à rua" — e com um efeito
   colateral que interessa à câmera: quanto mais longe o prédio, menor o recuo
   que o desvio precisa aplicar quando a órbita passa atrás dele.

   É UM AJUSTE DE CARGA, não uma reexportação. O certo seria refazer o set.glb
   (tools/env-build), e é lá que isto deve acabar se for para ficar; enquanto
   for um número em ajuste, mexer no manifesto evita um ciclo de rebuild de
   6 MB por metro experimentado. As duas coisas não podem coexistir: no dia em
   que o .glb nascer com as construções já recuadas, este bloco tem de sair do
   manifesto, senão o recuo é aplicado duas vezes.

   O CRITÉRIO É A ALTURA porque é o que foi pedido, e ela separa bem: no
   distrito as malhas de 8 m para cima são os galpões altos, os tanques e as
   chaminés; abaixo ficam os galpões de doca (5 a 6,6 m) e os contêineres
   (2,6 m), que já estão recuados e servem de escala perto do caminhão.

   MEDIDO ANTES DE APLICAR, sobre o próprio .glb: com 8 m de recuo nenhuma
   construção sai da laje de concreto (x -92,4..86,3) e nenhum par de caixas
   passa a se sobrepor que já não se sobrepusesse — 13 pares antes, 13 depois,
   todos entre peças do mesmo complexo. */
function applyPushback(root: THREE.Object3D, def: SetDef) {
  const cfg = def.pushback;
  if (!cfg || !(cfg.distance > 0)) return 0;
  const minH = cfg.minHeight > 0 ? cfg.minHeight : 8;
  const from = Number.isFinite(cfg.from as number) ? (cfg.from as number) : 0;
  const box = new THREE.Box3();
  const world = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  const moved: THREE.Mesh[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if ((mesh as unknown as THREE.InstancedMesh).isInstancedMesh) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const local = mesh.geometry.boundingBox;
    if (!local || local.isEmpty()) return;
    box.copy(local).applyMatrix4(mesh.matrixWorld);
    if (box.max.y - box.min.y < minH) return;
    moved.push(mesh);
  });
  for (const mesh of moved) {
    box.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
    const centre = (box.min.x + box.max.x) / 2;
    world.set(centre >= from ? cfg.distance : -cfg.distance, 0, 0);
    /* O deslocamento é de MUNDO e a posição do nó é do PAI. Converter um VETOR
       pela inversa do pai não é aplicar a matriz nele — isso levaria a
       translação junto —, é a diferença entre dois PONTOS convertidos. (E não
       serve transformDirection(), que normaliza e jogaria fora o comprimento.) */
    if (mesh.parent) {
      inv.copy(mesh.parent.matrixWorld).invert();
      origin.set(0, 0, 0).applyMatrix4(inv);
      world.applyMatrix4(inv).sub(origin);
    }
    mesh.position.add(world);
    mesh.updateMatrix();
  }
  if (moved.length) root.updateMatrixWorld(true);
  return moved.length;
}

/** Remove o set atual da cena e libera geometria/materiais. */
export function disposeSet() {
  for (const child of [...group.children]) {
    group.remove(child);
    disposeTree(child);
  }
  currentUrl = null;
  /* As caixas são de MUNDO e valiam para esta geometria: mantê-las depois de ela
     sair prenderia a câmera contra prédios que não estão mais na cena. */
  setCameraObstacles(null);
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
  /* DEPOIS do add(): as duas etapas medem em espaço de MUNDO, e enquanto o root
     está solto a matriz dele não tem o pai. E o recuo vem ANTES da coleta, ou a
     câmera desviaria das construções onde elas estavam. */
  const pushed = applyPushback(root, def!);
  if (pushed) console.info(`[set] recuo aplicado a ${pushed} malhas altas`);
  setCameraObstacles(collectSolids(root, def!));
  stats = { meshes, triangles, materials: mats.size, bound };
  return true;
}

export function setSetVisible(v: boolean) { group.visible = !!v; }
export function hasSet() { return currentUrl !== null; }
export function getSetInfo() { return { url: currentUrl, visible: group.visible, ...stats }; }
