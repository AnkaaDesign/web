import { UnderConstruction } from "@/components/navigation/under-construction";
import { PageHeader } from "@/components/ui/page-header";
import { IconCalendarRepeat } from "@tabler/icons-react";
import { routes } from "../../../../../constants";
// import { useParams } from "react-router-dom"; // Currently unused in placeholder page

export const OrderScheduleEditPage = () => {
  // const {id } = useParams(); // Currently unused in this placeholder page

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Editar Agendamento de Pedido"
          icon={IconCalendarRepeat}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estoque", href: routes.inventory.root },
            { label: "Pedidos", href: routes.inventory.orders.root },
            { label: "Agendamentos", href: routes.inventory.orders.schedules.root },
            { label: "Editar" },
          ]}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <UnderConstruction title="Edit Order Schedule" />
        </div>
      </div>
    </div>
  );
};
