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
import { getProfile, groundVariant } from '../core/quality';
import { scene, renderer, registerGroundMaterials, setCameraObstacles } from './scene';
import type { GroundMatEntry, GroundSurface } from './scene';
import { loadGLB } from '../vehicle/models';
import { assetUrl } from '../catalog/catalog';
import { canvasTex, makeMacroCanvas } from './textures';
import { arranjarCenario } from './scenery';
import {
  installSeeThroughOnSet, measureSeeThrough, clearSeeThrough, bindSeeThroughSatellite,
} from './seethrough';
import { getLampLensPairs } from './lamps';

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
  /**
   * `break` LIGA O LADRILHAMENTO ESTOCÁSTICO, e desde 2026-08-11 é LIGA/DESLIGA
   * (qualquer valor ≥ 0.5 liga) em vez de uma força de mistura. A razão está
   * medida no cabeçalho de `TILE_GLSL`: misturar meio ladrilho periódico com
   * meio aperiódico deixa metade da grelha de pé, e era exatamente isso que
   * fazia "ainda está padronizado" sobreviver a todo ajuste deste número.
   *
   * `cell` é o tamanho da célula de sorteio, EM LADRILHOS (padrão 1.2). Célula
   * menor troca de sorteio mais vezes e mistura mais; maior deixa trechos
   * contíguos maiores. Só é lido quando `break` está ligado.
   */
  macro?: { scale: number; amount: number; break?: number; cell?: number };
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
  /* `built` entra na lista porque `surfaceOf()` já o aceita (via WET_SURFACES) e
     porque ele é a única declaração possível de "isto é construção, não chão" —
     o que agora decide também quem pode ficar transparente na frente do veículo
     (ver installSeeThroughOnSet). Faltava aqui: o tipo nasceu antes da família. */
  surface?: 'asphalt' | 'concrete' | 'gravel' | 'dirt' | 'grass' | 'built';
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

/* ---------------- A VARIANTE DOS CONJUNTOS DE CHÃO ----------------
   `textures/grass_nor.jpg` → `textures/grass_nor@1k.jpg`, quando — e SÓ quando —
   `groundVariant()` devolve um sufixo. Ele já vem aparado pelo que o manifesto
   declara existir no servidor (ver "VARIANTES DE ASSET" em core/quality.ts), e
   por isso não há aqui nenhum retry, nenhum `onerror` e nenhuma sonda: a
   declaração é a prova de que os arquivos subiram.

   O QUE ESTÁ EM JOGO, medido: os 16 mapas 2048² deste cenário são **341,3 MB de
   VRAM**, o maior bloco isolado da cena inteira — à frente do implemento e do
   alvo do reflexo do piso. Sem mexer neles, o nível Baixo continua carregando
   ~1 GB de textura e só desenha esse 1 GB mais depressa.

   O QUE '@1k' CUSTA, e o número é NÃO UNIFORME (medido arquivo a arquivo, ver a
   tabela de `ColdProfile.groundVariant`): 7 dos 16 passam folgado (erro médio
   ≤ 3,7/255) e QUATRO reprovam — `concrete_diff`, `grass_ao`, `grass_nor` e
   `gravel_nor`, com erro de 12,0 a 13,1. São ruído de alta frequência quase
   branco: reduzi-los não borra, muda a ESTATÍSTICA DO GRÃO, e o olho lê isso
   como "material errado". Aparece primeiro na fronteira `GRASS_NEAR` junto ao
   caminhão, que tem `repeat 2` e por isso lê mip 0 a distância média.

   ⚠️ NÃO ENTRA EM `assetUrl()`. Aquela função é a junção de TODA URL do engine —
   `.glb`, `.hdr`, `.json`, miniaturas de cartão — e o sufixo só existe para os
   mapas de chão. Reescrever lá pediria `set@1k.glb`, que não existe.

   ⚠️ '@ktx2' NÃO ESTÁ IMPLEMENTADO, e isto é honesto e não uma omissão. Ele não
   é só outra resolução: muda a extensão para `.ktx2` E exige um `KTX2Loader`
   (com o `basis_transcoder.wasm` ao lado), enquanto `texLoader` aqui é um
   `THREE.TextureLoader`. Os arquivos também não existem na árvore, então
   `setAvailableVariants()` nunca vai liberar o sufixo e este caminho é
   inalcançável hoje. Se alguém liberar sem o carregador, o `console.warn` abaixo
   dispara UMA vez e a URL sai sem sufixo — degrada para os arquivos de sempre em
   vez de pedir 16 arquivos que não existem.
   ⚠️⚠️ E quando for implementado: **código primeiro, assets depois.** Para KTX2
   dentro de `.glb`, `KHR_texture_basisu` entra em `extensionsRequired` e o
   `GLTFLoader` LANÇA se o `KTX2Loader` não estiver registrado — um asset
   publicado antes do código não degrada, quebra. É o inverso da ordem registrada
   para a troca de assets do estúdio.

   ⚠️ É FUNÇÃO, chamada no momento da carga. Guardar o sufixo num const de módulo
   o congelaria no nível em que a página abriu — a mesma armadilha que
   `textureAnisotropy()` teve de virar função para não ter, e a razão pela qual
   `groundVariant()` também é função em core/quality.ts. */
