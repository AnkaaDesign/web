import { useState, useCallback } from "react";
import { IconBeach, IconCheck, IconX, IconLoader2 } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { VacationForm } from "@/components/human-resources/vacation";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useNavigate } from "react-router-dom";

export const CreateVacationPage = () => {
  const navigate = useNavigate();
  const [formState, setFormState] = useState({
    isValid: false,
    isDirty: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  usePageTracker({
    title: "Nova Férias",
    icon: "beach",
  });

  const handleCancel = useCallback(() => {
    navigate(routes.humanResources.vacations.root);
  }, [navigate]);

  const handleFormStateChange = useCallback((state: { isValid: boolean; isDirty: boolean }) => {
    setFormState(state);
  }, []);

  const handleSubmit = useCallback(() => {
    // Trigger form submission using the form id
    const form = document.getElementById("vacation-form") as HTMLFormElement;
    if (form) {
      form.requestSubmit();
    }
  }, []);


  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Nova Férias"
          icon={IconBeach}
          favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_FERIAS_CADASTRAR}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos", href: routes.humanResources.root },
            { label: "Férias", href: routes.humanResources.vacations.root },
            { label: "Nova" },
          ]}
          actions={[
            {
              key: "cancel",
              label: "Cancelar",
              icon: IconX,
              onClick: handleCancel,
              variant: "outline",
              disabled: isSubmitting,
            },
            {
              key: "create",
              label: "Criar",
              icon: isSubmitting ? IconLoader2 : IconCheck,
              onClick: handleSubmit,
              variant: "default",
              disabled: isSubmitting || !formState.isValid,
              loading: isSubmitting,
            },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <VacationForm
            mode="create"
            onFormStateChange={handleFormStateChange}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
