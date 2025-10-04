import React, { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { IconCircleCheck, IconCircleX, IconRefresh, IconClock, IconUser, IconCalendar, IconClockEdit, IconFileDescription, IconArrowsExchange, IconDeviceMobile, IconFingerprint, IconQrcode, IconId, IconWifi, IconWifiOff } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useSecullumRequests, useSecullumApproveRequest, useSecullumRejectRequest } from "../../../../hooks";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface TimeEntry {
  field: string;
  current: string | null;
  requested: string | null;
  isChanged: boolean;
}

interface TimeAdjustmentRequest {
  Id: number;
  Data: string;
  DataFim: string | null;
  FuncionarioId: number;
  FuncionarioNome: string;
  Entrada1: string | null;
  Saida1: string | null;
  Entrada2: string | null;
  Saida2: string | null;
  Entrada3: string | null;
  Saida3: string | null;
  Entrada1Original: string | null;
  Saida1Original: string | null;
  Entrada2Original: string | null;
  Saida2Original: string | null;
  Entrada3Original: string | null;
  Saida3Original: string | null;
  OrigemEntrada1: number | null;
  OrigemSaida1: number | null;
  OrigemEntrada2: number | null;
  OrigemSaida2: number | null;
  OrigemEntrada3: number | null;
  OrigemSaida3: number | null;
  Tipo: number;
  TipoDescricao: string;
  Estado: number;
  Observacoes: string | null;
  DataSolicitacao: string;
  AlteracoesFonteDados: any[];
  Versao: string;
  TipoSolicitacao?: number;
  DispositivoTipo?: 'mobile' | 'biometric' | 'qrcode' | 'card' | 'web';
  DispositivoNome?: string;
}

// Helper function to get origin info (origin: 16 = Ponto Virtual Offline, null/undefined = Solicitado pelo usuário)
const getOriginInfo = (origin: number | null | undefined) => {
  if (origin === 16) {
    return {
      icon: IconWifiOff,
      label: 'Ponto Virtual Offline',
      color: 'text-neutral-900 dark:text-neutral-100'
    };
  }
  // No origin means requested by user
  return {
    icon: IconUser,
    label: 'Solicitado pelo usuário',
    color: 'text-neutral-900 dark:text-neutral-100'
  };
};

// Helper function to get device icon and label
const getDeviceInfo = (type?: string) => {
  switch (type) {
    case 'mobile':
      return { icon: IconDeviceMobile, label: 'Aplicativo móvel', color: 'text-blue-600' };
    case 'biometric':
      return { icon: IconFingerprint, label: 'Biometria', color: 'text-green-600' };
    case 'qrcode':
      return { icon: IconQrcode, label: 'QR Code', color: 'text-purple-600' };
    case 'card':
      return { icon: IconId, label: 'Cartão', color: 'text-orange-600' };
    case 'web':
    default:
      return { icon: IconUser, label: 'Portal web', color: 'text-gray-600' };
  }
};

const TimeEntryLabel: Record<string, string> = {
  Entrada1: "Entrada 1",
  Saida1: "Saída 1",
  Entrada2: "Entrada 2",
  Saida2: "Saída 2",
  Entrada3: "Entrada 3",
  Saida3: "Saída 3",
};

// Helper function to detect which fields were actually modified vs just shifted
const detectActualChanges = (request: TimeAdjustmentRequest): Set<string> => {
  const changedFields = new Set<string>();

  // Collect all original and requested time values
  const originalTimes = [
    request.Entrada1Original,
    request.Saida1Original,
    request.Entrada2Original,
    request.Saida2Original,
    request.Entrada3Original,
    request.Saida3Original
  ].filter(t => t && t !== "");

  const requestedTimes = [
    request.Entrada1,
    request.Saida1,
    request.Entrada2,
    request.Saida2,
    request.Entrada3,
    request.Saida3
  ].filter(t => t && t !== "");

  // Check each field to see if it's a genuine change or just a shift
  const fields = ['Entrada1', 'Saida1', 'Entrada2', 'Saida2', 'Entrada3', 'Saida3'];

  fields.forEach((field) => {
    const original = request[`${field}Original` as keyof TimeAdjustmentRequest] as string | null;
    const requested = request[field as keyof TimeAdjustmentRequest] as string | null;

    // Skip if both are empty
    if ((!original || original === "") && (!requested || requested === "")) {
      return;
    }

    // If values are different
    if (original !== requested) {
      // Check if the requested value exists somewhere in the original times
      // If it doesn't exist in originals, it's a genuine modification
      if (requested && !originalTimes.includes(requested)) {
        changedFields.add(field);
      }
      // If original value doesn't appear in requested times, it was removed/changed
      else if (original && !requestedTimes.includes(original)) {
        changedFields.add(field);
      }
    }
  });

  return changedFields;
};

