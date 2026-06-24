import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IconRepeat, IconCheck, IconLoader2 } from "@tabler/icons-react";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RecurrentPayableForm,
  type RecurrentPayableFormState,
} from "@/components/financial/recurrent-payables/recurrent-payable-form";
import { useRecurrentPayable, useRecurrentPayableMutations } from "@/hooks/financial/use-recurrent-payable";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { SECTOR_PRIVILEGES, routes } from "@/constants";

export const EditRecurrentPayablePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: payable, isLoading } = useRecurrentPayable(id);
  const { update, updateMutation } = useRecurrentPayableMutations();
  const [formState, setFormState] = useState<RecurrentPayableFormState>({ isValid: false, isDirty: false });

  usePageTracker({ title: payable ? `Editar — ${payable.name}` : "Editar conta recorrente", icon: "repeat" });

  const goBack = () => navigate(routes.financial.recurrentPayables.root);

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: goBack,
      variant: "outline" as const,
      disabled: updateMutation.isPending,
    },
    {
      key: "submit",
      label: "Salvar alterações",
      icon: updateMutation.isPending ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("recurrent-payable-form-submit")?.click(),
      variant: "default" as const,
      disabled: updateMutation.isPending || !formState.isValid || !formState.isDirty,
      loading: updateMutation.isPending,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <PageHeader
            variant="form"
            title={payable?.name ?? "Editar conta recorrente"}
            icon={IconRepeat}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Financeiro", href: routes.financial.root },
              { label: "Recorrentes", href: routes.financial.recurrentPayables.root },
              { label: payable?.name ?? "Editar" },
            ]}
            actions={actions}
          />
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          {isLoading ? (
            <div className="container mx-auto max-w-4xl space-y-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <RecurrentPayableForm
              payable={payable}
              isSubmitting={updateMutation.isPending}
              onFormStateChange={setFormState}
              onSubmit={(payload, payableId) =>
                payableId && update({ id: payableId, body: payload }, { onSuccess: goBack })
              }
            />
          )}
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default EditRecurrentPayablePage;
