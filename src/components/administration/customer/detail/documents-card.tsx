import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconFileText, IconFileInvoice, IconReceipt, IconFileSpreadsheet, IconList, IconLayoutGrid } from "@tabler/icons-react";
import type { Customer } from "../../../../types";
import type { File as FileType } from "../../../../types";
import { cn } from "@/lib/utils";
import { FileItem, useFileViewer, type FileViewMode } from "@/components/common/file";
import { useTasks } from "../../../../hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DocumentsCardProps {
  customer: Customer;
  className?: string;
}

export function DocumentsCard({ customer, className }: DocumentsCardProps) {
  const [documentsViewMode, setDocumentsViewMode] = useState<FileViewMode>("list");

  let fileViewerContext: ReturnType<typeof useFileViewer> | null = null;
  try {
    fileViewerContext = useFileViewer();
  } catch {
    // Context not available
  }

  // Fetch tasks with documents for this customer
  const { data: tasksResponse, isLoading } = useTasks({
    where: {
      customerId: customer.id,
    },
    include: {
      budgets: true,
      invoices: true,
      receipts: true,
      reimbursements: true,
      reimbursementInvoices: true,
    },
  });

  const tasks = tasksResponse?.data || [];

  // Collect all task documents by type (excluding artworks)
  const { budgets, invoices, receipts, reimbursements, reimbursementInvoices, totalDocuments } = useMemo(() => {
    const budgets: FileType[] = [];
    const invoices: FileType[] = [];
    const receipts: FileType[] = [];
    const reimbursements: FileType[] = [];
    const reimbursementInvoices: FileType[] = [];

    tasks.forEach((task) => {
      if (task.budgets) {
        budgets.push(...task.budgets);
      }
      if (task.invoices) {
        invoices.push(...task.invoices);
      }
      if (task.receipts) {
        receipts.push(...task.receipts);
      }
      if (task.reimbursements) {
        reimbursements.push(...task.reimbursements);
      }
      if (task.reimbursementInvoices) {
        reimbursementInvoices.push(...task.reimbursementInvoices);
      }
    });

    const totalDocuments = budgets.length + invoices.length + receipts.length + reimbursements.length + reimbursementInvoices.length;

    return { budgets, invoices, receipts, reimbursements, reimbursementInvoices, totalDocuments };
  }, [tasks]);

  const hasDocuments = totalDocuments > 0;

  const handleDocumentFileClick = (file: FileType) => {
    if (!fileViewerContext) return;
    const allDocuments = [
      ...budgets,
      ...invoices,
      ...receipts,
      ...reimbursements,
      ...reimbursementInvoices,
    ];
    const index = allDocuments.findIndex((f) => f.id === file.id);
    fileViewerContext.actions.viewFiles(allDocuments, index);
  };

  const handleDownload = (file: FileType) => {
    if (fileViewerContext) {
      fileViewerContext.actions.downloadFile(file);
    }
  };

  // Show loading skeleton while fetching tasks
  if (isLoading) {
    return (
      <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
        <CardHeader className="pb-6">
          <CardTitle className="flex items-center gap-2">
          <IconFileText className="h-5 w-5 text-muted-foreground" />
          Documentos
        </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 flex-1">
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <IconFileText className="h-5 w-5 text-muted-foreground" />
            Documentos
            {totalDocuments > 0 && (
              <Badge variant="secondary" className="ml-1">{totalDocuments}</Badge>
            )}
          </CardTitle>
          {hasDocuments && (
            <div className="flex gap-1">
              <Button
                variant={documentsViewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setDocumentsViewMode("list")}
                className="h-7 w-7 p-0"
              >
                <IconList className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={documentsViewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setDocumentsViewMode("grid")}
                className="h-7 w-7 p-0"
              >
                <IconLayoutGrid className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        {hasDocuments ? (
          <div className="space-y-8">
            {/* Budgets */}
            {budgets.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <IconFileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Orçamentos</h3>
                </div>
                <div className={cn(documentsViewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
                  {budgets.map((file: FileType) => (
                    <FileItem
                      key={file.id}
                      file={file}
                      viewMode={documentsViewMode}
                      onPreview={handleDocumentFileClick}
                      onDownload={handleDownload}
                      showActions
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Invoices */}
            {invoices.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <IconFileInvoice className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Notas Fiscais</h3>
                </div>
                <div className={cn(documentsViewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
                  {invoices.map((file: FileType) => (
                    <FileItem
                      key={file.id}
                      file={file}
                      viewMode={documentsViewMode}
                      onPreview={handleDocumentFileClick}
                      onDownload={handleDownload}
                      showActions
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Receipts */}
            {receipts.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <IconReceipt className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Recibos</h3>
                </div>
                <div className={cn(documentsViewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
                  {receipts.map((file: FileType) => (
                    <FileItem
                      key={file.id}
                      file={file}
                      viewMode={documentsViewMode}
                      onPreview={handleDocumentFileClick}
                      onDownload={handleDownload}
                      showActions
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Reimbursements */}
            {reimbursements.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <IconFileText className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Reembolsos</h3>
                </div>
                <div className={cn(documentsViewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
                  {reimbursements.map((file: FileType) => (
                    <FileItem
                      key={file.id}
                      file={file}
                      viewMode={documentsViewMode}
                      onPreview={handleDocumentFileClick}
                      onDownload={handleDownload}
                      showActions
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Reimbursement Invoices */}
            {reimbursementInvoices.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <IconFileInvoice className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">NF Reembolso</h3>
                </div>
                <div className={cn(documentsViewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
                  {reimbursementInvoices.map((file: FileType) => (
                    <FileItem
                      key={file.id}
                      file={file}
                      viewMode={documentsViewMode}
                      onPreview={handleDocumentFileClick}
                      onDownload={handleDownload}
                      showActions
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <IconFileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhum documento encontrado</h3>
            <p className="text-sm text-muted-foreground">
              Este cliente não possui documentos nas tarefas.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
