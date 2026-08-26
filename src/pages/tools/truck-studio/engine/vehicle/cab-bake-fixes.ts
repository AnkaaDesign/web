/* CORREÇÕES DE BAKE DA CABINE — a contraparte de `trailer-bake-fixes.ts`.
   ===========================================================================
   Aquele arquivo conserta O IMPLEMENTO, e é grande porque o baú é paramétrico:
   quase toda correção lá é uma RÉGUA (o friso, o trilho, a fita, o rebite), e
   uma régua vale em qualquer bake. Aqui não há régua nenhuma a aplicar: um
   caminhão é um rip fechado, e o que se conserta nele é sempre **uma peça
   daquele arquivo**.

   Por isso a forma é outra — uma TABELA por arquivo, e cada linha diz o que
   está errado, o que fazer e POR QUE, com a medida ao lado. Três razões para
   ela existir em vez de reabrir os `.glb`:

     · **os `.glb` não são nossos.** São rips de terceiros, e um deles já foi
       re-baked duas vezes nesta base (o sobrechassi). Uma correção assada no
       arquivo morre no próximo re-bake, em silêncio;
     · **o defeito é de UM arquivo.** Uma regra global que apagasse "adesivo
       sobrando" ou "limpador cromado" acertaria estes três e erraria nos 46
       cavalos que já estão aprovados;
     · **e a correção precisa ser LIDA.** Um `visible = false` solto no meio de
       `loadCab()` não diz de que peça se trata nem quem pediu. Aqui a linha
       carrega a foto do dono.

   ⚠️ **RODA ANTES DE QUALQUER MEDIDA E ANTES DA FUSÃO.**
   `applyCabBakeFixes()` é chamada logo depois de `setupCommon()`, e a ordem é
   contrato:

     · antes de `measureCabRearWall()` / `findRigid()` — esconder ou mover peça
       muda o que a montagem mede, e medir primeiro daria um resultado que a
       cena não tem;
     · antes de `applyMerge()` — depois da fusão a malha de origem já está
       escondida e os triângulos dela vivem num balde por material. Esconder
       "a peça" ali não esconde nada, e trocar o material dela troca o material
       de tudo que caiu no mesmo balde. É a mesma regra de §23: **com a fusão de
       pé, não se troca material nem se mede peça.**

   O casamento é sobre `nome-do-nó[nome-do-material]`, que é como as sondas de
   `tools/trailer-bench/` rotulam malha — assim o que se lê num diagnóstico é o
   que se escreve aqui. */
import * as THREE from 'three';

interface CabFix {
  /** Casa `nome-do-nó[nome-do-material]`. */
  alvo: RegExp;
  /** Some da cena (e da fusão, que pula quem já está invisível). */
  esconder?: boolean;
  /** Desloca em Y, em metros. Negativo desce. */
  dy?: number;
  /**
   * ▶▶ ENCOLHE A PEÇA EM TORNO DE UMA LINHA, e não a desloca.
   *
   * `fator` multiplica Y e Z em torno de (`centroY`, `centroZ`) — X FICA, que é
   * o que mantém a largura do arco vestindo o pneu. As cotas são as do arquivo
   * (o espaço local da cabine), em metros.
   *
   * ⚠️ EXISTE PORQUE `dy` NÃO CONSERTA PEÇA GRANDE DEMAIS. Uma translação
   * fecha o vão de um lado e abre o do outro; num arco em volta de uma roda
   * isso é a diferença entre "está alto" e "está aberto", e o Scania levou as
   * duas queixas pela mesma peça. Encolher em torno do centro do eixo fecha os
   * dois de uma vez, porque a peça continua CONCÊNTRICA com a roda.
   *
   * ⚠️ E SÓ VALE PARA NÓ GIRADO EM X. `Object3D.scale` é aplicada no referencial
   * LOCAL (`M = T · R · S`) e o que se quer aqui é uma escala no referencial do
   * PAI. As duas só coincidem quando a rotação comuta com `diag(1, f, f)`, ou
   * seja quando ela gira no plano Y–Z. O aplicador recusa o que não for isso em
   * vez de escrever peça torta.
   */
  escalaYZ?: { fator: number; centroY: number; centroZ: number };
  /** Reescreve o acabamento. `semMapa` descarta o `map` de origem.
   *
   *  ⚠️ `cor` é sRGB (o que `setHex()` lê) e `corLinear` é o espaço de TRABALHO
   *  do three, que é onde o `baseColorFactor` do glTF vive. Quando o número vem
   *  de uma medição de textura — que é feita em luminância LINEAR —, é
   *  `corLinear` que se usa: passar aquele valor por `setHex()` o escureceria
   *  cerca de dez vezes. É a mesma armadilha que `normalizeExteriorGlass()`
   *  documenta logo abaixo. */
  acabamento?: {
    cor?: number; corLinear?: number; roughness?: number; metalness?: number;
    clearcoat?: number; semMapa?: boolean;
  };
  /**
   * Não casar É ESPERADO neste bake — não avisa.
   *
   * Existe para a família derivada. `cut-scania.cjs` gera `scania_p_6x2r`,
   * `_4x2r` e `_6x4r` a partir do bitruck, e nos três o 2º eixo direcional foi
   * REMOVIDO: a correção do para-lama dele não tem alvo, e isso é o certo, não
   * um bake que mudou. Sem esta marca o console gritaria em toda carga dos três,
   * e um aviso que grita sempre deixa de ser lido — que é como um aviso de
   * verdade passa despercebido depois.
   *
   * ⚠️ Use com parcimônia: o valor deste arquivo é justamente FALHAR ALTO
   * quando um alvo some. Só marque o que some POR CONSTRUÇÃO.
   */
  opcional?: boolean;
  /** O que estava errado, com a medida. Sai no console. */
  porque: string;
}

