import { useParams, useNavigate } from "react-router-dom";
import { IconArrowLeft } from "@tabler/icons-react";
import { useActivity } from "../../../../hooks";
import { routes } from "../../../../constants";
import type { Activity } from "../../../../types";
import { ActivityEditForm } from "./activity-edit-form";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export const ActivityEditWrapper = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error || !activity) {
    return (
      <div className="container mx-auto max-w-4xl py-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Atividade não encontrada</h2>
          <p className="text-muted-foreground mb-4">A atividade que você está tentando editar não foi encontrada ou você não tem permissão para editá-la.</p>
          <Button onClick={() => navigate(routes.inventory.movements.root)}>
            <IconArrowLeft className="mr-2 h-4 w-4" />
            Voltar para lista
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Editar Movimentação</h1>
        <Breadcrumb
          items={[
            { label: "Início", href: routes.home },
            { label: "Estoque", href: routes.inventory.root },
            { label: "Movimentações", href: routes.inventory.movements.root },
            { label: "Editar" },
          ]}
        />
      </div>
      <ActivityEditForm activity={activity} />
    </div>
  );
};
