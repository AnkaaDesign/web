import { useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useTaskDetail, useTaskMutations, useServiceOrderMutations, useCutsByTask, useLayoutsByTruck } from "../../../../hooks";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, getBadgeVariantFromStatus } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import type { ComboboxOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import {
  SECTOR_PRIVILEGES,
  routes,
  TASK_STATUS,
  TASK_STATUS_LABELS,
  SERVICE_ORDER_STATUS,
  PAINT_FINISH,
  CHANGE_LOG_ENTITY_TYPE,
  ENTITY_BADGE_CONFIG,
  PAINT_FINISH_LABELS,
  PAINT_BRAND_LABELS,
  TRUCK_MANUFACTURER_LABELS,
  SERVICE_ORDER_STATUS_LABELS,
  CUT_STATUS_LABELS,
  CUT_TYPE_LABELS,
  CUT_ORIGIN_LABELS,
  AIRBRUSHING_STATUS_LABELS,
} from "../../../../constants";
import { formatDate, formatDateTime, formatCurrency, isValidTaskStatusTransition } from "../../../../utils";
import { generateBudgetPDF } from "../../../../utils/budget-pdf-generator";
import { usePageTracker } from "@/hooks/use-page-tracker";
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
import { LoadingSpinner } from "@/components/ui/loading";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import {
  IconClipboardList,
  IconEdit,
  IconPlayerPlay,
  IconCheck,
  IconClock,
  IconCalendar,
  IconUser,
  IconBuilding,
  IconBuildingFactory,
  IconCurrencyReal,
  IconFile,
  IconFileText,
  IconFileInvoice,
  IconPaint,
  IconFiles,
  IconAlertCircle,
  IconTruck,
  IconHash,
  IconCar,
  IconRefresh,
  IconHome,
  IconSparkles,
  IconBrush,
  IconTruckLoading,
  IconCut,
  IconSpray,
  IconDownload,
  IconLayoutGrid,
  IconHistory,
  IconPlayerPause,
  IconBarcode,
  IconList,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { CanvasNormalMapRenderer } from "@/components/paint/effects/canvas-normal-map-renderer";
import { FileItem, FilePreviewModal, useFileViewer, type FileViewMode } from "@/components/file";

// Component to display truck layout SVG preview
const TruckLayoutPreview = ({ truckId, taskName }: { truckId: string; taskName?: string }) => {
  const { data: layouts } = useLayoutsByTruck(truckId);
  const [selectedSide, setSelectedSide] = useState<'left' | 'right' | 'back'>('left');

  if (!layouts) return null;

  const hasLayouts = layouts.leftSideLayout || layouts.rightSideLayout || layouts.backSideLayout;
  if (!hasLayouts) return null;

  // Get current layout
  const currentLayout = selectedSide === 'left' ? layouts.leftSideLayout :
                       selectedSide === 'right' ? layouts.rightSideLayout :
                       layouts.backSideLayout;

  if (!currentLayout) return null;

  // Generate SVG for preview
  const generatePreviewSVG = (layout: any, side: string, includeLabels: boolean = false) => {
    const getSideLabel = (s: string) => {
      switch (s) {
        case 'left': return 'Motorista';
        case 'right': return 'Sapo';
        case 'back': return 'Traseira';
        default: return s;
      }
    };

    const height = layout.height * 100; // Convert to cm
    const sections = layout.layoutSections || layout.sections;
    const totalWidth = sections.reduce((sum: number, s: any) => sum + s.width * 100, 0);
    const margin = 50;
    // Reduce extra space when not including labels
    const extraSpace = includeLabels ? 100 : 50;
    const svgWidth = totalWidth + margin * 2 + extraSpace;
    const svgHeight = height + margin * 2 + extraSpace;

    let svg = `<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">`;

    // Only add title text when downloading (includeLabels = true)
    if (includeLabels) {
      svg += `
      <!-- Title text -->
      ${taskName ? `<text x="${margin}" y="25" text-anchor="start" font-size="16" font-weight="bold" fill="#000">${taskName}</text>` : ''}
      <text x="${margin}" y="${taskName ? 45 : 25}" text-anchor="start" font-size="14" fill="#666">${getSideLabel(side)}</text>`;
    }

    svg += `
      <!-- Main container -->
      <rect x="${margin}" y="${margin}" width="${totalWidth}" height="${height}" fill="none" stroke="#000" stroke-width="1"/>`;

    // Add section dividers (vertical lines between non-door sections)
    let currentPos = 0;
    sections.forEach((section: any, index: number) => {
      const sectionWidth = section.width * 100;

      // Only draw vertical divider lines between regular sections (not for doors)
      // Check if this is not the first section, current section is not a door, and previous section is not a door
      if (index > 0) {
        const prevSection = sections[index - 1];
        if (!section.isDoor && !prevSection.isDoor) {
          const lineX = margin + currentPos;
          svg += `
          <line x1="${lineX}" y1="${margin}" x2="${lineX}" y2="${margin + height}"
                stroke="#333" stroke-width="0.5"/>`;
        }
      }

      currentPos += sectionWidth;
    });

    // Add doors (check if layout has doors array or convert from sections)
    if (layout.doors && layout.doors.length > 0) {
      // New format with doors array
      layout.doors.forEach((door: any) => {
        const doorX = margin + (door.position || 0) * 100;
        const doorWidth = (door.width || 0) * 100;
        const doorOffsetTop = (door.offsetTop || door.topOffset || 0) * 100;
        const doorY = margin + doorOffsetTop;

        // Left vertical line of door
        svg += `
        <line x1="${doorX}" y1="${doorY}" x2="${doorX}" y2="${margin + height}"
              stroke="#000" stroke-width="1"/>`;

        // Right vertical line of door
        svg += `
        <line x1="${doorX + doorWidth}" y1="${doorY}" x2="${doorX + doorWidth}" y2="${margin + height}"
              stroke="#000" stroke-width="1"/>`;

        // Top horizontal line of door
        svg += `
        <line x1="${doorX}" y1="${doorY}" x2="${doorX + doorWidth}" y2="${doorY}"
              stroke="#000" stroke-width="1"/>`;
      });
    } else if (layout.layoutSections || layout.sections) {
      // Handle both new LayoutSection entity format and old sections format
      const sections = layout.layoutSections || layout.sections;
      let currentPos = 0;
      sections.forEach((section: any, index: number) => {
        const sectionWidth = section.width * 100;
        const sectionX = margin + currentPos;

        // Check if this section is a door
        if (section.isDoor && section.doorOffset !== null && section.doorOffset !== undefined) {
          const doorOffsetTop = section.doorOffset * 100;
          const doorY = margin + doorOffsetTop;

          // Left vertical line of door
          svg += `
          <line x1="${sectionX}" y1="${doorY}" x2="${sectionX}" y2="${margin + height}"
                stroke="#000" stroke-width="1"/>`;

          // Right vertical line of door
          svg += `
          <line x1="${sectionX + sectionWidth}" y1="${doorY}" x2="${sectionX + sectionWidth}" y2="${margin + height}"
                stroke="#000" stroke-width="1"/>`;

          // Top horizontal line of door
          svg += `
          <line x1="${sectionX}" y1="${doorY}" x2="${sectionX + sectionWidth}" y2="${doorY}"
                stroke="#000" stroke-width="1"/>`;
        }

        currentPos += sectionWidth;
      });
    }

    // Add dimensions with arrows
    currentPos = 0;
    sections.forEach((section: any, index: number) => {
      const sectionWidth = section.width * 100;
      const startX = margin + currentPos;
      const endX = margin + currentPos + sectionWidth;
      const centerX = startX + sectionWidth / 2;
      const dimY = margin + height + 20;

      svg += `
      <line x1="${startX}" y1="${dimY}" x2="${endX}" y2="${dimY}" stroke="#0066cc" stroke-width="1"/>
      <polygon points="${startX},${dimY} ${startX + 5},${dimY - 3} ${startX + 5},${dimY + 3}" fill="#0066cc"/>
      <polygon points="${endX},${dimY} ${endX - 5},${dimY - 3} ${endX - 5},${dimY + 3}" fill="#0066cc"/>
      <text x="${centerX}" y="${dimY + 15}" text-anchor="middle" font-size="12" fill="#0066cc">${Math.round(sectionWidth)}</text>`;

      currentPos += sectionWidth;
    });

    // Height dimension
    const dimX = margin - 20;
    svg += `
    <line x1="${dimX}" y1="${margin}" x2="${dimX}" y2="${margin + height}" stroke="#0066cc" stroke-width="1"/>
    <polygon points="${dimX},${margin} ${dimX - 3},${margin + 5} ${dimX + 3},${margin + 5}" fill="#0066cc"/>
    <polygon points="${dimX},${margin + height} ${dimX - 3},${margin + height - 5} ${dimX + 3},${margin + height - 5}" fill="#0066cc"/>
    <text x="${dimX - 10}" y="${margin + height / 2}" text-anchor="middle" font-size="12" fill="#0066cc" transform="rotate(-90, ${dimX - 10}, ${margin + height / 2})">${Math.round(height)}</text>
    </svg>`;

    return svg;
  };

  const downloadSVG = () => {
    if (!currentLayout) return;

    const svgContent = generatePreviewSVG(currentLayout, selectedSide, true); // Include labels for download
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const getSideLabel = (s: string) => {
      switch (s) {
        case 'left': return 'motorista';
        case 'right': return 'sapo';
        case 'back': return 'traseira';
        default: return s;
      }
    };

    const taskPrefix = taskName ? `${taskName}-` : '';
    const sections = currentLayout.layoutSections || currentLayout.sections;
    const totalWidth = sections.reduce((sum: number, s: any) => sum + s.width * 100, 0);
    link.download = `${taskPrefix}layout-${getSideLabel(selectedSide)}-${Math.round(totalWidth)}mm.svg`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Side selector and download */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={selectedSide === 'left' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedSide('left')}
            disabled={!layouts.leftSideLayout}
          >
            Motorista
          </Button>
          <Button
            type="button"
            variant={selectedSide === 'right' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedSide('right')}
            disabled={!layouts.rightSideLayout}
          >
            Sapo
          </Button>
          <Button
            type="button"
            variant={selectedSide === 'back' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedSide('back')}
            disabled={!layouts.backSideLayout}
          >
            Traseira
          </Button>
        </div>

        <Button onClick={downloadSVG} size="sm" variant="default">
          <IconDownload className="h-4 w-4 mr-1" />
          Baixar SVG
        </Button>
      </div>

      {/* SVG Preview */}
      {currentLayout && (
        <div className="border rounded-lg bg-white/50 backdrop-blur-sm">
          <div className="p-8 flex items-center justify-center min-h-[300px]">
            <div
              dangerouslySetInnerHTML={{
                __html: generatePreviewSVG(currentLayout, selectedSide, false) // No labels for display
              }}
              className="w-full max-w-full overflow-auto [&>svg]:mx-auto [&>svg]:block [&>svg]:w-auto [&>svg]:h-auto [&>svg]:max-w-full [&>svg]:max-h-[400px]"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export const TaskDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { update } = useTaskMutations();
  const { update: updateServiceOrder } = useServiceOrderMutations();
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusChangeDialogOpen, setStatusChangeDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TASK_STATUS | null>(null);
  const [serviceOrderCompletionDialogOpen, setServiceOrderCompletionDialogOpen] = useState(false);
  const [pendingServiceOrder, setPendingServiceOrder] = useState<any>(null);
  const [nextServiceOrderToStart, setNextServiceOrderToStart] = useState<any>(null);
  const [filePreviewModalOpen, setFilePreviewModalOpen] = useState(false);
  const [filePreviewInitialIndex, setFilePreviewInitialIndex] = useState(0);
  const [artworksViewMode, setArtworksViewMode] = useState<FileViewMode>("list");
  const [documentsViewMode, setDocumentsViewMode] = useState<FileViewMode>("list");

  // Try to get file viewer context (optional)
  let fileViewerContext: ReturnType<typeof useFileViewer> | null = null;
  try {
    fileViewerContext = useFileViewer();
  } catch {
    // Context not available
  }

  const handlePreview = (file: any) => {
    if (fileViewerContext) {
      fileViewerContext.actions.viewFile(file);
    }
  };

  const handleDownload = (file: any) => {
    if (fileViewerContext) {
      fileViewerContext.actions.downloadFile(file);
    }
  };

  // Fetch task details with all relations
  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useTaskDetail(id!, {
    enabled: !!id,
    include: {
      sector: true,
      customer: true,
      createdBy: true,
      services: true,
      artworks: true,
      budget: true,
      budgets: true,
      invoices: true,
      receipts: true,
      observation: {
        include: {
          files: true,
        },
      },
      airbrushing: {
        include: {
          receipts: true,
          invoices: true,
          artworks: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      generalPainting: {
        include: {
          paintType: true,
          paintGrounds: {
            include: {
              groundPaint: true,
            },
          },
        },
      },
      logoPaints: true,
      truck: true,
    },
  });

  const task = response?.data;

  // Fetch cuts related to this task
  const { data: cutsResponse } = useCutsByTask(
    {
      taskId: id!,
      filters: {
        include: {
          file: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    {
      enabled: !!id,
    },
  );

  const cuts = cutsResponse?.data || [];

  // Get airbrushings directly from task (they're included in the task query)
  const airbrushings = task?.airbrushing || [];

  // Fetch layouts for truck dimensions
  const { data: layouts } = useLayoutsByTruck(task?.truck?.id || '', {
    enabled: !!task?.truck?.id,
  });

  // Calculate truck dimensions from any available layout
  const truckDimensions = useMemo(() => {
    if (!layouts) return null;

    const layout = layouts.leftSideLayout || layouts.rightSideLayout || layouts.backSideLayout;
    if (!layout) return null;

    const height = Math.round(layout.height * 100); // Convert to cm and round
    const sections = layout.layoutSections || layout.sections;
    const totalWidth = Math.round(sections.reduce((sum: number, s: any) => sum + s.width * 100, 0));

    return { width: totalWidth, height };
  }, [layouts]);

  // Filter service orders to show only PENDING, IN_PROGRESS, and COMPLETED
  const filteredServiceOrders = useMemo(() => {
    if (!task?.services) return [];
    return task.services
      .filter(
        (service) => service.status === SERVICE_ORDER_STATUS.PENDING || service.status === SERVICE_ORDER_STATUS.IN_PROGRESS || service.status === SERVICE_ORDER_STATUS.COMPLETED,
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [task?.services]);

  // Determine if we came from history, on-hold, or schedule
  const isFromHistory = location.pathname.includes('/historico/');
  const isFromOnHold = location.pathname.includes('/em-espera/');

  // Track page access
  usePageTracker({
    title: task ? `Tarefa: ${task.name}` : "Detalhes da Tarefa",
    icon: isFromHistory ? "history" : isFromOnHold ? "player-pause" : "clipboard-list",
  });

  // Status change handlers
  const handleStatusChange = (newStatus: TASK_STATUS) => {
    if (!task) return;

    // Validate transition
    if (!isValidTaskStatusTransition(task.status, newStatus)) {
      return;
    }

    setPendingStatus(newStatus);
    setStatusChangeDialogOpen(true);
  };

  const confirmStatusChange = async () => {
    if (!task || !pendingStatus) return;

    setIsUpdating(true);
    try {
      const updateData: any = { id: task.id, data: { status: pendingStatus } };

      // Add required dates based on status
      if (pendingStatus === TASK_STATUS.IN_PRODUCTION && !task.startedAt) {
        updateData.data.startedAt = new Date();
      }
      if (pendingStatus === TASK_STATUS.COMPLETED && !task.finishedAt) {
        updateData.data.finishedAt = new Date();
      }

      await update(updateData);
      setStatusChangeDialogOpen(false);
    } catch (error) {
      console.error("Error updating task status:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle service order status change
  const handleServiceOrderStatusChange = async (serviceOrderId: string, newStatus: SERVICE_ORDER_STATUS) => {
    const serviceOrder = task?.services?.find((s) => s.id === serviceOrderId);
    if (!serviceOrder) return;

    try {
      const updateData: any = { status: newStatus };

      // Add dates based on status
      if (newStatus === SERVICE_ORDER_STATUS.IN_PROGRESS && !serviceOrder.startedAt) {
        updateData.startedAt = new Date();
      }
      if (newStatus === SERVICE_ORDER_STATUS.COMPLETED && !serviceOrder.finishedAt) {
        updateData.finishedAt = new Date();
      }

      await updateServiceOrder({ id: serviceOrderId, data: updateData });

      // If completing a service order, check if there's a next one to start
      if (newStatus === SERVICE_ORDER_STATUS.COMPLETED) {
        const allServiceOrders = task?.services?.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const currentIndex = allServiceOrders?.findIndex((s) => s.id === serviceOrderId) ?? -1;
        const nextServiceOrder = allServiceOrders?.[currentIndex + 1];

        if (nextServiceOrder && nextServiceOrder.status === SERVICE_ORDER_STATUS.PENDING) {
          setPendingServiceOrder(serviceOrder);
          setNextServiceOrderToStart(nextServiceOrder);
          setServiceOrderCompletionDialogOpen(true);
        }
      }
    } catch (error) {
      console.error("Error updating service order status:", error);
    }
  };

  // Confirm starting next service order
  const confirmStartNextServiceOrder = async () => {
    if (!nextServiceOrderToStart) return;

    try {
      await updateServiceOrder({
        id: nextServiceOrderToStart.id,
        data: {
          status: SERVICE_ORDER_STATUS.IN_PROGRESS,
          startedAt: new Date(),
        },
      });

      setServiceOrderCompletionDialogOpen(false);
      setPendingServiceOrder(null);
      setNextServiceOrderToStart(null);
    } catch (error) {
      console.error("Error starting next service order:", error);
    }
  };

  // Decline starting next service order
  const declineStartNextServiceOrder = () => {
    setServiceOrderCompletionDialogOpen(false);
    setPendingServiceOrder(null);
    setNextServiceOrderToStart(null);
  };

  // Handle budget PDF download
  const handleDownloadBudgetPDF = () => {
    if (!task || !task.budget) return;
    generateBudgetPDF({ task });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full space-y-6">
        <Skeleton className="h-24 w-full rounded-lg" />
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-96 rounded-lg" />
              <Skeleton className="h-96 rounded-lg" />
              <Skeleton className="h-64 rounded-lg" />
              <Skeleton className="h-64 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error or not found state
  if (error || !task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in-50 duration-500">
        <div className="text-center px-4 max-w-md mx-auto space-y-4">
          <div className="inline-flex p-4 bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
            <IconAlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-semibold">Tarefa não encontrada</h2>
          <p className="text-muted-foreground">A tarefa que você está procurando não existe ou foi removida.</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => navigate(routes.production.schedule.list)} variant="outline">
              <IconClipboardList className="h-4 w-4 mr-2" />
              Voltar para lista
            </Button>
            <Button onClick={() => navigate(routes.production.root)}>
              <IconHome className="h-4 w-4 mr-2" />
              Ir para produção
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isOverdue = task.term && new Date(task.term) < new Date() && task.status !== TASK_STATUS.COMPLETED && task.status !== TASK_STATUS.CANCELLED;

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.PRODUCTION}>
      <div className="flex flex-col h-full space-y-6">
        <div className="animate-in fade-in-50 duration-500">
          <PageHeader
            variant="detail"
            title={task.name}
            icon={isFromHistory ? IconHistory : isFromOnHold ? IconPlayerPause : IconClipboardList}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Produção", href: routes.production.root },
              {
                label: isFromHistory ? "Histórico" : isFromOnHold ? "Em Espera" : "Cronograma",
                href: isFromHistory ? routes.production.history.root : isFromOnHold ? routes.production.scheduleOnHold.root : routes.production.schedule.list
              },
              { label: task.name },
            ]}
            actions={[
              {
                key: "refresh",
                label: "Atualizar",
                icon: IconRefresh,
                onClick: () => refetch(),
              },
              ...(task.status === TASK_STATUS.PENDING
                ? [
                    {
                      key: "start",
                      label: "Iniciar Produção",
                      icon: IconPlayerPlay,
                      onClick: () => handleStatusChange(TASK_STATUS.IN_PRODUCTION),
                      variant: "default" as const,
                    },
                  ]
                : []),
              ...(task.status === TASK_STATUS.IN_PRODUCTION
                ? [
                    {
                      key: "complete",
                      label: "Finalizar",
                      icon: IconCheck,
                      onClick: () => handleStatusChange(TASK_STATUS.COMPLETED),
                      variant: "default" as const,
                    },
                  ]
                : []),
              ...(task.status === TASK_STATUS.ON_HOLD
                ? [
                    {
                      key: "resume",
                      label: "Retomar Produção",
                      icon: IconPlayerPlay,
                      onClick: () => handleStatusChange(TASK_STATUS.IN_PRODUCTION),
                      variant: "default" as const,
                    },
                  ]
                : []),
              {
                key: "edit",
                label: "Editar",
                icon: IconEdit,
                onClick: () => navigate(routes.production.schedule.edit(task.id)),
              },
            ]}
          />
        </div>

        {/* Main Content Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Overview Card */}
              <Card className="border flex flex-col animate-in fade-in-50 duration-700" level={1}>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg font-medium">
                      <IconClipboardList className="h-5 w-5 text-muted-foreground" />
                      Informações Gerais
                    </CardTitle>
                    <Badge variant={getBadgeVariantFromStatus(task.status, "task")}>{TASK_STATUS_LABELS[task.status] || task.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      {/* Customer */}
                      {task.customer && (
                        <div className="flex items-start gap-3">
                          <IconBuilding className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-muted-foreground">Cliente</p>
                            <p className="text-sm font-semibold">{task.customer.fantasyName}</p>
                          </div>
                        </div>
                      )}

                      {/* Sector */}
                      {task.sector && (
                        <div className="flex items-start gap-3">
                          <IconBuildingFactory className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-muted-foreground">Setor</p>
                            <p className="text-sm font-semibold">{task.sector.name}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      {/* Serial Number */}
                      {task.serialNumber && (
                        <div className="flex items-start gap-3">
                          <IconHash className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-muted-foreground">Número de Série</p>
                            <p className="text-sm font-semibold font-mono">{task.serialNumber}</p>
                          </div>
                        </div>
                      )}

                      {/* Plate */}
                      {task.plate && (
                        <div className="flex items-start gap-3">
                          <IconCar className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-muted-foreground">Placa</p>
                            <p className="text-sm font-semibold font-mono uppercase">{task.plate}</p>
                          </div>
                        </div>
                      )}

                      {/* Chassis Number */}
                      {task.chassisNumber && (
                        <div className="flex items-start gap-3">
                          <IconBarcode className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-muted-foreground">Nº Chassi</p>
                            <p className="text-sm font-semibold font-mono">{task.chassisNumber}</p>
                          </div>
                        </div>
                      )}

                      {/* Truck */}
                      {task.truck && truckDimensions && (
                        <div className="flex items-start gap-3">
                          <IconTruck className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-muted-foreground">Caminhão</p>
                            <p className="text-sm font-semibold">
                              {truckDimensions.width}cm × {truckDimensions.height}cm
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  {task.details && (
                    <>
                      <Separator className="my-6" />
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <IconFileText className="h-5 w-5 text-muted-foreground" />
                          <h3 className="text-sm font-semibold">Detalhes</h3>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 rounded-lg p-4">{task.details}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Dates Card */}
              <Card className="border flex flex-col animate-in fade-in-50 duration-800" level={1}>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg font-medium">
                    <IconCalendar className="h-5 w-5 text-muted-foreground" />
                    Datas
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 flex-1 space-y-4">
                  {task.entryDate && (
                    <div className="flex items-start gap-3">
                      <IconCalendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground">Entrada</p>
                        <p className="text-sm font-semibold">{formatDate(task.entryDate)}</p>
                      </div>
                    </div>
                  )}

                  {task.term && (
                    <div className="flex items-start gap-3">
                      <IconCalendar className={cn("h-5 w-5 mt-0.5", isOverdue ? "text-destructive" : "text-muted-foreground")} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground">Prazo</p>
                        <p className={cn("text-sm font-semibold", isOverdue && "text-destructive")}>
                          {formatDate(task.term)}
                          {isOverdue && " (Atrasado)"}
                        </p>
                      </div>
                    </div>
                  )}

                  {task.startedAt && (
                    <div className="flex items-start gap-3">
                      <IconClock className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground">Iniciado</p>
                        <p className="text-sm font-semibold">{formatDateTime(task.startedAt)}</p>
                      </div>
                    </div>
                  )}

                  {task.finishedAt && (
                    <div className="flex items-start gap-3">
                      <IconCheck className="h-5 w-5 text-green-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground">Finalizado</p>
                        <p className="text-sm font-semibold">{formatDateTime(task.finishedAt)}</p>
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="flex items-start gap-3">
                    <IconClock className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Criado</p>
                      <p className="text-sm font-semibold">{formatDateTime(task.createdAt)}</p>
                      {task.createdBy && <p className="text-xs text-muted-foreground">por {task.createdBy.name}</p>}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <IconClock className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Atualizado</p>
                      <p className="text-sm font-semibold">{formatDateTime(task.updatedAt)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Budget Card */}
              {task.budget && task.budget.length > 0 && (
                <Card className="border flex flex-col animate-in fade-in-50 duration-825" level={1}>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-lg font-medium">
                        <IconFileInvoice className="h-5 w-5 text-muted-foreground" />
                        Orçamento Detalhado
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadBudgetPDF}
                        className="gap-2"
                      >
                        <IconDownload className="h-4 w-4" />
                        Baixar PDF
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1">
                    <div className="space-y-4">
                      {/* Budget items table */}
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                                Referência
                              </th>
                              <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground w-32">
                                Valor
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {task.budget.map((item, index) => (
                              <tr key={item.id || index} className="hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3 text-sm">{item.referencia}</td>
                                <td className="px-4 py-3 text-sm text-right font-medium">
                                  {formatCurrency(item.valor)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Total row */}
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-base font-bold text-foreground">TOTAL</span>
                          <span className="text-lg font-bold text-primary">
                            {formatCurrency(
                              task.budget.reduce((sum, item) => sum + item.valor, 0)
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Truck Layout Card */}
              {task.truck && (
                <Card className="border flex flex-col animate-in fade-in-50 duration-850" level={1}>
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg font-medium">
                      <IconLayoutGrid className="h-5 w-5 text-muted-foreground" />
                      Layout do Caminhão
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <TruckLayoutPreview truckId={task.truck.id} taskName={task.name} />
                  </CardContent>
                </Card>
              )}

              {/* Service Orders Card */}
              {filteredServiceOrders.length > 0 && (
                <Card className="border flex flex-col animate-in fade-in-50 duration-900" level={1}>
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg font-medium">
                      <IconClipboardList className="h-5 w-5 text-muted-foreground" />
                      Ordens de Serviço
                      <Badge variant="secondary" className="ml-auto">
                        {filteredServiceOrders.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1">
                    <div className="space-y-3">
                      {filteredServiceOrders.map((serviceOrder) => (
                        <div key={serviceOrder.id} className="bg-muted/50 rounded-lg p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold">{serviceOrder.description}</h4>
                              </div>

                              {(serviceOrder.startedAt || serviceOrder.finishedAt) && (
                                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                  {serviceOrder.startedAt && (
                                    <div className="flex items-center gap-1">
                                      <IconClock className="h-3 w-3" />
                                      <span>Iniciado: {formatDateTime(serviceOrder.startedAt)}</span>
                                    </div>
                                  )}
                                  {serviceOrder.finishedAt && (
                                    <div className="flex items-center gap-1">
                                      <IconCheck className="h-3 w-3 text-green-600" />
                                      <span>Finalizado: {formatDateTime(serviceOrder.finishedAt)}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Status Change Dropdown */}
                            <div className="flex items-center">
                              <Combobox
                                value={serviceOrder.status || undefined}
                                onValueChange={(newStatus) => handleServiceOrderStatusChange(serviceOrder.id, newStatus as SERVICE_ORDER_STATUS)}
                                options={[
                                  { value: SERVICE_ORDER_STATUS.PENDING, label: SERVICE_ORDER_STATUS_LABELS[SERVICE_ORDER_STATUS.PENDING] },
                                  { value: SERVICE_ORDER_STATUS.IN_PROGRESS, label: SERVICE_ORDER_STATUS_LABELS[SERVICE_ORDER_STATUS.IN_PROGRESS] },
                                  { value: SERVICE_ORDER_STATUS.COMPLETED, label: SERVICE_ORDER_STATUS_LABELS[SERVICE_ORDER_STATUS.COMPLETED] },
                                  { value: SERVICE_ORDER_STATUS.CANCELLED, label: SERVICE_ORDER_STATUS_LABELS[SERVICE_ORDER_STATUS.CANCELLED] },
                                ]}
                                placeholder="Selecione o status"
                                searchable={false}
                                className="w-40"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Cuts Card - Compact Version */}
              {cuts.length > 0 && (
                <Card className="border flex flex-col animate-in fade-in-50 duration-950 lg:col-span-1" level={1}>
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg font-medium">
                      <IconCut className="h-5 w-5 text-muted-foreground" />
                      Recortes
                      <Badge variant="secondary" className="ml-auto">
                        {cuts.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1">
                    <div className="space-y-3">
                      {cuts.map((cut) => (
                        <div
                          key={cut.id}
                          className="border rounded-lg p-3 cursor-pointer hover:bg-muted/30 transition-colors flex items-center gap-3"
                          onClick={() => navigate(routes.production.cutting.details(cut.id))}
                        >
                          {/* Cut Info */}
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <h4 className="text-sm font-semibold truncate min-w-0 flex-1">{cut.file?.filename || "Arquivo de recorte"}</h4>
                              <Badge variant={ENTITY_BADGE_CONFIG.CUT[cut.status] || "default"} className="text-xs flex-shrink-0">
                                {CUT_STATUS_LABELS[cut.status]}
                              </Badge>
                            </div>

                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Tipo:</span>
                                <span>{CUT_TYPE_LABELS[cut.type]}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Origem:</span>
                                <span>{CUT_ORIGIN_LABELS[cut.origin]}</span>
                              </div>
                            </div>
                          </div>

                          {/* Squared File Preview on Right */}
                          {cut.file && (
                            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                              <FileItem
                                file={cut.file}
                                viewMode="list"
                                onPreview={handlePreview}
                                onDownload={handleDownload}
                                showActions
                                className="w-20 h-20"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Artworks Card - 1/2 width */}
              {task.artworks && task.artworks.length > 0 && (
                <Card className="border flex flex-col animate-in fade-in-50 duration-1000 lg:col-span-1" level={1}>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-lg font-medium">
                        <IconFiles className="h-5 w-5 text-muted-foreground" />
                        Artes
                        <Badge variant="secondary" className="ml-2">
                          {task.artworks?.length ?? 0}
                        </Badge>
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {(task.artworks?.length ?? 0) > 1 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const apiUrl = (window as any).__ANKAA_API_URL__ || (import.meta as any).env?.VITE_API_URL || "http://localhost:3030";
                              for (let i = 0; i < (task.artworks?.length ?? 0); i++) {
                                const file = task.artworks?.[i];
                                if (file) {
                                  const downloadUrl = `${apiUrl}/files/${file.id}/download`;
                                  window.open(downloadUrl, "_blank");
                                }
                                if (i < (task.artworks?.length ?? 0) - 1) {
                                  await new Promise((resolve) => setTimeout(resolve, 200));
                                }
                              }
                            }}
                            className="text-xs"
                          >
                            <IconDownload className="h-3 w-3 mr-1" />
                            Baixar Todos
                          </Button>
                        )}
                        <div className="flex gap-1">
                          <Button
                            variant={artworksViewMode === "list" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setArtworksViewMode("list")}
                            className="h-7 w-7 p-0"
                          >
                            <IconList className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant={artworksViewMode === "grid" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setArtworksViewMode("grid")}
                            className="h-7 w-7 p-0"
                          >
                            <IconLayoutGrid className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1">
                    <div className={cn(artworksViewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
                      {task.artworks?.map((file) => (
                        <FileItem
                          key={file.id}
                          file={file}
                          viewMode={artworksViewMode}
                          onPreview={handlePreview}
                          onDownload={handleDownload}
                          showActions
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Documents Card - Budget, NFE, Receipt */}
              {((task.budgets && task.budgets.length > 0) || (task.invoices && task.invoices.length > 0) || (task.receipts && task.receipts.length > 0)) && (
                <Card className="border flex flex-col animate-in fade-in-50 duration-1050" level={1}>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-lg font-medium">
                        <IconFileText className="h-5 w-5 text-muted-foreground" />
                        Documentos
                        <Badge variant="secondary" className="ml-2">
                          {[...(task.budgets || []), ...(task.invoices || []), ...(task.receipts || [])].length}
                        </Badge>
                      </CardTitle>
                      <div className="flex gap-1">
                        <Button
                          variant={documentsViewMode === "list" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setDocumentsViewMode("list")}
                          className="h-7 w-7 p-0"
                        >
                          <IconList className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant={documentsViewMode === "grid" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setDocumentsViewMode("grid")}
                          className="h-7 w-7 p-0"
                        >
                          <IconLayoutGrid className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1">
                    <div className="space-y-6">
                      {task.budgets && task.budgets.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <IconCurrencyReal className="h-4 w-4 text-muted-foreground" />
                            <h4 className="text-sm font-semibold">Orçamentos</h4>
                          </div>
                          <div className={cn(documentsViewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
                            {task.budgets.map((budget: any) => (
                              <FileItem
                                key={budget.id}
                                file={budget}
                                viewMode={documentsViewMode}
                                onPreview={handlePreview}
                                onDownload={handleDownload}
                                showActions
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {task.invoices && task.invoices.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <IconFileText className="h-4 w-4 text-muted-foreground" />
                            <h4 className="text-sm font-semibold">Notas Fiscais</h4>
                          </div>
                          <div className={cn(documentsViewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
                            {task.invoices.map((nfe: any) => (
                              <FileItem
                                key={nfe.id}
                                file={nfe}
                                viewMode={documentsViewMode}
                                onPreview={handlePreview}
                                onDownload={handleDownload}
                                showActions
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {task.receipts && task.receipts.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <IconFile className="h-4 w-4 text-muted-foreground" />
                            <h4 className="text-sm font-semibold">Recibos</h4>
                          </div>
                          <div className={cn(documentsViewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
                            {task.receipts.map((receipt: any) => (
                              <FileItem
                                key={receipt.id}
                                file={receipt}
                                viewMode={documentsViewMode}
                                onPreview={handlePreview}
                                onDownload={handleDownload}
                                showActions
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}


              {/* Paints Card - Show only if task has general painting or logo paints */}
              {(task.generalPainting || (task.logoPaints && task.logoPaints.length > 0)) && (
                <Card className="border flex flex-col animate-in fade-in-50 duration-1150" level={1}>
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg font-medium">
                      <IconPaint className="h-5 w-5 text-muted-foreground" />
                      Tintas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1">
                    <div className="space-y-6">
                      {task.generalPainting && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <IconBrush className="h-4 w-4 text-muted-foreground" />
                            <h4 className="text-sm font-semibold">Pintura</h4>
                          </div>
                          <div
                            className="bg-muted/50 rounded-lg p-4 cursor-pointer hover:bg-muted/70 transition-colors"
                            onClick={() => task.generalPainting?.id && navigate(routes.painting.catalog.details(task.generalPainting.id))}
                          >
                            {/* Paint info with small preview */}
                            <div className="flex items-start gap-4">
                              {/* Small color preview - 80px */}
                              <div className="relative flex-shrink-0">
                                <div className="w-20 h-20 rounded-lg overflow-hidden shadow-inner border border-muted">
                                  <CanvasNormalMapRenderer
                                    baseColor={task.generalPainting?.hex || "#888888"}
                                    finish={(task.generalPainting?.finish as PAINT_FINISH) || PAINT_FINISH.SOLID}
                                    width={80}
                                    height={80}
                                    quality="medium"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              </div>

                              {/* Paint information */}
                              <div className="flex-1 space-y-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-base">{task.generalPainting?.name}</h3>
                                    <span className="text-xs font-mono text-muted-foreground">{task.generalPainting?.hex}</span>
                                  </div>
                                  {task.generalPainting?.paintType && <p className="text-sm text-muted-foreground">{task.generalPainting?.paintType.name}</p>}
                                </div>

                                {/* Badges */}
                                <div className="flex flex-wrap gap-1">
                                  {task.generalPainting?.finish && (
                                    <Badge variant="secondary" className="text-xs">
                                      <IconSparkles className="h-3 w-3 mr-1" />
                                      {PAINT_FINISH_LABELS[task.generalPainting?.finish]}
                                    </Badge>
                                  )}
                                  {task.generalPainting?.paintBrand?.name && (
                                    <Badge variant="outline" className="text-xs">
                                      {task.generalPainting?.paintBrand?.name}
                                    </Badge>
                                  )}
                                  {task.generalPainting?.manufacturer && (
                                    <Badge variant="outline" className="text-xs">
                                      <IconTruckLoading className="h-3 w-3 mr-1" />
                                      {TRUCK_MANUFACTURER_LABELS[task.generalPainting?.manufacturer]}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Additional details - Ground/Primer if paint type requires it */}
                          {task.generalPainting?.paintType?.needGround && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 mt-3">
                              <div className="flex items-center gap-2">
                                <IconAlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                <span className="text-sm font-medium text-yellow-900 dark:text-yellow-200">Esta tinta requer aplicação de primer</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Logo Paints - Only show if there are logo paints */}
                      {task.logoPaints && task.logoPaints.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <IconPaint className="h-4 w-4 text-muted-foreground" />
                            <h4 className="text-sm font-semibold">Tintas do Logo</h4>
                            <Badge variant="secondary" className="text-xs">
                              {task.logoPaints.length} cores
                            </Badge>
                          </div>

                          <div className="space-y-3">
                            {task.logoPaints.map((paint) => (
                              <div
                                key={paint.id}
                                className="bg-muted/50 rounded-lg p-4 cursor-pointer hover:bg-muted/70 transition-colors"
                                onClick={() => navigate(routes.painting.catalog.details(paint.id))}
                              >
                                <div className="flex items-start gap-4">
                                  {/* Small color preview - 40px for logo paints */}
                                  <div className="relative flex-shrink-0">
                                    <div className="w-10 h-10 rounded-md overflow-hidden shadow-inner border border-muted">
                                      <CanvasNormalMapRenderer
                                        baseColor={paint.hex || "#888888"}
                                        finish={(paint.finish as PAINT_FINISH) || PAINT_FINISH.SOLID}
                                        width={40}
                                        height={40}
                                        quality="medium"
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  </div>

                                  {/* Paint information */}
                                  <div className="flex-1 space-y-3">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-base">{paint.name}</h3>
                                        <span className="text-xs font-mono text-muted-foreground">{paint.hex}</span>
                                      </div>
                                      {paint.paintType && <p className="text-sm text-muted-foreground">{paint.paintType.name}</p>}
                                    </div>

                                    {/* Badges */}
                                    <div className="flex flex-wrap gap-1">
                                      {paint.finish && (
                                        <Badge variant="secondary" className="text-xs">
                                          <IconSparkles className="h-3 w-3 mr-1" />
                                          {PAINT_FINISH_LABELS[paint.finish]}
                                        </Badge>
                                      )}
                                      {paint.paintBrand?.name && (
                                        <Badge variant="outline" className="text-xs">
                                          {paint.paintBrand?.name}
                                        </Badge>
                                      )}
                                      {paint.manufacturer && (
                                        <Badge variant="outline" className="text-xs">
                                          <IconTruckLoading className="h-3 w-3 mr-1" />
                                          {TRUCK_MANUFACTURER_LABELS[paint.manufacturer]}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Observation Card */}
              {task.observation && (
                <Card className="border flex flex-col animate-in fade-in-50 duration-1200" level={1}>
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg font-medium">
                      <IconAlertCircle className="h-5 w-5 text-yellow-500" />
                      Observação
                      {task.observation.files && task.observation.files.length > 0 && (
                        <Badge variant="secondary" className="ml-auto">
                          {task.observation.files.length} arquivo{task.observation.files.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1 space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                        {task.observation.description}
                      </p>
                    </div>

                    {task.observation.files && task.observation.files.length > 0 && (
                      <div className="pt-4 border-t">
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <IconFiles className="h-4 w-4" />
                          Arquivos Anexados
                        </h4>
                        <div className="flex flex-wrap gap-3">
                          {task.observation.files.map((file: any, index: number) => (
                            <FileItem
                              key={file.id}
                              file={file}
                              viewMode="grid"
                              onPreview={(f) => {
                                setFilePreviewInitialIndex(index);
                                setFilePreviewModalOpen(true);
                              }}
                              onDownload={handleDownload}
                              showActions
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Airbrushings Card - Only show if task has airbrushings */}
              {airbrushings.length > 0 && (
                <Card className="border flex flex-col animate-in fade-in-50 duration-1250" level={1}>
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg font-medium">
                      <IconSpray className="h-5 w-5 text-blue-500" />
                      Aerografias
                      <Badge variant="secondary" className="ml-auto">
                        {airbrushings.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1">
                    <div className="space-y-3">
                      {airbrushings.map((airbrushing) => (
                        <div key={airbrushing.id} className="bg-muted/50 rounded-lg p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge variant={ENTITY_BADGE_CONFIG.AIRBRUSHING[airbrushing.status] || "default"} className="text-xs">
                                  {AIRBRUSHING_STATUS_LABELS[airbrushing.status]}
                                </Badge>
                                {airbrushing.price && <span className="text-sm font-semibold text-primary">{formatCurrency(airbrushing.price)}</span>}
                              </div>

                              {(airbrushing.startDate || airbrushing.finishDate) && (
                                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                  {airbrushing.startDate && (
                                    <div className="flex items-center gap-1">
                                      <IconClock className="h-3 w-3" />
                                      <span>Iniciado: {formatDateTime(airbrushing.startDate)}</span>
                                    </div>
                                  )}
                                  {airbrushing.finishDate && (
                                    <div className="flex items-center gap-1">
                                      <IconCheck className="h-3 w-3 text-green-600" />
                                      <span>Finalizado: {formatDateTime(airbrushing.finishDate)}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Files count */}
                              {((airbrushing.receipts?.length ?? 0) > 0 || (airbrushing.invoices?.length ?? 0) > 0 || (airbrushing.artworks?.length ?? 0) > 0) && (
                                <div className="flex gap-2 text-xs text-muted-foreground">
                                  {(airbrushing.receipts?.length ?? 0) > 0 && (
                                    <div className="flex items-center gap-1">
                                      <IconFile className="h-3 w-3" />
                                      <span>{airbrushing.receipts?.length ?? 0} recibo(s)</span>
                                    </div>
                                  )}
                                  {(airbrushing.invoices?.length ?? 0) > 0 && (
                                    <div className="flex items-center gap-1">
                                      <IconFileText className="h-3 w-3" />
                                      <span>{airbrushing.invoices?.length ?? 0} NFe(s)</span>
                                    </div>
                                  )}
                                  {(airbrushing.artworks?.length ?? 0) > 0 && (
                                    <div className="flex items-center gap-1">
                                      <IconFiles className="h-3 w-3" />
                                      <span>{airbrushing.artworks?.length ?? 0} arte(s)</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Changelog History */}
              <Card className="border flex flex-col animate-in fade-in-50 duration-1300" level={1}>
                <ChangelogHistory entityType={CHANGE_LOG_ENTITY_TYPE.TASK} entityId={task.id} entityName={task.name} entityCreatedAt={task.createdAt} className="h-full" />
              </Card>
            </div>
          </div>
        </div>

        {/* Status Change Dialog */}
        <AlertDialog open={statusChangeDialogOpen} onOpenChange={setStatusChangeDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar mudança de status</AlertDialogTitle>
              <AlertDialogDescription>
                Você está prestes a mudar o status da tarefa para <span className="font-semibold">{pendingStatus && (TASK_STATUS_LABELS[pendingStatus] || pendingStatus)}</span>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {pendingStatus && (
              <div className="rounded-lg bg-muted p-4 my-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tarefa:</span>
                    <span className="font-medium">{task.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status atual:</span>
                    <span className="font-medium">{TASK_STATUS_LABELS[task.status] || task.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Novo status:</span>
                    <span className="font-medium">{TASK_STATUS_LABELS[pendingStatus] || pendingStatus}</span>
                  </div>
                </div>
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isUpdating}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmStatusChange} disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <LoadingSpinner className="mr-2 h-4 w-4" />
                    Processando...
                  </>
                ) : (
                  "Confirmar"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Service Order Completion Dialog */}
        <AlertDialog open={serviceOrderCompletionDialogOpen} onOpenChange={setServiceOrderCompletionDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ordem de Serviço Finalizada</AlertDialogTitle>
              <AlertDialogDescription>
                A ordem de serviço "{pendingServiceOrder?.description}" foi finalizada com sucesso!
                {nextServiceOrderToStart && (
                  <>
                    <br />
                    <br />
                    Deseja iniciar a próxima ordem de serviço: "{nextServiceOrderToStart.description}"?
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={declineStartNextServiceOrder}>{nextServiceOrderToStart ? "Não, manter pendente" : "OK"}</AlertDialogCancel>
              {nextServiceOrderToStart && <AlertDialogAction onClick={confirmStartNextServiceOrder}>Sim, iniciar próxima</AlertDialogAction>}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* File Preview Modal for Observation Files */}
        {task?.observation?.files && task.observation.files.length > 0 && (
          <FilePreviewModal
            files={task.observation.files}
            initialFileIndex={filePreviewInitialIndex}
            open={filePreviewModalOpen}
            onOpenChange={setFilePreviewModalOpen}
          />
        )}
      </div>
    </PrivilegeRoute>
  );
};

export default TaskDetailsPage;
