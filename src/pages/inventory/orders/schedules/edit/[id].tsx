import { useParams } from "react-router-dom";
import {
  useOrderSchedule,
} from "../../../../../hooks";
import { OrderScheduleEditForm } from "@/components/inventory/order-schedule/form/order-schedule-edit-form";
import { PageHeader } from "@/components/ui/page-header";
import { usePageTracker } from "@/hooks/use-page-tracker";
import {
  IconCalendarRepeat,
  IconLoader2,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { Alert } from "@/components/ui/alert";
import { routes } from "../../../../../constants";

export const OrderScheduleEditPage = () => {
  const { id } = useParams<{ id: string }>();

  // Track page access
  usePageTracker({
    title: "Editar Agendamento de Pedido",
    icon: "calendar-repeat",
  });

  // Fetch order schedule with all related data
  const {
    data: response,
    isLoading,
    error,
  } = useOrderSchedule(id!, {
    include: {
      weeklyConfig: { include: { daysOfWeek: true } },
      monthlyConfig: { include: { occurrences: true } },
      yearlyConfig: { include: { monthlyConfigs: true } },
    },
    enabled: !!id,
  });

  const schedule = response?.data;

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 px-4 pt-4">
          <PageHeader
            title="Editar Agendamento de Pedido"
            icon={IconCalendarRepeat}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "Pedidos", href: routes.inventory.orders.root },
              {
                label: "Agendamentos",
                href: routes.inventory.orders.schedules.root,
              },
              { label: "Editar" },
            ]}
          />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto mt-6">
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <IconLoader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Carregando agendamento...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !schedule) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 px-4 pt-4">
          <PageHeader
            title="Editar Agendamento de Pedido"
            icon={IconCalendarRepeat}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "Pedidos", href: routes.inventory.orders.root },
              {
                label: "Agendamentos",
                href: routes.inventory.orders.schedules.root,
              },
              { label: "Editar" },
            ]}
          />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto mt-6">
          <div className="px-4">
            <Alert variant="destructive">
              <IconAlertTriangle className="h-4 w-4" />
              <div className="ml-2">
                <h4 className="font-semibold">Erro ao carregar agendamento</h4>
                <p className="text-sm mt-1">
                  Não foi possível carregar o agendamento de pedido. Verifique
                  se o ID está correto ou tente novamente mais tarde.
                </p>
              </div>
            </Alert>
          </div>
        </div>
      </div>
    );
  }

  return <OrderScheduleEditForm schedule={schedule} id={id!} />;
};

export default OrderScheduleEditPage;
