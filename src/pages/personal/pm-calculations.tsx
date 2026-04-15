import { routes } from "../../constants";
import { PageHeader } from "@/components/ui/page-header";
import { CalculationList } from "@/components/integrations/secullum/calculations/list";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const PmCalculationsPage = () => {
  usePageTracker({ title: "Cálculos de Ponto", icon: "calculator" });

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
      <PageHeader
        className="flex-shrink-0"
        title="Cálculos de Ponto"
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Pessoal", href: routes.personal.root },
          { label: "Cálculos de Ponto" },
        ]}
      />
      <CalculationList className="flex-1 min-h-0" />
    </div>
  );
};

export default PmCalculationsPage;
