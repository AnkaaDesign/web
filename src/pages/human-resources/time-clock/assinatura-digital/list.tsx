import { useState } from "react";

import { PageHeader } from "@/components/ui/page-header";
import {
  AssinaturaList,
  AssinaturaCreateModal,
} from "@/components/human-resources/time-clock/assinatura-digital";
import { routes, FAVORITE_PAGES, SECTOR_PRIVILEGES } from "../../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { TimeClockTabs } from "../time-clock-tabs";

export default function AssinaturaDigitalListPage() {
  usePageTracker({ title: "Fechamento de Cartão Ponto", icon: "signature" });
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Fechamento de Cartão Ponto"
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos", href: routes.humanResources.root },
            { label: "Controle de Ponto", href: routes.humanResources.timeClock.list },
            { label: "Fechamento" },
          ]}
          favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_CONTROLE_PONTO_ASSINATURA_DIGITAL_LISTAR}
          headerExtra={<TimeClockTabs />}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <AssinaturaList className="h-full" onNewApuracao={() => setCreateOpen(true)} />
        </div>
        <AssinaturaCreateModal open={createOpen} onOpenChange={setCreateOpen} />
      </div>
    </PrivilegeRoute>
  );
}
