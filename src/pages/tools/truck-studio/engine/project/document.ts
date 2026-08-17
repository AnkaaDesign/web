/* O DOCUMENTO do estúdio: o que é um "projeto", como lê-lo do motor vivo e como
   escrevê-lo de volta.
   ---------------------------------------------------------------------------
   Este arquivo não faz E/S. Ele não conhece ZIP, não conhece IndexedDB e não
   conhece botão nenhum — ele converte entre o MOTOR (cinco módulos que cada um
   guarda um pedaço do estado) e um OBJETO simples de JSON. Quem grava esse
   objeto em algum lugar são os dois vizinhos:

     ./file.ts     o arquivo `.ankaastudio` — o que se manda para outra pessoa
     ./store.ts    a biblioteca do navegador — o que se reabre depois

   UM DOCUMENTO, DUAS SERIALIZAÇÕES. É a decisão que sustenta a feature inteira:
   Salvar/Abrir e Exportar/Importar movem exatamente o MESMO objeto, então não há
   como um caminho carregar um campo que o outro perde. O dia em que um estado
   novo entrar no estúdio, ele entra aqui uma vez e os quatro botões o ganham.

   ---------------------------------------------------------------------------
   ONDE O ESTADO MORA HOJE, e por que ele precisava de um dono só

   | pedaço                                    | módulo                  | persistido? |
   |-------------------------------------------|-------------------------|-------------|
   | cenário, montadora, modelo, chassi, cor,  | catalog/catalog.ts      | localStorage|
   |   película, acabamentos                   |                         |             |
   | preset/clima, hora, sol, brilho, fundo,   | scene/scene.ts          | localStorage|
   |   fill, rim, difusão, temperatura         |                         |             |
   | as cinco telas de plotagem + imagens      | vehicle/livery-doc.ts   | localStorage|
   | altura, comprimento e portas do baú       | vehicle/livery-structure| **não**     |
   | receita viva da tinta                     | vehicle/paint.ts        | **não**     |
   | pintar o implemento, vista, câmera        | vehicle/livery + models | **não**     |

   As três últimas linhas são a razão de este arquivo existir: metade do que
   define como o caminhão está NA TELA nunca sobreviveu a um F5, quanto mais a
   uma troca de máquina.

   ---------------------------------------------------------------------------
   O QUE FICA DE FORA, DE PROPÓSITO

   `core/quality.ts` (nível, escala de render, perfil frio) e as preferências de
   captura de `ui/chrome.ts` (fundo, qualidade da imagem, resolução do vídeo).
   São estado do APARELHO e do HÁBITO de quem está na frente da tela, não do
   produto que está sendo desenhado. Um projeto que carregasse "qualidade alta"
   obrigaria um notebook fraco a engasgar para abrir o arquivo de um desktop — e
   a imagem final seria a mesma, porque a captura renderiza no seu próprio alvo.

   ---------------------------------------------------------------------------
   O QUE "EXATAMENTE IGUAL EM OUTRO PC" PODE E NÃO PODE PROMETER

   Quatro coisas podem divergir entre a máquina que exporta e a que importa, e
   cada uma tem uma resposta diferente:

   1. **A geometria** (`.glb` do cavalo e do implemento). Não viaja no arquivo:
      são dezenas de megabytes por caminhão e são conteúdo licenciado que não
      pode sair extraível de um arquivo de usuário. Viaja o ID, e a importação
      CONFERE — `verifyProject()` devolve o que não bateu em vez de montar outro
      caminhão calado.

   2. **A cor.** Esta é a armadilha real, e é a razão de `paint` estar no
      documento. O `colorId` resolve contra `GET /studio/colors`, que é EDITÁVEL:
      o painel "Ajustar a tinta" grava a receita na mesma tabela. Duas semanas
      depois, o mesmo id pode ser outra tinta. Então o documento carrega o
      `PaintParams` RESOLVIDO — algumas dezenas de números que são o que "cor"
      significa visualmente — e ele ganha da receita do servidor. O arquivo é a
      autoridade sobre como aquele caminhão era.

   3. **As imagens do usuário.** Viajam inteiras, byte a byte (ver ./file.ts).
      Esta parte é exata de verdade.

   4. **As fontes.** São as dez de `livery-doc.FONTS`, servidas pelo mesmo app.
      O que importa não é tê-las e sim ESPERÁ-LAS: `importLivery()` carrega cada
      família antes de re-hidratar, senão o fabric mede a substituta e congela a
      métrica errada. Está documentado lá.

   O que sobra é aritmética de ponto flutuante em JSON, que é exata para todo
   double — desde que ninguém formate número para texto no caminho. Nada aqui
   chama `toFixed`. */
