import { TASK_STATUS } from "@/constants";
import type { Task } from "@/types";

/**
 * Cancelar uma tarefa não para nela: a API cascateia o cancelamento para as ordens de serviço
 * pendentes e para o orçamento vinculado, e ainda desmonta o faturamento (exclui notas/parcelas,
 * dá baixa nos boletos no Sicredi, cancela a NFS-e na Elotech). Nada disso é desfeito ao voltar
 * o status da tarefa. Como o item "Cancelar" fica colado no "Excluir" no menu de contexto, o
 * clique errado sai caro — daí o texto abaixo enumerar o estrago antes de confirmar.
 */
export function taskCancelConfirmOpts(targets: Task[]) {
  const pending = targets.filter((t) => t.status !== TASK_STATUS.CANCELLED);
  const isBulk = pending.length > 1;

  return {
    title: isBulk ? `Cancelar ${pending.length} tarefas` : "Cancelar tarefa",
    description: isBulk
      ? `${pending.length} tarefas serão canceladas. As ordens de serviço pendentes e os orçamentos ` +
        `vinculados também são cancelados, e o faturamento já emitido é desmontado (notas e parcelas ` +
        `excluídas, boletos baixados, NFS-e cancelada). Reverter o status depois não restaura nada disso.`
      : `A tarefa "${pending[0]?.name ?? ""}" será cancelada. As ordens de serviço pendentes e o orçamento ` +
        `vinculado também são cancelados, e o faturamento já emitido é desmontado (notas e parcelas ` +
        `excluídas, boletos baixados, NFS-e cancelada). Reverter o status depois não restaura nada disso.`,
    // "Confirmar cancelamento" e não "Cancelar tarefa": o botão de dispensar do AlertDialog já se
    // chama "Cancelar", e dois botões começando com o mesmo verbo é justamente o clique trocado.
    confirmLabel: "Confirmar cancelamento",
    destructive: true,
  };
}
