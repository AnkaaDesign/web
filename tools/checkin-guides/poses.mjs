/* O JOGO DE POSES, e de onde cada número saiu.
   ===========================================================================
   MEDIDO NAS FOTOS DE CHECK-IN DO SERVIDOR (amostra de 88, tiradas de
   `/srv/files/Clientes/<cliente>/Checkin`), não escolhido no olho:

   · O quadro é 1600×900 ou 900×1600. Nas 39 fotos medidas com `identify`, 27
     retratos e 12 paisagens, sem uma exceção e sem tag EXIF de rotação — o app
     grava com o lado maior em 1600. Guia com outra proporção não registra.

   · Lateral são TRÊS fotos por lado: uma puxada para a frente, uma no meio e
     uma puxada para trás. Sai da contagem: as O.S. de "logomarca laterais" e
     "pintura laterais" trazem 5,6 fotos por O.S. (429/77 e 207/37), e as de
     traseira 1,4. Seis = três por lado.

   · Traseira e frontal são RETRATO. As quatro fotos de "logomarca traseira" da
     amostra são todas 900×1600, de frente para as portas, com o chão no quadro.

   · A câmera é uma PESSOA em pé: 1,55 m. Nas fotos, a linha do horizonte cruza
     a carroceria logo acima do piso do baú (1,392 m no modelo) e o operador
     ainda enxerga um fio do estrado por baixo — o que põe o olho entre 1,5 e
     1,6 m. Ver `camY` em cada pose; o comparador (`compara.mjs`) existe
     justamente para essa checagem virar imagem.

   · `fovLongDeg` 68° é a principal do celular (≈26 mm equivalentes) no eixo
     LONGO do quadro. Foi o valor que fechou a sobreposição contra as fotos
     reais no comparador.

   REFERENCIAL DO IMPLEMENTO (medido no GLB): +Z é a TESTEIRA (pino-rei em
   z +6,427), −Z são as PORTAS (z −7,48). O baú tem x ±1,304, piso y 1,392 e
   teto y 4,169. Com Y para cima e a mão direita, quem olha para +Z tem +X à
   ESQUERDA — então +X é a lateral ESQUERDA do veículo e −X a DIREITA, que é o
   lado da caixa de ferramenta (x −1,284…−0,662 no arquivo) e da porta lateral,
   como manda um país que dirige pela direita. */

const LAND = { w: 1600, h: 900 };
const PORT = { w: 900, h: 1600 };
const EYE = 1.55;
const FOV = 68;

/* ===========================================================================
   SIMETRIA — a razão de existir do campo `espelhoDe`.

   O pedido é que as fotos parem de ser desconexas: "o mesmo ângulo de um lado e
   do outro tem de dar exatamente o mesmo resultado". Ajustar cada pose pela
   própria silhueta NÃO entrega isso — o implemento não é simétrico (caixa de
   ferramenta e porta lateral só existem em −X, os registros só em um canto), e
   um ajuste que mede a silhueta devolve distâncias diferentes de um lado para o
   outro. A diferença é pequena e é exatamente o tipo de coisa que faz duas
   fotos "quase iguais" não se sobreporem.

   Então o lado ESQUERDO é resolvido e o DIREITO é o espelho ARITMÉTICO dele:
   câmera e mira com o X trocado de sinal. Mesma distância, mesma altura, mesmo
   ângulo, mesmo FOV — por construção, não por convergência.

   O par dianteira/traseira segue a mesma doutrina por outro campo,
   `mesmaDistanciaQue`: a traseira herda a distância resolvida da dianteira e só
   recentra. Os azimutes são 60° / 90° / 120°, isto é, ±30° da perpendicular —
   um passo redondo, que é o que faz o jogo parecer um jogo.

   O que NÃO é espelhado é a imagem: o guia da lateral direita mostra o
   implemento com a testeira para o outro lado, porque é isso que a pessoa vê
   quando dá a volta no veículo. Espelhar o PNG deixaria o desenho bonito e o
   operador de costas para a carreta. */

/** Três poses por lado, medidas da TESTEIRA (+Z) no sentido do lado. */
/* `fillW` 0,88 e `cy` 0,44 NÃO são gosto — saem da foto 002 da amostra, medida
   sobre uma grade de 100 px:

     baú de x 95 a 1500  → 0,88 da largura, centrado em 0,50
     teto em y ≈ 185     → 0,21 do topo
     contato do pneu     → y ≈ 570, ou 0,63

   E fecham com a conta de uma câmera NIVELADA a 1,55 m: a 12 m da parede, o
   meio-quadro vale 12·tan(20,78°) = 4,55 m, então o quadro cobre de −3,0 m a
   +6,1 m; o teto do modelo (4,169) cai em 0,21 e o chão (0) em 0,67. Os dois
   números batem com a foto. É a confirmação de que 1,55 m é a altura certa e de
   que a foto boa é feita com o celular NIVELADO — o `cy` 0,44 é só onde o
   centro da silhueta (y 2,085 m) cai quando isso acontece.

   O valor anterior, 0,54, punha o veículo meio quadro abaixo do que a foto real
   mostra; via-se na sobreposição. */
