// apps/web/src/components/production/task/batch-edit/task-batch-result-dialog.tsx

import * as React from "react";
import { IconCheck, IconX, IconAlertCircle, IconClipboardList, IconFileText } from "@tabler/icons-react";
import type { BatchOperationResult, BatchOperationError, Task } from "../../../../types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
    <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg bg-green-50/50">
      <div className="flex-1">
        <div className="font-medium">{task.name}</div>
        <div className="text-sm text-muted-foreground">
          {task.customer?.fantasyName && <span>Cliente: {task.customer.fantasyName}</span>}
          {task.serialNumber && <span className="ml-2">• Série: {task.serialNumber}</span>}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-xs">
            {TASK_STATUS_LABELS[task.status]}
          </Badge>
          {task.sector && (
            <Badge variant="secondary" className="text-xs">
              {task.sector.name}
            </Badge>
          )}
        </div>
      </div>
      <IconCheck className="h-5 w-5 text-green-600 flex-shrink-0" />
    </div>
  );

  const renderFailedItem = (error: BatchOperationError<any>) => {
    const errorMessage = getErrorMessage(error.error);

    return (
      <div key={error.index} className="flex items-start justify-between p-3 border rounded-lg bg-red-50/50">
        <div className="flex-1">
          <div className="font-medium text-red-900">{error.data?.name || `Tarefa ${error.index + 1}`}</div>
          <div className="text-sm text-red-700 mt-1">{errorMessage}</div>
          {error.data?.customer?.fantasyName && <div className="text-sm text-muted-foreground mt-1">Cliente: {error.data.customer.fantasyName}</div>}
        </div>
        <IconX className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
      </div>
    );
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasFailures && !hasSuccesses && (
              <>
                <IconX className="h-5 w-5 text-destructive" />
                Falha na atualização em lote
              </>
            )}
            {hasSuccesses && !hasFailures && (
              <>
                <IconCheck className="h-5 w-5 text-green-600" />
                Tarefas atualizadas com sucesso
              </>
            )}
            {hasSuccesses && hasFailures && (
              <>
                <IconAlertCircle className="h-5 w-5 text-yellow-600" />
                Atualização em lote parcialmente concluída
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {result.totalProcessed} tarefa(s) processada(s) • {result.totalSuccess} com sucesso • {result.totalFailed} com falha
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 my-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total processado</p>
                <p className="text-2xl font-bold">{result.totalProcessed}</p>
              </div>
              <IconFileText className="h-8 w-8 text-muted-foreground/20" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sucessos</p>
                <p className="text-2xl font-bold text-green-600">{result.totalSuccess}</p>
              </div>
              <IconCheck className="h-8 w-8 text-green-600/20" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Falhas</p>
                <p className="text-2xl font-bold text-red-600">{result.totalFailed}</p>
              </div>
              <IconX className="h-8 w-8 text-red-600/20" />
            </div>
          </Card>
        </div>

        <Tabs defaultValue={defaultTab} className="flex-1">
          <TabsList className="w-full">
            {hasSuccesses && (
              <TabsTrigger value="success" className="flex-1">
                <IconCheck className="h-4 w-4 mr-2" />
                Sucessos ({result.totalSuccess})
              </TabsTrigger>
            )}
            {hasFailures && (
              <TabsTrigger value="failed" className="flex-1">
                <IconX className="h-4 w-4 mr-2" />
                Falhas ({result.totalFailed})
              </TabsTrigger>
            )}
          </TabsList>

          {hasSuccesses && (
            <TabsContent value="success" className="mt-4">
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">{result.success.map(renderSuccessItem)}</div>
              </ScrollArea>
            </TabsContent>
          )}

          {hasFailures && (
            <TabsContent value="failed" className="mt-4">
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">{result.failed.map(renderFailedItem)}</div>
              </ScrollArea>
            </TabsContent>
          )}
        </Tabs>

        <div className="flex justify-end pt-4">
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getErrorMessage(error: string): string {
  // Parse common error messages and make them user-friendly
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

  // Return original error message if no specific match
  return error;
}
