/**
 * A ARTE DO IMPLEMENTO, lida de uma tarefa (Modelo C, P12).
 *
 * A arte saiu da tarefa e do orçamento: mora no implemento
 * (`Implement.layouts`), com estado próprio (rascunho → aguardando o cliente →
 * aprovada/reprovada; reprovada só volta por versão nova, e a anterior vira
 * SUBSTITUÍDA). O orçamento e o documento de assinatura levam a APROVADA de
 * cada veículo.
 *
 * Estas funções leem o que o `include` traz — `implement.layouts` com o
 * arquivo — sem saber de tela.
 */
import { LAYOUT_STATUS } from "@/constants/enums";

/** O `include` da tarefa que traz a arte viva do implemento, com o arquivo. */
export const IMPLEMENT_ART_LAYOUTS_INCLUDE = {
  where: { status: { not: LAYOUT_STATUS.SUPERSEDED } },
  orderBy: { createdAt: "asc" },
  include: { file: true },
} as const;

/**
 * A forma LEVE para listas: só a arte APROVADA do implemento, e só id e estado —
 * o que a coluna "ARTES" e a exportação contam. Sem o arquivo.
 */
export const IMPLEMENT_APPROVED_ART_COUNT_INCLUDE = {
  where: { status: LAYOUT_STATUS.APPROVED },
  select: { id: true, status: true },
} as const;

/** Quantas artes APROVADAS o implemento da tarefa tem (o que as listas mostram). */
export function approvedArtCountOf(task: TaskWithImplementArt | null | undefined): number {
  return implementArtOf(task).filter((layout) => layout.status === LAYOUT_STATUS.APPROVED).length;
}

export interface ImplementArtFile {
  id: string;
  filename?: string | null;
  originalName?: string | null;
  mimetype?: string | null;
  size?: number | null;
  thumbnailUrl?: string | null;
}

export interface ImplementArtLayout {
  id: string;
  fileId: string;
  status: LAYOUT_STATUS | string;
  version?: number | null;
  createdAt?: Date | string | null;
  file?: ImplementArtFile | null;
}

interface TaskWithImplementArt {
  implement?: { id?: string | null; layouts?: ImplementArtLayout[] | null } | null;
}

/** A arte viva (não substituída) do implemento da tarefa, na ordem de criação. */
export function implementArtOf(task: TaskWithImplementArt | null | undefined): ImplementArtLayout[] {
  return (task?.implement?.layouts ?? []).filter((layout) => layout.status !== LAYOUT_STATUS.SUPERSEDED);
}

/** Os arquivos da arte APROVADA — o que o documento de assinatura imprime. */
export function approvedArtFilesOf(task: TaskWithImplementArt | null | undefined): ImplementArtFile[] {
  return implementArtOf(task)
    .filter((layout) => layout.status === LAYOUT_STATUS.APPROVED && !!layout.file)
    .map((layout) => layout.file as ImplementArtFile);
}

/**
 * O estado da arte do veículo numa palavra, para a lista: a aprovada ganha;
 * senão a que espera o cliente; senão o rascunho; senão a reprovada. `NONE`
 * quando o implemento não tem arte (ou a tarefa não tem implemento).
 */
export type ImplementArtState = "APPROVED" | "PENDING_APPROVAL" | "DRAFT" | "REPROVED" | "NONE";

export function implementArtStateOf(task: TaskWithImplementArt | null | undefined): ImplementArtState {
  const statuses = new Set(implementArtOf(task).map((layout) => layout.status));
  if (statuses.has(LAYOUT_STATUS.APPROVED)) return "APPROVED";
  if (statuses.has(LAYOUT_STATUS.PENDING_APPROVAL)) return "PENDING_APPROVAL";
  if (statuses.has(LAYOUT_STATUS.DRAFT)) return "DRAFT";
  if (statuses.has(LAYOUT_STATUS.REPROVED)) return "REPROVED";
  return "NONE";
}