const LATERAIS = [
  { slot: 'dianteira', az: 60, cx: 0.50, cy: 0.44, fillW: 0.88, fillH: 0.84 },
  { slot: 'centro', az: 90, cx: 0.50, cy: 0.44, fillW: 0.88, fillH: 0.84 },
  { slot: 'traseira', az: 120, cx: 0.50, cy: 0.44, fillW: 0.88, fillH: 0.84 },
];

const rotuloLateral = (lado, slot) => `Lateral ${lado} — ${
  slot === 'centro' ? 'no meio' : slot === 'dianteira' ? 'puxada para a frente'
    : 'puxada para trás'}`;

/**
 * O jogo inteiro, já ordenado: toda pose base vem antes do espelho dela, e a
 * dianteira antes da traseira que herda a distância. `shoot.mjs` conta com essa
 * ordem — ela é o contrato, não uma coincidência.
 */
export function buildPoses() {
  const out = [];

  /* --- laterais: esquerda resolvida, direita espelhada ------------------- */
  for (const l of LATERAIS) {
    out.push({
      name: `lateral-esquerda-${l.slot}`,
      grupo: 'lateral', lado: 'esquerda', ordem: LATERAIS.indexOf(l),
      rotulo: rotuloLateral('esquerda', l.slot),
      ...LAND, azDeg: l.az, camY: EYE, fovLongDeg: FOV,
      fillW: l.fillW, fillH: l.fillH, cx: l.cx, cy: l.cy, aimY: 2.2, lineW: 2.6,
      mesmaDistanciaQue: l.slot === 'traseira' ? 'lateral-esquerda-dianteira' : null,
    });
  }
  for (const l of LATERAIS) {
    out.push({
      name: `lateral-direita-${l.slot}`,
      grupo: 'lateral', lado: 'direita', ordem: LATERAIS.indexOf(l),
      rotulo: rotuloLateral('direita', l.slot),
      ...LAND, azDeg: -l.az, camY: EYE, fovLongDeg: FOV,
      fillW: l.fillW, fillH: l.fillH, cx: l.cx, cy: l.cy, aimY: 2.2, lineW: 2.6,
      espelhoDe: `lateral-esquerda-${l.slot}`,
    });
  }

  /* --- traseira e frontal: no plano de simetria ------------------------- */
  out.push({
    name: 'traseira-centro', grupo: 'traseira', lado: null, ordem: 0,
    rotulo: 'Traseira — de frente para as portas',
    ...PORT, azDeg: 180, camY: EYE, fovLongDeg: FOV,
    /* A distância é contada DA FACE, não do centro do implemento: `aimZ` põe a
       mira no plano das portas (z −7,48). Sem isso o ajuste tinha alavanca
       errada — 10 m de mira ao centro são 2,7 m de câmera à porta, e cada
       correção de escala andava duas vezes e meia o que devia. A traseira saía
       cortada nos quatro lados.
       Enquadra pela LARGURA, e o 0,90 foi MEDIDO: sobrepondo o guia às quatro
       fotos reais de traseira da amostra (015, 021, 022, 023), a face ocupa de
       0,91 a 0,95 do quadro. O valor anterior, 0,70, deixava o desenho
       visivelmente menor que o veículo em todas as quatro — o operador teria de
       se afastar 1,3 m além do que a equipe já faz.
       A altura não fecha junto, e isso é da FROTA, não do ajuste: nas fotos o
       veículo ocupa 0,70 da altura contra 0,80 aqui, porque boa parte delas é
       truck rígido, mais baixo que a carreta de 4,17 m do modelo. Entre casar
       largura e casar altura, largura ganha: é pela porta que o operador
       enquadra. */
    fillW: 0.90, fillH: 0.94, cx: 0.50, cy: 0.46, aimY: 2.1, aimZ: -7.48, lineW: 2.8,
    /* A mira é TRAVADA em x = 0: é uma pose de eixo, e deixar o ajuste
       escolher o X deslocaria o quadro pelo que só existe de um lado. */
    travaX: true,
  });
  out.push({
    name: 'frontal-centro', grupo: 'frontal', lado: null, ordem: 0,
    rotulo: 'Frontal — de frente para a testeira',
    ...PORT, azDeg: 0, camY: EYE, fovLongDeg: FOV,
    fillW: 0.90, fillH: 0.94, cx: 0.50, cy: 0.46, aimY: 2.1, aimZ: 7.23, lineW: 2.8,
    travaX: true,
  });

  /* --- carenagem de frio ------------------------------------------------ */
  /* A foto real é colada no vão entre cavalo e testeira, de baixo para cima.
     RESSALVA HONESTA: este GLB não traz a unidade de frio (`thermoking.glb` é
     outro arquivo, e o implemento do estúdio monta a unidade à parte). O guia
     aqui enquadra o CANTO ALTO DIANTEIRO do baú, que é exatamente onde a
     carenagem mora — serve de mira, não de silhueta da peça. Distância FIXA e
     mira travada: ajustar pela silhueta devolveria o baú inteiro, que não é o
     assunto. */
  out.push({
    name: 'carenagem-esquerda', grupo: 'carenagem', lado: 'esquerda', ordem: 0,
    rotulo: 'Carenagem de frio — esquerda',
    ...PORT, azDeg: 46, camY: EYE, fovLongDeg: FOV,
    fillW: 0.95, fillH: 0.95, cx: 0.50, cy: 0.55,
    aimX: 0.40, aimY: 3.30, aimZ: 6.90, lineW: 2.8, dist: 4.6, travaMira: true,
  });
  out.push({
    name: 'carenagem-direita', grupo: 'carenagem', lado: 'direita', ordem: 0,
    rotulo: 'Carenagem de frio — direita',
    ...PORT, azDeg: -46, camY: EYE, fovLongDeg: FOV,
    fillW: 0.95, fillH: 0.95, cx: 0.50, cy: 0.55,
    aimX: -0.40, aimY: 3.30, aimZ: 6.90, lineW: 2.8, dist: 4.6, travaMira: true,
    espelhoDe: 'carenagem-esquerda',
  });

  /* --- rodagem: agachado, 1,05 m --------------------------------------- */
  /* A foto de roda nunca é de pé. O bogie fica em z −6,98…−1,73, então a mira
     vai para o meio dele e não para o baú. */
  out.push({
    name: 'rodas-esquerda', grupo: 'rodas', lado: 'esquerda', ordem: 0,
    rotulo: 'Rodagem — esquerda',
    ...LAND, azDeg: 90, camY: 1.05, fovLongDeg: FOV,
    fillW: 0.95, fillH: 0.95, cx: 0.50, cy: 0.58, aimY: 0.75, aimZ: -3.5,
    lineW: 2.4, dist: 5.2, travaMira: true,
  });
  out.push({
    name: 'rodas-direita', grupo: 'rodas', lado: 'direita', ordem: 0,
    rotulo: 'Rodagem — direita',
    ...LAND, azDeg: -90, camY: 1.05, fovLongDeg: FOV,
    fillW: 0.95, fillH: 0.95, cx: 0.50, cy: 0.58, aimY: 0.75, aimZ: -3.5,
    lineW: 2.4, dist: 5.2, travaMira: true, espelhoDe: 'rodas-esquerda',
  });

  /* --- chassi ----------------------------------------------------------- */
  out.push({
    name: 'chassi-esquerda', grupo: 'chassi', lado: 'esquerda', ordem: 0,
    rotulo: 'Chassi — esquerda',
    ...LAND, azDeg: 104, camY: 1.20, fovLongDeg: FOV,
    fillW: 0.95, fillH: 0.95, cx: 0.50, cy: 0.62,
    aimY: 0.95, aimZ: -2.0, lineW: 2.4, dist: 9.0, travaMira: true,
  });
  out.push({
    name: 'chassi-direita', grupo: 'chassi', lado: 'direita', ordem: 0,
    rotulo: 'Chassi — direita',
    ...LAND, azDeg: -104, camY: 1.20, fovLongDeg: FOV,
    fillW: 0.95, fillH: 0.95, cx: 0.50, cy: 0.62,
    aimY: 0.95, aimZ: -2.0, lineW: 2.4, dist: 9.0, travaMira: true,
    espelhoDe: 'chassi-esquerda',
  });

  /* --- teto: NÃO EXISTE, e é uma decisão -------------------------------- */
  /* Havia aqui uma pose de teto, e ela estava errada de um jeito que nenhum
     ajuste de enquadramento conserta: para ver o teto de um baú de 4,17 m a
     câmera tem de estar ACIMA dele, e a versão anterior punha o olho a 5,50 m.
     Isso não é uma pose difícil, é uma pose impossível — o operador está de pé
     no chão do pátio.

     Não dá para inventar a certa a partir daqui: a foto real de teto sai de
     escada, de plataforma ou do mezanino, e QUAL desses muda tudo — altura,
     distância e azimute. A amostra também não ajuda; a única foto de "pintura
     teto" das 88 baixadas não existia mais no disco do servidor.

     Então as 129 O.S. de teto caem em "câmera limpa" até alguém dizer de onde a
     foto é tirada. Voltar a pose é uma linha: `camY` = a altura real do
     patamar, `aimY` = 4,2, azimute a gosto. Ver a regra de teto em REGRAS, que
     saiu junto pelo mesmo motivo. */

  return out;
}

