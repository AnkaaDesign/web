import { IconClipboardList } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SkillAssessmentList } from "@/components/administration/skill-assessment/list";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const SkillAssessmentListPage = () => {
  usePageTracker({ title: "Avaliação de Competências", icon: "clipboard-list" });

  return (
    <PrivilegeRoute
      requiredPrivilege={[
        SECTOR_PRIVILEGES.ADMIN,
        SECTOR_PRIVILEGES.HUMAN_RESOURCES,
        SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
      ]}
    >
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Avaliação de Competências"
          favoritePage={FAVORITE_PAGES.ADMINISTRACAO_AVALIACAO_COMPETENCIAS_LISTAR}
          icon={IconClipboardList}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração", href: routes.administration.root },
            { label: "Avaliação de Competências" },
          ]}
          actions={[
            {
              key: "new",
              label: "Nova campanha",
              href: routes.administration.skillAssessment.create,
              variant: "default" as const,
            },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <SkillAssessmentList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default SkillAssessmentListPage;