import {
  sceneStateSnapshot, restoreSceneState, camera, controls, frameAll,
} from '../scene/scene';
import { applyEnvironmentLighting, getCurrentEnvironment } from '../scene/environment';
import * as timeline from '../scene/timeline';
import * as models from '../vehicle/models';
import * as paint from '../vehicle/paint';
import { exportLivery, importLivery, clearLivery } from '../vehicle/livery-doc';
import { setImplementPainted } from '../vehicle/livery';
import * as trim from '../vehicle/trim';
import * as liveryStructure from '../vehicle/livery-structure';
import { loadChoice, saveChoice, getEnvironment, getModel } from '../catalog/catalog';
import { getColor } from '../catalog/colors';
import type { Choice } from '../catalog/catalog';
import { PROJECT_KIND, PROJECT_VERSION } from './schema';
import type {
  StudioProject, ProjectLabels, ProjectMeasures, ProjectCamera,
} from './schema';
import type { DoorSpec, StructureKey } from '../vehicle/livery-structure';

/* ---------------- a forma do documento ----------------
   Ela mora em ./schema.ts, que é folha: este arquivo importa `scene/scene.ts`,
   que constrói um WebGLRenderer no escopo de módulo, e com o esquema aqui
   `file.ts` arrastaria o engine inteiro só para conhecer um marcador de string —
   e deixaria de poder ser testado fora de um navegador. Ver o cabeçalho de lá.

   Re-exportado para quem consome o documento continuar tendo UM endereço. */
export {
  PROJECT_KIND, PROJECT_VERSION, parseProject,
} from './schema';
export type {
  StudioProject, ProjectLabels, ProjectMeasures, ProjectCamera,
} from './schema';

/* ---------------- a injeção de applyChoice ----------------
   `studio.ts` é quem sabe carregar um caminhão: applyChoice() resolve a escolha
   contra o catálogo, enfileira, baixa cabine/implemento/cenário sob a cortina e
   deduplica. Nada disso pode ser reimplementado aqui.

   E este arquivo NÃO PODE IMPORTAR studio.ts: studio.ts importa vehicle/* e
   ui/*, e a interface do projeto vive em ui/ — a seta de volta fecharia o ciclo.
   Então é injeção, exatamente como `liveryStructure.setDimsApplier()` já faz
   para o redimensionamento do baú, e pelo mesmo motivo. studio.ts registra na
   avaliação do módulo, portanto antes de qualquer boot. */
export type ChoiceApplier = (
  choice: Choice, opts?: { keepCurtain?: boolean },
) => Promise<unknown>;

export interface StudioHooks {
  /** Carrega uma escolha inteira — cenário, cavalo, chassi, cor. */
  applyChoice: ChoiceApplier;
  /**
   * Reaplica a receita de tinta da cor CORRENTE, sem recarregar nada.
   *
   * Existe porque `applyChoice()` com a escolha idêntica NÃO serve para isto: o
   * dedupe dele (`sameChoice`, que compara rig + cor) devolve a fila na hora e
   * não roda nada. Era o furo do "Novo" — ele mandava a mesma escolha
   * esperando o atalho de cor rodar `applyColor()`, e o dedupe pegava antes.
   * A ordem é essa mesma no código: `sameChoice` é testado ANTES de `sameRig`.
   */
  reapplyColor: () => void;
  /** Levanta a cortina de carregamento (idempotente). */
  showCurtain: (label?: string) => void;
  /** Move a barra dela. `p` em 0..1. */
  setCurtainProgress: (p: number, label?: string) => void;
  /** Desce a cortina com a animação de saída. Seguro chamar sem cortina de pé. */
  finishCurtain: () => Promise<void>;
  /** Deixa o navegador compor UM quadro. Usado para esperar a textura da
   *  plotagem chegar ao 3D antes de a cortina descer. */
  nextFrame: () => Promise<void>;
  /**
   * Reabre o seletor no fluxo COMPLETO — cenário → montadora → modelo → chassi
   * → cor —, o mesmo que o estúdio mostra numa aba nova.
   *
   * É o que faz o "Novo" ser um projeto novo de verdade. Quem aplica a escolha
   * NÃO é quem chama isto: `ui/selector.ts` dispara `onChange` para toda seleção
   * concluída e `studio.ts` já tem `applyChoice` pendurado ali desde o boot.
   * Chamar `applyChoice` aqui também carregaria o mesmo caminhão duas vezes —
   * o dedupe pegaria, mas seria uma segunda fonte de verdade sobre quem carrega
   * o quê.
   */
  openPicker: () => Promise<unknown>;
}

