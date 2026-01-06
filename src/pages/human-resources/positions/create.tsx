import { IconBriefcase } from "@tabler/icons-react";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { PageHeader } from "@/components/ui/page-header";
import { PositionForm } from "@/components/human-resources/position/form";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const PositionCreatePage = () => {
  usePageTracker({
    title: "Novo Cargo",
    icon: "briefcase",
  });

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        title="Novo Cargo"
        icon={IconBriefcase}
        favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_CARGOS_CADASTRAR}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Recursos Humanos", href: routes.humanResources.root },
          { label: "Cargos", href: routes.humanResources.positions.root },
          { label: "Novo" },
        ]}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <PositionForm mode="create" />
      </div>
    </div>
  );
};
