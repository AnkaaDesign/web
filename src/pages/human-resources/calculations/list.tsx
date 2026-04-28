import { useState } from "react";
import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/page-header";
import { CalculationList, CalculationExport } from "@/components/integrations/secullum/calculations/list";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export default function HumanResourcesCalculationsPage() {
  usePageTracker({ title: "Cálculos de Ponto", icon: "calculator" });

  const [exportData, setExportData] = useState<{
    rows: any[];
    visibleColumns: Set<string>;
    filters: any;
  } | null>(null);

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
        <PageHeader
          className="flex-shrink-0"
          title="Cálculos de Ponto"
          favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_CALCULOS}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos", href: routes.humanResources.root },
            { label: "Cálculos de Ponto" }
          ]}
          headerExtra={
            exportData ? (
              <CalculationExport
                filters={exportData.filters}
                currentItems={exportData.rows}
                totalRecords={exportData.rows.length}
                visibleColumns={exportData.visibleColumns}
              />
            ) : undefined
          }
        />
        <CalculationList className="flex-1 min-h-0" onExportDataChange={setExportData} />
      </div>
    </PrivilegeRoute>
  );
}