let hooks: StudioHooks | null = null;
export function setStudioHooks(h: StudioHooks) { hooks = h; }

/* ---------------- LER o motor ---------------- */

const vec3 = (v: { x: number; y: number; z: number }): [number, number, number] => [v.x, v.y, v.z];

function readMeasures(): ProjectMeasures | null {
  const m = liveryStructure.getImplementMeasures();
  /* `resizable: false` é um bake que não redimensiona — gravar medidas dele
     seria gravar números que a importação não tem como aplicar, e uma medida
     que não pode ser aplicada é pior do que nenhuma: ela some sem aviso. */
  if (!m.resizable) return null;
  const doors: Partial<Record<StructureKey, DoorSpec[]>> = {};
  for (const k of liveryStructure.STRUCTURE_KEYS) {
    const list = m.doors[k];
    /* Face sem porta não vira `[]` no arquivo: um campo ausente e um campo
       vazio são a mesma coisa aqui, e o ausente não ocupa espaço. */
    if (list?.length) doors[k] = list.map((d) => ({ ...d }));
  }
  return { height: m.height, length: m.length, doors };
}

/* `getChassis()` devolve o TRIO resolvido (`{manufacturer, model, chassis}`), e
   não o chassi solto — daí o `.chassis.name`. E ele CAI no chassi padrão quando
   o id não casa, o que é certo para carregar e errado para conferir: um id
   morto voltaria com o nome do padrão e a conferência diria que está tudo bem.
   Por isso a busca aqui é EXATA. */
const findChassis = (modelId: string | null, chassisId: string | null) =>
  (chassisId ? getModel(modelId)?.model.chassis.find((c) => c.id === chassisId) : undefined);

function readLabels(choice: Choice): ProjectLabels {
  const found = getModel(choice.modelId);
  return {
    environment: getEnvironment(choice.envId)?.name,
    manufacturer: found?.manufacturer.name,
    model: found?.model.name,
    chassis: findChassis(choice.modelId, choice.chassisId)?.name,
    color: getColor(choice.colorId)?.name,
  };
}

/**
 * O estado do estúdio AGORA, como documento.
 *
 * A escolha vem de `loadChoice()` e não de uma cópia local porque ela é a que
 * `studio.ts` acabou de gravar — inclusive o `trim`, que o card de acabamentos
 * escreve por fora de `applyChoice()` e que só existe na versão persistida.
 */
export function captureProject(name?: string): StudioProject {
  /* `loadChoice()` devolve uma `ResolvedChoice` — a mesma forma de `Choice`, com
     os campos garantidos não-nulos. Ela é atribuível a `Choice` direto; não há
     um `.choice` dentro. (O `resolved.choice` que se vê em studio.ts é de
     `resolveChoice()`, que é outra função e devolve o TRIO resolvido.) */
  const resolved = loadChoice();
  const choice: Choice = resolved
    ? { ...resolved }
    : {
      envId: null, manufacturerId: null, modelId: null,
      chassisId: null, colorId: null, finishId: null,
    };
  return {
    kind: PROJECT_KIND,
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    name: name?.trim() || undefined,
    choice,
    labels: readLabels(choice),
    scene: sceneStateSnapshot(),
    paint: paint.getPaintParams(),
    vehicle: {
      implementPainted: models.state.paintTarget === 'both',
      view: models.getVehicleView(),
    },
    measures: readMeasures(),
    livery: exportLivery(),
    camera: { pos: vec3(camera.position), target: vec3(controls.target) },
    /* Ausente quando não há percurso montado, em vez de `[]`: um campo que não
       existe e um campo vazio dizem a mesma coisa, e o que não existe não ocupa
       espaço num arquivo que vai por e-mail. */
    ...(timeline.timelineCount() ? { timeline: timeline.exportTimeline() } : {}),
  };
}

/* ---------------- CONFERIR um documento ---------------- */

export type ProblemLevel = 'erro' | 'aviso';

export interface ProjectProblem {
  level: ProblemLevel;
  text: string;
}

/* `parseProject()` mora em ./schema.ts, junto com a forma que ele reconhece —
   os dois têm de mudar na mesma edição, e separá-los é como um campo novo entra
   no tipo sem entrar na guarda. Este arquivo o re-exporta lá em cima. */

