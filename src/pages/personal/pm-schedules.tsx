import { routes } from "../../constants";
import { PageHeader } from "@/components/ui/page-header";
import { SchedulesList } from "@/components/integrations/secullum/schedules/list";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const PmSchedulesPage = () => {
  usePageTracker({ title: "Horários", icon: "clock" });

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="list"
        title="Horários"
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Pessoal", href: routes.personal.root },
          { label: "Horários" },
        ]}
        className="flex-shrink-0"
      />
      <div className="flex-1 min-h-0 pb-6 flex flex-col">
        <SchedulesList className="h-full" />
      </div>
    </div>
  );
};

export default PmSchedulesPage;
