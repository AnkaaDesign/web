import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  IconCurrencyDollar,
  IconChevronDown,
  IconChevronRight,
  IconReceipt,
  IconFileInvoice,
  IconDownload,
  IconLoader2,
} from '@tabler/icons-react';
import { formatCurrency, formatDate } from '@/utils';
import { useInvoicesByTask } from '@/hooks/production/use-invoice';
import { InvoiceStatusBadge } from './invoice-status-badge';
import { InstallmentStatusBadge } from './installment-status-badge';
import { BankSlipStatusBadge } from './bank-slip-status-badge';
import { BoletoActions } from './boleto-actions';
import { NfseStatusBadge } from './nfse-status-badge';
import { NfseActions } from './nfse-actions';
import { NfseEnrichedInfo } from './nfse-enriched-info';
import { nfseService } from '@/api-client/nfse';
import { FileItem, useFileViewer } from '@/components/common/file';
import { invoiceService } from '@/api-client/invoice';
import { toast } from '@/components/ui/sonner';
import type { Invoice } from '@/types/invoice';
import type { File as CustomFile } from '@/types/file';

interface InvoiceListCardProps {
  taskId: string;
}

export function InvoiceListCard({ taskId }: InvoiceListCardProps) {
  const { data: response, isLoading } = useInvoicesByTask(taskId);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const handleDownloadAllBoletos = async (installments: any[]) => {
    const downloadable = installments.filter(
      (inst) => inst.bankSlip && (inst.bankSlip.status === 'ACTIVE' || inst.bankSlip.status === 'OVERDUE'),
    );
    if (downloadable.length === 0) {
      toast.error('Nenhum boleto disponível para download.');
      return;
    }
    setIsDownloadingAll(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (const inst of downloadable) {
        const res = await invoiceService.getBoletoPdf(inst.id);
        const blob = res.data instanceof Blob
          ? res.data
          : new Blob([res.data], { type: 'application/pdf' });
        zip.file(`boleto-parcela-${inst.number}.pdf`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `boletos.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${downloadable.length} boleto(s) baixado(s) com sucesso.`);
    } catch {
      toast.error('Erro ao baixar boletos.');
    } finally {
      setIsDownloadingAll(false);
    }
  };

  // Try to get file viewer context for PDF preview/download
  let fileViewerContext: ReturnType<typeof useFileViewer> | null = null;
  try {
    fileViewerContext = useFileViewer();
  } catch {
    // Context not available
  }

  const invoices: Invoice[] = Array.isArray(response?.data) ? response.data : (response?.data ? [response.data] : []);

  const toggleExpanded = (id: string) => {
    setExpandedInvoiceId(expandedInvoiceId === id ? null : id);
  };

  const handleFileDownload = (file: CustomFile) => {
    if (fileViewerContext) {
      fileViewerContext.actions.downloadFile(file);
    }
  };

  // Collect all PDF files from invoices for the file viewer
  const getAllPdfFiles = (): CustomFile[] => {
    const files: CustomFile[] = [];
    for (const invoice of invoices) {
      for (const inst of invoice.installments || []) {
        if (inst.bankSlip?.pdfFile) {
          files.push(inst.bankSlip.pdfFile as unknown as CustomFile);
        }
      }
    }
    return files;
  };

  const handlePdfPreviewInCollection = (file: CustomFile) => {
    if (!fileViewerContext) return;
    const allFiles = getAllPdfFiles();
    const index = allFiles.findIndex(f => f.id === file.id);
    if (index >= 0) {
      fileViewerContext.actions.viewFiles(allFiles, index);
    } else {
      fileViewerContext.actions.viewFile(file);
    }
  };

  // Compute summary totals
  const totalAmount = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
  const totalPending = totalAmount - totalPaid;

  return (
    <>
      <Card className="shadow-sm border border-border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <IconCurrencyDollar className="h-5 w-5 text-muted-foreground" />
            Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Carregando dados financeiros...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <IconCurrencyDollar className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhum dado financeiro</h3>
              <p className="text-sm text-muted-foreground">
                Os dados financeiros serao gerados automaticamente apos a aprovacao do orcamento
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Bar */}
              {invoices.length > 0 && (
                <div className="grid grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase font-medium">Total</p>
                    <p className="text-sm font-bold">{formatCurrency(totalAmount)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase font-medium">Pago</p>
                    <p className="text-sm font-bold text-green-700">{formatCurrency(totalPaid)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase font-medium">Pendente</p>
                    <p className="text-sm font-bold text-amber-600">{formatCurrency(totalPending)}</p>
                  </div>
                </div>
              )}

              {/* Invoice List */}
              {invoices.map((invoice) => {
                const isExpanded = expandedInvoiceId === invoice.id;
                const installments = invoice.installments
                  ? [...invoice.installments].sort((a, b) => a.number - b.number)
                  : [];

                return (
                  <div
                    key={invoice.id}
                    className="border border-border rounded-lg overflow-hidden"
                  >
                    {/* Invoice Header */}
                    <div
                      className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => toggleExpanded(invoice.id)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {isExpanded ? (
                          <IconChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <IconChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">
                              {invoice.customer?.fantasyName || 'Cliente'}
                            </span>
                            <InvoiceStatusBadge status={invoice.status} size="sm" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {installments.length} parcela{installments.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(invoice.totalAmount)}</p>
                          {invoice.paidAmount > 0 && (
                            <p className="text-xs text-green-700">
                              Pago: {formatCurrency(invoice.paidAmount)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-border">
                        {/* Boletos Section */}
                        {installments.length > 0 && (
                          <div className="bg-muted/10">
                            <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
                              <div className="flex items-center gap-2">
                                <IconReceipt className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  Boletos
                                </span>
                              </div>
                              {installments.some((inst) => inst.bankSlip && (inst.bankSlip.status === 'ACTIVE' || inst.bankSlip.status === 'OVERDUE')) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDownloadAllBoletos(installments)}
                                  disabled={isDownloadingAll}
                                  title="Baixar todos os boletos"
                                  className="h-7 px-2 text-xs gap-1"
                                >
                                  {isDownloadingAll ? (
                                    <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <IconDownload className="h-3.5 w-3.5" />
                                  )}
                                  Baixar todos
                                </Button>
                              )}
                            </div>
                            <div className="divide-y divide-border">
                              {installments.map((installment) => {
                                const boletoPdfFile = installment.bankSlip?.pdfFile;
                                return (
                                  <div key={installment.id} className="px-4 py-2.5 hover:bg-muted/40 transition-colors">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <span className="text-sm font-medium text-muted-foreground w-8">
                                          #{installment.number}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                          {formatDate(installment.dueDate)}
                                        </span>
                                        <span className="text-sm font-medium">
                                          {formatCurrency(installment.amount)}
                                        </span>
                                        <InstallmentStatusBadge status={installment.status} size="sm" />
                                        {installment.bankSlip && (
                                          <BankSlipStatusBadge status={installment.bankSlip.status} size="sm" />
                                        )}
                                      </div>
                                      <BoletoActions
                                        installmentId={installment.id}
                                        bankSlip={installment.bankSlip}
                                        installmentStatus={installment.status}
                                        installmentPaymentMethod={installment.paymentMethod}
                                        receiptFile={installment.receiptFile}
                                      />
                                    </div>
                                    {boletoPdfFile && (
                                      <div className="mt-2">
                                        <FileItem
                                          file={boletoPdfFile as unknown as CustomFile}
                                          viewMode="list"
                                          onPreview={handlePdfPreviewInCollection}
                                          onDownload={handleFileDownload}
                                          showActions
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* NFS-e Section */}
                        <div className="bg-muted/10">
                          <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b border-border">
                            <IconFileInvoice className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              NFS-e
                            </span>
                          </div>
                          <div className="px-4 py-2.5">
                            {(() => {
                              const nfseDocuments = invoice.nfseDocuments ?? [];
                              const activeNfse = nfseDocuments.find((d) => d.status === 'AUTHORIZED') ?? nfseDocuments[nfseDocuments.length - 1] ?? null;
                              return (
                                <div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      {activeNfse ? (
                                        <NfseStatusBadge status={activeNfse.status} size="sm" />
                                      ) : (
                                        <span className="text-sm text-muted-foreground">Nao emitida</span>
                                      )}
                                      {nfseDocuments.length > 1 && (
                                        <span className="text-xs text-muted-foreground">
                                          ({nfseDocuments.length} emissoes)
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {activeNfse?.elotechNfseId && (
                                        <NfseDownloadButton elotechNfseId={activeNfse.elotechNfseId} />
                                      )}
                                      <NfseActions invoiceId={invoice.id} nfseDocuments={nfseDocuments} />
                                    </div>
                                  </div>
                                  {activeNfse?.elotechNfseId && (
                                    <NfseEnrichedInfo elotechNfseId={activeNfse.elotechNfseId} />
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

    </>
  );
}

function NfseDownloadButton({ elotechNfseId }: { elotechNfseId: number }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloading(true);
    try {
      const res = await nfseService.getPdf(elotechNfseId);
      const blob = res.data instanceof Blob
        ? res.data
        : new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      toast.error('Erro ao baixar PDF da NFS-e.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDownload}
      disabled={isDownloading}
      title="Ver NFS-e PDF"
      className="h-7 w-7 p-0"
    >
      {isDownloading ? (
        <IconLoader2 className="h-4 w-4 animate-spin" />
      ) : (
        <IconDownload className="h-4 w-4" />
      )}
    </Button>
  );
}