/**
 * O que este documento vai perder ao ser aplicado NESTA máquina.
 *
 * É a metade honesta da promessa de "igual em outro PC": tudo que o arquivo
 * nomeia e o catálogo local não tem, dito ANTES de a cena mudar. Um id que
 * sumiu vira `erro` (aquela peça não vai aparecer); um id que existe mas com
 * outro nome vira `aviso` (o catálogo mexeu no meio, e o que aparecer pode não
 * ser o que foi salvo).
 */
export function verifyProject(doc: StudioProject): ProjectProblem[] {
  const out: ProjectProblem[] = [];
  const c = doc.choice ?? ({} as Choice);
  const L = doc.labels ?? {};

  const check = (
    id: string | null | undefined, found: string | undefined,
    saved: string | undefined, what: string,
  ) => {
    if (!id) return;
    if (!found) { out.push({ level: 'erro', text: `${what} "${saved || id}" não existe neste catálogo.` }); return; }
    if (saved && saved !== found) {
      out.push({ level: 'aviso', text: `${what} mudou de nome: o arquivo diz "${saved}", o catálogo diz "${found}".` });
    }
  };

  check(c.envId, getEnvironment(c.envId)?.name, L.environment, 'O cenário');
  check(c.modelId, getModel(c.modelId)?.model.name, L.model, 'O modelo');
  check(c.chassisId, findChassis(c.modelId, c.chassisId)?.name, L.chassis, 'O chassi');
  check(c.colorId, getColor(c.colorId)?.name, L.color, 'A cor');

  /* A DIVERGÊNCIA DE RECEITA NÃO É PROBLEMA, e por isso não entra na lista:
     `applyProject()` escreve o `PaintParams` do arquivo POR CIMA do que a cor do
     catálogo trouxe (ver o item 2 do cabeçalho). O arquivo ganha, de propósito,
     e avisar sobre algo que foi resolvido só ensinaria a ignorar os avisos. */

  if (doc.measures && !liveryStructure.getImplementMeasures().resizable) {
    out.push({
      level: 'aviso',
      text: 'Este implemento não redimensiona nesta versão — as medidas do arquivo não serão aplicadas.',
    });
  }
  return out;
}

/* ---------------- ESCREVER no motor ---------------- */

/** Uma medida só é escrita se for um número de verdade. */
const fin = (v: unknown): number | undefined =>
  (Number.isFinite(+(v as number)) ? +(v as number) : undefined);

function applyMeasures(m: ProjectMeasures | null | undefined) {
  if (!m || !liveryStructure.getImplementMeasures().resizable) return;

  /* UM RECORTE, E NÃO QUATRO.
     ---------------------------------------------------------------------
     `setDoorsFor()` e `setImplementMeasures()` são as portas do FORMULÁRIO, e
     elas passam pelos aplicadores COALESCIDOS de studio.ts — 260 ms de silêncio
     para as medidas, 60 ms para as portas. Isso é exatamente certo para quem
     arrasta um controle e exatamente errado aqui: um projeto escreve altura,
     comprimento e as portas de várias faces no mesmo tick, e cada uma dessas
     escritas termina numa sequência DESTRUTIVA de oito passos (medida em quase
     três segundos de thread presa) que joga fora e recorta de novo as chapas de
     plotagem — inclusive as que o recorte anterior acabou de fazer.

     A divisão que resolve, e ela é a mesma que o próprio módulo de medidas usa:

       · o CADASTRO e o DESENHO 2D por `setDoorsQuiet()`, para as cinco faces.
         Ele não toca na malha;
       · o VÃO na malha por `rig.stageDoors()`, que só ENFILEIRA. E só para
         `left`/`right`: a traseira já traz quatro folhas modeladas no bake (um
         vão ali abriria um buraco atrás delas), a testeira carrega o pino-rei e
         o teto não tem porta. É a mesma inclusão que `pushDoorsToGeometry()`
         faz, pelas mesmas razões — ver o comentário lá;
       · e UM `setTrailerDims()` com a medida final, que corre a sequência de
         oito passos uma vez, com tudo dentro. */
  for (const k of liveryStructure.STRUCTURE_KEYS) {
    liveryStructure.setDoorsQuiet(k, (m.doors?.[k] ?? []).map((d) => ({
      position: fin(d.position) ?? 0,
      width: fin(d.width) ?? 0,
      height: fin(d.height) ?? 0,
    })));
  }

  const rig = models.state.trailerRig;
  if (rig) {
    /* `Face` da geometria é `'left' | 'right' | 'rear'` e o cadastro 2D tem
       cinco chaves — os dois vocabulários não são o mesmo, e escrever as duas
       faces à mão é o que deixa o compilador reprovar um `'front'` aqui. */
    for (const k of ['left', 'right'] as const) {
      try { rig.stageDoors(k, liveryStructure.getDoors(k)); }
      catch { /* uma geometria que não recorta vão é um campo a descartar, nunca
                  um motivo para o projeto inteiro não abrir */ }
    }
  }

  const patch: { height?: number; length?: number } = {};
  const h = fin(m.height), l = fin(m.length);
  if (h !== undefined) patch.height = h;
  if (l !== undefined) patch.length = l;
  models.setTrailerDims(patch);

  /* E as medidas voltam da GEOMETRIA para os campos. A altura fecha um número
     inteiro de frisos, então o que o baú aceitou raramente é o que o arquivo
     pediu — reancorar aqui é o que faz o inspetor mostrar o baú que existe.
     `refreshFromTrailer()` sem argumento reusa as chapas já medidas. */
  liveryStructure.refreshFromTrailer();
}

