import { IconCalendar, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/ui/page-header";
import { HolidaysList } from "@/components/integrations/secullum/holidays/list";
import { routes, FAVORITE_PAGES, SECTOR_PRIVILEGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { usePageTracker } from "@/hooks/use-page-tracker";

export default function HolidayListPage() {
  const navigate = useNavigate();
  usePageTracker({ title: "Page", icon: "star" });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeader
            variant="default"
            title="Feriados"
            icon={IconCalendar}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Recursos Humanos", href: routes.humanResources.root }, { label: "Feriados" }]}
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
          />
        </div>
        <HolidaysList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
}

export { HolidayListPage };
