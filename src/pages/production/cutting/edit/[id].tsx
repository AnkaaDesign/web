import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { CutForm } from "@/components/production/cut/form/cut-form";
import { routes } from "../../../../constants";
import type { Cut } from "../../../../types";
import { IconArrowLeft, IconCheck, IconLoader2 } from "@tabler/icons-react";

export const CuttingEditPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [formState, setFormState] = React.useState({ isValid: false, isDirty: false });
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSuccess = (cut: Cut) => {
    // Navigate to the details page after successful update
    navigate(routes.production.cutting.details(cut.id));
  };

  const handleCancel = () => {
    navigate(routes.production.cutting.list);
  };

  if (!id) {
    return (
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="form"
          title="Corte não encontrado"
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">ID do corte não encontrado.</p>
          </div>
        </div>
      </div>
    );
  }

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: isSubmitting,
    },
    {
      key: "submit",
      label: "Salvar Alterações",
      icon: isSubmitting ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("cut-form-submit")?.click(),
      variant: "default" as const,
      disabled: isSubmitting || !formState.isValid || !formState.isDirty,
      loading: isSubmitting,
    },
  ];

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="form"
        title="Editar Corte"
        breadcrumbs={[
          { label: "Produção", href: routes.production.root },
          { label: "Cortes", href: routes.production.cutting.list },
          { label: "Editar" },
        ]}
        actions={actions}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <CutForm
          cutId={id}
          mode="edit"
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          onFormStateChange={setFormState}
          isSubmitting={isSubmitting}
          onSubmitting={setIsSubmitting}
        />
      </div>
    </div>
  );
};
