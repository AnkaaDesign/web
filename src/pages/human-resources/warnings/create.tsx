import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { IconAlertTriangle, IconX, IconCheck } from "@tabler/icons-react";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { PageHeader } from "@/components/ui/page-header";
import { WarningForm } from "@/components/human-resources/warning/form";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const WarningCreatePage = () => {
  const navigate = useNavigate();
  const formRef = useRef<{ submit: () => void; isSubmitting: boolean; isValid: boolean }>(null);

  usePageTracker({
    title: "Nova Advertência",
    icon: "alert-triangle",
  });

  const handleCancel = () => {
    navigate(routes.humanResources.warnings.root);
  };

  const handleSubmit = () => {
    formRef.current?.submit();
  };

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        title="Nova Advertência"
        icon={IconAlertTriangle}
        favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_AVISOS_CADASTRAR}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Recursos Humanos", href: routes.humanResources.root },
          { label: "Advertências", href: routes.humanResources.warnings.root },
          { label: "Nova" },
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
            label: "Criar",
            icon: IconCheck,
            variant: "default",
            onClick: handleSubmit,
            disabled: formRef.current?.isSubmitting || !formRef.current?.isValid,
          },
        ]}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <WarningForm mode="create" ref={formRef} />
      </div>
    </div>
  );
};
