/* O carregador de KTX2 — o único item de desempenho que nenhum conserto de CPU
   alcança.
   ===========================================================================

   POR QUE ELE EXISTE
   ---------------------------------------------------------------------------
   A cena quente carrega **~700 MB de textura vinda de arquivo**, e o maior
   bloco isolado dela são os 16 mapas de chão: 2048² cada, 341,3 MB de VRAM
   (`2048 · 2048 · 4 · 1,3333`, RGBA8 com mipmap — medido por
   `tools/studio-assets/censo.mjs --cena`). Nenhum WebP nem JPG chega comprimido
   na GPU: os dois são formatos de TRANSPORTE, decodificados para RGBA8 antes do
   upload. O KTX2/UASTC é o único que chega comprimido e FICA comprimido, porque
   a placa lê blocos BC7 direto.

   Numa integrada de memória compartilhada a diferença não aparece como "20 fps":
   aparece como engasgo de meio segundo a cada movimento de câmera, e às vezes
   como PERDA DE CONTEXTO — que é a página inteira caindo. O caminho da chamada
   de desenho (fusão por material, estrangular a sombra) não toca nisso.

   UASTC, NUNCA ETC1S — a medição está em `core/quality.ts` (campo `groundVariant`)
   ---------------------------------------------------------------------------
   * UASTC/BC7 a 2048²: erro de 0,11 a 5,80. Encolher para 1024²: erro de 0,66 a
     13,11. **O pior caso do UASTC é menos da metade do pior caso do resize**, e
     por 1/4 da VRAM (341,3 → 85,3 MB). Comprimir é melhor que encolher, e por
     margem larga.
   * ETC1S **não economiza um byte numa UHD 630**, que é justamente a máquina do
     problema: sem `WEBGL_compressed_texture_astc` e sem ETC2, a tabela de
     prioridades do `KTX2Loader` manda o ETC1S para BC7 do mesmo jeito. Ele
     perderia qualidade (erro até 14,7 na normal da grama) sem ganhar memória.
     Não é um degrau intermediário; é uma armadilha.

   Quem gera os arquivos é `tools/studio-assets/ktx2.mjs`, com essas opções
   travadas e comentadas lá.

   ⚠️⚠️ A ORDEM DE DEPLOY É INVERTIDA, E ISSO DERRUBA O ESTÚDIO SE FOR IGNORADO
   ---------------------------------------------------------------------------
   Para todo o resto do acervo a ordem é "assets primeiro, código depois": um
   arquivo novo que ninguém pede fica parado no servidor sem incomodar ninguém.

   **Com KTX2 é o contrário.** Para KTX2 dentro de um `.glb`, `KHR_texture_basisu`
   entra em `extensionsRequired` — não há fonte de reserva declarada —, e o
   `GLTFLoader` do three **LANÇA** quando encontra uma extensão obrigatória sem
   carregador registrado. Um asset publicado antes do código não degrada em
   textura feia: **quebra o carregamento inteiro**, e com ele o estúdio.

   Para os mapas de chão, que são arquivos SOLTOS, o estrago é menor e ainda é
   estrago: `loadTex()` em `scene/set.ts` entregaria os bytes do KTX2 a um
   `THREE.TextureLoader`, que tentaria decodificá-los como imagem, falharia, e o
   chão ficaria sem mapa nenhum.

   Logo, a sequência é: **(1) este módulo ligado nos carregadores; (2) os
   arquivos publicados; (3) só então a variante declarada no manifesto**, que é
   o que `setAvailableVariants()` usa para liberar o sufixo. O passo 3 é o
   interruptor, e ele é o ÚLTIMO de propósito — enquanto o manifesto não
   declarar, `groundVariant()` devolve `''` e nada muda para ninguém.

   ⚠️ ESTE MÓDULO NASCE SEM IMPORTADOR. Ele é a metade "código" do passo 1; a
   outra metade são dois registros de uma linha, em `vehicle/models.ts` e em
   `scene/set.ts`. Enquanto eles não existirem, este arquivo é código morto que
   custa zero — e essa é a ordem certa, porque o inverso é o que quebra. */

import * as THREE from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

/**
 * `/vendor/basis/` — diretório (não arquivo) exigido por
 * `KTX2Loader.setTranscoderPath()`. O loader escolhe entre
 * `basis_transcoder.js` e `basis_transcoder.wasm` em runtime, então a barra
 * final é obrigatória.
 *
 * ABSOLUTO e servido pelo WEB, exatamente como `DRACO_DECODER_DIR`, e pelos
 * mesmos motivos: é dependência de BUILD vendorizada (copiada de
 * `three/examples/jsm/libs/basis/`, versão colada à do three), não arte de
 * cena; são ~580 kB; e o `.wasm` é código executado no contexto da página —
 * mantê-lo na mesma origem evita a discussão de CSP/CORS que carregar
 * WebAssembly de outro host abriria. **NÃO passa por `assetUrl()`.**
 *
 * ⚠️ ISTO AQUI É UMA SEGUNDA DECLARAÇÃO DE ONDE UM ASSET MORA, e
 * `src/config/assets.ts` diz, com todas as letras, que só pode haver uma. O
 * lugar definitivo desta constante é `VENDOR_ASSETS.basisTranscoderDir`, ao
 * lado de `dracoDecoderDir`, reexportada por `core/paths.ts` como
 * `BASIS_TRANSCODER_DIR`. Ela está aqui porque este módulo nasceu antes desses
 * dois arquivos poderem ser tocados; a migração é de três linhas e está escrita
 * no relatório que acompanha este commit. Ao movê-la, apague esta constante —
 * não deixe as duas.
 */
