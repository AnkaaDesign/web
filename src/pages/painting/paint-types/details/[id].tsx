import { useParams, useNavigate } from "react-router-dom";
import { routes } from "../../../../constants";
import { usePaintType } from "../../../../hooks";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { IconAlertCircle, IconEdit, IconPaint } from "@tabler/icons-react";
import { PaintTypeSpecificationsCard, PaintTypeComponentsCard, PaintTypeRelatedPaintsCard } from "@/components/painting/paint-type/detail";
import { useAuth } from "@/contexts/auth-context";
import { canEditPaintTypes } from "@/utils/permissions/entity-permissions";

export function PaintTypeDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = canEditPaintTypes(user);

  // Fetch paint type with all related data
  const {
    data: paintTypeResponse,
    isLoading,
    error,
  } = usePaintType(id || "", {
    include: {
      componentItems: {
        include: {
          measures: true,
          category: true,
          brand: true,
        },
      },
      paints: {
        orderBy: { name: "asc" },
        include: {
          formulas: {
            include: {
              _count: {
                select: {
                  components: true,
                },
              },
            },
          },
        },
      },
      _count: {
        select: {
          paints: true,
          componentItems: true,
        },
      },
    },
    enabled: !!id,
  });

  const paintType = paintTypeResponse?.data;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto px-6">
        {/* Header skeleton */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10" />
                <div>
                  <Skeleton className="h-7 w-64 mb-2" />
                  <Skeleton className="h-4 w-96" />
                </div>
              </div>
              <Skeleton className="h-10 w-32" />
            </div>
          </CardHeader>
        </Card>

        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <div className="px-6 pb-6 space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </Card>
          </div>
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <div className="px-6 pb-6">
                <Skeleton className="h-32 w-full" />
              </div>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <div className="px-6 pb-6">
                <Skeleton className="h-32 w-full" />
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error || !paintType) {
    return (
      <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto px-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-2">
              <CardTitle className="text-xl font-bold">Detalhes do Tipo de Tinta</CardTitle>
              <Breadcrumb />
            </div>
          </CardHeader>
        </Card>
        <Alert variant="destructive">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>{error ? "Erro ao carregar tipo de tinta" : "Tipo de tinta não encontrado"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <PageHeader
        variant="detail"
        title={paintType.name}
        icon={IconPaint}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Pintura", href: routes.painting.root },
          { label: "Tipos de Tinta", href: routes.painting.paintTypes.root },
          { label: paintType.name },
        ]}
        actions={
          canEdit ? [
            {
              key: "edit",
              label: "Editar",
              icon: IconEdit,
              onClick: () => navigate(routes.painting.paintTypes.edit(id!)),
            },
          ] : []
        }
      />

      {/* Content wrapper with proper height management */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6">
          {/* Top section - Specifications and Related Paints */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column - Specifications */}
            <div className="lg:col-span-1">
              <PaintTypeSpecificationsCard paintType={paintType} />
            </div>

            {/* Right column - Related paints */}
            <div className="lg:col-span-2">
              <PaintTypeRelatedPaintsCard paintType={paintType} />
            </div>
          </div>

          {/* Bottom section - Components (Full Width) */}
          <div>
            <PaintTypeComponentsCard paintType={paintType} />
          </div>
        </div>
      </div>
    </div>
  );
}
