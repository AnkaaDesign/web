import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { PaintTypeForm } from "@/components/painting/paint-type/form";
import { usePaintTypeMutations } from "../../../hooks";
import { PageHeader } from "@/components/ui/page-header";
import { IconCheck, IconLoader2, IconPaint } from "@tabler/icons-react";
import type { PaintTypeCreateFormData } from "../../../schemas";

export function PaintTypesCreatePage() {
  const navigate = useNavigate();
  const { create, createMutation } = usePaintTypeMutations();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });

  const handleSubmit = async (data: PaintTypeCreateFormData) => {
    try {
      await create(data);
      navigate(routes.painting.paintTypes.root);
    } catch (error) {
      // Error is already handled by the API client
      throw error; // Re-throw to keep form in submitting state
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: createMutation.isPending,
    },
    {
      key: "submit",
      label: "Cadastrar",
      icon: createMutation.isPending ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("paint-type-form-submit")?.click(),
      variant: "default" as const,
      disabled: createMutation.isPending || !formState.isValid,
      loading: createMutation.isPending,
    },
  ];

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        title="Cadastrar Tipo de Tinta"
        icon={IconPaint}
        favoritePage={FAVORITE_PAGES.PINTURA_TIPOS_TINTA_CADASTRAR}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Pintura", href: routes.painting.root },
          { label: "Tipos de Tinta", href: routes.painting.paintTypes.root },
          { label: "Cadastrar" },
        ]}
        actions={actions}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <PaintTypeForm
          mode="create"
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={createMutation.isPending}
          onFormStateChange={setFormState}
        />
      </div>
    </div>
  );
}
