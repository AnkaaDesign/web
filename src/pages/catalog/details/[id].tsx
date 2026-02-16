import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IconRefresh } from "@tabler/icons-react";
import { usePaint } from "@/hooks";
import { routes, SECTOR_PRIVILEGES } from "@/constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingPage } from "@/components/navigation/loading-page";
import { ErrorCard } from "@/components/ui/error-card";
import { PaintSpecificationsCard, PaintFormulasCard, RelatedPaintsCard, GroundPaintsCard } from "@/components/painting/catalogue/detail";

/**
 * View-only Catalog Details Page for Designers
 *
 * This page provides read-only access to paint details.
 * Features:
 * - No edit button
 * - No delete button
 * - No production history (warehouse-specific)
 * - View-only access to paint specifications, formulas, and related paints
 */
export default function CatalogDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: response,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = usePaint(id!, {
    include: {
      paintType: true,
      paintBrand: true,
      formulas: {
        include: {
          components: {
            include: {
              item: true,
            },
          },
          paintProduction: true,
          paint: true,
        },
      },
      relatedPaints: true,
      relatedTo: true,
      paintGrounds: {
        include: {
          groundPaint: {
            include: {
              paintType: true,
              paintBrand: true,
            },
          },
        },
      },
    },
    enabled: !!id,
  });

  // Simulate individual loading states for better UX
  const formulasLoadingState = useMemo(() => {
    if (isLoading) {
      return { isLoading: true, error: null };
    }
    if (error) {
      return { isLoading: false, error };
    }
    return { isLoading: false, error: null };
  }, [isLoading, error]);

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="min-h-screen flex items-center justify-center">
          <LoadingPage />
        </div>
      </PrivilegeRoute>
    );
  }

  if (error || !response?.data) {
    const isNetworkError = error?.message?.includes("Network") || error?.message?.includes("timeout");

    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="min-h-screen flex items-center justify-center p-4">
          <ErrorCard
            title={isNetworkError ? "Erro de conexão" : "Tinta não encontrada"}
            description={isNetworkError ? "Não foi possível carregar os dados da tinta. Verifique sua conexão." : "A tinta que você está procurando não existe ou foi excluída."}
            onRetry={isNetworkError ? refetch : () => navigate(routes.catalog.root)}
          />
        </div>
      </PrivilegeRoute>
    );
  }

  const paint = response.data;

  const handleRefresh = () => {
    refetch();
  };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col px-4 pt-4">
        <PageHeader
          variant="detail"
          entity={paint}
          title={paint.name}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: handleRefresh,
              loading: isRefetching,
            },
            // No edit or delete buttons - view only
          ]}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Catálogo", href: routes.catalog.root },
            { label: paint.name },
          ]}
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="mt-4">
            {/* Row 1: Specifications + (Formulas + Fundos Recomendados) */}
            <div className="animate-in fade-in-50 duration-500 transition-all">
            {/* Mobile: Single column */}
            <div className="block lg:hidden space-y-4">
              <PaintSpecificationsCard paint={paint} className="h-auto" />
              <PaintFormulasCard paint={paint} className="h-auto" isLoading={formulasLoadingState.isLoading} error={formulasLoadingState.error} onRetry={refetch} onFormulaDeleted={refetch} />
              {paint.paintGrounds && paint.paintGrounds.length > 0 && (
                <GroundPaintsCard paint={paint} className="h-auto" />
              )}
            </div>

            {/* Desktop: 2 columns - Specifications + (Formulas + Fundos) */}
            <div className="hidden lg:block">
              <div className="grid grid-cols-2 gap-4 items-start">
                {/* Column 1: Specifications */}
                <PaintSpecificationsCard paint={paint} className="h-full" />

                {/* Column 2: Formulas + Fundos Recomendados */}
                <div className="flex flex-col gap-4 h-full">
                  <PaintFormulasCard paint={paint} className="flex-1 min-h-0" isLoading={formulasLoadingState.isLoading} error={formulasLoadingState.error} onRetry={refetch} onFormulaDeleted={refetch} />
                  {paint.paintGrounds && paint.paintGrounds.length > 0 && (
                    <GroundPaintsCard paint={paint} className="h-[200px] flex-shrink-0" />
                  )}
                </div>
              </div>
            </div>
            </div>

            {/* Row 2: Related Paints Section */}
            {((paint.relatedPaints && paint.relatedPaints.length > 0) || (paint.relatedTo && paint.relatedTo.length > 0)) && (
              <div className="animate-in fade-in-50 duration-700 transition-all">
                <RelatedPaintsCard paint={paint} />
              </div>
            )}

            {/* Note: No Task History or Production History - these are warehouse-specific features */}
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
}
