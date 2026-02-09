import { useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { TimeAdjustmentRequests } from "@/components/integrations/secullum/requests/time-adjustment-requests";
import { IconRefresh, IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { routes } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

function RequisicosList() {
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [onApprove, setOnApprove] = useState<(() => void) | null>(null);
  const [onReject, setOnReject] = useState<(() => void) | null>(null);
  const [onRefresh, setOnRefresh] = useState<(() => void) | null>(null);

  // Track page access
  usePageTracker({
    title: "Ajustes de Ponto",
    icon: "clock-edit",
  });

  // Memoize the actions change callback to prevent infinite re-renders
  const handleActionsChange = useCallback((approve: (() => void) | null, reject: (() => void) | null, refresh: (() => void) | null) => {
    setOnApprove(() => approve);
    setOnReject(() => reject);
    setOnRefresh(() => refresh);
  }, []);

  // Build actions for header based on selected request
  const getHeaderActions = () => {
    const actions = [];

    // Force all actions to be in secondary group to maintain our order
    // Add Atualizar first
    if (onRefresh) {
      actions.push({
        key: "refresh",
        label: "Atualizar",
        icon: IconRefresh,
        onClick: onRefresh,
        variant: "outline" as const,
        group: "secondary" as const,
      });
    }

    // Add Rejeitar second
    if (selectedRequest && onReject) {
      actions.push({
        key: "reject",
        label: "Rejeitar",
        icon: IconCircleX,
        onClick: onReject,
        variant: "outline" as const,
        group: "secondary" as const,
        className: "border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground",
      });
    }

    // Add Aprovar last
    if (selectedRequest && onApprove) {
      actions.push({
        key: "approve",
        label: "Aprovar",
        icon: IconCircleCheck,
        onClick: onApprove,
        variant: "default" as const,
        group: "secondary" as const,
      });
    }

    return actions;
  };

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Ajustes de Ponto"
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos", href: routes.humanResources.root },
            { label: "Requisições" },
          ]}
          actions={getHeaderActions()}
        />
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4">
          <TimeAdjustmentRequests
            className="h-full"
            onSelectedRequestChange={setSelectedRequest}
            onActionsChange={handleActionsChange}
          />
        </div>
      </div>
    </div>
  );
}

export default RequisicosList;