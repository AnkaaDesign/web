/* PERFIL DE QUALIDADE — o teto onde ele está, e um piso que de fato existe.
   ===========================================================================
   HISTÓRIA CURTA, porque ela explica a forma deste arquivo.

   A primeira versão (2026-08-13) nasceu de um pedido de PISO: *"no meu está
   muito bom, mas se eu tivesse um computador com menos desempenho, diminuir a
   qualidade"*. Ela criou os três níveis, o medidor e a interface — e escolheu,
   deliberadamente, mexer só em botões QUENTES (nada que recompilasse um
   shader). Esse recorte estava certo para um adaptador AUTOMÁTICO e errado para
   um seletor: ele deixou de fora, por construção, todos os botões que valem
   alguma coisa numa placa integrada.

   O relato que originou esta segunda versão (2026-08-14) é o veredito daquela:
   *"colocando no modo de qualidade baixa… não vejo diferença nenhuma, nem
   visual, nem de performance"*. E ele estava CERTO. Auditado botão por botão,
   num monitor a `devicePixelRatio` 1 e fora do cenário Estúdio, a diferença
   efetiva entre Alta e Baixa era **um uniforme de shader**:

     · `pixelRatioCap` 2→1   `min(dpr, cap)` é um TETO. A dpr 1, min(1,2) e
                             min(1,1) são o mesmo número. INERTE.
     · `shadowMapSize`       `shadowMap.autoUpdate = false` — o passe não roda
                             enquanto se gira a câmera. Perde nitidez de sombra
                             e não devolve um quadro. E o bias não era escalado
                             junto (ver `shadowTexelScale`), então provavelmente
                             INTRODUZIA peter-panning.
     · `anisotropy`          não é reaplicada a textura já carregada. INERTE
                             no meio da sessão.
     · `floorReflection`     só existe no cenário Estúdio.
     · `orangePeel`          um uniforme, e só nos pixels da lataria pintada.

   ---------------------------------------------------------------------------
   O QUE MUDA NESTA VERSÃO, E POR QUÊ

   1. **A escala de render passa a existir.** Era o "botão dominante" declarado
      e nunca foi implementado: só havia teto de DPR. Agora há um multiplicador
      de verdade (`renderScale`), que funciona em qualquer monitor.

   2. **Botões FRIOS entram — mas só por ato do usuário.** A regra antiga
      ("nenhuma adaptação pode causar engasgo de recompilação") continua valendo
      para o MEDIDOR, e só para ele. Quem clicou em "Baixa" pediu a mudança e
      pode pagar uma cortina de dois segundos por ela — é o mesmo carregamento
      que ele já vê ao trocar de cenário. Sem isso, o pool de 14 spotlights e o
      filtro de sombra de 17 amostras ficariam intocáveis, e são justamente os
      dois maiores custos por fragmento numa GPU integrada.

   3. **A sonda deixa de somar sinais de CPU com sinais de GPU.** A versão
      antiga dava −2 para "placa integrada reconhecida" e depois +1 para cada
      um de núcleos, memória e `maxTextureSize` — de modo que um i5 de 10ª com
      UHD 630 e 16 GB somava **+1 e abria em Alta**. Uma CPU boa não torna uma
      integrada rápida. Agora um adaptador reconhecidamente integrado é um
      TETO, não uma parcela.

   ---------------------------------------------------------------------------
   A REGRA QUE GOVERNA TUDO, E DA QUAL NÃO SE ABRE MÃO

       O perfil só mexe em AMOSTRAGEM. Nunca em decisão visual autorada.

   Resolução, anisotropia, resolução de sombra, número de amostras, densidade de
   espalhamento, LOD — sim. Cor, exposição, tonemap, preset, ângulo de luz,
   arranjo de cenário, o que é pintável, onde a arte cai — JAMAIS.

   O teste prático continua literal: **uma captura tirada no Baixo sai com o
   mesmo enquadramento e a mesma luz da tirada no Alto, só mais serrilhada.**

   ⚠️ O POOL DE SPOTLIGHTS TENSIONA ESSA REGRA, e é honesto dizer onde. Tirar os
   8 postes à noite muda a IMAGEM, não só a amostragem — a poça de luz no
   asfalto some. Ele entra assim mesmo, por três razões: (a) é o maior custo por
   fragmento noturno, e sem ele o nível Baixo não atinge o alvo de hardware;
   (b) `lamps.ts` separa o refletor do VIDRO ACESO, e o vidro é geometria
   emissiva que não custa luz nenhuma — a fileira de pontos alaranjados descendo
   a rua continua lá, então a noite continua LEGÍVEL; (c) a captura continua
   saindo no teto, e a foto é o produto. É uma exceção nomeada, não um
   afrouxamento da regra.

   COROLÁRIO INTOCADO: a captura (`scene/capture.ts`) e a gravação
   (`scene/record.ts`) rodam SEMPRE no teto. Ver `ceilingProfile()`.

   ---------------------------------------------------------------------------
   POR QUE ESTE ARQUIVO NÃO IMPORTA NADA DO ENGINE

   Ele é FOLHA de propósito, e a restrição é real. `scene.ts` cria o
   `WebGLRenderer` no ESCOPO DE MÓDULO — a primeira linha do cabeçalho de lá diz
   isso —, então qualquer coisa decidida ANTES do renderer existir tem de vir de
   um módulo importável no topo dele sem fechar ciclo. `antialias` e
   `shadowMap.type` são desse tipo: não há segunda chance.

   ---------------------------------------------------------------------------
   TRÊS EIXOS DE DECISÃO, E NENHUM BASTA SOZINHO

   1. SONDA ESTÁTICA (`probeHardware`) — o que dá para saber antes do primeiro
      quadro. Acerta o caso extremo e CHUTA o meio.
   2. MEDIDOR DE QUADRO (`reportFrameTime`) — o único juiz honesto.
   3. A ESCOLHA DO USUÁRIO — que ganha dos dois, sempre, e é lembrada.

   ⚠️ **AUSÊNCIA DE INFORMAÇÃO NUNCA SIGNIFICA "FRACO".** O Firefox mascara
   `UNMASKED_RENDERER_WEBGL` por privacidade. Se a string não vier, o veredito é
   DESCONHECIDO e o piso é o nível Alto — porque o defeito que este sistema
   existe para não ter é "o Firefox inteiro caiu para Baixo em máquinas boas".
   Só o MEDIDOR pode rebaixar quem não se identificou. */

/* ---------------------------------------------------------------------------
   OS NÍVEIS
   --------------------------------------------------------------------------- */

export type QualityLevel = 'alta' | 'media' | 'baixa';
/** `auto` deixa o medidor decidir; os três nomes CONGELAM o nível. */
export type QualityMode = 'auto' | QualityLevel;

export const LEVELS: QualityLevel[] = ['baixa', 'media', 'alta'];
export const LEVEL_LABEL: Record<QualityLevel, string> = {
  alta: 'Alta', media: 'Média', baixa: 'Baixa',
};

/**
 * OS BOTÕES QUENTES — trocáveis a qualquer momento, sem recompilar um shader e
 * sem recriar o contexto.
 *
 * Essa divisão é o que torna a adaptação automática segura por construção: o
 * medidor só toca aqui, e uma adaptação que causasse engasgo de recompilação
 * seria precisamente o defeito que ela existe para evitar.
 */
export interface QualityProfile {
  /* ---- resolução ---- */
  /**
   * O MULTIPLICADOR DE RESOLUÇÃO — o botão dominante, e o que faltava.
   *
   * Aplicado como `setSize(w·s, h·s, false)` com o CSS preso ao tamanho lógico,
   * e NÃO como teto de `devicePixelRatio`: um teto não faz nada num monitor a
   * dpr 1, que é o caso da esmagadora maioria dos desktops — inclusive o
   * hardware que esta revisão existe para atender.
   *
   * O custo de preenchimento escala com o QUADRADO disto. 0,80 desenha 64 % dos
   * fragmentos; 0,65 desenha 42 %.
   *
   * ⚠️ Quem mexer aqui tem de alimentar `uPxScale` (`vehicle/paint.ts`) com o
   * inverso, ou o floco metálico muda de tamanho aparente junto com a escala —
   * é o mesmo mecanismo do relato "no render os flakes ficam muito grandes",
   * invertido.
   */
  renderScale: number;
  /** Teto do `devicePixelRatio`, que continua valendo em telas HiDPI. Num
   *  monitor a dpr 1 ele é inerte por definição — daí `renderScale` existir. */
  pixelRatioCap: number;