/**
 * ⚠️ A CHAVE É O ARQUIVO, e não o id do catálogo.
 *
 * Mesma junção de `findTractor()`/`findRigid()` e pelo mesmo motivo: o id do
 * catálogo é editorial (`vw-constellation` aponta para um `.glb` chamado
 * `vw_titan`) e pode ser renomeado sem que a geometria mude. O arquivo é o
 * sujeito da correção.
 */
const TABELA: { arquivo: RegExp; itens: CabFix[] }[] = [
  {
    arquivo: /volvo_vm_2015_6x2r\.glb$/i,
    itens: [
      {
        alvo: /\[cabin_mat_0002_5001_Cam_6\]/,
        esconder: true,
        porque: 'ADESIVO "5001" na quina traseira da cabine (x ±1,027 · y 1,247…1,316 · '
          + 'z 1,157…1,334) — 34 vértices de decalque do caminhão de origem. '
          + '*"remova esse adesivo aqui no canto do truck 5001"* — Kennedy, 2026-08-20.',
      },
      {
        alvo: /\[wheel_[fr]_\d+_\d+_[fr]_tire_mat_\d+_goodyear/,
        acabamento: { roughness: 0.60, metalness: 0, clearcoat: 0 },
        porque: 'PNEUS DE RODAGEM BRILHANDO. *"os pneus no volvo estão muito brilhosos"* '
          + '— Kennedy. Rugosidade 0,133 no flanco e 0,198 no rasto, com verniz de 0,18 '
          + 'por cima: lóbulo apertado devolvendo o céu inteiro. São os MESMOS dois '
          + 'materiais que `wheel_vm_v1.glb` carrega, e recebem aqui os MESMOS números '
          + 'que `tuneVmWheelMaterials()` aplica no asset — o VM é o doador da roda e '
          + 'não passa pela troca (`WHEEL_DONOR_RE`), então sem esta linha ele seria o '
          + 'único dos três com a borracha antiga. '
          + '⚠️ O ambiente NÃO é tocado: ver o bloco de `FH16_WHEEL_RE` em `models.ts`.',
      },
      {
        alvo: /\[step_0_mat_0001_tyre_front_109\]/,
        acabamento: { roughness: 0.60, metalness: 0, clearcoat: 0 },
        porque: 'ESTEPE ESPELHADO. *"o estepe do volvo também está diferente"* — Kennedy. '
          + 'A borracha dele vem em rugosidade **0,097**, metade da dos pneus de rodagem: '
          + 'é vidro, não pneu. O ALBEDO já está certo e por isso não se mexe nele — '
          + 'medido, a textura `tyre_front` tem p50 0,0360 em luminância linear contra '
          + '0,0299 da borracha do resto da frota. Era só a rugosidade.',
      },
      {
        alvo: /\[step_0_mat_0002_rim_9inch_110\]/,
        acabamento: { roughness: 0.22, metalness: 0.85 },
        porque: 'ARO DO ESTEPE, com metalicidade ZERO e rugosidade 0,097 — plástico '
          + 'lustrado. Vai para a referência de aço do próprio VM (`steel_clean`, '
          + '0,85 / 0,20), que é a do aro das rodas de rodagem.',
      },
      {
        alvo: /\[wiper_mat_0000_vm_plastico\.001_12\]/,
        acabamento: { cor: 0x14161a, roughness: 0.55, metalness: 0, semMapa: true },
        porque: 'LIMPADOR DE PARA-BRISA saindo CROMADO. O material é cópia do plástico '
          + 'da cabine (`vm_plastico`, rugosidade 0,196, base 0,88 branco) mas a UV do '
          + 'braço cai em região CLARA do atlas — mesmo defeito de atlas que a tira '
          + 'entre as janelas do FH (ver `isBodyTrim`). Sem o mapa e com rugosidade de '
          + 'borracha ele volta a ser preto fosco, que é o que um limpador é.',
      },
    ],
  },
  {
    /* A FAMÍLIA INTEIRA, e não só o bitruck. `tools/chassis-bake/cut-scania.cjs`
       deriva `scania_p_6x2r`, `_4x2r` e `_6x4r` deste arquivo por RECORTE: a
       cabine, o estepe e o para-choque dianteiro saem byte a byte idênticos, e
       portanto os mesmos defeitos de rip saem com eles. Casar só `8x2r`
       deixaria os três derivados com o estepe cromado e com o filete vermelho
       sob a placa — os dois defeitos que o dono já reportou uma vez. */
    arquivo: /scania_p_[468]x[24]r\.glb$/i,
    itens: [
      {
        alvo: /\[chassis_mat_0015_leather_fine_c_14\]/,
        acabamento: { corLinear: 0.1135, roughness: 0.60, metalness: 0, clearcoat: 0 },
        porque: 'ESTEPE METÁLICO. *"o estepe está metálico"* — Kennedy, 2026-08-20. '
          + 'O rip deu à roda guardada o material de COURO DO INTERIOR '
          + '(`leather_fine_c`), com rugosidade **0,098** e verniz de 0,09: um pneu com '
          + 'acabamento de estofado devolve o céu como cromo. Duas coisas erradas e as '
          + 'duas medidas: a rugosidade vai para 0,60 (a mesma da borracha do asset) e '
          + 'o ALBEDO cai à metade — `baseColorFactor` 0,2186 vezes uma textura de p50 '
          + '0,2629 dá **0,0578** em luminância linear, quase o dobro dos 0,0299 da '
          + 'borracha da frota. 0,1135 linear põe o produto em 0,0298. '
          + '⚠️ O `map` FICA: o desenho da banda é dele. E o aro está na MESMA malha e '
          + 'no MESMO material — escurece junto, que é o que um estepe é. '
          + '⚠️ DESDE 2026-08-22 ISTO É REDE DE SEGURANÇA. `swapSpareWheel()` troca o '
          + 'estepe inteiro pela roda do VM e esta malha fica invisível — mas a troca '
          + 'degrada para "o estepe original fica" se `wheel_vm_v1.glb` não carregar, e '
          + 'aí o defeito volta. O alvo continua casando de propósito.',
      },
      {
        alvo: /\[parachoque_0_mat_000[78]_(brasilmercosul|baseplaca)_(59|60)\]/,
        esconder: true,
        porque: 'PLACA DE FÁBRICA DIANTEIRA. Mesmo caso do VW: a Mercosul do estúdio '
          + 'monta em cima e o que sobra é um FILETE VERMELHO por baixo dela '
          + '(a moldura da placa do rip). *"continua uma faixa vermelha abaixo da placa '
          + 'que está estranha"* — Kennedy, 2026-08-20. São duas malhas coplanares — a '
          + 'arte e a base —, e é a coplanaridade delas que também dava a cintilância.',
      },
      {
        /* ⚠️ O GRUPO INTEIRO, e não só o arco. `t_paralama_0` são oito malhas —
           arco pintado, arco preto, faixa, suporte, o trilho do para-barro e o
           para-barro. Descer só o arco abriria 160 mm entre ele e o para-barro,
           que continua pendurado onde estava. */
        alvo: /^t_paralama_0_p\d+\[/,
        /* O centro do 2º eixo direcional NESTE arquivo: o pneu de `wheel_f_2/f_3`
           vai de y −60,7 a 931,6 e de z 78,4 a 1 070,6 — centro (0,4355 · 0,5745),
           raio 496 mm. */
        escalaYZ: { fator: 0.90, centroY: 0.4355, centroZ: 0.5745 },
        /* Nos três derivados o 2º eixo direcional não existe, e o para-lama
           dele saiu junto — não casar ali é o resultado certo. */
        opcional: true,
        porque: 'PARA-LAMA DO 2º EIXO DIRECIONAL GRANDE DEMAIS PARA A RODA. '
          + '*"esse paralama do scania bitruck, ele esta muito aberto"* — Kennedy, '
          + '2026-08-23, e antes dele *"o paralama esta muito alto nesse modelo"* '
          + '(2026-08-20). São a MESMA peça e o mesmo defeito visto de dois lugares. '
          + '⚠️ A 1ª correção descia o grupo 110 mm, e a medida que a justificava estava '
          + 'errada: ela dizia "a face interna do arco fica a 198 mm da coroa do pneu", '
          + 'mas 198 é o raio do arco na PONTA — sobre a coroa a face interna está a '
          + 'y 1 094, ou seja **102 mm** acima dos 992 do pneu. Descer 110 mm com 102 de '
          + 'vão enterra o arco 8 mm DENTRO do pneu, e o resto do arco desce junto: as '
          + 'pernas passam a terminar 57 mm acima da linha do eixo, 181 mm afastadas do '
          + 'flanco, e é isso que se vê como "aberto". Medido no motor, o vão radial '
          + 'saía **−8 mm na coroa e +87 mm na ponta** — um arco que deixou de ser '
          + 'concêntrico com a roda que cobre. '
          + 'A peça não estava no lugar errado: estava GRANDE. Crua ela é concêntrica, '
          + 'com 102…143 mm de vão radial em volta de todo o pneu, e o que ela precisa é '
          + 'de um encolhimento em torno da linha do eixo — 0,90 em Y e Z, X intacto '
          + '(o arco vai a |x| 1 226 e o pneu montado a 1 225: estreitar exporia a roda). '
          + 'Fica com **52…88 mm de vão radial** em toda a volta, com a coroa 71 mm mais '
          + 'baixa que o arco cru (que é o que a queixa de 20/08 pedia) e as pernas '
          + '44 mm mais perto do pneu que a descida deixava. O para-barro sobe de 122 '
          + 'para 264 mm do solo, dentro do que a lei pede. Ver as capturas de '
          + '`diag/checks-diag-paralama-scania-0823.mjs`.',
      },
      {
        alvo: /\[sc_logo_0_mat_0000_brushed_metal_104\]/,
        acabamento: { corLinear: 0.55 },
        porque: 'LETREIRO **SCANIA** DA GRADE, PRETO. *"atualize esse adesivo da scania, '
          + 'para ser da cor dos cavalos basculantes, um cinza claro"* — Kennedy, '
          + '2026-08-22, com foto de um P vermelho em que as letras saem em prata fosco. '
          + 'O defeito NÃO é a metalicidade nem a rugosidade — as duas já estão na régua '
          + 'da frota (0,85 / 0,20, os mesmos de `steel_clean`). É a COR-BASE: '
          + '**0,0014 linear**. Num metal a cor-base É a refletância, então 0,0014 manda '
          + 'a letra devolver 0,1 % do céu — um buraco preto sobre a grade preta, que é '
          + 'exatamente o que a captura mostra. Não é caso isolado: o rip guarda o tom no '
          + 'FATOR e deixou toda a família `brushed_metal` do Scania entre 0,0004 e '
          + '0,1087, enquanto o `steel_clean` do VM guarda o tom numa TEXTURA (p50 0,3025 '
          + 'em luminância linear). E `normalizeBlackPlastic()` não alcança isto de '
          + 'propósito — ela pula metalicidade > 0,5, porque levantar um metal ao piso de '
          + 'plástico (0,030) continuaria preto. 0,55 é a refletância de aço/cromo polido, '
          + 'que com a rugosidade que já está lá lê como o inox claro da foto.',
      },
    ],
  },
  {
    arquivo: /vw_titan_6x2_tl\.glb$/i,
    itens: [
      {
        alvo: /\[wiper_mat_0000_color\]/,
        esconder: true,
        porque: 'SEGUNDO PAR DE LIMPADORES, atravessado no MEIO do para-brisa '
          + '(y 2,167…2,286, e o vidro vai de 1,87 a 2,58). O par de verdade já existe '
          + 'na base do vidro, dentro da malha da cabine — este é sobra do rip. '
          + '*"o limpador de parabrisa do vw esta no centro do parabrisa"* — Kennedy.',
      },
      {
        alvo: /\[placa_mat_0000_asd\]/,
        esconder: true,
        porque: 'PLACA DE FÁBRICA, com moldura VERMELHA e texto assado de outra cidade. '
          + 'A placa Mercosul do estúdio é montada exatamente em cima dela '
          + '(`plates.json` mede o sítio em `placa_p0`), e o que sobra é o filete '
          + 'vermelho em volta. *"o que é essa parte vermelha na placa, corrija"* — '
          + 'Kennedy. Some a dianteira E a traseira: as duas estão nesta malha, e a '
          + 'traseira fica atrás da carroceria de qualquer jeito.',
      },
      {
        /* Dianteiro e traseiro, os dois `_paintable_c` do rip. */
        alvo: /\[wheel_[fr]_\d+_\d+_[fr]_disc_mat_\d+_(front|rear)_disc_01_paintable_c\]/,
        acabamento: { roughness: 0.30, metalness: 0.85 },
        porque: 'REDE DE SEGURANÇA das rodas do VW. Desde 2026-08-20 elas são TROCADAS '
          + 'pela roda do VM (`truck-wheels.ts`) e estas malhas ficam invisíveis — mas a '
          + 'troca degrada para "a rodagem original fica" se `wheel_vm_v1.glb` não '
          + 'carregar, e aí o defeito volta. Medido: o disco vem com metalicidade ZERO e rugosidade '
          + '0,269 — parâmetro de plástico pintado, e é assim que ele lê. O aço do VM '
          + '(`steel_clean`) está em metalicidade 0,85 / rugosidade 0,20 e é a '
          + 'referência da frota; 0,30 de rugosidade mantém o aro fosco de roda de '
          + 'trabalho em vez de virar espelho. *"as rodas do vw nao parecem metal"* — '
          + 'Kennedy.',
      },
      {
        alvo: /\[wheel_[rf]_\d+_\d+_[rf]_(hub|nuts)_mat_\d+_/,
        acabamento: { roughness: 0.38, metalness: 0.80 },
        porque: 'IDEM o cubo e as porcas — mesma rede de segurança, mesmo motivo: os dois '
          + 'estão em metalicidade 0 e ficariam de plástico ao lado de um aro de aço.',
      },
    ],
  },
];

/** Rótulo de uma malha, no mesmo formato que as sondas de `trailer-bench/`. */
const rotulo = (o: THREE.Mesh) => {
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  return `${o.name || ''}[${mats.map((m) => m?.name || '').join('+')}]`;
};

/**
 * Aplica as correções do arquivo dado. Devolve as linhas do relatório — quem
 * chama as põe no console, porque uma correção calada é indistinguível de uma
 * correção que não rodou (a lição de `[tinta]`, em §34).
 *
 * Um alvo que não casa NADA é reportado como tal, e de propósito: é o sinal de
 * que o `.glb` foi re-baked e renomeou a peça, que é o único jeito de esta
 * tabela envelhecer.
 */
export function applyCabBakeFixes(cab: THREE.Object3D, file: string | null | undefined): string[] {
  const arquivo = (file || '').replace(/\\/g, '/');
  const entrada = TABELA.find((t) => t.arquivo.test(arquivo));
  if (!entrada) return [];

  const linhas: string[] = [];
  /* Material trocado UMA vez: num rip o mesmo material serve várias malhas, e
     reescrevê-lo por malha faria o mesmo trabalho N vezes — e, pior, um
     `clone()` por malha romperia a fusão por material. */
  const tratados = new Set<THREE.Material>();

  for (const fix of entrada.itens) {
    let malhas = 0;
    cab.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh) return;
      if (!fix.alvo.test(rotulo(o))) return;
      malhas++;
      if (fix.esconder) {
        o.visible = false;
        return;
      }
      if (typeof fix.dy === 'number') {
        /* ⚠️ NO LOCAL DO NÓ, e isso só é o mesmo que "para baixo" porque a
           única rotação acima dele é o `orientYaw` do caminhão, que é em torno
           de Y. Um dia em que a raiz ganhe inclinação, esta linha passa a
           precisar da inversa da matriz do pai. */
        o.position.y += fix.dy;
        o.updateMatrix();
      }
      if (fix.escalaYZ) {
        /* ▶ ESCALA NO REFERENCIAL DO PAI, escrita como pose do nó.
           -------------------------------------------------------------------
           Quer-se `M' = C · M`, com `C = T(c) · D · T(−c)` e `D = diag(1,f,f)`.
           Abrindo `M = T(t) · R · S`:

               C · T(t) · R · S = T(c + D(t−c)) · D · R · S

           e, se `D` comuta com `R`, isso é `T(c + D(t−c)) · R · (D·S)` — que é
           exatamente `posição · rotação · escala` de um `Object3D`. Por isso a
           correção cabe em duas linhas em vez de exigir `matrixAutoUpdate`
           desligado, e por isso a comutação é CONFERIDA: `D` só comuta com uma
           rotação que gire no plano Y–Z, ou seja, em torno de X. O
           `t_paralama_0` do Scania vem girado 0,99° em X (o rip o entrega
           empinado, como o tanque do VM), e nada mais. */
        const q = o.quaternion;
        if (Math.abs(q.y) > 1e-4 || Math.abs(q.z) > 1e-4) {
          linhas.push(`⚠ ${o.name}: giro fora do plano Y–Z (q ${q.y.toFixed(4)} ·`
            + ` ${q.z.toFixed(4)}) — a escala em torno do eixo não vale aqui.`);
          return;
        }
        const { fator: f, centroY, centroZ } = fix.escalaYZ;
        o.position.y = centroY + f * (o.position.y - centroY);
        o.position.z = centroZ + f * (o.position.z - centroZ);
        o.scale.y *= f;
        o.scale.z *= f;
        o.updateMatrix();
      }
      if (fix.acabamento) {
        for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
          if (!m || tratados.has(m)) continue;
          tratados.add(m);
          const s = m as THREE.MeshStandardMaterial;
          if (fix.acabamento.cor !== undefined) s.color?.setHex(fix.acabamento.cor);
          if (fix.acabamento.corLinear !== undefined) {
            const k = fix.acabamento.corLinear;
            s.color?.setRGB(k, k, k);
          }
          if (fix.acabamento.roughness !== undefined) s.roughness = fix.acabamento.roughness;
          if (fix.acabamento.metalness !== undefined) s.metalness = fix.acabamento.metalness;
          if (fix.acabamento.clearcoat !== undefined) {
            const fis = s as unknown as THREE.MeshPhysicalMaterial;
            if (typeof fis.clearcoat === 'number') fis.clearcoat = fix.acabamento.clearcoat;
          }
          if (fix.acabamento.semMapa) s.map = null;
          s.needsUpdate = true;
        }
      }
    });
    if (malhas) cab.updateWorldMatrix(true, true);
    if (malhas) linhas.push(`${malhas} malha(s) · ${fix.porque}`);
    else if (!fix.opcional) {
      linhas.push(`⚠ NENHUMA MALHA casou ${fix.alvo} — o bake mudou? · ${fix.porque}`);
    }
  }
  return linhas;
}

