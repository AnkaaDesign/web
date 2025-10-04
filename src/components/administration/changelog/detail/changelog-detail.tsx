import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconHistory, IconArrowLeft, IconRefresh } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { useChangeLog } from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { ChangelogBasicInfoCard, ChangelogChangesCard, ChangelogMetadataCard, ChangelogTriggeredByCard } from ".";
import { ChangelogDetailSkeleton } from "./changelog-detail-skeleton";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const ChangelogDetailPage = () => {
  usePageTracker({ title: "Detalhes do Histórico de Alterações" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useChangeLog(id || "", {
    include: {
      user: true,
    },
    enabled: !!id,
  });

  const changelog = response?.data;

  if (!id) {
    return <Navigate to={routes.administration.changeLogs.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar histórico</p>
        <Navigate to={routes.administration.changeLogs.root} replace />
      </div>
    );
  }

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.BASIC}>
        <ChangelogDetailSkeleton />
      </PrivilegeRoute>
    );
  }

  if (!changelog) {
    return <Navigate to={routes.administration.changeLogs.root} replace />;
  }

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.BASIC}>
      <div className="flex flex-col h-full space-y-6">
        <PageHeader
          variant="detail"
          title={`Alteração #${changelog.id.substring(0, 8)}`}
          icon={IconHistory}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Administração" },
            { label: "Histórico de Alterações", href: routes.administration.changeLogs.root },
            { label: `#${changelog.id.substring(0, 8)}` },
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => refetch(),
              variant: "ghost",
            },
            {
              key: "back",
              label: "Voltar",
              icon: IconArrowLeft,
              onClick: () => navigate(routes.administration.changeLogs.root),
              variant: "outline",
            },
          ]}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6">
            {/* Core Information Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChangelogBasicInfoCard changelog={changelog} />
              <ChangelogChangesCard changelog={changelog} />
            </div>

            {/* Metadata and Triggered By Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChangelogMetadataCard changelog={changelog} />
              <ChangelogTriggeredByCard changelog={changelog} />
            </div>
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};