  /* ---- sombra ---- */
  /** Lado do mapa de sombra. Realocação de alvo — barata e trocável a quente.
   *
   *  ⚠️ NÃO É UM BOTÃO DE DESEMPENHO INTERATIVO. `shadowMap.autoUpdate` é
   *  `false`: o passe só roda em borda de carga e em arrasto de hora. Baixar
   *  isto perde nitidez de contato e devolve ~zero enquanto se gira a câmera.
   *
   *  Ele está aqui pelo custo de MEMÓRIA, e o número real é maior que o que a
   *  documentação antiga registrava: `WebGLShadowMap` aloca um
   *  `WebGLRenderTarget` COMPLETO — anexo de cor RGBA8 **mais** um renderbuffer
   *  de profundidade D24 —, então 3072² custa **72 MB** e não 37,7, e 2048²
   *  custa **32 MB**. Numa integrada de memória compartilhada isso é o terceiro
   *  maior item do orçamento. */
  shadowMapSize: number;

  /* ---- amostragem de textura ---- */
  /** Anisotropia das texturas do veículo (`vehicle/material-setup.ts`). */
  anisotropyVehicle: number;
  /** Anisotropia do albedo do chão (`scene/set.ts`). O chão é visto quase
   *  sempre em ângulo rasante — o caso que a anisotropia existe para resolver —
   *  daí um número próprio, mais alto que o do veículo. Numa GPU integrada a
   *  anisotropia é multiplicador de BANDA, e banda é o recurso escasso ali. */
  anisotropyGround: number;

  /* ---- passadas ---- */
  /**
   * O reflexo do piso do Estúdio — três estados, e não dois.
   *
   * A versão anterior tratava isto como liga/desliga, citando a medição de
   * `floor-reflection.ts`: **14,1 fps a meio lado contra 14,7 a um quarto**. A
   * medição está certa e a conclusão que se tirou dela não: ela prova que o
   * gargalo é a segunda varredura de GEOMETRIA, não o preenchimento — logo a
   * saída é reduzir GEOMETRIA, não resolução.
   *
   * E há folga para isso, embora MENOS do que a primeira redação deste bloco
   * afirmava. ⚠️ **Correção:** eu havia escrito "a saída é lida em nível de
   * mipmap até 4,0" e usado o nível 4 (60×34 pixels num alvo 960×540) para
   * dimensionar o corte. **4,0 é o CLAMP, não a faixa de trabalho.** A
   * expressão é `log2(1 + 0,12·d)`, que só chega a 4 em **d = 125 m** — cinco
   * vezes o alcance da órbita. Dentro dos 8,6–22,4 m que `setVehicleFocus()`
   * permite, o mipmap real vai de **1,03 a 1,88**.
   *
   * Dimensionar o corte pelo nível 4 teria removido coisa que o reflexo ainda
   * mostra. O corte correto sai da conta de texel no mip que de fato é lido, e
   * quem a fez é `floor-reflection.ts` — ver lá. O que continua valendo é a
   * conclusão: com Fresnel de teto 0,42 e a queda por distância, o que sobrevive
   * chega a no máximo 42 % da radiância da cena, e desenhar 5,3 M de triângulos
   * para alimentar isso continua desproporcional.
   *
   *   'full'  — a cena inteira, como sempre foi.
   *   'lod'   — só o que tem silhueta legível a mip 4: sai a parafusaria, sai a
   *             ferragem, saem os pneus. Mantém o reflexo RECONHECÍVEL, que é o
   *             critério que o próprio `floor-reflection.ts` estabelece.
   *   'off'   — a segunda passada não acontece, e o ALVO é liberado.
   *
   * ⚠️ E há um segundo custo que a contabilidade anterior não tinha: o alvo é
   * 1600×1080 `HalfFloatType` com mipmaps E `samples: 4`, ou seja **96,7 MB de
   * VRAM**, dos quais ~79 MB são só o buffer multiamostrado. Isso faz do
   * reflexo o **segundo maior item isolado do orçamento de memória da cena**,
   * atrás apenas dos 341 MB de chão — à frente do implemento inteiro. Numa
   * integrada de memória compartilhada esse número pesa tanto quanto os 14,1
   * fps.
   */
  floorReflection: 'full' | 'lod' | 'off';

  /* ---- shader de tinta ---- */
  /** Casca de laranja do verniz (`vehicle/paint.ts` → `uPeel`). O trecho mais
   *  caro do shader de tinta — 4 avaliações de altura, 2 ruídos cada, ~860 ALU
   *  por fragmento pintado — e o efeito mais sutil dos três acima de ~2 m.
   *  O ramo `if (uPeel > 0.001)` já existe no GLSL, então zerar o uniforme é
   *  quente por desenho, não por sorte. */
  orangePeel: boolean;
  /** Oitavas do floco metálico. 2 = `cA`+`cB` com transição suave ao afastar;
   *  1 = só `cA`, ~215 ALU a menos, ao custo de um possível "pop" de granulação
   *  numa distância específica. Nunca 0 — zerar o floco tira o GRÃO da tinta
   *  metálica, e isso é decisão visual autorada, não amostragem. */
  flakeOctaves: 1 | 2;

  /* ---- espalhamento e ganchos por quadro ---- */
  /** Fator sobre `im.count` da vegetação (`scene/scenery.ts`). Folhagem é
   *  `alphaTest 0.38` vinda do próprio GLB, ou seja `discard` no fragmento, ou
   *  seja SEM early-Z — a categoria mais cara que existe numa integrada. E o
   *  custo é pago duas vezes, porque o material de profundidade copia o
   *  `alphaTest` para o passe de sombra. `count` é escrito sem tocar buffer. */
  vegetation: number;
  /** Amostras do teste de corredor do `scene/seethrough.ts`. Ele roda 60×/s
   *  sobre ~650 objetos INCLUSIVE em quadro pulado — é o maior custo fixo de
   *  CPU do laço, e num i5 a CPU é o recurso escasso. */
  seeThroughSamples: number;
  /** Limiar de LOD em PIXELS de altura de tela. Uma malha cujo diâmetro em
   *  mundo projeta menos que isto some.
   *
   *  ⚠️ NÃO CHAME ISTO DE "SUB-PIXEL". Medido: a lente é de 30° e a órbita é
   *  presa entre ~8,6 e ~22,4 m, então uma peça de 5 cm tem **4 px de altura a
   *  1080p a 25 m** — é visível. O limiar honestamente invisível é 12,4 mm, e
   *  nessa faixa há 2 primitivas no implemento inteiro. Ou seja: o LOD rende
   *  ~592 chamadas e ~698 k triângulos e CUSTA qualidade. É degradação
   *  legítima para os níveis baixos, não é de graça. 0 desliga. */
  lodMinPx: number;

  /* ---- carga e cache ---- */
  /** Lado do alvo da sonda de reflexo local (`scene/probe.ts`). Ela faz SEIS
   *  renderizações completas da cena + um PMREM a cada troca de cenário ou de
   *  cavalo — ~14 000 chamadas de desenho num quadro só. Nunca no laço, mas é
   *  um engasgo visível numa integrada. */
  probeSize: number;
  /** Passos e intervalo mínimo da reassadura do PMREM na mistura de céus
   *  (`scene/skyblend.ts`). São 12 picos de 10-40 ms numa varredura completa do
   *  relógio; metade dos passos é metade dos picos, e a defasagem do céu
   *  misturado é invisível pelo argumento do próprio arquivo. */
  pmremSteps: number;
  pmremMinMs: number;
  /** Quantos ambientes ficam no cache de `scene/environment.ts`. */
  envCacheMax: number;

  /* ---- clima e adereços ---- */
  /** Fator sobre a densidade de chuva (`scene/weather.ts` → `uAmount`). */
  rainAmount: number;
  /** As ondulações de impacto no chão molhado. Quads deitados com
   *  `NormalBlending` + `depthWrite:false` — overdraw transparente sem early-Z. */
  rainRipples: boolean;
  /** Os 28×3 spots decorativos suspensos do teto do Estúdio
   *  (`scene/ceiling.ts`). O próprio arquivo os declara decorativos. */
  ceilingSpots: boolean;
}

