import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { routes, FAVORITE_PAGES } from "../../../../constants";
import { usePpeDeliveryScheduleMutations } from "../../../../hooks";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { IconCalendar, IconX, IconCheck, IconLoader2 } from "@tabler/icons-react";
import type { PpeDeliveryScheduleCreateFormData } from "../../../../schemas";
import type { PpeDeliveryScheduleCreateResponse } from "../../../../types";
import { PpeScheduleForm } from "@/components/inventory/epi/schedule/ppe-schedule-form";
import { toast } from "@/components/ui/sonner";

export const PPEScheduleCreatePage = () => {
  const navigate = useNavigate();
  const { createMutation } = usePpeDeliveryScheduleMutations();

  // Track page access
  usePageTracker({
    title: "Criar Agendamento de EPI",
    icon: "calendar",
  });

  const handleSubmit = async (data: PpeDeliveryScheduleCreateFormData) => {
    const result = await createMutation.mutateAsync({ data }) as PpeDeliveryScheduleCreateResponse & {
      immediateDeliveries?: {
        deliveriesCreated: number;
        userCount: number;
        errors?: string[];
      };
    };

    // Success toast is emitted by the axios success interceptor. We only surface
    // the partial-failure case (schedule created but no deliveries generated),
    // which the interceptor's generic success message cannot convey.
    if (result.immediateDeliveries) {
      const { deliveriesCreated, errors } = result.immediateDeliveries;
      if (deliveriesCreated === 0 && errors && errors.length > 0) {
        toast.warning(`Agendamento criado, mas nenhuma entrega foi gerada. Verifique: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`);
      }
    }

    navigate(routes.occupationalHealth.ppe.schedules.root);
  };

  const handleCancel = () => {
    navigate(routes.occupationalHealth.ppe.schedules.root);
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      icon: IconX,
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: createMutation.isPending,
    },
    {
      key: "submit",
      label: "Criar",
      icon: createMutation.isPending ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("ppe-schedule-form-submit")?.click(),
      variant: "default" as const,
      disabled: createMutation.isPending,
      loading: createMutation.isPending,
    },
  ];

  return (
    <div className="h-full flex flex-col px-4 pt-4 max-w-5xl mx-auto w-full">
      <PageHeader
        variant="form"
        title="Novo Agendamento de EPI"
        icon={IconCalendar}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Medicina do Trabalho", href: routes.occupationalHealth.ppe.deliveries.root },
          { label: "EPIs", href: routes.occupationalHealth.ppe.deliveries.root },
          { label: "Agendamentos", href: routes.occupationalHealth.ppe.schedules.root },
          { label: "Criar" },
        ]}
        actions={actions}
        favoritePage={FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_EPI_AGENDAMENTOS_CADASTRAR}
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4 space-y-4">
          <PpeScheduleForm mode="create" onSubmit={handleSubmit} isSubmitting={createMutation.isPending} />
        </div>
      </div>
    </div>
  );
};
