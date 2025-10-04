import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { IconArrowLeft, IconCut, IconClipboardList } from "@tabler/icons-react";
import { CutCreateForm } from "@/components/production/cut/form/cut-create-form";
import { CutPlanForm } from "@/components/production/cut/form/cut-plan-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { routes } from "../../../constants";
import type { Cut } from "../../../types";

export const CuttingCreatePage = () => {
  const navigate = useNavigate();

  const handleSuccess = (cuts: Cut[]) => {
    // Navigate to the list page after successful creation
    navigate(routes.production.cutting.list);
  };

  const handleCancel = () => {
    navigate(routes.production.cutting.list);
  };

  return (
    <div className="h-full">
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto space-y-6 p-6">
            {/* Page header */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Button variant="ghost" size="sm" onClick={() => navigate(routes.production.cutting.list)} className="flex items-center gap-2">
                  <IconArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
              </div>

              <h1 className="text-2xl font-semibold">Criar Novo Corte</h1>
              <p className="text-muted-foreground">Crie cortes individuais ou planeje múltiplos cortes de uma vez</p>
            </div>

            <Separator />

            {/* Creation tabs */}
            <Tabs defaultValue="single" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="single" className="flex items-center gap-2">
                  <IconCut className="h-4 w-4" />
                  Corte Individual
                </TabsTrigger>
                <TabsTrigger value="plan" className="flex items-center gap-2">
                  <IconClipboardList className="h-4 w-4" />
                  Plano de Corte
                </TabsTrigger>
              </TabsList>

              <TabsContent value="single">
                <CutCreateForm onSuccess={handleSuccess} onCancel={handleCancel} />
              </TabsContent>

              <TabsContent value="plan">
                <CutPlanForm onSuccess={handleSuccess} onCancel={handleCancel} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};