/**
 * OS BOTÕES FRIOS — mudam um `#define`, uma chave de cache de programa ou um
 * parâmetro de construtor.
 *
 * Trocar um destes exige **cortina**: o laço para, a cena é solta e reconstruída
 * pelo caminho que `studio.ts` já tem (`releasedChoice` + `RELEASE_MS`), e só
 * então o quadro volta. É caro e é honesto — o usuário pediu.
 *
 * ⚠️ **O MEDIDOR NUNCA TOCA AQUI.** Ele escolhe o nível; se o nível novo tem uma
 * assinatura fria diferente da vigente, a mudança fria fica PENDENTE e é
 * aplicada na próxima borda natural de carga (troca de cenário/veículo), ou
 * quando o usuário aceitar. Um engasgo de recompilação disparado sozinho, no
 * meio de um arrasto, é exatamente o defeito que a adaptação existe para
 * evitar.
 */
export interface ColdProfile {
  /**
   * MSAA. **Continua LIGADO em todos os níveis, e isso é uma conclusão, não uma
   * omissão.**
   *
   * A tentação era desligá-lo no Baixo — MSAA 4× a 1080p são ~66 MB de cor +
   * profundidade contra ~16,6 MB, numa memória compartilhada de ~41,6 GB/s. Mas
   * esta cena é limitada por SHADER DE FRAGMENTO, não por ROP nem por resolve:
   * um fragmento de lataria à noite custa ~2 800 ALU. E MSAA sombreia uma vez
   * por PIXEL, não por amostra.
   *
   * Logo, pelo mesmo orçamento:
   *   MSAA 4× a `renderScale` 0,65  →  0,88 M fragmentos, arestas boas
   *   sem MSAA a `renderScale` 1,0  →  2,07 M fragmentos, arestas serrilhadas
   *
   * A primeira é ~2,4× mais barata no recurso dominante E entrega arestas
   * melhores. Quem quiser voltar a mexer aqui tem de refutar essa conta.
   */
  antialias: boolean;
  /**
   * Quantas `SpotLight` ficam visíveis à noite — `NUM_SPOT_LIGHTS` para o
   * three, e portanto chave de cache de programa.
   *
   * 14 = 8 postes + 2 faróis + 2 lanternas de cauda + 2 do cavalo iluminando o
   * baú. O laço é `#pragma unroll_loop_start`: são **14 cópias literais** no
   * shader de todo material da cena, e em superfície pintada cada uma paga
   * `BRDF_GGX` mais `BRDF_GGX_Clearcoat`, porque a tinta fixa `clearcoat = 1`.
   * Estimado: ~1 400 ALU por fragmento de lataria à noite, ~35 % do orçamento.
   *
   *   14 — como sempre foi.
   *    6 — saem os 8 postes; ficam faróis, cauda e o par cavalo→baú. Some a
   *        poça de luz no asfalto; o VIDRO ACESO dos postes continua lá.
   *    0 — nenhuma luz direta à noite. O caminhão fica com key+rim+hemi+IBL, e
   *        as lanternas continuam acesas porque são emissivas.
   *
   * ⚠️ `setLampsEnabled()` percorre postes e feixes JUNTOS de propósito, para a
   * contagem ser binária e `warmLightPrograms()` ter só duas configurações para
   * pré-compilar. Um pool por nível cria uma terceira — por isso isto é FRIO e
   * passa pela cortina, onde `warmLightPrograms()` roda de novo.
   */
  spotPool: 14 | 6 | 0;
  /**
   * O filtro do mapa de sombra — `#define`, recompila a cena inteira.
   *
   *   'pcf'   — 17 `texture2DCompare` por fragmento que recebe sombra, e
   *             `receiveShadow` é `true` em TODA malha. Estimado em ~22 % do
   *             sampler de um UHD 630. Lê `shadow.radius`.
   *   'basic' — 1 tap, sem offset. **O maior ganho por fragmento do engine**:
   *             16 taps a menos, ~20 % do sampler.
   *
   * ⚠️ NÃO EXISTE MEIO-TERMO. O comentário de `scene.ts` diz que `PCF_SOFT`
   * custa 9 amostras; contadas no three r179 são **16** (o `1.0/9.0` do arquivo
   * é peso de normalização, não contagem). PCF_SOFT também ignora
   * `shadow.radius`. Ou seja: como degrau de custo ele não serve, e como
   * qualidade ele é pior. Sobra `basic`.
   *
   * ⚠️ O QUE `basic` CUSTA, dito por inteiro: a borda da sombra vira uma escada
   * de um texel. E `shadow.radius` deixa de existir — então um preset `chuvoso`,
   * que usa `radius 12` justamente para dar penumbra larga de dia encoberto,
   * passa a projetar a MESMA sombra dura de um meio-dia de sol. É o defeito que
   * a saída do PCF_SOFT documenta ter consertado, reintroduzido de propósito e
   * só no nível Baixo.
   */
  shadowType: 'pcf' | 'basic';

  /**
   * A VARIANTE DOS CONJUNTOS DE CHÃO — o maior item de VRAM do estúdio, e o
   * único degrau que não é código, é ARQUIVO.
   *
   * Os 16 mapas 2048² custam **341,3 MB**, o maior bloco isolado da cena. Sem
   * mexer neles, o nível Baixo continua carregando ~1 GB de textura — ele só
   * desenha esse 1 GB mais depressa, que é exatamente o defeito que este
   * trabalho existe para corrigir.
   *
   *   ''      — os arquivos de hoje, 2048² em WebP/JPG. 341,3 MB.
   *   '@1k'   — 1024². **É UMA PERDA VISÍVEL E NÃO UNIFORME**, medida arquivo a
   *             arquivo: 7 dos 16 passam folgado (todos os `*_rough`, os `*_ao`
   *             de asfalto e concreto, `concrete_nor`: erro médio ≤ 3,7/255),
   *             mas 4 REPROVAM feio — `concrete_diff`, `grass_ao`, `grass_nor`
   *             e `gravel_nor` erram de 12,0 a 13,1. Esses quatro são ruído de
   *             alta frequência quase branco: reduzi-los não borra, **muda a
   *             estatística do grão**, e o olho lê isso como "material errado".
   *             Onde aparece primeiro: a fronteira `GRASS_NEAR` perto do
   *             caminhão, que tem `repeat 2` (o menor da grama) e por isso lê
   *             mip 0 a distância média.
   *   '@ktx2' — UASTC/BC7 a 2048². **A escolha certa, e a medição diz por quê.**
   *
   * ⚠️ **UASTC ganha nos DOIS eixos e ETC1S é uma armadilha nesta máquina.**
   * Transcodificando com o mesmo `basis_transcoder.wasm` que o `KTX2Loader`
   * usa, o erro do UASTC vai de 0,11 a 5,80 — contra 0,66 a 13,11 do resize a
   * 1024². Ou seja: **o pior caso do UASTC é menos da metade do pior caso do
   * resize**, por 1/4 da VRAM (341,3 → 85,3 MB). E ETC1S, que pareceria o
   * degrau mais barato, **não economiza um byte numa UHD 630**: sem ASTC e sem
   * ETC2, a tabela de prioridades do `KTX2Loader` manda o ETC1S para BC7 do
   * mesmo jeito — ele só perderia qualidade (erro até 14,7 na normal da grama)
   * sem ganhar memória.
   *
   * E a combinação de UASTC a 1024² é a única do relatório inteiro que **baixa
   * menos que hoje** (17,9 MB contra 22,2) e ainda custa 21,3 MB de VRAM em vez
   * de 341,3.
   *
   * ⚠️⚠️ **ORDEM DE DEPLOY INVERTIDA, E ISSO DERRUBA O ESTÚDIO SE FOR IGNORADO.**
   * Para KTX2 dentro de `.glb`, `KHR_texture_basisu` entra em
   * `extensionsRequired` — não há fonte de reserva —, e o `GLTFLoader` LANÇA
   * se o `KTX2Loader` não estiver registrado. Um asset publicado antes do
   * código não degrada: quebra. **Código primeiro, assets depois** — o inverso
   * da ordem registrada para a troca de assets do estúdio.
   */
  groundVariant: '' | '@1k' | '@ktx2';
  /**
   * A variante dos HDRs de ambiente.
   *
   * O par dia+noite do distrito, mais o alvo de mistura e o PMREM, somam
   * **75,5 MB**. A 1024×512 isso cai para **18,9 MB** e o download de 9,53 para
   * ~2,4 MB, e — o que importa mais no arrasto do relógio — **a assadura do
   * PMREM fica ~4× mais barata**, porque o custo escala com a área: os picos de
   * 10-40 ms viram 3-10 ms.
   *
   * Custo visual: o PMREM já borra o irradiance, então a ILUMINAÇÃO não sofre
   * nada perceptível — quem sofre é o FUNDO, que é a mesma textura posta em
   * `scene.background`. Defensável no Médio, certo no Baixo, **nunca na Alta**.
   */
  hdrVariant: '' | '@1k';
}

