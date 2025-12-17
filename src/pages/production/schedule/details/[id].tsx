import { useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useTaskDetail, useTaskMutations, useServiceOrderMutations, useCutsByTask, useLayoutsByTruck, useCurrentUser, useAirbrushingsByTask } from "../../../../hooks";
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
  COMMISSION_STATUS_LABELS,
} from "../../../../constants";
import { formatDate, formatDateTime, formatCurrency, formatChassis, formatTruckSpot, isValidTaskStatusTransition, hasPrivilege } from "../../../../utils";
import { isTeamLeader } from "@/utils/user";
import { canEditTasks } from "@/utils/permissions/entity-permissions";
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
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import {
  IconClipboardList,
  IconEdit,
  IconPlayerPlay,
  IconCheck,
  IconClock,
  IconCalendar,
  IconCalendarPlus,
  IconCalendarEvent,
  IconCalendarStats,
  IconCalendarCheck,
  IconCalendarWeek,
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
  IconDroplet,
  IconCut,
  IconSpray,
  IconDownload,
  IconLayoutGrid,
  IconHistory,
  IconPlayerPause,
  IconBarcode,
  IconList,
  IconCoin,
  IconMapPin,
  IconLayersIntersect,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { CanvasNormalMapRenderer } from "@/components/painting/effects/canvas-normal-map-renderer";

// Paint badge style - unified neutral, more subtle (no icons)
const PAINT_BADGE_STYLE = "bg-neutral-200/70 text-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-300 hover:bg-neutral-200/70 hover:text-neutral-600 dark:hover:bg-neutral-700/50 dark:hover:text-neutral-300 border-0";
import { FileItem, FilePreviewModal, useFileViewer, type FileViewMode } from "@/components/common/file";

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
    const sections = layout.layoutSections;
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
    } else if (layout.layoutSections) {
      // Handle LayoutSection entity format with doorHeight
      const sections = layout.layoutSections;
      let currentPos = 0;
      sections.forEach((section: any, index: number) => {
        const sectionWidth = section.width * 100;
        const sectionX = margin + currentPos;

        // Check if this section is a door
        // doorHeight is measured from bottom of layout to top of door opening
        if (section.isDoor && section.doorHeight !== null && section.doorHeight !== undefined) {
          const doorHeightCm = section.doorHeight * 100;
          const doorTopY = margin + (height - doorHeightCm);

          // Left vertical line of door
          svg += `
          <line x1="${sectionX}" y1="${doorTopY}" x2="${sectionX}" y2="${margin + height}"
                stroke="#000" stroke-width="1"/>`;

          // Right vertical line of door
          svg += `
          <line x1="${sectionX + sectionWidth}" y1="${doorTopY}" x2="${sectionX + sectionWidth}" y2="${margin + height}"
                stroke="#000" stroke-width="1"/>`;

          // Top horizontal line of door
          svg += `
          <line x1="${sectionX}" y1="${doorTopY}" x2="${sectionX + sectionWidth}" y2="${doorTopY}"
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
    const sections = currentLayout.layoutSections;
    const totalWidth = sections.reduce((sum: number, s: any) => sum + s.width * 100, 0);
    link.download = `${taskPrefix}layout-${getSideLabel(selectedSide)}-${Math.round(totalWidth)}mm.svg`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Side selector */}
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

      {/* Download buttons */}
      <div className="flex gap-2 justify-end">
        {/* Download all layouts as zip */}
        <Button
          onClick={async () => {
            const apiUrl = (window as any).__ANKAA_API_URL__ || (import.meta as any).env?.VITE_API_URL || "http://localhost:3030";
            const taskPrefix = taskName ? `${taskName}-` : '';
            const zipFileName = `${taskPrefix}layouts.zip`;

            const JSZip = (await import('jszip')).default;
            const zip = new JSZip();

            const getSideLabel = (s: string) => {
              switch (s) {
                case 'left': return 'motorista';
                case 'right': return 'sapo';
                case 'back': return 'traseira';
                default: return s;
              }
            };

            // Add left side layout SVG if exists
            if (layouts.leftSideLayout) {
              const svgContent = generatePreviewSVG(layouts.leftSideLayout, 'left', true);
              const sections = layouts.leftSideLayout.layoutSections;
              const totalWidth = sections.reduce((sum: number, s: any) => sum + s.width * 100, 0);
              zip.file(`${taskPrefix}layout-${getSideLabel('left')}-${Math.round(totalWidth)}mm.svg`, svgContent);
            }

            // Add right side layout SVG if exists
            if (layouts.rightSideLayout) {
              const svgContent = generatePreviewSVG(layouts.rightSideLayout, 'right', true);
              const sections = layouts.rightSideLayout.layoutSections;
              const totalWidth = sections.reduce((sum: number, s: any) => sum + s.width * 100, 0);
              zip.file(`${taskPrefix}layout-${getSideLabel('right')}-${Math.round(totalWidth)}mm.svg`, svgContent);
            }

            // Add back side layout SVG if exists
            if (layouts.backSideLayout) {
              const svgContent = generatePreviewSVG(layouts.backSideLayout, 'back', true);
              const sections = layouts.backSideLayout.layoutSections;
              const totalWidth = sections.reduce((sum: number, s: any) => sum + s.width * 100, 0);
              zip.file(`${taskPrefix}layout-${getSideLabel('back')}-${Math.round(totalWidth)}mm.svg`, svgContent);

              // Add backside photo if exists
              if (layouts.backSideLayout.photo) {
                try {
                  const photoUrl = `${apiUrl}/files/${layouts.backSideLayout.photo.id}/download`;
                  const response = await fetch(photoUrl);
                  if (response.ok) {
                    const blob = await response.blob();
                    const extension = layouts.backSideLayout.photo.mimeType?.split('/')[1] || 'jpg';
                    zip.file(`${taskPrefix}layout-traseira-foto.${extension}`, blob);
                  }
                } catch (error) {
                  console.error('Error downloading backside photo:', error);
                }
              }
            }

            // Generate zip and download
            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const link = document.createElement('a');
            link.href = url;
            link.download = zipFileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }}
          size="sm"
          variant="default"
        >
          <IconDownload className="h-4 w-4 mr-1" />
          Baixar Tudo
        </Button>

        <Button onClick={downloadSVG} size="sm" variant="outline">
          <IconDownload className="h-4 w-4 mr-1" />
          Baixar Layout
        </Button>

        {/* Layout photo download button */}
        {currentLayout?.photo && (
          <Button
            onClick={() => {
              const apiUrl = (window as any).__ANKAA_API_URL__ || (import.meta as any).env?.VITE_API_URL || "http://localhost:3030";
              const photoUrl = `${apiUrl}/files/${currentLayout.photo.id}/download`;
              window.open(photoUrl, '_blank');
            }}
            size="sm"
            variant="outline"
          >
            <IconDownload className="h-4 w-4 mr-1" />
            Baixar Foto
          </Button>
        )}
      </div>
    </div>
  );
};

export const TaskDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: currentUser } = useCurrentUser();
  const { update } = useTaskMutations();
  const { update: updateServiceOrder } = useServiceOrderMutations();
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusChangeDialogOpen, setStatusChangeDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TASK_STATUS | null>(null);
  const [serviceOrderCompletionDialogOpen, setServiceOrderCompletionDialogOpen] = useState(false);
  const [pendingServiceOrder, setPendingServiceOrder] = useState<any>(null);
  const [nextServiceOrderToStart, setNextServiceOrderToStart] = useState<any>(null);
  const [artworksViewMode, setArtworksViewMode] = useState<FileViewMode>("list");
  const [documentsViewMode, setDocumentsViewMode] = useState<FileViewMode>("list");

  // Check if user is from Financial sector
  const isFinancialSector = currentUser ? hasPrivilege(currentUser, SECTOR_PRIVILEGES.FINANCIAL) && currentUser.sector?.privileges === SECTOR_PRIVILEGES.FINANCIAL : false;

  // Check if user is from Designer sector
  const isDesignerSector = currentUser?.sector?.privileges === SECTOR_PRIVILEGES.DESIGNER;

  // Check if user is from Logistic sector
  const isLogisticSector = currentUser?.sector?.privileges === SECTOR_PRIVILEGES.LOGISTIC;

  // Check if user should see service orders and artworks (hide for Financial, Designer, Logistic)
  const shouldHideServiceOrdersAndArtworks = isFinancialSector || isDesignerSector || isLogisticSector;

  // Check if user is from Warehouse sector (should hide documents, budgets, and changelog)
  const isWarehouseSector = currentUser?.sector?.privileges === SECTOR_PRIVILEGES.WAREHOUSE;

  // Check if user can edit service orders (Admin or team leader only - based on managedSector)
  const canEditServiceOrders = currentUser && (isTeamLeader(currentUser) || hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN));

  // Check if user can view airbrushing financial data (FINANCIAL or ADMIN only)
  const canViewAirbrushingFinancials = currentUser && (hasPrivilege(currentUser, SECTOR_PRIVILEGES.FINANCIAL) || hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN));

  // Check if user can edit tasks (PRODUCTION, LEADER, ADMIN)
  const canEdit = canEditTasks(currentUser);

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

  // Handler for artworks collection viewing
  const handleArtworkFileClick = (file: any) => {
    if (!fileViewerContext) return;
    const artworkFiles = task?.artworks || [];
    const index = artworkFiles.findIndex(f => f.id === file.id);
    fileViewerContext.actions.viewFiles(artworkFiles, index);
  };

  // Handler for documents collection viewing (budgets, invoices, receipts)
  const handleDocumentFileClick = (file: any) => {
    if (!fileViewerContext) return;
    const allDocuments = [...(task?.budgets || []), ...(task?.invoices || []), ...(task?.receipts || [])];
    const index = allDocuments.findIndex(f => f.id === file.id);
    fileViewerContext.actions.viewFiles(allDocuments, index);
  };

  // Handler for cuts collection viewing
  const handleCutFileClick = (file: any) => {
    if (!fileViewerContext) return;
    const cutFiles = cuts.map(cut => cut.file).filter(Boolean);
    const index = cutFiles.findIndex(f => f.id === file.id);
    fileViewerContext.actions.viewFiles(cutFiles, index);
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
      // Note: airbrushings are fetched separately with useAirbrushingsByTask to get artworks included
      generalPainting: {
        include: {
          paintType: true,
          paintGrounds: {
            include: {
              groundPaint: {
                include: {
                  paintType: true,
                  paintBrand: true,
                },
              },
            },
          },
        },
      },
      logoPaints: {
        include: {
          paintType: true,
          paintBrand: true,
        },
      },
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

  // Fetch airbrushings separately to get artworks included (nested includes don't work)
  const { data: airbrushingsResponse } = useAirbrushingsByTask(
    {
      taskId: id!,
      params: {
        include: {
          artworks: true,
          receipts: true,
          invoices: true,
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

  const airbrushings = airbrushingsResponse?.data || [];

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
    const sections = layout.layoutSections;
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
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
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
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="space-y-6">
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
              ...(canEdit && task.status === TASK_STATUS.PENDING
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
              ...(canEdit && task.status === TASK_STATUS.IN_PRODUCTION
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
              ...(canEdit && task.status === TASK_STATUS.ON_HOLD
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
              ...(canEdit ? [{
                key: "edit",
                label: "Editar",
                icon: IconEdit,
                onClick: () => navigate(routes.production.schedule.edit(task.id)),
              }] : []),
            ]}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Overview Card */}
          <Card className="border flex flex-col animate-in fade-in-50 duration-700" level={1}>
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
          <IconClipboardList className="h-5 w-5 text-muted-foreground" />
          Informações Gerais
        </CardTitle>
                <Badge variant={getBadgeVariantFromStatus(task.status, "task")}>{TASK_STATUS_LABELS[task.status] || task.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 flex-1">
              <div className="space-y-4">
                {/* Customer */}
                {task.customer && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-1.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconBuilding className="h-4 w-4" />
                  Cliente
                    </span>
                    <div className="flex items-center gap-2">
                  <CustomerLogoDisplay
                    logo={task.customer.logo}
                    customerName={task.customer.fantasyName}
                    size="sm"
                    shape="rounded"
                    className="flex-shrink-0"
                  />
                  <span className="text-sm font-semibold text-foreground text-right">{task.customer.fantasyName}</span>
                    </div>
                  </div>
                )}

                {/* Sector */}
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconBuildingFactory className="h-4 w-4" />
                    Setor
                  </span>
                  <span className={`text-sm font-semibold ${task.sector ? "text-foreground" : "text-muted-foreground italic"}`}>
                    {task.sector ? task.sector.name : "Indefinido"}
                  </span>
                </div>

                {/* Commission Status */}
                {task.commission && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCoin className="h-4 w-4" />
                  Comissão
                    </span>
                    <Badge variant={ENTITY_BADGE_CONFIG.COMMISSION_STATUS?.[task.commission] || "default"}>
                  {COMMISSION_STATUS_LABELS[task.commission]}
                    </Badge>
                  </div>
                )}

                {/* Serial Number */}
                {task.serialNumber && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconHash className="h-4 w-4" />
                  Número de Série
                    </span>
                    <span className="text-sm font-semibold text-foreground font-mono">{task.serialNumber}</span>
                  </div>
                )}

                {/* Plate */}
                {task.truck?.plate && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCar className="h-4 w-4" />
                  Placa
                    </span>
                    <span className="text-sm font-semibold text-foreground font-mono uppercase">{task.truck.plate}</span>
                  </div>
                )}

                {/* Chassis Number */}
                {task.truck?.chassisNumber && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconBarcode className="h-4 w-4" />
                  Nº Chassi
                    </span>
                    <span className="text-sm font-semibold text-foreground">{formatChassis(task.truck.chassisNumber)}</span>
                  </div>
                )}

                {/* Truck Location/Spot */}
                {task.truck?.spot && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconMapPin className="h-4 w-4" />
                      Local
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {formatTruckSpot(task.truck.spot)}
                    </span>
                  </div>
                )}

                {/* Truck */}
                {task.truck && truckDimensions && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconTruck className="h-4 w-4" />
                  Caminhão
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                  {truckDimensions.width}cm × {truckDimensions.height}cm
                    </span>
                  </div>
                )}
              </div>

              {/* Details */}
              {task.details && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-3">
                <IconFileText className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Detalhes</h3>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 rounded-lg p-4">{task.details}</p>
                </div>
              )}
                </CardContent>
              </Card>

              {/* Dates Card */}
              <Card className="border flex flex-col animate-in fade-in-50 duration-800" level={1}>
                <CardHeader className="pb-6">
                  <CardTitle className="flex items-center gap-2">
          <IconCalendarWeek className="h-5 w-5 text-muted-foreground" />
          Datas
        </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 flex-1">
              <div className="space-y-4">
                {/* Created At */}
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <IconCalendarPlus className="h-4 w-4" />
                Criado
                  </span>
                  <div className="text-right">
                <span className="text-sm font-semibold text-foreground">{formatDateTime(task.createdAt)}</span>
                {task.createdBy && <p className="text-xs text-muted-foreground mt-0.5">por {task.createdBy.name}</p>}
                  </div>
                </div>

                {/* Entry Date */}
                {task.entryDate && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCalendar className="h-4 w-4" />
                  Entrada
                </span>
                <span className="text-sm font-semibold text-foreground">{formatDateTime(task.entryDate)}</span>
                  </div>
                )}

                {/* Term */}
                {task.term && (
                  <div className={cn("flex justify-between items-center rounded-lg px-4 py-2.5", isOverdue ? "bg-red-50/50 dark:bg-red-900/20 border border-red-200/40 dark:border-red-700/40" : "bg-muted/50")}>
                <span className={cn("text-sm font-medium flex items-center gap-2", isOverdue ? "text-red-700 dark:text-red-300" : "text-muted-foreground")}>
                  <IconCalendarEvent className="h-4 w-4" />
                  Prazo
                </span>
                <span className={cn("text-sm font-semibold", isOverdue ? "text-red-800 dark:text-red-200" : "text-foreground")}>
                  {formatDateTime(task.term)}
                  {isOverdue && " (Atrasado)"}
                </span>
                  </div>
                )}

                {/* Started At */}
                {task.startedAt && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCalendarStats className="h-4 w-4" />
                  Iniciado
                </span>
                <span className="text-sm font-semibold text-foreground">{formatDateTime(task.startedAt)}</span>
                  </div>
                )}

                {/* Finished At */}
                {task.finishedAt && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCalendarCheck className="h-4 w-4" />
                  Finalizado
                </span>
                <span className="text-sm font-semibold text-foreground">{formatDateTime(task.finishedAt)}</span>
                  </div>
                )}
              </div>
                </CardContent>
              </Card>

              {/* Budget Card - Hidden for Warehouse sector users */}
              {!isWarehouseSector && task.budget && task.budget.items && task.budget.items.length > 0 && (
                <Card className="border flex flex-col animate-in fade-in-50 duration-825" level={1}>
                  <CardHeader className="pb-6">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
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
                  {/* Budget validity date */}
                  {task.budget.expiresIn && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                  <IconCalendar className="h-4 w-4" />
                  <span>Validade: <span className="font-medium text-foreground">{formatDate(task.budget.expiresIn)}</span></span>
                </div>
                  )}

                  {/* Budget items table */}
                  <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                    Descrição
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground w-32">
                    Valor
                  </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {task.budget.items.map((item, index) => (
                  <tr key={item.id || index} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm">{item.description}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {formatCurrency(item.amount)}
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
                  typeof task.budget.total === 'number' ? task.budget.total : Number(task.budget.total) || 0
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
                  <CardHeader className="pb-6">
                    <CardTitle className="flex items-center gap-2">
          <IconLayoutGrid className="h-5 w-5 text-muted-foreground" />
          Layout do Caminhão
        </CardTitle>
                    {/* Display truck dimensions from layout */}
                    {(() => {
                      const layouts = [task.truck.leftSideLayout, task.truck.rightSideLayout, task.truck.backSideLayout].filter(Boolean);
                      if (layouts.length > 0 && layouts[0]) {
                        const layout = layouts[0];
                        if (layout.height && layout.layoutSections && layout.layoutSections.length > 0) {
                          const totalWidth = layout.layoutSections.reduce((sum: number, section: any) => sum + (section.width || 0), 0);
                          return (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                              <IconRuler className="h-4 w-4" />
                              <span>Medidas: <span className="font-medium text-foreground">{totalWidth.toFixed(2).replace('.', ',')} x {layout.height.toFixed(2).replace('.', ',')} m</span></span>
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}
                  </CardHeader>
              <CardContent className="pt-0">
                <TruckLayoutPreview truckId={task.truck.id} taskName={task.name} />
              </CardContent>
                </Card>
              )}

              {/* Service Orders Card - Hidden for Financial, Designer, Logistic sectors */}
              {!shouldHideServiceOrdersAndArtworks && filteredServiceOrders.length > 0 && (
                <Card className="border flex flex-col animate-in fade-in-50 duration-900" level={1}>
                  <CardHeader className="pb-6">
                    <CardTitle className="flex items-center gap-2">
                      <IconClipboardList className="h-5 w-5 text-muted-foreground" />
                      Ordens de Serviço
                      <Badge variant="secondary" className="ml-auto">
                        {filteredServiceOrders.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
              <CardContent className="pt-0 flex-1">
                <div className="space-y-2">
                  {filteredServiceOrders.map((serviceOrder) => (
                <div key={serviceOrder.id} className="bg-muted/50 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 space-y-1.5">
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

                    {/* Status Change Dropdown - Only for Admin and Leader */}
                    <div className="flex items-center">
                  {canEditServiceOrders ? (
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
                      className="w-40 h-8"
                    />
                  ) : (
                    <Badge variant={getBadgeVariantFromStatus(serviceOrder.status)}>
                      {SERVICE_ORDER_STATUS_LABELS[serviceOrder.status]}
                    </Badge>
                  )}
                    </div>
                  </div>
                </div>
                  ))}
                </div>
              </CardContent>
                </Card>
              )}

              {/* Cuts Card - Hidden for Financial sector users */}
              {!isFinancialSector && cuts.length > 0 && (
                <Card className="border flex flex-col animate-in fade-in-50 duration-950 lg:col-span-1" level={1}>
                  <CardHeader className="pb-6">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <IconCut className="h-5 w-5 text-muted-foreground" />
                        Recortes
                        <Badge variant="secondary" className="ml-2">
                          {cuts.length}
                        </Badge>
                      </CardTitle>
                      {cuts.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const apiUrl = (window as any).__ANKAA_API_URL__ || (import.meta as any).env?.VITE_API_URL || "http://localhost:3030";
                            const zipFileName = `${task.name}${task.serialNumber ? `-${task.serialNumber}` : ''}-recortes.zip`;

                            // Download files and create zip
                            const JSZip = (await import('jszip')).default;
                            const zip = new JSZip();

                            // Fetch all files
                            const filePromises = cuts.map(async (cut) => {
                              if (cut.file) {
                                try {
                                  const response = await fetch(`${apiUrl}/files/${cut.file.id}/download`);
                                  const blob = await response.blob();
                                  zip.file(cut.file.filename, blob);
                                } catch (error) {
                                  console.error(`Error downloading file ${cut.file.filename}:`, error);
                                }
                              }
                            });

                            await Promise.all(filePromises);

                            // Generate zip and download
                            const content = await zip.generateAsync({ type: 'blob' });
                            const url = URL.createObjectURL(content);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = zipFileName;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                          }}
                          className="text-xs"
                        >
                          <IconDownload className="h-3 w-3 mr-1" />
                          Baixar Todos
                        </Button>
                      )}
                    </div>
                  </CardHeader>
              <CardContent className="pt-0 flex-1">
                <div className="flex flex-wrap gap-3">
                  {cuts.map((cut) => (
                cut.file && (
                  <FileItem
                    key={cut.id}
                    file={cut.file}
                    viewMode="grid"
                    onPreview={handleCutFileClick}
                  />
                )
                  ))}
                </div>
              </CardContent>
                </Card>
              )}

              {/* Artworks Card - 1/2 width - Hidden for Financial, Designer, Logistic sectors */}
              {!shouldHideServiceOrdersAndArtworks && task.artworks && task.artworks.length > 0 && (
                <Card className="border flex flex-col animate-in fade-in-50 duration-1000 lg:col-span-1" level={1}>
                  <CardHeader className="pb-6">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
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
                  onPreview={handleArtworkFileClick}
                  onDownload={handleDownload}
                  showActions
                />
                  ))}
                </div>
              </CardContent>
                </Card>
              )}

              {/* Documents Card - Budget, NFE, Receipt - Hidden for Warehouse sector users */}
              {!isWarehouseSector && ((task.budgets && task.budgets.length > 0) || (task.invoices && task.invoices.length > 0) || (task.receipts && task.receipts.length > 0)) && (
                <Card className="border flex flex-col animate-in fade-in-50 duration-1050" level={1}>
                  <CardHeader className="pb-6">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
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
                    onPreview={handleDocumentFileClick}
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
                    onPreview={handleDocumentFileClick}
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
                    onPreview={handleDocumentFileClick}
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
                  <CardHeader className="pb-6">
                    <CardTitle className="flex items-center gap-2">
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
                  {/* Small color preview - 80px - prefer colorPreview image */}
                  <div className="relative flex-shrink-0">
                    <div className="w-20 h-20 rounded-md ring-1 ring-border shadow-sm overflow-hidden">
                      {task.generalPainting?.colorPreview ? (
                    <img src={task.generalPainting.colorPreview} alt={task.generalPainting.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                    <CanvasNormalMapRenderer
                      baseColor={task.generalPainting?.hex || "#888888"}
                      finish={(task.generalPainting?.finish as PAINT_FINISH) || PAINT_FINISH.SOLID}
                      width={80}
                      height={80}
                      quality="medium"
                      className="w-full h-full object-cover"
                    />
                      )}
                    </div>
                  </div>

                  {/* Paint information */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base">{task.generalPainting?.name}</h3>
                      <span className="text-xs font-mono text-muted-foreground">{task.generalPainting?.hex}</span>
                    </div>

                    {/* Badges - unified neutral style, no icons */}
                    <div className="flex flex-wrap gap-1">
                      {task.generalPainting?.paintType?.name && (
                    <Badge className={cn("text-xs", PAINT_BADGE_STYLE)}>
                      {task.generalPainting?.paintType.name}
                    </Badge>
                      )}
                      {task.generalPainting?.finish && (
                    <Badge className={cn("text-xs", PAINT_BADGE_STYLE)}>
                      {PAINT_FINISH_LABELS[task.generalPainting?.finish]}
                    </Badge>
                      )}
                      {task.generalPainting?.paintBrand?.name && (
                    <Badge className={cn("text-xs", PAINT_BADGE_STYLE)}>
                      {task.generalPainting?.paintBrand?.name}
                    </Badge>
                      )}
                      {task.generalPainting?.manufacturer && (
                    <Badge className={cn("text-xs max-w-[100px] truncate", PAINT_BADGE_STYLE)} title={TRUCK_MANUFACTURER_LABELS[task.generalPainting?.manufacturer]}>
                      {TRUCK_MANUFACTURER_LABELS[task.generalPainting?.manufacturer]}
                    </Badge>
                      )}
                    </div>
                  </div>
                    </div>
                  </div>

                  {/* Display ground paints if available */}
                  {task.generalPainting?.paintGrounds && task.generalPainting.paintGrounds.length > 0 && (
                    <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <IconLayersIntersect className="h-4 w-4 text-muted-foreground" />
                    <h5 className="text-xs font-semibold text-muted-foreground uppercase">
                      Fundos Recomendados ({task.generalPainting.paintGrounds.length})
                    </h5>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {task.generalPainting.paintGrounds.map((pg: any) => {
                      const groundPaint = pg.groundPaint;
                      if (!groundPaint) return null;

                      return (
                    <div
                      key={groundPaint.id}
                      className="bg-muted/30 rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors border border-muted min-w-[280px] flex-shrink-0"
                      onClick={() => navigate(routes.painting.catalog.details(groundPaint.id))}
                    >
                      <div className="flex items-start gap-3">
                        {/* Small color preview - prefer colorPreview image */}
                        <div className="w-12 h-12 rounded-md ring-1 ring-border shadow-sm flex-shrink-0 overflow-hidden">
                      {groundPaint.colorPreview ? (
                        <img src={groundPaint.colorPreview} alt={groundPaint.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full" style={{ backgroundColor: groundPaint.hex }} />
                      )}
                        </div>

                        {/* Paint info */}
                        <div className="flex-1 min-w-0 space-y-1">
                      <h6 className="font-medium text-sm truncate">{groundPaint.name}</h6>
                      <code className="text-xs font-mono text-muted-foreground">{groundPaint.hex}</code>
                      <div className="flex flex-wrap gap-1">
                        {groundPaint.paintType?.name && (
                          <Badge className={cn("text-xs", PAINT_BADGE_STYLE)}>
                        {groundPaint.paintType.name}
                          </Badge>
                        )}
                        {groundPaint.finish && (
                          <Badge className={cn("text-xs", PAINT_BADGE_STYLE)}>
                        {PAINT_FINISH_LABELS[groundPaint.finish]}
                          </Badge>
                        )}
                        {groundPaint.paintBrand?.name && (
                          <Badge className={cn("text-xs", PAINT_BADGE_STYLE)}>
                        {groundPaint.paintBrand.name}
                          </Badge>
                        )}
                      </div>
                        </div>
                      </div>
                    </div>
                      );
                    })}
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
                    <h4 className="text-sm font-semibold">Tintas da Logo</h4>
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
                      {/* Small color preview - 40px for logo paints - prefer colorPreview image */}
                      <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-md ring-1 ring-border shadow-sm overflow-hidden">
                      {paint.colorPreview ? (
                        <img src={paint.colorPreview} alt={paint.name} className="w-full h-full object-cover rounded-md" loading="lazy" />
                      ) : (
                        <CanvasNormalMapRenderer
                      baseColor={paint.hex || "#888888"}
                      finish={(paint.finish as PAINT_FINISH) || PAINT_FINISH.SOLID}
                      width={40}
                      height={40}
                      quality="medium"
                      className="w-full h-full object-cover rounded-md"
                        />
                      )}
                    </div>
                      </div>

                      {/* Paint information */}
                      <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base">{paint.name}</h3>
                      <span className="text-xs font-mono text-muted-foreground">{paint.hex}</span>
                    </div>

                    {/* Badges - unified neutral style, no icons */}
                    <div className="flex flex-wrap gap-1">
                      {paint.paintType?.name && (
                        <Badge className={cn("text-xs", PAINT_BADGE_STYLE)}>
                      {paint.paintType.name}
                        </Badge>
                      )}
                      {paint.finish && (
                        <Badge className={cn("text-xs", PAINT_BADGE_STYLE)}>
                      {PAINT_FINISH_LABELS[paint.finish]}
                        </Badge>
                      )}
                      {paint.paintBrand?.name && (
                        <Badge className={cn("text-xs", PAINT_BADGE_STYLE)}>
                      {paint.paintBrand?.name}
                        </Badge>
                      )}
                      {paint.manufacturer && (
                        <Badge className={cn("text-xs max-w-[100px] truncate", PAINT_BADGE_STYLE)} title={TRUCK_MANUFACTURER_LABELS[paint.manufacturer]}>
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
                  <CardHeader className="pb-6">
                    <CardTitle className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-yellow-500/10">
                        <IconAlertCircle className="h-5 w-5 text-yellow-500" />
                      </div>
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
                  onPreview={() => {
                    if (fileViewerContext) {
                      fileViewerContext.actions.viewFiles(task.observation.files || [], index);
                    }
                  }}
                  showActions={false}
                  showFilename={false}
                  showFileSize={false}
                  showRelativeTime={false}
                  className="bg-muted/30"
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
                <Card className="border flex flex-col animate-in fade-in-50 duration-1250 lg:col-span-1" level={1}>
                  <CardHeader className="pb-6">
                    <CardTitle className="flex items-center gap-2">
                      <IconSpray className="h-5 w-5 text-muted-foreground" />
                      Aerografias
                      <Badge variant="secondary" className="ml-2">
                        {airbrushings.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
              <CardContent className="pt-0 flex-1">
                <div className="space-y-3">
                  {airbrushings.map((airbrushing, index) => {
                    const firstArtwork = airbrushing.artworks?.[0];
                    let apiUrl = (window as any).__ANKAA_API_URL__ || import.meta.env?.VITE_API_URL || "http://localhost:3030";
                    apiUrl = apiUrl.replace(/\/+$/, ''); // Remove trailing slashes

                    // Generate proper thumbnail URL - same logic as FileItem component
                    const getArtworkThumbnailUrl = () => {
                      if (!firstArtwork) return null;

                      // If thumbnailUrl exists and is already a full URL
                      if (firstArtwork.thumbnailUrl?.startsWith("http")) {
                        return firstArtwork.thumbnailUrl;
                      }

                      // If thumbnailUrl exists (relative path), use thumbnail endpoint
                      if (firstArtwork.thumbnailUrl) {
                        return `${apiUrl}/files/thumbnail/${firstArtwork.id}?size=small`;
                      }

                      // For images without thumbnails, check mimetype and use serve endpoint
                      const mimetype = firstArtwork.mimetype || firstArtwork.mimeType || '';
                      if (mimetype.startsWith('image/')) {
                        return `${apiUrl}/files/serve/${firstArtwork.id}`;
                      }

                      // Fallback: try to serve anyway (backend will handle it)
                      return `${apiUrl}/files/serve/${firstArtwork.id}`;
                    };
                    const artworkThumbnailUrl = getArtworkThumbnailUrl();

                    return (
                      <div
                        key={airbrushing.id}
                        className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => navigate(routes.production.airbrushings.details(airbrushing.id))}
                      >
                        <div className="flex gap-4">
                          {/* Artwork thumbnail - clickable to open file viewer */}
                          {firstArtwork && artworkThumbnailUrl && (
                            <div
                              className="flex-shrink-0 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (fileViewerContext && airbrushing.artworks) {
                                  fileViewerContext.actions.viewFiles(airbrushing.artworks, 0);
                                }
                              }}
                            >
                              <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted ring-1 ring-border hover:ring-2 hover:ring-primary transition-all">
                                <img
                                  src={artworkThumbnailUrl}
                                  alt="Arte"
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    // Hide image and show icon on error
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const parent = target.parentElement;
                                    if (parent) {
                                      parent.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg></div>';
                                    }
                                  }}
                                />
                              </div>
                              {(airbrushing.artworks?.length ?? 0) > 1 && (
                                <p className="text-xs text-muted-foreground text-center mt-1">
                                  +{(airbrushing.artworks?.length ?? 0) - 1} mais
                                </p>
                              )}
                            </div>
                          )}

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <IconBrush className="h-4 w-4 text-muted-foreground" />
                                <h4 className="font-semibold text-sm">
                                  {canViewAirbrushingFinancials && airbrushing.price
                                    ? formatCurrency(airbrushing.price)
                                    : `Aerografia #${index + 1}`}
                                </h4>
                              </div>
                              <Badge variant={ENTITY_BADGE_CONFIG.AIRBRUSHING[airbrushing.status] || "default"} className="text-xs">
                                {AIRBRUSHING_STATUS_LABELS[airbrushing.status]}
                              </Badge>
                            </div>

                            {/* Dates in column layout */}
                            {(airbrushing.startDate || airbrushing.finishDate || airbrushing.createdAt) && (
                              <div className="flex flex-col gap-1 text-xs text-muted-foreground mb-2">
                                {airbrushing.startDate && (
                                  <div className="flex items-center gap-1">
                                    <IconCalendar className="h-3 w-3" />
                                    <span>Início: {formatDate(airbrushing.startDate)}</span>
                                  </div>
                                )}
                                {airbrushing.finishDate && (
                                  <div className="flex items-center gap-1">
                                    <IconCalendarEvent className="h-3 w-3" />
                                    <span>Finalização: {formatDate(airbrushing.finishDate)}</span>
                                  </div>
                                )}
                                {!airbrushing.startDate && !airbrushing.finishDate && airbrushing.createdAt && (
                                  <div className="flex items-center gap-1">
                                    <IconCalendar className="h-3 w-3" />
                                    <span>Criado: {formatDate(airbrushing.createdAt)}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Files count */}
                            {((canViewAirbrushingFinancials && ((airbrushing.receipts?.length ?? 0) > 0 || (airbrushing.invoices?.length ?? 0) > 0)) || (!firstArtwork && (airbrushing.artworks?.length ?? 0) > 0)) && (
                              <div className="flex items-center text-xs text-muted-foreground pt-2 border-t">
                                <div className="flex gap-3">
                                  {!firstArtwork && (airbrushing.artworks?.length ?? 0) > 0 && (
                                    <div className="flex items-center gap-1">
                                      <IconFiles className="h-3 w-3" />
                                      <span>{airbrushing.artworks?.length ?? 0} arte(s)</span>
                                    </div>
                                  )}
                                  {canViewAirbrushingFinancials && (airbrushing.receipts?.length ?? 0) > 0 && (
                                    <div className="flex items-center gap-1">
                                      <IconFile className="h-3 w-3" />
                                      <span>{airbrushing.receipts?.length ?? 0} recibo(s)</span>
                                    </div>
                                  )}
                                  {canViewAirbrushingFinancials && (airbrushing.invoices?.length ?? 0) > 0 && (
                                    <div className="flex items-center gap-1">
                                      <IconFileText className="h-3 w-3" />
                                      <span>{airbrushing.invoices?.length ?? 0} NFe(s)</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
                </Card>
              )}

          {/* Changelog History - Hidden for Financial and Warehouse sector users */}
          {!isFinancialSector && !isWarehouseSector && (
            <Card className="border flex flex-col animate-in fade-in-50 duration-1300" level={1}>
              <ChangelogHistory entityType={CHANGE_LOG_ENTITY_TYPE.TASK} entityId={task.id} entityName={task.name} entityCreatedAt={task.createdAt} className="h-full" />
            </Card>
          )}
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
      </div>
    </PrivilegeRoute>
  );
};

export default TaskDetailsPage;
