import { useState } from "react";
import { IconDeviceFloppy, IconRestore } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import {
  TimeClockEntryEditList,
  type TimeClockEntryEditActions,
} from "@/components/human-resources/time-clock-entry/time-clock-edit-list";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { TimeClockTabs } from "./time-clock-tabs";

export default function TimeClockEdicaoPage() {
  usePageTracker({ title: "Edição de Cartão Ponto", icon: "clock" });

  const [editActions, setEditActions] = useState<TimeClockEntryEditActions | null>(null);

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
        <PageHeader
          className="flex-shrink-0"
          title="Edição"
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos", href: routes.humanResources.root },
            { label: "Controle de Ponto", href: routes.humanResources.timeClock.root },
            { label: "Edição" },
          ]}
          headerExtra={
            <div className="flex items-center gap-2">
              <TimeClockTabs />
              {editActions && editActions.changedRowsCount > 0 && (
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" onClick={editActions.onRestore}>
                    <IconRestore className="h-4 w-4 mr-2" />
                    Restaurar
                  </Button>
                  <Button type="button" variant="default" onClick={editActions.onSave}>
                    <IconDeviceFloppy className="h-4 w-4 mr-2" />
                    Salvar ({editActions.changedRowsCount})
                  </Button>
                </div>
              )}
            </div>
          }
        />
        <div className="flex-1 min-h-0">
          <TimeClockEntryEditList className="h-full" onActionsChange={setEditActions} />
        </div>
      </div>
    </PrivilegeRoute>
  );
}
