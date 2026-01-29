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
    navigate(routes.humanResources.ppe.schedules.details(id!));
  };

  const handleCancel = () => {
    navigate(routes.humanResources.ppe.schedules.details(id!));
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
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
        <div className="space-y-6">
          <PageHeader
            variant="form"
            title="Carregando..."
            subtitle="Aguarde enquanto carregamos os dados do agendamento"
            icon={IconCalendar}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Recursos Humanos", href: routes.humanResources.root },
              { label: "EPIs", href: routes.humanResources.ppe.root },
              { label: "Agendamentos", href: routes.humanResources.ppe.schedules.root },
              { label: "Editar" },
            ]}
            backButton={{
              onClick: handleCancel,
            }}
          />

          <Card>
            <div className="p-4 space-y-4">
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
  if (error || !ppeSchedule || !ppeSchedule.data) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
        <div className="space-y-6">
          <PageHeader
            variant="form"
            title="Agendamento não encontrado"
            subtitle="O agendamento de EPI solicitado não foi encontrado ou não existe"
            icon={IconCalendar}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Recursos Humanos", href: routes.humanResources.root },
              { label: "EPIs", href: routes.humanResources.ppe.root },
              { label: "Agendamentos", href: routes.humanResources.ppe.schedules.root },
              { label: "Editar" },
            ]}
            backButton={{
              onClick: () => navigate(routes.humanResources.ppe.schedules.root),
            }}
          />

          <Card>
            <CardContent className="p-4 text-center">
              <IconCalendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Agendamento não encontrado</h3>
              <p className="text-muted-foreground mb-4">O agendamento de EPI solicitado não foi encontrado ou não existe.</p>
              <Button onClick={() => navigate(routes.humanResources.ppe.schedules.root)}>Voltar para lista</Button>
            </CardContent>
          </Card>
        </div>
      </PrivilegeRoute>
    );
  }

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="h-full flex flex-col px-4 pt-4 max-w-5xl mx-auto w-full">
        <PageHeader
          variant="form"
          title={`Editar: ${ppeSchedule.data.name || `#${ppeSchedule.data.id.slice(-8)}`}`}
          icon={IconCalendar}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos", href: routes.humanResources.root },
            { label: "EPIs", href: routes.humanResources.ppe.root },
            { label: "Agendamentos", href: routes.humanResources.ppe.schedules.root },
            { label: ppeSchedule.data.name || `#${ppeSchedule.data.id.slice(-8)}`, href: routes.humanResources.ppe.schedules.details(ppeSchedule.data.id) },
            { label: "Editar" },
          ]}
          actions={actions}
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="mt-4 space-y-4">
            <PpeScheduleForm
              mode="update"
              ppeSchedule={ppeSchedule.data}
              onSubmit={handleSubmit}
              isSubmitting={updateMutation.isPending}
              defaultValues={{
                name: ppeSchedule.data.name || "",
                items: ppeSchedule.data.items || [],
                assignmentType: ppeSchedule.data.assignmentType,
                excludedUserIds: ppeSchedule.data.excludedUserIds || [],
                includedUserIds: ppeSchedule.data.includedUserIds || [],
                frequency: ppeSchedule.data.frequency,
                frequencyCount: ppeSchedule.data.frequencyCount,
                specificDate: ppeSchedule.data.specificDate,
                dayOfMonth: ppeSchedule.data.dayOfMonth,
                dayOfWeek: ppeSchedule.data.dayOfWeek,
                month: ppeSchedule.data.month,
                customMonths: ppeSchedule.data.customMonths || [],
              }}
            />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};
