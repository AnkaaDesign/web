import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconFileText, IconFileTypePdf, IconReceipt, IconCurrencyReal, IconFileInvoice } from "@tabler/icons-react";
import type { Order } from "../../../../types";
import type { File as AnkaaFile } from "../../../../types";
import { cn } from "@/lib/utils";
import { FileItem } from "@/components/file";
import { useFileViewer } from "@/components/file/file-viewer";

interface OrderDocumentsCardProps {
  order: Order;
  className?: string;
}

export function OrderDocumentsCard({
  order,
  className,
}: OrderDocumentsCardProps) {
  // Try to get file viewer context (optional)
  let fileViewerContext: ReturnType<typeof useFileViewer> | null = null;
  try {
    fileViewerContext = useFileViewer();
  } catch {
    // Context not available
  }

  const budgets = order.budgets || [];
  const invoices = order.invoices || [];
  const receipts = order.receipts || [];
  const reimbursements = order.reimbursements || [];
  const invoiceReimbursements = order.invoiceReimbursements || [];

  const allDocuments = [...budgets, ...invoices, ...receipts, ...reimbursements, ...invoiceReimbursements];
  const hasDocuments = allDocuments.length > 0;

  const handlePreview = (file: AnkaaFile) => {
    if (fileViewerContext) {
      fileViewerContext.actions.viewFile(file);
    }
  };

  const handleDownload = (file: AnkaaFile) => {
    if (fileViewerContext) {
      fileViewerContext.actions.downloadFile(file);
    }
  };

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconFileText className="h-5 w-5 text-primary" />
          </div>
          Documentos
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {hasDocuments ? (
            <>
              {/* Budgets/Orçamentos Section */}
              {budgets.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
                    <IconCurrencyReal className="h-5 w-5 text-green-500" />
                    Orçamentos
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {budgets.map((file) => (
                      <FileItem
                        key={file.id}
                        file={file}
                        viewMode="list"
                        onPreview={handlePreview}
                        onDownload={handleDownload}
                        showActions
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Invoices/Notas Fiscais Section */}
              {invoices.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
                    <IconFileInvoice className="h-5 w-5 text-blue-500" />
                    Notas Fiscais
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {invoices.map((file) => (
                      <FileItem
                        key={file.id}
                        file={file}
                        viewMode="list"
                        onPreview={handlePreview}
                        onDownload={handleDownload}
                        showActions
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Receipts/Comprovantes Section */}
              {receipts.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
                    <IconReceipt className="h-5 w-5 text-purple-500" />
                    Comprovantes
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {receipts.map((file) => (
                      <FileItem
                        key={file.id}
                        file={file}
                        viewMode="list"
                        onPreview={handlePreview}
                        onDownload={handleDownload}
                        showActions
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Reimbursements Section */}
              {reimbursements.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
                    <IconCurrencyReal className="h-5 w-5 text-orange-500" />
                    Reembolsos
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {reimbursements.map((file) => (
                      <FileItem
                        key={file.id}
                        file={file}
                        viewMode="list"
                        onPreview={handlePreview}
                        onDownload={handleDownload}
                        showActions
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Invoice Reimbursements Section */}
              {invoiceReimbursements.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold mb-4 text-foreground flex items-center gap-2">
                    <IconFileTypePdf className="h-5 w-5 text-red-500" />
                    NFEs de Reembolso
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {invoiceReimbursements.map((file) => (
                      <FileItem
                        key={file.id}
                        file={file}
                        viewMode="list"
                        onPreview={handlePreview}
                        onDownload={handleDownload}
                        showActions
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <IconFileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhum documento cadastrado</h3>
              <p className="text-sm text-muted-foreground">Este pedido não possui documentos anexados.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
