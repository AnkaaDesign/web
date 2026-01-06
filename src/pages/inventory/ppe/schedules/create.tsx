import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { routes, FAVORITE_PAGES, SECTOR_PRIVILEGES } from "../../../../constants";
import { usePpeDeliveryScheduleMutations } from "../../../../hooks";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconCalendar, IconX, IconCheck, IconLoader2 } from "@tabler/icons-react";
import type { PpeDeliveryScheduleCreateFormData } from "../../../../schemas";
import { PpeScheduleForm } from "@/components/inventory/epi/schedule/ppe-schedule-form";

export const PPEScheduleCreatePage = () => {
  const navigate = useNavigate();
  const { createMutation } = usePpeDeliveryScheduleMutations();

  // Track page access
  usePageTracker({
    title: "Criar Agendamento de EPI",
    icon: "calendar",
  });

  const handleSubmit = async (data: PpeDeliveryScheduleCreateFormData) => {
    await createMutation.mutateAsync({ data });
    navigate(routes.inventory.ppe.schedules.root);
  };

  const handleCancel = () => {
    navigate(routes.inventory.ppe.schedules.root);
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
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col px-4 pt-4">
        <PageHeader
          variant="form"
          title="Novo Agendamento de EPI"
          icon={IconCalendar}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estoque", href: routes.inventory.root },
            { label: "EPIs", href: routes.inventory.ppe.root },
            { label: "Agendamentos", href: routes.inventory.ppe.schedules.root },
            { label: "Criar" },
          ]}
          actions={actions}
          favoritePage={FAVORITE_PAGES.ESTOQUE_EPI_AGENDAMENTOS_CADASTRAR}
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="mt-4 space-y-4">
            <PpeScheduleForm mode="create" onSubmit={handleSubmit} isSubmitting={createMutation.isPending} />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};