/* ===========================================================================
   O VIDRO EXTERNO, NA RÉGUA DA FROTA

   *"todos os vidros desses 3 modelos devem ser escurecidos, para baterem com o
   padrão dos outros cavalos"* — Kennedy, 2026-08-20.

   Isto NÃO é uma tabela por arquivo, e não é porque a preguiça: é uma medição
   do acervo. Lidos os 51 `.glb` de `models/trucks/` direto do chunk JSON,
   filtrando material de vidro EXTERNO (`glass_ex`/`glass_color`/`windshield`,
   sem `_int` e sem espelho):

       α 0,800 · rugosidade 0,040   → 56 materiais   ← a frota inteira
       α 0,350 · rugosidade 0,200   → 12 materiais   ← SÓ o Scania P e o Volvo VM
       α 1,000 · rugosidade 0,122   →  2 materiais   ← OPACOS (vidro do volante
                                                        do DAF XF Euro 6)

   Ou seja: 0,35 não é "o vidro deste modelo", é o outlier de dois bakes da mesma
   procedência. Com α 0,35 o vidro deixa passar 65 % do que está atrás e o
   interior aparece nítido — que é exatamente a foto do dono.

   ⚠️ **SÓ MEXE EM QUEM É `transparent`.** Os dois OPACOS acima ficam como estão:
   um material opaco chamado `glass_ex` é um vidro de instrumento com textura
   própria, e forçá-lo a α 0,80 abriria buraco na cabine.

   ⚠️ **E A COR É LINEAR.** `baseColorFactor` do glTF está em espaço LINEAR, e é
   assim que o `GLTFLoader` deixa `material.color`. `setHex()` interpretaria o
   valor como sRGB — 0x1a1a1a viraria 0,0091 linear em vez de 0,10, um vidro
   dez vezes mais escuro do que a frota tem. `setRGB()` escreve no espaço de
   trabalho, que é o linear. */
