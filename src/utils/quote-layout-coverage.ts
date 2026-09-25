// `import type` puro: este módulo não tem dependência de runtime.
import type { QuoteLayoutFile, QuoteLayoutScope } from "../types/budget";

/**
 * O LAYOUT APROVADO DE CADA VEÍCULO.
 *
 * Um orçamento cobre N implementos com UM preço, mas cada um pode ter a sua arte — o
 * caso que abriu isto foi o da Carlotti (nº 990): dois implementos, mesmo valor, cada
 * um com pintura geral e layout próprios. Até então o "layout aprovado" era uma
 * lista só do orçamento, e a API o aprovava em TODOS os veículos e reprovava em
 * todos o que ficava de fora: trocar a arte pela segunda tarefa reprovava a da
 * primeira.
 *
 * O modelo agora tem dois modos (`Budget.layoutScope`):
 *   • `SHARED` — o de sempre: toda arte de `layoutFiles` vale para todo veículo;
 *   • `PER_VEHICLE` — cada arte diz, em `quoteLayoutTasks`, os veículos que cobre.
 *
 * Para a API vai `layouts: [{ fileId, taskIds }]`, com `taskIds: null` significando
 * "todos". Quando toda arte cobre todos os veículos a API grava `SHARED` sozinha —
 * não existe um `PER_VEHICLE` que diga a mesma coisa que o compartilhado.
 */

interface QuoteLayoutsLike {
  layoutScope?: QuoteLayoutScope | null;
  layoutFiles?: QuoteLayoutFile[] | null;
}

/** O modo do orçamento; ausente (API anterior à coluna) é `SHARED`. */
export function layoutScopeOf(quote: QuoteLayoutsLike | null | undefined): QuoteLayoutScope {
  return quote?.layoutScope === "PER_VEHICLE" ? "PER_VEHICLE" : "SHARED";
}

/** Os veículos que uma arte cobre em `PER_VEHICLE` (vazio em `SHARED`). */
export function coveredTaskIdsOfLayout(file: QuoteLayoutFile | null | undefined): string[] {
  return (file?.quoteLayoutTasks ?? []).map((row) => row.taskId).filter(Boolean);
}

/** As artes que valem para UM veículo. */
export function layoutFilesForTask(
  quote: QuoteLayoutsLike | null | undefined,
  taskId: string,
): QuoteLayoutFile[] {
  const files = quote?.layoutFiles ?? [];
  if (layoutScopeOf(quote) === "SHARED") return files;
  return files.filter((f) => coveredTaskIdsOfLayout(f).includes(taskId));
}

/** Uma entrada de `layouts` como a API recebe. */
export interface QuoteLayoutEntry {
  fileId: string;
  /** `null` = todos os veículos do orçamento. */
  taskIds: string[] | null;
}

/** O layout compartilhado: cada arte para todos. */
export function sharedLayoutsPayload(fileIds: string[]): QuoteLayoutEntry[] {
  return [...new Set(fileIds)].map((fileId) => ({ fileId, taskIds: null }));
}

/**
 * O layout por veículo: parte da seleção de cada implemento e junta, por arte, os
 * veículos que a escolheram. A ordem das artes é a do primeiro veículo que as cita
 * (a ordem canônica das tarefas), que é a ordem em que o documento as mostra.
 */
export function perVehicleLayoutsPayload(
  taskIds: string[],
  selectionByTask: Record<string, string[] | undefined>,
): QuoteLayoutEntry[] {
  const order: string[] = [];
  const cover = new Map<string, Set<string>>();
  for (const taskId of taskIds) {
    for (const fileId of selectionByTask[taskId] ?? []) {
      if (!cover.has(fileId)) {
        cover.set(fileId, new Set());
        order.push(fileId);
      }
      cover.get(fileId)!.add(taskId);
    }
  }
  return order.map((fileId) => {
    const set = cover.get(fileId)!;
    const all = taskIds.length > 0 && taskIds.every((t) => set.has(t));
    return { fileId, taskIds: all ? null : taskIds.filter((t) => set.has(t)) };
  });
}

/**
 * Uma CHAVE para comparar duas descrições de layout — a da tela e a gravada.
 *
 * Ordena artes e veículos, e trata "cobre todos" igual a `null`: o que o banco
 * guarda é quem cobre quem, não a ordem em que as artes foram escolhidas (a API
 * lista `layoutFiles` pela data de criação). Sem isso abrir e salvar um orçamento
 * sem mexer na arte pareceria uma troca — e troca de arte derruba a assinatura.
 */
export function layoutsKey(entries: QuoteLayoutEntry[], taskIds: string[]): string {
  const all = [...taskIds].sort();
  const normalized = entries
    .map((e) => {
      const covered = e.taskIds === null ? all : [...new Set(e.taskIds)].sort();
      const coversAll = covered.length === all.length && covered.every((t, i) => t === all[i]);
      return [e.fileId, coversAll ? "*" : covered.join(",")] as const;
    })
    .sort((a, b) => a[0].localeCompare(b[0]));
  return JSON.stringify(normalized);
}

/** A chave do que está GRAVADO — para comparar com `layoutsKey` da tela. */
export function persistedLayoutsKey(
  quote: QuoteLayoutsLike | null | undefined,
  taskIds: string[],
): string {
  const files = quote?.layoutFiles ?? [];
  const perVehicle = layoutScopeOf(quote) === "PER_VEHICLE";
  const entries = files.map((f) => ({
    fileId: f.id,
    taskIds: perVehicle ? coveredTaskIdsOfLayout(f) : null,
  }));
  return layoutsKey(entries, taskIds);
}
