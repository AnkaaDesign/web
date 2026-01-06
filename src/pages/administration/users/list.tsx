import { UserList } from "@/components/administration/user/list/user-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconUsers, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export const UserListPage = () => {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Lista de Usuários",
    icon: "users",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Usuários"
          icon={IconUsers}
          favoritePage={FAVORITE_PAGES.ADMINISTRACAO_COLABORADORES_LISTAR}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Administração", href: routes.administration.root }, { label: "Usuários" }]}
          actions={[
            {
              key: "create",
              label: "Cadastrar",
              icon: IconPlus,
              onClick: () => navigate(routes.administration.collaborators.create),
              variant: "default" as const,
            },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <UserList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