/* ---------------------------------------------------------------------------
   AS TABELAS

   Os números do nível ALTO não são "o máximo que dá": são, valor por valor, o
   que o estúdio já fazia. `renderScale: 1` é a ausência de escala;
   `pixelRatioCap: 2` era `min(dpr,2)`; 3072 era `SHADOW_MAP_SIZE`; 8 era
   `TEXTURE_ANISOTROPY`; `full` era a passada inteira. Se esta tabela e o código
   divergirem, é a TABELA que está errada.
   --------------------------------------------------------------------------- */

const PROFILES: Record<QualityLevel, QualityProfile> = {
  alta: {
    renderScale: 1,
    pixelRatioCap: 2,
    shadowMapSize: 3072,
    anisotropyVehicle: 8,
    anisotropyGround: 16,          // "o máximo do dispositivo", aparado adiante
    floorReflection: 'full',
    orangePeel: true,
    flakeOctaves: 2,
    vegetation: 1,
    seeThroughSamples: 8,
    lodMinPx: 0,                   // desligado
    probeSize: 256,
    pmremSteps: 12,
    pmremMinMs: 110,
    envCacheMax: 3,
    rainAmount: 1,
    rainRipples: true,
    ceilingSpots: true,
  },
  media: {
    renderScale: 0.8,              // 64 % dos fragmentos
    pixelRatioCap: 1.5,
    shadowMapSize: 2048,
    anisotropyVehicle: 4,
    anisotropyGround: 8,
    /* 'lod' e não 'off': o Estúdio é o cenário que existe para JULGAR COR, e um
       piso sem reflexo muda a leitura da lataria. O que sai do reflexo é o que
       não sobrevive a mip 4 — parafuso, ferragem, pneu. */
    floorReflection: 'lod',
    /* SAI NO MÉDIO, e este é o degrau grande e barato: ~860 ALU por fragmento
       pintado, ~44 % do custo do shader de tinta, contra o efeito mais sutil
       dos três acima de 2 m. Na versão anterior ele ficava ligado no Médio, o
       que era deixar o maior ganho barato na mesa. */
    orangePeel: false,
    flakeOctaves: 2,
    vegetation: 0.6,
    seeThroughSamples: 8,
    lodMinPx: 1.5,
    probeSize: 256,
    pmremSteps: 8,
    pmremMinMs: 150,
    envCacheMax: 3,
    rainAmount: 0.7,
    rainRipples: true,
    ceilingSpots: true,
  },
  baixa: {
    renderScale: 0.65,             // 42 % dos fragmentos
    pixelRatioCap: 1.25,
    /* 2048 E NÃO 1024, de propósito — é a correção de um erro da versão
       anterior. O passe de sombra é limitado por GEOMETRIA, não por resolução:
       encolher o mapa não acelera a escrita, e a leitura já vai cair de 17 taps
       para 1 pelo `shadowType: 'basic'`. Manter 2048 devolve metade da serrilha
       que o filtro de 1 tap introduz, por 12,6 MB. Um tap a 2048² é
       dramaticamente melhor que 17 taps a 1024². */
    shadowMapSize: 2048,
    anisotropyVehicle: 2,
    anisotropyGround: 2,
    floorReflection: 'off',
    orangePeel: false,
    flakeOctaves: 1,
    vegetation: 0.35,
    seeThroughSamples: 4,
    lodMinPx: 3,
    probeSize: 128,
    pmremSteps: 6,
    pmremMinMs: 200,
    envCacheMax: 2,
    rainAmount: 0.45,
    rainRipples: false,
    ceilingSpots: false,
  },
};

const COLD: Record<QualityLevel, ColdProfile> = {
  alta:  { antialias: true, spotPool: 14, shadowType: 'pcf',   groundVariant: '',      hdrVariant: '' },
  media: { antialias: true, spotPool: 6,  shadowType: 'pcf',   groundVariant: '@ktx2', hdrVariant: '' },
  baixa: { antialias: true, spotPool: 0,  shadowType: 'basic', groundVariant: '@ktx2', hdrVariant: '@1k' },
};

/* ---------------------------------------------------------------------------
   VARIANTES DE ASSET — o que a tabela PEDE contra o que existe no servidor

   A tabela acima é a INTENÇÃO. Os arquivos podem não estar publicados ainda, e
   pedir um asset inexistente é um 404 — que neste engine degrada em SILÊNCIO,
   porque quase todo carregador aqui resolve `null` em vez de lançar (é o que
   `core/paths.ts` chama de "sintoma de um 404 mudo").

   Então a variante só é emitida quando o MANIFESTO a declara. Isso é
   deliberadamente mais estrito que um retry no `onError`: um retry custa 16
   requisições perdidas por boot enquanto o deploy dos arquivos não chega, e —
   pior — esconde um deploy pela metade, em que metade dos mapas veio na
   variante e metade não. Manifesto e arquivos sobem no mesmo ato; a declaração
   é a prova de que subiram.

   Quem alimenta isto é `catalog.ts` ao ler `environments.json`, e o valor
   vazio (o padrão) significa "só os arquivos de sempre". */
let availableVariants: string[] = [];

/** Declarado pelo manifesto. `['@1k', '@ktx2']` libera os dois sufixos. */
export function setAvailableVariants(list: readonly string[] | null | undefined) {
  availableVariants = Array.isArray(list) ? list.filter((s) => typeof s === 'string') : [];
}

/** A variante de chão que de fato vai ser pedida — a da tabela, se ela existir
 *  no servidor, ou a de sempre. É esta que `scene/set.ts` consulta.
 *
 *  ⚠️ Ela lê o nível VIGENTE, e o nível pode mudar no meio da sessão. Quem
 *  monta URL tem de chamá-la no momento da carga, nunca guardar o resultado num
 *  const de módulo — senão a variante fica congelada no nível em que a página
 *  abriu, que é o mesmo defeito que `textureAnisotropy()` teve de virar função
 *  para não ter. */
export const groundVariant = (): string => coldProfile().groundVariant;

/** Idem para o HDR. Ver `scene/environment.ts`. */
export const hdrVariant = (): string => coldProfile().hdrVariant;

/* ---------------------------------------------------------------------------
   A ESCALA DINÂMICA — a faixa de cada nível e o alvo que ela persegue

   Um nível não é UM valor de `renderScale`: é uma FAIXA e um alvo de tempo de
   quadro. O valor da tabela acima é onde o nível ABRE; o controlador anda dentro
   da faixa para segurar o alvo.

   Isto é o que separa "mais rápido em média" de "fluido": a percepção de
   travamento vem da VARIÂNCIA do tempo de quadro, não da média. Uma cena que
   oscila entre 40 e 90 fps parece pior que uma presa em 45.

   Os alvos são diferentes de propósito. Alta e Média perseguem 60 fps porque
   quem está nesses níveis tem máquina para isso. Baixa persegue **45 fps**, e
   não 60: numa integrada, exigir 16,7 ms faria o controlador afundar a
   resolução até o ilegível perseguindo um alvo inalcançável. 45 é o ponto em
   que o arrasto já lê como contínuo e ainda sobra resolução.
   --------------------------------------------------------------------------- */

export interface ScaleBand {
  min: number; max: number; targetMs: number;
}

const BANDS: Record<QualityLevel, ScaleBand> = {
  alta:  { min: 0.85, max: 1,    targetMs: 16.7 },
  media: { min: 0.65, max: 1,    targetMs: 16.7 },
  baixa: { min: 0.50, max: 0.85, targetMs: 22.2 },
};

/** A faixa em que a escala dinâmica pode andar no nível vigente. */
export const scaleBand = (l: QualityLevel = qualityLevel()): ScaleBand => ({ ...BANDS[l] });

/* ---------------------------------------------------------------------------
   A SONDA ESTÁTICA
   --------------------------------------------------------------------------- */

