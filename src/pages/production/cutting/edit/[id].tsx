import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { IconArrowLeft } from "@tabler/icons-react";
import { CutForm } from "@/components/production/cut/form/cut-form";
import { routes } from "../../../../constants";
import type { Cut } from "../../../../types";

export const CuttingEditPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const handleSuccess = (cut: Cut) => {
    // Navigate to the details page after successful update
    navigate(routes.production.cutting.details(cut.id));
  };

  const handleCancel = () => {
    navigate(routes.production.cutting.list);
  };

  if (!id) {
    return (
      <div className="p-6">
        <p>ID do corte não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-6 p-6">
            {/* Page header */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Button variant="ghost" size="sm" onClick={() => navigate(routes.production.cutting.list)} className="flex items-center gap-2">
                  <IconArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
              </div>

              <h1 className="text-2xl font-semibold">Editar Corte</h1>
              <p className="text-muted-foreground">Atualize as informações do corte</p>
            </div>

            <Separator />

            {/* Edit form */}
            <CutForm cutId={id} mode="edit" onSuccess={handleSuccess} onCancel={handleCancel} />
          </div>
        </div>
      </div>
    </div>
  );
};
