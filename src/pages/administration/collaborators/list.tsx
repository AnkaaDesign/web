import { PageHeader } from "@/components/ui/page-header";
import { IconPlus } from "@tabler/icons-react";
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
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Colaboradores"
          favoritePage={FAVORITE_PAGES.ADMINISTRACAO_COLABORADORES_LISTAR}
          breadcrumbs={[{ label: "Início", href: "/" }, { label: "Administração", href: "/administracao" }, { label: "Colaboradores" }]}
          actions={actions}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <UserList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default CollaboratorListPage;
