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
 * Anexa `files` (imagens) como arte RASCUNHO no implemento de cada tarefa.
 * Devolve quantos implementos receberam a arte.
 */
export async function attachArtToTasks(taskIds: string[], files: File[]): Promise<number> {
  if (taskIds.length === 0 || files.length === 0) return 0;
  const implementIds = await implementIdsOf(taskIds);
  if (implementIds.length === 0) return 0;

  const [first, ...rest] = implementIds;
  const uploaded = await uploadImplementLayouts(first, files);
  if (rest.length > 0) {
    for (const layout of uploaded.data ?? []) {
      await bulkImplementLayouts(rest, layout.fileId);
    }
  }
  return implementIds.length;
}
