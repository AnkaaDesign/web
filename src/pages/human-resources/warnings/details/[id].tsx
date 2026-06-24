import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconEdit, IconTrash, IconRefresh, IconFileText, IconFileCheck } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { useWarning, useWarningMutations } from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/page-header";
import { SummaryCard, ContentCard, AttachmentsCard, SignaturesCard } from "@/components/human-resources/warning/detail";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { warningService } from "@/api-client/warning";

export const WarningDetailPage = () => {
  usePageTracker({ title: "Detalhes da Advertência", icon: "alert-triangle" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const {
    data: warning,
    isLoading,
    error,
    refetch,
  } = useWarning(id || "", {
    include: {
      collaborator: {
        include: {
          position: true,
          sector: true,
        },
      },
      supervisor: {
        include: {
          position: true,
        },
      },
      witness: {
        include: {
          position: true,
        },
      },
      attachments: true,
      signatures: {
        include: {
          signedByUser: true,
          registeredBy: true,
          signedDocument: true,
        },
      },
    } as any,
    enabled: !!id,
  });

  const { deleteMutation } = useWarningMutations();

  if (!id) return <Navigate to={routes.personnelDepartment.warnings.root} replace />;
  if (isLoading) return null;
  if (error || !warning) return <Navigate to={routes.personnelDepartment.warnings.root} replace />;

  const w = warning.data!;
  const collaboratorName = w.collaborator?.name ?? "Advertência";

  // The signed term to serve = the most recent signature that carries a stored signedDocument
  // (the latest PAdES-sealed term). Falls back to the client-side generator when none exists.
  const signedTermFile = ((w.signatures ?? []) as any[])
    .filter((s) => s?.signedDocument?.id)
    .sort((a, b) => new Date(b.serverTimestamp).getTime() - new Date(a.serverTimestamp).getTime())[0]?.signedDocument as
    | { id: string }
    | undefined;

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(id);
      navigate(routes.personnelDepartment.warnings.root);
    } catch {
      // handled by API client
    }
    setIsDeleteDialogOpen(false);
  };

  // Fetch the term as a real PDF (authenticated) and show it in a new tab.
  // The blank tab is opened synchronously inside the click gesture (popup blockers
  // allow that), then navigated to the PDF blob once it arrives. No `noopener`
  // feature here — that flag makes window.open() return null by spec.
  const handleViewDocument = async () => {
    const tab = window.open("about:blank", "_blank");
    try {
      const blob = await warningService.getWarningDocument(id);
      const url = URL.createObjectURL(blob);
      if (tab) {
        tab.location.href = url;
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      tab?.close();
      // error toast handled by the API client interceptor
    }
  };

  return (
    <PrivilegeRoute
      requiredPrivilege={[
        SECTOR_PRIVILEGES.HUMAN_RESOURCES,
        SECTOR_PRIVILEGES.ADMIN,
        SECTOR_PRIVILEGES.ACCOUNTING,
        SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
      ]}
    >
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title={`Advertência — ${collaboratorName}`}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Departamento Pessoal", href: routes.personnelDepartment.root },
            { label: "Advertências", href: routes.personnelDepartment.warnings.root },
            { label: collaboratorName },
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => refetch(),
            },
            {
              // Single "view document" action — always serves a real PDF from the
              // server (sealed term once signed/refused, otherwise a fresh render).
              key: "document",
              label: signedTermFile ? "Ver Termo Assinado" : "Ver Documento",
              icon: signedTermFile ? IconFileCheck : IconFileText,
              onClick: handleViewDocument,
            },
            {
              key: "edit",
              label: "Editar",
              icon: IconEdit,
              onClick: () => navigate(routes.personnelDepartment.warnings.edit(id)),
            },
            {
              key: "delete",
              label: "Excluir",
              icon: IconTrash,
              onClick: () => setIsDeleteDialogOpen(true),
              group: "danger" as const,
            },
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <div className="space-y-4">
                <SummaryCard warning={w} />
                <SignaturesCard warning={w} />
                {w.attachments && w.attachments.length > 0 && (
                  <AttachmentsCard warning={w} />
                )}
              </div>
              <ContentCard warning={w} className="h-full" />
            </div>

            <ChangelogHistory
              entityType={CHANGE_LOG_ENTITY_TYPE.WARNING}
              entityId={id}
              entityName={collaboratorName}
              entityCreatedAt={w.createdAt}
              maxHeight="500px"
            />
          </div>
        </div>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a advertência de{" "}
                <strong>{collaboratorName}</strong>? Esta ação não poderá ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PrivilegeRoute>
  );
};
