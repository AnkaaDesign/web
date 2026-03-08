import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconFileInvoice, IconExternalLink } from "@tabler/icons-react";
import { formatDateTime, formatCurrency } from "../../../../utils";
import type { Customer } from "../../../../types";
import { useInvoicesByCustomer } from "@/hooks/production/use-invoice";
import { InvoiceStatusBadge } from "@/components/production/task/billing/invoice-status-badge";
import { InvoiceDetailDialog } from "@/components/production/task/billing/invoice-detail-dialog";
import type { Invoice } from "@/types/invoice";

interface RelatedInvoicesCardProps {
  customer: Customer;
}

export function RelatedInvoicesCard({ customer }: RelatedInvoicesCardProps) {
  const { data: response, isLoading } = useInvoicesByCustomer(customer.id);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const invoices: Invoice[] = Array.isArray(response?.data) ? response.data : [];

  const hasInvoices = invoices.length > 0;

  const openDetail = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowDetail(true);
  };

  return (
    <>
      <Card className="shadow-sm border border-border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <IconFileInvoice className="h-5 w-5 text-muted-foreground" />
            Faturas Relacionadas
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Carregando faturas...</p>
            </div>
          ) : hasInvoices ? (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer"
                  onClick={() => openDetail(invoice)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {invoice.task?.serialNumber ? `OS #${invoice.task.serialNumber}` : 'Fatura'}
                      </span>
                      <InvoiceStatusBadge status={invoice.status} size="sm" />
                      <span className="text-sm text-muted-foreground">
                        {formatDateTime(invoice.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {invoice.installments?.length ?? 0} parcela{(invoice.installments?.length ?? 0) !== 1 ? 's' : ''}
                      {invoice.paidAmount > 0 && ` - Pago: ${formatCurrency(invoice.paidAmount)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatCurrency(invoice.totalAmount)}</span>
                    <IconExternalLink className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <IconFileInvoice className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhuma fatura encontrada</h3>
              <p className="text-sm text-muted-foreground">As faturas sao relacionadas as tarefas do cliente</p>
            </div>
          )}
        </CardContent>
      </Card>

      <InvoiceDetailDialog
        invoice={selectedInvoice}
        open={showDetail}
        onOpenChange={setShowDetail}
      />
    </>
  );
}
