import { useNavigate, useParams } from "react-router-dom";
import { useGarage, useGarageMutations } from "../../../../hooks";
import { type GarageUpdateFormData } from "../../../../schemas";
import { GarageForm } from "@/components/production/garage/form/garage-form";
import { routes } from "../../../../constants";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconBuilding, IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const GarageEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: garage, isLoading } = useGarage(id!);
  const { update, isUpdating } = useGarageMutations();

  const handleSubmit = async (data: GarageUpdateFormData) => {
    if (!id) return;

    try {
      await update({ id, data });
      toast.success("Garagem atualizada com sucesso!");
      navigate(routes.production.garages.list);
    } catch (error) {
      // Error is handled by the API client
    }
  };

  const handleCancel = () => {
    navigate(routes.production.garages.list);
  };

  if (!id) {
    navigate(routes.production.garages.list);
    return null;
  }

  return (
    <div className="h-full">
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-4 pb-6">
            {/* Header with back button */}
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={handleCancel} className="h-8 w-8">
                <IconArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <h1 className="text-2xl font-semibold">Editar Garagem</h1>
                <p className="text-sm text-muted-foreground">Atualize as informações da garagem</p>
              </div>
            </div>

            {/* Form Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconBuilding className="h-5 w-5 text-primary" />
                  {isLoading ? <Skeleton className="h-6 w-48" /> : garage?.name || "Editar Garagem"}
                </CardTitle>
                <CardDescription>Altere os dados da garagem. Campos marcados com * são obrigatórios.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <div className="grid grid-cols-2 gap-4">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : garage ? (
                  <GarageForm garage={garage} onSubmit={handleSubmit} onCancel={handleCancel} isSubmitting={isUpdating} />
                ) : (
                  <div className="text-center text-muted-foreground py-8">Garagem não encontrada</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
