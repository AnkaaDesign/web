import { PageHeader } from "@/components/ui/page-header";
import { CalculationList } from "@/components/integrations/secullum/calculations/list";
import { routes } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { TimeClockTabs } from "./time-clock-tabs";

export default function TimeClockColaboradorPage() {
  usePageTracker({ title: "Visualização Colaborador", icon: "clock" });

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
      <PageHeader
        className="flex-shrink-0"
        title="Visualização Colaborador"
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Recursos Humanos", href: routes.humanResources.root },
          { label: "Controle de Ponto", href: routes.humanResources.timeClock.root },
          { label: "Visualização Colaborador" },
        ]}
        headerExtra={<TimeClockTabs />}
      />
      <div className="flex-1 min-h-0">
        <CalculationList className="h-full" />
      </div>
    </div>
  );
}
