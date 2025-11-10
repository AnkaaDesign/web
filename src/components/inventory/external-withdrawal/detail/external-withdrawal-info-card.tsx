import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconPackage, IconUser, IconCalendar, IconCalendarCheck, IconCurrencyReal, IconFileText, IconNotes, IconHash, IconArrowBack, IconFileInvoice, IconReceipt, IconLayoutGrid, IconList } from "@tabler/icons-react";
import type { ExternalWithdrawal } from "../../../../types";
import { EXTERNAL_WITHDRAWAL_STATUS, EXTERNAL_WITHDRAWAL_TYPE, EXTERNAL_WITHDRAWAL_TYPE_LABELS } from "../../../../constants";
import { formatDateTime } from "../../../../utils";
import { ExternalWithdrawalStatusBadge } from "../common/external-withdrawal-status-badge";
import { cn } from "@/lib/utils";
import { FileItem, type FileViewMode } from "@/components/common/file";

interface ExternalWithdrawalInfoCardProps {
  withdrawal: ExternalWithdrawal;
  className?: string;
}

export function ExternalWithdrawalInfoCard({ withdrawal, className }: ExternalWithdrawalInfoCardProps) {
  const [viewMode, setViewMode] = useState<FileViewMode>("list");

  const isFullyReturned = withdrawal.status === EXTERNAL_WITHDRAWAL_STATUS.FULLY_RETURNED;
  const isCharged = withdrawal.status === EXTERNAL_WITHDRAWAL_STATUS.CHARGED;
  const isCancelled = withdrawal.status === EXTERNAL_WITHDRAWAL_STATUS.CANCELLED;

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <IconPackage className="h-5 w-5 text-primary" />
            </div>
            Informações da Retirada Externa
          </CardTitle>
          <ExternalWithdrawalStatusBadge status={withdrawal.status} />
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Withdrawer Information Section */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Informações do Retirador</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconUser className="h-4 w-4" />
                  Nome
                </span>
                <span className="text-sm font-semibold text-foreground">{withdrawal.withdrawerName}</span>
              </div>
            </div>
          </div>

          {/* Withdrawal Details Section */}
          <div className="pt-6 border-t border-border/50">
            <h3 className="text-base font-semibold mb-4 text-foreground">Detalhes da Retirada</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconArrowBack className="h-4 w-4" />
                  Tipo de Retirada
                </span>
                <Badge variant={withdrawal.type === EXTERNAL_WITHDRAWAL_TYPE.RETURNABLE ? "default" : withdrawal.type === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE ? "destructive" : "secondary"}>
                  {EXTERNAL_WITHDRAWAL_TYPE_LABELS[withdrawal.type]}
                </Badge>
              </div>

              {withdrawal.type === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCurrencyReal className="h-4 w-4" />
                    Valor Total
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    R${" "}
                    {(() => {
                      const total = withdrawal.items?.reduce((sum, item) => sum + item.withdrawedQuantity * (item.price || 0), 0) || 0;
                      return total.toFixed(2).replace(".", ",");
                    })()}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCalendar className="h-4 w-4" />
                  Data da Retirada
                </span>
                <span className="text-sm font-semibold text-foreground">{formatDateTime(withdrawal.createdAt)}</span>
              </div>

              {withdrawal.items && withdrawal.items.length > 0 && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconHash className="h-4 w-4" />
                    Quantidade de Itens
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {withdrawal.items.length} {withdrawal.items.length === 1 ? "item" : "itens"}
                  </span>
                </div>
              )}

              {withdrawal.notes && (
                <div className="bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
                    <IconNotes className="h-4 w-4" />
                    Observações
                  </span>
                  <p className="text-sm text-foreground leading-relaxed">{withdrawal.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Status Specific Information */}
          {(isFullyReturned || isCharged || isCancelled) && (
            <div className="pt-6 border-t border-border/50">
              <h3 className="text-base font-semibold mb-4 text-foreground">Status Atual</h3>
              <div className="space-y-4">
                {isFullyReturned && (
                  <div className="flex justify-between items-center bg-green-50/50 dark:bg-green-900/20 rounded-lg px-4 py-3 border border-green-200/40 dark:border-green-700/40">
                    <span className="text-sm font-medium text-green-700 dark:text-green-300 flex items-center gap-2">
                      <IconCalendarCheck className="h-4 w-4" />
                      Status
                    </span>
                    <span className="text-sm font-semibold text-green-800 dark:text-green-200">Itens totalmente devolvidos</span>
                  </div>
                )}

                {isCharged && (
                  <div className="flex justify-between items-center bg-purple-50/50 dark:bg-purple-900/20 rounded-lg px-4 py-3 border border-purple-200/40 dark:border-purple-700/40">
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-300 flex items-center gap-2">
                      <IconCurrencyReal className="h-4 w-4" />
                      Status
                    </span>
                    <span className="text-sm font-semibold text-purple-800 dark:text-purple-200">Valor cobrado do responsável</span>
                  </div>
                )}

                {isCancelled && (
                  <div className="flex justify-between items-center bg-red-50/50 dark:bg-red-900/20 rounded-lg px-4 py-3 border border-red-200/40 dark:border-red-700/40">
                    <span className="text-sm font-medium text-red-700 dark:text-red-300 flex items-center gap-2">
                      <IconCalendarCheck className="h-4 w-4" />
                      Status
                    </span>
                    <span className="text-sm font-semibold text-red-800 dark:text-red-200">Retirada cancelada</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* File Attachments Section */}
          {(withdrawal.nfe || withdrawal.receipt) && (
            <div className="pt-6 border-t border-border/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-foreground">Documentos Anexados</h3>
                <div className="flex gap-1">
                  <Button
                    variant={viewMode === "list" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="h-7 w-7 p-0"
                  >
                    <IconList className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={viewMode === "grid" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="h-7 w-7 p-0"
                  >
                    <IconLayoutGrid className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-6">
                {withdrawal.nfe && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <IconFileInvoice className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-semibold">Nota Fiscal</h4>
                    </div>
                    <div className={cn(viewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
                      <FileItem
                        file={withdrawal.nfe}
                        viewMode={viewMode}
                      />
                    </div>
                  </div>
                )}

                {withdrawal.receipt && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <IconReceipt className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-semibold">Recibo</h4>
                    </div>
                    <div className={cn(viewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
                      <FileItem
                        file={withdrawal.receipt}
                        viewMode={viewMode}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
