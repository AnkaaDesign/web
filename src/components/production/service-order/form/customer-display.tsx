import { FormItem, FormLabel } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useTaskDetail } from "../../../../hooks";
import { LoadingSpinner } from "@/components/ui/loading";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";

interface CustomerDisplayProps {
  taskId?: string;
}

export function CustomerDisplay({ taskId }: CustomerDisplayProps) {
  // Fetch task details to get customer information
  const { data: taskResponse, isLoading } = useTaskDetail(taskId || "", {
    enabled: !!taskId,
    include: {
      customer: true,
    },
  });

  const task = taskResponse?.data;
  const customer = task?.customer;

  if (!taskId) {
    return (
      <FormItem>
        <FormLabel>Cliente</FormLabel>
        <Card>
          <CardContent className="flex items-center justify-center py-6">
            <p className="text-sm text-muted-foreground">Selecione uma tarefa para visualizar o cliente</p>
          </CardContent>
        </Card>
      </FormItem>
    );
  }

  if (isLoading) {
    return (
      <FormItem>
        <FormLabel>Cliente</FormLabel>
        <Card>
          <CardContent className="flex items-center justify-center py-6">
            <LoadingSpinner />
          </CardContent>
        </Card>
      </FormItem>
    );
  }

  if (!customer) {
    return (
      <FormItem>
        <FormLabel>Cliente</FormLabel>
        <Card>
          <CardContent className="flex items-center justify-center py-6">
            <p className="text-sm text-muted-foreground">Nenhum cliente associado à tarefa</p>
          </CardContent>
        </Card>
      </FormItem>
    );
  }

  return (
    <FormItem>
      <FormLabel>Cliente</FormLabel>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <CustomerLogoDisplay
              logo={customer.logo}
              customerName={customer.fantasyName || customer.corporateName || "Cliente"}
              size="lg"
              shape="rounded"
              className="flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{customer.fantasyName}</p>
              {customer.corporateName && <p className="text-xs text-muted-foreground">{customer.corporateName}</p>}
              {customer.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
              {customer.phones && customer.phones.length > 0 && <p className="text-sm text-muted-foreground">{customer.phones[0]}</p>}
              {customer.tags && customer.tags.length > 0 && (
                <div className="flex items-center flex-wrap gap-2 mt-2">
                  {customer.tags.slice(0, 3).map((tag, index) => (
                    <Badge key={index} variant="secondary">{tag}</Badge>
                  ))}
                  {customer.tags.length > 3 && <Badge variant="outline">+{customer.tags.length - 3}</Badge>}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </FormItem>
  );
}
