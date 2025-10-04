import { IconBriefcase } from "@tabler/icons-react";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { PositionForm } from "@/components/human-resources/position/form";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const PositionCreatePage = () => {
  usePageTracker({
    title: "Novo Cargo",
    icon: "briefcase",
  });

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <PageHeaderWithFavorite
            title="Novo Cargo"
            icon={IconBriefcase}
            favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_CARGOS_CADASTRAR}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Recursos Humanos", href: routes.humanResources.root },
              { label: "Cargos", href: routes.humanResources.positions.root },
              { label: "Novo" },
            ]}
          />
        </div>
      </div>

      {/* Scrollable Form Container */}
      <div className="flex-1 overflow-y-auto mt-6">
        <div className="max-w-3xl mx-auto h-full">
          <PositionForm mode="create" />
        </div>
      </div>
    </div>
  );
};
