import { PaintCatalogueList } from "@/components/paint/catalogue/list/paint-catalogue-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconPaint, IconPlus, IconDeviceFloppy, IconRestore } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { batchUpdatePaintColorOrder } from "@/api-client/paint";
import { toast } from "@/components/ui/sonner";
import type { Paint } from "@/types";
import { useAuth } from "@/contexts/auth-context";
import { hasAnyPrivilege } from "@/utils";

export function CatalogListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hasOrderChanges, setHasOrderChanges] = useState(false);
  const [reorderedPaints, setReorderedPaints] = useState<Paint[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Track page access
  usePageTracker({
    title: "Catálogo de Tintas",
    icon: "paint",
  });

  // Check if user can create paints (WAREHOUSE or ADMIN only)
  const canCreatePaint = hasAnyPrivilege(user, [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]);

  const handleOrderStateChange = (hasChanges: boolean, orderedPaints: Paint[]) => {
    setHasOrderChanges(hasChanges);
    setReorderedPaints(orderedPaints);
  };

  const handleSaveOrder = async () => {
    try {
      setIsSaving(true);
      const updates = reorderedPaints.map((paint, index) => ({
        id: paint.id,
        colorOrder: index + 1,
      }));

      await batchUpdatePaintColorOrder({ updates });
      toast.success("Ordem das tintas salva com sucesso");
      setHasOrderChanges(false);
      // Trigger a refetch by calling the global handler
      if ((window as any).__paintOrderSaved) {
        (window as any).__paintOrderSaved();
      }
    } catch (error) {
      console.error("Erro ao salvar ordem:", error);
      toast.error("Erro ao salvar ordem das tintas");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetOrder = () => {
    if ((window as any).__resetPaintOrder) {
      (window as any).__resetPaintOrder();
    }
    setHasOrderChanges(false);
  };

  const actions = [];

  // Only WAREHOUSE and ADMIN can create paints
  if (canCreatePaint) {
    actions.push({
      key: "create",
      label: "Nova Tinta",
      icon: IconPlus,
      onClick: () => navigate(routes.painting.catalog.create),
      variant: "default" as const,
    });
  }

  if (hasOrderChanges) {
    actions.unshift(
      {
        key: "reset",
        label: "Resetar Ordem",
        icon: IconRestore,
        onClick: handleResetOrder,
        variant: "outline" as const,
      },
      {
        key: "save",
        label: isSaving ? "Salvando..." : "Salvar Ordem",
        icon: IconDeviceFloppy,
        onClick: handleSaveOrder,
        variant: "default" as const,
        disabled: isSaving,
      }
    );
  }

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Catálogo de Tintas"
            icon={IconPaint}
            favoritePage={FAVORITE_PAGES.PINTURA_CATALOGO_LISTAR}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Pintura", href: routes.painting.root }, { label: "Catálogo" }]}
            actions={actions}
          />
        </div>
        <PaintCatalogueList
          className="flex-1 min-h-0"
          onOrderStateChange={handleOrderStateChange}
          onSaveOrderRequest={handleSaveOrder}
          onResetOrderRequest={handleResetOrder}
        />
      </div>
    </PrivilegeRoute>
  );
}
