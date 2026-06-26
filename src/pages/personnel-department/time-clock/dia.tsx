import { PageHeader } from "@/components/ui/page-header";
import { TimeClockDayView } from "@/components/personnel-department/time-clock-entry/time-clock-day-view";
import { routes } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { TimeClockTabs } from "./time-clock-tabs";

export default function TimeClockDiaPage() {
  usePageTracker({ title: "Resumo do Dia", icon: "clock" });

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
      <PageHeader
        className="flex-shrink-0"
        title="Resumo do Dia"
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Departamento Pessoal", href: routes.personnelDepartment.root },
          { label: "Controle de Ponto", href: routes.personnelDepartment.timeClock.root },
          { label: "Resumo do Dia" },
        ]}
        headerExtra={<TimeClockTabs />}
      />
      <div className="flex-1 min-h-0">
        <TimeClockDayView className="h-full" />
      </div>
    </div>
  );
}
