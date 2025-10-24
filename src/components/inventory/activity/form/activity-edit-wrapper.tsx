import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { IconArrowLeft, IconPackage, IconLoader2, IconCheck } from "@tabler/icons-react";
import { useActivity } from "../../../../hooks";
import { routes } from "../../../../constants";
import type { Activity } from "../../../../types";
import { ActivityEditForm } from "./activity-edit-form";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";

export const ActivityEditWrapper = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false, isSubmitting: false });

  const {
    data: response,
    isLoading,
    error,
  } = useActivity(id!, {
    include: {
      item: {
        include: {
          brand: true,
          category: true,
        },
      },
      user: true,
    },
  });

  const activity = response?.data as Activity | undefined;

  // Submit action
  const handleFormSubmit = () => {
    const submitButton = document.getElementById("activity-form-submit") as HTMLButtonElement;
    if (submitButton) {
      submitButton.click();
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <div className="max-w-5xl mx-auto">
            <PageHeader
              title="Editar Movimentação"
              icon={IconPackage}
              variant="form"
              breadcrumbs={[
                { label: "Home", href: "/" },
                { label: "Estoque", href: "/estoque" },
                { label: "Movimentações", href: routes.inventory.movements.list },
                { label: "Editar" },
              ]}
            />
          </div>
        </div>

        {/* Scrollable Form Container */}
        <div className="flex-1 mt-6">
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2 text-muted-foreground">
                <IconLoader2 className="h-5 w-5 animate-spin" />
                Carregando movimentação...
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !activity) {
    return (
      <div className="h-full flex flex-col">
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <div className="max-w-5xl mx-auto">
            <PageHeader
              title="Editar Movimentação"
              icon={IconPackage}
              variant="form"
              breadcrumbs={[
                { label: "Home", href: "/" },
                { label: "Estoque", href: "/estoque" },
                { label: "Movimentações", href: routes.inventory.movements.list },
                { label: "Editar" },
              ]}
            />
          </div>
        </div>

        {/* Scrollable Form Container */}
        <div className="flex-1 mt-6">
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-destructive mb-2">Erro ao carregar movimentação</p>
                <p className="text-sm text-muted-foreground">A movimentação que você está tentando editar não foi encontrada ou você não tem permissão para editá-la.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Define actions for PageHeader
  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: () => navigate(routes.inventory.movements.root),
      variant: "outline" as const,
      disabled: formState.isSubmitting,
    },
    {
      key: "save",
      label: "Salvar Alterações",
      icon: formState.isSubmitting ? IconLoader2 : IconCheck,
      onClick: handleFormSubmit,
      variant: "default" as const,
      disabled: formState.isSubmitting || !formState.isValid || !formState.isDirty,
      loading: formState.isSubmitting,
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="max-w-5xl mx-auto">
          <PageHeader
            title="Editar Movimentação"
            icon={IconPackage}
            variant="form"
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "Estoque", href: "/estoque" },
              { label: "Movimentações", href: routes.inventory.movements.list },
              { label: "Editar" },
            ]}
            actions={actions}
          />
        </div>
      </div>

      {/* Scrollable Form Container */}
      <div className="flex-1 overflow-y-auto mt-6">
        <div className="max-w-5xl mx-auto h-full">
          <ActivityEditForm activity={activity} onFormStateChange={setFormState} />
        </div>
      </div>
    </div>
  );
};
