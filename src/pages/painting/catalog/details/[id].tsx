import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IconPaint, IconTrash, IconRefresh, IconEdit } from "@tabler/icons-react";

import { usePaint, usePaintMutations } from "../../../../hooks";
import { routes } from "../../../../constants";
import { useAuth } from "@/contexts/auth-context";
import { canEditPaints } from "@/utils/permissions/entity-permissions";
import { PAGE_SPACING } from "@/lib/layout-constants";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingPage } from "@/components/navigation/loading-page";
import { ErrorCard } from "@/components/ui/error-card";
import { PaintSpecificationsCard, PaintFormulasCard, PaintProductionHistoryCard, RelatedPaintsCard, GroundPaintsCard } from "@/components/painting/catalogue/detail";
import { PaintTasksTable } from "@/components/painting/catalogue/detail/paint-tasks-table";
import { PaintWithFormulasChangelogHistory } from "@/components/painting/catalogue/detail/paint-with-formulas-changelog-history";

export default function PaintDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = canEditPaints(user);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
      generalPaintings: {
        include: {
          customer: true,
          createdBy: true,
          sector: true,
          services: true,
        },
      },
      logoTasks: {
        include: {
          customer: true,
          createdBy: true,
          sector: true,
          services: true,
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

  const { deleteMutation } = usePaintMutations({
    onDeleteSuccess: () => {
      navigate(routes.painting.catalog.root);
    },
  });


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingPage />
      </div>
    );
  }

  if (error || !response?.data) {
    const isNetworkError = error?.message?.includes("Network") || error?.message?.includes("timeout");

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <ErrorCard
          title={isNetworkError ? "Erro de conexão" : "Tinta não encontrada"}
          description={isNetworkError ? "Não foi possível carregar os dados da tinta. Verifique sua conexão." : "A tinta que você está procurando não existe ou foi excluída."}
          onRetry={isNetworkError ? refetch : () => navigate(routes.painting.catalog.root)}
        />
      </div>
    );
  }

  const paint = response.data;

  const handleRefresh = () => {
    refetch();
  };

  const handleEdit = () => {
    navigate(routes.painting.catalog.edit(paint.id));
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(paint.id);
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
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
        ...(canEdit ? [{
          key: "edit",
          label: "Editar",
          icon: IconEdit,
          onClick: handleEdit,
        }] : []),
        ...(canEdit ? [{
          key: "delete",
          label: "Excluir",
          icon: IconTrash,
          onClick: () => setShowDeleteDialog(true),
        }] : []),
      ]}
      breadcrumbs={[
        { label: "Início", href: routes.home },
        { label: "Pintura", href: routes.painting.root },
        { label: "Catálogo", href: routes.painting.catalog.root },
        { label: paint.name },
      ]}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto pb-6">
        {/* Row 1: Specifications + (Formulas + Fundos Recomendados) */}
        <div className="animate-in fade-in-50 duration-500 transition-all">
          {/* Mobile: Single column */}
          <div className="block lg:hidden space-y-4">
            <PaintSpecificationsCard paint={paint} className="h-auto" />
            <PaintFormulasCard paint={paint} className="h-auto" isLoading={formulasLoadingState.isLoading} error={formulasLoadingState.error} onRetry={refetch} />
            {paint.paintGrounds && paint.paintGrounds.length > 0 && (
              <GroundPaintsCard paint={paint} className="h-auto" />
            )}
          </div>

          {/* Desktop: 2 columns - Specifications + (Formulas + Fundos) */}
          <div className="hidden lg:block">
            <div className="grid grid-cols-2 items-start gap-4">
              {/* Column 1: Specifications */}
              <PaintSpecificationsCard paint={paint} className="h-full" />

              {/* Column 2: Formulas + Fundos Recomendados */}
              <div className="flex flex-col h-full gap-4">
                <PaintFormulasCard paint={paint} className="flex-1 min-h-0" isLoading={formulasLoadingState.isLoading} error={formulasLoadingState.error} onRetry={refetch} />
                {paint.paintGrounds && paint.paintGrounds.length > 0 && (
                  <GroundPaintsCard paint={paint} className="h-[200px] flex-shrink-0" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Related Paints Section */}
        {((paint.relatedPaints && paint.relatedPaints.length > 0) || (paint.relatedTo && paint.relatedTo.length > 0)) && (
          <div className="animate-in fade-in-50 duration-700 transition-all">
            <RelatedPaintsCard paint={paint} />
          </div>
        )}

        {/* Row 3: Task History - Full Width */}
        <div className="animate-in fade-in-50 duration-700 transition-all">
          <PaintTasksTable paint={paint} />
        </div>

        {/* Row 4: Production History - Full Width */}
        <div className="animate-in fade-in-50 duration-900 transition-all">
          <PaintProductionHistoryCard paint={paint} className="h-auto lg:h-[550px]" />
        </div>

        {/* Row 5: Changelog - Full Width */}
        <div className="animate-in fade-in-50 duration-1000 transition-all">
          <PaintWithFormulasChangelogHistory paint={paint} className="h-auto lg:h-[600px]" />
        </div>
      </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente a tinta <span className="font-semibold">{paint.name}</span> e todas as suas informações relacionadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