let avisouKtx2 = false;

function groundTexUrl(p: string): string {
  const v = groundVariant();
  if (!v) return assetUrl(p);
  if (v === '@ktx2') {
    if (!avisouKtx2) {
      avisouKtx2 = true;
      console.warn('[set] variante @ktx2 declarada, mas não há KTX2Loader neste '
        + 'módulo — usando as texturas de sempre. Ver groundTexUrl().');
    }
    return assetUrl(p);
  }
  /* Sufixo ANTES da extensão, e só quando o último segmento tem uma. Um caminho
     absoluto de terceiro (`https://…`) ou um `data:` fica intocado: o sufixo é
     convenção da nossa árvore de assets, e reescrever fora dela é um 404 mudo. */
  if (/^[a-z][a-z0-9+.-]*:/i.test(p) || p.includes('?') || p.includes('#')) return assetUrl(p);
  const ponto = p.lastIndexOf('.');
  const barra = p.lastIndexOf('/');
  if (ponto <= barra + 1) return assetUrl(p);
  return assetUrl(p.slice(0, ponto) + v + p.slice(ponto));
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
        /* O TETO VEM DO PERFIL (2026-08-13) e no nível Alto continua sendo o
           máximo do dispositivo para o albedo — ou seja, esta linha faz o que
           sempre fez para quem aguenta. O `min` com a capacidade do adaptador
           fica: o perfil declara a INTENÇÃO, o device impõe o fato.

           ⚠️ LIDO NA CARGA, E INERTE NO MEIO DA SESSÃO — e isso é decisão, não
           esquecimento. Trocar `anisotropy` numa textura já residente exige
           `needsUpdate`, que faz o three RE-SUBIR a imagem inteira: seriam
           centenas de MB de upload no meio de um arrasto para mudar um filtro.
           O cabeçalho de core/quality.ts já registra que a anisotropia "não é
           reaplicada a textura já carregada"; o que ela pega é a PRÓXIMA carga
           (troca de cenário, ou a cortina de uma mudança fria). */
        const cap = getProfile().anisotropyGround;
        t.anisotropy = srgb ? Math.min(cap, renderer.capabilities.getMaxAnisotropy())
          : Math.min(cap, 8, renderer.capabilities.getMaxAnisotropy());
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

/* LADRILHAMENTO ESTOCASTICO — e a substituicao MEDIDA da quebra de duas
   leituras que estava aqui, que ficou pelo caminho por duas razoes concretas.

   O QUE HAVIA. Ler o mapa duas vezes (a segunda a 0,618 da escala e girada 36
   graus) e escolher entre as duas por um campo de ruido. Duas objecoes, ambas
   verificadas portando este GLSL para NumPy e medindo a AUTOCORRELACAO da
   imagem deslocada de exactamente UM ladrilho, sobre 60 x 60 m de grama:

     ladrilho puro   r = +0,991
     esta quebra     r = +0,660     <- tirava um terco da periodicidade
     estocastico     r = +0,004

   1. AS DUAS LEITURAS SAO PERIODICAS. Uma transformacao LINEAR de vMapUv da
      outro papel de parede, de periodo 6,47 m em vez de 4 m. Misturar dois
      papeis de parede da um terceiro: o olho acha os dois.
   2. O SELETOR TROCA LONGE DEMAIS. O periodo dele e uMacroScale * 2.9 sobre a
      UV, o que no GRASS_NEAR da 19,7 m contra um ladrilho de 4 m — quase CINCO
      ladrilhos identicos lado a lado antes de trocar de variante.

   O QUE HA AGORA (Heitz & Neyret 2018, "High-Performance By-Example Noise"):
   uma grelha triangular cobre o plano, cada VERTICE dela sorteia um
   deslocamento proprio de UV, e o fragmento mistura as tres leituras pelos
   pesos baricentricos. Nao ha periodo nenhum por construcao — o campo so
   repetiria se o hash de duas celulas coincidisse.

   TRES DETALHES QUE NAO SAO OPCIONAIS:

   * VARIANCIA. Somar tres amostras independentes por pesos que somam 1 REDUZ o
     contraste (a media de N amostras tem 1/sqrt(N) do desvio). Medido: o blend
     linear entregava 89 % do contraste do ladrilho puro, e o resultado lia-se
     como "chapado" — trocar uma queixa por outra. A reposicao de Heitz,
     (soma - media) * inversesqrt(dot(w,w)) + media, devolve 100,0 %. A `media`
     sai do mip 1x1 do proprio mapa, que e uma leitura sempre em cache.
   * DERIVADAS. O deslocamento e constante DENTRO da celula, entao dFdx do UV
     deslocado explode em cima da fronteira e o mipmap escolheria o nivel
     errado numa linha de 1 px. Por isso as leituras sao `texture2DGradEXT` com
     as derivadas do UV NAO deslocado.
   * PESOS AO CUBO. Baricentrico puro mistura em quase toda a area e as feicoes
     ficam fantasmagoricas. Elevando ao cubo e renormalizando, a maior parte do
     sitio ve UMA leitura nitida e so as fronteiras misturam.

   CUSTO, e e o motivo de isto ser por material: tres leituras por mapa mais a
   media, ou seja 16 fetches por fragmento de chao contra 4. `break` liga; quem
   nao precisa nao paga. */
const TILE_GLSL = /* glsl */`
vec2 tsHash2( vec2 p ) {
  vec3 q = fract( vec3( p.x, p.y, p.x ) * vec3( 0.1031, 0.1030, 0.0973 ) );
  q += dot( q, vec3( q.y, q.z, q.x ) + 33.33 );
  return fract( vec2( ( q.x + q.y ) * q.z, ( q.z + q.y ) * q.x ) );
}

/* Estado da celula, calculado UMA vez por fragmento (em <map_fragment>) e lido
   por todos os mapas depois. Os valores iniciais sao o caso neutro: peso todo
   na primeira leitura, deslocamento zero, reposicao 1 — ou seja, exactamente a
   leitura simples, para o caso de USE_MAP nao estar definido e tsCells() nunca
   correr. */
vec3 tsCellW = vec3( 1.0, 0.0, 0.0 );
vec2 tsCellO1 = vec2( 0.0 ), tsCellO2 = vec2( 0.0 ), tsCellO3 = vec2( 0.0 );
float tsCellN = 1.0;

void tsCells( vec2 uv ) {
  /* 3.4641 = 2*sqrt(3): leva a grelha triangular a celulas de lado 1 na UV.
     uBreakCell mede a celula EM LADRILHOS, e vMapUv ja esta em ladrilhos. */
  vec2 s = uv * ( 3.4641016 / max( 0.05, uBreakCell ) );
  vec2 k = vec2( s.x - 0.5773503 * s.y, 1.1547005 * s.y );
  vec2 b = floor( k );
  vec2 f = k - b;
  float z = 1.0 - f.x - f.y;
  vec3 w;
  vec2 v1, v2, v3;
  if ( z > 0.0 ) {
    w = vec3( z, f.y, f.x );
    v1 = b; v2 = b + vec2( 0.0, 1.0 ); v3 = b + vec2( 1.0, 0.0 );
  } else {
    w = vec3( -z, 1.0 - f.y, 1.0 - f.x );
    v1 = b + vec2( 1.0, 1.0 ); v2 = b + vec2( 1.0, 0.0 ); v3 = b + vec2( 0.0, 1.0 );
  }
  w = w * w * w;                       // ver "PESOS AO CUBO" no cabecalho
  w /= ( w.x + w.y + w.z );
  tsCellW = w;
  tsCellN = inversesqrt( max( 1e-4, dot( w, w ) ) );
  tsCellO1 = tsHash2( v1 );
  tsCellO2 = tsHash2( v2 );
  tsCellO3 = tsHash2( v3 );
}

/* Le QUALQUER mapa do material pela mesma celula — e "a mesma celula" e o
   ponto: se o albedo trocasse de sorteio noutro sitio que o relevo, via-se a
   costura de um contra o outro. */
vec4 tsBlend( sampler2D t, vec2 uv ) {
  if ( uBreakOn < 0.5 ) return texture2D( t, uv );
  vec2 dx = dFdx( uv ), dy = dFdy( uv );
  return tsCellW.x * texture2DGradEXT( t, uv + tsCellO1, dx, dy )
       + tsCellW.y * texture2DGradEXT( t, uv + tsCellO2, dx, dy )
       + tsCellW.z * texture2DGradEXT( t, uv + tsCellO3, dx, dy );
}

/* COM reposicao de variancia — e ela NAO serve para todo o mapa.
   ---------------------------------------------------------------------------
   A reposicao multiplica o desvio em relacao a media por ate 1,73 (o pior caso,
   no centro de um triangulo). Num mapa de DETALHE isso e exactamente o que se
   quer: devolve o contraste que a media de tres amostras tirou. Num mapa que e
   uma MASCARA — o AO, e a poca enquanto chove — e um erro, e um erro com
   assinatura propria: o fator depende so dos pesos, os pesos sao periodicos na
   malha de celulas, e um AO empurrado acima de 1 ACENDE o ambiente. O resultado
   e uma constelacao de clarões do tamanho da celula, todos com a mesma forma —
   ou seja, troca-se a grade do ladrilho pela grade das celulas, que foi o que o
   primeiro corte desta mudanca pos no ecra.

   Por isso: detalhe (albedo, normal) por aqui; mascara (rugosidade, AO) por
   tsBlend, que e a media ponderada e nao inventa amplitude. O clamp e cinto e
   suspensorio para o albedo, onde a reposicao ainda pode passar de 1. */
vec4 tsTiled( sampler2D t, vec2 uv ) {
  if ( uBreakOn < 0.5 ) return texture2D( t, uv );
  vec4 mu = texture2DLodEXT( t, vec2( 0.5 ), 20.0 );
  return clamp( ( tsBlend( t, uv ) - mu ) * tsCellN + mu, 0.0, 1.0 );
}
`;

const MACRO_GLSL = /* glsl */`
#ifdef USE_MAP
{
  vec2 tsP = vMapUv * uMacroScale;
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
/* AS QUATRO INCLUSOES SAO SUBSTITUIDAS, e nao emendadas — e essa e a diferenca
   que faz a correcao chegar ao que se ve.

   A versao anterior so mexia em `diffuseColor`, dentro de <map_fragment>. Mas o
   three le cada mapa na SUA inclusao e com a SUA varying:

     map          <map_fragment>          vMapUv
     roughnessMap <roughnessmap_fragment> vRoughnessMapUv
     normalMap    <normal_fragment_maps>  vNormalMapUv
     aoMap        <aomap_fragment>        vAoMapUv

   Entao a cor da grama deixava de repetir e o RELEVO dela continuava a repetir
   de 4 em 4 m, sem rotacao, no sitio inteiro. Com o sol do estudio a ~11 graus
   de elevacao quem desenha um tufo e a normal, nao o albedo — ou seja, a
   correcao nunca tocou no canal que produz a queixa. As quatro passam agora
   pela mesma `tsTiled()`, com a mesma celula.

   PORQUE COPIAR O CORPO DAS INCLUSOES em vez de emendar depois delas: nao ha
   ponto de emenda — o valor lido e consumido na mesma linha. O corpo copiado e
   o do three 0.179.1. O do <aomap_fragment> deixa de fora os ramos de
   USE_CLEARCOAT e USE_SHEEN, que sao de MeshPhysicalMaterial e nao existem aqui
   (a assinatura desta funcao so aceita MeshStandardMaterial); se algum dia um
   chao vier fisico, o `#else` continua a ser o chunk original inteiro. */
const TILE_ROUGH_INCLUDE = /* glsl */`
float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
  roughnessFactor *= tsBlend( roughnessMap, vRoughnessMapUv ).g;
#endif
`;

const TILE_NORMAL_INCLUDE = /* glsl */`
#ifdef USE_NORMALMAP_TANGENTSPACE
  {
    vec3 tsMapN = tsTiled( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
    tsMapN.xy *= normalScale;
    normal = normalize( tbn * tsMapN );
  }
#else
  #include <normal_fragment_maps>
#endif
`;

const TILE_AO_INCLUDE = /* glsl */`
#ifdef USE_AOMAP
  {
    float tsAO = ( tsBlend( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
    reflectedLight.indirectDiffuse *= tsAO;
    #if defined( USE_ENVMAP ) && defined( STANDARD )
      float tsDotNV = saturate( dot( geometryNormal, geometryViewDir ) );
      reflectedLight.indirectSpecular *= computeSpecularOcclusion( tsDotNV, tsAO, material.roughness );
    #endif
  }
#endif
`;

function installMacro(mat: THREE.MeshStandardMaterial,
                      cfg: { scale: number; amount: number; break?: number; cell?: number },
                      roughFloor = 0) {
  const tex = getMacroTex();
  /* LIGA/DESLIGA, e não uma força de mistura — ver o comentário do campo em
     `SetMaterialDef.macro`. Um manifesto antigo com 0.55..0.9 continua a ligar,
     que é o que ele queria dizer. */
  const breakOn = (cfg.break ?? 0) >= 0.5 ? 1 : 0;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uMacroMap = { value: tex };
    shader.uniforms.uMacroScale = { value: cfg.scale };
    shader.uniforms.uMacroAmount = { value: cfg.amount };
    shader.uniforms.uMacroBreak = { value: cfg.break ?? 0 };
    shader.uniforms.uBreakOn = { value: breakOn };
    shader.uniforms.uBreakCell = { value: cfg.cell ?? 1.2 };
    shader.uniforms.uRoughFloor = { value: roughFloor };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n'
        + 'uniform sampler2D uMacroMap;\nuniform float uMacroScale;\n'
        + 'uniform float uMacroAmount;\nuniform float uMacroBreak;\n'
        + 'uniform float uBreakOn;\nuniform float uBreakCell;\n'
        + 'uniform float uRoughFloor;\n'
        + MACRO_NOISE_GLSL + TILE_GLSL)
      /* `tsMacroK` é declarado FORA do bloco do macro porque quem o consome —
         a rugosidade — só aparece várias inclusões mais à frente. Vale 1,0 por
         omissão, que é o neutro, para o caso de USE_MAP não estar definido.
         `tsCells()` corre AQUI, antes de qualquer leitura de mapa, porque é
         quem publica a célula que as outras três inclusões vão ler. */
      .replace('#include <map_fragment>',
        'float tsMacroK = 1.0;\n'
        + '#ifdef USE_MAP\n'
        + '  tsCells( vMapUv );\n'
        + '  diffuseColor *= tsTiled( map, vMapUv );\n'
        + '#endif\n'
        + MACRO_GLSL)
      .replace('#include <roughnessmap_fragment>',
        TILE_ROUGH_INCLUDE + MACRO_ROUGH_GLSL)
      .replace('#include <normal_fragment_maps>', TILE_NORMAL_INCLUDE)
      .replace('#include <aomap_fragment>', TILE_AO_INCLUDE);
  };
  /* Sem isto o three reaproveita o programa do material SEM a injeção (a chave
     de cache não conhece onBeforeCompile), e a variação some em metade dos
     materiais sem erro nenhum.
     A CHAVE MUDA COM O CÓDIGO INJETADO: mantê-la em v1 depois de mexer no GLSL
     é pedir ao three que sirva o programa antigo para o material novo. */
  mat.customProgramCacheKey = () => `ts-set-macro-v6:${breakOn}`;
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