const VIDRO_EXTERNO_RE = /glass_ex|glass_color|winscreen|windshield/i;
const VIDRO_INTERNO_RE = /_int|mirror/i;
/** A régua da frota, medida (ver acima). */
const VIDRO_FROTA = { opacity: 0.80, rgbLinear: 0.10, roughness: 0.040 };
/** Diferenças abaixo disto são ruído de bake, não divergência de acabamento. */
const VIDRO_TOL = 0.02;

/**
 * Traz o vidro EXTERNO de uma cabine para a régua da frota. Devolve os nomes
 * que mudaram — vazio quer dizer "este bake já estava no padrão", que é o caso
 * de 46 dos 49 cavalos e também do VW Titan.
 */
export function normalizeExteriorGlass(cab: THREE.Object3D): string[] {
  const mudados: string[] = [];
  const vistos = new Set<THREE.Material>();
  cab.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.material) return;
    for (const raw of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!raw || vistos.has(raw)) continue;
      vistos.add(raw);
      const nome = raw.name || '';
      if (!VIDRO_EXTERNO_RE.test(nome) || VIDRO_INTERNO_RE.test(nome)) continue;
      /* Opaco não é vidro de janela — ver o aviso do cabeçalho. */
      if (!raw.transparent) continue;
      const m = raw as THREE.MeshStandardMaterial;
      const fora = Math.abs((m.opacity ?? 1) - VIDRO_FROTA.opacity) > VIDRO_TOL
        || Math.abs((m.roughness ?? 1) - VIDRO_FROTA.roughness) > VIDRO_TOL;
      if (!fora) continue;
      const antes = `α${(m.opacity ?? 1).toFixed(2)}/r${(m.roughness ?? 1).toFixed(3)}`;
      m.opacity = VIDRO_FROTA.opacity;
      m.roughness = VIDRO_FROTA.roughness;
      m.color?.setRGB(VIDRO_FROTA.rgbLinear, VIDRO_FROTA.rgbLinear, VIDRO_FROTA.rgbLinear);
      m.needsUpdate = true;
      mudados.push(`${nome} ${antes} → α0,80/r0,040`);
    }
  });
  return mudados;
}