export interface HardwareProbe {
  /** Há WebGL2? Sem isso o engine não sobe: three r163+ é WebGL2-only. */
  webgl2: boolean;
  /** A string do adaptador, ou `null` quando mascarada. `null` é DESCONHECIDO. */
  renderer: string | null;
  /** O adaptador é um rasterizador de SOFTWARE. É o único veredito de hardware
   *  em que esta sonda tem certeza. */
  software: boolean;
  /** Adaptador INTEGRADO reconhecido — memória compartilhada com a CPU. É um
   *  TETO de nível, não uma parcela de pontuação. Ver `suggestLevel`. */
  integrated: boolean;
  /** Integrada reconhecidamente ANTIGA ou de classe móvel baixa. Teto mais
   *  baixo ainda. */
  weakHint: boolean;
  cores: number;
  /** GB, só no Chromium; 0 = não informado. */
  memoryGB: number;
  maxTextureSize: number;
  maxAnisotropy: number;
  /** Pixels que a tela pede, já com o DPR — o que importa mais que a GPU. */
  pixels: number;
  touch: boolean;
}

/* Rasterizadores de software. Esta lista é de CERTEZA: qualquer uma destas
   strings significa que não há placa envolvida, e nenhum ajuste de qualidade
   conserta isso. */
const SOFTWARE_RE = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic|apple software/i;

/* ADAPTADORES INTEGRADOS, incluindo os MODERNOS.
   ---------------------------------------------------------------------------
   Esta lista existe porque a versão anterior só reconhecia integradas ANTIGAS
   (`intel hd/uhd`, `vega 3/8`, `mali`, `adreno`) e as tratava como uma parcela
   de −2 que os bônus de CPU e memória cancelavam. Duas correções:

   1. Ela reconhece também Iris Xe, as Radeon 6xxM/7xxM da série Ryzen, e as
      Intel Arc integradas (Meteor Lake). São integradas boas, mas continuam
      partilhando banda com a CPU — que é o recurso que esta cena esgota.
   2. Casar aqui é um TETO (`media`), não um desconto.

   ⚠️ Apple Silicon NÃO entra. Um M1/M2/M3 é memória unificada, não "integrada"
   no sentido que importa aqui: a banda é de 100-400 GB/s, uma ordem de grandeza
   acima de um DDR4 de dois canais. Ele é julgado pelo medidor como qualquer
   outra máquina desconhecida. */
const INTEGRATED_RE =
  /(intel).*(hd|uhd|iris|arc)\s*graphics|intel\(r\) (hd|uhd|iris)|vega\s?\d{1,2}\b|radeon\s?(6|7)\d0m\b|radeon graphics|adreno|mali|powervr|videocore|llvmpipe/i;

/* Famílias reconhecidamente modestas ou antigas — teto `baixa`. Esta lista é de
   PALPITE e só empurra o chute inicial: o medidor corrige em segundos, e uma
   máquina boa que caia aqui sobe sozinha. */
const WEAK_RE =
  /(intel).*(hd) graphics (2|3|4|5)\d\d\b|gma|radeon r[2-5]\b|mali-?[gt]?[0-6]|adreno\s?[1-5]\d\d|videocore|geforce (8|9|2\d\d|3\d\d|4\d\d|5\d\d|610m|710m|810m)/i;

let probed: HardwareProbe | null = null;

/**
 * Sonda o adaptador. Memoizada: cria UM canvas descartável e o solta.
 *
 * Roda antes de qualquer coisa do engine e não pode lançar em hipótese nenhuma
 * — ela é justamente o que existe para transformar "o app quebrou" numa tela
 * que diz o que fazer.
 */
export function probeHardware(): HardwareProbe {
  if (probed) return probed;
  const out: HardwareProbe = {
    webgl2: false, renderer: null, software: false, integrated: false,
    weakHint: false, cores: 0, memoryGB: 0, maxTextureSize: 0, maxAnisotropy: 0,
    pixels: 0, touch: false,
  };
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    out.cores = nav.hardwareConcurrency || 0;
    out.memoryGB = nav.deviceMemory || 0;
    out.pixels = Math.round(
      (window.innerWidth || 1280) * (window.innerHeight || 720)
      * Math.min(window.devicePixelRatio || 1, 2));
    out.touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const gl = canvas.getContext('webgl2', {
      failIfMajorPerformanceCaveat: false,
      powerPreference: 'high-performance',
    }) as WebGL2RenderingContext | null;
    if (!gl) return (probed = out);
    out.webgl2 = true;
    out.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    out.maxAnisotropy = aniso
      ? gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 0 : 0;

    /* MASCARADO NO FIREFOX POR PRIVACIDADE. Um `null` aqui é "não sei", e a
       política de `null` é tratar como máquina BOA — ver o aviso no cabeçalho. */
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      const s = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
      if (typeof s === 'string' && s) {
        out.renderer = s;
        out.software = SOFTWARE_RE.test(s);
        out.integrated = !out.software && INTEGRATED_RE.test(s);
        out.weakHint = !out.software && WEAK_RE.test(s);
      }
    }
    /* Solta o contexto na hora: um contexto WebGL vivo conta para o limite do
       navegador (~16), e este já respondeu tudo que tinha a responder. */
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { /* sonda nunca lança — ver o doc */ }
  return (probed = out);
}

/**
 * O nível que a sonda estática sugere, antes de qualquer quadro desenhado.
 *
 * ---------------------------------------------------------------------------
 * A MUDANÇA DE FORMA, E O CASO QUE A OBRIGOU
 *
 * A versão anterior somava sinais e comparava a soma com dois limiares. Isso
 * misturava categorias: `weakHint` valia −2 e núcleos, memória e
 * `maxTextureSize` valiam +1 cada. Num **i5 de 10ª geração com UHD 630, 16 GB e
 * 12 threads** a conta dava **+1 ⇒ `alta`** — ou seja, exatamente a máquina que
 * este trabalho existe para atender abria no nível mais pesado, e só o medidor
 * (que media a coisa errada) podia rebaixá-la.
 *
 * O erro conceitual é somar CPU com GPU. Uma CPU boa não torna uma integrada
 * rápida; ela só garante que o gargalo será a GPU. Então:
 *
 *   · a classe do ADAPTADOR impõe um TETO;
 *   · os demais sinais só podem BAIXAR dentro desse teto, nunca furá-lo para
 *     cima.
 */
export function suggestLevel(p = probeHardware()): QualityLevel {
  if (!p.webgl2) return 'baixa';
  /* Rasterizador de software: nem o nível Baixo salva, mas é o menos ruim, e é
     o único caso em que esta função tem CERTEZA em vez de palpite. */
  if (p.software) return 'baixa';

  /* O TETO, pela classe do adaptador. `null` (Firefox) não é teto nenhum. */
  let ceiling: QualityLevel = 'alta';
  if (p.weakHint) ceiling = 'baixa';
  else if (p.integrated) ceiling = 'media';

  /* Agora os rebaixamentos, dentro do teto. Nenhum sozinho decide. */
  let score = 0;
  if (p.touch) score -= 1;
  if (p.cores && p.cores <= 4) score -= 1;
  if (p.memoryGB && p.memoryGB <= 4) score -= 2;
  else if (p.memoryGB && p.memoryGB <= 8) score -= 1;
  /* PIXELS A PREENCHER, que importa mais que a placa: um 4K numa integrada é
     pior que um 1080p na mesma integrada, e o custo é o mesmo shader. Numa
     integrada o peso é dobrado — é ela que paga a banda. */
  if (p.pixels > 5_000_000) score -= p.integrated ? 2 : 1;
  else if (p.pixels > 3_000_000 && p.integrated) score -= 1;

  let idx = LEVELS.indexOf(ceiling);
  if (score <= -3) idx -= 2;
  else if (score <= -1) idx -= 1;
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, idx))];
}

/* ---------------------------------------------------------------------------
   O ESTADO, E A MEMÓRIA DELE
   --------------------------------------------------------------------------- */

/* Mesma família de chave do resto do estúdio (`truckstudio.hud.v1`). A versão
   subiu para v2 porque o formato ganhou campos; um v1 no disco é lido pelo que
   ele tem e o resto assume o padrão. */
const KEY = 'truckstudio.quality.v2';
const KEY_LEGACY = 'truckstudio.quality.v1';

let mode: QualityMode = 'auto';
let level: QualityLevel = 'alta';
/** A escala de render corrente. Começa no valor do nível e é dirigida pelo
 *  controlador dinâmico dentro da faixa. Um número separado de `PROFILES`
 *  porque ele muda muito mais rápido que o nível. */
let scale = 1;
let hydrated = false;

/** A assinatura fria APLICADA — o que o contexto de GPU vivo realmente tem.
 *  Diferente de `COLD[level]` sempre que há uma mudança fria pendente. */
