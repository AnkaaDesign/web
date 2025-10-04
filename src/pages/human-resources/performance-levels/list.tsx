import { useState, useEffect, useRef } from "react";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { SECTOR_PRIVILEGES } from "../../../constants/enums";
import { PerformanceLevelList } from "@/components/human-resources/performance-levels/performance-level-list";
import { IconTrendingUp, IconDeviceFloppy, IconRestore } from "@tabler/icons-react";
import type { PerformanceLevelListRef } from "@/components/human-resources/performance-levels/performance-level-list";

export default function PerformanceLevelsListPage() {
  const [pendingChanges, setPendingChanges] = useState<Map<string, number>>(new Map());
  const [modifiedUsers, setModifiedUsers] = useState<Set<string>>(new Set());
  const tableRef = useRef<PerformanceLevelListRef>(null);

  const breadcrumbs = [
    { label: "Início", href: routes.home },
    { label: "Recursos Humanos", href: routes.humanResources.root },
    { label: "Níveis de Desempenho" },
  ];

  // Set document title
  useEffect(() => {
    document.title = "Níveis de Desempenho - Ankaa";
  }, []);

  const handleSaveAll = () => {
    if (tableRef.current?.saveAllChanges) {
      tableRef.current.saveAllChanges();
    }
  };

  const handleRevertAll = () => {
    if (tableRef.current?.revertAllChanges) {
      tableRef.current.revertAllChanges();
    }
  };

  const hasUnsavedChanges = modifiedUsers.size > 0;

  // Page actions including Save/Revert buttons
  const pageActions = hasUnsavedChanges ? [
    {
      key: "revert",
      label: "Reverter",
      icon: IconRestore,
      onClick: handleRevertAll,
      variant: "outline" as const,
      group: "secondary" as const,
    },
    {
      key: "save",
      label: `Salvar ${modifiedUsers.size} ${modifiedUsers.size === 1 ? 'alteração' : 'alterações'}`,
      icon: IconDeviceFloppy,
      onClick: handleSaveAll,
      variant: "default" as const,
      group: "primary" as const,
    },
  ] : [];

  return (
    <PrivilegeRoute
      requiredPrivileges={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES]}
      fallback={<div>Acesso negado</div>}
    >
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Níveis de Desempenho"
            icon={IconTrendingUp}
            favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_NIVEIS_DESEMPENHO_LISTAR}
            breadcrumbs={breadcrumbs}
            actions={pageActions}
          />
        </div>
        <PerformanceLevelList
          ref={tableRef}
          className="flex-1 min-h-0"
          onPendingChangesUpdate={(changes, modified) => {
            setPendingChanges(changes);
            setModifiedUsers(modified);
          }}
        />
      </div>
    </PrivilegeRoute>
  );
}