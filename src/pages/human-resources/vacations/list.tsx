import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconPlus, IconCalendarStats } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { AbsenceList, AbsenceFormDialog } from "@/components/human-resources/absence";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const VacationsListPage = () => {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  usePageTracker({ title: "Férias", icon: "vacation" });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.ACCOUNTING]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Férias"
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos", href: routes.humanResources.root },
            { label: "Férias" },
          ]}
          actions={[
            {
              key: "calendar",
              label: "Calendário",
              icon: IconCalendarStats,
              onClick: () => navigate(routes.humanResources.calendar.root),
              variant: "outline",
            },
            {
              key: "create",
              label: "Adicionar",
              icon: IconPlus,
              onClick: () => setCreateOpen(true),
              variant: "default",
            },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <AbsenceList className="h-full" />
        </div>
        <AbsenceFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      </div>
    </PrivilegeRoute>
  );
};

export default VacationsListPage;
