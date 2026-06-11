import { useState } from "react";
import {
  IconCopy,
  IconCurrencyReal,
  IconExternalLink,
  IconFileInvoice,
  IconLoader2,
  IconReceipt,
  IconRefresh,
  IconUser,
} from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { InstallmentStatusBadge } from "@/components/production/task/billing/installment-status-badge";
import { BankSlipStatusBadge } from "@/components/production/task/billing/bank-slip-status-badge";
import { NfseStatusBadge } from "@/components/production/task/billing/nfse-status-badge";
import { InvoiceStatusBadge } from "@/components/production/task/billing/invoice-status-badge";
import { useAuth } from "@/contexts/auth-context";
import { useGenerateExternalOperationBilling, useCanViewPrices } from "../../../../hooks";
import { EXTERNAL_OPERATION_STATUS, EXTERNAL_OPERATION_TYPE, SECTOR_PRIVILEGES } from "../../../../constants";
import { formatCurrency, formatDate, formatDateTime } from "../../../../utils";
import { getFileUrl } from "@/utils/file";
import type { ExternalOperation } from "../../../../types";
import type { Installment } from "@/types/invoice";
import { cn } from "@/lib/utils";

interface ExternalOperationBillingCardProps {
  withdrawal: ExternalOperation;
  className?: string;
  onUpdate?: () => void;
}

/** Humanize the payment condition for display */
function formatPaymentCondition(withdrawal: ExternalOperation): string {
  const config = withdrawal.paymentConfig as Record<string, any> | null | undefined;
  if (config?.type === "CASH") {
    if (config.specificDate) return `À vista (${config.specificDate.split("-").reverse().join("/")})`;
    return `À vista${config.cashDays ? ` (${config.cashDays} dias)` : ""}`;
  }
  if (config?.type === "INSTALLMENTS") {
    const parts: string[] = [];
    if (config.entryDays) parts.push(`entrada ${config.entryDays} dias`);
    if (config.installmentStep) parts.push(`intervalo ${config.installmentStep} dias`);
    return `Parcelado ${config.installmentCount || "?"}x${parts.length > 0 ? ` (${parts.join(", ")})` : ""}`;
  }
  return withdrawal.paymentCondition || "Não definida";
}