/* ===========================================================================
   O PLÁSTICO PRETO EXTERNO, NA RÉGUA DA FROTA

   *"tem algumas partes do scania que estão extremamente pretas, mas não
   costuma ser tão preta, costumam ter um leve acinzentado"* — Kennedy,
   2026-08-22.

   Irmã de `normalizeExteriorGlass()` — e pela mesma razão de ser uma REGRA DA
   FROTA e não uma linha da tabela acima: o defeito não é de uma peça, é da
   PROCEDÊNCIA do rip. Censo dos 51 `.glb` de `models/trucks/`, contando
   material OPACO SEM TEXTURA com luminância linear abaixo de 0,03:

       scania_p_{4x2,6x2,6x4,8x2}r     41 materiais cada
       volvo_vm_2015_6x2r              14
       vw_titan_6x2_tl                  4
       os 46 cavalos aprovados        0 a 4, e sempre para-sol, espelho ou
                                      painel de instrumento — peça pequena,
                                      dentro da cabine ou de canto

   ou seja: os três bakes brasileiros trazem a lataria plástica externa com o
   fator de cor-base ZERADO, e os cavalos aprovados não. Medido no Scania P:

       cabin_mat_0001_pretobrilhoso_1     106,8 m²   lum 0,0071
       cabin_mat_0003_plastic_hard_2       10,8 m²   lum 0,0092
       tanques_0_mat_0004_pretobrilhoso    5,45 m²   lum 0,0056
       parachoque_0_mat_0002_plastic_hard  4,41 m²   lum 0,0001   ← preto puro
       mirror_0_mat_0000_plastic_hard      1,54 m²   lum 0,0002
       lateral_0_mat_0000_plastic_hard     1,93 m²   lum 0,0014

   ⚠️ 0,0001 NÃO É UMA MEDIDA DE NADA. Nenhum material real devolve um décimo de
   milésimo da luz que recebe: o carvão fica em 0,02 e o veludo preto, que é o
   piso do mundo físico, em 0,01. Um fator zerado é o exportador escrevendo
   "aqui ia uma textura" — e sem ela o material perde o único lugar em que a
   informação de cor morava.

   A RÉGUA, MEDIDA NO PADRÃO OURO
   ---------------------------------------------------------------------------
   O Volvo FH16 é bake da SCS e é a referência da frota. Nele o preto externo
   não está no FATOR, está no ATLAS — e o atlas foi medido em luminância linear
   (`tools/` não tem sonda de textura; a medida foi feita em Python sobre os
   `.webp` extraídos do próprio `.glb`):

       cabin_mat_0000_plastic_base   48,8 m²   textura p50 0,0331 × fator 0,873
                                               = 0,0289 efetivo
       cabin_mat_0009_chassis_base   47,5 m²   textura p50 0,0319 × fator 1,000
                                               = 0,0319 efetivo

   Os dois maiores materiais externos do caminhão de referência, e os dois em
   **0,029…0,032 linear** — que em sRGB de 8 bits é #32, o "leve acinzentado" do
   relato. É esse o piso.

   ⚠️ POR QUE UM PISO E NÃO UMA TABELA: um piso é IDEMPOTENTE e é seguro para o
   acervo inteiro. Quem já está acima dele não é tocado, e isso inclui os 46
   cavalos aprovados — nenhum deles tem material externo abaixo de 0,03 sem
   textura. O que ele alcança é exatamente a lista medida acima.

   ⚠️ O QUE FICA DE FORA, e cada exclusão tem motivo:
     · **quem tem textura** — ali a cor mora no mapa e o fator é um
       multiplicador; levantá-lo clarearia o desenho inteiro;
     · **quem é transparente** — vidro e lente têm o preto como cor de VIDRO, e
       `normalizeExteriorGlass()` já é dono daquilo;
     · **metal** (`metalness > 0,5`) — num metal o `baseColor` é o F0, a cor do
       REFLEXO. Um cromo escuro em 0,0013 é uma escolha de acabamento, e
       levantá-lo a 0,03 o transformaria em alumínio;
     · **quem emite** — lanterna acesa não tem albedo que importe;
     · **borracha de pneu** — a régua dela é outra (0,0299 medido, ver
       `FH16_WHEEL_RE` em `models.ts`), e os pneus destes três já são trocados
       por `swapTruckWheels()`. Alcançá-los aqui seria mexer duas vezes.

   ⚠️ E NÃO SE MEXE NA RUGOSIDADE. O relato é de COR ("levemente acinzentado"),
   e rugosidade é a outra metade do acabamento: um plástico preto de caminhão é
   brilhante mesmo, e apagar isso trocaria um defeito por outro. */
