import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { IconRefresh } from "@tabler/icons-react";

import { usePaintFormula, usePaintProductionMutations } from "../../../../../../../hooks";
import { routes, SECTOR_PRIVILEGES } from "../../../../../../../constants";
import { useAuth } from "@/contexts/auth-context";
import type { PaintProductionCreateFormData } from "../../../../../../../schemas";

import { Card, CardContent } from "@/components/ui/card";
import { LoadingPage } from "@/components/navigation/loading-page";
import { ErrorCard } from "@/components/ui/error-card";
import { FormulaCalculator } from "@/components/painting/formula/formula-calculator";
import { PageHeader } from "@/components/ui/page-header";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { usePrinter } from "@/components/common/printer";

export default function FormulaDetailsPage() {
  const { id: paintId, formulaId } = useParams<{ id: string; formulaId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openPrintDialog } = usePrinter();
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);

  // Only COMMERCIAL, ADMIN, FINANCIAL can see prices (WAREHOUSE excluded)
  const userPrivilege = user?.sector?.privileges;
  const canSeePrices = userPrivilege === SECTOR_PRIVILEGES.COMMERCIAL ||
    userPrivilege === SECTOR_PRIVILEGES.ADMIN ||
    userPrivilege === SECTOR_PRIVILEGES.FINANCIAL;

  // Fetch formula with all necessary includes
  const {
    data: formulaResponse,
    isLoading,
    error,
    refetch,
  } = usePaintFormula(formulaId!, {
    include: {
      paint: { include: { paintType: true } },
      components: {
        include: {
          item: true,
        },
      },
    },
    enabled: !!formulaId,
  });

  // Paint production mutations
  const { create: createProduction } = usePaintProductionMutations({
    onCreateSuccess: () => {
      setShowPrintConfirm(true);
    },
  });

  const handleStartProduction = async (data: { formulaId: string; weight: number }) => {
    if (!formulaId) return;

    // Use the actual formula density for accurate weight-to-volume conversion
    const density = formula.density || 1.0; // g/ml
    const volumeLiters = data.weight / (density * 1000); // Convert grams to liters using actual density

    const productionData: PaintProductionCreateFormData = {
      formulaId: data.formulaId,
      volumeLiters: volumeLiters,
    };

    await createProduction(productionData);
  };

  const handleSkipPrint = () => {
    setShowPrintConfirm(false);
    navigate(routes.painting.catalog.root);
  };

  const handleConfirmPrint = () => {
    setShowPrintConfirm(false);
    if (paint) {
      openPrintDialog(paint, { onClose: () => navigate(routes.painting.catalog.root) });
    } else {
      navigate(routes.painting.catalog.root);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingPage />
      </div>
    );
  }

  if (error || !formulaResponse?.data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <ErrorCard
          title="Fórmula não encontrada"
          description="A fórmula que você está procurando não existe ou foi excluída."
          onRetry={() => navigate(routes.painting.catalog.details(paintId!))}
        />
      </div>
    );
  }

  const formula = formulaResponse.data;
  const paint = formula.paint;

  // Create breadcrumb data
  const breadcrumbItems = [
    { label: "Início", href: routes.home },
    { label: "Pintura", href: routes.painting.root },
    { label: "Catálogo", href: routes.painting.catalog.root },
    { label: paint?.name || "Tinta", href: routes.painting.catalog.details(paintId!) },
    { label: "Fórmulas", href: routes.painting.catalog.formulas(paintId!) },
    { label: formula.description || "Fórmula" },
  ];

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <PageHeader
        variant="detail"
        title={`${paint?.name || "Tinta"} - ${formula.description}`}
        breadcrumbs={breadcrumbItems}
        actions={[
        {
          key: "refresh",
          label: "Atualizar",
          icon: IconRefresh,
          onClick: refetch,
        },
        ]}
      />
      <div className="flex-1 overflow-y-auto pb-6">
        {/* Main content */}
        {/* Formula calculator */}
        <div className="mt-4">
          <Card className="shadow-sm border border-border animate-in fade-in-50 duration-500">
            <CardContent className="pt-6">
              <FormulaCalculator formula={formula} onStartProduction={handleStartProduction} allowPriceVisibility={canSeePrices} />
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showPrintConfirm} onOpenChange={(open) => !open && handleSkipPrint()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Produção registrada</AlertDialogTitle>
            <AlertDialogDescription>Deseja imprimir a etiqueta da tinta agora?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Agora não</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPrint}>Imprimir etiqueta</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
