import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconEdit, IconTrash, IconRefresh, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, CHANGE_LOG_ENTITY_TYPE, EMPLOYEE_TYPE } from "../../../../constants";
import { useUser, useUserMutations } from "../../../../hooks";
import { useAuth } from "@/contexts/auth-context";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { BasicInfoCard, AddressCard, ProfessionalInfoCard, LoginInfoCard, RelatedActivitiesCard, PpeSizesCard, EmploymentHistoryCard } from "@/components/administration/user/detail";
import { UserDocumentationCard } from "@/components/personnel-department/admission/user-documentation-card";
import { UserPositionHistoryCard } from "@/components/personnel-department/user-position-history/detail/user-position-history-card";
import { UserBenefitsCard } from "@/components/personnel-department/user-benefit/user-benefits-card";
import { DependentsCard } from "@/components/human-resources/dependent/dependents-card";
import { CollaboratorLoansCard } from "@/components/personnel-department/collaborator-loans-card";
import { UserDetailSkeleton } from "@/components/administration/user/detail/user-detail-skeleton";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useNavBreadcrumbs } from "@/contexts/navigation-context";
import { canEditUsers, canDeleteUsers } from "@/utils/permissions/entity-permissions";

const CollaboratorDetailsPage = () => {
  usePageTracker({ title: "Detalhes do Colaborador" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const canEdit = canEditUsers(currentUser);
  const canDelete = canDeleteUsers(currentUser);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Históricos (Vínculos / Cargos) render only when they have records. Each card
  // reports its row count via onCount; we keep a paired row clean when one or
  // both are empty (no orphan "Nenhum registro" placeholder cards).
  const [employmentCount, setEmploymentCount] = useState<number | null>(null);
  const [positionCount, setPositionCount] = useState<number | null>(null);

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useUser(id || "", {
    include: {
      position: true,
      sector: true,
      ledSector: true,
      ppeSize: true,
      avatar: true,
      currentContract: true,
      activities: {
        include: {
          item: true,
        },
      },
      changeLogs: true,
    },
    enabled: !!id,
  });

  const user = response?.data;
  const mutations = useUserMutations();

  // Payroll loans / advances only apply to CLT vínculos; off-payroll
  // categories (terceirizado/PJ/autônomo/estagiário) don't accrue them, so we
  // hide that card to keep the page focused.
  const isCltCollaborator =
    (user?.currentContract?.employeeType ?? (user as unknown as { currentEmployeeType?: EMPLOYEE_TYPE })?.currentEmployeeType) ===
    EMPLOYEE_TYPE.CLT;

  // Context-aware trail (shared page): "Departamento Pessoal" for accounting users,
  // "Administração" only when reached from that section. Must run before early returns.
  const breadcrumbs = useNavBreadcrumbs(
    [
      { label: "Início", href: "/" },
      { label: "Administração", href: routes.administration.root },
      { label: "Colaboradores", href: routes.administration.collaborators.root },
      { label: user?.name ?? "Detalhes" },
    ],
    { leaf: [{ label: user?.name ?? "Detalhes" }] },
  );

  if (!id) {
    return <Navigate to={routes.administration.collaborators.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar colaborador</p>
        <Navigate to={routes.administration.collaborators.root} replace />
      </div>
    );
  }

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.PRODUCTION_MANAGER, SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES]}>
        <UserDetailSkeleton />
      </PrivilegeRoute>
    );
  }

  if (!user) {
    return <Navigate to={routes.administration.collaborators.root} replace />;
  }

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await mutations.delete(id);
      navigate(routes.administration.collaborators.root);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error deleting collaborator:", error);
      }
      setIsDeleteDialogOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.PRODUCTION_MANAGER, SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title={user.name}
          breadcrumbs={breadcrumbs}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => refetch(),
            },
            ...(canEdit ? [
              {
                key: "edit",
                label: "Editar",
                icon: IconEdit,
                onClick: () => navigate(routes.administration.collaborators.edit(id)),
              },
            ] : []),
            ...(canDelete ? [
              {
                key: "delete",
                label: "Excluir",
                icon: IconTrash,
                onClick: () => setIsDeleteDialogOpen(true),
              },
            ] : []),
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          {/* Identidade → Trabalho → Documentos/EPI → Históricos → Folha → Auditoria.
              Cards são pareados em 2 colunas (lg+); tabelas largas (Benefícios,
              Dependentes) ocupam a linha inteira. O grid usa o stretch padrão para
              que cada card acompanhe a altura do irmão na mesma linha. */}
          <div className="space-y-4">
            {/* Identidade: Informações Básicas + Dados Profissionais */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BasicInfoCard user={user} />
              <ProfessionalInfoCard user={user} />
            </div>

            {/* Endereço + Informações de Login */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AddressCard user={user} />
              <LoginInfoCard user={user} />
            </div>

            {/* Documentação (Admissão) + Tamanho de EPI */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <UserDocumentationCard userId={user.id} />
              <PpeSizesCard user={user} />
            </div>

            {/* Registros / históricos lado a lado: Vínculos + Cargos.
                O grid permanece SEMPRE em 2 colunas: Vínculos ocupa a coluna 1
                (meia largura) e nunca se expande para a página inteira. Cargos
                renderiza na coluna 2 apenas quando tem registros — quando vazia,
                a coluna 2 fica simplesmente em branco (sem card-fantasma de
                "Nenhum registro"). Ambos ficam montados (zero altura quando
                vazios) para que os onCount disparem. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <div className={(employmentCount ?? 0) > 0 ? undefined : "hidden"}>
                <EmploymentHistoryCard userId={id} maxHeight="500px" className="h-[500px]" onCount={setEmploymentCount} />
              </div>
              <div className={(positionCount ?? 0) > 0 ? undefined : "hidden"}>
                <UserPositionHistoryCard userId={id} maxHeight="500px" className="h-[500px]" onCount={setPositionCount} />
              </div>
            </div>

            {/* Benefícios ativos (Empresa × Colaborador) — tabela larga */}
            <UserBenefitsCard userId={id} />

            {/* Dependentes (IRRF / Salário-Família) — tabela larga */}
            <DependentsCard userId={id} />

            {/* Folha: Empréstimos / Adiantamentos — somente CLT */}
            {isCltCollaborator && <CollaboratorLoansCard userId={id} />}

            {/* Auditoria: Atividades + Histórico de Alterações (changelog) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <RelatedActivitiesCard user={user} maxHeight="700px" className="h-[700px]" />
              <ChangelogHistory entityType={CHANGE_LOG_ENTITY_TYPE.USER} entityId={id} maxHeight="700px" className="h-[700px]" />
            </div>
          </div>
        </div>

        {/* Delete Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IconAlertTriangle className="h-5 w-5 text-destructive" />
                Confirmar Exclusão
              </DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir o colaborador "{user.name}"?
                Esta ação não poderá ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconTrash className="h-4 w-4 mr-2" />}
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PrivilegeRoute>
  );
};

export default CollaboratorDetailsPage;