function applyCamera(cam: ProjectCamera | undefined) {
  const ok = (a: unknown): a is [number, number, number] =>
    Array.isArray(a) && a.length === 3 && a.every((n) => Number.isFinite(+n));
  if (!cam || !ok(cam.pos) || !ok(cam.target)) return false;
  camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
  controls.target.set(cam.target[0], cam.target[1], cam.target[2]);
  controls.update();
  return true;
}

export interface ApplyOptions {
  /** Reaplica a escolha (cenário/caminhão/cor). */
  choice?: boolean;
  /**
   * Cobre a montagem inteira com a cortina de carregamento. Padrão LIGADO.
   *
   * Desligar só faz sentido para quem já tem a própria cobertura na tela; não
   * há chamador assim hoje, e a opção existe para não obrigar o próximo a
   * escolher entre duas cortinas empilhadas e nenhuma.
   */
  curtain?: boolean;
}

/**
 * Escreve um documento inteiro sobre o motor.
 *
 * A ORDEM É O ALGORITMO, e cada passo depende do anterior:
 *
 *  1. **a escolha**, e ela é a única que pode BAIXAR alguma coisa. `applyChoice`
 *     enfileira, sobe a cortina e resolve quando cabine, implemento e cenário
 *     estiverem na cena. Tudo abaixo escreve sobre malhas que só existem depois
 *     disto — aplicar a plotagem antes seria pendurá-la em chapas que o
 *     carregamento ainda vai substituir;
 *  2. **os acabamentos**, que `applyChoice` já leva dentro de `Choice.trim`, mas
 *     que são reafirmados porque `setPaintTarget()` do passo 4 reescreve a cor
 *     do baú em toda malha de painel — teto e Thermo King inclusive. É a mesma
 *     razão pela qual `applyTrim()` roda depois de `setPaintTarget()` no boot;
 *  3. **as medidas**, porque elas RECORTAM as chapas de plotagem: fazer isso
 *     depois da arte jogaria a arte fora (ver o cabeçalho de
 *     `models.setTrailerDims()`, passo 3);
 *  4. **a tinta e o alvo dela**, agora que há malha pintável;
 *  5. **a plotagem**, sobre as chapas definitivas;
 *  6. **a luz**, que é ortogonal a tudo acima e por isso pode ser a última;
 *  7. **a câmera**, por último de todas — `setTrailerDims` e `setVehicleView`
 *     reenquadram, e um enquadramento posterior apagaria a pose gravada.
 */
