import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/ui/page-header";
import { HolidaysList } from "@/components/integrations/secullum/holidays/list";
import { routes, FAVORITE_PAGES, SECTOR_PRIVILEGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const HolidayListPage = () => {
  const navigate = useNavigate();
  usePageTracker({ title: "Feriados", icon: "calendar" });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Feriados"
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos", href: routes.humanResources.root },
            { label: "Feriados" },
          ]}
          favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_FERIADOS_LISTAR}
          actions={[
            {
              key: "create",
              label: "Cadastrar",
              icon: IconPlus,
              onClick: () => navigate("/recursos-humanos/feriados/cadastrar"),
              variant: "default",
            },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <HolidaysList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default HolidayListPage;
