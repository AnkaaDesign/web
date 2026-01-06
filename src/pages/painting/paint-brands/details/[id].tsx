import { useParams, useNavigate } from "react-router-dom";
import { routes } from "../../../../constants";
import { usePaintBrand } from "../../../../hooks";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { IconAlertCircle, IconEdit, IconTag } from "@tabler/icons-react";
import { PaintBrandSpecificationsCard, PaintBrandComponentsCard, PaintBrandRelatedPaintsCard } from "@/components/painting/paint-brand/detail";
import { useAuth } from "@/contexts/auth-context";
import { canEditPaintBrands } from "@/utils/permissions/entity-permissions";
import { PAGE_SPACING } from "@/lib/layout-constants";

export function PaintBrandDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = canEditPaintBrands(user);

  // Fetch paint brand with all related data
  const {
    data: paintBrandResponse,
    isLoading,
    error,
  } = usePaintBrand(id || "", {
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
          paintType: true,
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

  const paintBrand = paintBrandResponse?.data;

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

  if (error || !paintBrand) {
    return (
      <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto px-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-2">
              <CardTitle className="text-xl font-bold">Detalhes da Marca de Tinta</CardTitle>
              <Breadcrumb />
            </div>
          </CardHeader>
        </Card>
        <Alert variant="destructive">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>{error ? "Erro ao carregar marca de tinta" : "Marca de tinta não encontrada"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="detail"
        title={paintBrand.name}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Pintura", href: routes.painting.root },
          { label: "Marcas de Tinta", href: routes.painting.paintBrands.root },
          { label: paintBrand.name },
        ]}
        actions={
          canEdit ? [
            {
              key: "edit",
              label: "Editar",
              icon: IconEdit,
              onClick: () => navigate(routes.painting.paintBrands.edit(id!)),
            },
          ] : []
        }
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="space-y-4">
          {/* Top section - Specifications and Related Paints */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left column - Specifications */}
            <div className="lg:col-span-1">
              <PaintBrandSpecificationsCard paintBrand={paintBrand} />
            </div>

            {/* Right column - Related paints */}
            <div className="lg:col-span-2">
              <PaintBrandRelatedPaintsCard paintBrand={paintBrand} />
            </div>
          </div>

          {/* Bottom section - Components (Full Width) */}
          <PaintBrandComponentsCard paintBrand={paintBrand} />
        </div>
      </div>
    </div>
  );
}

export default PaintBrandDetailsPage;