/** O que conta como CHÃO — quem casa aqui pode empoçar; o resto molha e brilha. */
const GROUND_NAME_RE = /ground|floor|chao|chão|road|asphalt|asfalto|grass|grama|verge|gravel|brita|dirt|terra|apron|kerb|piso/i;

/* NENHUM MATERIAL DO CENÁRIO FICA DE FORA DA CHUVA.
   ---------------------------------------------------------------------------
   Esta função devolvia `null` para tudo que não fosse chão, e um material sem
   família nem chega a `registerGroundMaterials` — ou seja, no `Chuvoso` as
   construções, os tanques e a cerca ficavam SECOS sob chuva forte, com a rua
   espelhando ao lado. A premissa que produziu isso ("uma parede não faz poça")
   continua verdadeira e continua aplicada: o que muda é que deixar de empoçar
   passou a significar `road: false`, e não ficar fora da molhagem. */
function surfaceOf(name: string, def: SetMaterialDef): GroundSurface {
  if (def.surface && def.surface in WET_SURFACES) return def.surface;
  const ground = GROUND_NAME_RE.test(name);
  for (const [re, kind] of SURFACE_BY_NAME) {
    if (re.test(name)) return ground ? kind : 'built';
  }
  /* É chão, mas de família desconhecida: concreto é o meio-termo seguro — nem
     o espelho do asfalto molhado, nem a recusa da grama em brilhar. */
  return ground ? 'concrete' : 'built';
}