let appliedCold: ColdProfile = { ...COLD.alta };

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(KEY_LEGACY);
    if (raw) {
      const j = JSON.parse(raw) as { mode?: string };
      if (j.mode === 'auto' || j.mode === 'alta' || j.mode === 'media' || j.mode === 'baixa') {
        mode = j.mode;
      }
    }
  } catch { /* storage bloqueado: o padrão vale */ }
  level = mode === 'auto' ? suggestLevel() : mode;
  scale = PROFILES[level].renderScale;
  /* No boot a assinatura fria é aplicada por construção: `scene.ts` lê
     `coldProfile()` no escopo de módulo, antes de o renderer existir. */
  appliedCold = coldProfile(level);
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ mode })); } catch { /* idem */ }
}

const listeners: ((l: QualityLevel, m: QualityMode) => void)[] = [];
/** Avisado a cada mudança EFETIVA de nível, e também quando só o modo muda. */
export function onQualityChange(cb: (l: QualityLevel, m: QualityMode) => void) {
  listeners.push(cb);
  return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); };
}
const emit = () => { for (const cb of listeners) cb(level, mode); };

const scaleListeners: ((s: number) => void)[] = [];
/** Avisado a cada mudança de ESCALA DE RENDER — muito mais frequente que a de
 *  nível, e por isso num canal próprio: quem só liga para o nível não pode ser
 *  acordado a cada degrau de resolução. */
export function onScaleChange(cb: (s: number) => void) {
  scaleListeners.push(cb);
  return () => { const i = scaleListeners.indexOf(cb); if (i >= 0) scaleListeners.splice(i, 1); };
}

export function qualityLevel(): QualityLevel { hydrate(); return level; }
export function qualityMode(): QualityMode { hydrate(); return mode; }

/**
 * O perfil QUENTE vigente, já limitado pelo que o adaptador REALMENTE tem.
 *
 * O limite é aplicado aqui e não na tabela porque a tabela é a INTENÇÃO e o
 * device é o fato: pedir anisotropia 16 a uma placa que dá 4 não é erro, é um
 * pedido que o three apara sozinho — mas aparar aqui deixa `getProfile()`
 * dizendo a verdade sobre o que vai acontecer, e é isso que a interface mostra.
 */
export function getProfile(): QualityProfile {
  hydrate();
  const p = PROFILES[level];
  const hw = probeHardware();
  const maxA = hw.maxAnisotropy || 1;
  const maxT = hw.maxTextureSize || 2048;
  return {
    ...p,
    /* A escala VIVA, não a da tabela: o controlador dinâmico é quem manda. */
    renderScale: scale,
    anisotropyVehicle: Math.min(p.anisotropyVehicle, maxA),
    anisotropyGround: Math.min(p.anisotropyGround, maxA),
    shadowMapSize: Math.min(p.shadowMapSize, maxT),
  };
}

/**
 * O perfil FRIO que o nível vigente PEDE — já com as variantes aparadas pelo
 * que o servidor declara ter.
 *
 * A aparagem acontece AQUI e não no ponto de uso pela mesma razão que
 * `getProfile()` apara a anisotropia contra o device: a tabela é a intenção, o
 * servidor é o fato, e quem lê este objeto precisa que ele diga a verdade sobre
 * o que vai acontecer. Sem isso `coldPending()` acusaria uma mudança pendente
 * para sempre num servidor que não tem as variantes, e a interface ficaria
 * oferecendo um "recarregar a cena" que não muda nada.
 */
export function coldProfile(l: QualityLevel = qualityLevel()): ColdProfile {
  const c = COLD[l];
  return {
    ...c,
    groundVariant: (c.groundVariant && availableVariants.includes(c.groundVariant)
      ? c.groundVariant : '') as ColdProfile['groundVariant'],
    hdrVariant: (c.hdrVariant && availableVariants.includes(c.hdrVariant)
      ? c.hdrVariant : '') as ColdProfile['hdrVariant'],
  };
}

/** O perfil FRIO que o contexto de GPU vivo realmente tem. */
export const appliedColdProfile = (): ColdProfile => ({ ...appliedCold });

/**
 * Há mudança fria pendente? Ou seja: o nível vigente pede uma configuração de
 * shader/contexto/asset diferente da que está no ar.
 *
 * Quem responde "sim" a isto é quem decide subir a cortina. `studio.ts` chama
 * nas bordas naturais de carga; o painel de configurações chama para mostrar o
 * aviso de "aplicar exige recarregar a cena".
 */
export function coldPending(): boolean {
  hydrate();
  const want = coldProfile(level);
  return want.antialias !== appliedCold.antialias
    || want.spotPool !== appliedCold.spotPool
    || want.shadowType !== appliedCold.shadowType
    || want.groundVariant !== appliedCold.groundVariant
    || want.hdrVariant !== appliedCold.hdrVariant;
}

/** Marca a assinatura fria como aplicada. Chamado por quem acabou de reconstruir
 *  o contexto — e só por ele. */
export function markColdApplied() {
  hydrate();
  appliedCold = coldProfile(level);
}

/**
 * O perfil do TETO, seja qual for o nível vigente.
 *
 * Existe para a CAPTURA, e é a única coisa neste módulo que serve para IGNORAR
 * o perfil em vez de aplicá-lo. A regra do cabeçalho diz que a imagem baixada é
 * o produto e não se degrada nunca; a resolução de render já obedece por
 * construção (a captura tem alvo próprio), mas o mapa de sombra é global do
 * renderizador e obedeceria ao nível se ninguém o levantasse.
 *
 * ⚠️ O que ele NÃO conserta, e não tem como: `spotPool` e `shadowType` são
 * frios. Uma foto tirada no nível Baixo sai com o pool e o filtro do nível
 * Baixo, porque trocá-los exigiria recompilar a cena no meio da captura. Isso é
 * uma exceção CONHECIDA à regra "a foto sai no teto", e a resposta de produto é
 * a interface avisar — não o código fingir que não existe.
 */
export const ceilingProfile = (): QualityProfile => {
  const hw = probeHardware();
  const p = PROFILES.alta;
  return {
    ...p,
    anisotropyVehicle: Math.min(p.anisotropyVehicle, hw.maxAnisotropy || 1),
    anisotropyGround: Math.min(p.anisotropyGround, hw.maxAnisotropy || 1),
    shadowMapSize: Math.min(p.shadowMapSize, hw.maxTextureSize || 3072),
  };
};

/** Compatibilidade: o lado do mapa de sombra do teto. */
export const ceilingShadowMapSize = () => ceilingProfile().shadowMapSize;

/** O perfil de um nível qualquer, sem mexer no vigente (a bancada usa). */
export const profileOf = (l: QualityLevel): QualityProfile => ({ ...PROFILES[l] });
export const coldOf = (l: QualityLevel): ColdProfile => ({ ...COLD[l] });

/* ---------------------------------------------------------------------------
   A ESCALA DE RENDER — o controlador
   --------------------------------------------------------------------------- */

/* Degraus discretos, e não um contínuo. Duas razões, ambas concretas:

   1. Trocar a escala REALOCA o drawing buffer, e um buffer novo nasce em
      branco — `resize()` invalida por isso. Além dele, `floor-reflection.ts`
      realoca o próprio alvo (HalfFloat, mipmaps, MSAA 4) sempre que as
      dimensões mudam. Um contínuo pagaria isso a cada quadro.
   2. O que o usuário percebe é a IMAGEM MUDANDO, não o fps — a mesma lição que
      `MAX_DROPS` registra. Degraus largos com banda morta larga mudam pouco e
      raramente. */
const STEPS = [0.5, 0.58, 0.65, 0.72, 0.8, 0.88, 1];

/* CADÊNCIA ASSIMÉTRICA, e ela é a segunda metade do conserto da piscada.
   ---------------------------------------------------------------------------
   A primeira metade está em `scene.ts` (aplicar a escala no topo do quadro, e
   não depois do `render()`, senão o canvas limpo é apresentado). Esta aqui é
   sobre a FREQUÊNCIA: mesmo sem flash, uma máquina parada em cima do alvo
   ficaria subindo e descendo um degrau a cada segundo, e uma imagem que muda de
   nitidez em cadência é pior que uma imagem um degrau abaixo do ideal.

   DESCER é urgente — o usuário está sofrendo agora. SUBIR pode esperar: ele não
   está perdendo nada enquanto espera, e cada subida é uma realocação de buffer.
   Daí três segundos para subir contra novecentos milissegundos para descer, e
   uma banda morta larga o bastante para o ruído normal de um quadro não a
   atravessar. É a mesma lógica das duas janelas do medidor de NÍVEL, um degrau
   abaixo. */
