import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconFileText, IconFileInvoice, IconReceipt, IconFileSpreadsheet } from "@tabler/icons-react";
import type { Customer } from "../../../../types";
import type { File as FileType } from "../../../../types";
import { cn } from "@/lib/utils";
import { FilePreviewGrid } from "@/components/common/file";
import { useTasks } from "../../../../hooks";
import { Skeleton } from "@/components/ui/skeleton";

interface DocumentsCardProps {
  customer: Customer;
  className?: string;
}

export function DocumentsCard({ customer, className }: DocumentsCardProps) {
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
        <CardTitle className="flex items-center gap-2">
          <IconFileText className="h-5 w-5 text-muted-foreground" />
          Documentos
        </CardTitle>
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
                <FilePreviewGrid
                  files={budgets}
                  title=""
                  size="md"
                  showViewToggle={true}
                  showMetadata={false}
                />
              </div>
            )}

            {/* Invoices */}
            {invoices.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <IconFileInvoice className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Notas Fiscais</h3>
                </div>
                <FilePreviewGrid
                  files={invoices}
                  title=""
                  size="md"
                  showViewToggle={true}
                  showMetadata={false}
                />
              </div>
            )}

            {/* Receipts */}
            {receipts.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <IconReceipt className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Recibos</h3>
                </div>
                <FilePreviewGrid
                  files={receipts}
                  title=""
                  size="md"
                  showViewToggle={true}
                  showMetadata={false}
                />
              </div>
            )}

            {/* Reimbursements */}
            {reimbursements.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <IconFileText className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Reembolsos</h3>
                </div>
                <FilePreviewGrid
                  files={reimbursements}
                  title=""
                  size="md"
                  showViewToggle={true}
                  showMetadata={false}
                />
              </div>
            )}

            {/* Reimbursement Invoices */}
            {reimbursementInvoices.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <IconFileInvoice className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">NF Reembolso</h3>
                </div>
                <FilePreviewGrid
                  files={reimbursementInvoices}
                  title=""
                  size="md"
                  showViewToggle={true}
                  showMetadata={false}
                />
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
