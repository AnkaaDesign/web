import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconBeach, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { VacationForm, type VacationCreateSubmit } from "@/components/personnel-department/vacation/form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useVacationBatchMutations } from "../../../hooks/personnel-department/use-vacations";

export const VacationCreatePage = () => {
  const navigate = useNavigate();
  const { batchCreateAsync } = useVacationBatchMutations();
  const [isSubmitting, setIsSubmitting] = useState(false);

  usePageTracker({ title: "Novas Férias", icon: "vacation" });

  // One form, multi-select colaboradores. Picking N collaborators bulk-creates
  // one (single-period) vacation per person via POST /vacations/batch —
  // collective is NOT a separate entity, just multiple regular vacations. Each
  // colaborador's acquisitive period is derived server-side from their own
  // admission and the recibo is auto-calculated.
  const handleSubmit = async (data: VacationCreateSubmit) => {
    const { userIds, ...base } = data;
    if (!userIds.length) return;
    try {
      setIsSubmitting(true);
      const result = await batchCreateAsync({
        vacations: userIds.map((userId) => ({ userId, ...base })),
      });
      const created = result?.data?.success ?? [];
      if (userIds.length === 1 && created[0]?.id) {
        navigate(routes.personnelDepartment.vacations.details(created[0].id));
      } else {
        navigate(routes.personnelDepartment.vacations.root);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error creating vacation(s):", error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: () => navigate(routes.personnelDepartment.vacations.root),
      variant: "outline" as const,
      disabled: isSubmitting,
    },
    {
      key: "submit",
      label: "Criar",
      icon: isSubmitting ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("vacation-form-submit")?.click(),
      variant: "default" as const,
      disabled: isSubmitting,
      loading: isSubmitting,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <PageHeader
            variant="form"
            title="Novas Férias"
            icon={IconBeach}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Departamento Pessoal" },
              { label: "Férias", href: routes.personnelDepartment.vacations.root },
              { label: "Novas" },
            ]}
            actions={actions}
          />
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          <VacationForm mode="create" onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default VacationCreatePage;
