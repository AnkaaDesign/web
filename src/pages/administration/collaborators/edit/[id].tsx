import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { useUser, useUserMutations } from "../../../../hooks";
import { UserForm } from "@/components/administration/user/form/user-form";
import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { IconUsers, IconCheck, IconLoader2 } from "@tabler/icons-react";
import type { UserUpdateFormData } from "../../../../schemas";

const EditCollaboratorPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });

  // Use the same includes as the detail page for consistency
  const includeParams = {
    position: {
      include: {
        sector: true,
      },
    },
    sector: true,
    managedSector: true,
    tasks: {
      orderBy: { createdAt: "desc" },
      take: 5,
    },
  };

  const {
    data: response,
    isLoading,
    error,
  } = useUser(id!, {
    include: includeParams,
    enabled: !!id,
  });

  const user = response?.data;

  const { updateAsync: update, isUpdating } = useUserMutations();

  const handleSubmit = async (data: UserUpdateFormData) => {
    if (!id) return;

    try {
      // Remove currentStatus before sending to API (it's only used for validation)
      const { currentStatus, ...dataToSend } = data;

      const response = await update({ id, data: dataToSend });

      if (response.success) {
        navigate(routes.administration.collaborators.details(id));
      }
    } catch (error: any) {
      // Error is already handled by the API client and mutation
    }
  };

  const handleCancel = () => {
    navigate(routes.administration.collaborators.details(id!));
  };

  // Map user data to form default values
  // Memoize to prevent unnecessary re-renders
  // MUST be called before any conditional returns to maintain consistent hook order
  const defaultValues = useMemo<Partial<UserUpdateFormData>>(() => {
    if (!user) {
      return {};
    }
    return {
      name: user.name,
      email: user.email ?? null,
      phone: user.phone ?? null,
      cpf: user.cpf ?? null,
      pis: user.pis ?? null,
      positionId: user.positionId ?? null,
      performanceLevel: user.performanceLevel,
      sectorId: user.sectorId ?? null,
      managedSectorId: user.managedSectorId ?? null,
      status: user.status,
      currentStatus: user.status, // Store current status for validation
      verified: user.verified,
      address: user.address ?? null,
      addressNumber: user.addressNumber ?? null,
      addressComplement: user.addressComplement ?? null,
      neighborhood: user.neighborhood ?? null,
      city: user.city ?? null,
      state: user.state ?? null,
      zipCode: user.zipCode ?? null,
      site: user.site ?? null,
      // Convert ISO string dates to Date objects for proper form handling
      birth: user.birth ? (user.birth instanceof Date ? user.birth : new Date(user.birth)) : null,
      dismissal: user.dismissal ? (user.dismissal instanceof Date ? user.dismissal : new Date(user.dismissal)) : null,
      payrollNumber: user.payrollNumber ?? null,
    };
    // Use stringified ID to ensure memo only recalculates when user actually changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error || !user) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Colaborador não encontrado</h2>
          <p className="text-muted-foreground mb-4">O colaborador que você está procurando não existe ou foi removido.</p>
        </div>
      </div>
    );
  }

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: isUpdating,
    },
    {
      key: "submit",
      label: "Salvar Alterações",
      icon: isUpdating ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("user-form-submit")?.click(),
      variant: "default" as const,
      disabled: isUpdating || !formState.isValid || !formState.isDirty,
      loading: isUpdating,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="h-full flex flex-col space-y-4">
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <div className="max-w-4xl mx-auto">
            <PageHeader
              variant="form"
              title="Editar Colaborador"
              icon={IconUsers}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Administração", href: routes.administration.root },
                { label: "Colaboradores", href: routes.administration.collaborators.root },
                { label: user.name, href: routes.administration.collaborators.details(id!) },
                { label: "Editar" },
              ]}
              actions={actions}
            />
          </div>
        </div>

        {/* Main Content Card - Dashboard style scrolling */}
        <div className="flex-1 overflow-hidden max-w-4xl mx-auto w-full">
          <div className="h-full bg-card rounded-lg shadow-md border-muted overflow-hidden">
            <UserForm mode="update" defaultValues={defaultValues} onSubmit={handleSubmit} isSubmitting={isUpdating} onFormStateChange={setFormState} />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};
export default EditCollaboratorPage;