/** As chaves aceitas em `surface`; espelha WET_PROFILE de scene.ts. */
const WET_SURFACES = {
  asphalt: 1, concrete: 1, gravel: 1, dirt: 1, grass: 1, built: 1,
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
  /* TODO MATERIAL DO SET MOLHA, e não só os do manifesto.
     -------------------------------------------------------------------------
     Fica registrado porque a distinção volta a morder quem mexer aqui: `jobs` é
     a lista de quem tem PBR autorado para CARREGAR, e ela é legitimamente um
     subconjunto — não há textura para buscar de quem o manifesto não nomeia.
     Ela vinha sendo usada também como a lista de quem entra na MOLHAGEM, e aí o
     recorte é o errado: o manifesto do Distrito nomeia 12 materiais e todos são
     de chão, então as 21 famílias restantes — `DL_*` (galpões, escritório,
     guarita, doca), `IBC_*`, `FENCE_*`, `GATE_BOOM_*` e as duas de vegetação,
     `PLANT_BARK` e `PLANT_LEAF` — nunca chegavam a `registerGroundMaterials` e
     ficavam SECAS sob chuva forte, com a rua espelhando ao lado.

     `surfaceOf()` já sabe responder por elas desde que a família `built` foi
     criada: sem nome de chão, a resposta é `built`. Faltava perguntar — e a
     pergunta hoje é feita na varredura de MALHAS lá embaixo, que é onde os
     clones do módulo de atravessar também aparecem. */
  const semDef: SetMaterialDef = {};
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial;
      /* `isMeshStandardMaterial`: a molhagem escreve `roughness`, `color` e
         `envMapIntensity`, que um `MeshBasicMaterial` não tem. */
      if (!mat || seen.has(mat) || !mat.isMeshStandardMaterial) continue;
      seen.add(mat);
      const def = defs[mat.name];
      const rep = def && typeof def.repeat === 'number' && def.repeat > 0 ? def.repeat : 1;
      if (def) jobs.push({ mat, def, rep });
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
    /* `groundTexUrl()` e não `assetUrl()`: são estas quatro linhas — e só elas —
       que pedem os mapas de chão, que é onde a variante de resolução existe. Ver
       o bloco de `groundTexUrl()`.
       ⚠️ A chave do `texCache` é a URL (`url + '|' + s/l`), então cada variante é
       naturalmente uma entrada distinta e não há nada a fazer lá — mas note o
       corolário: se o nível mudar entre duas cargas de cenário, as duas
       variantes do mesmo mapa podem coexistir no cache até `disposeSetTextures()`
       passar. É a troca certa (nunca servir a resolução errada), e o custo só
       aparece em quem troca de qualidade e de cenário na mesma sessão. */
    if (def.diffuse) {
      const p = loadTex(groundTexUrl(def.diffuse), true, rep, slot());
      pending.push(p.then((t) => { if (t) mat.map = t; }));
    }
    if (def.rough) {
      const p = loadTex(groundTexUrl(def.rough), false, rep, slot());
      pending.push(p.then((t) => { if (t) mat.roughnessMap = t; }));
    }
    if (def.normal) {
      const p = loadTex(groundTexUrl(def.normal), false, rep, slot());
      pending.push(p.then((t) => { if (t) mat.normalMap = t; }));
    }
    if (def.ao) {
      const p = loadTex(groundTexUrl(def.ao), false, rep, slot());
      pending.push(p.then((t) => { if (t) mat.aoMap = t; }));
    }
  }

  /* O PONTO DA CORREÇÃO: nada abaixo roda com textura pela metade, e applySet()
     não põe a raiz na cena antes disto voltar. */
  await Promise.all(pending);

  for (const { mat, def } of jobs) {
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
    }
  }

  /* ENTRE o manifesto e o registro da molhagem, e as duas vizinhanças são
     obrigatórias — ver o cabeçalho de `installSeeThroughOnSet()`. Depois do
     manifesto porque o clone de material tem de sair já com tinta, rugosidade e
     macro; antes do registro porque a molhagem tem de encontrar OS CLONES, ou a
     chuva pararia de alcançar as construções. */
  const see = installSeeThroughOnSet(root, (m) => {
    /* "É SUPERFÍCIE DE CHÃO?" — pela DECLARAÇÃO, e só depois pelo nome.
       Nomeado no manifesto ⇒ é chão, salvo se declarar `surface: 'built'`. É a
       regra que tira `KERB_CONCRETE`, `CROP_FIELD`, `GRASS_VERGE` e
       `GRAVEL_SHOULDER` do atravessar mesmo com caixa alta — ver o segundo
       critério em installSeeThroughOnSet(). Não nomeado ⇒ sobra o nome, e
       `surfaceOf()` já sabe responder. */
    const nome = m.name || '';
    const def = defs[nome];
    if (def) return def.surface !== 'built';
    return surfaceOf(nome, semDef) !== 'built';
  });

  /* DEPOIS do laço acima, e não dentro dele: o que a molhagem fotografa como
     "seco" é o estado já configurado pelo manifesto. Fotografar antes gravaria
     os padrões do three e o cenário perderia o próprio envIntensity na primeira
     chuva.

     E varre MALHA, não `todos`. `todos` é a lista de materiais como o GLB os
     entregou, e o passo acima acabou de substituir o material de cada malha que
     pode tapar o veículo por um clone com uniforme próprio: registrar `todos`
     deixaria a molhagem escrevendo em materiais que não estão mais em cena
     nenhuma — as construções voltariam a ficar secas sob chuva forte, que é o
     defeito que a família `built` consertou horas antes desta rodada. O nome
     sobrevive ao clone, então `defs[mat.name]` continua respondendo. */
  const jaRegistrado = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial;
      if (!mat || !mat.isMeshStandardMaterial || jaRegistrado.has(mat)) continue;
      jaRegistrado.add(mat);
      const def = defs[mat.name] || semDef;
      const rep = typeof def.repeat === 'number' && def.repeat > 0 ? def.repeat : 1;
      const surface = surfaceOf(mat.name, def);
      ground.push({
        mat,
        surface,
        /* QUEM EMPOÇA É QUEM É CHÃO — todas as famílias de chão, e não só as
           duas duras. Água parada é função de a superfície ser horizontal e
           reter, não de ser asfalto: um pátio de brita alaga, terra batida
           alaga primeiro que tudo, e grama encharcada tem lâmina de água entre
           os tufos. O que fica de fora é `built`, e aí a premissa antiga vale
           inteira: uma parede não faz poça. */
        road: surface !== 'built',
        /* O `repeat` do material É quantos ladrilhos cobrem a superfície; a
           poça tem escala própria a partir daí (ver PUDDLE_SPAN em scene.ts). */
        tile: [rep, rep],
      });
    }
  });
  /* UMA chamada, com o conjunto completo: registerGroundMaterials() substitui o
     registro anterior inteiro, então chamar por material deixaria só o último. */
  registerGroundMaterials(ground);
  console.info('[set] atravessar: '
    + `${see.comuns} malhas + ${see.instanciadas} instanciadas; `
    + `de fora ${see.chao} rasas e ${see.chaoAlto} de superfície de chão`);
  return bound;
}