export function ExternalOperationBillingCard({ withdrawal, className, onUpdate }: ExternalOperationBillingCardProps) {
  const { user } = useAuth();
  const canViewPrices = useCanViewPrices();
  const generateBilling = useGenerateExternalOperationBilling();
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);

  if (withdrawal.type !== EXTERNAL_OPERATION_TYPE.CHARGEABLE) return null;

  const invoice = withdrawal.billingInvoice && withdrawal.billingInvoice.status !== "CANCELLED" ? withdrawal.billingInvoice : null;
  const installments: Installment[] = invoice?.installments ? [...invoice.installments].sort((a, b) => a.number - b.number) : [];
  const nfseDocuments = invoice?.nfseDocuments ?? [];
  const activeNfse = nfseDocuments.find((d) => d.status === "AUTHORIZED") ?? nfseDocuments[nfseDocuments.length - 1] ?? null;

  // "Gerar Faturamento": CHARGED + billing configured + no active invoice + ADMIN/FINANCIAL
  const userRole = user?.sector?.privileges || "";
  const canTriggerBilling = [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL].includes(userRole as SECTOR_PRIVILEGES);
  const billingConfigured = !!withdrawal.customerId && (withdrawal.generateInvoice !== false || withdrawal.generateBankSlip !== false);
  const showGenerateButton = canTriggerBilling && withdrawal.status === EXTERNAL_OPERATION_STATUS.CHARGED && billingConfigured && !invoice;

  const handleGenerateBilling = async () => {
    try {
      await generateBilling.mutateAsync({ id: withdrawal.id });
      setShowGenerateDialog(false);
      onUpdate?.();
    } catch {
      // Error toast is emitted by the axios error interceptor.
    }
  };

  const copyToClipboard = async (value: string | null | undefined, label: string) => {
    if (!value) {
      toast.error(`${label} indisponível.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiada.`);
    } catch {
      toast.error(`Não foi possível copiar a ${label.toLowerCase()}.`);
    }
  };

  return (
    <>
      <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
        <CardHeader className="pb-6">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <IconCurrencyReal className="h-5 w-5 text-muted-foreground" />
              Faturamento
            </CardTitle>
            <div className="flex items-center gap-2">
              {invoice && <InvoiceStatusBadge status={invoice.status} />}
              {showGenerateButton && (
                <Button variant="default" size="sm" onClick={() => setShowGenerateDialog(true)} disabled={generateBilling.isPending}>
                  {generateBilling.isPending ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconRefresh className="h-4 w-4 mr-2" />}
                  Gerar Faturamento
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 flex-1 space-y-6">
          {/* Billing configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <IconUser className="h-4 w-4" />
                Cliente
              </span>
              <span className="text-sm font-semibold text-foreground">{withdrawal.customer?.fantasyName || "Não informado"}</span>
            </div>
            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground">Condição de Pagamento</span>
              <span className="text-sm font-semibold text-foreground">{formatPaymentCondition(withdrawal)}</span>
            </div>
            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <IconFileInvoice className="h-4 w-4" />
                Emitir NFS-e
              </span>
              <span className="text-sm font-semibold text-foreground">{withdrawal.generateInvoice === false ? "Não" : "Sim"}</span>
            </div>
            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <IconReceipt className="h-4 w-4" />
                Gerar Boleto
              </span>
              <span className="text-sm font-semibold text-foreground">{withdrawal.generateBankSlip === false ? "Não" : "Sim"}</span>
            </div>
            {withdrawal.billedAt && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3 sm:col-span-2">
                <span className="text-sm font-medium text-muted-foreground">Faturado em</span>
                <span className="text-sm font-semibold text-foreground">{formatDateTime(withdrawal.billedAt)}</span>
              </div>
            )}
          </div>

          {/* NFS-e */}
          {withdrawal.generateInvoice !== false && (
            <div className="pt-6 border-t border-border">
              <h3 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
                <IconFileInvoice className="h-4 w-4 text-muted-foreground" />
                NFS-e
              </h3>
              <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-4 py-3">
                {activeNfse ? (
                  <>
                    <NfseStatusBadge status={activeNfse.status} size="sm" />
                    {activeNfse.nfseNumber && <span className="text-sm font-semibold text-foreground">Nº {activeNfse.nfseNumber}</span>}
                    {activeNfse.errorMessage && activeNfse.status === "ERROR" && (
                      <span className="text-xs text-destructive truncate" title={activeNfse.errorMessage}>
                        {activeNfse.errorMessage}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">Não emitida</span>
                )}
              </div>
            </div>
          )}

          {/* Installments */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
              <IconReceipt className="h-4 w-4 text-muted-foreground" />
              Parcelas
            </h3>
            {installments.length === 0 ? (
              <div className="flex items-center gap-2 text-muted-foreground bg-muted/30 rounded-lg p-4">
                <IconReceipt className="h-4 w-4" />
                <p className="text-sm">
                  {withdrawal.status === EXTERNAL_OPERATION_STATUS.PENDING
                    ? 'As parcelas serão geradas quando a operação for marcada como "Cobrada".'
                    : "Nenhuma parcela gerada."}
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden dark:border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-16">Nº</TableHead>
                      <TableHead>Vencimento</TableHead>
                      {canViewPrices && <TableHead className="text-right">Valor</TableHead>}
                      <TableHead>Status</TableHead>
                      <TableHead>Boleto</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {installments.map((installment) => {
                      const bankSlip = installment.bankSlip;
                      const canCopy = !!bankSlip && (bankSlip.status === "ACTIVE" || bankSlip.status === "OVERDUE");
                      return (
                        <TableRow key={installment.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium text-muted-foreground">#{installment.number}</TableCell>
                          <TableCell className="text-sm">{formatDate(installment.dueDate)}</TableCell>
                          {canViewPrices && <TableCell className="text-right text-sm font-medium">{formatCurrency(installment.amount)}</TableCell>}
                          <TableCell>
                            <InstallmentStatusBadge status={installment.status} size="sm" paymentMethod={installment.paymentMethod} />
                          </TableCell>
                          <TableCell>{bankSlip ? <BankSlipStatusBadge status={bankSlip.status} size="sm" /> : <span className="text-sm text-muted-foreground">-</span>}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {canCopy && bankSlip?.digitableLine && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(bankSlip.digitableLine, "Linha digitável")}
                                  title="Copiar linha digitável"
                                  className="h-7 w-7 p-0"
                                >
                                  <IconCopy className="h-4 w-4" />
                                </Button>
                              )}
                              {canCopy && bankSlip?.pixQrCode && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(bankSlip.pixQrCode, "Chave PIX copia e cola")}
                                  title="Copiar PIX copia e cola"
                                  className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                                >
                                  <IconCurrencyReal className="h-4 w-4" />
                                </Button>
                              )}
                              {bankSlip?.pdfFileId && (
                                <Button variant="ghost" size="sm" title="Abrir PDF do boleto" className="h-7 w-7 p-0" asChild>
                                  <a href={getFileUrl({ id: bankSlip.pdfFileId } as any)} target="_blank" rel="noopener noreferrer">
                                    <IconExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generate Billing Confirmation */}
      <AlertDialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar Faturamento</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Os documentos de cobrança configurados serão gerados para esta operação externa:
                {withdrawal.generateInvoice !== false && " NFS-e (Elotech)"}
                {withdrawal.generateInvoice !== false && withdrawal.generateBankSlip !== false && " e"}
                {withdrawal.generateBankSlip !== false && " boletos (Sicredi)"}.
              </p>
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Cliente:</span> {withdrawal.customer?.fantasyName || "Não informado"}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Condição de Pagamento:</span> {formatPaymentCondition(withdrawal)}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={generateBilling.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerateBilling} disabled={generateBilling.isPending}>
              {generateBilling.isPending ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                "Confirmar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