const SCALE_COOLDOWN_DOWN = 900;
const SCALE_COOLDOWN_UP = 3000;
/** Banda morta em volta do alvo. Assimétrica pelo mesmo motivo: reage a 8 %
 *  acima do alvo, mas só devolve resolução com 25 % de folga — assim uma
 *  máquina que está exatamente no limiar assenta no degrau de baixo em vez de
 *  oscilar entre os dois. */
const DEAD_LOW = 0.75, DEAD_HIGH = 1.08;

let lastScaleStep = 0;

/** A escala de render corrente. */
export const renderScale = () => { hydrate(); return scale; };

function setScale(next: number, why: string) {
  if (Math.abs(next - scale) < 1e-4) return;
  const from = scale;
  scale = next;
  console.info(`[qualidade] escala ${from.toFixed(2)} → ${next.toFixed(2)} · ${why}`);
  for (const cb of scaleListeners) cb(scale);
}

/** Força a escala (a bancada e o console usam; a interface, quando o usuário
 *  fixa um valor). Sai da faixa do nível se pedirem — é escolha explícita. */
export function setRenderScale(s: number) {
  hydrate();
  setScale(Math.max(0.35, Math.min(2, s)), 'escolha do usuário');
}

/* ---------------------------------------------------------------------------
   O MEDIDOR — o único juiz honesto
   --------------------------------------------------------------------------- */

/* Média móvel exponencial do tempo de quadro. Curta o bastante para reagir e
   longa o bastante para não perseguir um pico. */
const EMA_ALPHA = 0.1;
/* Sobe de NÍVEL com folga sustentada; desce com aperto sustentado. As duas
   janelas são DIFERENTES de propósito: descer é urgente (o usuário está
   sofrendo agora), subir pode esperar (ele não está perdendo nada).

   ⚠️ OS LIMIARES SÃO RELATIVOS AO ALVO DO NÍVEL, e não absolutos. A versão
   anterior usava 13 ms e 28 ms fixos, escritos contra um orçamento de 60 Hz —
   então numa máquina com alvo de 45 fps (22,2 ms) o gatilho de descida disparava
   com a máquina ainda DENTRO da meta, rebaixando quem estava entregando o que
   se pediu. */
const UP_FACTOR = 0.75, UP_HOLD = 5000;
const DOWN_FACTOR = 1.6, DOWN_HOLD = 2500;
/* Um degrau de NÍVEL por vez, e nunca dois seguidos sem respiro. */
const STEP_COOLDOWN = 12000;
/* Teto de descidas de nível por sessão, para o caso patológico de uma máquina
   que oscile em volta do limiar. */
const MAX_DROPS = 3;

let ema = 0;
let goodSince = 0, badSince = 0, lastStep = 0, drops = 0;
/** Segundo canal: o tempo de SUBMISSÃO do `render()`. Serve para distinguir
 *  "limitado por CPU" de "limitado por GPU", que é a decisão de QUAL degrau
 *  puxar — resolução não conserta um gargalo de chamadas de desenho. */
let emaSubmit = 0;

function resetMeter() { ema = emaSubmit = 0; goodSince = badSince = 0; }

/**
 * Um quadro DESENHADO levou `wallMs` de parede, dos quais `submitMs` foram a
 * submissão do `renderer.render()`.
 *
 * ---------------------------------------------------------------------------
 * POR QUE A RÉGUA MUDOU, E ESTA É A CORREÇÃO MAIS IMPORTANTE DESTE ARQUIVO
 *
 * A versão anterior media SÓ o `render()`, com o argumento de que "o que está
 * fora dele é trabalho de CPU que não muda com o perfil, e incluí-lo diluiria o
 * sinal". A premissa é falsa exatamente no hardware que interessa:
 *
 *   · num i5, o que domina é `updateSeeThrough` (~650 objetos, 60×/s,
 *     inclusive em quadro pulado), a submissão de ~2 400 chamadas e o passe de
 *     sombra — e o medidor não via nada disso;
 *   · `performance.now()` em volta do `render()` mede SUBMISSÃO, não execução.
 *     Com `setAnimationLoop` preso ao vsync, uma GPU saturada deixa o bloqueio
 *     no swap, FORA do `render()`. O medidor lia "está tudo bem" numa máquina a
 *     20 fps.
 *
 * A régua honesta é o tempo de parede entre quadros DESENHADOS: ela inclui CPU,
 * GPU, compositor e swap — que é o que o usuário sente.
 *
 * ⚠️ **SÓ ENTRE DOIS QUADROS DESENHADOS CONSECUTIVOS.** Com o laço sob demanda,
 * o intervalo entre um quadro desenhado e o próximo pode conter minutos de cena
 * parada. Quem chama é responsável por passar `wallMs` só quando o quadro
 * anterior também foi desenhado — ver o laço em `scene/scene.ts`.
 *
 * `busy` é a trava contra aprender a coisa errada: gravação em curso, tween de
 * preset, carga de veículo ou de cenário. Todos são picos CONHECIDOS, e adaptar
 * em cima de um pico conhecido faria o nível cair toda vez que o usuário
 * trocasse de caminhão — o momento em que ele mais está olhando.
 */
export function reportFrameTime(wallMs: number, submitMs: number, busy: boolean) {
  hydrate();

  /* ---------------- MEDIR E ADAPTAR SÃO COISAS DIFERENTES ----------------
     A versão anterior saía na PRIMEIRA linha quando `mode !== 'auto'`, e isso
     era um defeito com consequência direta na interface: **congelar um nível
     parava o medidor**. `frameTimeEma()` e `submitTimeEma()` continuavam
     devolvendo a última leitura feita em automático, e o painel de
     Configurações mostrava um número velho com cara de atual.

     E o caso que mais dói é justamente esse: quem fixa "Baixa" para comparar
     com "Alta" é exatamente quem precisa do número. Um diagnóstico que congela
     junto com o nível é pior que não ter diagnóstico, porque ele MENTE em vez
     de se calar.

     Então a régua roda sempre; só a ADAPTAÇÃO obedece ao modo. */
  if (busy || !Number.isFinite(wallMs) || wallMs <= 0 || wallMs > 400) {
    /* `busy` continua descartando a amostra nos DOIS papéis, e de propósito: um
       pico conhecido (gravação, tween, carga) não é o regime permanente, e
       incluí-lo faria o painel relatar um tempo de quadro que a pessoa não vive.
       O EMA significa "quadro em regime", tanto para adaptar quanto para
       mostrar. */
    goodSince = badSince = 0; return;
  }
  ema = ema ? ema + (wallMs - ema) * EMA_ALPHA : wallMs;
  if (Number.isFinite(submitMs) && submitMs > 0) {
    emaSubmit = emaSubmit ? emaSubmit + (submitMs - emaSubmit) * EMA_ALPHA : submitMs;
  }

  /* Daqui para baixo é ADAPTAÇÃO, e ela é um direito do usuário congelar. */
  if (mode !== 'auto') return;

  const now = performance.now();
  const band = BANDS[level];

  /* ---- PRIMEIRO A ESCALA, que é barata, reversível e não muda a imagem
     autorada. Só quando ela satura é que o NÍVEL se mexe. Essa ordem é o que
     evita o defeito da versão anterior: descer de nível (perdendo sombra e
     casca de laranja) antes de ter tentado o botão que realmente devolve
     quadros. ---- */
  {
    const i = STEPS.findIndex((s) => Math.abs(s - scale) < 1e-4);
    const cur = i >= 0 ? i : STEPS.reduce(
      (best, s, k) => (Math.abs(s - scale) < Math.abs(STEPS[best] - scale) ? k : best), 0);
    const desceu = now - lastScaleStep > SCALE_COOLDOWN_DOWN;
    const subiu = now - lastScaleStep > SCALE_COOLDOWN_UP;
    if (!desceu) { /* nem descer nem subir ainda */ }
    else if (ema > band.targetMs * DEAD_HIGH) {
      /* Não desce abaixo do piso da faixa: aí o problema não é resolução, e
         continuar cortando só borra a imagem sem devolver quadro. */
      if (STEPS[cur] > band.min + 1e-4 && cur > 0) {
        lastScaleStep = now;
        setScale(Math.max(band.min, STEPS[cur - 1]), `${ema.toFixed(1)} ms de quadro`);
        return;
      }
    } else if (subiu && ema < band.targetMs * DEAD_LOW) {
      if (STEPS[cur] < band.max - 1e-4 && cur < STEPS.length - 1) {
        lastScaleStep = now;
        setScale(Math.min(band.max, STEPS[cur + 1]), `${ema.toFixed(1)} ms de quadro`);
        return;
      }
    }
  }

  /* ---- DEPOIS O NÍVEL, e só quando a escala já está no fim da faixa. ---- */
  if (now - lastStep < STEP_COOLDOWN) return;

  if (ema > band.targetMs * DOWN_FACTOR && scale <= band.min + 1e-4) {
    goodSince = 0;
    if (!badSince) badSince = now;
    else if (now - badSince > DOWN_HOLD && drops < MAX_DROPS) {
      const i = LEVELS.indexOf(level);
      if (i > 0) {
        drops++;
        lastStep = now; badSince = 0;
        setLevel(LEVELS[i - 1], `${ema.toFixed(1)} ms por quadro sustentados`);
      }
    }
  } else if (ema < band.targetMs * UP_FACTOR && scale >= band.max - 1e-4) {
    badSince = 0;
    if (!goodSince) goodSince = now;
    else if (now - goodSince > UP_HOLD) {
      const i = LEVELS.indexOf(level);
      if (i < LEVELS.length - 1) {
        lastStep = now; goodSince = 0;
        setLevel(LEVELS[i + 1], `${ema.toFixed(1)} ms por quadro sustentados`);
      }
    }
  } else {
    goodSince = badSince = 0;
  }
}

