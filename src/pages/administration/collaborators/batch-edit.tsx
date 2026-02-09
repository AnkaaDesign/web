import { useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useUsers } from "../../../hooks";
import type { User } from "../../../types";
import { UserBatchEditTable } from "@/components/administration/user/batch-edit";
import { LoadingSpinner } from "@/components/ui/loading";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { IconAlertTriangle, IconArrowLeft, IconUsers, IconDeviceFloppy } from "@tabler/icons-react";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

const CollaboratorBatchEditPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedIds = searchParams.get("ids")?.split(",").filter(Boolean) || [];

  usePageTracker({
    title: "Editar Colaboradores em Lote",
    icon: "users",
  });

  // Fetch all selected users with their relationships
  const {
    data: usersData,
    isLoading,
    error,
  } = useUsers({
    where: {
      id: { in: selectedIds },
    },
    include: {
      position: true,
      sector: true,
      managedSector: true,
    },
  });

  const users = useMemo(() => {
    if (!usersData?.data) return [];
    // Ensure users are returned in the same order as selectedIds
    const userMap = new Map(usersData.data.map((user) => [user.id, user]));
    return selectedIds.map((id) => userMap.get(id)).filter(Boolean) as User[];
  }, [usersData, selectedIds]);

  const handleCancel = () => {
    navigate(routes.administration.collaborators.root);
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: false,
    },
    {
      key: "save",
      label: "Salvar Alterações",
      icon: IconDeviceFloppy,
      onClick: () => {
        const submitButton = document.getElementById("user-batch-form-submit");
        if (submitButton) {
          submitButton.click();
        }
      },
      variant: "default" as const,
      disabled: false,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Card className="max-w-md">
          <CardContent className="p-4">
            <div className="flex flex-col items-center text-center space-y-4">
              <IconAlertTriangle className="h-12 w-12 text-destructive" />
              <h2 className="text-lg font-semibold">Erro ao carregar usuários</h2>
              <p className="text-sm text-muted-foreground">Não foi possível carregar os usuários selecionados. Por favor, tente novamente.</p>
              <Button onClick={handleCancel} variant="outline">
                <IconArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selectedIds.length === 0 || users.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Card className="max-w-md">
          <CardContent className="p-4">
            <div className="flex flex-col items-center text-center space-y-4">
              <IconAlertTriangle className="h-12 w-12 text-warning" />
              <h2 className="text-lg font-semibold">Nenhum usuário selecionado</h2>
              <p className="text-sm text-muted-foreground">Por favor, selecione pelo menos um usuário para editar em lote.</p>
              <Button onClick={handleCancel} variant="outline">
                <IconArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background px-4 pt-4">
      <PageHeader
        title="Editar Colaboradores em Lote"
        icon={IconUsers}
        favoritePage={FAVORITE_PAGES.ADMINISTRACAO_COLABORADORES_LISTAR}
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Administração", href: routes.administration.root },
          { label: "Colaboradores", href: routes.administration.collaborators.root },
          { label: "Editar em Lote" },
        ]}
        actions={actions}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-hidden pt-4 pb-6">
        <UserBatchEditTable users={users} onCancel={handleCancel} />
      </div>
    </div>
  );
};

export default CollaboratorBatchEditPage;
