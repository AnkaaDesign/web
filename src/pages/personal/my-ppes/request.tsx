import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { requestPpeDelivery } from "@/api-client";
import { useItems } from "@/hooks/useItem";
import { useDebounce } from "@/hooks/use-debounce";
import type { Item } from "@/types";
import type { ItemGetManyFormData } from "@/schemas";
import { PPE_TYPE, PPE_TYPE_LABELS, routes } from "@/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { IconSearch, IconPackage, IconPlus, IconTrash, IconCheck, IconArrowLeft } from "@tabler/icons-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

// Schema for request form
const requestSchema = z.object({
  requests: z
    .array(
      z.object({
        itemId: z.string().uuid("EPI inválido"),
        quantity: z.number().default(1),
        reason: z.string().min(1, "Justificativa é obrigatória"),
      })
    )
    .min(1, "Adicione pelo menos um EPI"),
});

type RequestFormData = z.infer<typeof requestSchema>;

interface PpeRequest {
  itemId: string;
  quantity: number;
  reason: string;
  item?: Item;
}

export const PersonalMyPpesRequest = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState("");
  const debouncedSearchText = useDebounce(searchText, 500);
  const [selectedType, setSelectedType] = useState<PPE_TYPE | "ALL">("ALL");
  const [ppeRequests, setPpeRequests] = useState<PpeRequest[]>([]);

  // Query params for fetching PPE items
  const queryParams = useMemo<ItemGetManyFormData>(() => {
    const params: ItemGetManyFormData = {
      where: {
        ppeType: {
          not: null,
        },
        isActive: true,
      },
      include: {
        brand: true,
        category: true,
      },
      orderBy: {
        name: "asc",
      },
      limit: 100,
    };

    // Filter by type
    if (selectedType !== "ALL") {
      params.where = {
        ...params.where,
        ppeType: selectedType,
      };
    }

    // Add search filter
    if (debouncedSearchText) {
      params.searchingFor = debouncedSearchText;
    }

    return params;
  }, [selectedType, debouncedSearchText]);

  const { data: itemsData, isLoading: isLoadingItems } = useItems(queryParams);
  const availablePpes = itemsData?.data || [];

  // Form setup
  const form = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      requests: [],
    },
  });

  // Mutation for submitting requests
  const requestMutation = useMutation({
    mutationFn: async (data: RequestFormData) => {
      // Create individual requests for each item
      const promises = data.requests.map((request) => {
        return requestPpeDelivery({
          itemId: request.itemId,
          quantity: 1,
          reason: request.reason,
        });
      });

      const results = await Promise.all(promises);
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ppeDeliveries", "my-requests"] });
      navigate(routes.personal.myPpes.root);
    },
    onError: (error: any) => {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[PPE Request] Mutation failed:', error);
        console.error('[PPE Request] Error details:', {
          message: error.message,
          response: error.response,
          stack: error.stack,
        });
      }
    },
  });

  // Add PPE to request list
  const handleAddPpe = (item: Item) => {
    // Check if already added
    const exists = ppeRequests.find((r) => r.itemId === item.id);
    if (exists) {
      toast.warning("Este EPI já foi adicionado à solicitação");
      return;
    }

    setPpeRequests([
      ...ppeRequests,
      {
        itemId: item.id,
        quantity: 1,
        reason: "",
        item,
      },
    ]);
    toast.success(`${item.name} adicionado à solicitação`);
  };

  // Remove PPE from request list
  const handleRemovePpe = (itemId: string) => {
    setPpeRequests(ppeRequests.filter((r) => r.itemId !== itemId));
  };

  // Update reason
  const handleUpdateReason = (itemId: string, reason: string) => {
    setPpeRequests(
      ppeRequests.map((r) => (r.itemId === itemId ? { ...r, reason } : r))
    );
  };

  // Submit form
  const handleSubmit = () => {
    if (ppeRequests.length === 0) {
      toast.error("Adicione pelo menos um EPI à solicitação");
      return;
    }

    // Validate all items have reasons
    const itemsWithoutReason = ppeRequests.filter((r) => !r.reason.trim());
    if (itemsWithoutReason.length > 0) {
      toast.error("Preencha a justificativa de todos os EPIs");
      return;
    }

    form.setValue("requests", ppeRequests);
    form.handleSubmit((data) => {
      requestMutation.mutate(data);
    })();
  };

  if (!user) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent>
          <p className="text-muted-foreground">Faça login para solicitar EPIs</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
      {/* Left side: Available PPEs */}
      <Card className="flex flex-col rounded-md">
        <CardHeader className="px-8 py-3 flex-shrink-0 border-b border-border">
          <CardTitle className="text-xl font-bold">EPIs Disponíveis</CardTitle>
          <CardDescription>Selecione os EPIs que deseja solicitar</CardDescription>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col px-8 py-4 space-y-4 overflow-hidden">
          {/* Search and filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Buscar por nome ou código..."
                value={searchText}
                onChange={(value) => setSearchText(typeof value === "string" ? value : "")}
                className="pl-10"
              />
            </div>
            <Select value={selectedType} onValueChange={(value) => setSelectedType(value as PPE_TYPE | "ALL")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo de EPI" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {Object.entries(PPE_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* PPE List */}
          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {isLoadingItems ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : availablePpes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchText || selectedType !== "ALL"
                    ? "Nenhum EPI encontrado com os filtros aplicados"
                    : "Nenhum EPI disponível"}
                </div>
              ) : (
                availablePpes.map((item) => (
                  <Card key={item.id} className="p-4 hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <IconPackage className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{item.name}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {item.ppeSize && (
                            <Badge variant="secondary" className="text-xs">
                              Tamanho: {item.ppeSize}
                            </Badge>
                          )}
                          {item.uniCode && (
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.uniCode}</code>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Estoque: {item.quantity} unidades
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddPpe(item)}
                        disabled={ppeRequests.some((r) => r.itemId === item.id)}
                        className="gap-2"
                      >
                        <IconPlus className="h-4 w-4" />
                        Adicionar
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Right side: Request Cart */}
      <Card className="flex flex-col rounded-md">
        <CardHeader className="px-8 py-3 flex-shrink-0 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-2">
              <CardTitle className="text-xl font-bold">Minha Solicitação</CardTitle>
              <Breadcrumb />
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col px-8 py-4 space-y-4 overflow-hidden">
          {ppeRequests.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <IconPackage className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Nenhum EPI selecionado</p>
                <p className="text-sm">Adicione EPIs da lista ao lado para fazer sua solicitação</p>
              </div>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>EPI</TableHead>
                        <TableHead>Justificativa</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ppeRequests.map((request) => (
                        <TableRow key={request.itemId}>
                          <TableCell>
                            <div className="font-medium">
                              {request.item?.name}
                              {request.item?.ppeSize ? ` • ${request.item.ppeSize}` : ""}
                            </div>
                            {request.item?.ppeCA && (
                              <div className="text-xs text-muted-foreground">
                                CA: {request.item.ppeCA}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="text"
                              placeholder="Motivo da solicitação *"
                              value={request.reason}
                              onChange={(value) => {
                                handleUpdateReason(request.itemId, value as string);
                              }}
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemovePpe(request.itemId)}
                              className="text-destructive hover:text-destructive"
                            >
                              <IconTrash className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>

              <div className="flex-shrink-0 space-y-2">
                <div className="flex items-center justify-between p-4 bg-muted rounded-md">
                  <span className="font-medium">Total de itens:</span>
                  <span className="text-lg font-bold">{ppeRequests.length}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => navigate(routes.personal.myPpes.root)}
                    className="flex-1 gap-2"
                  >
                    <IconArrowLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={requestMutation.isPending || ppeRequests.length === 0}
                    className="flex-1 gap-2"
                  >
                    {requestMutation.isPending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <IconCheck className="h-4 w-4" />
                    )}
                    Enviar Solicitação
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