// Helper function to check if a time entry was changed
const isTimeChanged = (fieldName: string, request: TimeAdjustmentRequest): boolean => {
  const actualChanges = detectActualChanges(request);
  return actualChanges.has(fieldName);
};

interface TimeAdjustmentRequestsProps {
  className?: string;
  onSelectedRequestChange?: (request: TimeAdjustmentRequest | null) => void;
  onActionsChange?: (
    approve: (() => void) | null,
    reject: (() => void) | null,
    refresh: (() => void) | null
  ) => void;
}

export function TimeAdjustmentRequests({ className, onSelectedRequestChange, onActionsChange }: TimeAdjustmentRequestsProps) {
  const [selectedRequest, setSelectedRequest] = useState<TimeAdjustmentRequest | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    request: TimeAdjustmentRequest;
  } | null>(null);

  const { data, isLoading, error, refetch } = useSecullumRequests(true); // Only get pending requests
  const approveRequest = useSecullumApproveRequest();
  const rejectRequest = useSecullumRejectRequest();

  // Ensure pendingRequests is always an array
  // The hook returns data in the format: { data: { success, message, data: [...] } }
  const pendingRequests = React.useMemo(() => {
    if (!data) return [];

    let requests: TimeAdjustmentRequest[] = [];

    // Handle the nested response structure from the API
    if (data && typeof data === 'object') {
      // Check if it's the response wrapper
      if ('data' in data && data.data) {
        // Check if data.data has the success/message/data structure
        if ('success' in data.data && 'data' in data.data && Array.isArray(data.data.data)) {
          requests = data.data.data;
        }
        // Or if data.data is directly an array
        else if (Array.isArray(data.data)) {
          requests = data.data;
        }
      }
      // Check if data itself is the success/message/data structure
      else if ('success' in data && 'data' in data && Array.isArray(data.data)) {
        requests = data.data;
      }
    }
    // If data is directly an array
    else if (Array.isArray(data)) {
      requests = data;
    }

    return requests;
  }, [data]);

  // Auto-select first request when data loads
  useEffect(() => {
    if (pendingRequests && pendingRequests.length > 0 && !selectedRequest) {
      const firstRequest = pendingRequests[0];
      setSelectedRequest(firstRequest);
      onSelectedRequestChange?.(firstRequest);
    }
  }, [pendingRequests, selectedRequest, onSelectedRequestChange]);

  // Update parent when selected request changes
  useEffect(() => {
    onSelectedRequestChange?.(selectedRequest);
  }, [selectedRequest, onSelectedRequestChange]);

  // Memoize the reject dialog opener
  const openRejectDialog = useCallback(() => {
    setRejectReason("");
    setRejectDialogOpen(true);
  }, []);

  // Memoize the refetch callback
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Update parent with current actions
  useEffect(() => {
    if (selectedRequest) {
      onActionsChange?.(
        handleApprove,
        openRejectDialog,
        handleRefresh
      );
    } else {
      onActionsChange?.(null, null, handleRefresh);
    }
  }, [selectedRequest, onActionsChange, handleApprove, openRejectDialog, handleRefresh]);

  // Handle context menu
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };

    if (contextMenu) {
      document.addEventListener("click", handleClick);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("click", handleClick);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [contextMenu]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-12rem)] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[calc(100vh-12rem)] items-center justify-center">
        <Alert className="max-w-md">
          <IconWifiOff className="h-4 w-4" />
          <AlertTitle>Erro ao carregar requisições</AlertTitle>
          <AlertDescription>
            Não foi possível conectar ao sistema Secullum. Verifique se a integração está configurada corretamente.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Function to get time entries comparison
  const getTimeEntries = (request: TimeAdjustmentRequest): TimeEntry[] => {
    const entries: TimeEntry[] = [];
    const actualChanges = detectActualChanges(request);

    // Check each time entry pair
    ["Entrada1", "Saida1", "Entrada2", "Saida2", "Entrada3", "Saida3"].forEach((field) => {
      const currentValue = request[`${field}Original` as keyof TimeAdjustmentRequest] as string | null;
      const requestedValue = request[field as keyof TimeAdjustmentRequest] as string | null;

      // Only show if there's a current or requested value
      if (currentValue || requestedValue) {
        entries.push({
          field: TimeEntryLabel[field] || field,
          current: currentValue,
          requested: requestedValue,
          isChanged: actualChanges.has(field)
        });
      }
    });

    return entries;
  };

  const handleApprove = useCallback(async () => {
    if (!selectedRequest) return;

    try {
      await approveRequest.mutateAsync({
        requestId: selectedRequest.Id.toString(),
        data: {
          Versao: selectedRequest.Versao,
          AlteracoesFonteDados: selectedRequest.AlteracoesFonteDados,
          TipoSolicitacao: selectedRequest.TipoSolicitacao || 0
        }
      });

      // Refresh and select next request
      await refetch();
      const newSelectedRequest = null;
      setSelectedRequest(newSelectedRequest);
      onSelectedRequestChange?.(newSelectedRequest);
    } catch (error) {
      // Error handled by hook
    }
  }, [selectedRequest, approveRequest, refetch, onSelectedRequestChange]);

  const handleReject = useCallback(async () => {
    if (!selectedRequest || !rejectReason) return;

    try {
      await rejectRequest.mutateAsync({
        requestId: selectedRequest.Id.toString(),
        data: {
          Versao: selectedRequest.Versao,
          MotivoDescarte: rejectReason,
          TipoSolicitacao: selectedRequest.TipoSolicitacao || 0
        }
      });

      // Refresh and select next request
      await refetch();
      const newSelectedRequest = null;
      setSelectedRequest(newSelectedRequest);
      onSelectedRequestChange?.(newSelectedRequest);
      setRejectDialogOpen(false);
      setRejectReason("");
    } catch (error) {
      // Error handled by hook
    }
  }, [selectedRequest, rejectReason, rejectRequest, refetch, onSelectedRequestChange]);

  const handleContextMenu = (e: React.MouseEvent, request: TimeAdjustmentRequest) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      request
    });
  };

  return (
    <>
      <Card className={cn("flex flex-col overflow-hidden", className)}>
        <div className="flex h-full">
          {/* Left Panel - Request List */}
          <div className="w-[420px] flex-shrink-0 border-r border-border/50 flex flex-col">
            <div className="px-6 py-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <IconClockEdit className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">
                  Ajustes Pendentes
                </h3>
                <Badge variant="secondary" className="ml-2">
                  {pendingRequests.length}
                </Badge>
              </div>
            </div>
            <ScrollArea className="flex-1">
              {pendingRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6">
                  <IconClock className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Nenhuma solicitação pendente
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    As solicitações aparecerão aqui quando enviadas
                  </p>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.Id}
                      onClick={() => {
                        setSelectedRequest(request);
                        onSelectedRequestChange?.(request);
                      }}
                      onContextMenu={(e) => handleContextMenu(e, request)}
                      className={cn(
                        "relative p-4 rounded-lg border cursor-pointer transition-all duration-200",
                        selectedRequest?.Id === request.Id
                          ? "border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                          : "border-border/50 bg-card hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:shadow-sm"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <IconUser className={cn(
                              "h-4 w-4",
                              selectedRequest?.Id === request.Id ? "text-primary-foreground" : "text-primary"
                            )} />
                            <span className={cn(
                              "font-medium text-sm",
                              selectedRequest?.Id === request.Id ? "text-primary-foreground" : "text-foreground"
                            )}>
                              {request.FuncionarioNome}
                            </span>
                          </div>
                          <div className={cn(
                            "flex items-center gap-4 text-xs",
                            selectedRequest?.Id === request.Id ? "text-primary-foreground/80" : "text-muted-foreground"
                          )}>
                            <div className="flex items-center gap-1">
                              <IconCalendar className="h-3 w-3" />
                              {format(new Date(request.Data), "dd/MM/yyyy")}
                            </div>
                            <Badge
                              variant={selectedRequest?.Id === request.Id ? "secondary" : "outline"}
                              className={cn(
                                "text-xs px-2 py-0",
                                selectedRequest?.Id === request.Id && "bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30"
                              )}
                            >
                              {request.TipoDescricao}
                            </Badge>
                          </div>
                        </div>
                        {selectedRequest?.Id === request.Id && (
                          <div className="ml-2">
                            <div className="h-2 w-2 rounded-full bg-primary-foreground animate-pulse shadow-sm" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right Panel - Request Details */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedRequest ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center space-y-3">
                  <div className="inline-flex p-4 rounded-full bg-muted/50">
                    <IconFileDescription className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">
                      Nenhuma solicitação selecionada
                    </p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      Selecione uma solicitação na lista para visualizar os detalhes
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="px-8 py-6 border-b border-border/50 flex-shrink-0">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <IconUser className="h-5 w-5 text-primary" />
                        <h2 className="text-xl font-semibold">
                          {selectedRequest.FuncionarioNome}
                        </h2>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <Badge variant="secondary">
                          {selectedRequest.TipoDescricao}
                        </Badge>
                        <span>•</span>
                        <span>{format(new Date(selectedRequest.Data), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  <div className="px-8 py-6 space-y-6">
                  {/* Request Metadata */}
                  <div className="rounded-lg bg-muted/30 p-4 space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <IconFileDescription className="h-4 w-4 text-primary" />
                      Informações da Solicitação
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Data do Ponto</p>
                        <p className="text-sm font-medium">
                          {format(new Date(selectedRequest.Data), "dd/MM/yyyy")}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Solicitado em</p>
                        <p className="text-sm font-medium">
                          {format(new Date(selectedRequest.DataSolicitacao), "dd/MM/yyyy HH:mm")}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Tipo</p>
                        <p className="text-sm font-medium">{selectedRequest.TipoDescricao}</p>
                      </div>
                    </div>
                    {selectedRequest.Observacoes && (
                      <div className="mt-4 pt-4 border-t border-border/50">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Observação</p>
                          <p className="text-sm">{selectedRequest.Observacoes}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Time Entries Comparison */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <IconArrowsExchange className="h-4 w-4 text-primary" />
                        Comparação de Marcações
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {getTimeEntries(selectedRequest).filter(e => e.isChanged).length} alterações
                      </Badge>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-border/50">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow className="h-9">
                            <TableHead className="w-24 font-medium">Marcação</TableHead>
                            <TableHead className="text-center">Entrada 1</TableHead>
                            <TableHead className="text-center">Saída 1</TableHead>
                            <TableHead className="text-center">Entrada 2</TableHead>
                            <TableHead className="text-center">Saída 2</TableHead>
                            <TableHead className="text-center">Entrada 3</TableHead>
                            <TableHead className="text-center">Saída 3</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow className="h-10">
                            <TableCell className="font-medium text-xs py-2">
                              <Badge variant="secondary" className="text-xs">Original</Badge>
                            </TableCell>
                            <TableCell className="text-center text-sm font-mono py-2">
                              <div className="flex items-center justify-center gap-1">
                                <span>{selectedRequest.Entrada1Original || "-"}</span>
                                {selectedRequest.Entrada1Original && selectedRequest.OrigemEntrada1 !== undefined && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="p-0.5">
                                          {React.createElement(getOriginInfo(selectedRequest.OrigemEntrada1).icon, {
                                            className: cn("h-3 w-3", getOriginInfo(selectedRequest.OrigemEntrada1).color)
                                          })}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">{getOriginInfo(selectedRequest.OrigemEntrada1).label}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm font-mono py-2">
                              <div className="flex items-center justify-center gap-1">
                                <span>{selectedRequest.Saida1Original || "-"}</span>
                                {selectedRequest.Saida1Original && selectedRequest.OrigemSaida1 !== undefined && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="p-0.5">
                                          {React.createElement(getOriginInfo(selectedRequest.OrigemSaida1).icon, {
                                            className: cn("h-3 w-3", getOriginInfo(selectedRequest.OrigemSaida1).color)
                                          })}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">{getOriginInfo(selectedRequest.OrigemSaida1).label}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm font-mono py-2">
                              <div className="flex items-center justify-center gap-1">
                                <span>{selectedRequest.Entrada2Original || "-"}</span>
                                {selectedRequest.Entrada2Original && selectedRequest.OrigemEntrada2 !== undefined && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="p-0.5">
                                          {React.createElement(getOriginInfo(selectedRequest.OrigemEntrada2).icon, {
                                            className: cn("h-3 w-3", getOriginInfo(selectedRequest.OrigemEntrada2).color)
                                          })}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">{getOriginInfo(selectedRequest.OrigemEntrada2).label}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm font-mono py-2">
                              <div className="flex items-center justify-center gap-1">
                                <span>{selectedRequest.Saida2Original || "-"}</span>
                                {selectedRequest.Saida2Original && selectedRequest.OrigemSaida2 !== undefined && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="p-0.5">
                                          {React.createElement(getOriginInfo(selectedRequest.OrigemSaida2).icon, {
                                            className: cn("h-3 w-3", getOriginInfo(selectedRequest.OrigemSaida2).color)
                                          })}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">{getOriginInfo(selectedRequest.OrigemSaida2).label}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm font-mono py-2">
                              <div className="flex items-center justify-center gap-1">
                                <span>{selectedRequest.Entrada3Original || "-"}</span>
                                {selectedRequest.Entrada3Original && selectedRequest.OrigemEntrada3 !== undefined && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="p-0.5">
                                          {React.createElement(getOriginInfo(selectedRequest.OrigemEntrada3).icon, {
                                            className: cn("h-3 w-3", getOriginInfo(selectedRequest.OrigemEntrada3).color)
                                          })}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">{getOriginInfo(selectedRequest.OrigemEntrada3).label}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm font-mono py-2">
                              <div className="flex items-center justify-center gap-1">
                                <span>{selectedRequest.Saida3Original || "-"}</span>
                                {selectedRequest.Saida3Original && selectedRequest.OrigemSaida3 !== undefined && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="p-0.5">
                                          {React.createElement(getOriginInfo(selectedRequest.OrigemSaida3).icon, {
                                            className: cn("h-3 w-3", getOriginInfo(selectedRequest.OrigemSaida3).color)
                                          })}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">{getOriginInfo(selectedRequest.OrigemSaida3).label}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          <TableRow className="h-10">
                            <TableCell className="font-medium text-xs py-2">
                              <Badge className="text-xs">Solicitado</Badge>
                            </TableCell>
                            <TableCell className={cn(
                              "text-center text-sm font-mono py-2 transition-colors",
                              isTimeChanged('Entrada1', selectedRequest) &&
                              "bg-green-100 dark:bg-green-950/30 font-semibold text-green-700 dark:text-green-400"
                            )}>
                              <div className="flex items-center justify-center gap-1">
                                <span>{selectedRequest.Entrada1 || "-"}</span>
                                {selectedRequest.Entrada1 && isTimeChanged('Entrada1', selectedRequest) && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="p-0.5">
                                          {React.createElement(IconUser, {
                                            className: cn("h-3 w-3", "text-neutral-900 dark:text-neutral-100")
                                          })}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">Solicitado pelo usuário</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className={cn(
                              "text-center text-sm font-mono py-2 transition-colors",
                              isTimeChanged('Saida1', selectedRequest) &&
                              "bg-green-100 dark:bg-green-950/30 font-semibold text-green-700 dark:text-green-400"
                            )}>
                              <div className="flex items-center justify-center gap-1">
                                <span>{selectedRequest.Saida1 || "-"}</span>
                                {selectedRequest.Saida1 && isTimeChanged('Saida1', selectedRequest) && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="p-0.5">
                                          {React.createElement(IconUser, {
                                            className: cn("h-3 w-3", "text-neutral-900 dark:text-neutral-100")
                                          })}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">Solicitado pelo usuário</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className={cn(
                              "text-center text-sm font-mono py-2 transition-colors",
                              isTimeChanged('Entrada2', selectedRequest) &&
                              "bg-green-100 dark:bg-green-950/30 font-semibold text-green-700 dark:text-green-400"
                            )}>
                              <div className="flex items-center justify-center gap-1">
                                <span>{selectedRequest.Entrada2 || "-"}</span>
                                {selectedRequest.Entrada2 && isTimeChanged('Entrada2', selectedRequest) && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="p-0.5">
                                          {React.createElement(IconUser, {
                                            className: cn("h-3 w-3", "text-neutral-900 dark:text-neutral-100")
                                          })}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">Solicitado pelo usuário</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className={cn(
                              "text-center text-sm font-mono py-2 transition-colors",
                              isTimeChanged('Saida2', selectedRequest) &&
                              "bg-green-100 dark:bg-green-950/30 font-semibold text-green-700 dark:text-green-400"
                            )}>
                              <div className="flex items-center justify-center gap-1">
                                <span>{selectedRequest.Saida2 || "-"}</span>
                                {selectedRequest.Saida2 && isTimeChanged('Saida2', selectedRequest) && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="p-0.5">
                                          {React.createElement(IconUser, {
                                            className: cn("h-3 w-3", "text-neutral-900 dark:text-neutral-100")
                                          })}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">Solicitado pelo usuário</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className={cn(
                              "text-center text-sm font-mono py-2 transition-colors",
                              isTimeChanged('Entrada3', selectedRequest) &&
                              "bg-green-100 dark:bg-green-950/30 font-semibold text-green-700 dark:text-green-400"
                            )}>
                              <div className="flex items-center justify-center gap-1">
                                <span>{selectedRequest.Entrada3 || "-"}</span>
                                {selectedRequest.Entrada3 && isTimeChanged('Entrada3', selectedRequest) && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="p-0.5">
                                          {React.createElement(IconUser, {
                                            className: cn("h-3 w-3", "text-neutral-900 dark:text-neutral-100")
                                          })}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">Solicitado pelo usuário</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className={cn(
                              "text-center text-sm font-mono py-2 transition-colors",
                              isTimeChanged('Saida3', selectedRequest) &&
                              "bg-green-100 dark:bg-green-950/30 font-semibold text-green-700 dark:text-green-400"
                            )}>
                              <div className="flex items-center justify-center gap-1">
                                <span>{selectedRequest.Saida3 || "-"}</span>
                                {selectedRequest.Saida3 && isTimeChanged('Saida3', selectedRequest) && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="p-0.5">
                                          {React.createElement(IconUser, {
                                            className: cn("h-3 w-3", "text-neutral-900 dark:text-neutral-100")
                                          })}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">Solicitado pelo usuário</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Context Menu */}
      {contextMenu && (
        <div className="fixed z-50" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <DropdownMenu open={true} onOpenChange={(open) => !open && setContextMenu(null)}>
            <DropdownMenuTrigger asChild>
              <div className="w-0 h-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" onCloseAutoFocus={(e) => e.preventDefault()}>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedRequest(contextMenu.request);
                  onSelectedRequestChange?.(contextMenu.request);
                  setContextMenu(null);
                }}
              >
                <IconFileDescription className="mr-2 h-4 w-4" />
                Ver detalhes
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setSelectedRequest(contextMenu.request);
                  onSelectedRequestChange?.(contextMenu.request);
                  handleApprove();
                  setContextMenu(null);
                }}
                className="text-green-600"
              >
                <IconCircleCheck className="mr-2 h-4 w-4" />
                Aprovar solicitação
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedRequest(contextMenu.request);
                  onSelectedRequestChange?.(contextMenu.request);
                  setRejectReason("");
                  setRejectDialogOpen(true);
                  setContextMenu(null);
                }}
                className="text-red-600"
              >
                <IconCircleX className="mr-2 h-4 w-4" />
                Rejeitar solicitação
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconCircleX className="h-5 w-5 text-destructive" />
              Rejeitar Solicitação
            </DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição para a solicitação de {selectedRequest?.FuncionarioNome}.
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo da Rejeição</Label>
              <Textarea
                id="reason"
                placeholder="Descreva o motivo da rejeição..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="min-h-[100px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Este motivo será registrado no sistema
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={rejectRequest.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || rejectRequest.isPending}
              className="gap-2"
            >
              {rejectRequest.isPending ? (
                <>
                  <LoadingSpinner size="sm" />
                  Rejeitando...
                </>
              ) : (
                <>
                  <IconCircleX className="h-4 w-4" />
                  Confirmar Rejeição
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}