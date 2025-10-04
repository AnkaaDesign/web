import { useNavigate } from "react-router-dom";
import { useGarageMutations } from "../../../hooks";
import { type GarageCreateFormData } from "../../../schemas";
import { GarageForm } from "@/components/production/garage/form/garage-form";
import { routes } from "../../../constants";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconBuilding, IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

export const GarageCreatePage = () => {
  const navigate = useNavigate();
  const { create, isCreating } = useGarageMutations();

  const handleSubmit = async (data: GarageCreateFormData) => {
    try {
      await create(data);
      toast.success("Garagem criada com sucesso!");
      navigate(routes.production.garages.list);
    } catch (error) {
      // Error is handled by the API client
    }
  };

  const handleCancel = () => {
    navigate(routes.production.garages.list);
  };

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
                <h1 className="text-2xl font-semibold">Cadastrar Garagem</h1>
                <p className="text-sm text-muted-foreground">Preencha as informações para criar uma nova garagem</p>
              </div>
            </div>

            {/* Form Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconBuilding className="h-5 w-5 text-primary" />
                  Nova Garagem
                </CardTitle>
                <CardDescription>Informe os dados da garagem. Campos marcados com * são obrigatórios.</CardDescription>
              </CardHeader>
              <CardContent>
                <GarageForm onSubmit={handleSubmit} onCancel={handleCancel} isSubmitting={isCreating} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
