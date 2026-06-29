import { PageHeader } from "@/components/ui/page-header";
import { CalculationList } from "@/components/integrations/secullum/calculations/list";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { TimeClockTabs } from "./time-clock-tabs";

export default function TimeClockColaboradorPage() {
  usePageTracker({ title: "Espelho de Ponto", icon: "clock" });

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
      <PageHeader
        className="flex-shrink-0"
        title="Espelho de Ponto"
        favoritePage={FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CONTROLE_PONTO_COLABORADOR_LISTAR}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Departamento Pessoal", href: routes.personnelDepartment.root },
          { label: "Controle de Ponto", href: routes.personnelDepartment.timeClock.root },
          { label: "Espelho de Ponto" },
        ]}
        headerExtra={<TimeClockTabs />}
      />
      <div className="flex-1 min-h-0">
        <CalculationList className="h-full" />
      </div>
    </div>
  );
}
