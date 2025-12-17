import { useParams, useNavigate } from "react-router-dom";
import { useRef, useState, useEffect, useCallback } from "react";
import { useAirbrushing } from "../../../../hooks";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { AirbrushingForm, type AirbrushingFormHandle } from "@/components/production/airbrushing/form/airbrushing-form";
import { IconBrush, IconCheck, IconArrowLeft } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import type { Airbrushing } from "../../../../types";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export const AirbrushingEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const formRef = useRef<AirbrushingFormHandle>(null);
  const [, forceUpdate] = useState({});

  // Redirect if no ID is provided
  useEffect(() => {
    if (!id) {
      console.error('[AirbrushingEdit] No ID provided, redirecting to list');
      navigate(routes.production.airbrushings.root);
    }
  }, [id, navigate]);

  // Track page for analytics
  usePageTracker({ title: "Aerografia - Editar" });

  // Fetch airbrushing data
  const { data, isLoading, isError } = useAirbrushing(id!, {
    enabled: !!id,
    include: {
      task: {
        include: {
          customer: {
            include: {
              logo: true,
            },
          },
          sector: true,
        },
      },
      receipts: true,
      invoices: true,
      artworks: true,
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

  // Handle form state changes to re-render button state
  // IMPORTANT: Must be memoized to prevent infinite loops
  const handleFormStateChange = useCallback(() => {
    forceUpdate({});
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL]}>
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
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL]}>
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
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL]}>
      <div className="h-full flex flex-col space-y-4">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Editar Aerografia"
            icon={IconBrush}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Produção", href: routes.production.root },
              { label: "Aerografia", href: routes.production.airbrushings.root },
              { label: `Aerografia #${airbrushing.id.slice(-8)}`, href: routes.production.airbrushings.details(airbrushing.id) },
              { label: "Editar" },
            ]}
            actions={[
              {
                key: "cancel",
                label: "Cancelar",
                icon: IconArrowLeft,
                onClick: handleCancel,
                variant: "outline",
              },
              {
                key: "submit",
                label: "Salvar",
                icon: IconCheck,
                onClick: () => formRef.current?.handleSubmit(),
                variant: "default",
                disabled: !formRef.current?.canSubmit(),
              },
            ]}
          />
        </div>
        <div className="flex-1 min-h-0 overflow-hidden pt-6">
          <AirbrushingForm
            className="h-full"
            ref={formRef}
            mode="edit"
            airbrushingId={id!}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
            onFormStateChange={handleFormStateChange}
          />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