/**
 * Sombras.
 *
 * O CRITÉRIO É TER ALTURA, e não estar perto — a troca que fez as construções
 * voltarem a projetar.
 *
 * A regra anterior era um raio de 60 m em torno da ORIGEM, com o argumento de
 * que "um prédio a 90 m só consumiria resolução do atlas sem projetar nada
 * visível". O argumento é bom e a instrumentação é que estava errada, por três
 * motivos que só aparecem juntos:
 *
 *   1. A CAIXA NÃO MORA NA ORIGEM. Ela é centrada no CONJUNTO (`_shadowFocus`,
 *      z ≈ 8,6 m e andando com o engate), então um raio medido da origem não
 *      corresponde a coberto nenhum.
 *   2. QUEM JÁ FAZ ESSA PODA É O THREE. `WebGLShadowMap` testa a esfera
 *      envolvente de cada objeto contra o frustum da câmera de sombra a cada
 *      passe (`_frustum.intersectsObject`) — o MESMO teste, contra a caixa que
 *      de fato vigora, e refeito quando ela muda. Uma bandeira fixa só pode
 *      discordar dele, e discordava: 42 das 86 malhas verticais do Distrito
 *      nasciam com `castShadow = false`.
 *   3. ELA ERA MEDIDA CEDO DEMAIS. `setupShadows()` rodava antes de
 *      `group.add(root)` (a matriz ainda sem o pai) e antes de
 *      `applyPushback()`, que AINDA MOVE as construções altas. Hoje o defeito
 *      não se manifesta — medido, zero divergências —, mas é uma armadilha
 *      armada: a chamada agora fica depois das duas, onde o mundo é o mundo.
 *
 * Fica então o que a bandeira sempre deveria ter dito: chão sempre RECEBE (é
 * onde a sombra cai) e só o que tem ALTURA projeta. Uma laje de asfalto de
 * 600 m não vira sombra de ninguém e sai da lista — que era o custo que o raio
 * existia para evitar.
 */
