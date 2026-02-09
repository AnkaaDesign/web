import { IconCheck, IconX, IconAlertCircle, IconPackage, IconFileText, IconArrowUp, IconArrowDown } from "@tabler/icons-react";
import type { BatchOperationResult, BatchOperationError } from "../../../types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { formatNumber } from "@/utils/number";

interface StockBalanceBatchResult {
  itemName?: string;
  quantity?: number;
  difference?: number;
  operation?: string;
  [key: string]: any;
}

interface StockBalanceBatchResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: BatchOperationResult<StockBalanceBatchResult, StockBalanceBatchResult> | null;
}

export function StockBalanceBatchResultDialog({ open, onOpenChange, result }: StockBalanceBatchResultDialogProps) {
  if (!result) return null;

  const hasSuccesses = result.totalSuccess > 0;
  const hasFailures = result.totalFailed > 0;
  const defaultTab = hasFailures ? "failed" : "success";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasFailures && !hasSuccesses && (
              <>
                <IconX className="h-5 w-5 text-destructive" />
                Falha no balanco de estoque
              </>
            )}
            {hasSuccesses && !hasFailures && (
              <>
                <IconCheck className="h-5 w-5 text-green-600" />
                Balanco de estoque concluido
              </>
            )}
            {hasSuccesses && hasFailures && (
              <>
                <IconAlertCircle className="h-5 w-5 text-yellow-600" />
                Balanco de estoque parcialmente concluido
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {result.totalProcessed} ajuste(s) processado(s) • {result.totalSuccess} com sucesso • {result.totalFailed} com falha
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
                <p className="text-sm text-muted-foreground">Sucesso</p>
                <p className="text-2xl font-bold text-green-600">{result.totalSuccess}</p>
              </div>
              <IconCheck className="h-8 w-8 text-green-600/20" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Falha</p>
                <p className="text-2xl font-bold text-destructive">{result.totalFailed}</p>
              </div>
              <IconX className="h-8 w-8 text-destructive/20" />
            </div>
          </Card>
        </div>

        <Tabs defaultValue={defaultTab} className="flex-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="success" disabled={!hasSuccesses}>
              <IconCheck className="h-4 w-4 mr-2" />
              Sucesso ({result.totalSuccess})
            </TabsTrigger>
            <TabsTrigger value="failed" disabled={!hasFailures}>
              <IconX className="h-4 w-4 mr-2" />
              Falhas ({result.totalFailed})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="success" className="mt-4">
            <ScrollArea className="h-[350px] pr-4">
              {result.success.length > 0 ? (
                <div className="space-y-2">
                  {result.success.map((item, index) => {
                    const itemData = item as any;
                    const itemName = itemData.itemName || itemData.item?.name || itemData.data?.itemName || "Item desconhecido";
                    const quantity = itemData.quantity || itemData.data?.quantity || 0;
                    const operation = itemData.operation || itemData.data?.operation;
                    const isInbound = operation === "INBOUND";

                    return (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900"
                      >
                        <IconCheck className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{itemName}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            {isInbound ? (
                              <>
                                <IconArrowUp className="h-3 w-3 text-green-600" />
                                <span className="text-green-600">+{formatNumber(quantity)}</span>
                                <span> (entrada)</span>
                              </>
                            ) : (
                              <>
                                <IconArrowDown className="h-3 w-3 text-red-600" />
                                <span className="text-red-600">-{formatNumber(quantity)}</span>
                                <span> (saida)</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                  <IconPackage className="h-12 w-12 mb-2" />
                  <p>Nenhum ajuste foi processado com sucesso</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="failed" className="mt-4">
            <ScrollArea className="h-[350px] pr-4">
              {result.failed.length > 0 ? (
                <div className="space-y-2">
                  {result.failed.map((error, index) => {
                    const errorData = error as any;
                    const item = error.data as StockBalanceBatchResult;
                    const itemName = errorData.itemName || item?.itemName || errorData.data?.itemName || "Item desconhecido";

                    return (
                      <div key={index} className="border border-destructive/20 rounded-lg overflow-hidden px-4 py-3 bg-destructive/5">
                        <div className="flex items-start gap-3">
                          <IconX className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-semibold text-base">{itemName}</p>
                            <p className="text-sm text-destructive mt-1">{error.error}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                  <IconCheck className="h-12 w-12 mb-2" />
                  <p>Nenhuma falha ocorreu</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
