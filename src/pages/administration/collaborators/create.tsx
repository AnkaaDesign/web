import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { routes, FAVORITE_PAGES, SECTOR_PRIVILEGES } from "../../../constants";
import { useUserMutations } from "../../../hooks";
import { UserForm } from "@/components/administration/user/form/user-form";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { IconUsers, IconCheck, IconLoader2 } from "@tabler/icons-react";
import type { UserCreateFormData } from "../../../schemas";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";

const CreateCollaboratorPage = () => {
  const navigate = useNavigate();
  const { createAsync: createUser, isCreating } = useUserMutations();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });

  const handleSubmit = async (data: UserCreateFormData) => {
    try {
      const response = await createUser(data);

      // The response already contains the data property from the API
      // Type: UserCreateResponse which has { success, message, data?: User }
      if (response?.data?.id) {
        navigate(routes.administration.collaborators.details(response.data.id));
      }
    } catch (error: any) {
      // Error is already handled by the API client and mutation
      console.error("Error creating user:", error);
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
      <div className="h-full flex flex-col space-y-4">
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <div className="max-w-4xl mx-auto">
            <PageHeaderWithFavorite
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
        </div>

        {/* Main Content Card - Dashboard style scrolling */}
        <div className="flex-1 overflow-hidden max-w-4xl mx-auto w-full">
          <div className="h-full bg-card rounded-lg shadow-md border-muted overflow-hidden">
            <UserForm mode="create" onSubmit={handleSubmit} isSubmitting={isCreating} onFormStateChange={setFormState} />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default CreateCollaboratorPage;
