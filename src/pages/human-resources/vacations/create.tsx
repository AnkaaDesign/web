import { IconBeach } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { VacationForm } from "@/components/human-resources/vacation";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const CreateVacationPage = () => {
  usePageTracker({
    title: "Nova Férias",
    icon: "beach",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="flex flex-col h-full">
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <PageHeaderWithFavorite
              title="Nova Férias"
              icon={IconBeach}
              favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_FERIAS_CADASTRAR}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Recursos Humanos", href: routes.humanResources.root },
                { label: "Férias", href: routes.humanResources.vacations.root },
                { label: "Nova" },
              ]}
            />
          </div>
        </div>

        {/* Scrollable Form Container */}
        <div className="flex-1 overflow-y-auto mt-6">
          <div className="max-w-3xl mx-auto px-4 pb-6">
            <VacationForm mode="create" />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};
