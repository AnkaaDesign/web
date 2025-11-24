import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getMyPpeDeliveries } from "@/api-client";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import type { PpeDelivery } from "@/types";
import type { PpeDeliveryGetManyFormData } from "@/schemas";
import { PPE_DELIVERY_STATUS, PPE_DELIVERY_STATUS_LABELS, PPE_TYPE_LABELS, routes } from "@/constants";
import { formatDateTime } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { IconSearch, IconPlus, IconPackage } from "@tabler/icons-react";
import { useAuth } from "@/contexts/auth-context";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const MyPpesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchText, setSearchText] = useState("");
  const debouncedSearchText = useDebounce(searchText, 500);
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "delivered">("pending");

  // Filter params based on current user and tab
  const queryParams = useMemo<PpeDeliveryGetManyFormData>(() => {
    const params: PpeDeliveryGetManyFormData = {
      include: {
        item: true,
        reviewedByUser: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      limit: 100, // Simple page without pagination
    };

    // Add search filter
    if (debouncedSearchText) {
      params.searchingFor = debouncedSearchText;
    }

    return params;
  }, [debouncedSearchText]);

  const { data: deliveriesData, isLoading } = useQuery({
    queryKey: ["ppeDeliveries", "my-requests", queryParams],
    queryFn: () => getMyPpeDeliveries(queryParams),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const deliveries = deliveriesData?.data || [];

  // Filter deliveries by tab status
  const filteredDeliveries = useMemo(() => {
    let filtered = deliveries;

    // Filter by status based on tab
    if (activeTab === "pending") {
      filtered = filtered.filter((d) => d.status === PPE_DELIVERY_STATUS.PENDING);
    } else if (activeTab === "approved") {
      filtered = filtered.filter((d) => d.status === PPE_DELIVERY_STATUS.APPROVED);
    } else if (activeTab === "delivered") {
      filtered = filtered.filter((d) => d.status === PPE_DELIVERY_STATUS.DELIVERED);
    }

    // Apply search filter
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(
        (delivery) =>
          delivery.item?.name?.toLowerCase().includes(searchLower) ||
          delivery.item?.uniCode?.toLowerCase().includes(searchLower) ||
          delivery.item?.ppeType?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [deliveries, activeTab, searchText]);

  const getStatusBadge = (status: PPE_DELIVERY_STATUS) => {
    const variants: Record<PPE_DELIVERY_STATUS, "default" | "secondary" | "destructive" | "outline"> = {
      [PPE_DELIVERY_STATUS.PENDING]: "outline",
      [PPE_DELIVERY_STATUS.APPROVED]: "default",
      [PPE_DELIVERY_STATUS.DELIVERED]: "secondary",
      [PPE_DELIVERY_STATUS.REPROVED]: "destructive",
      [PPE_DELIVERY_STATUS.CANCELLED]: "destructive",
    };

    return <Badge variant={variants[status]}>{PPE_DELIVERY_STATUS_LABELS[status]}</Badge>;
  };

  if (!user) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent>
          <p className="text-muted-foreground">Faça login para ver seus EPIs</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col rounded-md">
      <CardHeader className="px-8 py-3 flex-shrink-0 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <CardTitle className="text-xl font-bold">Meus EPIs</CardTitle>
            <Breadcrumb />
          </div>
          <Button onClick={() => navigate(routes.personal.myPpes.request)} className="gap-2">
            <IconPlus className="h-4 w-4" />
            Solicitar EPI
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col px-8 py-4 space-y-4 overflow-hidden">
        {/* Search bar */}
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder="Buscar por nome, código ou tipo de EPI..."
            value={searchText}
            onChange={(value) => setSearchText(typeof value === "string" ? value : "")}
            className="pl-10"
          />
        </div>

        {/* Tabs for status */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "pending" | "approved" | "delivered")}>
          <TabsList className="grid w-full max-w-[600px] grid-cols-3">
            <TabsTrigger value="pending">
              Pendentes ({deliveries.filter((d) => d.status === PPE_DELIVERY_STATUS.PENDING).length})
            </TabsTrigger>
            <TabsTrigger value="approved">
              Aprovados ({deliveries.filter((d) => d.status === PPE_DELIVERY_STATUS.APPROVED).length})
            </TabsTrigger>
            <TabsTrigger value="delivered">
              Entregues ({deliveries.filter((d) => d.status === PPE_DELIVERY_STATUS.DELIVERED).length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="flex-1 min-h-0">
            <div className="rounded-md border overflow-auto h-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>EPI</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead className="text-center">Quantidade</TableHead>
                    <TableHead>Solicitado em</TableHead>
                    {activeTab === "approved" && <TableHead>Data Prevista</TableHead>}
                    {activeTab === "delivered" && <TableHead>Entregue em</TableHead>}
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredDeliveries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        {searchText
                          ? "Nenhum EPI encontrado com os filtros aplicados"
                          : `Nenhum EPI ${activeTab === "pending" ? "pendente" : activeTab === "approved" ? "aprovado" : "entregue"}`}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDeliveries.map((delivery) => (
                      <TableRow key={delivery.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <IconPackage className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div>
                                {delivery.item?.name || "EPI desconhecido"}
                                {delivery.item?.ppeSize ? ` • ${delivery.item.ppeSize}` : ""}
                              </div>
                              {delivery.item?.ppeCA && (
                                <div className="text-xs text-muted-foreground">CA: {delivery.item.ppeCA}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{delivery.item?.uniCode || "-"}</code>
                        </TableCell>
                        <TableCell className="text-center">{delivery.quantity}</TableCell>
                        <TableCell>{formatDateTime(delivery.createdAt)}</TableCell>
                        {activeTab === "approved" && (
                          <TableCell>{delivery.scheduledDate ? formatDateTime(delivery.scheduledDate) : "-"}</TableCell>
                        )}
                        {activeTab === "delivered" && (
                          <TableCell>
                            {delivery.actualDeliveryDate ? formatDateTime(delivery.actualDeliveryDate) : "-"}
                          </TableCell>
                        )}
                        <TableCell>{getStatusBadge(delivery.status)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
