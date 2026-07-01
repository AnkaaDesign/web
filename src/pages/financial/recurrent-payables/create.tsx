import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconRepeat, IconCheck, IconLoader2 } from "@tabler/icons-react";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import {
  RecurrentPayableForm,
  type RecurrentPayableFormState,
} from "@/components/financial/recurrent-payables/recurrent-payable-form";
import { useRecurrentPayableMutations } from "@/hooks/financial/use-recurrent-payable";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "@/constants";

export const CreateRecurrentPayablePage = () => {
  usePageTracker({ title: "Nova conta recorrente", icon: "repeat" });
  const navigate = useNavigate();
  const { create, createMutation } = useRecurrentPayableMutations();
  const [formState, setFormState] = useState<RecurrentPayableFormState>({ isValid: false, isDirty: false });

  const goBack = () => navigate(routes.financial.recurrentPayables.root);

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: goBack,
      variant: "outline" as const,
      disabled: createMutation.isPending,
    },
    {
      key: "submit",
      label: "Criar conta",
      icon: createMutation.isPending ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("recurrent-payable-form-submit")?.click(),
      variant: "default" as const,
      disabled: createMutation.isPending || !formState.isValid,
      loading: createMutation.isPending,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-2xl flex-shrink-0">
          <PageHeader
            variant="form"
            title="Nova conta recorrente"
            icon={IconRepeat}
            favoritePage={FAVORITE_PAGES.FINANCEIRO_CONTAS_RECORRENTES_CADASTRAR}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Financeiro", href: routes.financial.root },
              { label: "Recorrentes", href: routes.financial.recurrentPayables.root },
              { label: "Nova conta" },
            ]}
            actions={actions}
          />
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          <RecurrentPayableForm
            isSubmitting={createMutation.isPending}
            onFormStateChange={setFormState}
            onSubmit={(payload) => create(payload, { onSuccess: goBack })}
          />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default CreateRecurrentPayablePage;
