import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconFlask, IconCheck, IconLoader2 } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import type { FispqUpdateFormData } from "@/schemas/fispq";
import { useFispq, useFispqMutations, useUploadFispqDocument } from "@/hooks/occupational-health/use-fispq";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { FispqForm } from "@/components/occupational-health/fispq/form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const FispqEditPage = () => {
  usePageTracker({ title: "Editar FISPQ" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { updateAsync, updateMutation } = useFispqMutations();
  const uploadDocument = useUploadFispqDocument();

  const {
    data: response,
    isLoading,
    error,
  } = useFispq(id || "", {
    include: { item: true, pdfFile: true },
    enabled: !!id,
  });

  const fispq = response?.data;

  if (!id) {
    return <Navigate to={routes.occupationalHealth.fispq.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar FISPQ</p>
        <Navigate to={routes.occupationalHealth.fispq.root} replace />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!fispq) {
    return <Navigate to={routes.occupationalHealth.fispq.root} replace />;
  }

  const handleSubmit = async (data: FispqUpdateFormData) => {
    try {
      await updateAsync({ id, data });
      navigate(routes.occupationalHealth.fispq.details(id));
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error updating fispq:", error);
      }
    }
  };

  const handleUploadPdf = async (file: globalThis.File) => {
    await uploadDocument.mutateAsync({ id, file, include: { item: true, pdfFile: true } });
  };

  const title = fispq.item?.name || fispq.productName || "FISPQ";

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: () => navigate(routes.occupationalHealth.fispq.details(id)),
      variant: "outline" as const,
      disabled: updateMutation.isPending,
    },
    {
      key: "submit",
      label: "Salvar",
      icon: IconCheck,
      onClick: () => document.getElementById("fispq-form-submit")?.click(),
      variant: "default" as const,
      disabled: updateMutation.isPending,
      loading: updateMutation.isPending,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <PageHeader
            variant="form"
            title="Editar FISPQ"
            icon={IconFlask}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Medicina do Trabalho", href: routes.occupationalHealth.root },
              { label: "FISPQ/FDS", href: routes.occupationalHealth.fispq.root },
              { label: title, href: routes.occupationalHealth.fispq.details(id) },
              { label: "Editar" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <FispqForm
            mode="update"
            fispq={fispq}
            onSubmit={handleSubmit}
            isSubmitting={updateMutation.isPending}
            onUploadPdf={handleUploadPdf}
            isUploadingPdf={uploadDocument.isPending}
          />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default FispqEditPage;
