import * as React from "react";
import { IconCheck, IconX, IconAlertCircle, IconPackage, IconFileText } from "@tabler/icons-react";
import type { BatchOperationResult, BatchOperationError } from "../../types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BatchOperationResultDialogProps<TSuccess = any, TFailed = any> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: BatchOperationResult<TSuccess, TFailed> | null;
  operationType: "create" | "update" | "delete";
  entityName: string;
  successItemDisplay?: (item: TSuccess) => React.ReactNode;
  failedItemDisplay?: (error: BatchOperationError<TFailed>) => React.ReactNode;
}

export function BatchOperationResultDialog<TSuccess = any, TFailed = any>({
  open,
  onOpenChange,
  result,
  operationType,
  entityName,
  successItemDisplay,
  failedItemDisplay,
}: BatchOperationResultDialogProps<TSuccess, TFailed>) {
  if (!result) return null;

  const operationLabel = {
    create: "criados",
    update: "atualizados",
    delete: "excluídos",
  }[operationType];

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
                Falha na operação em lote
              </>
            )}
            {hasSuccesses && !hasFailures && (
              <>
                <IconCheck className="h-5 w-5 text-green-600" />
                Operação em lote concluída
              </>
            )}
            {hasSuccesses && hasFailures && (
              <>
                <IconAlertCircle className="h-5 w-5 text-yellow-600" />
                Operação em lote parcialmente concluída
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {result.totalProcessed} {entityName}(s) processado(s) <span className="font-enhanced-unicode">•</span> {result.totalSuccess} com sucesso{" "}
            <span className="font-enhanced-unicode">•</span> {result.totalFailed} com falha
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
                  {result.success.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                      <IconCheck className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <div className="flex-1">
                        {successItemDisplay ? (
                          successItemDisplay(item)
                        ) : (
                          <span className="text-sm">
                            Item {index + 1} {operationLabel} com sucesso
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                  <IconPackage className="h-12 w-12 mb-2" />
                  <p>Nenhum item foi processado com sucesso</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="failed" className="mt-4">
            <ScrollArea className="h-[350px] pr-4">
              {result.failed.length > 0 ? (
                <div className="space-y-2">
                  {result.failed.map((error, index) => (
                    <div key={index} className="border border-destructive/20 rounded-lg overflow-hidden px-4 py-3 bg-destructive/5">
                      <div className="flex items-start gap-3">
                        <IconX className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          {failedItemDisplay ? (
                            failedItemDisplay(error)
                          ) : (
                            <div>
                              <p className="font-medium text-sm">Item {error.index + 1}</p>
                              <p className="text-sm text-destructive mt-1">{error.error}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
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

// Specialized version for Activities
interface ActivityBatchResult {
  itemName?: string;
  userName?: string;
  quantity?: number;
  [key: string]: any;
}

export function ActivityBatchResultDialog(
  props: Omit<BatchOperationResultDialogProps<ActivityBatchResult, ActivityBatchResult>, "entityName" | "successItemDisplay" | "failedItemDisplay">,
) {
  const successItemDisplay = (item: ActivityBatchResult) => {
    // Handle both cases: data directly on item or nested
    const itemData = item as any;
    const itemName = itemData.itemName || itemData.item?.name || itemData.data?.itemName || "Item desconhecido";
    const userName = itemData.userName || itemData.user?.name || itemData.data?.userName || "Usuário desconhecido";
    const quantity = itemData.quantity || itemData.data?.quantity || 0;

    return (
      <div className="flex-1">
        <p className="font-medium text-sm">{itemName}</p>
        <p className="text-xs text-muted-foreground">
          {userName} <span className="font-enhanced-unicode">•</span> Quantidade: {quantity}
        </p>
      </div>
    );
  };

  const failedItemDisplay = (error: BatchOperationError<ActivityBatchResult>) => {
    // Handle both cases: data in error.data or directly on error object
    const errorData = error as any;
    const item = error.data as ActivityBatchResult;

    const itemName = errorData.itemName || item?.itemName || errorData.data?.itemName || "Item desconhecido";
    const userName = errorData.userName || item?.userName || errorData.data?.userName || "Usuário desconhecido";
    // const quantity = item?.quantity || errorData.data?.quantity || 0;

    // Parse error message for better formatting
    let errorDisplay;
    if (error.error.includes("Estoque insuficiente") || error.error.includes("Quantidade insuficiente em estoque")) {
      // Parse the stock error message - try multiple patterns (now handling negative numbers)
      let match = error.error.match(/Disponível: (-?\d+), Necessário: (-?\d+)/);

      // Try alternative patterns if the first doesn't match
      if (!match) {
        match = error.error.match(/Disponível: (-?\d+), Solicitado: (-?\d+)/);
      }

      // If still no match, try to extract any numbers after specific keywords
      let available = null;
      let requested = null;

      if (!match) {
        const availableMatch = error.error.match(/[Dd]isponível:?\s*(-?\d+)/);
        const requestedMatch = error.error.match(/[Nn]ecessári[oa]:?\s*(-?\d+)/) || error.error.match(/[Ss]olicitad[oa]:?\s*(-?\d+)/);

        if (availableMatch) available = availableMatch[1];
        if (requestedMatch) requested = requestedMatch[1];
      } else {
        available = match[1];
        requested = match[2];
      }

      // Always show the parsed values if we have at least one
      if (available !== null || requested !== null) {
        errorDisplay = (
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">Quantidade insuficiente em estoque</p>
            <div className="text-sm space-y-1">
              <p>
                Disponível: <span className="font-semibold">{available !== null ? available : "0"}</span>
              </p>
              <p>
                Necessário: <span className="font-semibold">{requested !== null ? requested : "0"}</span>
              </p>
            </div>
          </div>
        );
      } else {
        // If we couldn't parse, try to split the message manually
        const parts = error.error.split(",").map((s) => s.trim());
        errorDisplay = (
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">Quantidade insuficiente em estoque</p>
            <div className="text-sm space-y-1">
              {parts.map((part, idx) => (
                <p key={idx}>{part}</p>
              ))}
            </div>
          </div>
        );
      }
    } else if (error.error.includes("excederia o limite máximo")) {
      // Format max limit error
      const match = error.error.match(/Máximo: (\d+), Atual: (\d+), Tentando adicionar: (\d+)/);
      if (match) {
        errorDisplay = (
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">Limite máximo excedido</p>
            <div className="text-sm space-y-1">
              <p>
                <span className="font-enhanced-unicode">•</span> Limite máximo: <span className="font-semibold">{match[1]}</span>
              </p>
              <p>
                <span className="font-enhanced-unicode">•</span> Quantidade atual: <span className="font-semibold">{match[2]}</span>
              </p>
              <p>
                <span className="font-enhanced-unicode">•</span> Tentando adicionar: <span className="font-semibold">{match[3]}</span>
              </p>
            </div>
          </div>
        );
      } else {
        errorDisplay = <p className="text-sm text-destructive">{error.error}</p>;
      }
    } else {
      // Default error display
      const errorParts = error.error.split(".");
      errorDisplay = (
        <div className="text-sm text-destructive space-y-1">
          {errorParts.map((part, idx) => (
            <p key={idx} className={cn(idx > 0 && "ml-2")}>
              {part.trim()}
            </p>
          ))}
        </div>
      );
    }

    return (
      <div className="flex-1">
        <p className="font-semibold text-base">{itemName}</p>
        <p className="text-sm text-muted-foreground mt-1 mb-3">{userName}</p>
        {errorDisplay}
      </div>
    );
  };

  return <BatchOperationResultDialog {...props} entityName="atividade" successItemDisplay={successItemDisplay} failedItemDisplay={failedItemDisplay} />;
}

// Specialized version for Borrows
interface BorrowBatchResult {
  itemName?: string;
  userName?: string;
  quantity?: number;
  returnDate?: string;
  [key: string]: any;
}

export function BorrowBatchResultDialog(
  props: Omit<BatchOperationResultDialogProps<BorrowBatchResult, BorrowBatchResult>, "entityName" | "successItemDisplay" | "failedItemDisplay">,
) {
  const successItemDisplay = (item: BorrowBatchResult) => {
    // Handle both cases: data directly on item or nested
    const itemData = item as any;
    const itemName = itemData.itemName || itemData.item?.name || itemData.data?.itemName || "Item desconhecido";
    const userName = itemData.userName || itemData.user?.name || itemData.data?.userName || "Usuário desconhecido";
    const quantity = itemData.quantity || itemData.data?.quantity || 0;
    const returnDate = itemData.returnDate || itemData.data?.returnDate;

    return (
      <div className="flex-1">
        <p className="font-semibold text-base">{itemName}</p>
        <p className="text-sm text-muted-foreground mt-1">{userName}</p>
        <p className="text-sm text-muted-foreground">
          Quantidade: {quantity}
          {returnDate && (
            <span>
              {" "}
              <span className="font-enhanced-unicode">•</span> Devolução: {new Date(returnDate).toLocaleDateString("pt-BR")}
            </span>
          )}
        </p>
      </div>
    );
  };

  const failedItemDisplay = (error: BatchOperationError<BorrowBatchResult>) => {
    // Handle both cases: data in error.data or directly on error object
    const errorData = error as any;
    const item = error.data as BorrowBatchResult;

    // Check all possible locations for the names
    const itemName = item?.itemName || errorData.itemName || errorData.data?.itemName || item?.item?.name || "Item desconhecido";
    const userName = item?.userName || errorData.userName || errorData.data?.userName || item?.user?.name || "Usuário desconhecido";
    // const quantity = item?.quantity || errorData.data?.quantity || 0;

    // Parse error message for better formatting
    let errorDisplay;
    if (error.error.includes("Estoque insuficiente")) {
      // Parse the stock error message - try multiple patterns (now handling negative numbers)
      let mainMatch = error.error.match(/Disponível: (-?\d+), Solicitado: (-?\d+)/);

      // Try alternative patterns if the first doesn't match
      if (!mainMatch) {
        mainMatch = error.error.match(/Disponível: (-?\d+), Necessário: (-?\d+)/);
      }

      // If still no match, try to extract any numbers after specific keywords
      let available = null;
      let requested = null;

      if (!mainMatch) {
        const availableMatch = error.error.match(/[Dd]isponível:?\s*(-?\d+)/);
        const requestedMatch = error.error.match(/[Ss]olicitad[oa]:?\s*(-?\d+)/) || error.error.match(/[Nn]ecessári[oa]:?\s*(-?\d+)/);

        if (availableMatch) available = availableMatch[1];
        if (requestedMatch) requested = requestedMatch[1];
      } else {
        available = mainMatch[1];
        requested = mainMatch[2];
      }

      // Always show the parsed values if we have at least one
      if (available !== null || requested !== null) {
        errorDisplay = (
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">Quantidade insuficiente em estoque</p>
            <div className="text-sm space-y-1">
              <p>
                Disponível: <span className="font-semibold">{available !== null ? available : "0"}</span>
              </p>
              <p>
                Necessário: <span className="font-semibold">{requested !== null ? requested : "0"}</span>
              </p>
            </div>
          </div>
        );
      } else {
        // If we couldn't parse, try to split the message manually
        const parts = error.error.split(",").map((s) => s.trim());
        errorDisplay = (
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">Quantidade insuficiente em estoque</p>
            <div className="text-sm space-y-1">
              {parts.map((part, idx) => (
                <p key={idx}>{part}</p>
              ))}
            </div>
          </div>
        );
      }
    } else if (error.error.includes("já possui um empréstimo ativo")) {
      // Format active borrow error - simplified
      errorDisplay = (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">Empréstimo duplicado</p>
          <div className="text-sm">
            <p>O usuário já possui um empréstimo ativo deste item</p>
            <p className="text-muted-foreground mt-1">Devolva o empréstimo anterior antes de criar um novo</p>
          </div>
        </div>
      );
    } else if (error.error.includes("empréstimos ativos. Limite máximo")) {
      // Format max borrows error
      const match = error.error.match(/já possui (\d+) empréstimos ativos\. Limite máximo: (\d+)/);
      errorDisplay = (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">Limite de empréstimos excedido</p>
          {match && (
            <div className="text-sm space-y-1">
              <p>
                <span className="font-enhanced-unicode">•</span> Empréstimos ativos: <span className="font-semibold">{match[1]}</span>
              </p>
              <p>
                <span className="font-enhanced-unicode">•</span> Limite máximo: <span className="font-semibold">{match[2]}</span>
              </p>
            </div>
          )}
        </div>
      );
    } else {
      // Default error display with line breaks
      const errorLines = error.error.split("\n").filter((line) => line.trim());
      errorDisplay = (
        <div className="text-sm text-destructive space-y-1">
          {errorLines.map((line, idx) => (
            <p key={idx} className={cn(line.includes("•") && "ml-2")}>
              {line.trim()}
            </p>
          ))}
        </div>
      );
    }

    return (
      <div className="flex-1">
        <p className="font-semibold text-base">{itemName}</p>
        <p className="text-sm text-muted-foreground mt-1 mb-3">{userName}</p>
        {errorDisplay}
      </div>
    );
  };

  return <BatchOperationResultDialog {...props} entityName="empréstimo" successItemDisplay={successItemDisplay} failedItemDisplay={failedItemDisplay} />;
}

// Specialized version for External Withdrawals
interface ExternalWithdrawalBatchResult {
  withdrawerName?: string;
  itemName?: string;
  quantity?: number;
  unitPrice?: number;
  willReturn?: boolean;
  [key: string]: any;
}

export function ExternalWithdrawalBatchResultDialog(
  props: Omit<BatchOperationResultDialogProps<ExternalWithdrawalBatchResult, ExternalWithdrawalBatchResult>, "entityName" | "successItemDisplay" | "failedItemDisplay">,
) {
  const successItemDisplay = (item: ExternalWithdrawalBatchResult) => {
    // Handle both cases: data directly on item or nested
    const itemData = item as any;
    const itemName = itemData.itemName || itemData.item?.name || itemData.data?.itemName || "Item desconhecido";
    const withdrawerName = itemData.withdrawerName || itemData.data?.withdrawerName || "Retirador desconhecido";
    const quantity = itemData.quantity || itemData.data?.quantity || 0;
    const unitPrice = itemData.unitPrice || itemData.data?.unitPrice || 0;
    const willReturn = itemData.willReturn || itemData.data?.willReturn || false;

    return (
      <div className="flex-1">
        <p className="font-semibold text-base">{itemName}</p>
        <p className="text-sm text-muted-foreground mt-1">{withdrawerName}</p>
        <p className="text-sm text-muted-foreground">
          Quantidade: {quantity}
          {!willReturn && unitPrice > 0 && (
            <span>
              {" "}
              <span className="font-enhanced-unicode">•</span> Preço: R$ {unitPrice.toFixed(2)}
            </span>
          )}
          {willReturn ? (
            <span>
              {" "}
              <span className="font-enhanced-unicode">•</span> Será devolvido
            </span>
          ) : (
            <span>
              {" "}
              <span className="font-enhanced-unicode">•</span> Não será devolvido
            </span>
          )}
        </p>
      </div>
    );
  };

  const failedItemDisplay = (error: BatchOperationError<ExternalWithdrawalBatchResult>) => {
    // Handle both cases: data in error.data or directly on error object
    const errorData = error as any;
    const item = error.data as ExternalWithdrawalBatchResult;

    const itemName = errorData.itemName || item?.itemName || errorData.data?.itemName || "Item desconhecido";
    const withdrawerName = errorData.withdrawerName || item?.withdrawerName || errorData.data?.withdrawerName || "Retirador desconhecido";
    // const quantity = item?.quantity || errorData.data?.quantity || 0;

    // Parse error message for better formatting
    let errorDisplay;
    if (error.error.includes("Estoque insuficiente")) {
      // Parse the stock error message - try multiple patterns (now handling negative numbers)
      let mainMatch = error.error.match(/Disponível: (-?\d+), Solicitado: (-?\d+)/);

      // Try alternative patterns if the first doesn't match
      if (!mainMatch) {
        mainMatch = error.error.match(/Disponível: (-?\d+), Necessário: (-?\d+)/);
      }

      // If still no match, try to extract any numbers after specific keywords
      let available = null;
      let requested = null;

      if (!mainMatch) {
        const availableMatch = error.error.match(/[Dd]isponível:?\s*(-?\d+)/);
        const requestedMatch = error.error.match(/[Ss]olicitad[oa]:?\s*(-?\d+)/) || error.error.match(/[Nn]ecessári[oa]:?\s*(-?\d+)/);

        if (availableMatch) available = availableMatch[1];
        if (requestedMatch) requested = requestedMatch[1];
      } else {
        available = mainMatch[1];
        requested = mainMatch[2];
      }

      // Always show the parsed values if we have at least one
      if (available !== null || requested !== null) {
        errorDisplay = (
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">Quantidade insuficiente em estoque</p>
            <div className="text-sm space-y-1">
              <p>
                Disponível: <span className="font-semibold">{available !== null ? available : "0"}</span>
              </p>
              <p>
                Necessário: <span className="font-semibold">{requested !== null ? requested : "0"}</span>
              </p>
            </div>
          </div>
        );
      } else {
        // If we couldn't parse, try to split the message manually
        const parts = error.error.split(",").map((s) => s.trim());
        errorDisplay = (
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">Quantidade insuficiente em estoque</p>
            <div className="text-sm space-y-1">
              {parts.map((part, idx) => (
                <p key={idx}>{part}</p>
              ))}
            </div>
          </div>
        );
      }
    } else {
      // Default error display with line breaks
      const errorLines = error.error.split("\n").filter((line) => line.trim());
      errorDisplay = (
        <div className="text-sm text-destructive space-y-1">
          {errorLines.map((line, idx) => (
            <p key={idx} className={cn(line.includes("•") && "ml-2")}>
              {line.trim()}
            </p>
          ))}
        </div>
      );
    }

    return (
      <div className="flex-1">
        <p className="font-semibold text-base">{itemName}</p>
        <p className="text-sm text-muted-foreground mt-1 mb-3">{withdrawerName}</p>
        {errorDisplay}
      </div>
    );
  };

  return <BatchOperationResultDialog {...props} entityName="retirada externa" successItemDisplay={successItemDisplay} failedItemDisplay={failedItemDisplay} />;
}

// Specialized version for Customers
interface CustomerBatchResult {
  fantasyName?: string;
  corporateName?: string;
  cpf?: string;
  cnpj?: string;
  email?: string;
  [key: string]: any;
}

export function CustomerBatchResultDialog(
  props: Omit<BatchOperationResultDialogProps<CustomerBatchResult, CustomerBatchResult>, "entityName" | "successItemDisplay" | "failedItemDisplay">,
) {
  const successItemDisplay = (item: CustomerBatchResult) => {
    // Handle both cases: data directly on item or nested
    const itemData = item as any;
    const fantasyName = itemData.fantasyName || itemData.data?.fantasyName || "Cliente";
    const corporateName = itemData.corporateName || itemData.data?.corporateName;
    const cpf = itemData.cpf || itemData.data?.cpf;
    const cnpj = itemData.cnpj || itemData.data?.cnpj;
    const email = itemData.email || itemData.data?.email;

    // Format document display
    let documentDisplay = "";
    if (cpf) {
      documentDisplay = `CPF: ${cpf}`;
    } else if (cnpj) {
      documentDisplay = `CNPJ: ${cnpj}`;
    }

    return (
      <div className="flex-1">
        <p className="font-semibold text-base">{fantasyName}</p>
        {corporateName && corporateName !== fantasyName && <p className="text-sm text-muted-foreground">{corporateName}</p>}
        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
          {documentDisplay && <p>{documentDisplay}</p>}
          {email && <p>{email}</p>}
        </div>
      </div>
    );
  };

  const failedItemDisplay = (error: BatchOperationError<CustomerBatchResult>) => {
    // Handle both cases: data in error.data or directly on error object
    const errorData = error as any;
    const item = error.data as CustomerBatchResult;

    const fantasyName = errorData.fantasyName || item?.fantasyName || errorData.data?.fantasyName || "Cliente";
    const corporateName = errorData.corporateName || item?.corporateName || errorData.data?.corporateName;
    const cpf = errorData.cpf || item?.cpf || errorData.data?.cpf;
    const cnpj = errorData.cnpj || item?.cnpj || errorData.data?.cnpj;
    const email = errorData.email || item?.email || errorData.data?.email;

    // Format document display
    let documentDisplay = "";
    if (cpf) {
      documentDisplay = `CPF: ${cpf}`;
    } else if (cnpj) {
      documentDisplay = `CNPJ: ${cnpj}`;
    }

    // Parse error message for better formatting
    let errorDisplay;
    if (error.error.includes("CPF já está em uso") || error.error.includes("CNPJ já está em uso")) {
      // Handle duplicate document errors
      const documentType = error.error.includes("CPF") ? "CPF" : "CNPJ";
      errorDisplay = (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">Documento duplicado</p>
          <div className="text-sm">
            <p>O {documentType} informado já está cadastrado no sistema</p>
            <p className="text-muted-foreground mt-1">Verifique se o cliente já existe ou corrija o documento</p>
          </div>
        </div>
      );
    } else if (error.error.includes("Email já está em uso")) {
      // Handle duplicate email errors
      errorDisplay = (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">Email duplicado</p>
          <div className="text-sm">
            <p>O email informado já está cadastrado no sistema</p>
            <p className="text-muted-foreground mt-1">Verifique se o cliente já existe ou use um email diferente</p>
          </div>
        </div>
      );
    } else if (error.error.includes("Nome fantasia já está em uso")) {
      // Handle duplicate fantasy name errors
      errorDisplay = (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">Nome fantasia duplicado</p>
          <div className="text-sm">
            <p>O nome fantasia informado já está cadastrado no sistema</p>
            <p className="text-muted-foreground mt-1">Use um nome fantasia diferente para este cliente</p>
          </div>
        </div>
      );
    } else if (error.error.includes("CPF inválido") || error.error.includes("CNPJ inválido")) {
      // Handle invalid document errors
      const documentType = error.error.includes("CPF") ? "CPF" : "CNPJ";
      errorDisplay = (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">{documentType} inválido</p>
          <div className="text-sm">
            <p>O {documentType} informado não é válido</p>
            <p className="text-muted-foreground mt-1">Verifique o formato e os dígitos verificadores</p>
          </div>
        </div>
      );
    } else if (error.error.includes("Email inválido")) {
      // Handle invalid email errors
      errorDisplay = (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">Email inválido</p>
          <div className="text-sm">
            <p>O formato do email informado não é válido</p>
            <p className="text-muted-foreground mt-1">Verifique se o email está no formato correto (exemplo@dominio.com)</p>
          </div>
        </div>
      );
    } else {
      // Default error display with line breaks
      const errorLines = error.error.split("\n").filter((line) => line.trim());
      if (errorLines.length > 1) {
        errorDisplay = (
          <div className="text-sm text-destructive space-y-1">
            {errorLines.map((line, idx) => (
              <p key={idx} className={cn(line.includes("•") && "ml-2")}>
                {line.trim()}
              </p>
            ))}
          </div>
        );
      } else {
        // Split by periods for single line errors
        const errorParts = error.error.split(".").filter((part) => part.trim());
        errorDisplay = (
          <div className="text-sm text-destructive space-y-1">
            {errorParts.map((part, idx) => (
              <p key={idx}>{part.trim()}</p>
            ))}
          </div>
        );
      }
    }

    return (
      <div className="flex-1">
        <p className="font-semibold text-base">{fantasyName}</p>
        {corporateName && corporateName !== fantasyName && <p className="text-sm text-muted-foreground">{corporateName}</p>}
        <div className="text-sm text-muted-foreground mt-1 mb-3 space-y-0.5">
          {documentDisplay && <p>{documentDisplay}</p>}
          {email && <p>{email}</p>}
        </div>
        {errorDisplay}
      </div>
    );
  };

  return <BatchOperationResultDialog {...props} entityName="cliente" successItemDisplay={successItemDisplay} failedItemDisplay={failedItemDisplay} />;
}

// Specialized version for Users
interface UserBatchResult {
  name?: string;
  email?: string;
  cpf?: string;
  phone?: string;
  positionName?: string;
  sectorName?: string;
  [key: string]: any;
}

export function UserBatchResultDialog(props: Omit<BatchOperationResultDialogProps<UserBatchResult, UserBatchResult>, "entityName" | "successItemDisplay" | "failedItemDisplay">) {
  const successItemDisplay = (item: UserBatchResult) => {
    // Handle both cases: data directly on item or nested
    const itemData = item as any;
    const name = itemData.name || itemData.data?.name || "Colaborador";
    const email = itemData.email || itemData.data?.email;
    const cpf = itemData.cpf || itemData.data?.cpf;
    const phone = itemData.phone || itemData.data?.phone;
    const positionName = itemData.positionName || itemData.position?.name || itemData.data?.positionName;
    const sectorName = itemData.sectorName || itemData.sector?.name || itemData.data?.sectorName;

    return (
      <div className="flex-1">
        <p className="font-semibold text-base">{name}</p>
        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
          {email && <p>{email}</p>}
          {cpf && <p>CPF: {cpf}</p>}
          {phone && <p>Telefone: {phone}</p>}
          {positionName && <p>Cargo: {positionName}</p>}
          {sectorName && <p>Setor: {sectorName}</p>}
        </div>
      </div>
    );
  };

  const failedItemDisplay = (error: BatchOperationError<UserBatchResult>) => {
    // Handle both cases: data in error.data or directly on error object
    const errorData = error as any;
    const item = error.data as UserBatchResult;

    const name = errorData.name || item?.name || errorData.data?.name || "Colaborador";
    const email = errorData.email || item?.email || errorData.data?.email;
    const cpf = errorData.cpf || item?.cpf || errorData.data?.cpf;
    const phone = errorData.phone || item?.phone || errorData.data?.phone;
    const positionName = errorData.positionName || item?.positionName || errorData.data?.positionName;
    const sectorName = errorData.sectorName || item?.sectorName || errorData.data?.sectorName;

    // Parse error message for better formatting
    let errorDisplay;
    if (error.error.includes("CPF já está em uso")) {
      // Handle duplicate CPF errors
      errorDisplay = (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">CPF duplicado</p>
          <div className="text-sm">
            <p>O CPF informado já está cadastrado no sistema</p>
            <p className="text-muted-foreground mt-1">Verifique se o colaborador já existe ou corrija o CPF</p>
          </div>
        </div>
      );
    } else if (error.error.includes("Email já está em uso")) {
      // Handle duplicate email errors
      errorDisplay = (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">Email duplicado</p>
          <div className="text-sm">
            <p>O email informado já está cadastrado no sistema</p>
            <p className="text-muted-foreground mt-1">Verifique se o colaborador já existe ou use um email diferente</p>
          </div>
        </div>
      );
    } else if (error.error.includes("CPF inválido")) {
      // Handle invalid CPF errors
      errorDisplay = (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">CPF inválido</p>
          <div className="text-sm">
            <p>O CPF informado não é válido</p>
            <p className="text-muted-foreground mt-1">Verifique o formato e os dígitos verificadores</p>
          </div>
        </div>
      );
    } else if (error.error.includes("Email inválido")) {
      // Handle invalid email errors
      errorDisplay = (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">Email inválido</p>
          <div className="text-sm">
            <p>O formato do email informado não é válido</p>
            <p className="text-muted-foreground mt-1">Verifique se o email está no formato correto (exemplo@dominio.com)</p>
          </div>
        </div>
      );
    } else if (error.error.includes("Cargo não encontrado") || error.error.includes("Position not found")) {
      // Handle position not found errors
      errorDisplay = (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">Cargo inválido</p>
          <div className="text-sm">
            <p>O cargo informado não foi encontrado no sistema</p>
            <p className="text-muted-foreground mt-1">Selecione um cargo válido da lista</p>
          </div>
        </div>
      );
    } else if (error.error.includes("Setor não encontrado") || error.error.includes("Sector not found")) {
      // Handle sector not found errors
      errorDisplay = (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">Setor inválido</p>
          <div className="text-sm">
            <p>O setor informado não foi encontrado no sistema</p>
            <p className="text-muted-foreground mt-1">Selecione um setor válido da lista</p>
          </div>
        </div>
      );
    } else {
      // Default error display with line breaks
      const errorLines = error.error.split("\n").filter((line) => line.trim());
      if (errorLines.length > 1) {
        errorDisplay = (
          <div className="text-sm text-destructive space-y-1">
            {errorLines.map((line, idx) => (
              <p key={idx} className={cn(line.includes("•") && "ml-2")}>
                {line.trim()}
              </p>
            ))}
          </div>
        );
      } else {
        // Split by periods for single line errors
        const errorParts = error.error.split(".").filter((part) => part.trim());
        errorDisplay = (
          <div className="text-sm text-destructive space-y-1">
            {errorParts.map((part, idx) => (
              <p key={idx}>{part.trim()}</p>
            ))}
          </div>
        );
      }
    }

    return (
      <div className="flex-1">
        <p className="font-semibold text-base">{name}</p>
        <div className="text-sm text-muted-foreground mt-1 mb-3 space-y-0.5">
          {email && <p>{email}</p>}
          {cpf && <p>CPF: {cpf}</p>}
          {phone && <p>Telefone: {phone}</p>}
          {positionName && <p>Cargo: {positionName}</p>}
          {sectorName && <p>Setor: {sectorName}</p>}
        </div>
        {errorDisplay}
      </div>
    );
  };

  return <BatchOperationResultDialog {...props} entityName="colaborador" successItemDisplay={successItemDisplay} failedItemDisplay={failedItemDisplay} />;
}

// Specialized version for Suppliers
interface SupplierBatchResult {
  fantasyName?: string;
  corporateName?: string;
  cnpj?: string;
  email?: string;
  phones?: string[];
  city?: string;
  state?: string;
  [key: string]: any;
}

export function SupplierBatchResultDialog(
  props: Omit<BatchOperationResultDialogProps<SupplierBatchResult, SupplierBatchResult>, "entityName" | "successItemDisplay" | "failedItemDisplay">,
) {
  const successItemDisplay = (item: SupplierBatchResult) => {
    // Handle both cases: data directly on item or nested
    const itemData = item as any;
    const fantasyName = itemData.fantasyName || itemData.data?.fantasyName || "Fornecedor";
    const corporateName = itemData.corporateName || itemData.data?.corporateName;
    const cnpj = itemData.cnpj || itemData.data?.cnpj;
    const email = itemData.email || itemData.data?.email;
    const city = itemData.city || itemData.data?.city;
    const state = itemData.state || itemData.data?.state;

    return (
      <div className="flex-1">
        <p className="font-semibold text-base">{fantasyName}</p>
        {corporateName && corporateName !== fantasyName && <p className="text-sm text-muted-foreground">{corporateName}</p>}
        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
          {cnpj && <p>CNPJ: {cnpj}</p>}
          {email && <p>{email}</p>}
          {city && state && (
            <p>
              {city}/{state}
            </p>
          )}
        </div>
      </div>
    );
  };

  const failedItemDisplay = (error: BatchOperationError<SupplierBatchResult>) => {
    // Handle both cases: data in error.data or directly on error object
    const errorData = error as any;
    const item = error.data as SupplierBatchResult;

    const fantasyName = errorData.fantasyName || item?.fantasyName || errorData.data?.fantasyName || "Fornecedor";
    const corporateName = errorData.corporateName || item?.corporateName || errorData.data?.corporateName;
    const cnpj = errorData.cnpj || item?.cnpj || errorData.data?.cnpj;
    const email = errorData.email || item?.email || errorData.data?.email;
    const city = errorData.city || item?.city || errorData.data?.city;
    const state = errorData.state || item?.state || errorData.data?.state;

    // Parse error message for better formatting
    let errorDisplay;
    if (error.error.includes("CNPJ já está em uso")) {
      // Handle duplicate CNPJ errors
      errorDisplay = (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">CNPJ duplicado</p>
          <div className="text-sm">
            <p>O CNPJ informado já está cadastrado no sistema</p>
            <p className="text-muted-foreground mt-1">Verifique se o fornecedor já existe ou corrija o documento</p>
          </div>
        </div>
      );
    } else if (error.error.includes("Email já está em uso")) {
      // Handle duplicate email errors
      errorDisplay = (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">Email duplicado</p>
          <div className="text-sm">
            <p>O email informado já está cadastrado no sistema</p>
            <p className="text-muted-foreground mt-1">Verifique se o fornecedor já existe ou use um email diferente</p>
          </div>
        </div>
      );
    } else if (error.error.includes("Nome fantasia já está em uso")) {
      // Handle duplicate fantasy name errors
      errorDisplay = (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">Nome fantasia duplicado</p>
          <div className="text-sm">
            <p>O nome fantasia informado já está cadastrado no sistema</p>
            <p className="text-muted-foreground mt-1">Use um nome fantasia diferente para este fornecedor</p>
          </div>
        </div>
      );
    } else if (error.error.includes("CNPJ inválido")) {
      // Handle invalid CNPJ errors
      errorDisplay = (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">CNPJ inválido</p>
          <div className="text-sm">
            <p>O CNPJ informado não é válido</p>
            <p className="text-muted-foreground mt-1">Verifique o formato e os dígitos verificadores</p>
          </div>
        </div>
      );
    } else if (error.error.includes("Email inválido")) {
      // Handle invalid email errors
      errorDisplay = (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">Email inválido</p>
          <div className="text-sm">
            <p>O formato do email informado não é válido</p>
            <p className="text-muted-foreground mt-1">Verifique se o email está no formato correto (exemplo@dominio.com)</p>
          </div>
        </div>
      );
    } else {
      // Default error display with line breaks
      const errorLines = error.error.split("\n").filter((line) => line.trim());
      if (errorLines.length > 1) {
        errorDisplay = (
          <div className="text-sm text-destructive space-y-1">
            {errorLines.map((line, idx) => (
              <p key={idx} className={cn(line.includes("•") && "ml-2")}>
                {line.trim()}
              </p>
            ))}
          </div>
        );
      } else {
        // Split by periods for single line errors
        const errorParts = error.error.split(".").filter((part) => part.trim());
        errorDisplay = (
          <div className="text-sm text-destructive space-y-1">
            {errorParts.map((part, idx) => (
              <p key={idx}>{part.trim()}</p>
            ))}
          </div>
        );
      }
    }

    return (
      <div className="flex-1">
        <p className="font-semibold text-base">{fantasyName}</p>
        {corporateName && corporateName !== fantasyName && <p className="text-sm text-muted-foreground">{corporateName}</p>}
        <div className="text-sm text-muted-foreground mt-1 mb-3 space-y-0.5">
          {cnpj && <p>CNPJ: {cnpj}</p>}
          {email && <p>{email}</p>}
          {city && state && (
            <p>
              {city}/{state}
            </p>
          )}
        </div>
        {errorDisplay}
      </div>
    );
  };

  return <BatchOperationResultDialog {...props} entityName="fornecedor" successItemDisplay={successItemDisplay} failedItemDisplay={failedItemDisplay} />;
}
