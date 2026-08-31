/* A FORMA de um projeto, e nada além dela.
   ---------------------------------------------------------------------------
   Este é o módulo FOLHA do trio de `project/`: ele não importa um único valor do
   engine — só tipos, que a compilação apaga. Os dois vizinhos importam DELE:

     ./document.ts   lê e escreve o motor vivo (three, fabric, catálogo)
     ./file.ts       lê e escreve o ZIP
     ./store.ts      lê e escreve o IndexedDB

   POR QUE ELE FOI SEPARADO, e a razão é concreta e única: `document.ts` importa
   `scene/scene.ts`, que constrói um `WebGLRenderer` NO ESCOPO DE MÓDULO. Com as
   constantes morando lá, `file.ts` arrastava o engine inteiro junto — e um
   arquivo que exige WebGL para ser carregado não pode ser testado num runner de
   node. Ou seja: a camada que MAIS precisa de teste (o formato que promete abrir
   igual em outra máquina) era justamente a única que não podia ter um.

   Com o esquema aqui, `file.spec.ts` roda o round trip completo — gravar, ler,
   conferir byte a byte — sem tocar numa GPU. */
import type { SavedScene } from '../scene/scene';
import type { TimelineKeyData } from '../scene/timeline';
import type { VehicleView } from '../vehicle/models';
import type { PaintParams } from '../vehicle/paint';
import type { LiveryDocState } from '../vehicle/livery-doc';
import type { Choice } from '../catalog/catalog';
import type { DoorSpec, StructureKey } from '../vehicle/livery-structure';

/** O marcador do formato. Muda se e somente se o significado dos campos mudar. */
export const PROJECT_KIND = 'ankaa.truck-studio.project';

/**
 * A versão do DOCUMENTO — não a do app.
 *
 * Sobe quando um campo muda de significado, nunca quando um campo é
 * ACRESCENTADO: `applyProject()` valida e completa cada pedaço em separado (a
 * mesma disciplina de `restoreSceneState()`), então um documento antigo abre com
 * o padrão no lugar do que ele não tem. Subir a versão por adição jogaria fora
 * os arquivos de todo mundo para resolver um problema que o leitor já resolve.
 */
export const PROJECT_VERSION = 1;

/** Os rótulos legíveis do que os ids apontam, no momento da gravação.
 *  NÃO são estado: nada é aplicado a partir deles. Existem para a conferência
 *  de `verifyProject()` poder dizer "este arquivo é um FH16 e aqui o id `fh16`
 *  virou outra coisa" — um id órfão sozinho não diz o que se perdeu. */
export interface ProjectLabels {
  environment?: string;
  manufacturer?: string;
  model?: string;
  chassis?: string;
  color?: string;
}

export interface ProjectMeasures {
  height: number;
  length: number;
  doors: Partial<Record<StructureKey, DoorSpec[]>>;
}

export interface ProjectCamera {
  /** posição da lente, em metros de mundo */
  pos: [number, number, number];
  /** para onde ela olha (o `target` do OrbitControls) */
  target: [number, number, number];
}

export interface StudioProject {
  kind: typeof PROJECT_KIND;
  version: number;
  /** ISO 8601. Escrito por quem grava; nunca lido para aplicar nada. */
  savedAt?: string;
  /** O nome que o usuário deu. Vazio num arquivo exportado sem nome. */
  name?: string;

  choice: Choice;
  labels?: ProjectLabels;
  scene: SavedScene;
  /** A receita RESOLVIDA da tinta — ver o item 2 do cabeçalho de ./document.ts. */
  paint: PaintParams;
  vehicle: {
    /** "pintar o implemento com a cor do cavalo" */
    implementPainted: boolean;
    /** o que a cena mostra: conjunto, só o cavalo ou só o implemento */
    view: VehicleView;
  };
  measures: ProjectMeasures | null;
  livery: LiveryDocState;
  camera?: ProjectCamera;
  /**
   * O percurso do criador de vídeo — as chaves de câmera, em ordem.
   *
   * OPCIONAL, e ausente quando não há percurso montado: um documento gravado
   * antes desta versão simplesmente não tem o campo, e `applyProject()` cai em
   * "sem percurso" campo a campo, sem que a versão do formato precise subir.
   *
   * ⚠️ AS POSES SÃO ABSOLUTAS EM MUNDO. `scene/timeline.ts` recusa deliberadamente
   * persistir isto no `localStorage` por causa disso — um percurso restaurado num
   * cenário diferente aponta para um pátio vazio. Num PROJETO a objeção não vale,
   * porque o cenário e o veículo viajam no mesmo arquivo; mas só enquanto a
   * escolha restaurada for de fato a que foi gravada, e é `applyProject()` que
   * confere isso antes de aplicar. Ver `importTimeline()`.
   */
  timeline?: TimelineKeyData[];
  /**
   * O filtro de cor DO VÍDEO (`scene/look.ts`), pelo id.
   *
   * OPCIONAL e ausente quando não há filtro: um documento gravado antes desta
   * versão não tem o campo e `applyProject()` cai no padrão, sem que a versão do
   * formato precise subir — a mesma regra do `timeline` acima.
   *
   * ⚠️ ELE VIAJA NO ARQUIVO PELA MESMA RAZÃO QUE O `timeline` VIAJA, e não pela
   * razão dos outros parâmetros de gravação. Modo e tamanho ficam só no
   * `localStorage` porque são preferência de MÁQUINA — quem abre o projeto grava
   * no tamanho que couber na dele. O filtro não: ele é autoria, do mesmo tipo que
   * o percurso de câmera logo acima. Um vídeo aprovado em "Cinema" que reabre em
   * "Nenhum" na mesa de quem recebeu o arquivo perdeu a peça que o cliente viu.
   */
  look?: string;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * `unknown` → `StudioProject`, ou `null` se não for um.
 *
 * Só checa o que decide se dá para SEGUIR: o marcador e a presença dos blocos
 * que o resto do código indexa sem perguntar. Todo o resto é validado no ponto
 * de aplicação, campo a campo — é a diferença entre um arquivo que abre
 * parcialmente e um arquivo que não abre.
 */
export function parseProject(raw: unknown): StudioProject | null {
  if (!isObj(raw) || raw.kind !== PROJECT_KIND) return null;
  if (!isObj(raw.choice)) return null;
  /* `livery` é indexado por `file.ts` (a varredura de imagens) e por
     `store.ts` (a estimativa de tamanho) sem guarda nenhuma. Um documento sem
     ele não é "um projeto sem plotagem", é um objeto de outra coisa. */
  if (!isObj(raw.livery)) return null;
  return raw as unknown as StudioProject;
}
