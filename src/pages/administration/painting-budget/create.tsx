import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconArrowRight, IconCalculator, IconLoader2 } from "@tabler/icons-react";

import { PaintingBudgetForm, type PaintingBudgetFormData } from "@/components/administration/painting-budget/form/painting-budget-form";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader, type PageAction } from "@/components/ui/page-header";
import { toast } from "@/components/ui/sonner";
import { FAVORITE_PAGES, SECTOR_PRIVILEGES, routes } from "@/constants";
import { usePaintingAnalysisMutations } from "@/hooks";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

const ALLOWED = [
  SECTOR_PRIVILEGES.ADMIN,
  SECTOR_PRIVILEGES.COMMERCIAL,
  SECTOR_PRIVILEGES.FINANCIAL,
  SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
  SECTOR_PRIVILEGES.ACCOUNTING,
];

/**
 * Cadastro = UMA tela (dados do orçamento). As artes ficam no passo "Artes" da
 * página de detalhes, que é dona da sequência inteira — antes o mesmo passo
 * existia nos dois lugares, com dois botões de "concluir" concorrendo.
 */
export function PaintingBudgetCreatePage() {
  usePageTracker({ title: "Novo Orçamento de Pintura", icon: "calculator" });
  const navigate = useNavigate();
  const { createMutation } = usePaintingAnalysisMutations();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });

  const handleSubmit = async (data: PaintingBudgetFormData) => {
    try {
      const response = await createMutation.mutateAsync(data);
      const id = response?.data?.id;
      if (!id) return;
      toast.success("Orçamento criado. Agora adicione as artes do implemento.");
      navigate(routes.administration.paintingBudget.details(id));
    } catch {
      toast.error("Erro ao criar o orçamento de pintura. Tente novamente.");
    }
  };

  const actions: PageAction[] = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: () => navigate(routes.administration.paintingBudget.root),
      variant: "outline",
      disabled: createMutation.isPending,
    },
    {
      key: "create",
      label: "Próximo",
      icon: createMutation.isPending ? IconLoader2 : IconArrowRight,
      onClick: () => document.getElementById("painting-budget-form-submit")?.click(),
      variant: "default",
      disabled: createMutation.isPending || !formState.isValid,
      loading: createMutation.isPending,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={ALLOWED}>
      <div className="flex h-full flex-col gap-4 px-4 pt-4">
        <div className="container mx-auto max-w-6xl flex-shrink-0">
          <PageHeader
            variant="form"
            title="Novo Orçamento de Pintura"
            icon={IconCalculator}
            favoritePage={FAVORITE_PAGES.ADMINISTRACAO_ORCAMENTO_PINTURA_CADASTRAR}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Administração" },
              { label: "Orçamento de Pintura", href: routes.administration.paintingBudget.root },
              { label: "Cadastrar" },
            ]}
            actions={actions}
          />
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          <PaintingBudgetForm mode="create" onSubmit={handleSubmit} isSubmitting={createMutation.isPending} onFormStateChange={setFormState} />
        </div>
      </div>
    </PrivilegeRoute>
  );
}

export default PaintingBudgetCreatePage;
