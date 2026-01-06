import { IconCalendar, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/ui/page-header";
import { HolidaysList } from "@/components/integrations/secullum/holidays/list";
import { routes, FAVORITE_PAGES, SECTOR_PRIVILEGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { DETAIL_PAGE_SPACING } from "@/lib/layout-constants";
import { cn } from "@/lib/utils";

export default function HolidayListPage() {
  const navigate = useNavigate();
  usePageTracker({ title: "Page", icon: "star" });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="h-full flex flex-col px-4 pt-4">
        <div className="flex-shrink-0">
          <PageHeader
            variant="default"
            title="Feriados"
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
        <HolidaysList className="flex-1 min-h-0 mt-4" />
      </div>
    </PrivilegeRoute>
  );
}

export { HolidayListPage };
