import { PageHeader } from "@/components/ui/page-header";
import { IconCalendarStats, IconList } from "@tabler/icons-react";
import { routes } from "../../../constants";
import { UnderConstruction } from "@/components/navigation/under-construction";

export const VacationCalendarPage = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        variant="default"
        title="Calendário de Férias"
        subtitle="Visualização em calendário das férias dos colaboradores"
        icon={IconCalendarStats}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Recursos Humanos", href: routes.humanResources.root },
          { label: "Férias", href: routes.humanResources.vacations.root },
          { label: "Calendário" },
        ]}
        actions={[
          {
            key: "list",
            label: "Lista",
            icon: IconList,
            onClick: () => {},
            variant: "outline",
          },
        ]}
      />
      <UnderConstruction title="Calendário de Férias" />
    </div>
  );
};
