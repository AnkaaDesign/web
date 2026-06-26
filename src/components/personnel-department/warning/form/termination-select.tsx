import { useCallback } from "react";
import { IconFileOff } from "@tabler/icons-react";

import { getTerminations } from "../../../../api-client";
import { formatDate } from "../../../../utils";
import { TERMINATION_TYPE_LABELS } from "../../../../constants";
import type { TERMINATION_TYPE } from "../../../../constants";

import { FormCombobox } from "@/components/ui/form-combobox";

interface TerminationSelectProps {
  disabled?: boolean;
  /** Quando informado, restringe a busca às rescisões deste colaborador. */
  collaboratorId?: string;
}

/**
 * Vínculo opcional a uma rescisão por justa causa que esta advertência
 * fundamenta. Busca rescisões (preferencialmente do colaborador selecionado).
 */
export function TerminationSelect({ disabled, collaboratorId }: TerminationSelectProps) {
  const queryTerminations = useCallback(
    async (searchTerm: string) => {
      try {
        const queryParams: any = {
          orderBy: { terminationDate: "desc" },
          take: 50,
          include: { user: true },
        };
        if (collaboratorId) {
          queryParams.where = { userId: collaboratorId };
        }
        if (searchTerm && searchTerm.trim()) {
          queryParams.searchingFor = searchTerm.trim();
        }

        const response = await getTerminations(queryParams);
        const terminations = response.data || [];

        return terminations.map((termination) => {
          const typeLabel = TERMINATION_TYPE_LABELS[termination.type as TERMINATION_TYPE] ?? termination.type;
          const dateLabel = termination.terminationDate ? ` — ${formatDate(termination.terminationDate)}` : "";
          const name = termination.user?.name ? `${termination.user.name} · ` : "";
          return {
            value: termination.id,
            label: `${name}${typeLabel}${dateLabel}`,
          };
        });
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Error fetching terminations:", error);
        }
        return [];
      }
    },
    [collaboratorId],
  );

  return (
    <FormCombobox
      name="terminationId"
      label="Rescisão Vinculada (justa causa)"
      icon={<IconFileOff className="h-4 w-4 text-muted-foreground" />}
      async
      queryKey={["terminations", "warning-link", collaboratorId ?? "all"]}
      queryFn={queryTerminations}
      minSearchLength={0}
      placeholder="Vincular a uma rescisão"
      emptyText="Nenhuma rescisão encontrada"
      disabled={disabled}
    />
  );
}