const SHADOW_CAST_MIN_H = 0.35;

function setupShadows(root: THREE.Object3D) {
  const box = new THREE.Box3();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    mesh.receiveShadow = true;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const local = mesh.geometry.boundingBox;
    if (!local || local.isEmpty()) return;
    box.copy(local).applyMatrix4(mesh.matrixWorld);
    mesh.castShadow = box.max.y - box.min.y >= SHADOW_CAST_MIN_H;
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
  /* Idem para o que atravessa: as listas guardam malha e caixa em mundo, e uma
     malha descartada continuaria sendo julgada a cada quadro. */
  clearSeeThrough();
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
  /* ENTRE o recuo e as sombras, e as duas vizinhanças importam: o plantio lê as
     faixas de grama em MUNDO (logo depois do recuo, que é a última coisa a
     mover construção) e a bandeira de sombra lê a caixa das árvores e postes
     JÁ no lugar novo. Trocar a ordem deixa copa sem sombra. */
  const arranjo = arranjarCenario(root);
  console.info('[set] cenário arranjado', arranjo);
  /* DEPOIS do arranjo, e é a ordem que faz o mecanismo apontar para onde as
     coisas estão: o plantio reescreve TODAS as matrizes de instância e o
     realinhamento move os onze postes, então medir antes guardaria as posições
     de fábrica — o teste apagaria árvores que não estão mais lá e deixaria
     opacas as que estão. Ver measureSeeThrough(). */
  console.info('[set] atravessar medido', measureSeeThrough(root));
  /* E DEPOIS DE MEDIR, o vínculo dos vidros das luminárias aos mastros. Ele tem
     de ser aqui porque só aqui os dois lados existem: `arranjarCenario()` acabou
     de criar os vidros (via setLampSites) e `measureSeeThrough()` acabou de
     montar a lista de sólidos onde os mastros estão. Sem ele, atravessar uma
     torre apaga o poste e deixa o vidro aceso flutuando no céu. */
  let vidros = 0;
  for (const par of getLampLensPairs()) {
    if (bindSeeThroughSatellite(par.host, par.mesh)) vidros++;
  }
  if (vidros) console.info(`[set] ${vidros} vidros de luminária amarrados ao mastro`);
  /* DEPOIS do recuo, e não antes: a bandeira de sombra é lida da caixa em
     MUNDO, e o recuo é a última coisa que muda essa caixa. Ver setupShadows(). */
  setupShadows(root);
  setCameraObstacles(collectSolids(root, def!));
  stats = { meshes, triangles, materials: mats.size, bound };
  return true;
}

export function setSetVisible(v: boolean) { group.visible = !!v; }
export function hasSet() { return currentUrl !== null; }
export function getSetInfo() { return { url: currentUrl, visible: group.visible, ...stats }; }
