import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getMyPendingSignatures } from "@/api-client";
import { routes, PPE_DELIVERY_STATUS_LABELS } from "@/constants";
import { formatDateTime } from "@/utils";
import type { PpeDelivery } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconSignature,
  IconCheck,
  IconExternalLink,
  IconAlertTriangle,
  IconShieldCheck,
  IconRefresh,
} from "@tabler/icons-react";
import { useAuth } from "@/contexts/auth-context";

export const PendingSignaturesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    data: pendingData,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["pending-signatures", user?.id],
    queryFn: getMyPendingSignatures,
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
  });

  const pendingDeliveries = pendingData?.data?.pendingDeliveries || [];
  const hasPending = pendingData?.data?.hasPending || false;

  // Group deliveries by batch - deliveries with same signatureBatchId should be shown as one entry
  interface GroupedDelivery {
    id: string;
    batchId: string | null;
    items: { name: string; quantity: number; caNumber?: string }[];
    totalQuantity: number;
    actualDeliveryDate: Date | null;
    signingUrl: string | null;
    isBatch: boolean;
  }

  const groupedDeliveries = useMemo<GroupedDelivery[]>(() => {
    const grouped: Map<string, GroupedDelivery> = new Map();

    pendingDeliveries.forEach((delivery: any) => {
      const key = delivery.signatureBatchId || delivery.id;

      if (grouped.has(key)) {
        // Add to existing batch
        const existing = grouped.get(key)!;
        existing.items.push({
          name: delivery.item?.name || "EPI",
          quantity: delivery.quantity,
          caNumber: delivery.item?.caNumber,
        });
        existing.totalQuantity += delivery.quantity;
        // Use the signing URL if available (all items in batch share the same URL)
        if (delivery.signingUrl && !existing.signingUrl) {
          existing.signingUrl = delivery.signingUrl;
        }
      } else {
        // Create new entry
        grouped.set(key, {
          id: delivery.id,
          batchId: delivery.signatureBatchId,
          items: [{
            name: delivery.item?.name || "EPI",
            quantity: delivery.quantity,
            caNumber: delivery.item?.caNumber,
          }],
          totalQuantity: delivery.quantity,
          actualDeliveryDate: delivery.actualDeliveryDate,
          signingUrl: delivery.signingUrl,
          isBatch: !!delivery.signatureBatchId,
        });
      }
    });

    return Array.from(grouped.values());
  }, [pendingDeliveries]);

  const handleSign = (signingUrl: string) => {
    // Open the signing URL in a new tab
    window.open(signingUrl, "_blank", "noopener,noreferrer");
  };

  if (!user) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent>
          <p className="text-muted-foreground">Faça login para ver suas assinaturas pendentes</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col px-4 pt-4">
        <div className="flex-shrink-0">
          <PageHeader
            variant="default"
            title="Assinaturas Pendentes"
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Pessoal", href: routes.personal.root },
              { label: "Assinaturas Pendentes" },
            ]}
          />
        </div>
        <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border mt-4">
          <CardContent className="flex-1 flex flex-col p-4 space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col px-4 pt-4">
        <div className="flex-shrink-0">
          <PageHeader
            variant="default"
            title="Assinaturas Pendentes"
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Pessoal", href: routes.personal.root },
              { label: "Assinaturas Pendentes" },
            ]}
          />
        </div>
        <Alert variant="destructive" className="mt-4">
          <IconAlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar</AlertTitle>
          <AlertDescription>
            Não foi possível carregar suas assinaturas pendentes. Tente novamente.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          variant="default"
          title="Assinaturas Pendentes"
          icon={IconSignature}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Pessoal", href: routes.personal.root },
            { label: "Assinaturas Pendentes" },
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => refetch(),
              variant: "outline",
              disabled: isRefetching,
            },
          ]}
        />
      </div>

      <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border mt-4">
        <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden pb-6">
          {/* Status Alert */}
          {hasPending ? (
            <Alert className="bg-yellow-500/10 border-yellow-500/50 text-yellow-700 dark:text-yellow-400">
              <IconAlertTriangle className="h-4 w-4" />
              <AlertTitle>Assinaturas Pendentes</AlertTitle>
              <AlertDescription>
                Você possui {groupedDeliveries.length} documento{groupedDeliveries.length > 1 ? "s" : ""} de
                EPI aguardando sua assinatura. Assine para confirmar o recebimento.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-green-500/10 border-green-500/50 text-green-700 dark:text-green-400">
              <IconCheck className="h-4 w-4" />
              <AlertTitle>Tudo em dia!</AlertTitle>
              <AlertDescription>
                Você não possui assinaturas pendentes no momento.
              </AlertDescription>
            </Alert>
          )}

          {/* Table */}
          {groupedDeliveries.length > 0 && (
            <div className="flex-1 min-h-0 overflow-auto rounded-md border dark:border-border/40">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>EPIs</TableHead>
                    <TableHead className="text-center">Itens</TableHead>
                    <TableHead>Entregue em</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedDeliveries.map((grouped) => (
                    <TableRow key={grouped.batchId || grouped.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-1">
                          {grouped.items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <IconShieldCheck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span>{item.name}</span>
                              <span className="text-muted-foreground text-xs">({item.quantity}x)</span>
                              {item.caNumber && (
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                  CA: {item.caNumber}
                                </code>
                              )}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-xs">
                          {grouped.items.length} {grouped.items.length === 1 ? "item" : "itens"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {grouped.actualDeliveryDate
                          ? formatDateTime(grouped.actualDeliveryDate)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {grouped.isBatch ? (
                          <Badge variant="outline" className="text-xs">
                            Lote
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Individual
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {grouped.signingUrl ? (
                          <Button
                            size="sm"
                            onClick={() => handleSign(grouped.signingUrl!)}
                          >
                            <IconSignature className="h-4 w-4 mr-1" />
                            Assinar
                            <IconExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled>
                            <IconSignature className="h-4 w-4 mr-1" />
                            Preparando...
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Empty State */}
          {!hasPending && groupedDeliveries.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center py-16">
              <div className="p-4 bg-green-500/10 rounded-full mb-4">
                <IconCheck className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                Nenhuma assinatura pendente
              </h3>
              <p className="text-muted-foreground text-center mt-2 max-w-md">
                Todos os seus documentos de recebimento de EPI estão assinados.
                Quando receber novos EPIs, os documentos aparecerão aqui.
              </p>
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => navigate(routes.personal.myPpes.root)}
              >
                Ver Meus EPIs
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
