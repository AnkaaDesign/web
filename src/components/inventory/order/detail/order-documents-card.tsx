import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconFileText, IconFileTypePdf, IconReceipt, IconCurrencyReal, IconFileInvoice, IconLayoutGrid, IconList } from "@tabler/icons-react";
import type { Order } from "../../../../types";
import type { File as AnkaaFile } from "../../../../types";
import { cn } from "@/lib/utils";
import { FileItem, type FileViewMode, useFileViewer } from "@/components/common/file";

interface OrderDocumentsCardProps {
  order: Order;
  className?: string;
}

export function OrderDocumentsCard({
  order,
  className,
}: OrderDocumentsCardProps) {
  const [viewMode, setViewMode] = useState<FileViewMode>("list");
  const { actions } = useFileViewer();

  const budgets = order.budgets || [];
  const invoices = order.invoices || [];
  const receipts = order.receipts || [];
  const reimbursements = order.reimbursements || [];
  const invoiceReimbursements = order.invoiceReimbursements || [];

  const allDocuments = [...budgets, ...invoices, ...receipts, ...reimbursements, ...invoiceReimbursements];
  const hasDocuments = allDocuments.length > 0;

  const handleFileClick = (file: AnkaaFile) => {
    const index = allDocuments.findIndex(f => f.id === file.id);
    actions.viewFiles(allDocuments, index);
  };

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
          <IconFileText className="h-5 w-5 text-muted-foreground" />
          Documentos
        </CardTitle>
          <div className="flex gap-1">
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-8 w-8 p-0"
            >
              <IconList className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="h-8 w-8 p-0"
            >
              <IconLayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
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
                  <div className={cn(viewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
                    {budgets.map((file) => (
                      <FileItem
                        key={file.id}
                        file={file}
                        viewMode={viewMode}
                        onPreview={handleFileClick}
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
                  <div className={cn(viewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
                    {invoices.map((file) => (
                      <FileItem
                        key={file.id}
                        file={file}
                        viewMode={viewMode}
                        onPreview={handleFileClick}
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
                  <div className={cn(viewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
                    {receipts.map((file) => (
                      <FileItem
                        key={file.id}
                        file={file}
                        viewMode={viewMode}
                        onPreview={handleFileClick}
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
                  <div className={cn(viewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
                    {reimbursements.map((file) => (
                      <FileItem
                        key={file.id}
                        file={file}
                        viewMode={viewMode}
                        onPreview={handleFileClick}
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
                  <div className={cn(viewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
                    {invoiceReimbursements.map((file) => (
                      <FileItem
                        key={file.id}
                        file={file}
                        viewMode={viewMode}
                        onPreview={handleFileClick}
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
