import { useState } from "react";

import { PageHeader } from "@/components/ui/page-header";
import {
  AssinaturaList,
  AssinaturaCreateModal,
  EspelhoExportModal,
} from "@/components/personnel-department/time-clock/assinatura-digital";
import { routes, FAVORITE_PAGES, SECTOR_PRIVILEGES } from "../../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { TimeClockTabs } from "../time-clock-tabs";

export default function AssinaturaDigitalListPage() {
  usePageTracker({ title: "Fechamento de Cartão Ponto", icon: "signature" });
  const [createOpen, setCreateOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Fechamento de Cartão Ponto"
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Departamento Pessoal", href: routes.personnelDepartment.root },
            { label: "Controle de Ponto", href: routes.personnelDepartment.timeClock.list },
            { label: "Fechamento" },
          ]}
          favoritePage={FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CONTROLE_PONTO_FECHAMENTO_LISTAR}
          headerExtra={<TimeClockTabs />}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <AssinaturaList
            className="h-full"
            onNewApuracao={() => setCreateOpen(true)}
            onExportEspelho={() => setExportOpen(true)}
          />
        </div>
        <AssinaturaCreateModal open={createOpen} onOpenChange={setCreateOpen} />
        <EspelhoExportModal open={exportOpen} onOpenChange={setExportOpen} />
      </div>
    </PrivilegeRoute>
  );
}
