import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconFileInvoice, IconExternalLink } from "@tabler/icons-react";
import { formatDateTime, formatCurrency } from "../../../../utils";
import type { Customer } from "../../../../types";

// Define a basic Invoice type for placeholder purposes
interface Invoice {
  id: string;
  number: string;
  description?: string;
  totalAmount: number;
  createdAt: Date;
}

// Extend Customer to include invoices for display purposes
interface CustomerWithInvoices extends Customer {
  invoices?: Invoice[];
}

interface RelatedInvoicesCardProps {
  customer: CustomerWithInvoices;
}

export function RelatedInvoicesCard({ customer }: RelatedInvoicesCardProps) {
  const invoices = customer.invoices || [];

  const hasInvoices = invoices && invoices.length > 0;

  return (
    <Card className="shadow-sm border border-border" level={1}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconFileInvoice className="h-5 w-5 text-muted-foreground" />
          Notas Fiscais Relacionadas
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {hasInvoices ? (
          <div className="space-y-3">
            {invoices.map((invoice: any) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer"
                onClick={() => {
                  /* Navigate to invoice details when implemented */
                }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">NF #{invoice.number}</span>
                    <span className="text-sm text-muted-foreground">• {formatDateTime(invoice.createdAt)}</span>
                  </div>
                  {invoice.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{invoice.description}</p>}
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
            <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhuma nota fiscal encontrada</h3>
            <p className="text-sm text-muted-foreground">As notas fiscais são relacionadas às tarefas do cliente</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