export async function applyProject(doc: StudioProject, opts: ApplyOptions = {}) {
  /* ---- A CORTINA COBRE O PROJETO INTEIRO ----
     Relato: *"prefiro ter um loading — seleciono o arquivo e a plotagem é
     montada enquanto o caminhão já está à vista; deveria mostrar um loading até
     tudo estar correto: iluminação, cores, logos"*.

     E ele estava certo sobre a causa. `applyChoice()` levanta a própria cortina
     e a DERRUBA quando o veículo está em cena — mas um projeto só está pronto
     várias etapas depois: as medidas recortam as chapas, a plotagem é colada
     nelas, a tinta é reaplicada e a luz é reescrita. Cada uma dessas etapas
     muda a imagem, e todas aconteciam com a cena já à vista.

     Duas peças resolvem: `keepCurtain` faz o `applyChoice` ADIAR a descida (ver
     runApply em studio.ts), e `showCurtain()` cobre o caso em que ele não
     levanta cortina nenhuma — escolha idêntica cai no dedupe e volta na hora,
     e as etapas de baixo continuam precisando de cobertura.

     `finally` e não um caminho feliz: uma etapa que lance NÃO pode deixar a
     cortina de pé para sempre. Uma cena meio montada com a linha de estado
     visível é recuperável; uma cortina presa não é. */
  const curtain = opts.curtain !== false && !!hooks;
  if (curtain) hooks!.showCurtain('Abrindo o projeto…');

  try {
    if (opts.choice !== false && doc.choice && hooks) {
      /* `trim` viaja DENTRO da escolha, e é assim que ele chega inteiro do outro
         lado: `saveChoice()` é quem o grava, e `applyChoice()` é quem o aplica. */
      await hooks.applyChoice({ ...doc.choice }, { keepCurtain: curtain });
    }

    /* As frações abaixo são a PARCELA DE TEMPO de cada etapa, não uma barra
       decorativa: o recorte das chapas é o item caro (medido em ~3 s por
       redimensionamento) e a plotagem vem logo atrás quando há imagem grande.
       O carregamento do veículo, que é o maior de todos, já correu acima com a
       barra do próprio `applyChoice` — daí esta começar em 0,7. */
    const phase = (p: number, label: string) => {
      if (curtain) hooks!.setCurtainProgress(p, label);
    };

    phase(0.70, 'Aplicando acabamentos…');
    if (doc.choice?.trim !== undefined) trim.setTrimChoice(doc.choice.trim);

    phase(0.74, 'Ajustando as medidas do baú…');
    applyMeasures(doc.measures);

    phase(0.86, 'Aplicando a tinta…');
    if (doc.paint && typeof doc.paint === 'object') paint.setPaint(doc.paint);
    setImplementPainted(!!doc.vehicle?.implementPainted, { echo: true });
    if (doc.vehicle?.view) models.setVehicleView(doc.vehicle.view);

    phase(0.90, 'Montando a plotagem…');
    await importLivery(doc.livery);
    /* E ESPERA A TEXTURA CHEGAR AO 3D. `importLivery()` já desenha as cinco
       telas de forma síncrona (ver o `renderAll()` lá) — o que falta é o
       navegador COMPOR um quadro com a `CanvasTexture` nova. Sem estes dois
       quadros a cortina desce sobre o baú ainda branco e a arte "aparece"
       depois, que é o relato. Dois e não um: o upload pode aterrissar no
       seguinte — a mesma razão pela qual o gancho de vehicle/livery.ts pede
       `invalidate(3)`. */
    if (curtain) { await hooks!.nextFrame(); await hooks!.nextFrame(); }

    phase(0.97, 'Acendendo a luz…');
    /* `persist: true` porque isto É uma mudança de estado, e `animate: false`
       porque não há de onde animar: a cena que estava na tela não é a mesma. */
    restoreSceneState(doc.scene, { animate: false, persist: true });

  /* A câmera por último. Sem pose gravada, o enquadramento padrão — que é o que
     `setVehicleView()` acabou de fazer de qualquer forma. */
    if (!applyCamera(doc.camera)) frameAll([models.state.cabGroup, models.state.trailerGroup]);

    applyTimeline(doc);
  } finally {
    /* A cortina desce AQUI, com tudo no lugar — que é a coisa que o relato
       pediu. E desce mesmo se algo acima lançou: ver a nota do `try`. */
    if (curtain) await hooks!.finishCurtain();
  }
}

/**
 * O percurso do criador de vídeo — e a conferência que o torna seguro.
 *
 * `scene/timeline.ts` recusa deliberadamente persistir isto, e o argumento dele
 * está certo: as poses são ABSOLUTAS EM MUNDO, então um percurso restaurado numa
 * cena diferente aponta a câmera para um pátio vazio — um estado inválido com
 * cara de válido. Num projeto o cenário e o veículo viajam no mesmo arquivo, o
 * que remove a objeção — MAS SÓ SE ELES DE FATO ENTRARAM.
 *
 * E eles podem não ter entrado: `verifyProject()` deixa o usuário abrir um
 * projeto cujo modelo sumiu do catálogo (a alternativa seria não abrir nada), e
 * nesse caso a cena montada NÃO é a que o percurso descreve. Por isso a
 * comparação abaixo é contra o que o motor tem AGORA, e não contra o que o
 * arquivo pediu: é a diferença entre confiar no documento e conferir o
 * resultado.
 *
 * Fora de um percurso gravado, `importTimeline(undefined)` limpa — abrir um
 * projeto sem percurso não pode deixar na tela o percurso do projeto anterior.
 */
