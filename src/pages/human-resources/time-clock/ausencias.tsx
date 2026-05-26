import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { TimeClockAbsenceOverview } from "@/components/human-resources/time-clock-entry/time-clock-absence-overview";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { TimeClockTabs } from "./time-clock-tabs";

export default function TimeClockAusenciasPage() {
  usePageTracker({ title: "Ausências", icon: "clock" });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
        <PageHeader
          className="flex-shrink-0"
          title="Ausências"
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos", href: routes.humanResources.root },
            { label: "Controle de Ponto" },
            { label: "Ausências" },
          ]}
          headerExtra={<TimeClockTabs />}
        />
        <div className="flex-1 min-h-0">
          <TimeClockAbsenceOverview className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
}
