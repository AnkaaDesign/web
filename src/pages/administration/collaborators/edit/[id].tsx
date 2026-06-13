import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { useUser, useUserMutations } from "../../../../hooks";
import { UserForm } from "@/components/administration/user/form/user-form";
import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { IconUsers, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { toast } from "@/components/ui/sonner";
import type { UserUpdateFormData } from "../../../../schemas";
import type { UserUpdateResponse } from "../../../../types";
import { useNavBreadcrumbs } from "@/contexts/navigation-context";

// Truncate long names to prevent layout issues in breadcrumbs
const truncateName = (name: string, maxLength: number = 30) => {
  if (name.length <= maxLength) return name;
  return `${name.substring(0, maxLength)}...`;
};

const EditCollaboratorPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });

  // Use the same includes as the detail page for consistency
  // IMPORTANT: Include ppeSize to ensure PPE data is loaded
  const includeParams = {
    position: {
      include: {
        sector: true,
      },
    },
    sector: true,
    ledSector: true,
    ppeSize: true, // CRITICAL: Include PPE sizes for form
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

  const handleSubmit = async (data: UserUpdateFormData | FormData) => {
    if (!id) return;

    try {
      // If data is FormData, send it as-is (for file uploads)
      // Otherwise, remove currentContractType before sending to API (it's only used for validation)
      const dataToSend = data instanceof FormData
        ? data
        : (() => {
            const { currentContractType, ...rest } = data as UserUpdateFormData;
            return rest;
          })() as Omit<UserUpdateFormData, 'currentContractType'>;

      const response = (await update({ id, data: dataToSend as any })) as UserUpdateResponse;

      // Surface the Secullum sync outcome (only present when the user
      // had `secullumSyncEnabled = true` at the moment of the update).
      // Particularly important on dismissal so the operator knows whether
      // Demissao was set on the Secullum funcionario.
      const sync = response?.secullumSync;
      if (sync) {
        if (sync.status === "synced") {
          if (sync.reason === "demissão sincronizada") {
            toast.success(
              `Demissão sincronizada com Secullum (Funcionário #${sync.funcionarioId ?? "?"})`,
            );
          } else {
            toast.success(
              `Atualização sincronizada com Secullum (Funcionário #${sync.funcionarioId ?? "?"})`,
            );
          }
        } else if (sync.status === "skipped") {
          toast.warning(
            `Sincronização Secullum ignorada: ${sync.reason ?? "motivo desconhecido"}`,
          );
        } else if (sync.status === "error") {
          toast.error(
            `Falha ao sincronizar com Secullum: ${sync.reason ?? "erro desconhecido"}`,
          );
        }
      }

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

  // Helper to parse ISO date strings as local dates
  const parseLocalDate = (value: string | Date | null | undefined): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;

    // Extract date component and parse in local timezone to avoid timezone shifts
    const dateStr = typeof value === 'string' ? value.split('T')[0] : null;
    if (!dateStr) return null;

    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return null;

    // Create date in local timezone (month is 0-indexed)
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  };

  // Map user data to form default values
  // Memoize to prevent unnecessary re-renders
  // MUST be called before any conditional returns to maintain consistent hook order
  const defaultValues = useMemo<Partial<UserUpdateFormData> & {
    // Not part of UserUpdateFormData (read-only at the API). Carried so the
    // SecullumSyncSwitch can show "Vinculado ao funcionário Secullum #N".
    secullumEmployeeId?: number | null;
  }>(() => {
    if (!user) {
      return {};
    }

    const values = {
      name: user.name,
      email: user.email ?? null,
      phone: user.phone ?? null,
      cpf: user.cpf ?? null,
      pis: user.pis ?? null,
      positionId: user.positionId ?? null,
      performanceLevel: user.performanceLevel,
      sectorId: user.sectorId ?? null,
      isSectorLeader: Boolean(user.ledSector?.id),
      contractType: user.currentContractType ?? undefined,
      employeeType: user.currentEmployeeType ?? undefined,
      contractStatus: user.currentContractStatus ?? undefined,
      currentContractType: user.currentContractType ?? undefined, // for transition validation
      providerName: user.currentContract?.providerName ?? undefined,
      providerCnpj: user.currentContract?.providerCnpj ?? undefined,
      verified: user.verified,
      isActive: user.isActive,
      address: user.address ?? null,
      addressNumber: user.addressNumber ?? null,
      addressComplement: user.addressComplement ?? null,
      neighborhood: user.neighborhood ?? null,
      city: user.city ?? null,
      state: user.state ?? null,
      zipCode: user.zipCode ?? null,
      site: user.site ?? null,
      payrollNumber: user.payrollNumber ?? null,

      // Parse all dates to local timezone to avoid timezone shift bugs
      birth: parseLocalDate(user.birth),

      // Current vínculo dates — sourced from the current EmploymentContract.
      admissionDate: parseLocalDate(user.currentContract?.admissionDate ?? user.currentContract?.exp1StartAt),
      effectedAt: parseLocalDate(user.currentContract?.effectedAt),
      exp1StartAt: parseLocalDate(user.currentContract?.exp1StartAt ?? user.currentContract?.admissionDate),
      exp1EndAt: parseLocalDate(user.currentContract?.exp1EndAt),
      exp2StartAt: parseLocalDate(user.currentContract?.exp2StartAt),
      exp2EndAt: parseLocalDate(user.currentContract?.exp2EndAt),
      terminationDate: parseLocalDate(user.currentContract?.terminationDate),

      // PPE Sizes (CRITICAL - this was missing before!)
      ppeSize: user.ppeSize ? {
        shirts: user.ppeSize.shirts ?? null,
        boots: user.ppeSize.boots ?? null,
        pants: user.ppeSize.pants ?? null,
        shorts: user.ppeSize.shorts ?? null,
        sleeves: user.ppeSize.sleeves ?? null,
        mask: user.ppeSize.mask ?? null,
        gloves: user.ppeSize.gloves ?? null,
        rainBoots: user.ppeSize.rainBoots ?? null,
      } : {
        shirts: null,
        boots: null,
        pants: null,
        shorts: null,
        sleeves: null,
        mask: null,
        gloves: null,
        rainBoots: null,
      },

      // Secullum sync fields. The User type doesn't yet declare these but
      // Prisma includes them on the wire — cast and pull through so the
      // SecullumSyncSwitch / HorarioSelector reflect the persisted state.
      // Without these, opening an already-synced user in the form shows the
      // toggle as OFF and would silently disable sync on save.
      secullumSyncEnabled:
        (user as unknown as { secullumSyncEnabled?: boolean }).secullumSyncEnabled ?? false,
      secullumHorarioId:
        (user as unknown as { secullumHorarioId?: number | null }).secullumHorarioId ?? null,
      secullumEmployeeId:
        (user as unknown as { secullumEmployeeId?: number | null }).secullumEmployeeId ?? null,
    };

    return values;
    // Use stringified ID to ensure memo only recalculates when user actually changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Context-aware trail (shared page): "Departamento Pessoal" for accounting users,
  // "Administração" only when reached from that section. Must run before early returns.
  const breadcrumbs = useNavBreadcrumbs(
    [
      { label: "Início", href: routes.home },
      { label: "Administração", href: routes.administration.root },
      { label: "Colaboradores", href: routes.administration.collaborators.root },
      { label: user?.name ? truncateName(user.name) : "Colaborador", href: id ? routes.administration.collaborators.details(id) : undefined },
      { label: "Editar" },
    ],
    {
      leaf: [
        { label: user?.name ? truncateName(user.name) : "Colaborador", href: id ? routes.administration.collaborators.details(id) : undefined },
        { label: "Editar" },
      ],
    },
  );

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
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ACCOUNTING]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <PageHeader
            variant="form"
            title="Editar Colaborador"
            icon={IconUsers}
            breadcrumbs={breadcrumbs}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <UserForm mode="update" defaultValues={defaultValues} onSubmit={handleSubmit} isSubmitting={isUpdating} onFormStateChange={setFormState} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
export default EditCollaboratorPage;