/** O piso de albedo do preto externo, em luminância LINEAR. Ver acima. */
const PRETO_FROTA = 0.030;
/** Abaixo disto o material não é "escuro", é ZERADO — e é o que se conserta. */
const PRETO_LIMITE = 0.025;
/**
 * Quem não entra, POR NOME — e cada família tem um motivo medido:
 *
 *   · vidro / lente / borracha — cor de material transmissivo ou régua própria;
 *   · TELA DESLIGADA (`screen_off`, `display`, `lcd`) — um painel apagado é
 *     preto DE PROPÓSITO. Medido no Scania P: `interior_mat_0052_dashboard_
 *     screen_off` e `multi_0_mat_0006_gps_screen_off`, os dois em 0,0109. Um
 *     piso de 0,030 os acenderia num cinza que nenhum painel desligado tem;
 *   · RODA (aro, cubo, porca, disco, estepe) — a régua da roda é outra e mora
 *     em `truck-wheels.ts`/`FH16_WHEEL_RE`, e nestes três a rodagem inteira é
 *     TROCADA por `swapTruckWheels()`. Alcançá-la aqui seria mexer duas vezes
 *     na mesma peça, por dois donos diferentes.
 */
const PRETO_FORA_RE = /glass|vidro|lente|lens|tire|tyre|pneu|borracha|rubber|decal/i;
const PRETO_TELA_RE = /screen|display|lcd|monitor|tela/i;
const PRETO_RODA_RE = /^wheel_|_disc|_rim|_hub|_nuts|^step_/i;

