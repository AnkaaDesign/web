import { IconClipboardList } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../constants";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SkillList } from "@/components/administration/skill/list";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const SkillListPage = () => {
  usePageTracker({ title: "Competências", icon: "clipboard-list" });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Competências"
          icon={IconClipboardList}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração", href: routes.administration.root },
            { label: "Competências" },
          ]}
          actions={[
            {
              key: "new",
              label: "Cadastrar",
              href: routes.administration.skill.create,
              variant: "default" as const,
            },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <SkillList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default SkillListPage;
