import { PageHeader } from "@/components/ui/page-header";
import { IconPlus } from "@tabler/icons-react";
import { UserList } from "@/components/administration/user/list/user-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { FAVORITE_PAGES, routes, SECTOR_PRIVILEGES } from "../../../constants";
import { useAuth } from "@/contexts/auth-context";
import { useNavBreadcrumbs } from "@/contexts/navigation-context";
import { useNavigate } from "react-router-dom";

const CollaboratorListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

  // Context-aware trail: this page is shared across sections — accounting users see
  // "Departamento Pessoal", "Administração" only when reached from that section.
  const breadcrumbs = useNavBreadcrumbs([
    { label: "Início", href: "/" },
    { label: "Administração", href: "/administracao" },
    { label: "Colaboradores" },
  ]);

  const actions = isAdmin
    ? [
        {
          key: "create",
          label: "Novo Colaborador",
          icon: IconPlus,
          onClick: () => navigate(routes.administration.collaborators.create),
          variant: "default" as const,
        },
      ]
    : [];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.PRODUCTION_MANAGER, SECTOR_PRIVILEGES.ACCOUNTING]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Colaboradores"
          favoritePage={FAVORITE_PAGES.ADMINISTRACAO_COLABORADORES_LISTAR}
          breadcrumbs={breadcrumbs}
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
