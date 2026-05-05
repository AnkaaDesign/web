import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { routes, FAVORITE_PAGES, SECTOR_PRIVILEGES } from "../../../constants";
import { useUserMutations } from "../../../hooks";
import { UserForm } from "@/components/administration/user/form/user-form";
import { PageHeader } from "@/components/ui/page-header";
import { IconUsers, IconCheck, IconLoader2 } from "@tabler/icons-react";
import type { UserCreateFormData } from "../../../schemas";
import type { UserCreateResponse } from "../../../types";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { toast } from "@/components/ui/sonner";

const CreateCollaboratorPage = () => {
  const navigate = useNavigate();
  const { createAsync: createUser, isCreating } = useUserMutations();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });

  const handleSubmit = async (data: UserCreateFormData) => {
    try {
      const response = (await createUser(data)) as UserCreateResponse;

      // Surface the Secullum sync outcome (only present when
      // secullumSyncEnabled was true on create). Three possible statuses
      // come from `UserSecullumSyncService.onUserCreated`.
      const sync = response?.secullumSync;
      if (sync) {
        if (sync.status === "synced") {
          toast.success(
            sync.funcionarioId
              ? `Funcionário Secullum #${sync.funcionarioId} criado e vinculado`
              : "Funcionário Secullum criado e vinculado",
          );
        } else if (sync.status === "skipped") {
          toast.warning(
            `Sincronização Secullum ignorada: ${sync.reason ?? "motivo desconhecido"}`,
          );
        } else if (sync.status === "error") {
          toast.error(
            `Falha ao criar funcionário Secullum: ${sync.reason ?? "erro desconhecido"}`,
          );
        }
      }

      // The response already contains the data property from the API
      // Type: UserCreateResponse which has { success, message, data?: User }
      if (response?.data?.id) {
        navigate(routes.administration.collaborators.details(response.data.id));
      }
    } catch (error: any) {
      // Error is already handled by the API client and mutation
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error creating user:", error);
      }
    }
  };

  const handleCancel = () => {
    navigate(routes.administration.collaborators.root);
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: isCreating,
    },
    {
      key: "submit",
      label: "Cadastrar",
      icon: isCreating ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("user-form-submit")?.click(),
      variant: "default" as const,
      disabled: isCreating || !formState.isValid,
      loading: isCreating,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <PageHeader
            title="Cadastrar Colaborador"
            icon={IconUsers}
            favoritePage={FAVORITE_PAGES.ADMINISTRACAO_COLABORADORES_CADASTRAR}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Administração", href: routes.administration.root },
              { label: "Colaboradores", href: routes.administration.collaborators.root },
              { label: "Cadastrar" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <UserForm mode="create" onSubmit={handleSubmit} isSubmitting={isCreating} onFormStateChange={setFormState} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default CreateCollaboratorPage;
