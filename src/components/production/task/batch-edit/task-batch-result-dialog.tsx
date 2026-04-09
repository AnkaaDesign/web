// apps/web/src/components/production/task/batch-edit/task-batch-result-dialog.tsx

import { IconCheck, IconX, IconAlertCircle, IconFileText } from "@tabler/icons-react";
import type { BatchOperationResult, BatchOperationError, Task } from "../../../../types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TASK_STATUS_LABELS } from "../../../../constants";

interface TaskBatchResultDialogProps {
  result: BatchOperationResult<Task>;
  onClose: () => void;
}

export function TaskBatchResultDialog({ result, onClose }: TaskBatchResultDialogProps) {
  const hasSuccesses = result.totalSuccess > 0;
  const hasFailures = result.totalFailed > 0;
  const defaultTab = hasFailures ? "failed" : "success";

  const renderSuccessItem = (task: Task) => (
    <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{task.name}</div>
        {task.customer?.corporateName && (
          <div className="text-sm text-muted-foreground truncate">{task.customer.corporateName}</div>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {TASK_STATUS_LABELS[task.status]}
          </Badge>
          {task.sector && (
            <Badge variant="secondary" className="text-xs">
              {task.sector.name}
            </Badge>
          )}
          {task.serialNumber && (
            <span className="text-xs text-muted-foreground">Série: {task.serialNumber}</span>
          )}
        </div>
      </div>
      <div className="ml-3 flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-green-500/15">
        <IconCheck className="h-4 w-4 text-green-500" />
      </div>
    </div>
  );

  const renderFailedItem = (error: BatchOperationError<any>) => {
    const errorMessage = getErrorMessage(error.error);
    return (
      <div key={error.index} className="flex items-start justify-between p-3 rounded-lg border border-destructive/30 bg-destructive/5">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{error.data?.name || `Tarefa ${error.index + 1}`}</div>
          <div className="text-sm text-destructive mt-1">{errorMessage}</div>
          {error.data?.customer?.corporateName && (
            <div className="text-sm text-muted-foreground mt-0.5 truncate">{error.data.customer.corporateName}</div>
          )}
        </div>
        <div className="ml-3 flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-destructive/15">
          <IconX className="h-4 w-4 text-destructive" />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl flex flex-col max-h-[85vh] gap-0 p-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {hasFailures && !hasSuccesses && (
                <>
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-destructive/15">
                    <IconX className="h-4 w-4 text-destructive" />
                  </div>
                  Falha na atualização em lote
                </>
              )}
              {hasSuccesses && !hasFailures && (
                <>
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-green-500/15">
                    <IconCheck className="h-4 w-4 text-green-500" />
                  </div>
                  Tarefas atualizadas com sucesso
                </>
              )}
              {hasSuccesses && hasFailures && (
                <>
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-yellow-500/15">
                    <IconAlertCircle className="h-4 w-4 text-yellow-500" />
                  </div>
                  Atualização em lote parcialmente concluída
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-sm mt-1">
              {result.totalProcessed} tarefa(s) processada(s) • {result.totalSuccess} com sucesso • {result.totalFailed} com falha
            </DialogDescription>
          </DialogHeader>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/40">
              <div>
                <p className="text-xs text-muted-foreground">Total processado</p>
                <p className="text-2xl font-bold">{result.totalProcessed}</p>
              </div>
              <IconFileText className="h-7 w-7 text-muted-foreground/25" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-green-500/20 bg-green-500/5">
              <div>
                <p className="text-xs text-muted-foreground">Sucessos</p>
                <p className="text-2xl font-bold text-green-500">{result.totalSuccess}</p>
              </div>
              <IconCheck className="h-7 w-7 text-green-500/25" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5">
              <div>
                <p className="text-xs text-muted-foreground">Falhas</p>
                <p className="text-2xl font-bold text-destructive">{result.totalFailed}</p>
              </div>
              <IconX className="h-7 w-7 text-destructive/25" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-col flex-1 overflow-hidden px-6 py-4">
          <Tabs defaultValue={defaultTab} className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="w-full shrink-0">
              {hasSuccesses && (
                <TabsTrigger value="success" className="flex-1 gap-1.5">
                  <IconCheck className="h-4 w-4" />
                  Sucessos ({result.totalSuccess})
                </TabsTrigger>
              )}
              {hasFailures && (
                <TabsTrigger value="failed" className="flex-1 gap-1.5">
                  <IconX className="h-4 w-4" />
                  Falhas ({result.totalFailed})
                </TabsTrigger>
              )}
            </TabsList>

            {hasSuccesses && (
              <TabsContent value="success" className="flex-1 overflow-hidden mt-3">
                <ScrollArea className="h-full max-h-[280px]">
                  <div className="space-y-2 pr-3">{result.success.map(renderSuccessItem)}</div>
                </ScrollArea>
              </TabsContent>
            )}

            {hasFailures && (
              <TabsContent value="failed" className="flex-1 overflow-hidden mt-3">
                <ScrollArea className="h-full max-h-[280px]">
                  <div className="space-y-2 pr-3">{result.failed.map(renderFailedItem)}</div>
                </ScrollArea>
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex justify-end border-t border-border pt-4">
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getErrorMessage(error: string): string {
  if (error.includes("UNIQUE constraint failed")) {
    return "Já existe uma tarefa com essas informações";
  }
  if (error.includes("validation")) {
    return "Dados inválidos fornecidos";
  }
  if (error.includes("status transition")) {
    return "Transição de status inválida";
  }
  if (error.includes("customer")) {
    return "Cliente não encontrado ou inválido";
  }
  if (error.includes("sector")) {
    return "Setor não encontrado ou inválido";
  }
  return error;
}
