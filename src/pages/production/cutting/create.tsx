import { useNavigate } from "react-router-dom";
import { IconCut, IconClipboardList } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { CutCreateForm } from "@/components/production/cut/form/cut-create-form";
import { CutPlanForm } from "@/components/production/cut/form/cut-plan-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { routes, FAVORITE_PAGES } from "../../../constants";
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
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        title="Criar Novo Corte"
        icon={IconCut}
        favoritePage={FAVORITE_PAGES.PRODUCTION_CUTTING_CREATE}
        breadcrumbs={[
          { label: "Produção", href: routes.production.root },
          { label: "Cortes", href: routes.production.cutting.list },
          { label: "Criar" }
        ]}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto pb-6">
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
  );
};