function applyTimeline(doc: StudioProject) {
  if (!doc.timeline?.length) { timeline.importTimeline(null); return; }

  const now = loadChoice();
  const want = doc.choice;
  const sameWorld = !!now
    && now.envId === want?.envId
    && now.modelId === want?.modelId
    && now.chassisId === want?.chassisId;

  if (!sameWorld) {
    timeline.importTimeline(null);
    console.warn('[truck-studio] o percurso de câmera do projeto foi descartado:'
      + ' o cenário/veículo montado não é o que ele descreve.');
    return;
  }
  timeline.importTimeline(doc.timeline);
}

/* ---------------- NOVO ---------------- */

/**
 * Roda um passo do reset ISOLADO dos outros.
 *
 * ⚠️ ESTA É A CORREÇÃO MAIS IMPORTANTE DESTE BLOCO, e ela veio de um defeito
 * relatado: *"começar do zero não resetou algumas configurações, iluminação por
 * exemplo"*. O "Novo" era uma sequência reta de seis passos, e uma exceção em
 * qualquer um deles abortava TODOS os seguintes em silêncio — o `catch` ficava
 * lá no chamador. O sintoma é exatamente o que foi relatado: os primeiros
 * passos (arte, acabamentos) zeram, os últimos (luz, tinta) não, e nada na tela
 * diz que faltou alguma coisa.
 *
 * Um passo do reset não depende do anterior ter dado certo — são seis donos de
 * estado independentes. Então cada um roda por si, e um que falhe vira um aviso
 * no console em vez de levar os outros cinco junto.
 */
function step(name: string, fn: () => void) {
  try { fn(); } catch (e) {
    console.error(`[truck-studio] "Novo": o passo "${name}" falhou —`, e);
  }
}

/**
 * Zera o projeto e REABRE O SELETOR, desde o mapa.
 *
 * ⚠️ ESTE COMPORTAMENTO MUDOU, e o registro importa porque a versão anterior era
 * defensável e foi ABANDONADA depois de vista rodando. Ela mantinha cenário,
 * cavalo e cor — *"deve manter o mapa e cavalo selecionado"* — e zerava só o que
 * tinha sido desenhado. O veredito depois de usar: *"novo projeto deve realmente
 * abrir novo projeto, iniciando novamente do map picker, truck picker etc."*
 *
 * E o pedido novo é o mais coerente dos dois: "Novo" é o irmão de "Abrir", e
 * Abrir troca o caminhão. Um "Novo" que mantivesse o veículo seria "Limpar", que
 * é outra coisa — e o estúdio já tem o "Limpar" por face na barra do editor.
 *
 * A ORDEM — zerar ANTES de abrir o seletor, e não depois — é o que evita uma
 * corrida: `applyChoice()` sai carregando assim que o seletor resolve, e um
 * `setTrailerDims()` de reset caindo no meio de um implemento sendo montado
 * recortaria chapas de uma geometria que está sendo substituída. Zerando antes,
 * o seletor abre sobre uma cena já limpa e o carregamento é o único trabalho em
 * voo.
 *
 * Consequência aceita: CANCELAR o seletor deixa o projeto zerado com o caminhão
 * anterior de pé. É o certo — quem chegou aqui já confirmou um diálogo que diz o
 * que vai ser apagado, e cancelar a ESCOLHA não é desfazer o "Novo"; é dizer
 * "sigo com este mesmo caminhão no projeto novo".
 */
