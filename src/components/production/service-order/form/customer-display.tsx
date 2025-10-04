import { FormItem, FormLabel } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useTaskDetail } from "../../../../hooks";
import { LoadingSpinner } from "@/components/ui/loading";
import { IconUser } from "@tabler/icons-react";

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
            <div className="flex-shrink-0">
              <IconUser className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{customer.name}</p>
              {customer.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
              {customer.phone && <p className="text-sm text-muted-foreground">{customer.phone}</p>}
              <div className="flex items-center space-x-2 mt-2">
                <Badge variant="secondary">{customer.type || "Cliente"}</Badge>
                {customer.status && <Badge variant={customer.status === "ACTIVE" ? "default" : "secondary"}>{customer.status === "ACTIVE" ? "Ativo" : "Inativo"}</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </FormItem>
  );
}
