import { routes } from "../../constants";
import { PageHeader } from "@/components/ui/page-header";
import { VacationList } from "@/components/human-resources/vacation";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const PmVacationsPage = () => {
  usePageTracker({ title: "Férias", icon: "calendar" });

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="list"
        title="Férias"
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Pessoal", href: routes.personal.root },
          { label: "Férias" },
        ]}
        className="flex-shrink-0"
      />
      <div className="flex-1 min-h-0 pb-6 flex flex-col">
        <VacationList className="h-full" />
      </div>
    </div>
  );
};

export default PmVacationsPage;