const BASIS_TRANSCODER_DIR = '/vendor/basis/';

/**
 * O carregador, UM por página.
 *
 * ⚠️ ELE NÃO PODE SER UM `const` DE MÓDULO INICIALIZADO NA AVALIAÇÃO. Duas
 * razões, e as duas já custaram sessão neste engine:
 *
 * 1. `detectSupport()` precisa do `WebGLRenderer` para perguntar ao adaptador
 *    quais formatos comprimidos existem (`WEBGL_compressed_texture_s3tc`,
 *    `…_astc`, `…_etc`), e o renderer nasce depois do módulo. Sem
 *    `detectSupport()` o `KTX2Loader` LANÇA na primeira carga
 *    ("THREE.KTX2Loader: Missing initialization with `.detectSupport()`").
 * 2. O `KTX2Loader` sobe um pool de Workers e o `basis_transcoder.wasm` na
 *    primeira transcodificação. Criá-lo na avaliação do módulo pagaria isso em
 *    toda página que importar o engine, inclusive nas que nunca abrem cenário.
 */
let carregador: KTX2Loader | null = null;

/**
 * Devolve o `KTX2Loader` configurado, criando-o na primeira chamada.
 *
 * Chame **depois** de o renderer existir, e passe-o: é dele que sai a lista de
 * formatos suportados.
 *
 * ```ts
 * // vehicle/models.ts
 * const loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2Loader(renderer));
 *
 * // scene/set.ts — para os mapas de chão soltos
 * const t = await ktx2Loader(renderer).loadAsync(url);
 * ```
 *
 * É idempotente: chamadas seguintes devolvem o mesmo carregador e só refazem a
 * detecção, que é barata e é a coisa certa a fazer se o contexto foi perdido e
 * recriado (uma integrada perde contexto justamente quando a memória aperta —
 * ver o bloco do topo).
 */
export function ktx2Loader(renderer: THREE.WebGLRenderer): KTX2Loader {
  if (!carregador) {
    carregador = new KTX2Loader().setTranscoderPath(BASIS_TRANSCODER_DIR);
  }
  carregador.detectSupport(renderer);
  return carregador;
}

/**
 * Puxa o transcodificador ANTES de a primeira textura precisar dele.
 *
 * É o irmão do `draco.preload()` de `vehicle/models.ts`, e existe pelo mesmo
 * motivo: o wasm de 527 kB é buscado preguiçosamente, na primeira textura
 * comprimida — ou seja, no meio da carga do cenário, onde a ida e volta não tem
 * nada com que se sobrepor e cai inteira dentro da espera do usuário. Chamado
 * junto com os manifestos, ele é pago por ninguém.
 *
 * ⚠️ Falha em silêncio de propósito. Se o transcodificador estiver
 * inalcançável, o erro tem de aparecer na primeira carga de verdade — que é
 * onde há uma URL para citar e uma cortina para segurar — e não num aviso solto
 * na avaliação do módulo. É a mesma decisão documentada em `draco.preload()`.
 */
export function preloadKtx2(renderer: THREE.WebGLRenderer): void {
  /* ⚠️ `init()` DEVOLVE UMA PROMESSA. Um `try/catch` em volta da chamada só
     pegaria uma falha SÍNCRONA, e a que interessa (o wasm inalcançável) é
     assíncrona — sem o `.catch()` ela vira um "unhandled rejection" no console,
     que é ruído sem dono. O silêncio aqui é deliberado; o erro real reaparece
     na primeira carga de verdade. */
  try { void ktx2Loader(renderer).init().catch(() => { /* ver acima */ }); }
  catch { /* ressurge na primeira carga */ }
}

/**
 * Um `.ktx2` precisa do `KTX2Loader`; qualquer outra coisa vai no
 * `TextureLoader` de sempre.
 *
 * Existe para `scene/set.ts` decidir POR URL, que é a única forma correta: a
 * variante `@ktx2` é lida no momento da carga (`groundVariant()` é função
 * justamente para não congelar no nível em que a página abriu), então o
 * carregador certo muda de uma carga para a outra dentro da mesma sessão.
 *
 * ⚠️ Testa a EXTENSÃO, não o sufixo de variante. São coisas diferentes:
 * `asphalt_diff@ktx2.ktx2` tem as duas, mas quem decide o carregador é o
 * `.ktx2` do fim. Um dia em que a variante mude de nome, isto continua certo.
 */
export function ehKtx2(url: string): boolean {
  const semQuery = url.split(/[?#]/)[0];
  return semQuery.toLowerCase().endsWith('.ktx2');
}

/**
 * Descarta o pool de Workers do transcodificador.
 *
 * O `KTX2Loader` mantém Workers vivos entre cargas de propósito — subir o wasm
 * de novo custa mais que manter. Isto aqui é para a saída da página / troca de
 * contexto, não para a troca de cenário.
 */
export function disposeKtx2(): void {
  if (!carregador) return;
  carregador.dispose();
  carregador = null;
}
