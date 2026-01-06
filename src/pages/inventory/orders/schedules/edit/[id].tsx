import { UnderConstruction } from "@/components/navigation/under-construction";
import { PageHeader } from "@/components/ui/page-header";
import { IconCalendarRepeat } from "@tabler/icons-react";
import { routes } from "../../../../../constants";
// import { useParams } from "react-router-dom"; // Currently unused in placeholder page

export const OrderScheduleEditPage = () => {
  // const {id } = useParams(); // Currently unused in this placeholder page

  return (
    <div className="h-full flex flex-col px-4 pt-4">
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
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="space-y-4 mt-4 max-w-3xl mx-auto">
          <UnderConstruction title="Edit Order Schedule" />
        </div>
      </div>
    </div>
  );
};
