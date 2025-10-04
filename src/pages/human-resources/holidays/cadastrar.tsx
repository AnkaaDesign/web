import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { IconCalendar, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { HolidayForm } from "@/components/integrations/secullum/holidays/form";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { useSecullumCreateHoliday } from "../../../hooks";
import { toast } from "sonner";

// Type for holiday form data (temporary until build issues are resolved)
type SecullumCreateHolidayFormData = {
  Data: string;
  Descricao: string;
};

export const HolidayCreatePage = () => {
  const navigate = useNavigate();
  const { mutate: create, isPending } = useSecullumCreateHoliday();
  const formRef = useRef<{ submit: () => void; isSubmitting: boolean; isValid: boolean }>(null);

  usePageTracker({
    title: "Novo Feriado",
    icon: "calendar",
  });

  const handleSubmit = async (data: SecullumCreateHolidayFormData) => {
    try {
      create(data, {
        onSuccess: () => {
          toast.success("Feriado criado com sucesso!");
          navigate("/recursos-humanos/feriados");
        },
      });
    } catch (error) {
      console.error("Error creating holiday:", error);
    }
  };

  const handleCancel = () => {
    navigate("/recursos-humanos/feriados");
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: isPending,
    },
    {
      key: "submit",
      label: "Criar",
      icon: isPending ? IconLoader2 : IconCheck,
      onClick: () => formRef.current?.submit(),
      variant: "default" as const,
      disabled: isPending || !formRef.current?.isValid,
      loading: isPending,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="h-full flex flex-col">
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <PageHeaderWithFavorite
              title="Novo Feriado"
              icon={IconCalendar}
              favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_FERIADOS_CADASTRAR}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Recursos Humanos", href: routes.humanResources.root },
                { label: "Feriados", href: "/recursos-humanos/feriados" },
                { label: "Novo" },
              ]}
              actions={actions}
            />
          </div>
        </div>

        {/* Scrollable Form Container */}
        <div className="flex-1 overflow-y-auto mt-6">
          <div className="max-w-3xl mx-auto h-full">
            <HolidayForm mode="create" onSubmit={handleSubmit} isSubmitting={isPending} ref={formRef} />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default HolidayCreatePage;