/**
 * Levanta o plástico preto EXTERNO ao piso da frota. Devolve o que mudou —
 * vazio quer dizer "este bake já está no padrão", que é o caso dos 46 cavalos.
 *
 * A conversão é feita preservando a MATIZ: o fator é escalado, não substituído,
 * para que um preto levemente azulado continue levemente azulado. Fator
 * exatamente zero não tem matiz para preservar e vira cinza neutro.
 */
export function normalizeBlackPlastic(cab: THREE.Object3D): string[] {
  const mudados: string[] = [];
  const vistos = new Set<THREE.Material>();
  cab.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.material) return;
    for (const raw of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!raw || vistos.has(raw)) continue;
      vistos.add(raw);
      const m = raw as THREE.MeshStandardMaterial;
      if (!m.color) continue;
      if (raw.transparent) continue;
      if (m.map) continue;
      if ((m.metalness ?? 0) > 0.5) continue;
      if (m.emissive && m.emissive.getHex() !== 0) continue;
      const nome = m.name || '';
      if (PRETO_FORA_RE.test(nome) || PRETO_TELA_RE.test(nome) || PRETO_RODA_RE.test(nome)) continue;
      const lum = 0.2126 * m.color.r + 0.7152 * m.color.g + 0.0722 * m.color.b;
      if (lum >= PRETO_LIMITE) continue;
      const antes = lum;
      if (lum > 1e-4) {
        const k = PRETO_FROTA / lum;
        m.color.setRGB(
          Math.min(1, m.color.r * k), Math.min(1, m.color.g * k), Math.min(1, m.color.b * k));
      } else {
        m.color.setRGB(PRETO_FROTA, PRETO_FROTA, PRETO_FROTA);
      }
      m.needsUpdate = true;
      mudados.push(`${nome} ${antes.toFixed(4)} → ${PRETO_FROTA.toFixed(3)}`);
    }
  });
  return mudados;
}
