import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { IconPlus } from "@tabler/icons-react";
import { AdmissionList } from "@/components/personnel-department/admission/list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { FAVORITE_PAGES, routes, SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

const AdmissionListPage = () => {
  usePageTracker({ title: "Admissões" });
  const navigate = useNavigate();

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Admissões"
          favoritePage={FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_ADMISSOES_LISTAR}
          breadcrumbs={[{ label: "Início", href: "/" }, { label: "Departamento Pessoal" }, { label: "Admissões" }]}
          actions={[
            {
              key: "create",
              label: "Nova Admissão",
              icon: IconPlus,
              onClick: () => navigate(routes.personnelDepartment.admissions.create),
              variant: "default" as const,
            },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <AdmissionList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default AdmissionListPage;