/* ===========================================================================
   DESCRIÇÃO DA O.S. → JOGO DE FOTOS

   A regra é por PALAVRA-CHAVE sobre a descrição, porque é o que existe: a
   `ServiceOrder` guarda `description` como texto livre e as 12.210 linhas do
   banco trazem "logomarca padrÃo", "logomarca padrão", "pntura da frente e
   traseira" e "remoÇÃo geral" — mesma coisa escrita de seis jeitos. Por isso a
   comparação é feita sobre o texto NORMALIZADO (sem acento, minúsculo) e por
   RADICAL ("traseir" pega traseira/traseiras/traseiro).

   A ordem importa: a primeira regra que casar vence, e as específicas vêm
   antes das gerais — senão "pintura geral (inclusive frontal e carenagens do
   frio)" cai em `geral` e perde a carenagem. */
export const REGRAS = [
  /* CABINE não tem guia, e é uma decisão: "padronização de cabine", "plotagem
     cabine" e "adesivo cabine" (73 O.S.) são serviço no CAVALO, e o cavalo não
     está nesta cena — o pedido foi explicitamente sem ele. Guia de implemento
     numa foto de cabine atrapalharia em vez de ajudar. Elas caem no `[]` do
     fim, que o app lê como "câmera limpa". */
  { grupos: [], re: /cabine|gabine/ },

  { grupos: ['carenagem'], re: /carenag/ },
  /* "aparelho" é a unidade de frio — a carenagem é o que se pinta nela. */
  { grupos: ['carenagem'], re: /aparelho/ },
  { grupos: ['rodas'], re: /\brodas?\b|paralama/ },
  { grupos: ['chassi'], re: /chassi|chassis|caixa de ferramenta/ },
  /* `teto` não tem pose (ver o bloco no fim de buildPoses) — sem regra, a
     descrição cai em "câmera limpa" em vez de pedir um jogo vazio. */
  /* Faixa refletiva corre a lateral inteira e fecha na traseira. */
  { grupos: ['lateral', 'traseira'], re: /faixas? refletiv/ },
  { grupos: ['lateral', 'traseira', 'frontal'], re: /geral|padrao|padr o|completa|completo/ },
  { grupos: ['lateral', 'traseira'], re: /lateral|laterais/, mais: /traseir/ },
  { grupos: ['lateral', 'frontal'], re: /lateral|laterais/, mais: /frontal|frente|testeira/ },
  { grupos: ['lateral'], re: /lateral|laterais/ },
  { grupos: ['traseira', 'frontal'], re: /traseir/, mais: /frontal|frente/ },
  { grupos: ['traseira'], re: /traseir|porta traseira|portas traseiras/ },
  { grupos: ['frontal'], re: /frontal|frente|testeira/ },
  /* Aerografia sem superfície declarada: 164 O.S. escritas só como
     "AEROGRAFIA" ou "Aerografia Parcial". A arte de aerógrafo em implemento
     mora na lateral — as variantes que dizem onde ("aerografia laterais",
     "aerografia traseira") já casaram nas regras acima, então esta só pega o
     caso mudo. */
  { grupos: ['lateral'], re: /aerografia/ },
];

/** Sem acento, minúsculo, espaço único — o mesmo pré-processo do banco.
 *  A decomposição NFD também conserta a mojibake que existe de verdade nas
 *  descrições: "padrÃo" decompõe o Ã em "A" + U+0303 e sai "padrao". */
export function normaliza(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Grupos de foto que uma descrição pede.
 * @returns {string[]} vazio = sem guia (o app cai na câmera limpa)
 */
export function gruposPara(descricao) {
  const d = normaliza(descricao);
  for (const r of REGRAS) {
    if (!r.re.test(d)) continue;
    if (r.mais && !r.mais.test(d)) continue;
    return r.grupos;
  }
  return [];
}

/** Só para relatório: qual regra casou (índice), ou −1. */
export function regraPara(descricao) {
  const d = normaliza(descricao);
  for (let i = 0; i < REGRAS.length; i++) {
    const r = REGRAS[i];
    if (!r.re.test(d)) continue;
    if (r.mais && !r.mais.test(d)) continue;
    return i;
  }
  return -1;
}
