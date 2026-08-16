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

/* ===========================================================================
   TERCEIRA VERSÃO (2026-08-15) — A REFUNDAÇÃO DOS NÍVEIS
   ===========================================================================
   O relato que a originou tem DUAS reprovações numa frase só, e é preciso ouvir
   as duas:

       *"quero ter uma real qualidade alta, média e baixa, porque atualmente
        computadores mais simples, placa de vídeo integrada, nem mesmo o baixo
        está rodando, e isso que no baixo a qualidade visual fica horrível."*

   Um perfil que só olha milissegundos atende a primeira e agrava a segunda. A
   régua que este arquivo passa a obedecer está escrita por inteiro no cabeçalho
   de `tools/studio-bench/checks-aceitacao.mjs`, e cabe em duas linhas:

   ┌───────────────────────────────────────────────────────────────────────────┐
   │ Um nível mais baixo pode desenhar a MESMA CENA COM MENOS AMOSTRAS.        │
   │ Ele não pode desenhar UMA CENA DIFERENTE.                                │
   │                                                                          │
   │ Operacionalmente: a contagem de malhas VISÍVEIS do veículo tem de ser     │
   │ IDÊNTICA nos três níveis.                                                │
   └───────────────────────────────────────────────────────────────────────────┘

   ---------------------------------------------------------------------------
   O QUE A ABLAÇÃO DE `GARGALO-2026-08-15.md` DERRUBOU DESTA TABELA

   Três achados, e cada um matou um botão que parecia bom:

   1. **O contador de chamadas mentia, e mentia em todo documento do projeto.**
      `WebGLRenderer.render()` do three 0.179.1 zera `info` na linha 16477,
      DEPOIS de `shadowMap.render()` na 16471 — logo
      `renderer.info.render.calls` NUNCA contou o passe de sombra. O número
      verdadeiro de um quadro de arrasto é **3 804 chamadas no Alto**, não 2 400;
      e o Médio submete **3 216, ou 85 % do Alto**, não os 74 % que esta tabela
      sugeria. Todo orçamento escrito antes desta data está 40 a 70 % baixo.

   2. **`lodMinPx` cobrava qualidade e não pagava sombra.** Das 588 chamadas que
      o LOD tirava do Médio, **zero** saíam do passe de sombra — porque
      `setShadowCasters()` já tinha tirado de lá tudo abaixo de 5 cm, que é
      exatamente a população que o LOD mais toca. As duas otimizações se
      SOBREPUNHAM e ninguém percebeu, porque o contador não mostrava a sombra.
      Em troca ele sumia com parafusaria de 4 px — o "fica horrível" do relato.

   3. **`renderScale` atacava preenchimento, que era 0 % do quadro.** Medido: a
      mesma cena a **1/16 dos pixels** custou 10,33 ms contra 10,37 ms. Nesta
      classe de máquina o quadro é limitado por CHAMADA, e a chamada custa o
      mesmo seja ela de 5 % ou de 95 % dos triângulos (9,0 µs contra 7,6 µs).

   ---------------------------------------------------------------------------
   O CHÃO QUE MUDOU DEBAIXO DA TABELA: A FUSÃO POR MATERIAL

   `mergeVehicle` funde o veículo por material — **2 230 → 168 chamadas no passe
   principal, quadro 14,9× mais rápido, e a coluna dos TRIÂNGULOS NÃO MUDA.** A
   imagem é idêntica; o que sai é trabalho desperdiçado, não amostra.

   Isso reordena tudo o que vem abaixo:

     · o LOD fica **sem assunto** — ele existe para tirar chamadas de desenho, e
       não haverá chamadas para tirar. Daí `lodMinPx: 0` nos TRÊS níveis, que é
       a otimização DEVOLVENDO uma degradação que hoje está no ar;
     · com a CPU fora do caminho, a placa passa a mandar, e `renderScale` volta
       a ser um botão legítimo — a parte que escala com a placa é
       `5,2 ms + 3,75 ms·Mpx`, e uma UHD 630 tem ~1/11 da vazão de uma RX 570.
       Legítimo, e não DOMINANTE: ele é um dos vários, e a faixa dele subiu nos
       três níveis para o Baixo parar de nascer borrado.

   ⚠️ **`mergeVehicle` TEM DE VALER O MESMO NOS TRÊS NÍVEIS, e isso não é
   preguiça — é o Portão 1.** Fundir 2 146 malhas em 104 MUDA a contagem de
   malhas visíveis do veículo. Se um nível fundisse e outro não, o censo daria
   números diferentes e o portão reprovaria com razão: os dois estariam
   desenhando árvores de cena diferentes. O campo existe no perfil para a bancada
   e o console poderem DESLIGAR a fusão e medir o antes/depois — nunca como
   degrau de nível.

   ---------------------------------------------------------------------------
   PARA ONDE O CORTE FOI REDISTRIBUÍDO

   O princípio: **o corte vai para onde ele não custa peça do caminhão.** Em
   ordem de quanto devolve:

     1. `shadowRefreshHz` — o passe de sombra é **1 574 chamadas, ~40 % do
        quadro**, e rodava em **100 % dos quadros de arrasto** no Alto porque
        `seethrough.ts:823` suja o mapa a cada passo de dissolvência. Custo
        medido de uma reassadura: +6,06 ms no Alto, +5,31 ms no Médio, +4,02 ms
        no Baixo. Estrangular a 12–15 Hz é INVISÍVEL (a dissolvência muda a
        sombra de forma gradual) e devolve ~metade do quadro. É o item mais
        barato do documento inteiro.
     2. `shadowCasterMinM` — quem projeta sombra. Tira do passe de sombra
        exatamente aquilo cuja sombra o mapa não consegue expressar.
     3. `floorReflectionMsaa` — 4× multiamostrado num alvo de 1600×1080
        `HalfFloat` são **~79 dos 96,7 MB** do segundo maior item isolado de VRAM
        da cena, para antialiasar um reflexo que já é lido a mip 1,03–1,88 e
        atenuado a ≤ 42 % de contraste.
     4. `vegetation` — folhagem é `alphaTest 0.38`, ou seja `discard` no
        fragmento, ou seja **sem early-Z**: a categoria mais cara que existe numa
        integrada. E paga DUAS VEZES, porque o material de profundidade copia o
        `alphaTest` para o passe de sombra.
     5. `probeSize`, `pmremSteps`/`pmremMinMs`, `envCacheMax` — engasgo e
        memória de carga, custo visual nulo ou quase.
     6. `orangePeel` (~860 ALU por fragmento pintado) e o par frio
        `spotPool`/`shadowType`, que continuam sendo a maior alavanca de
        fragmento da casa.

   ---------------------------------------------------------------------------
   A TABELA NOVA — o que se perde, e por que aquilo não é "cena diferente"

   ┌─ QUENTES ────────────────────────────────────────────────────────────────┐

   | botão                 | Alta | Média | Baixa | o que se PERDE | por que NÃO é cena diferente |
   |---|---|---|---|---|---|
   | `renderScale`         | 1,00 | 0,88 | 0,72 | nitidez: 77 % e 52 % dos fragmentos | é literalmente "as mesmas amostras, menos delas". A imagem fica mais macia; nada some |
   | faixa da escala       | 0,80–1,00 | 0,72–1,00 | 0,58–0,88 | no piso do Baixo, ~34 % dos fragmentos | o piso SUBIU de 0,50 para 0,58 justamente porque o Baixo não pode nascer ilegível |
   | `pixelRatioCap`       | 2 | 1,5 | 1,25 | nada num monitor a dpr 1 | idem, e só em HiDPI |
   | `shadowMapSize`       | 3072 | 2048 | 2048 | nitidez da borda da sombra | ⚠️ **e PARA aqui de propósito** — ver o bloco do campo |
   | `shadowRefreshHz`     | 20 | 12 | 8 | a sombra de um prédio que está dissolvendo atrasa até 125 ms | a dissolvência é gradual e a sombra dela também; o objeto continua lá, a sombra dele continua lá |
   | `shadowCasterMinM`    | 0,05 | 0,10 | 0,15 | a sombra de contato de peças pequenas | **a peça continua desenhada.** Perde-se a SOMBRA de um parafuso, não o parafuso |
   | `mergeVehicle`        | all | all | all | nada — os triângulos são idênticos | igual nos três por obrigação do Portão 1 |
   | `anisotropyVehicle`   | 8 | 4 | 2 | textura rasante mais borrada | é filtro de amostragem, por definição |
   | `anisotropyGround`    | 16 | 8 | 4 | idem, no chão | idem |
   | `floorReflection`     | full | **full** | off | Baixa: o piso do Estúdio deixa de refletir | o reflexo é um efeito de PISO, não peça do veículo; e a captura sai sempre no teto. O degrau `'lod'` foi APOSENTADO pela fusão — ver o bloco do campo |
   | `floorReflectionMsaa` | 4 | 0 | 0 | a silhueta no reflexo cintila um pouco no giro | −79 MB de VRAM; e a leitura já é `textureLod` a mip 1,03–1,88, que é o mesmo passa-baixa que o MSAA daria |
   | `orangePeel`          | on | off | off | a micro-ondulação do verniz em close | é um uniforme de shader, não geometria. Acima de ~2 m nada muda |
   | `flakeOctaves`        | 2 | 2 | 1 | ⚠️ **NADA — ÓRFÃO.** Ver o bloco do campo | — |
   | `vegetation`          | 1,00 | 0,60 | 0,35 | bosque mais ralo | densidade de espalhamento é amostragem declarada na regra do cabeçalho. Nenhuma árvore autorada some — as instâncias são procedurais |
   | `seeThroughSamples`   | 8 | 6 | 4 | nada perceptível — é PRÉ-TESTE de corredor | ele decide QUEM dissolve, não COMO. Menos amostras = decisão um quadro mais grossa |
   | `lodMinPx`            | 0 | **0** | **0** | ⚠️ **NADA. APOSENTADO** — ver `vehicle/lod.ts` | era o único botão que apagava PEÇA. Era o "fica horrível" |
   | `probeSize`           | 256 | 128 | 128 | reflexo local mais grosseiro no cromado | passa por PMREM logo em seguida, que borra por rugosidade |
   | `pmremSteps`/`MinMs`  | 12/110 | 8/150 | 6/200 | o céu misturado atrasa alguns passos no arrasto do relógio | é defasagem temporal de uma mistura contínua; nenhum quadro parado difere |
   | `envCacheMax`         | 3 | 2 | 2 | volta mais lenta a um cenário já visitado | é cache. Não existe no quadro |
   | `rainAmount`/`Ripples`| 1,0/on | 0,7/on | 0,45/off | chuva mais rala; sem anéis de impacto | densidade de espalhamento, de novo |
   | `ceilingSpots`        | on | on | **on** | ⚠️ **NADA. APOSENTADO** — ver o bloco do campo | 3 chamadas de desenho não pagam a leitura de altura da laje |

   ┌─ FRIOS (só por ato do usuário, sob cortina) ──────────────────────────────┐

   | botão | Alta | Média | Baixa | o que se perde | por que não é cena diferente |
   |---|---|---|---|---|---|
   | `antialias` | true | true | true | nada — ver o bloco dele | — |
   | `spotPool` | 14 | 6 | 0 | a poça de luz sob os postes à noite | ⚠️ **EXCEÇÃO NOMEADA**, e a única da tabela. Ver o cabeçalho |
   | `shadowType` | pcf | pcf | basic | borda de sombra dura; `shadow.radius` deixa de existir | 17 taps viram 1: é contagem de amostras, o caso mais literal da regra |
   | `groundVariant` | — | `@ktx2` | `@ktx2` | UASTC/BC7 a 2048²: erro de 0,11 a 5,80 | mesma imagem, 1/4 dos bytes. Só entra se o manifesto declarar |
   | `hdrVariant` | — | — | `@1k` | o FUNDO de céu amolece | a ILUMINAÇÃO não muda: o PMREM já borra o irradiance |

   ---------------------------------------------------------------------------
   ⚠️⚠️ A FUSÃO ATERRISSOU, E A MEDIÇÃO MUDA COMO ESTA TABELA SE LÊ
   ===========================================================================
   Medido na bancada com `mergeVehicle: 'all'` no ar (RX 570 / Ryzen 7 5700X,
   `distrito-industrial` + Scania R 2009 4x2 + implemento, intercalado na mesma
   pose):

       chamadas (principal + sombra)  3 809 → **553**       (6,9×)
       triângulos                    12,153 M → **12,153 M — IDÊNTICOS**
       quadro                         13,84 ms → **4,18 ms** (3,3×)
       portão de pixel                ΔL médio 0,001/255, 0 % acima de 12

   E o portão de aceitação, nos três níveis:

       PORTÃO 1  PASSOU — **235 malhas visíveis, iguais nos três**
       PORTÃO 4  sombra estrangulada — 26 % / 21 % / 17 % dos quadros
       PORTÃO 3  alta **3,23 ms** → média **3,61 ms** → baixa **3,27 ms**

   ---------------------------------------------------------------------------
   ⚠️ O PORTÃO 3 NÃO DIZ QUE OS NÍVEIS PARARAM DE FUNCIONAR. ELE DIZ QUE A
   MÁQUINA DA BANCADA SAIU DE CENA — e a aritmética fecha sozinha:

       553 chamadas × ~6 µs por chamada  ≈  **3,3 ms**

   Os três números do Portão 3 são esse número. **O quadro continua sendo 100 %
   submissão**, só que num patamar 7× menor: a RX 570 termina o trabalho de GPU
   antes de a CPU conseguir alimentá-la, então preenchimento, ALU de fragmento e
   filtro de sombra não aparecem na conta. E o Portão 1 EXIGE que a contagem de
   chamadas seja igual nos três níveis. **Logo, nessa máquina, é logicamente
   impossível os três níveis diferirem.** Um Baixo a 52 % dos pixels, com 1 tap
   de sombra e zero refletores, custar o mesmo que o Alto é a confirmação disso,
   não uma contradição.

   ⚠️ **NÃO SE CONCLUI DA MÁQUINA ERRADA.** A parte que escala com a placa é
   `5,2 ms + 3,75 ms·Mpx` numa RX 570, e uma UHD 630 tem ~1/11 da vazão. É lá
   que os botões desta tabela existem, e é lá que eles se separam. O que a
   bancada prova é o contrário do que parece: que **não sobrou nenhum botão
   cobrando CPU**, que era o defeito.

   As duas leituras, separadas por classe de máquina como o GARGALO faz:

   | | RX 570 (a bancada) | UHD 630 / Iris Xe (o dono) |
   |---|---|---|
   | o que domina | submissão — 553 chamadas | preenchimento e ALU de fragmento |
   | `renderScale` | **inerte** (0 % do quadro) | **o botão** — custo cai com o quadrado |
   | `orangePeel`, `spotPool`, `shadowType`, `vegetation` | invisíveis na medida | onde o nível se decide |
   | VRAM (1 084 MB) | 8 GB dedicados, indiferente | **decide se roda**, memória compartilhada |
   | esperado do Portão 3 | os três iguais, ~3,2 ms | separação real entre os três |

   ---------------------------------------------------------------------------
   O QUE A MEDIÇÃO MANDOU CORRIGIR NESTA TABELA, e é um botão só

   O Médio ter saído **mais lento que o Alto** não é ruído tolerável, e o
   culpado é nomeável: **`floorReflection: 'lod'`**. Ele existia para tirar
   GEOMETRIA da segunda varredura do reflexo; com o implemento fundido em 45
   baldes de metros de aresta, ele não esconde mais nada — e continua percorrendo
   o grafo de cena inteiro duas vezes por segundo e escrevendo `.visible` por
   quadro. **Custa e não devolve.** Virou `'full'`, que é mais rápido E mais
   bonito. Ver o bloco do campo.

   É o TERCEIRO caso da mesma lição nesta revisão, depois de `lodMinPx` e de
   `ceilingSpots`, e a lição merece nome: **toda otimização que atacava CONTAGEM
   DE CHAMADAS morreu com a fusão, e as que cobravam qualidade por isso passaram
   a ser prejuízo puro.** Quem for acrescentar um botão daqui em diante tem de
   dizer em qual dos dois eixos que sobraram ele age — **GPU** (preenchimento,
   ALU, passadas) ou **MEMÓRIA** —, e um botão que não age em nenhum dos dois não
   entra.

   ---------------------------------------------------------------------------
   E O CONTROLADOR NÃO OSCILA COM OS TRÊS NÍVEIS EMPATADOS — conferido no código

   A pergunta é legítima: se os três níveis custam o mesmo, o adaptador fica sem
   sinal para escolher. Lido o `reportFrameTime()` linha a linha, ele não
   oscila, e por três travas independentes:

     · **no topo não há para onde subir.** Com `ema` ~3,2 ms contra um alvo de
       16,7 ms, `goodSince` arma — e a promoção morre em
       `i < LEVELS.length - 1`, porque `alta` é o último. A escala já está em
       `band.max`, então o degrau de resolução também não tem para onde ir. O
       estado é ESTÁVEL, não parado por acidente;
     · **descer exige dois gatilhos simultâneos e sustentados**: `ema` acima de
       `targetMs × 1,6` **e** a escala já saturada em `band.min`, por
       `DOWN_HOLD` de 2,5 s, com `STEP_COOLDOWN` de 12 s entre degraus;
     · **e a descida é limitada a `MAX_DROPS = 3`**, que já é mais do que os dois
       degraus existentes. Ou seja o pior caso patológico não é oscilação: é uma
       catraca de mão única que para sozinha. Numa máquina em que baixar de nível
       não devolve nada, ela desce duas vezes e assenta — o que é a resposta
       certa, porque o que ela perde ali (refletores, filtro de sombra,
       resolução) é justamente o que devolve quadro numa máquina limitada por
       GPU, e a que ela está medindo não é.

   ⚠️ A banda morta assimétrica (`DEAD_LOW 0,75` / `DEAD_HIGH 1,08`) é a trava
   equivalente um degrau abaixo, para a ESCALA: reage a 8 % acima do alvo e só
   devolve resolução com 25 % de folga, de modo que uma máquina exatamente no
   limiar assenta no degrau de baixo em vez de ficar trocando de nitidez em
   cadência — que o usuário percebe muito mais que o fps.

   ---------------------------------------------------------------------------
   ⚠️ O QUE ESTA TABELA **NÃO** FAZ, E POR QUÊ

     · **não desce mais o `renderScale`.** Medido: preenchimento era 0 % do
       quadro na máquina de referência. Numa integrada ele volta a existir — mas
       só DEPOIS de a fusão tirar a CPU do caminho, e nunca a ponto de o Baixo
       ficar borrado. Um nível tem de ser rodável **E** apresentável;
     · **não desce o `shadowMapSize` do Baixo para 1024.** Já foi tentado e já
       foi desfeito em 2026-08-14 (§2.1): a 1024² um `normalBias` calibrado para
       3072² vale 0,43 texel, que é o regime de peter-panning. E a aritmética não
       compensa: 32 MB num orçamento de 1 087 MB de textura é 3 % do problema de
       memória por 100 % da nitidez da sombra. Quem quiser memória de verdade
       mexe em `groundVariant`, que vale 256 MB;
     · **não decima geometria em lugar nenhum.** A ablação é categórica: esconder
       as 1 073 malhas MAIORES (95 % dos triângulos) devolveu MENOS que esconder
       as 1 073 menores (5 %). Triângulo é de graça; chamada é o que se paga. */

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
   *  maior item do orçamento.
   *
   *  ⚠️ **E ELE PARA EM 2048 NO BAIXO, DE PROPÓSITO.** Descer para 1024 já foi
   *  tentado e desfeito: `applyShadowBias()` documenta que os metros por texel
   *  têm DOIS fatores, e a 1024² um `normalBias` calibrado para 3072² vale 0,43
   *  texel — peter-panning, ou seja a sombra descolando do pneu. E a conta de
   *  memória não paga: 32 MB num orçamento de 1 087 MB de textura são 3 % do
   *  problema por 100 % da nitidez da sombra. Quem precisa de memória mexe em
   *  `groundVariant` (@ktx2 vale 256 MB), não aqui. */
  shadowMapSize: number;
  /**
   * TETO DE REASSADURAS DO MAPA DE SOMBRA POR SEGUNDO, sob mudança CONTÍNUA.
   *
   * ---------------------------------------------------------------------------
   * O DEFEITO QUE ELE EXISTE PARA FECHAR, medido em `GARGALO-2026-08-15.md` §1.2
   *
   * `shadowMap.autoUpdate = false` existe para o passe de sombra só rodar "quando
   * sujo". Com uma armadilha get/set em `needsUpdate` guardando a pilha de quem
   * escreve `true`, num arrasto de 90 quadros:
   *
   *     Alta   90 de 90 quadros (100 %)   culpado: `scene/seethrough.ts:823`
   *     Média  70 de 90 quadros ( 78 %)   idem (65×) + carga (5×)
   *
   * `escrever()` é chamado a cada passo de dissolvência de cada sólido do
   * cenário, e no `distrito-industrial` há prédios entrando e saindo do corredor
   * de transparência o tempo todo enquanto a câmera orbita. Cada passo
   * intermediário do fade marca o mapa de sombra INTEIRO como sujo, e o laço faz
   * o que lhe mandaram: uma segunda varredura completa da geometria, 60×/s.
   *
   * O custo, medido nesta máquina:
   *
   *     Alta   12,95 → 19,01 ms   +6,06 ms (+47 %)
   *     Média  10,24 → 15,55 ms   +5,31 ms (+52 %)
   *     Baixa   6,47 → 10,49 ms   +4,02 ms (+62 %)
   *
   * ---------------------------------------------------------------------------
   * POR QUE ESTRANGULAR NÃO É PERDER QUALIDADE
   *
   * A dissolvência de um prédio muda a sombra dele de forma GRADUAL. Um mapa
   * reassado a 12 Hz em vez de 60 Hz mostra a sombra de 83 ms atrás de uma
   * transição que leva centenas de milissegundos — uma defasagem que nenhum olho
   * separa da própria transição. O objeto continua na cena e a sombra dele
   * continua na cena; só a TAXA DE ATUALIZAÇÃO dela é uma amostragem menor.
   * É a definição literal da regra deste arquivo.
   *
   * ⚠️ **A DÍVIDA TEM DE SER PAGA.** Se a dissolvência terminar dentro da janela
   * estrangulada e ninguém pedir a reassadura depois, o prédio fica com a sombra
   * do estado anterior — que é exatamente o defeito que `sombraSuja` existe para
   * não ter. A máquina para isso JÁ EXISTE e não precisa ser inventada:
   * `scene.ts` tem `shadowStale` + `scrubUntil` fazendo isto para o arrasto do
   * relógio. Reusar, não duplicar.
   *
   * ⚠️ **NÃO É UM TETO PARA A BORDA.** Uma carga, uma troca de veículo ou um
   * `applyQualityProfile()` que realoca o mapa têm de reassar NA HORA. O
   * estrangulamento é só para a fonte CONTÍNUA — a dissolvência e o arrasto do
   * relógio. Um estrangulamento que engolisse uma borda de carga entregaria um
   * caminhão sem sombra por 125 ms depois de aparecer.
   *
   * CONSUMIDOR: `scene/scene.ts` (AGENTE 1). Este módulo só publica o número.
   */
  shadowRefreshHz: number;
  /**
   * DIÂMETRO DE MUNDO MÍNIMO (m) PARA UMA MALHA PROJETAR SOMBRA.
   *
   * O que `setShadowCasters()` (`vehicle/material-setup.ts`) usa como corte —
   * hoje uma constante `SHADOW_CASTER_MIN_M = 0.05` que ninguém pode ajustar.
   *
   * O passe de sombra são **1 574 chamadas**, ~40 % do quadro, e ele é o único
   * lugar da tabela onde uma chamada some sem que um PIXEL DO VEÍCULO mude: a
   * malha continua desenhada no passe principal, com todos os seus triângulos.
   * O que se perde é a SOMBRA DE CONTATO de uma peça pequena.
   *
   * A CALIBRAÇÃO, e ela é diferente em cada nível porque a régua muda:
   *
   *   0,05 (Alta)  — o valor histórico, e ele tem uma justificativa métrica:
   *                  a 3072² sobre um vão de ±40 m, um texel vale ~2,6 cm e o
   *                  filtro PCF de 17 taps espalha por ~7,8 cm. Abaixo de 5 cm
   *                  a sombra não sobrevive ao próprio filtro.
   *   0,10 (Média) — a 2048² o texel vale ~3,9 cm e o filtro ~11,7 cm. 10 cm é
   *                  logo abaixo de uma pegada de filtro: mesmo argumento,
   *                  mesma classe de invisibilidade, mapa menor.
   *   0,15 (Baixa) — ⚠️ **AQUI O ARGUMENTO MUDA E É HONESTO DIZER ISSO.** No
   *                  Baixa `shadowType` é `'basic'` (1 tap), então não há
   *                  pegada de filtro para se esconder atrás: 15 cm são ~4
   *                  texels e um olho atento ACHA a falta, se for procurar a
   *                  sombra de um parafuso. Ele entra assim mesmo, por contagem
   *                  — e 0,15 não é um número tirado do ar, é exatamente
   *                  `LOD_MAX_DIAM` de `vehicle/lod.ts`, o teto do que aquele
   *                  arquivo mediu e chamou de "parafusaria". Os dois mecanismos
   *                  passam a compartilhar UMA definição de peça pequena.
   *
   * A DISTRIBUIÇÃO MEDIDA no `trailer.glb` (primitivas / triângulos):
   *
   *     < 50  mm →   592 prims /   697 996 tri   ← já fora, em todos os níveis
   *     < 100 mm → 1 045 prims / 1 174 034 tri   ← +453 saem no Média
   *     a faixa 100…150 mm NÃO FOI MEDIDA
   *
   * ⚠️ **DEPOIS DA FUSÃO ESTE BOTÃO PERDE QUASE TODA A POPULAÇÃO, e isso é
   * previsto.** Com `mergeVehicle: 'all'` o veículo vira 104 malhas, cada uma
   * contendo peças de todos os tamanhos — e uma malha fundida projeta sombra
   * inteira. Ele continua valendo (a) enquanto a fusão estiver construindo, (b)
   * em `'floor'`/`'off'`, e (c) para o que ficar de fora da fusão por decisão de
   * `vehicle/trim.ts`. Diferente do LOD, ele não é aposentado porque **não custa
   * peça nenhuma** — o preço dele é sombra, e sombra é amostra.
   *
   * CONSUMIDOR: `vehicle/material-setup.ts` (fora desta lista de arquivos — ver
   * o patch no relatório). Enquanto ele não ler este campo, a constante de lá
   * continua valendo e ESTE CAMPO NÃO FAZ NADA.
   */
  shadowCasterMinM: number;

  /* ---- geometria ---- */
  /**
   * A FUSÃO POR MATERIAL DO VEÍCULO — a maior otimização já medida neste
   * projeto, e a única que não troca nada por ela.
   *
   * Medido, mesmo conjunto, mesmos materiais, mesma imagem:
   *
   *   'floor' — só o que fica sob o piso (chassi, rodagem, para-lamas,
   *             parafusaria): 959 malhas → 19. Chamadas 2 230 → 1 290, quadro
   *             1,7× mais rápido, 99 ms de construção. Risco quase nulo — o
   *             próprio `trailer-assembly.ts` já declara que nunca transforma
   *             nada dessa faixa.
   *   'all'   — 2 146 malhas → 104. Chamadas 2 230 → **168**, quadro **14,9×**
   *             mais rápido, 360 ms de construção. Com a cena fundida, o quadro
   *             COM sombra reassada cai para 4,04 ms.
   *   'off'   — como sempre foi. Existe para a bancada medir o antes/depois.
   *
   * **A coluna dos TRIÂNGULOS não muda em nenhum dos três.** Não há qualidade
   * sendo trocada por velocidade; há trabalho desperdiçado sendo removido.
   *
   * ⚠️ **O MESMO VALOR NOS TRÊS NÍVEIS, E ISSO É OBRIGATÓRIO.** A fusão muda a
   * CONTAGEM DE MALHAS VISÍVEIS do veículo (2 146 → 104). O Portão 1 de
   * `checks-aceitacao.mjs` exige essa contagem IDÊNTICA nos três níveis; um
   * nível fundido e outro não reprovariam com razão, porque estariam desenhando
   * árvores de cena diferentes. Este campo é um interruptor de DEPURAÇÃO
   * publicado no perfil, nunca um degrau de qualidade.
   *
   * ⚠️ OS DONOS A CONSULTAR antes de mexer estão listados em
   * `GARGALO-2026-08-15.md` §6.3. Os dois que QUEBRAM: `vehicle/trim.ts` (casa
   * por NÓ onde não há material) e `setTrailerDims()` (regenera o corpo branco e
   * invalida a fusão).
   *
   * CONSUMIDOR: o módulo de fusão do AGENTE 2. Enquanto ele não existir, ESTE
   * CAMPO NÃO FAZ NADA.
   */
  mergeVehicle: 'off' | 'floor' | 'all';

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
   * O reflexo do piso do Estúdio — DOIS estados, e a história de por que já
   * foram três.
   *
   * ═══════════════════════════════════════════════════════════════════════
   * ⚰️ `'lod'` FOI ARRANCADO EM 2026-08-16, e a lápide fica aqui porque este
   * é o arquivo que DECLARA o enum: um valor que nenhum nível pede e que o
   * consumidor degrada em silêncio é a pior forma de um estado morrer. A
   * máquina que o executava saiu de `scene/floor-reflection.ts`, que carrega a
   * lápide longa; o que segue é o mínimo para ninguém reinventá-lo.
   *
   * ELE EXISTIA PARA TIRAR GEOMETRIA da segunda varredura, escondendo — só
   * durante esta passada — toda malha cuja SEGUNDA MAIOR ARESTA em espaço de
   * mundo fosse menor que 8 cm.
   *
   * ⚠️ **A CONTA DOS 8 cm FICA GUARDADA, e ela volta a valer no dia em que a
   * fusão sair do ar.** O mip que o piso de fato lê vai de 1,03 a 1,88 dentro
   * da órbita de 8,6–22,4 m ⇒ ~3,7 texels de mip 0 por texel lido; uma lente de
   * 30° sobre 540 linhas ⇒ 0,0556° por texel; 3,7 × 0,0556° = 0,206°, que a
   * 22,4 m são **8,0 cm**. E a medida é a SEGUNDA maior aresta, nunca
   * `userData.tsWorldDiameter`: um friso de flanco de 14,47 m por 2 cm tem
   * diâmetro enorme e some no reflexo — é a LARGURA que o olho lê, e são 27
   * trilhos assim no implemento.
   *
   * POR QUE SAIU MESMO ASSIM. A fusão por material tirou o chão de baixo dele,
   * nas duas pontas ao mesmo tempo:
   *
   *   · **o filtro parou de filtrar.** `collectThin()` media a segunda aresta
   *     da caixa de cada malha, e um balde fundido abraça o trailer inteiro —
   *     METROS de segunda aresta. Nada do veículo era escondido;
   *   · **a premissa da medição evaporou.** Os 14,1 fps foram medidos com
   *     1 968 malhas separadas submetendo ~1 968 chamadas por passada. Hoje a
   *     passada submete ~45. O chão da medição mudou; a conclusão dela não
   *     sobrevive à mudança de chão.
   *
   * SOBRAVA SÓ CUSTO, pago por quadro ou por meio segundo: `lodPlan()`
   * percorrendo o grafo de cena INTEIRO a cada 500 ms medindo caixas
   * envolventes, `lodHide()`/`lodRestore()` escrevendo `.visible` por candidato
   * por quadro, e um quarto estado de `shadowMap.needsUpdate` para o mapa não
   * ser assado a partir da cena podada. **É o candidato nomeado para o Portão 3
   * ter medido o Médio (3,61 ms) MAIS LENTO que o Alto (3,23 ms)** — o Médio era
   * o único nível em `'lod'`.
   *
   * ⚠️ O QUE O RESSUSCITARIA: `mergeVehicle` em `'off'` ou `'floor'`, ou um
   * acervo novo que volte a trazer milhares de primitivas finas separadas.
   * ═══════════════════════════════════════════════════════════════════════
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
   *   'off'   — a segunda passada não acontece, e o ALVO é liberado.
   *
   * ⚠️ O DEGRAU DE MEIO NÃO É `'lod'`, É `floorReflectionMsaa`. Quem vier
   * procurar "um jeito de o reflexo custar menos sem sumir" acha o botão logo
   * abaixo: 4 → 0 vale 71 MB de VRAM e a mip do próprio reflexo já é o
   * passa-baixa que o MSAA daria.
   *
   * ⚠️ E há um segundo custo que a contabilidade anterior não tinha: o alvo é
   * 1600×1080 `HalfFloatType` com mipmaps E `samples: 4`, ou seja **96,7 MB de
   * VRAM**, dos quais ~79 MB são só o buffer multiamostrado. Isso faz do
   * reflexo o **segundo maior item isolado do orçamento de memória da cena**,
   * atrás apenas dos 341 MB de chão — à frente do implemento inteiro. Numa
   * integrada de memória compartilhada esse número pesa tanto quanto os 14,1
   * fps.
   */
  floorReflection: 'full' | 'off';
  /**
   * MULTIAMOSTRAGEM DO ALVO DO REFLEXO — e ele é um botão de MEMÓRIA, não de
   * tempo.
   *
   * A CONTABILIDADE COMPLETA dos 96,7 MB, a 1600×1080 `HalfFloatType`:
   *
   *     cor (RGBA16F)              13,8 MB
   *     pirâmide de mipmaps        + 4,6 MB   (+1/3)
   *     profundidade (D24)         + 6,9 MB
   *     resolve multiamostrado 4×  +71,4 MB   ← isto
   *                                ────────
   *                                  96,7 MB
   *
   * Ou seja: **três quartos do segundo maior item isolado de VRAM da cena são o
   * buffer multiamostrado**, e ele existe para uma única coisa — a silhueta do
   * caminhão no alvo, que serrilhada cintila a cada quadro do giro (foi metade
   * do relato "não está um blur smooth, está meio que tremido").
   *
   * POR QUE DÁ PARA TIRAR NO MÉDIO SEM O TREMIDO VOLTAR INTEIRO: a leitura do
   * reflexo no piso é um `textureLod` com nível **1,03 a 1,88** dentro da órbita
   * de 8,6–22,4 m — ou seja o piso já lê o alvo através de 2 a 3,7 texels de
   * mip 0 borrados trilinearmente. Um passa-baixa é exatamente o que o MSAA
   * entrega, e este já está lá de graça. Some a isso o Fresnel de teto 0,42 e a
   * queda por distância: o que sobrevive entra na imagem com menos da metade do
   * contraste da vista direta.
   *
   * ⚠️ **NÃO É DE GRAÇA E NÃO SE FINGE QUE É.** Perto do ponto de contato do
   * pneu o mip cai para ~1,0 e o borrão do reflexo é mínimo por desenho (o
   * contato é o que apoia o pneu no chão); ali a aresta serrilhada pode aparecer
   * no giro. É o preço, e ele é pago só a partir do Médio.
   *
   * 0 desliga. O three trata `samples: 0` como "sem multiamostragem" e não
   * realoca nada além do alvo simples.
   */
  floorReflectionMsaa: number;

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
   *  metálica, e isso é decisão visual autorada, não amostragem.
   *
   *  ⚠️⚠️ **ÓRFÃO. ESTE CAMPO NÃO TEM CONSUMIDOR NENHUM — ele mente.**
   *  Varrido o engine inteiro em 2026-08-15, a única referência a `flakeOctaves`
   *  fora deste arquivo está em `tools/studio-bench/checks-qualidade.mjs`, que
   *  confere o VALOR na tabela — o teste que o cabeçalho daquele arquivo já
   *  declara não provar nada. `vehicle/paint.ts` escreve `uFlakeAmount`,
   *  `uFlakeScale`, `uFlakeTilt`, `uFlakeGloss`, `uFlakeColor` e `uFlakePx`, e
   *  nenhum uniforme de OITAVAS: as duas oitavas estão codificadas direto no
   *  GLSL, sem porta.
   *
   *  Um botão que ninguém lê é PIOR que botão nenhum, porque ele mente para
   *  quem escolhe e para quem audita — é o defeito de forma que a §0 de
   *  `OTIMIZACAO-2026-08-14.md` documenta em cinco exemplares. Ele fica aqui, com
   *  este aviso, em vez de ser apagado, porque `vehicle/paint.ts` não pertence a
   *  esta passagem e o campo é a única coisa que registra o patch pendente. O
   *  patch está no relatório de 2026-08-15, destinatário: o dono de
   *  `vehicle/paint.ts`. **Até lá, os valores desta linha são decorativos.** */
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
  /**
   * Limiar de LOD em PIXELS de altura de tela. Uma malha cujo diâmetro em mundo
   * projeta menos que isto some.
   *
   * ⚠️⚠️ **APOSENTADO EM 2026-08-15: VALE 0 NOS TRÊS NÍVEIS.** O mecanismo
   * continua de pé, testado e funcional em `vehicle/lod.ts`; o que mudou é que
   * nenhuma tabela o liga. Três medições o derrubaram, e as três estão em
   * `GARGALO-2026-08-15.md`:
   *
   *   1. **Ele era o único botão da tabela que apagava PEÇA DO CAMINHÃO** — e
   *      apagar peça é a degradação mais feia por milissegundo que existe. A
   *      1080p, a 25 m, uma peça de 5 cm mede 4,0 px: um parafuso VISÍVEL. O
   *      limiar honestamente invisível é 12,4 mm, e nessa faixa há **2
   *      primitivas no implemento inteiro**. O Médio usava 1,5 px e o Baixo
   *      3,0 px — ou seja, os dois sumiam com parafusaria que o olho vê. Isso é
   *      metade do "no baixo a qualidade visual fica horrível".
   *   2. **Ele não tocava o passe de sombra.** Das 588 chamadas que tirava do
   *      Médio, ZERO saíam da sombra: `setShadowCasters()` já tinha tirado de lá
   *      tudo abaixo de 5 cm, que é exatamente a população que o LOD mais toca.
   *      As duas otimizações se sobrepunham, e o contador de chamadas (que nunca
   *      viu a sombra — §1.1) escondia isso de todo mundo.
   *   3. **A fusão por material o deixou sem assunto.** Ele existe para tirar
   *      chamadas de desenho; com `mergeVehicle: 'all'` o passe principal vai a
   *      168 chamadas e não há chamada para tirar.
   *
   * Voltar a ligá-lo é a resposta ERRADA para "está lento" em qualquer máquina
   * em que `mergeVehicle` esteja em `'all'`. O que o ressuscitaria está escrito
   * no cabeçalho de `vehicle/lod.ts`.
   *
   * 0 desliga — e desligar DEVOLVE o que já estava escondido, não só para de
   * esconder. Ver `releaseLod()`.
   */
  lodMinPx: number;

  /* ---- carga e cache ---- */
  /** Lado do alvo da sonda de reflexo local (`scene/probe.ts`). Ela faz SEIS
   *  renderizações completas da cena + um PMREM a cada troca de cenário ou de
   *  cavalo — ~14 000 chamadas de desenho num quadro só. Nunca no laço, mas é
   *  um engasgo visível numa integrada.
   *
   *  ⚠️⚠️ **ESTE CAMPO ESTÁ NA TABELA QUENTE E É CHAVE DE CACHE DE PROGRAMA.**
   *  Não é um erro de classificação — é uma exceção nomeada —, mas quem mexer
   *  aqui sem saber disto vai atrás do engasgo errado.
   *
   *  A cadeia, lida na fonte do three 0.179.1:
   *
   *    · `PMREMGenerator._fromTexture()` (three.module.js:2902) chama
   *      `_setSize(cubemap.image[0].width)`, e `_allocateTargets()` (:2930) faz
   *      `height = 4 * this._cubeSize`. Logo **256 ⇒ PMREM de 1024 px de altura,
   *      128 ⇒ 512**;
   *    · `WebGLPrograms.getParameters()` publica
   *      `envMapCubeUVHeight = envMap.image.height`, e
   *      `getProgramCacheKeyParameters()` (:7199) EMPILHA esse número na chave.
   *
   *  Ou seja: trocar `probeSize` invalida o programa de **todo material do
   *  veículo** (a sonda é ligada como `envMap` deles; `scene.environment`, que é
   *  o HDRI do cenário, é outro caminho e não se mexe). Isso é recompilação, que
   *  é a definição de botão FRIO neste arquivo.
   *
   *  ⚠️ POR QUE ELE FICA QUENTE ASSIM MESMO. A recompilação não acontece na
   *  troca de nível: ela acontece na próxima CAPTURA DE SONDA, porque o alvo é
   *  cacheado e só é realocado quando o lado muda (`probe.ts:83`). E toda
   *  captura de sonda é disparada por cenário novo, cavalo novo ou
   *  redimensionamento do baú — as três atrás de cortina. O engasgo cai dentro de
   *  uma cortina que já existe, e é isso, e só isso, que o mantém do lado quente
   *  da tabela.
   *
   *  ⚠️ QUEM QUEBRAR ESSA INVARIANTE QUEBRA A REGRA DO CABEÇALHO. Se algum dia a
   *  sonda passar a ser recapturada dentro do laço — ou se o medidor automático
   *  ganhar licença para mexer neste campo —, o resultado é uma recompilação da
   *  cena inteira disparada sozinha no meio de um arrasto, que é exatamente o
   *  defeito que a separação quente/frio existe para não ter. Nesse dia este
   *  campo migra para `ColdProfile`.
   *
   *  ⚠️ E `hdrVariant` É FRIO PELO MESMO MECANISMO, não só por ser arquivo: um
   *  equirect 2048x1024 vira PMREM de altura 2048 e um de 1024x512 vira 1024
   *  (`_setSize(image.width / 4)`, :2910). A troca de variante de HDR recompila
   *  todo material que use `scene.environment`. */
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
  /**
   * Os 28×3 spots decorativos suspensos do teto do Estúdio (`scene/ceiling.ts`).
   * O próprio arquivo os declara decorativos: eles não iluminam nada e nada aqui
   * projeta sombra.
   *
   * ⚠️ **APOSENTADO EM 2026-08-15 PELO MESMO TESTE QUE APOSENTOU O LOD, e é a
   * mesma lição aplicada duas vezes.** O que ele devolve, contado: são **3
   * `InstancedMesh`** (corpo, tampa e haste, 28 instâncias cada), ou seja **3
   * chamadas de desenho** no passe opaco — mais 3 na segunda varredura do
   * reflexo do piso, que no Baixo nem acontece, porque lá `floorReflection` é
   * `'off'`.
   *
   * Três chamadas num quadro de ~250 pós-fusão são 1,2 %. O que elas cobravam é
   * a referência de escala que diz se a laje do Estúdio está a 14 m ou a 40 m —
   * uma perda de LEITURA numa sala autorada, paga com um ganho que nenhum
   * medidor separa do ruído. É literalmente o negócio que o veredito da §4 de
   * `GARGALO-2026-08-15.md` condena no nível Médio: *paga qualidade e recebe
   * quase nada*.
   *
   * O campo fica, e o mecanismo de `ceiling.ts` fica: o dia em que alguém medir
   * um cenário com centenas de luminárias, ele já está de pé. Hoje ele vale
   * `true` nos três níveis.
   */
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
  /*  ---- OS TRÊS DEGRAUS DO CHÃO, medidos em 2026-08-15 ----
   *  O chão é o maior item isolado do orçamento de memória da cena, e os
   *  números abaixo saem de `tools/studio-assets/erro-ktx2.mjs`, que transcodifica
   *  com o MESMO `basis_transcoder.wasm` do navegador e compara contra o
   *  original a 2048² (erro absoluto médio RGB):
   *
   *  | degrau        | fio       | VRAM      | erro         |
   *  |---------------|-----------|-----------|--------------|
   *  | `''` (hoje)   | 22,20 MB  | 341,3 MB  | 0            |
   *  | `'@ktx2'`     | 68,98 MB  |  85,3 MB  | 0,02 … 5,68  |
   *  | `'@ktx2-1k'`  | 17,96 MB  |  21,3 MB  | 0,71 … 14,48 |
   *
   *  ⚠️ `'@ktx2'` a 2048² é o único degrau que SOBE o download (+47 MB), e ele é
   *  pedido justamente por quem tem rede modesta. Por isso o Baixo NÃO usa ele:
   *  `'@ktx2-1k'` fecha com 4,2 MB a MENOS de fio que o estado atual e 16× menos
   *  VRAM. Ele domina o degrau `'@1k'` (resize simples, erro 0,70…13,11): mesmo
   *  erro dentro de 4 %, com um quarto da memória.
   *
   *  ⚠️ E o erro do 1k é dominado pela REAMOSTRAGEM, não pela compressão — os
   *  quatro piores são `_nor`/`_ao` de grama, brita e concreto. Quem quiser o
   *  melhor dos dois mundos mantém ESSES QUATRO a 2048² e o resto a 1024²:
   *  37,3 MB de VRAM com erro máximo 5,68. Não é expressável neste enum, que é
   *  uma escolha por CONJUNTO — seria uma escolha por ARQUIVO.
   */
  groundVariant: '' | '@1k' | '@ktx2' | '@ktx2-1k';
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
    /* 20 Hz E NÃO "SEM TETO": mesmo no Alto, reassar a sombra em 100 % dos
       quadros de arrasto custa +6,06 ms medidos por um atraso de 50 ms numa
       dissolvência que leva centenas. O teto do Alto é folga, não corte. */
    shadowRefreshHz: 20,
    shadowCasterMinM: 0.05,        // o valor histórico de `setShadowCasters()`
    mergeVehicle: 'all',           // ⚠️ igual nos três — ver o bloco do campo
    anisotropyVehicle: 8,
    anisotropyGround: 16,          // "o máximo do dispositivo", aparado adiante
    floorReflection: 'full',
    floorReflectionMsaa: 4,
    orangePeel: true,
    flakeOctaves: 2,               // ⚠️ órfão — ver o bloco do campo
    vegetation: 1,
    seeThroughSamples: 8,
    lodMinPx: 0,                   // aposentado nos TRÊS níveis
    probeSize: 256,
    pmremSteps: 12,
    pmremMinMs: 110,
    envCacheMax: 3,
    rainAmount: 1,
    rainRipples: true,
    ceilingSpots: true,
  },
  media: {
    /* 0,88 E NÃO 0,80, e a mudança é uma consequência da ablação, não gosto: o
       Médio submetia 85 % das chamadas do Alto e cobrava 36 % dos fragmentos por
       isso. Preenchimento era 0 % do quadro na máquina de referência (a mesma
       cena a 1/16 dos pixels custou 10,33 ms contra 10,37 ms), então essa
       resolução a menos era perda pura. Numa integrada ele volta a valer, e o
       controlador dinâmico tem faixa até 0,72 para isso. */
    renderScale: 0.88,             // 77 % dos fragmentos
    pixelRatioCap: 1.5,
    shadowMapSize: 2048,
    /* O DEGRAU GRANDE DESTE NÍVEL, e ele custa zero de imagem. Medido: a
       reassadura vale +5,31 ms (+52 %) no Médio e acontecia em 78 % dos quadros
       de arrasto. A 12 Hz a sombra de um prédio em dissolvência atrasa até 83 ms
       — dentro de uma transição que leva centenas. */
    shadowRefreshHz: 12,
    /* ~11,7 cm é a pegada do filtro PCF a 2048². 10 cm fica logo abaixo dela:
       mesma classe de invisibilidade do 0,05 a 3072², mapa menor. */
    shadowCasterMinM: 0.10,
    mergeVehicle: 'all',
    anisotropyVehicle: 4,
    anisotropyGround: 8,
    /* ⚠️ 'full' E NÃO 'lod', E A MUDANÇA É DE 2026-08-15, DEPOIS DA FUSÃO.
       -----------------------------------------------------------------------
       O modo `'lod'` existia para tirar GEOMETRIA da segunda varredura do
       reflexo, e a medição que o justificava era categórica: 14,1 fps a meio
       lado contra 14,7 a um quarto, ou seja o gargalo daquela passada era
       varredura de geometria e não preenchimento.

       **A fusão por material apagou a premissa.** O implemento virou 45 baldes,
       cada um abraçando o trailer inteiro — e `collectThin()` mede a SEGUNDA
       MAIOR ARESTA da caixa contra um corte de 8 cm. Um balde fundido tem
       metros de segunda aresta: **nada do veículo é escondido**. O que sobra é
       o CUSTO: `lodPlan()` percorre o grafo de cena INTEIRO duas vezes por
       segundo (`LOD_REBUILD_MS = 500`), medindo caixas envolventes, e
       `lodHide`/`lodRestore` escrevem `.visible` por candidato POR QUADRO.

       Ou seja o Médio pagava uma varredura de grafo para não esconder nada, e a
       passada do reflexo tem hoje ~45 chamadas de qualquer jeito. É o terceiro
       caso da mesma lição desta revisão — depois de `lodMinPx` e `ceilingSpots`
       — e ele é o candidato mais provável para o Portão 3 ter medido o **Médio
       MAIS LENTO que o Alto** (3,61 ms contra 3,23 ms).

       `'full'` é, ao mesmo tempo, mais rápido E mais bonito: o reflexo volta a
       ter a ferragem. O degrau de memória do Médio continua existindo e mudou de
       endereço — ele é `floorReflectionMsaa: 0`, logo abaixo, que vale 71 MB. */
    floorReflection: 'full',
    /* −71 MB de VRAM, e a mip do próprio reflexo (1,03–1,88) já é o passa-baixa
       que o MSAA daria. Ver o bloco do campo. */
    floorReflectionMsaa: 0,
    /* SAI NO MÉDIO, e este é o degrau grande e barato: ~860 ALU por fragmento
       pintado, ~44 % do custo do shader de tinta, contra o efeito mais sutil
       dos três acima de 2 m. Na versão anterior ele ficava ligado no Médio, o
       que era deixar o maior ganho barato na mesa. */
    orangePeel: false,
    flakeOctaves: 2,
    vegetation: 0.6,
    /* 6 e não 8: é PRÉ-TESTE de corredor, e ele roda 60×/s sobre ~650 objetos
       INCLUSIVE em quadro pulado — o maior custo fixo de CPU do laço, que é o
       recurso escasso num i5. Menos amostras deixam a decisão de QUEM dissolve
       um quadro mais grossa; não mudam COMO se dissolve. */
    seeThroughSamples: 6,
    /* 0 — ver o bloco do campo. Era 1,5, e 1,5 px some com parafuso que o olho
       vê. Esta linha é a metade do pedido que dizia "sem perder qualidade". */
    lodMinPx: 0,
    /* 128: seis renderizações completas da cena + PMREM por troca de cenário,
       ~14 000 chamadas num quadro só. Cair para 128 corta 75 % do preenchimento
       dessas seis passadas, e o resultado passa por PMREM logo em seguida, que
       borra por rugosidade. É engasgo de carga, não quadro de arrasto — e é
       exatamente quando o usuário está olhando. */
    probeSize: 128,
    pmremSteps: 8,
    pmremMinMs: 150,
    /* 2 e não 3: cada entrada com par de céus são dois equirects 2k meio-float,
       ~16,8 MB, e o catálogo tem 2 cenários com HDRI. O que se perde é a
       VELOCIDADE DE VOLTA a um cenário já visitado — nunca imagem. */
    envCacheMax: 2,
    rainAmount: 0.7,
    rainRipples: true,
    ceilingSpots: true,            // aposentado — ver o bloco do campo
  },
  baixa: {
    /* 0,72 E NÃO 0,65, e o piso da faixa subiu junto (0,58, era 0,50). O motivo
       é o pedido inteiro: *"nem mesmo o baixo está rodando, e isso que no baixo
       a qualidade visual fica horrível"*. Metade do "horrível" era o LOD; a
       outra metade era abrir a 0,65 e o controlador ter licença para afundar até
       0,50 — 25 % dos fragmentos, um 1080p desenhado a 540p. Com a fusão tirando
       a CPU do caminho, o Baixo não precisa mais comprar quadro com nitidez
       nesse preço. **Um nível tem de ser rodável E apresentável.** */
    renderScale: 0.72,             // 52 % dos fragmentos
    pixelRatioCap: 1.25,
    /* 2048 E NÃO 1024, de propósito — é a correção de um erro da versão
       anterior. O passe de sombra é limitado por GEOMETRIA, não por resolução:
       encolher o mapa não acelera a escrita, e a leitura já vai cair de 17 taps
       para 1 pelo `shadowType: 'basic'`. Manter 2048 devolve metade da serrilha
       que o filtro de 1 tap introduz, por 12,6 MB. Um tap a 2048² é
       dramaticamente melhor que 17 taps a 1024². E os 32 MB que sobrariam
       descendo para 1024 são 3 % de um orçamento de 1 087 MB de textura: o
       problema de memória do Baixo é `groundVariant`, não este campo. */
    shadowMapSize: 2048,
    /* 8 Hz — 125 ms entre reassaduras. Medido: a reassadura vale +4,02 ms
       (+62 %) neste nível, a maior fração dos três, porque o resto do quadro já
       está mais barato. É o maior degrau isolado que o Baixo tem depois do par
       frio `spotPool`/`shadowType`. */
    shadowRefreshHz: 8,
    /* ⚠️ 0,15 É O ÚNICO NÚMERO DA COLUNA QUE NÃO SE ESCONDE ATRÁS DE UM FILTRO.
       Com `shadowType: 'basic'` não há pegada de PCF: 15 cm são ~4 texels a
       2048², e um olho que procure a sombra de um parafuso acha a falta. Ele
       entra por CONTAGEM — o passe de sombra são 1 574 chamadas, ~40 % do
       quadro — e o número é exatamente `LOD_MAX_DIAM` de `vehicle/lod.ts`, o
       teto do que aquele arquivo mediu e chamou de parafusaria. Perder a SOMBRA
       de um parafuso é estritamente menos feio que perder o parafuso, que era o
       que este nível fazia até 2026-08-15. */
    shadowCasterMinM: 0.15,
    mergeVehicle: 'all',
    anisotropyVehicle: 2,
    /* 4 e não 2: o chão é visto quase sempre em ângulo rasante — o caso que a
       anisotropia existe para resolver — e a 2× a estrada vira uma faixa cinza a
       dez metros. Dois níveis de anisotropia custam banda; o Baixo já devolveu
       banda em toda parte. */
    anisotropyGround: 4,
    floorReflection: 'off',
    /* Redundante enquanto `floorReflection` for 'off' (o alvo nem é alocado),
       e escrito assim mesmo: quem congelar o nível e ligar o reflexo à mão pelo
       console não pode receber 96,7 MB de volta sem pedir. */
    floorReflectionMsaa: 0,
    orangePeel: false,
    flakeOctaves: 1,
    vegetation: 0.35,
    seeThroughSamples: 4,
    /* 0 — era 3,0 px, e a 3 px a parafusaria some em plano geral. Esta linha e a
       de cima (`renderScale` 0,72) são, juntas, a resposta ao "fica horrível". */
    lodMinPx: 0,
    probeSize: 128,
    pmremSteps: 6,
    pmremMinMs: 200,
    envCacheMax: 2,
    rainAmount: 0.45,
    rainRipples: false,
    ceilingSpots: true,            // aposentado — ver o bloco do campo
  },
};

