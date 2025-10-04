import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconActivity } from "@tabler/icons-react";
import { formatDateTime, formatRelativeTime } from "../../../../utils";
import type { Customer } from "../../../../types";

interface CustomerActivityCardProps {
  customer: Customer;
}

export function CustomerActivityCard({ customer }: CustomerActivityCardProps) {
  const activities = [
    {
      label: "Criado em",
      value: customer.createdAt,
    },
    {
      label: "Última atualização",
      value: customer.updatedAt,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconActivity className="h-5 w-5" />
          Atividade
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity: any) => (
            <div key={activity.label} className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">{activity.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{formatDateTime(activity.value)}</span>
                <span className="text-sm text-muted-foreground">({formatRelativeTime(activity.value)})</span>
              </div>
            </div>
          ))}

          {/* Task Statistics */}
          {customer._count?.tasks !== undefined && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-sm font-medium mb-2">Estatísticas</h4>
              <div>
                <span className="text-2xl font-bold">{customer._count.tasks}</span>
                <p className="text-sm text-muted-foreground">Tarefas</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
