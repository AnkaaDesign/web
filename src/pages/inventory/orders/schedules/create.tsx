import { UnderConstruction } from "@/components/navigation/under-construction";
import { PageHeader } from "@/components/ui/page-header";
import { IconCalendarRepeat } from "@tabler/icons-react";
import { routes } from "../../../../constants";

export const OrderScheduleCreate = () => {
  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <PageHeader
        title="Criar Agendamento de Pedido"
        icon={IconCalendarRepeat}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Estoque", href: routes.inventory.root },
          { label: "Pedidos", href: routes.inventory.orders.root },
          { label: "Agendamentos", href: routes.inventory.orders.schedules.root },
          { label: "Criar" },
        ]}
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4 space-y-4">
          <UnderConstruction title="Create Order Schedule" />
        </div>
      </div>
    </div>
  );
};
