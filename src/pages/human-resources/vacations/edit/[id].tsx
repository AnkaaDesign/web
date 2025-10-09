import { useState, useCallback } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { IconBeach, IconLoader2, IconCheck, IconX } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { useVacationDetail } from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/page-header";
import { VacationForm } from "@/components/human-resources/vacation";
import { usePageTracker } from "@/hooks/use-page-tracker";
import type { VacationUpdateFormData } from "../../../../schemas";

export const EditVacationPage = () => {
  const navigate = useNavigate();
  const [formState, setFormState] = useState({
    isValid: false,
    isDirty: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  usePageTracker({ title: "Page", icon: "star" });
  const { id } = useParams<{ id: string }>();
  const {
    data: vacation,
    isLoading,
    error,
  } = useVacationDetail(id || "", {
    include: { user: true },
    enabled: !!id,
  });

  const handleCancel = useCallback(() => {
    if (id) {
      navigate(routes.humanResources.vacations.details(id));
    } else {
      navigate(routes.humanResources.vacations.root);
    }
  }, [id, navigate]);

  const handleFormStateChange = useCallback((state: { isValid: boolean; isDirty: boolean }) => {
    setFormState(state);
  }, []);

  const handleSubmit = useCallback(() => {
    const form = document.getElementById("vacation-form") as HTMLFormElement;
    if (form) {
      form.requestSubmit();
    }
  }, []);

  const handleFormSubmit = useCallback(async (data: VacationUpdateFormData) => {
    setIsSubmitting(true);
    try {
      // Form will handle the actual submission
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  if (!id) {
    return <Navigate to={routes.humanResources.vacations.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar férias</p>
        <Navigate to={routes.humanResources.vacations.root} replace />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!vacation || !vacation.data) {
    return <Navigate to={routes.humanResources.vacations.root} replace />;
  }

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="flex flex-col h-full">
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <PageHeader
              variant="form"
              title="Editar Férias"
              icon={IconBeach}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Recursos Humanos" },
                { label: "Férias", href: routes.humanResources.vacations.root },
                { label: vacation.data.user?.name || "Férias", href: routes.humanResources.vacations.details(id) },
                { label: "Editar" },
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
                  key: "save",
                  label: "Salvar",
                  icon: isSubmitting ? IconLoader2 : IconCheck,
                  onClick: handleSubmit,
                  variant: "default",
                  disabled: isSubmitting || !formState.isValid || !formState.isDirty,
                  loading: isSubmitting,
                },
              ]}
            />
          </div>
        </div>

        {/* Scrollable Form Container */}
        <div className="flex-1 overflow-y-auto mt-6">
          <div className="max-w-3xl mx-auto px-4 pb-6 flex flex-col h-full">
            <VacationForm
              mode="update"
              vacation={vacation.data}
              onFormStateChange={handleFormStateChange}
              onCancel={handleCancel}
              onFormSubmit={handleFormSubmit}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};
