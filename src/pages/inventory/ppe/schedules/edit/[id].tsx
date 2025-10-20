import { useNavigate, useParams } from "react-router-dom";
import { routes, SECTOR_PRIVILEGES } from "../../../../../constants";
import { usePpeDeliverySchedule, usePpeDeliveryScheduleMutations } from "../../../../../hooks";
import { PageHeader } from "@/components/ui/page-header";
import { IconCalendar, IconX, IconCheck, IconLoader2 } from "@tabler/icons-react";
import type { PpeDeliveryScheduleUpdateFormData } from "../../../../../schemas";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PpeScheduleForm } from "@/components/inventory/epi/schedule/ppe-schedule-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const PPEScheduleEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { updateMutation } = usePpeDeliveryScheduleMutations();

  // Fetch PPE schedule data
  const {
    data: ppeSchedule,
    isLoading,
    error,
  } = usePpeDeliverySchedule(id!, {
    include: {
      user: {
        include: {
          position: true,
          sector: true,
        },
      },
      category: true,
      weeklyConfig: true,
      monthlyConfig: true,
      yearlyConfig: true,
      deliveries: {
        include: {
          item: true,
          user: true,
        },
      },
    },
    enabled: !!id,
  });

  const handleSubmit = async (data: PpeDeliveryScheduleUpdateFormData) => {
    await updateMutation.mutateAsync({
      id: id!,
      data,
    });
    navigate(routes.inventory.ppe.schedules.details(id!));
  };

  const handleCancel = () => {
    navigate(routes.inventory.ppe.schedules.details(id!));
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      icon: IconX,
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: updateMutation.isPending,
    },
    {
      key: "submit",
      label: "Salvar",
      icon: updateMutation.isPending ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("ppe-schedule-form-submit")?.click(),
      variant: "default" as const,
      disabled: updateMutation.isPending,
      loading: updateMutation.isPending,
    },
  ];

  // Loading state
  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="space-y-6">
          <PageHeader
            variant="form"
            title="Carregando..."
            subtitle="Aguarde enquanto carregamos os dados do agendamento"
            icon={IconCalendar}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "EPIs", href: routes.inventory.ppe.root },
              { label: "Agendamentos", href: routes.inventory.ppe.schedules.root },
              { label: "Editar" },
            ]}
            backButton={{
              onClick: handleCancel,
            }}
          />

          <Card>
            <div className="p-6 space-y-4">
              <Skeleton className="h-6 w-48" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </PrivilegeRoute>
    );
  }

  // Error state
  if (error || !ppeSchedule) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="space-y-6">
          <PageHeader
            variant="form"
            title="Agendamento não encontrado"
            subtitle="O agendamento de EPI solicitado não foi encontrado ou não existe"
            icon={IconCalendar}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "EPIs", href: routes.inventory.ppe.root },
              { label: "Agendamentos", href: routes.inventory.ppe.schedules.root },
              { label: "Editar" },
            ]}
            backButton={{
              onClick: () => navigate(routes.inventory.ppe.schedules.root),
            }}
          />

          <Card>
            <CardContent className="p-6 text-center">
              <IconCalendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Agendamento não encontrado</h3>
              <p className="text-muted-foreground mb-4">O agendamento de EPI solicitado não foi encontrado ou não existe.</p>
              <Button onClick={() => navigate(routes.inventory.ppe.schedules.root)}>Voltar para lista</Button>
            </CardContent>
          </Card>
        </div>
      </PrivilegeRoute>
    );
  }

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col space-y-4">
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <div className="max-w-5xl mx-auto">
            <PageHeader
              variant="form"
              title={`Editar Agendamento #${ppeSchedule.data?.id.slice(-8)}`}
              subtitle={`${ppeSchedule.data?.frequency} - ${ppeSchedule.data?.ppeItems?.map((item) => item.ppeType).join(", ") || "N/A"}`}
              icon={IconCalendar}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Estoque", href: routes.inventory.root },
                { label: "EPIs", href: routes.inventory.ppe.root },
                { label: "Agendamentos", href: routes.inventory.ppe.schedules.root },
                { label: `#${ppeSchedule.data?.id.slice(-8)}`, href: routes.inventory.ppe.schedules.details(ppeSchedule.data?.id!) },
                { label: "Editar" },
              ]}
              actions={actions}
            />
          </div>
        </div>

        {/* Scrollable Form Container */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-5xl mx-auto h-full">
            <PpeScheduleForm
              mode="update"
              ppeSchedule={ppeSchedule.data!}
              onSubmit={handleSubmit}
              isSubmitting={updateMutation.isPending}
              defaultValues={{
                ppeItems: ppeSchedule.data?.ppeItems || [],
                assignmentType: ppeSchedule.data?.assignmentType,
                excludedUserIds: ppeSchedule.data?.excludedUserIds || [],
                includedUserIds: ppeSchedule.data?.includedUserIds || [],
                frequency: ppeSchedule.data?.frequency,
                frequencyCount: ppeSchedule.data?.frequencyCount,
                isActive: ppeSchedule.data?.isActive,
                specificDate: ppeSchedule.data?.specificDate,
                dayOfMonth: ppeSchedule.data?.dayOfMonth,
                dayOfWeek: ppeSchedule.data?.dayOfWeek,
                month: ppeSchedule.data?.month,
                customMonths: ppeSchedule.data?.customMonths || [],
              }}
            />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};