/** Tempo de quadro de PAREDE médio medido, em ms. 0 = ainda não mediu. */
export const frameTimeEma = () => ema;
/** Tempo de SUBMISSÃO médio, em ms. Comparado com `frameTimeEma()` diz onde
 *  está o gargalo: se os dois são próximos, é GPU/submissão; se a parede é
 *  muito maior, é CPU fora do `render()` ou espera de vsync. */
export const submitTimeEma = () => emaSubmit;

function setLevel(next: QualityLevel, why: string) {
  if (next === level) return;
  const from = level;
  level = next;
  /* A escala reabre no valor do nível novo: a faixa mudou, e manter a escala
     velha entregaria um nível Baixo desenhando em resolução de nível Alto. */
  const want = PROFILES[next].renderScale;
  const band = BANDS[next];
  scale = Math.max(band.min, Math.min(band.max, want));
  console.info(`[qualidade] ${from} → ${next} · ${why}`);
  emit();
  for (const cb of scaleListeners) cb(scale);
}

/**
 * A escolha do usuário. `auto` devolve a decisão ao medidor; um nome a CONGELA.
 *
 * Congelar é um direito, e é por isso que o medidor nem é consultado depois:
 * quem escolheu Alta num PC fraco escolheu ver 20 fps, e passar por cima disso
 * seria o app discordando de uma decisão explícita.
 */
export function setQualityMode(next: QualityMode) {
  hydrate();
  mode = next;
  save();
  if (next === 'auto') {
    resetMeter();
    drops = 0;
    setLevel(suggestLevel(), 'automático, pela sonda de hardware');
  } else {
    setLevel(next, 'escolha do usuário');
  }
  /* `setLevel` sai cedo quando o nível não muda, mas o MODO mudou — e a
     interface pinta o modo. */
  emit();
  /* E O FRIO VAI JUNTO — ver `setColdApplier()`. Só aqui, porque só aqui houve
     um ATO do usuário. */
  agendarFrio();
}

/* ---------------------------------------------------------------------------
   O FRIO APLICADO POR ATO DO USUÁRIO

   O DEFEITO QUE ISTO CONSERTA, e ele foi medido antes de ser consertado.

   O pool de refletores e o filtro de sombra são FRIOS: mudar de nível reescreve
   o que o nível PEDE e não toca no que está no ar. Até aqui nada aplicava a
   diferença — sobrava um botão "aplicar agora" no painel, que ninguém que não
   soubesse da existência dele iria clicar.

   O resultado prático era o pior possível: **escolher "Média" parecia fazer
   alguma coisa** (os botões quentes agiam na hora) **e deixava a maior alavanca
   intocada.** Medido na bancada, na Vega 8: o pool de 14 para 0 vale
   **120,4 ms → 50,1 ms, ou seja 2,4×** — mais que todos os botões quentes
   somados. Um usuário que descesse de nível recebia uma fração do que o nível
   promete e concluiria, de novo, que o seletor não faz nada.

   ⚠️ **E O MEDIDOR CONTINUA PROIBIDO DE LEVANTAR CORTINA.** Este gatilho está em
   `setQualityMode()` e em nenhum outro lugar; `setLevel()`, que é por onde o
   adaptador automático desce e sobe, não o chama. A regra não mudou — ela só
   passou a ter a exceção que sempre teve por escrito: *quem clicou pediu, e pode
   pagar uma cortina; quem não clicou não pode ser interrompido.*

   POR QUE UM CALLBACK E NÃO UMA CHAMADA DIRETA: este módulo é FOLHA e tem de
   continuar sendo — `scene.ts` o importa no escopo de módulo para responder
   `antialias` antes de o renderer existir. Importar `studio.ts` daqui fecharia o
   ciclo e daria `ReferenceError` no boot. Então quem sabe reconstruir se
   REGISTRA, e este módulo só sabe que existe alguém.

   POR QUE ADIADO: clicar Alta → Média → Baixa em dois segundos são três atos, e
   três cortinas seriam uma punição por explorar o controle. A espera curta
   deixa o usuário assentar numa escolha antes de pagar por ela. E ela é
   REARMADA a cada ato, então só o último vale. */
type ColdApplier = () => void | Promise<unknown>;
let coldApplier: ColdApplier | null = null;
let frioTimer: ReturnType<typeof setTimeout> | null = null;

/** Espera antes de levantar a cortina. Curta o bastante para parecer resposta
 *  ao clique, longa o bastante para absorver alguém percorrendo os quatro
 *  botões. */
const FRIO_DEBOUNCE_MS = 700;

/**
 * Registra quem sabe reconstruir a cena sob a cortina.
 *
 * `studio.ts` chama isto uma vez, com `applyColdQuality`. Sem registro nada
 * quebra: o perfil segue funcionando com os botões quentes, `coldPending()`
 * segue verdadeiro e o botão do painel de Configurações continua sendo o
 * caminho manual — que é exatamente o comportamento de antes desta função.
 */
export function setColdApplier(fn: ColdApplier | null) {
  coldApplier = fn;
}

function agendarFrio() {
  if (!coldApplier) return;
  if (frioTimer) clearTimeout(frioTimer);
  frioTimer = setTimeout(() => {
    frioTimer = null;
    /* Reconferido AGORA, e não quando foi agendado: entre o clique e este
       instante o usuário pode ter voltado ao nível de origem, e aí não há
       diferença nenhuma a aplicar — levantar cortina para não mudar nada é o
       defeito que `applyColdQuality()` já recusa para o caso do `antialias`. */
    if (!coldPending()) return;
    try {
      void coldApplier?.();
    } catch (e) {
      console.warn('[qualidade] falha ao aplicar a parte fria', e);
    }
  }, FRIO_DEBOUNCE_MS);
}

/** Cancela uma aplicação fria agendada. Para quem vai desmontar a cena — uma
 *  cortina que sobe depois da rota trocar reconstrói o que ninguém está vendo. */
export function cancelPendingColdApply() {
  if (frioTimer) { clearTimeout(frioTimer); frioTimer = null; }
}

/** Diagnóstico legível — o que a bancada, o painel de configurações e o console
 *  leem. */
export function qualityInfo() {
  const hw = probeHardware();
  return {
    modo: qualityMode(),
    nivel: qualityLevel(),
    sugestaoDaSonda: suggestLevel(),
    escalaDeRender: Math.round(scale * 100) / 100,
    faixaDaEscala: scaleBand(),
    msPorQuadro: Math.round(ema * 10) / 10,
    msDeSubmissao: Math.round(emaSubmit * 10) / 10,
    fps: ema > 0 ? Math.round(1000 / ema) : 0,
    rebaixamentos: drops,
    frioPendente: coldPending(),
    hardware: hw,
    perfil: getProfile(),
    frio: { pedido: coldProfile(), aplicado: appliedColdProfile() },
  };
}