export async function newProject(opts: { onWiped?: () => void } = {}) {
  const resolved = loadChoice();

  /* 1. A PLOTAGEM — os objetos E o fundo de cada face. As duas coisas, porque
        são as duas fontes de pixel de uma tela (ver `faceHasArt()` em
        vehicle/livery.ts): apagar só os objetos deixaria as laterais, a frente e
        a traseira com a cor de fundo escolhida antes.
        O PERCURSO DE CÂMERA SAI JUNTO: é trabalho autoral tanto quanto a arte, e
        um "Novo" que zerasse o desenho e deixasse sete pontos de câmera montados
        seria um zero pela metade. */
  step('plotagem', clearLivery);
  step('percurso de câmera', timeline.clearTimeline);

  /* 2. OS ACABAMENTOS, e a escolha gravada perde o campo junto. Sem tirá-lo da
        escolha, o próximo `saveChoice()` o traria de volta do localStorage. */
  const bare: Choice | null = resolved ? { ...resolved, trim: undefined } : null;
  step('acabamentos', () => {
    trim.setTrimChoice(null);
    if (bare) saveChoice(bare);
  });

  /* 3. AS MEDIDAS, de volta ao que o bake entrega — E AS PORTAS JUNTO.
        `models.resetTrailerDims()` sozinho seria o furo: ele devolve altura e
        comprimento e não toca nas portas, que continuam ENCENADAS no rig. O baú
        voltaria ao tamanho de fábrica com os vãos do projeto anterior ainda
        recortados nele — e sem nada na tela ligando uma coisa à outra.
        `applyMeasures()` com a lista de portas VAZIA passa pelo mesmo caminho de
        um recorte só, então "Novo" custa o mesmo que abrir um projeto. */
  step('medidas do baú', () => {
    const base = models.state.trailerRig?.base;
    if (base) applyMeasures({ height: base.height, length: base.length, doors: {} });
  });

  /* 4. A CHAPA e a VISTA. `echo` porque a decisão tem três espelhos na interface
        e só um deles escuta o motor — ver `setImplementPainted()`. */
  step('tinta do implemento', () => setImplementPainted(false, { echo: true }));
  step('vista', () => models.setVehicleView('both'));

  /* 5. A LUZ — E ELA VEM DO CENÁRIO, NÃO DE UMA CONSTANTE.
        Era `restoreSceneState(undefined)`, que cai em `LIGHT_DEFAULTS` — preset
        `dourado`, sol rasante às 17:45. Dentro do cenário Estúdio isso é luz de
        fim de tarde a céu aberto dentro de um ciclorama fechado, que foi o
        defeito relatado. Cada cenário declara o preset dele no manifesto (o
        Estúdio pede `ciclorama`), então quem reseta a luz pergunta AO CENÁRIO.

        As duas metades, e nesta ordem:
          · `restoreSceneState(undefined)` devolve os controles de ESTÚDIO —
            fundo, preenchimento, recorte, difusão e temperatura —, que
            `applyPreset()` não toca;
          · `applyEnvironmentLighting()` devolve hora, face do relógio e preset,
            e de quebra reseta az/el/brilho para os padrões do preset.
        A ordem importa: o inverso deixaria o `beginTween` do primeiro correndo
        por cima do segundo. */
  step('iluminação', () => {
    restoreSceneState(undefined, { animate: false, persist: true });
    /* `reset: true` — devolve o padrão do PRODUTO (`dourado`, luz rasante que
       mostra a tinta) nos cenários abertos, e o preset do MANIFESTO nos de
       estúdio, que precisam de um preset de sala. Ver `resetPreset()` lá. */
    applyEnvironmentLighting(getCurrentEnvironment(), { animate: true, reset: true });
  });

  /* 6. A RECEITA DA TINTA de volta à do catálogo — o "descartar" do painel de
        ajuste, aplicado de fora.
        NÃO por `applyChoice()`: com a escolha idêntica ele bate no dedupe
        (`sameChoice`) e devolve a fila sem rodar nada. Era o furo — o passo
        existia, parecia certo e não fazia absolutamente nada. Ver `reapplyColor`
        em `StudioHooks`. */
  step('receita da tinta', () => hooks?.reapplyColor());

  step('enquadramento', () => frameAll([models.state.cabGroup, models.state.trailerGroup]));

  /* O AVISO DE "recomeçando" SAI ANTES DO SELETOR, não depois.
     A zeragem tem uma etapa cara — o recorte do baú de volta às medidas de
     fábrica, medido em ~3 s de thread presa —, então ela merece indicador. O
     seletor, que vem logo abaixo, é um overlay de tela inteira e passa a ser o
     indicador dali em diante; uma pílula ainda de pé flutuaria sobre os cards de
     escolha dizendo "recomeçando" enquanto o usuário já está escolhendo.
     Um callback e não um `await` de pílula porque quem sabe desenhar pílula é a
     interface (ui/project-panel.ts) e este arquivo não fala com DOM. */
  opts.onWiped?.();

  /* E O SELETOR, por último — depois de a cena estar limpa.
     Não aguardar nem aplicar nada com o resultado: `ui/selector.ts` dispara
     `onChange` para toda seleção concluída e `studio.ts` pendurou `applyChoice`
     ali no boot. Quem escolher um caminhão novo o recebe por aquele caminho;
     quem cancelar fica com o atual, num projeto zerado. */
  await hooks?.openPicker();
}
