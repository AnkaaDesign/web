import { useParams, useNavigate } from "react-router-dom";
import { useAirbrushing } from "../../../../hooks";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { AirbrushingForm } from "@/components/production/airbrushing/form/airbrushing-form";
import { IconBrush } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import type { Airbrushing } from "../../../../types";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export const AirbrushingEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Track page for analytics
  usePageTracker({ title: "Aerografia - Editar" });

  // Fetch airbrushing data
  const { data, isLoading, isError } = useAirbrushing(id!, {
    enabled: !!id,
    include: {
      task: {
        include: {
          customer: true,
          sector: true,
        },
      },
      files: true,
    },
  });

  const airbrushing = data?.data;

  const handleSuccess = (updatedAirbrushing: Airbrushing) => {
    navigate(routes.production.airbrushings.details(updatedAirbrushing.id));
  };

  const handleCancel = () => {
    if (id) {
      navigate(routes.production.airbrushings.details(id));
    } else {
      navigate(routes.production.airbrushings.root);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
        <div className="h-full flex flex-col space-y-4">
          <div className="flex-shrink-0">
            <PageHeader
              variant="form"
              title="Carregando..."
              icon={IconBrush}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Produção", href: routes.production.root },
                { label: "Aerografia", href: routes.production.airbrushings.root },
                { label: "Editar" },
              ]}
            />
          </div>
          <div className="flex-1 space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <Skeleton className="h-8 w-1/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-32 w-full" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  // Error or not found state
  if (isError || !airbrushing) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
        <div className="h-full flex flex-col space-y-4">
          <div className="flex-shrink-0">
            <PageHeader
              variant="form"
              title="Aerografia não encontrada"
              icon={IconBrush}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Produção", href: routes.production.root },
                { label: "Aerografia", href: routes.production.airbrushings.root },
                { label: "Editar" },
              ]}
              backButton={{
                onClick: () => navigate(routes.production.airbrushings.root),
              }}
            />
          </div>
          <div className="flex-1">
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-red-800 font-medium">Aerografia não encontrada</p>
                    <p className="text-red-600 text-sm mt-1">A aerografia solicitada não existe ou você não tem permissão para acessá-la.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="h-full">
        <div className="flex flex-col h-full space-y-4">
          <div className="flex-shrink-0">
            <PageHeader
              variant="form"
              title="Editar Aerografia"
              icon={IconBrush}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Produção", href: routes.production.root },
                { label: "Aerografia", href: routes.production.airbrushings.root },
                { label: `Aerografia #${airbrushing.id.slice(-8)}`, href: routes.production.airbrushings.details(airbrushing.id) },
                { label: "Editar" },
              ]}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <AirbrushingForm mode="edit" airbrushingId={id!} onSuccess={handleSuccess} onCancel={handleCancel} className="h-full" />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};
