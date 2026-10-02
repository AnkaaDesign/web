/**
 * "UMA IMAGEM PARA TODOS" NA CRIAÇÃO — a arte entra no IMPLEMENTO de cada
 * tarefa recém-criada (Modelo C), nascendo RASCUNHO.
 *
 * A tarefa não aceita mais arte no corpo (`layoutIds` dá 400). O caminho é o do
 * implemento: sobe os arquivos no PRIMEIRO implemento (`POST /implements/:id/layouts`)
 * e replica o MESMO arquivo nos demais (`POST /implements/layouts/bulk`), numa
 * transação por arquivo. Depois, cada veículo é ajustado no painel da arte dele.
 *
 * Não bloqueia: a tarefa e o orçamento já existem; uma falha aqui vira aviso, e
 * a arte pode ser enviada depois.
 */
import { getTaskById } from "@/api-client";
import { bulkImplementLayouts, uploadImplementLayouts } from "@/api-client/implement";

/** O implemento de cada tarefa, na ordem pedida; tarefas sem implemento ficam de fora. */
async function implementIdsOf(taskIds: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const taskId of taskIds) {
    const response = await getTaskById(taskId, { include: { implement: true } } as any);
    const implementId = (response?.data as any)?.implement?.id as string | undefined;
    if (implementId) ids.push(implementId);
  }
  return ids;
}

/**
 * "UMA IMAGEM PARA TODOS" — a MESMA arte, como rascunho, em cada veículo.
 *
 * O único ponto da web que faz isso: sobe no primeiro implemento e aplica o
 * mesmo arquivo aos demais pelo lote (`POST /implements/layouts/bulk`). Com
 * `budgetId`, o lote é ATÔMICO sobre todos os veículos não cancelados do
 * orçamento (a API pula quem já tem o arquivo); sem ele, sobre a lista dada.
 *
 * Devolve quantos implementos ficaram com a arte.
 */
export async function applyArtToImplements(
  implementIds: string[],
  files: File[],
  options: { budgetId?: string | null } = {},
): Promise<number> {
  const unique = [...new Set(implementIds.filter(Boolean))];
  if (unique.length === 0 || files.length === 0) return 0;

  const [first, ...rest] = unique;
  const uploaded = await uploadImplementLayouts(first, files);
  if (!options.budgetId && rest.length === 0) return 1;

  let total = unique.length;
  for (const layout of uploaded.data ?? []) {
    const result = await bulkImplementLayouts(
      options.budgetId ? { budgetId: options.budgetId } : { implementIds: rest },
      layout.fileId,
    );
    if (options.budgetId && result.data?.total) total = result.data.total;
  }
  return total;
}

/**
 * Anexa `files` (imagens) como arte RASCUNHO no implemento de cada tarefa.
 * Devolve quantos implementos receberam a arte.
 */
export async function attachArtToTasks(taskIds: string[], files: File[]): Promise<number> {
  if (taskIds.length === 0 || files.length === 0) return 0;
  return applyArtToImplements(await implementIdsOf(taskIds), files);
}