const COLD: Record<QualityLevel, ColdProfile> = {
  alta:  { antialias: true, spotPool: 14, shadowType: 'pcf',   groundVariant: '',      hdrVariant: '' },
  media: { antialias: true, spotPool: 6,  shadowType: 'pcf',   groundVariant: '@ktx2',    hdrVariant: '' },
  /* O Baixo desce para 1024² comprimido, e não para 2048² comprimido: ele é o
     nível da máquina que não tem memória NEM banda, e é o único degrau que
     baixa as duas ao mesmo tempo. Ver a tabela em `groundVariant`. */
  baixa: { antialias: true, spotPool: 0,  shadowType: 'basic', groundVariant: '@ktx2-1k', hdrVariant: '@1k' },
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

   ⚠️ **O ALVO DE 22,2 ms DO BAIXO FOI RECONFERIDO EM 2026-08-15 E CONTINUA.**
   A conferência: a extrapolação da §5 de `GARGALO-2026-08-15.md` põe um i5 de
   10ª geração em ~11,5 µs por chamada. Com a fusão (`mergeVehicle: 'all'`) um
   quadro de arrasto passa de 3 216 para ~250 chamadas, ou seja ~2,9 ms de CPU
   de submissão — e aí o que resta é a placa, cuja parte medida é
   `5,2 ms + 3,75 ms·Mpx` numa RX 570. Uma UHD 630 tem ~1/11 da vazão. Mesmo com
   os cortes de fragmento do Baixo (`spotPool: 0`, `shadowType: 'basic'`,
   `orangePeel: false`), pedir 16,7 ms dela num 1080p é pedir o que ela não tem,
   e o único botão que o controlador teria para tentar é a resolução — que é
   justamente o que não pode afundar. 22,2 ms continua sendo a escolha certa, e
   agora por um motivo MEDIDO em vez de por prudência.

   ---------------------------------------------------------------------------
   ⚠️ O PISO DAS FAIXAS SUBIU NOS TRÊS NÍVEIS (2026-08-15)

   Antes: 0,85 / 0,65 / 0,50. Agora: 0,85 / 0,72 / 0,58. O piso é o quanto de
   nitidez o controlador tem LICENÇA para gastar quando a máquina não segura o
   alvo, e no Baixo ele era 0,50 — 25 % dos fragmentos, um 1080p desenhado a
   540p e esticado. Isso é a segunda metade do "no baixo a qualidade visual fica
   horrível" (a primeira era `lodMinPx`).

   A licença encolheu porque a razão dela desapareceu: enquanto o quadro era
   limitado por CHAMADA, afundar a resolução era o único gesto disponível e ele
   não devolvia nada — medido, 1/16 dos pixels custou 10,33 ms contra 10,37 ms.
   Com a fusão, resolução volta a comprar quadro de verdade numa integrada, e um
   botão que funciona não precisa ser puxado até o fim para trabalhar.

   ⚠️ E O BAIXO NÃO TEM PARA ONDE CAIR. `LEVELS` acaba nele, então o piso da
   faixa do Baixo é o piso ABSOLUTO de nitidez do produto — o pior quadro que
   este estúdio pode desenhar. É o número desta tabela que merece mais cuidado,
   e é por isso que ele é o único que subiu duas casas de `STEPS`.
   --------------------------------------------------------------------------- */

export interface ScaleBand {
  min: number; max: number; targetMs: number;
}

/* ⚠️ TODO EXTREMO DE FAIXA TEM DE EXISTIR EM `STEPS` (logo abaixo), E ANTES
   DESTA REVISÃO O `min` DO ALTO NÃO EXISTIA.

   O controlador anda de degrau em degrau e depois procura o degrau corrente por
   `Math.abs(s - scale) < 1e-4`. Com `min: 0.85` — que não é um degrau — a
   descida do Alto acabava assim: 1 → 0,88 → `Math.max(0.85, 0.8)` = **0,85**, um
   valor FORA da escada. No tique seguinte o `findIndex` falhava, o `reduce` de
   reserva elegia o degrau mais próximo (0,88), a comparação `0.88 > 0.85` dava
   verdadeira de novo e o controlador reagendava um passo que `setScale()` então
   descartava por diferença menor que `1e-4`. Ou seja: a cada 900 ms o Alto
   "tentava descer" e não descia, para sempre, sem sair no console e sem mudar um
   pixel. Nada quebrava — mas a faixa mentia por um degrau inteiro, e um
   controlador que grita no vazio é a próxima meia hora de depuração de alguém.

   Corrigido pelo lado da FAIXA e não pelo da escada: pôr 0,85 em `STEPS` criaria
   um degrau de 3,5 % coladinho no 0,88, e cada troca de degrau realoca o buffer
   de desenho E o alvo do reflexo do piso. Um degrau que quase não muda a imagem
   e custa duas realocações é o pior tipo de degrau. */
const BANDS: Record<QualityLevel, ScaleBand> = {
  alta:  { min: 0.80, max: 1,    targetMs: 16.7 },
  media: { min: 0.72, max: 1,    targetMs: 16.7 },
  baixa: { min: 0.58, max: 0.88, targetMs: 22.2 },
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
  /** `MAX_TEXTURE_IMAGE_UNITS` — quantos samplers cabem num fragmento. Sinal
   *  fraco, guardado porque ele SOBRA quando a string vem mascarada. */
  textureUnits: number;
  /**
   * OS FORMATOS COMPRIMIDOS QUE O ADAPTADOR ACEITA.
   *
   * Serve a DUAS perguntas de uma vez, e é por isso que ele vale o custo de
   * quatro `getExtension()`:
   *
   *   1. **Que classe de arquitetura é esta**, quando a string veio mascarada.
   *      Ver `gpuClass`.
   *   2. **Qual variante de KTX2 economiza memória de verdade.** É a conta que o
   *      bloco de `groundVariant` já registra: sem ASTC e sem ETC2, o
   *      `KTX2Loader` manda o ETC1S para BC7 (`bptc`) do mesmo jeito que manda o
   *      UASTC — ou seja, numa UHD 630 o ETC1S perde qualidade sem ganhar um
   *      byte. Com este campo, o dia em que alguém publicar as variantes, a
   *      escolha para de ser um palpite.
   */
  compressed: { s3tc: boolean; bptc: boolean; astc: boolean; etc2: boolean };
  /**
   * A CLASSE DA ARQUITETURA, deduzida SEM a string do adaptador.
   *
   *   'desktop' — rasterização imediata (Intel/AMD/NVIDIA de PC). Assinatura:
   *               tem S3TC/BPTC e não tem ASTC.
   *   'tile'    — rasterização por LADRILHO (Adreno, Mali, PowerVR, Apple).
   *               Assinatura: tem ASTC/ETC2. Numa arquitetura de ladrilho o
   *               `discard` da folhagem e o overdraw transparente da chuva
   *               custam desproporcionalmente mais.
   *   `null`    — nem uma coisa nem outra (um adaptador que anuncia os dois, ou
   *               nenhum). Sem veredito, e sem veredito nada se rebaixa.
   *
   * ⚠️ **ISTO NÃO FURA A REGRA "AUSÊNCIA DE INFORMAÇÃO NUNCA SIGNIFICA FRACO".**
   * A lista de extensões não é ausência de informação — é uma informação
   * DIFERENTE, que o navegador entrega sempre e não mascara, porque ela é
   * funcional e não identificatória. A regra continua valendo inteira para o
   * `renderer: null`.
   */
  gpuClass: 'desktop' | 'tile' | null;
  /** Pixels que a tela pede, já com o DPR — o que importa mais que a GPU. */
  pixels: number;
  touch: boolean;
}

/* ===========================================================================
   A CLASSIFICAÇÃO DO ADAPTADOR — reescrita em 2026-08-15
   ===========================================================================
   ⚠️ **O QUE A SONDA DE FATO CONSEGUE LER, dito antes das listas.**

   `WEBGL_debug_renderer_info` continua existindo nos navegadores baseados em
   Chromium e é o único caminho para a string do adaptador. Onde ela NÃO vem, ou
   vem inútil:

     · **Firefox** — mascarada por privacidade. `renderer` fica `null`.
     · **Safari** — devolve uma string genérica ("Apple GPU"), que não distingue
       um M3 Max de um iPhone. Vale tanto quanto `null` para decidir nível.
     · **Modo anti-impressão-digital** de qualquer navegador — idem.

   E onde ela vem, ela vem SUJA: o Chromium a embrulha em ANGLE
   (`"ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)"`)
   e os fabricantes enfiam `(R)` e `(TM)` no meio do nome do produto.

   ⚠️ **E ERA ISSO QUE ESTAVA QUEBRANDO A DETECÇÃO.** A expressão anterior tinha
   `radeon graphics` — com um espaço literal —, e uma APU Ryzen se apresenta como
   **"AMD Radeon(TM) Graphics"**. O `(TM)` no meio fazia a alternativa falhar, e
   com ela falhava o teto: **toda a linha de APUs Ryzen sem número de modelo na
   string caía em `alta`.** O mesmo `(TM)` derrubava `Intel(R) Arc(TM) Graphics`
   (a integrada do Meteor Lake). Daí a normalização abaixo vir ANTES de qualquer
   teste — é ela, e não as listas, o conserto principal deste bloco.

   O CAMINHO QUE ESTA SONDA NÃO PODE TOMAR, e vale registrar para ninguém tentar:
   `navigator.gpu.requestAdapter()` devolve vendor e arquitetura limpos e sem
   máscara — e é **assíncrono**. Esta função é chamada no escopo de módulo de
   `scene/scene.ts`, antes de o `WebGLRenderer` existir, para responder
   `antialias` e `shadowMap.type`; não há onde esperar uma promessa. Um segundo
   passe assíncrono que REFINASSE o palpite depois do boot é possível e é
   trabalho de outra passagem. */

/** Tira `(R)`, `(TM)`, `®`, `™` e o excesso de espaço, e baixa a caixa. Todas as
 *  listas abaixo são escritas contra o resultado DISTO, nunca contra o cru. */
const normalizarRenderer = (s: string) =>
  s.toLowerCase().replace(/\((r|tm)\)|®|™/g, ' ').replace(/\s+/g, ' ').trim();

/* Rasterizadores de software. Esta lista é de CERTEZA: qualquer uma destas
   strings significa que não há placa envolvida, e nenhum ajuste de qualidade
   conserta isso. */
const SOFTWARE_RE = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic|apple software/;

/* ⚠️ TESTADA ANTES DA DE INTEGRADAS, e ela existe porque as duas famílias
   COMPARTILHAM NOME. "Intel Arc A770" é uma placa dedicada e "Intel Arc
   Graphics" é a integrada do Meteor Lake; "Radeon RX 570" é dedicada e "Radeon
   Graphics" é uma APU. A diferença está no número de modelo, não no nome da
   marca — então é o número de modelo que decide. */
const DISCRETE_RE =
  /\b(geforce|quadro|titan|tesla|nvidia)\b|\bradeon (rx|pro|r9|hd [5-8]\d{3})\b|\bfirepro\b|\barc a\d{3}\b|\bintel arc a\d/;

/* ADAPTADORES INTEGRADOS, incluindo os MODERNOS.
   ---------------------------------------------------------------------------
   Casar aqui é um TETO, e desde 2026-08-15 o teto é `baixa` — ver `suggestLevel`.

   Cobertura, alternativa por alternativa (contra a string JÁ NORMALIZADA):

     intel …(hd|uhd|iris|arc)   HD 4000, UHD 630, Iris Plus, Iris Xe, Arc
                                integrada. O `[^,]*` atravessa o "(R)" virado em
                                espaço e o "Xe" entre "iris" e "graphics", que a
                                expressão anterior não atravessava.
     vega \d{1,2}               Vega 3/8/11 das APUs Ryzen 2000–5000.
     radeon \d{3}m              660M, 680M, 780M, 890M das APUs mais novas.
     radeon graphics            **A ALTERNATIVA QUE ESTAVA QUEBRADA.** É como as
                                APUs Ryzen sem número se apresentam, e o filtro
                                de dedicadas acima já tirou as RX/Pro daqui.
     adreno|mali|powervr|…      móveis e SBCs.

   ⚠️ Apple Silicon NÃO entra. Um M1/M2/M3 é memória unificada, não "integrada"
   no sentido que importa aqui: a banda é de 100-400 GB/s, uma ordem de grandeza
   acima de um DDR4 de dois canais. Ele é julgado pelo medidor como qualquer
   outra máquina desconhecida — e, na prática, o Safari já o entrega como uma
   string genérica de qualquer jeito. */
const INTEGRATED_RE =
  /\bintel\b[^,]*\b(hd|uhd|iris|arc)\b|\bvega ?\d{1,2}\b|\bradeon ?\d{3}m\b|\bradeon graphics\b|adreno|mali|powervr|videocore|llvmpipe|\bmicrosoft basic\b/;

/* Famílias reconhecidamente modestas ou antigas. Esta lista é de PALPITE e hoje
   ela não muda mais o TETO (integrada já vai para `baixa`, e não há nível
   abaixo). Ela sobrevive porque continua sendo relatada na interface de
   diagnóstico: um relato que traz "weakHint" é um relato que se reproduz. */
const WEAK_RE =
  /\bintel\b.*\bhd graphics [2-5]\d\d\b|\bgma\b|\bradeon r[2-5]\b|mali-?[gt]?[0-6]|adreno ?[1-5]\d\d|videocore|geforce (8|9|2\d\d|3\d\d|4\d\d|5\d\d|610m|710m|810m)\b/;

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
    textureUnits: 0,
    compressed: { s3tc: false, bptc: false, astc: false, etc2: false },
    gpuClass: null,
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
    out.textureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) || 0;
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    out.maxAnisotropy = aniso
      ? gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 0 : 0;

    /* OS FORMATOS COMPRIMIDOS — o sinal que o navegador NÃO mascara.
       `getExtension` de um formato não suportado devolve `null` e não custa nada
       além da consulta; são quatro chamadas uma vez por sessão. */
    const tem = (n: string) => !!gl.getExtension(n);
    out.compressed = {
      s3tc: tem('WEBGL_compressed_texture_s3tc'),
      bptc: tem('EXT_texture_compression_bptc'),
      astc: tem('WEBGL_compressed_texture_astc'),
      etc2: tem('WEBGL_compressed_texture_etc'),
    };
    /* A ASSINATURA DE ARQUITETURA. Rasterizadores imediatos de PC trazem
       S3TC/BPTC e NÃO trazem ASTC; rasterizadores por LADRILHO (Adreno, Mali,
       PowerVR, Apple) trazem ASTC/ETC2. Um adaptador que anuncia os dois — ou
       nenhum — fica sem veredito, e sem veredito nada se rebaixa. */
    const desktop = (out.compressed.s3tc || out.compressed.bptc) && !out.compressed.astc;
    const tile = out.compressed.astc || (out.compressed.etc2 && !out.compressed.s3tc);
    out.gpuClass = desktop && !tile ? 'desktop' : (tile && !desktop ? 'tile' : null);

    /* MASCARADO NO FIREFOX POR PRIVACIDADE, e genérico no Safari. Um `null` aqui
       é "não sei", e a política de `null` é tratar como máquina BOA — ver o
       aviso no cabeçalho.

       ⚠️ TUDO É TESTADO CONTRA A STRING NORMALIZADA, e as dedicadas são
       descartadas ANTES da lista de integradas: "Intel Arc A770" e "Intel Arc
       Graphics" só se distinguem pelo número de modelo. Ver o bloco das listas. */
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      const s = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
      if (typeof s === 'string' && s) {
        out.renderer = s;
        const n = normalizarRenderer(s);
        out.software = SOFTWARE_RE.test(n);
        const dedicada = !out.software && DISCRETE_RE.test(n);
        out.integrated = !out.software && !dedicada && INTEGRATED_RE.test(n);
        out.weakHint = !out.software && !dedicada && WEAK_RE.test(n);
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
 *
 * ---------------------------------------------------------------------------
 * ⚠️ 2026-08-15: O TETO DA INTEGRADA DESCEU DE `media` PARA `baixa`
 *
 * A correção de 2026-08-14 pôs a UHD 630 em `media`. A ablação mostrou que
 * `media` **não salva ninguém**: ele submete 3 216 das 3 804 chamadas do Alto
 * (85 %), paga +5,31 ms de reassadura de sombra em 78 % dos quadros, e o botão
 * que ele mais mexia atacava preenchimento — 0 % do quadro. Extrapolado para um
 * i5 de 10ª, `media` dá **~27 fps antes de a placa desenhar um pixel**. Ou seja:
 * a máquina do pedido continuava abrindo num nível em que ela não roda.
 *
 * **A ASSIMETRIA DE CUSTO É O ARGUMENTO INTEIRO, e ela é grosseira:**
 *
 *   · abrir ALTO DEMAIS numa integrada custa a primeira impressão — dez segundos
 *     de engasgo na carga, arrasto aos trancos, e no pior caso uma perda de
 *     contexto de WebGL com a memória compartilhada estourada. Quem passa por
 *     isso fecha a aba e não fica para ver o adaptador corrigir;
 *   · abrir BAIXO DEMAIS numa integrada boa (uma 780M, uma Iris Xe recente)
 *     custa **cinco segundos**: `UP_HOLD` é 5 000 ms, e o medidor promove sozinho
 *     assim que a máquina segurar 0,75 × o alvo. O usuário vê a imagem melhorar.
 *
 * Cinco segundos de imagem conservadora contra uma sessão perdida. Não é um
 * julgamento sobre a 780M ser boa — é sobre qual dos dois erros dá para desfazer.
 *
 * ⚠️ O QUE ISSO ARRASTA JUNTO, e é honesto dizer: abrir em `baixa` carrega a
 * assinatura FRIA do Baixo (`spotPool: 0`, `shadowType: 'basic'`, e as variantes
 * `@ktx2`/`@1k` se o manifesto as declarar). Quando o medidor promover para
 * `media`, a parte fria fica PENDENTE — o medidor nunca levanta cortina — e só
 * entra na próxima borda natural de carga. Ou seja a promoção é parcial por
 * alguns minutos. É o preço do desenho, e ele é preferível ao inverso:
 * levantar cortina sozinho no meio de um arrasto é o defeito que a adaptação
 * existe para evitar.
 */
export function suggestLevel(p = probeHardware()): QualityLevel {
  if (!p.webgl2) return 'baixa';
  /* Rasterizador de software: nem o nível Baixo salva, mas é o menos ruim, e é
     o único caso em que esta função tem CERTEZA em vez de palpite. */
  if (p.software) return 'baixa';

  /* O TETO, pela classe do adaptador. `null` (Firefox, Safari) não é teto
     nenhum — ver o aviso "ausência de informação nunca significa fraco". */
  let ceiling: QualityLevel = 'alta';
  if (p.integrated || p.weakHint) ceiling = 'baixa';
  /* ARQUITETURA DE LADRILHO SEM STRING. Este é o único caminho pelo qual um
     adaptador NÃO IDENTIFICADO é rebaixado, e ele não fere a regra do cabeçalho
     porque não se baseia em ausência: ASTC/ETC2 é uma informação positiva, que o
     navegador entrega sempre. Um rasterizador por ladrilho paga
     desproporcionalmente pelo `discard` da folhagem e pelo overdraw
     transparente da chuva — as duas categorias mais caras desta cena. Teto
     `media`, e não `baixa`: um M3 Max cai aqui, e ele não é uma UHD 630. */
  else if (!p.renderer && p.gpuClass === 'tile') ceiling = 'media';

  /* Agora os rebaixamentos, dentro do teto. Nenhum sozinho decide. */
  let score = 0;
  if (p.touch) score -= 1;
  if (p.cores && p.cores <= 4) score -= 1;
  if (p.memoryGB && p.memoryGB <= 4) score -= 2;
  else if (p.memoryGB && p.memoryGB <= 8) score -= 1;
  /* MAX_TEXTURE_SIZE abaixo de 16384 é a assinatura de um adaptador antigo ou de
     classe móvel, e ela SOBREVIVE À MÁSCARA — praticamente todo desktop de PC
     desde 2012 responde 16384. Vale pouco sozinha, por isso é −1. */
  if (p.maxTextureSize && p.maxTextureSize < 16384) score -= 1;
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
/* ---------------- O PINO DE TETO ----------------
   ⚠️ ISTO EXISTIA COMO PROMESSA E NÃO COMO CÓDIGO. O cabeçalho deste arquivo
   afirma, desde que foi escrito: *"COROLÁRIO INTOCADO: a captura
   (`scene/capture.ts`) e a gravação (`scene/record.ts`) rodam SEMPRE no teto"*.
   A captura cumpria — importa `ceilingProfile()` e o aplica. **A gravação não
   importava uma linha sequer deste módulo**, ou seja: quem estivesse no nível
   Baixo gravava um vídeo com `orangePeel` desligado, uma oitava de floco,
   vegetação a 35 %, sem ondulação de chuva e com o chão a 1024² — e depois
   comparava esse vídeo com a FOTO, que sai no teto. É a explicação mecânica do
   relato "a gravação fica com a qualidade muito ruim".

   O pino é um CONTADOR e não um booleano porque nada garante que só um dono
   peça teto por vez (uma captura disparada de dentro de uma gravação é
   improvável, mas um `finally` que zera o estado de outro é um defeito caro e
   silencioso). Só a transição 0↔1 emite, para não repintar a cena à toa.

   ⚠️ O QUE ELE NÃO ALCANÇA, e é a MESMA exceção já registrada em
   `ceilingProfile()`: `spotPool`, `shadowType` e `antialias` são FRIOS. Uma
   gravação feita no nível Baixo continua saindo com o pool e o filtro do Baixo,
   porque trocá-los exigiria recompilar a cena no meio da gravação — e uma
   cortina de dois segundos no meio de um vídeo é pior que a degradação. A
   resposta de produto é a interface avisar (`RecordResult.degraded`), não o
   código fingir que não existe. */
let ceilingPins = 0;

/**
 * Força `getProfile()` a devolver o TETO enquanto houver pino.
 *
 * Emparelhe SEMPRE num `finally` — um pino vazado congela a cena no perfil Alto
 * e o usuário fica sem entender por que a máquina dele piorou depois de gravar.
 */
export function pinCeilingProfile(on: boolean) {
  const antes = ceilingPins > 0;
  ceilingPins = Math.max(0, ceilingPins + (on ? 1 : -1));
  if (antes !== (ceilingPins > 0)) emit();
}

/** Há um pino de teto de pé? A interface usa para explicar o perfil mostrado. */
export const ceilingPinned = () => ceilingPins > 0;

export function getProfile(): QualityProfile {
  hydrate();
  /* ANTES de qualquer outra coisa: com o pino de pé, o nível vigente é
     irrelevante por definição. `ceilingProfile()` já apara anisotropia e mapa de
     sombra contra o device, que é a mesma aparagem feita abaixo. */
  if (ceilingPins > 0) return ceilingProfile();
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
 *  oscilar entre os dois.
 *
 *  ⚠️ ESTES DOIS NÚMEROS SOZINHOS SÃO UMA CATRACA DE MÃO ÚNICA NUMA TELA DE
 *  60 Hz. Ver O PISO DE VSYNC, logo abaixo — eles continuam valendo, mas passam
 *  a ser um dos DOIS termos de cada portão. */
const DEAD_LOW = 0.75, DEAD_HIGH = 1.08;

/* ---------------------------------------------------------------------------
   ⚠️⚠️ O PISO DE VSYNC — o defeito que fazia o nível Alto NASCER NÍTIDO E
   ENVELHECER BORRADO, e por que ele não aparecia em bancada nenhuma
   ===========================================================================
   O relato que trouxe este bloco: *"no alto no meu PC ainda cai às vezes para
   menos de 60 fps, e não deveria — meu PC roda GTA e Cyberpunk"*, junto com
   *"não sinto fluida a movimentação da câmera"*. As duas frases são o MESMO
   defeito visto de dois lados, e ele mora exatamente aqui.

   O QUE A RÉGUA MEDE. `reportFrameTime()` recebe o tempo de PAREDE entre dois
   quadros DESENHADOS CONSECUTIVOS (ver o bloco de lá — a mudança de régua de
   2026-08-14 foi certa e continua certa). Só que o laço roda em
   `renderer.setAnimationLoop`, ou seja em `requestAnimationFrame`, ou seja
   **preso ao vsync**: dois quadros consecutivos NUNCA ficam a menos de um
   período de atualização de distância. Numa tela de 60 Hz o menor valor que
   `wallMs` pode assumir é ~16,67 ms, e nenhuma máquina do mundo faz melhor.

   AGORA CRUZE ISSO COM OS PORTÕES, para o nível Alto (alvo 16,7 ms):

       descer resolução   ema > 16,7 × 1,08 = 18,0 ms
       subir  resolução   ema < 16,7 × 0,75 = 12,5 ms   ← INALCANÇÁVEL a 60 Hz

   **O portão de subida está abaixo do piso físico da tela.** Ele nunca fecha.
   O de descida, por outro lado, fecha com facilidade: um único quadro perdido
   (33,3 ms) move um EMA de alfa 0,1 de 16,7 para **18,4 ms**, que já cruza os
   18,0. E aí a escala desce um degrau — e não volta nunca mais.

   O resultado, numa sessão longa de qualquer máquina que engasgue duas vezes:

       1,00  →  0,88  →  0,80 (piso da faixa do Alto)  e para sempre.

   Ou seja **64 % dos pixels, permanentemente, na máquina mais rápida do
   catálogo** — e a única pista era uma linha de `console.info` dizendo
   "[qualidade] escala 1.00 → 0.88 · 18.4 ms de quadro" que ninguém liga o nome
   à pessoa. É a explicação mecânica de "não sinto fluida a movimentação": a
   movimentação não ficou mais lenta, a imagem ficou mais MACIA, e o olho lê as
   duas coisas juntas.

   ⚠️ E O BAIXO TEM O MESMO DEFEITO, POR UM FIO DE CABELO. Alvo 22,2 ms ⇒ portão
   de subida em 22,2 × 0,75 = **16,65 ms**, contra um piso de 16,67. Falha por
   dois centésimos de milissegundo. Quem foi rebaixado até o Baixo nunca mais
   sobe de nível, porque a promoção exige `scale >= band.max` e a escala nunca
   volta ao topo da faixa.

   ⚠️ POR QUE NENHUMA BANCADA PEGOU ISTO. `tools/studio-bench/` mede em laço
   FECHADO com `gl.finish()` nas duas pontas, fora do vsync — é a metodologia
   correta de `GARGALO-2026-08-15.md` e é justamente a que apaga o fenômeno.
   Este controlador só existe no laço vivo, e o laço vivo é a única coisa que a
   bancada não roda.

   ---------------------------------------------------------------------------
   O CONSERTO: O ALVO EFETIVO É `max(alvo do nível, piso da tela)`

   Não se persegue um tempo de quadro que a tela não consegue apresentar. O piso
   entra como SEGUNDO termo de cada portão, e a folga em cima dele é expressa em
   fração de QUADRO PERDIDO, que é a única leitura honesta sob vsync:

       ema / piso = 1,00  →  a tela apresenta todo quadro. Não há o que comprar
       ema / piso = 1,10  →  ~10 % dos quadros caem
       ema / piso = 2,00  →  metade da taxa

   Daí `VSYNC_UP` 1,03 (devolve nitidez com menos de ~3 % de perda sustentada) e
   `VSYNC_DOWN` 1,25 (só cobra nitidez com ~25 % de quadros caindo). A banda
   morta resultante no Alto a 60 Hz é [17,2 ; 20,8] ms — **3,6 ms de largura**,
   contra os 0,0 de hoje —, e ela continua assimétrica na mesma direção que
   `DEAD_LOW`/`DEAD_HIGH` já escolheram: descer é fácil, subir é exigente.

   ---------------------------------------------------------------------------
   ⚠️ COMO O PISO É ESTIMADO, E POR QUE TODO ERRO DELE CAI PARA O LADO SEGURO

   Não há API de taxa de atualização no navegador. O piso é o MENOR `wallMs` de
   regime já observado — que sob vsync é o período de atualização por
   construção. Três travas, e o que cada uma protege:

     · **só amostras plausíveis** (4 a 40 ms). Abaixo de 4 ms é um laço que não
       está preso ao vsync (a bancada, uma aba em segundo plano acordando com
       dois rAF colados); acima de 40 ms não é piso de tela nenhuma;
     · **mínimo MONOTÔNICO**, e ele só desce. Um piso baixo demais faz
       `Math.max` escolher o termo antigo, ou seja **degrada exatamente para o
       comportamento de hoje**. Errar para baixo é gratuito;
     · **aparado pelo alvo do nível** (`Math.min(piso, band.targetMs)`), e esta
       é a trava que importa. Sem ela, uma máquina fraca que NUNCA chega a
       16,7 ms teria o piso latido em 33,3 e o controlador concluiria "a tela é
       de 30 Hz, está tudo bem" — deixando de baixar resolução exatamente na
       integrada para a qual o nível Baixo existe. Com ela, o piso nunca sobe
       acima do alvo do nível, e uma máquina a meia taxa continua sendo
       rebaixada como hoje.

   ⚠️ O CASO QUE ELE ERRA, dito por inteiro: um monitor de 30 Hz com uma máquina
   rápida. O piso observado seria 33,3, aparado para 16,7, e o controlador
   baixaria resolução perseguindo um alvo que a TELA não apresenta. É o
   comportamento de HOJE, não uma regressão — e um painel de 30 Hz num desktop
   que roda este estúdio é hipótese de laboratório.

   ⚠️ E ELE NÃO É ZERADO POR `resetMeter()`. A taxa de atualização da tela é
   propriedade do MONITOR, não do perfil: zerá-la a cada troca de nível faria o
   controlador reaprender o piso justamente no momento em que ele mais precisa
   dele. Quem mudar de monitor no meio da sessão fica com o piso do anterior —
   e, se o novo for mais lento, o erro cai para o lado seguro descrito acima.
   --------------------------------------------------------------------------- */
const VSYNC_MIN_MS = 4;          // 250 Hz — acima disto o laço não está preso ao vsync
const VSYNC_MAX_MS = 40;         // 25 Hz — abaixo disto não é piso de tela
/** Quantas amostras de regime antes de acreditar no piso. Enquanto não houver,
 *  os portões são LITERALMENTE os de antes desta revisão. */
const VSYNC_MIN_AMOSTRAS = 30;
/** Folga sobre o piso para DEVOLVER nitidez: ~3 % de quadros caindo. */
const VSYNC_UP = 1.03;
/** Folga sobre o piso para COBRAR nitidez: ~25 % de quadros caindo. */
const VSYNC_DOWN = 1.25;

let vsyncMs = 0;                 // 0 = ainda não sei
let vsyncAmostras = 0;

/** O período de atualização observado, ou 0 enquanto não houver amostras que
 *  bastem. Zero significa "trate como antes desta revisão". */
function pisoDaTela(): number {
  return vsyncAmostras >= VSYNC_MIN_AMOSTRAS ? vsyncMs : 0;
}

/**
 * Os dois limiares de escala do nível, já com o piso da tela dentro.
 *
 * Exportado porque o painel de Configurações e a bancada precisam poder mostrar
 * POR QUE a escala está onde está — um controlador cujos limiares não são
 * legíveis é o que produziu o defeito acima.
 */
export function scaleGates(l: QualityLevel = qualityLevel()) {
  const band = BANDS[l];
  /* APARADO PELO ALVO — ver a terceira trava no bloco acima. */
  const piso = Math.min(pisoDaTela(), band.targetMs);
  return {
    piso,
    subir: Math.max(band.targetMs * DEAD_LOW, piso * VSYNC_UP),
    descer: Math.max(band.targetMs * DEAD_HIGH, piso * VSYNC_DOWN),
  };
}

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
  /* O PISO DA TELA — ver ⚠️⚠️ O PISO DE VSYNC. Alimentado com a amostra CRUA e
     não com o EMA: o piso é o melhor caso observado, e um EMA nunca chega ao
     melhor caso. Fica FORA do teste de `mode`, junto com a régua: um usuário que
     congelou o nível continua vendo o painel dizer qual é o piso da tela dele. */
  if (wallMs >= VSYNC_MIN_MS && wallMs <= VSYNC_MAX_MS) {
    vsyncAmostras++;
    if (!vsyncMs || wallMs < vsyncMs) vsyncMs = wallMs;
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
    /* ⚠️ OS DOIS LIMIARES VÊM DE `scaleGates()`, E NÃO MAIS DE `band.targetMs`
       DIRETO. Sem o piso da tela o portão de subida do Alto valia 12,5 ms num
       laço cujo menor quadro possível é 16,67 — inalcançável por construção, o
       que fazia deste controlador uma catraca de mão única. Ver ⚠️⚠️ O PISO DE
       VSYNC. Enquanto o piso não estiver medido, `scaleGates()` devolve
       exatamente `targetMs × DEAD_LOW` e `targetMs × DEAD_HIGH`. */
    const gates = scaleGates(level);
    if (!desceu) { /* nem descer nem subir ainda */ }
    else if (ema > gates.descer) {
      /* Não desce abaixo do piso da faixa: aí o problema não é resolução, e
         continuar cortando só borra a imagem sem devolver quadro. */
      if (STEPS[cur] > band.min + 1e-4 && cur > 0) {
        lastScaleStep = now;
        setScale(Math.max(band.min, STEPS[cur - 1]), `${ema.toFixed(1)} ms de quadro`);
        return;
      }
    } else if (subiu && ema < gates.subir) {
      if (STEPS[cur] < band.max - 1e-4 && cur < STEPS.length - 1) {
        lastScaleStep = now;
        setScale(Math.min(band.max, STEPS[cur + 1]), `${ema.toFixed(1)} ms de quadro`);
        return;
      }
    }
  }

  /* ---- DEPOIS O NÍVEL, e só quando a escala já está no fim da faixa. ---- */
  if (now - lastStep < STEP_COOLDOWN) return;

  /* ⚠️ O DEGRAU DE NÍVEL TEM O MESMO DEFEITO E O MESMO CONSERTO. `UP_FACTOR`
     0,75 sobre um alvo de 16,7 ms dá 12,5 ms, que numa tela de 60 Hz é
     fisicamente inatingível — logo a PROMOÇÃO de nível nunca acontecia e todo
     rebaixamento automático era permanente por construção. O piso da tela entra
     como segundo termo, exatamente como em `scaleGates()`.

     A DESCIDA fica INTOCADA na prática, e isso é de propósito: `targetMs × 1,6`
     (26,7 ms no Alto) é maior que `piso × 1,25` (20,8 ms), então o `Math.max`
     escolhe o termo antigo. Rebaixar um NÍVEL custa decisão visual autorada
     (refletores, filtro de sombra); tem de exigir mais margem que mexer na
     resolução, e continua exigindo.

     ⚠️ O QUE ISTO ADMITE: com a promoção voltando a existir, uma máquina
     exatamente no limiar pode subir e descer de nível. O teto continua sendo
     `MAX_DROPS = 3` — a catraca para sozinha depois de três descidas, e a partir
     daí quem trabalha é a ESCALA, que é o botão que a doutrina deste arquivo
     manda usar primeiro. Uma oscilação limitada a três ciclos de ≥ 17 s é
     estritamente melhor que a alternativa de hoje, que é nunca voltar. */
  const pisoNivel = Math.min(pisoDaTela(), band.targetMs);
  const subirNivel = Math.max(band.targetMs * UP_FACTOR, pisoNivel * VSYNC_UP);
  const descerNivel = Math.max(band.targetMs * DOWN_FACTOR, pisoNivel * VSYNC_DOWN);

  if (ema > descerNivel && scale <= band.min + 1e-4) {
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
  } else if (ema < subirNivel && scale >= band.max - 1e-4) {
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
    /* ---- CONGELAR TEM DE DEVOLVER A ESCALA DECLARADA (2026-08-15) ----
       ⚠️ `setLevel()` sai cedo quando o nível não muda, e é DENTRO dele que a
       escala é reposta. Sem esta linha, escolher à mão o nível em que a cena já
       estava deixa a escala onde o controlador automático a tinha largado — e,
       como congelar DESLIGA o controlador (`if (mode !== 'auto') return` em
       `reportFrameTime`), ela fica ali para sempre.

       O caso real, medido pela bancada em 2026-08-15: o estúdio abre em `auto`,
       a cortina de carga entrega quadros ruins, o controlador desce a escala do
       nível Alto para 0,80 (o piso da faixa) — e aí o usuário clica em "Alta"
       para garantir a melhor imagem e RECEBE 64 % dos pixels, em silêncio, com
       o painel dizendo "Alta · renderScale 1,00". A corrida de aceitação leu
       exatamente isso: Alta desenhando 1152×720 enquanto a Média desenhava
       1267×792, ou seja o nível ALTO com MENOS pixels que o Médio.

       É a mesma família de defeito que o §0 de OTIMIZACAO-2026-08-14.md
       catalogou — o seletor que não seleciona —, e é a mais cara delas, porque
       aqui o botão não é inerte: ele é DESOBEDECIDO. */
    const want = PROFILES[level].renderScale;
    const band = BANDS[level];
    const alvo = Math.max(band.min, Math.min(band.max, want));
    if (Math.abs(alvo - scale) > 1e-4) {
      console.info(`[qualidade] escala reposta ${scale} → ${alvo} · o usuário congelou ${level}`);
      scale = alvo;
      for (const cb of scaleListeners) cb(scale);
    }
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
    /* ---- O PISO DA TELA E OS DOIS PORTÕES ----
       Sem estes três campos o controlador é uma caixa preta, e foi essa opacidade
       que deixou a catraca de mão única de pé por uma revisão inteira: a única
       pista era uma linha de `console.info` de uma escala descendo. Ver
       ⚠️⚠️ O PISO DE VSYNC.

       Leitura: `pisoDaTelaMs` ~16,7 é uma tela de 60 Hz; ~6,9 é 144 Hz; 0 é
       "ainda não medi" (menos de 30 quadros de regime), e nesse caso os portões
       são os de antes desta revisão. Se `msPorQuadro` estiver colado no piso e a
       escala não estiver em `faixaDaEscala.max`, o controlador está com uma
       subida pendente — e ela leva até 3 s (`SCALE_COOLDOWN_UP`). */
    pisoDaTelaMs: Math.round(pisoDaTela() * 100) / 100,
    portoesDaEscala: scaleGates(),
    rebaixamentos: drops,
    frioPendente: coldPending(),
    hardware: hw,
    perfil: getProfile(),
    frio: { pedido: coldProfile(), aplicado: appliedColdProfile() },
  };
}
