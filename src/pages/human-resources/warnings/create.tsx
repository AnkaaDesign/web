import { useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { IconAlertTriangle, IconX, IconCheck } from "@tabler/icons-react";
import { routes, FAVORITE_PAGES, SECTOR_PRIVILEGES } from "../../../constants";
import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { WarningForm } from "@/components/human-resources/warning/form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const WarningCreatePage = () => {
  const navigate = useNavigate();
  const formRef = useRef<{ submit: () => void; isSubmitting: boolean; isValid: boolean }>(null);
  // Track form state as React state so button re-renders when validity changes.
  // formRef.current alone won't trigger re-renders.
  const [formState, setFormState] = useState({ isValid: false, isSubmitting: false });
  // Stable callback — must be useCallback so warning-form's useEffect
  // (which has onFormStateChange in its deps) doesn't loop infinitely.
  const handleFormStateChange = useCallback(
    (state: { isValid: boolean; isDirty: boolean }) => {
      setFormState(prev =>
        prev.isValid === state.isValid ? prev : { isValid: state.isValid, isSubmitting: false },
      );
    },
    [],
  );

  usePageTracker({
    title: "Nova Advertência",
    icon: "alert-triangle",
  });

  const handleCancel = () => {
    navigate(routes.personnelDepartment.warnings.root);
  };

  const handleSubmit = () => {
    formRef.current?.submit();
  };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <PageHeader
            title="Nova Advertência"
            icon={IconAlertTriangle}
            favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_AVISOS_CADASTRAR}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Recursos Humanos", href: routes.personnelDepartment.root },
              { label: "Advertências", href: routes.personnelDepartment.warnings.root },
              { label: "Cadastrar" },
            ]}
            actions={[
              {
                key: "cancel",
                label: "Cancelar",
                icon: IconX,
                variant: "outline",
                onClick: handleCancel,
              },
              {
                key: "submit",
                label: "Cadastrar",
                icon: IconCheck,
                variant: "default",
                onClick: handleSubmit,
                disabled: formState.isSubmitting || !formState.isValid,
              },
            ]}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <WarningForm
            mode="create"
            ref={formRef}
            onFormStateChange={handleFormStateChange}
          />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
