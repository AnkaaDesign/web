import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { IconUsers, IconPlus } from "@tabler/icons-react";
import { UserList } from "@/components/administration/user/list/user-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { FAVORITE_PAGES, routes, SECTOR_PRIVILEGES } from "../../../constants";
import { useNavigate } from "react-router-dom";

const CollaboratorListPage = () => {
  const navigate = useNavigate();

  const handleCreateNew = () => {
    navigate(routes.administration.collaborators.create);
  };

  const actions = [
    {
      key: "create",
      label: "Novo Colaborador",
      icon: IconPlus,
      onClick: handleCreateNew,
      variant: "default" as const,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Colaboradores"
            icon={IconUsers}
            favoritePage={FAVORITE_PAGES.ADMINISTRACAO_COLABORADORES_LISTAR}
            breadcrumbs={[{ label: "Início", href: "/" }, { label: "Administração", href: "/administracao" }, { label: "Colaboradores" }]}
            actions={actions}
          />
        </div>
        <UserList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};

export default CollaboratorListPage;
