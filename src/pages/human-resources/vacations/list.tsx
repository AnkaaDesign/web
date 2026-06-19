import { useNavigate } from "react-router-dom";
import { IconCalendarStats } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { AbsenceList } from "@/components/human-resources/absence";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

// Legacy Secullum-absence list (afastamentos sincronizados do ponto). NÃO é o
// cadastro de Férias — as Férias têm seu próprio módulo em Departamento Pessoal
// (DB-backed, espelha para o Secullum). O cadastro direto via Secullum foi
// aposentado; esta página é somente leitura sobre os afastamentos do ponto.
export const AbsencesListPage = () => {
  const navigate = useNavigate();
  usePageTracker({ title: "Afastamentos (Ponto)", icon: "vacation" });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.ACCOUNTING]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Afastamentos (Ponto)"
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos", href: routes.personnelDepartment.root },
            { label: "Afastamentos (Ponto)" },
          ]}
          actions={[
            {
              key: "calendar",
              label: "Calendário",
              icon: IconCalendarStats,
              onClick: () => navigate(routes.personnelDepartment.calendar.root),
              variant: "outline",
            },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <AbsenceList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default AbsencesListPage;
