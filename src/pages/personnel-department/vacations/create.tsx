import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconBeach, IconCheck, IconLoader2, IconUser, IconUsersGroup } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import type { VacationCreateFormData } from "../../../schemas/vacation";
import type { VacationGroupCreateFormData } from "../../../schemas/vacation-group";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VacationForm } from "@/components/personnel-department/vacation/form";
import { VacationGroupForm } from "@/components/personnel-department/vacation-group/form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useVacationMutations } from "../../../hooks/personnel-department/use-vacations";
import { useVacationGroupMutations } from "../../../hooks/personnel-department/use-vacation-groups";

type VacationMode = "individual" | "collective";

export const VacationCreatePage = () => {
  const navigate = useNavigate();
  const { createAsync } = useVacationMutations();
  const { createAsync: createGroupAsync } = useVacationGroupMutations();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Coletiva primeiro: registra-se o período coletivo e depois ele é expandido
  // (na tela de detalhes) em férias individuais por colaborador.
  const [mode, setMode] = useState<VacationMode>("individual");

  usePageTracker({ title: "Novas Férias", icon: "vacation" });

  const handleSubmit = async (data: VacationCreateFormData) => {
    try {
      setIsSubmitting(true);
      const result = await createAsync(data);
      if (result.data?.id) {
        navigate(routes.personnelDepartment.vacations.details(result.data.id));
      } else {
        navigate(routes.personnelDepartment.vacations.root);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error creating vacation:", error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitGroup = async (data: VacationGroupCreateFormData) => {
    try {
      setIsSubmitting(true);
      const result = await createGroupAsync(data);
      if (result.data?.id) {
        navigate(routes.personnelDepartment.vacationGroups.details(result.data.id));
      } else {
        navigate(routes.personnelDepartment.vacationGroups.root);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error creating vacation group:", error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(routes.personnelDepartment.vacations.root);
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: isSubmitting,
    },
    {
      key: "submit",
      label: mode === "collective" ? "Criar coletivas" : "Criar",
      icon: isSubmitting ? IconLoader2 : IconCheck,
      onClick: () =>
        document
          .getElementById(mode === "collective" ? "vacation-group-form-submit" : "vacation-form-submit")
          ?.click(),
      variant: "default" as const,
      disabled: isSubmitting,
      loading: isSubmitting,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
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

        {/* Seletor de modo: individual x coletiva (registrar a coletiva primeiro). */}
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
            <Button
              type="button"
              size="sm"
              variant={mode === "individual" ? "default" : "ghost"}
              className={cn("gap-2", mode !== "individual" && "text-muted-foreground")}
              onClick={() => setMode("individual")}
              disabled={isSubmitting}
            >
              <IconUser className="h-4 w-4" />
              Individual
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "collective" ? "default" : "ghost"}
              className={cn("gap-2", mode !== "collective" && "text-muted-foreground")}
              onClick={() => setMode("collective")}
              disabled={isSubmitting}
            >
              <IconUsersGroup className="h-4 w-4" />
              Coletiva
            </Button>
          </div>
          {mode === "collective" && (
            <p className="mt-2 text-sm text-muted-foreground">
              Registre o período coletivo e seu alvo (toda a empresa, setores ou cargos). Depois, na tela de
              detalhes, gere as férias individuais de cada colaborador — que continuam editáveis.
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          {mode === "collective" ? (
            <VacationGroupForm mode="create" onSubmit={handleSubmitGroup} isSubmitting={isSubmitting} />
          ) : (
            <VacationForm mode="create" onSubmit={handleSubmit} isSubmitting={isSubmitting} />
          )}
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default VacationCreatePage;
