import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { getTaskById } from "@/api-client";
import { airbrushingService } from "@/api-client/airbrushing";
import { taskKeys } from "@/hooks";
import { airbrushingKeys } from "@/hooks/common/query-keys";
import type { Task } from "@/types";

/**
 * O que a tela de orçamento precisa de CADA veículo para editá-lo.
 *
 * É o `include` que a página já usava para a tarefa aberta — cliente, caminhão com a
 * foto da plaqueta (relação de File: um `truck: true` deixaria a Plaqueta sempre vazia
 * e um save apagaria a foto), layouts com o arquivo, arquivos base, responsáveis — mais
 * a pintura geral, que agora aparece na aba e no Resumo de cada caminhão.
 *
 * Uma constante só, para que a tarefa aberta e as irmãs caiam na MESMA chave de cache
 * de `useTaskDetail`.
 */
export const BUDGET_VEHICLE_TASK_INCLUDE = {
  customer: true,
  implement: { include: { vinPlate: true } },
  layouts: { include: { file: true } },
  baseFiles: true,
  responsibles: true,
  generalPainting: true,
} as const;

/** As aerografias de cada veículo, com o que a reconciliação compara (arquivos, pintor). */
const AIRBRUSHING_INCLUDE = {
  layouts: { include: { file: true } },
  receipts: true,
  invoices: true,
  painter: true,
} as const;

/**
 * OS VEÍCULOS DE UM ORÇAMENTO, completos — uma tarefa por veículo, na ordem pedida
 * (a canônica, de `quoteTasks`).
 *
 * A tela era aberta por UMA tarefa e só carregava ela; os irmãos existiam só como
 * linhas do Resumo (série, placa, pedido). Para editar cada caminhão no mesmo lugar é
 * preciso o registro inteiro de cada um — e as aerografias, que moram noutra tabela.
 *
 * As aerografias vêm num pedido só para os N veículos (a API filtra por `taskIds`) e
 * são separadas aqui por tarefa. O teto de 100 linhas é o da API; um orçamento com
 * mais aerografias do que isso não existe no acervo, mas se existir a conta aparece em
 * `airbrushingsTruncated` em vez de a reconciliação apagar o que não veio.
 */
export function useBudgetVehicles(taskIds: string[], enabled = true) {
  const results = useQueries({
    queries: taskIds.map((id) => ({
      queryKey: taskKeys.detail(id, BUDGET_VEHICLE_TASK_INCLUDE),
      queryFn: () => getTaskById(id, { include: BUDGET_VEHICLE_TASK_INCLUDE as any }),
      enabled: enabled && !!id,
      staleTime: 1000 * 60 * 5,
      retry: 2,
    })),
  });

  const sortedIds = useMemo(() => [...taskIds].sort(), [taskIds]);
  const airbrushingsQuery = useQuery({
    queryKey: [...airbrushingKeys.all, "budget-vehicles", sortedIds],
    queryFn: () =>
      airbrushingService.getAirbrushings({
        taskIds: sortedIds,
        include: AIRBRUSHING_INCLUDE,
        limit: 100,
      } as any),
    enabled: enabled && sortedIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  // `useQueries` devolve um array novo a cada render; a lista só muda quando algum
  // dado muda de fato — é isso que deixa quem depende dela (memos, o save) estável.
  const dataStamp = results.map((r) => r.dataUpdatedAt).join(",");
  const tasks = useMemo(
    () => results.map((r) => (r.data as any)?.data as Task | undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataStamp],
  );
  const tasksLoaded = results.length > 0 && results.every((r) => !!(r.data as any)?.data);
  const isLoading = results.some((r) => r.isLoading) || airbrushingsQuery.isLoading;
  const isError = results.some((r) => r.isError) || airbrushingsQuery.isError;

  const airbrushingRows = ((airbrushingsQuery.data as any)?.data ?? []) as any[];
  const airbrushingsByTask = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const id of taskIds) map[id] = [];
    for (const a of airbrushingRows) {
      if (a?.taskId && map[a.taskId]) map[a.taskId].push(a);
    }
    return map;
  }, [airbrushingRows, taskIds]);
  const airbrushingsTotal = (airbrushingsQuery.data as any)?.meta?.totalRecords;
  const airbrushingsTruncated =
    typeof airbrushingsTotal === "number" && airbrushingsTotal > airbrushingRows.length;

  return {
    /** Na ordem de `taskIds`; `undefined` enquanto aquela tarefa carrega. */
    tasks,
    tasksLoaded,
    airbrushingsLoaded: airbrushingsQuery.isSuccess,
    airbrushingsByTask,
    airbrushingsTruncated,
    isLoading,
    isError,
  };
}
