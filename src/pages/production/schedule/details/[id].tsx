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
  SERVICE_ORDER_TYPE_LABELS,
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
  TRUCK_CATEGORY_LABELS,
  IMPLEMENT_TYPE_LABELS,
} from "../../../../constants";
import { formatDate, formatDateTime, formatCurrency, formatChassis, formatTruckSpot, formatBrazilianPhone, isValidTaskStatusTransition, hasPrivilege } from "../../../../utils";
import { cn } from "@/lib/utils";
import { isTeamLeader } from "@/utils/user";
import { canEditTasks } from "@/utils/permissions/entity-permissions";
import { canViewServiceOrderType, canEditServiceOrder, getVisibleServiceOrderTypes } from "@/utils/permissions/service-order-permissions";
import { SERVICE_ORDER_TYPE } from "../../../../constants";
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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { LoadingSpinner } from "@/components/ui/loading";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { TaskWithServiceOrdersChangelog } from "@/components/ui/task-with-service-orders-changelog";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import {
  IconClipboardList,
  IconEdit,
  IconPlayerPlay,
  IconCheck,
  IconX,
  IconBan,
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
  IconPhone,
  IconCalendarTime,
  IconBrandWhatsapp,
  IconNote,
} from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CanvasNormalMapRenderer } from "@/components/painting/effects/canvas-normal-map-renderer";
import { DETAIL_PAGE_SPACING, getDetailGridClasses } from "@/lib/layout-constants";
import { useSectionVisibility } from "@/hooks/use-section-visibility";
import type { SectionConfig } from "@/hooks/use-section-visibility";
import { SectionVisibilityManager } from "@/components/ui/section-visibility-manager";

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

// Section configuration for visibility management
const TASK_SECTIONS: SectionConfig[] = [
  {
    id: "overview",
    label: "Visão Geral",
    defaultVisible: true,
    fields: [
      { id: "customer", label: "Cliente", sectionId: "overview", required: true },
      { id: "invoiceTo", label: "Faturar Para", sectionId: "overview" },
      { id: "negotiatingWithName", label: "Responsável pela Negociação", sectionId: "overview" },
      { id: "negotiatingWithPhone", label: "Telefone do Responsável", sectionId: "overview" },
      { id: "sector", label: "Setor", sectionId: "overview" },
      { id: "commission", label: "Comissão", sectionId: "overview" },
      { id: "serialNumber", label: "Número de Série", sectionId: "overview" },
      { id: "plate", label: "Placa", sectionId: "overview" },
      { id: "chassisNumber", label: "Chassi", sectionId: "overview" },
      { id: "truckCategory", label: "Categoria", sectionId: "overview" },
      { id: "implementType", label: "Tipo de Implemento", sectionId: "overview" },
      { id: "truckSpot", label: "Localização", sectionId: "overview" },
      { id: "vehicle", label: "Veículo", sectionId: "overview" },
      { id: "details", label: "Detalhes", sectionId: "overview" },
    ],
  },
  {
    id: "dates",
    label: "Datas",
    defaultVisible: true,
    fields: [
      { id: "created", label: "Criado", sectionId: "dates" },
      { id: "forecast", label: "Previsão", sectionId: "dates" },
      { id: "entry", label: "Entrada", sectionId: "dates" },
      { id: "term", label: "Prazo", sectionId: "dates" },
      { id: "started", label: "Iniciado", sectionId: "dates" },
      { id: "finished", label: "Finalizado", sectionId: "dates" },
    ],
  },
  {
    id: "pricing",
    label: "Precificação",
    defaultVisible: true,
    fields: [
      { id: "pricingItems", label: "Itens de Precificação", sectionId: "pricing" },
      { id: "totalValue", label: "Valor Total", sectionId: "pricing" },
    ],
  },
  {
    id: "layout",
    label: "Layout do Caminhão",
    defaultVisible: true,
    fields: [
      { id: "layoutPreview", label: "Visualização", sectionId: "layout" },
    ],
  },
  {
    id: "serviceOrders",
    label: "Ordens de Serviço",
    defaultVisible: true,
    fields: [
      { id: "ordersList", label: "Lista de Ordens", sectionId: "serviceOrders" },
    ],
  },
  {
    id: "cuts",
    label: "Recortes",
    defaultVisible: true,
    fields: [
      { id: "cutFiles", label: "Arquivos de Recorte", sectionId: "cuts" },
    ],
  },
  {
    id: "baseFiles",
    label: "Arquivos Base",
    defaultVisible: true,
    fields: [
      { id: "baseFileFiles", label: "Arquivos Base", sectionId: "baseFiles" },
    ],
  },
  {
    id: "artworks",
    label: "Artes",
    defaultVisible: true,
    fields: [
      { id: "artworkFiles", label: "Arquivos de Arte", sectionId: "artworks" },
    ],
  },
  {
    id: "documents",
    label: "Documentos",
    defaultVisible: true,
    fields: [
      { id: "budgetDocs", label: "Orçamentos", sectionId: "documents" },
      { id: "invoices", label: "Notas Fiscais", sectionId: "documents" },
      { id: "receipts", label: "Recibos", sectionId: "documents" },
    ],
  },
  {
    id: "paints",
    label: "Tintas",
    defaultVisible: true,
    fields: [
      { id: "generalPainting", label: "Pintura Geral", sectionId: "paints" },
      { id: "logoPaints", label: "Tintas da Logomarca", sectionId: "paints" },
    ],
  },
  {
    id: "observation",
    label: "Observação",
    defaultVisible: true,
    fields: [
      { id: "observationText", label: "Texto da Observação", sectionId: "observation" },
      { id: "observationFiles", label: "Arquivos Anexados", sectionId: "observation" },
    ],
  },
  {
    id: "airbrushings",
    label: "Aerografias",
    defaultVisible: true,
    fields: [
      { id: "airbrushingList", label: "Lista de Aerografias", sectionId: "airbrushings" },
    ],
  },
  {
    id: "changelog",
    label: "Histórico de Alterações",
    defaultVisible: false,
    fields: [
      { id: "changelogHistory", label: "Histórico", sectionId: "changelog" },
    ],
  },
];

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
  const [baseFilesViewMode, setBaseFilesViewMode] = useState<FileViewMode>("list");
  const [artworksViewMode, setArtworksViewMode] = useState<FileViewMode>("list");
  const [documentsViewMode, setDocumentsViewMode] = useState<FileViewMode>("list");

  // Get user's sector privilege for service order permissions
  const userSectorPrivilege = currentUser?.sector?.privileges as SECTOR_PRIVILEGES | undefined;

  // Check if user is from Financial sector (for other UI elements)
  const isFinancialSector = currentUser ? hasPrivilege(currentUser, SECTOR_PRIVILEGES.FINANCIAL) && currentUser.sector?.privileges === SECTOR_PRIVILEGES.FINANCIAL : false;

  // Check if user is from Warehouse sector (should hide documents, budgets, and changelog)
  const isWarehouseSector = currentUser?.sector?.privileges === SECTOR_PRIVILEGES.WAREHOUSE;

  // Check if user can view base files (ADMIN, COMMERCIAL, LOGISTIC, DESIGNER only)
  const canViewBaseFiles = currentUser && (
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.COMMERCIAL) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.LOGISTIC) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.DESIGNER)
  );

  // Get visible service order types based on user's sector privilege
  const visibleServiceOrderTypes = useMemo(
    () => getVisibleServiceOrderTypes(userSectorPrivilege),
    [userSectorPrivilege]
  );

  // Check if user has any visible service order types
  const hasVisibleServiceOrders = visibleServiceOrderTypes.length > 0;

  // Check if user can view airbrushing financial data (FINANCIAL or ADMIN only)
  const canViewAirbrushingFinancials = currentUser && (hasPrivilege(currentUser, SECTOR_PRIVILEGES.FINANCIAL) || hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN));

  // Check if user can edit tasks (PRODUCTION, LEADER, ADMIN)
  const canEdit = canEditTasks(currentUser);

  // Initialize section visibility hook
  const sectionVisibility = useSectionVisibility(
    "task-detail-visibility",
    TASK_SECTIONS
  );

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

  // Handler for baseFiles collection viewing
  const handleBaseFileClick = (file: any) => {
    if (!fileViewerContext) return;
    const baseFilesList = task?.baseFiles || [];
    const index = baseFilesList.findIndex(f => f.id === file.id);
    fileViewerContext.actions.viewFiles(baseFilesList, index);
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
      invoiceTo: {
        include: {
          logo: true,
        },
      },
      createdBy: true,
      services: {
        include: {
          assignedTo: true,
        },
      },
      baseFiles: true,
      artworks: true,
      pricing: {
        include: {
          items: true,
        },
      },
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

  // Filter service orders by:
  // 1. Status: only PENDING, IN_PROGRESS, WAITING_APPROVE, and COMPLETED (not CANCELLED)
  // 2. Type: only types the user has permission to view based on sector privilege
  const filteredServiceOrders = useMemo(() => {
    if (!task?.services) return [];
    return task.services
      .filter((service) => {
        // Filter by status - exclude only CANCELLED
        const hasValidStatus = service.status === SERVICE_ORDER_STATUS.PENDING ||
          service.status === SERVICE_ORDER_STATUS.IN_PROGRESS ||
          service.status === SERVICE_ORDER_STATUS.WAITING_APPROVE ||
          service.status === SERVICE_ORDER_STATUS.COMPLETED;
        if (!hasValidStatus) return false;

        // Filter by type based on user's sector privilege
        const serviceType = service.type as SERVICE_ORDER_TYPE;
        return visibleServiceOrderTypes.includes(serviceType);
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [task?.services, visibleServiceOrderTypes]);

  // Determine the source section from the URL path
  // /producao/cronograma/detalhes/123 → 'cronograma'
  // /producao/agenda/detalhes/123 → 'agenda'
  // /producao/historico/detalhes/123 → 'historico'
  const pathSegments = location.pathname.split('/');
  const source = pathSegments[2]; // Index 2 is the section (cronograma, agenda, historico)

  // Get breadcrumb configuration based on source
  const getBreadcrumbConfig = (source: string) => {
    switch (source) {
      case 'agenda':
        return {
          label: 'Agenda',
          href: routes.production.preparation.root,
          editRoute: routes.production.preparation.edit,
        };
      case 'historico':
        return {
          label: 'Histórico',
          href: routes.production.history.root,
          editRoute: routes.production.history.edit,
        };
      case 'cronograma':
      default:
        return {
          label: 'Cronograma',
          href: routes.production.schedule.list,
          editRoute: routes.production.schedule.edit,
        };
    }
  };

  const breadcrumbConfig = getBreadcrumbConfig(source);

  // Get display name with fallbacks
  const getTaskDisplayName = (task: any) => {
    if (task.name) return task.name;
    if (task.customer?.fantasyName) return task.customer.fantasyName;
    if (task.serialNumber) return `Série ${task.serialNumber}`;
    if (task.truck?.plate) return task.truck.plate;
    return "Sem nome";
  };

  const taskDisplayName = task ? getTaskDisplayName(task) : "Carregando...";

  // Track page access
  usePageTracker({
    title: task ? `Tarefa: ${taskDisplayName}` : "Detalhes da Tarefa",
    icon: source === 'historico' ? "history" : "clipboard-list",
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

  // Loading state
  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PLOTTING, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="h-full flex flex-col px-4 pt-4">
          <div className="flex-1 overflow-y-auto pb-6">
            <div className="space-y-6">
              <Skeleton className="h-24 w-full rounded-lg" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Skeleton className="h-96 rounded-lg" />
                <Skeleton className="h-96 rounded-lg" />
                <Skeleton className="h-64 rounded-lg" />
                <Skeleton className="h-64 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  // Error or not found state
  if (error || !task) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PLOTTING, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="h-full flex flex-col px-4 pt-4">
          <div className="flex-1 overflow-y-auto pb-6">
            <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in-50 duration-500">
              <div className="text-center px-4 max-w-md mx-auto space-y-4">
                <div className="inline-flex p-4 bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
                  <IconAlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-2xl font-semibold">Tarefa não encontrada</h2>
                <p className="text-muted-foreground">A tarefa que você está procurando não existe ou foi removida.</p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => navigate(breadcrumbConfig.href)} variant="outline">
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
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  const isOverdue = task.term && new Date(task.term) < new Date() && task.status !== TASK_STATUS.COMPLETED && task.status !== TASK_STATUS.CANCELLED;

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PLOTTING, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title={taskDisplayName}
          breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Produção", href: routes.production.root },
                { label: breadcrumbConfig.label, href: breadcrumbConfig.href },
                { label: taskDisplayName },
              ]}
              actions={[
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
              {
                key: "section-visibility",
                label: (
                  <SectionVisibilityManager
                    sections={TASK_SECTIONS}
                    visibilityState={sectionVisibility.visibilityState}
                    onToggleSection={sectionVisibility.toggleSection}
                    onToggleField={sectionVisibility.toggleField}
                    onReset={sectionVisibility.resetToDefaults}
                  />
                ) as any,
                onClick: () => {},
                hideOnMobile: false,
              },
              ...(canEdit ? [{
                key: "edit",
                label: "Editar",
                icon: IconEdit,
                onClick: () => navigate(breadcrumbConfig.editRoute(task.id)),
              }] : []),
            ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Overview Card */}
              {sectionVisibility.isSectionVisible("overview") && (
                <Card className="border flex flex-col animate-in-50 duration-700">
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
                {sectionVisibility.isFieldVisible("customer") && task.customer && (
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

                {/* Invoice To */}
                {sectionVisibility.isFieldVisible("invoiceTo") && task.invoiceTo && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-1.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconFileInvoice className="h-4 w-4" />
                      Faturar Para
                    </span>
                    <div className="flex items-center gap-2">
                      <CustomerLogoDisplay
                        logo={task.invoiceTo.logo}
                        customerName={task.invoiceTo.fantasyName}
                        size="sm"
                        shape="rounded"
                        className="flex-shrink-0"
                      />
                      <span className="text-sm font-semibold text-foreground text-right">{task.invoiceTo.fantasyName}</span>
                    </div>
                  </div>
                )}

                {/* Negotiating With - Name */}
                {sectionVisibility.isFieldVisible("negotiatingWithName") && task.negotiatingWith?.name && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconUser className="h-4 w-4" />
                      Responsável pela Negociação
                    </span>
                    <span className="text-sm font-semibold text-foreground">{task.negotiatingWith.name}</span>
                  </div>
                )}

                {/* Negotiating With - Phone */}
                {sectionVisibility.isFieldVisible("negotiatingWithPhone") && task.negotiatingWith?.phone && (() => {
                  const cleanPhone = task.negotiatingWith.phone.replace(/\D/g, "");
                  const whatsappNumber = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
                  return (
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <IconPhone className="h-4 w-4" />
                        Telefone do Responsável
                      </span>
                      <div className="flex items-center gap-3">
                        <a
                          href={`tel:${task.negotiatingWith.phone}`}
                          className="text-sm font-semibold text-green-600 dark:text-green-600 hover:underline font-mono"
                        >
                          {formatBrazilianPhone(task.negotiatingWith.phone)}
                        </a>
                        <a
                          href={`https://wa.me/${whatsappNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 dark:text-green-600 hover:text-green-700 dark:hover:text-green-500 transition-colors"
                          title="Enviar mensagem no WhatsApp"
                        >
                          <IconBrandWhatsapp className="h-5 w-5" />
                        </a>
                      </div>
                    </div>
                  );
                })()}

                {/* Sector */}
                {sectionVisibility.isFieldVisible("sector") && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconBuildingFactory className="h-4 w-4" />
                    Setor
                  </span>
                  <span className={`text-sm font-semibold ${task.sector ? "text-foreground" : "text-muted-foreground italic"}`}>
                    {task.sector ? task.sector.name : "Indefinido"}
                  </span>
                </div>
                )}

                {/* Commission Status */}
                {sectionVisibility.isFieldVisible("commission") && task.commission && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCoin className="h-4 w-4" />
                  Comissão
                    </span>
                    <span className="text-sm font-medium">
                  {COMMISSION_STATUS_LABELS[task.commission]}
                    </span>
                  </div>
                )}

                {/* Serial Number */}
                {sectionVisibility.isFieldVisible("serialNumber") && task.serialNumber && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconHash className="h-4 w-4" />
                  Número de Série
                    </span>
                    <span className="text-sm font-semibold text-foreground">{task.serialNumber}</span>
                  </div>
                )}

                {/* Plate */}
                {sectionVisibility.isFieldVisible("plate") && task.truck?.plate && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCar className="h-4 w-4" />
                  Placa
                    </span>
                    <span className="text-sm font-semibold text-foreground uppercase">{task.truck.plate}</span>
                  </div>
                )}

                {/* Chassis Number */}
                {sectionVisibility.isFieldVisible("chassisNumber") && task.truck?.chassisNumber && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconBarcode className="h-4 w-4" />
                  Nº Chassi
                    </span>
                    <span className="text-sm font-semibold text-foreground">{formatChassis(task.truck.chassisNumber)}</span>
                  </div>
                )}

                {/* Truck Category */}
                {sectionVisibility.isFieldVisible("truckCategory") && task.truck?.category && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconTruck className="h-4 w-4" />
                      Categoria
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {TRUCK_CATEGORY_LABELS[task.truck.category]}
                    </span>
                  </div>
                )}

                {/* Truck Implement Type */}
                {sectionVisibility.isFieldVisible("implementType") && task.truck?.implementType && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconTruckLoading className="h-4 w-4" />
                      Tipo de Implemento
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {IMPLEMENT_TYPE_LABELS[task.truck.implementType]}
                    </span>
                  </div>
                )}

                {/* Truck Location/Spot */}
                {sectionVisibility.isFieldVisible("truckSpot") && task.truck?.spot && (
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
                {sectionVisibility.isFieldVisible("vehicle") && task.truck && truckDimensions && (
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
              {sectionVisibility.isFieldVisible("details") && task.details && (
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
          )}

              {/* Dates Card */}
              {sectionVisibility.isSectionVisible("dates") && (
              <Card className="border flex flex-col animate-in fade-in-50 duration-800">
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

                {/* Forecast */}
                {sectionVisibility.isFieldVisible("forecast") && task.forecastDate && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconCalendarTime className="h-4 w-4" />
                      Previsão
                    </span>
                    <span className="text-sm font-semibold text-foreground">{formatDateTime(task.forecastDate)}</span>
                  </div>
                )}

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
              )}

              {/* Pricing Card - Hidden for Warehouse sector users */}
              {sectionVisibility.isSectionVisible("pricing") && !isWarehouseSector && task.pricing && task.pricing.items && task.pricing.items.length > 0 && (() => {
                const statusConfig = {
                  DRAFT: { label: 'Rascunho', icon: IconClock, className: 'bg-gray-100 text-gray-700' },
                  APPROVED: { label: 'Aprovado', icon: IconCheck, className: 'bg-green-100 text-green-700' },
                  REJECTED: { label: 'Rejeitado', icon: IconX, className: 'bg-red-100 text-red-700' },
                  CANCELLED: { label: 'Cancelado', icon: IconBan, className: 'bg-gray-50 text-gray-600' },
                };
                const { label, icon: StatusIcon, className: statusClass } = statusConfig[task.pricing.status] || statusConfig.DRAFT;

                return (
                  <Card className="border flex flex-col animate-in fade-in-50 duration-825">
                    <CardHeader className="pb-6">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
          <IconFileInvoice className="h-5 w-5 text-muted-foreground" />
          Precificação Detalhada
        </CardTitle>
                        <Badge className={statusClass}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {label}
                        </Badge>
                      </div>
                    </CardHeader>
              <CardContent className="pt-0 flex-1">
                <div className="space-y-4">
                  {/* Pricing validity date */}
                  {task.pricing.expiresAt && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                  <IconCalendar className="h-4 w-4" />
                  <span>Validade: <span className="font-medium text-foreground">{formatDate(task.pricing.expiresAt)}</span></span>
                </div>
                  )}

                  {/* Pricing items table */}
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
                    {task.pricing.items.map((item, index) => (
                  <tr key={item.id || index} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm">{item.description}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {formatCurrency(
                        typeof item.amount === 'number' ? item.amount : Number(item.amount) || 0
                      )}
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
                  typeof task.pricing.total === 'number' ? task.pricing.total : Number(task.pricing.total) || 0
                    )}
                  </span>
                </div>
                  </div>
                </div>
              </CardContent>
                </Card>
                );
              })()}

              {/* Truck Layout Card - Only show if truck has at least one layout */}
              {sectionVisibility.isSectionVisible("layout") && task.truck && (task.truck.leftSideLayout || task.truck.rightSideLayout || task.truck.backSideLayout) && (
                <Card className="border flex flex-col animate-in fade-in-50 duration-850">
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
                <TruckLayoutPreview truckId={task.truck.id} taskName={taskDisplayName} />
              </CardContent>
                </Card>
              )}

              {/* Service Orders Card - Visibility based on sector privilege and service order type */}
              {sectionVisibility.isSectionVisible("serviceOrders") && hasVisibleServiceOrders && filteredServiceOrders.length > 0 && (() => {
                // Group service orders by type
                const groupedServiceOrders = filteredServiceOrders.reduce((acc, serviceOrder) => {
                  const type = serviceOrder.type as SERVICE_ORDER_TYPE;
                  if (!acc[type]) {
                    acc[type] = [];
                  }
                  acc[type].push(serviceOrder);
                  return acc;
                }, {} as Record<SERVICE_ORDER_TYPE, typeof filteredServiceOrders>);

                return (
                  <Card className="border flex flex-col animate-in fade-in-50 duration-900">
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
                  <div className="space-y-6">
                    {Object.entries(groupedServiceOrders).map(([type, orders]) => (
                      <div key={type} className="space-y-2">
                        {/* Group Header */}
                        <div className="flex items-center gap-2 pb-2 border-b">
                          <h3 className="text-sm font-semibold text-foreground">
                            {SERVICE_ORDER_TYPE_LABELS[type as SERVICE_ORDER_TYPE]}
                          </h3>
                          <Badge variant="outline" className="text-xs">
                            {orders.length}
                          </Badge>
                        </div>

                        {/* Service Orders in this group */}
                        {orders.map((serviceOrder) => (
                      <div key={serviceOrder.id} className="bg-muted/50 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold">{serviceOrder.description}</h4>
                          {/* Observation Indicator with HoverCard */}
                          {serviceOrder.observation && (
                            <HoverCard openDelay={100} closeDelay={100}>
                              <HoverCardTrigger asChild>
                                <button className="relative flex items-center justify-center h-6 w-6 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors">
                                  <IconNote className="h-4 w-4" />
                                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                                    !
                                  </span>
                                </button>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-72 p-3" side="top">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <IconNote className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Observação</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{serviceOrder.observation}</p>
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                          )}
                        </div>

                        {serviceOrder.assignedTo && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <IconUser className="h-3 w-3" />
                            <span>Responsável: {serviceOrder.assignedTo.name}</span>
                          </div>
                        )}

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

                          {/* Status Change Dropdown - Permission-based per service order type and assignment */}
                          <div className="flex items-center">
                        {(() => {
                          const isEditable = canEditServiceOrder(
                            userSectorPrivilege,
                            serviceOrder.type as SERVICE_ORDER_TYPE,
                            serviceOrder.assignedToId,
                            currentUser?.id
                          );

                          // Use Badge for read-only, Combobox for editable
                          if (!isEditable) {
                            const variant = getBadgeVariantFromStatus(serviceOrder.status, "SERVICE_ORDER");
                            return (
                              <Badge
                                variant={variant}
                                className="w-[200px] h-8 flex items-center justify-center text-sm font-medium"
                              >
                                {SERVICE_ORDER_STATUS_LABELS[serviceOrder.status as SERVICE_ORDER_STATUS]}
                              </Badge>
                            );
                          }

                          // Determine available status options based on service order type and user role
                          const isArtworkServiceOrder = serviceOrder.type === SERVICE_ORDER_TYPE.ARTWORK;
                          const isDesignerUser = userSectorPrivilege === SECTOR_PRIVILEGES.DESIGNER;
                          const isAdminUser = userSectorPrivilege === SECTOR_PRIVILEGES.ADMIN;

                          // Build status options:
                          // - ARTWORK + DESIGNER: PENDING, IN_PROGRESS, WAITING_APPROVE (no COMPLETED - must go through admin approval)
                          // - ADMIN: All statuses including CANCELLED
                          // - Others: PENDING, IN_PROGRESS, WAITING_APPROVE, COMPLETED (no CANCELLED)
                          const statusOptions: ComboboxOption[] = [
                            { value: SERVICE_ORDER_STATUS.PENDING, label: SERVICE_ORDER_STATUS_LABELS[SERVICE_ORDER_STATUS.PENDING] },
                            { value: SERVICE_ORDER_STATUS.IN_PROGRESS, label: SERVICE_ORDER_STATUS_LABELS[SERVICE_ORDER_STATUS.IN_PROGRESS] },
                          ];

                          // Add WAITING_APPROVE for ARTWORK service orders (or always for admin)
                          if (isArtworkServiceOrder || isAdminUser) {
                            statusOptions.push({
                              value: SERVICE_ORDER_STATUS.WAITING_APPROVE,
                              label: SERVICE_ORDER_STATUS_LABELS[SERVICE_ORDER_STATUS.WAITING_APPROVE],
                            });
                          }

                          // Add COMPLETED - but NOT for DESIGNER on ARTWORK service orders
                          if (!(isArtworkServiceOrder && isDesignerUser)) {
                            statusOptions.push({
                              value: SERVICE_ORDER_STATUS.COMPLETED,
                              label: SERVICE_ORDER_STATUS_LABELS[SERVICE_ORDER_STATUS.COMPLETED],
                            });
                          }

                          // Add CANCELLED only for ADMIN
                          if (isAdminUser) {
                            statusOptions.push({
                              value: SERVICE_ORDER_STATUS.CANCELLED,
                              label: SERVICE_ORDER_STATUS_LABELS[SERVICE_ORDER_STATUS.CANCELLED],
                            });
                          }

                          // Get trigger style based on current status (matching badge colors)
                          const getStatusTriggerClass = (status: string) => {
                            switch (status) {
                              case SERVICE_ORDER_STATUS.PENDING:
                                return "bg-neutral-500 text-white hover:bg-neutral-600 border-neutral-600";
                              case SERVICE_ORDER_STATUS.IN_PROGRESS:
                                return "bg-blue-700 text-white hover:bg-blue-800 border-blue-800";
                              case SERVICE_ORDER_STATUS.WAITING_APPROVE:
                                return "bg-purple-600 text-white hover:bg-purple-700 border-purple-700";
                              case SERVICE_ORDER_STATUS.COMPLETED:
                                return "bg-green-700 text-white hover:bg-green-800 border-green-800";
                              case SERVICE_ORDER_STATUS.CANCELLED:
                                return "bg-red-700 text-white hover:bg-red-800 border-red-800";
                              default:
                                return "";
                            }
                          };

                          return (
                            <Combobox
                              value={serviceOrder.status || undefined}
                              onValueChange={(newStatus) => handleServiceOrderStatusChange(serviceOrder.id, newStatus as SERVICE_ORDER_STATUS)}
                              options={statusOptions}
                              placeholder="Selecione o status"
                              searchable={false}
                              disabled={false}
                              className="w-[200px] h-8 rounded-md"
                              triggerClassName={cn(
                                "font-medium",
                                getStatusTriggerClass(serviceOrder.status)
                              )}
                            />
                          );
                        })()}
                          </div>
                        </div>
                      </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </CardContent>
                  </Card>
                );
              })()}

              {/* Cuts Card - Hidden for Financial sector users */}
              {sectionVisibility.isSectionVisible("cuts") && !isFinancialSector && cuts.length > 0 && (
                <Card className="border flex flex-col animate-in fade-in-50 duration-950 lg:col-span-1">
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
                            const zipFileName = `${taskDisplayName}${task.serialNumber ? `-${task.serialNumber}` : ''}-recortes.zip`;

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

              {/* Base Files Card - 1/2 width - Only for ADMIN, COMMERCIAL, LOGISTIC, DESIGNER */}
              {sectionVisibility.isSectionVisible("baseFiles") && canViewBaseFiles && task.baseFiles && task.baseFiles.length > 0 && (
                <Card className="border flex flex-col animate-in fade-in-50 duration-1000 lg:col-span-1">
                  <CardHeader className="pb-6">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <IconFiles className="h-5 w-5 text-muted-foreground" />
                        Arquivos Base
                        <Badge variant="secondary" className="ml-2">
                          {task.baseFiles?.length ?? 0}
                        </Badge>
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {(task.baseFiles?.length ?? 0) > 1 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const apiUrl = (window as any).__ANKAA_API_URL__ || (import.meta as any).env?.VITE_API_URL || "http://localhost:3030";
                              for (let i = 0; i < (task.baseFiles?.length ?? 0); i++) {
                                const file = task.baseFiles?.[i];
                                if (file) {
                                  const downloadUrl = `${apiUrl}/files/${file.id}/download`;
                                  window.open(downloadUrl, "_blank");
                                }
                                if (i < (task.baseFiles?.length ?? 0) - 1) {
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
                            variant={baseFilesViewMode === "list" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setBaseFilesViewMode("list")}
                            className="h-7 w-7 p-0"
                          >
                            <IconList className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant={baseFilesViewMode === "grid" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setBaseFilesViewMode("grid")}
                            className="h-7 w-7 p-0"
                          >
                            <IconLayoutGrid className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1">
                    <div className={cn(baseFilesViewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
                      {task.baseFiles?.map((file) => (
                        <FileItem
                          key={file.id}
                          file={file}
                          viewMode={baseFilesViewMode}
                          onPreview={handleBaseFileClick}
                          onDownload={handleDownload}
                          showActions
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Artworks Card - 1/2 width - Visibility based on sector privilege for ARTWORK type */}
              {sectionVisibility.isSectionVisible("artworks") && canViewServiceOrderType(userSectorPrivilege, SERVICE_ORDER_TYPE.ARTWORK) && task.artworks && task.artworks.length > 0 && (
                <Card className="border flex flex-col animate-in fade-in-50 duration-1000 lg:col-span-1">
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
                                const artwork = task.artworks?.[i];
                                if (artwork?.file) {
                                  const downloadUrl = `${apiUrl}/files/${artwork.file.id}/download`;
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
                {task.artworks?.filter(artwork => artwork.file).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                    <IconFiles className="h-12 w-12 mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma arte disponível no momento</p>
                    <p className="text-xs mt-1">As artes podem estar sendo processadas</p>
                  </div>
                ) : (
                  <div className={cn(artworksViewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
                    {task.artworks?.filter(artwork => artwork.file).map((artwork) => (
                      <div key={artwork.id} className="relative">
                        <FileItem
                          file={artwork.file!}
                          viewMode={artworksViewMode}
                          onPreview={handleArtworkFileClick}
                          onDownload={handleDownload}
                          showActions
                        />
                        {artwork.status && artwork.status !== 'DRAFT' && (
                          <div className="absolute top-2 right-2">
                            <Badge
                              variant={artwork.status === 'APPROVED' ? 'approved' : 'rejected'}
                              className="text-xs"
                            >
                              {artwork.status === 'APPROVED' ? 'Aprovado' : 'Reprovado'}
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
                </Card>
              )}

              {/* Documents Card - Budget, NFE, Receipt - Hidden for Warehouse sector users */}
              {sectionVisibility.isSectionVisible("documents") && !isWarehouseSector && ((task.budgets && task.budgets.length > 0) || (task.invoices && task.invoices.length > 0) || (task.receipts && task.receipts.length > 0)) && (
                <Card className="border flex flex-col animate-in fade-in-50 duration-1050">
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
              {sectionVisibility.isSectionVisible("paints") && (task.generalPainting || (task.logoPaints && task.logoPaints.length > 0)) && (
                <Card className="border flex flex-col animate-in fade-in-50 duration-1150">
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
                      {task.generalPainting?.code && (
                        <span className="text-xs font-mono text-muted-foreground">{task.generalPainting.code}</span>
                      )}
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
                      {groundPaint.code && (
                        <code className="text-xs font-mono text-muted-foreground">{groundPaint.code}</code>
                      )}
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
                      {paint.code && (
                        <span className="text-xs font-mono text-muted-foreground">{paint.code}</span>
                      )}
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
              {sectionVisibility.isSectionVisible("observation") && task.observation && (
                <Card className="border flex flex-col animate-in fade-in-50 duration-1200">
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
              {sectionVisibility.isSectionVisible("airbrushings") && airbrushings.length > 0 && (
                <Card className="border flex flex-col animate-in fade-in-50 duration-1250 lg:col-span-1">
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
            </div>

            {/* Changelog History - Hidden for Financial and Warehouse sector users */}
            {sectionVisibility.isSectionVisible("changelog") && !isFinancialSector && !isWarehouseSector && (
              <Card className="border flex flex-col animate-in fade-in-50 duration-1300">
                <TaskWithServiceOrdersChangelog
                  taskId={task.id}
                  taskName={taskDisplayName}
                  taskCreatedAt={task.createdAt}
                  serviceOrderIds={task.services?.map(s => s.id) || []}
                  truckId={task.truck?.id}
                  layoutIds={[
                    task.truck?.leftSideLayoutId,
                    task.truck?.rightSideLayoutId,
                    task.truck?.backSideLayoutId,
                  ].filter(Boolean) as string[]}
                  className="h-full"
                />
              </Card>
            )}
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
                    <span className="font-medium">{taskDisplayName}</span>
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
    </PrivilegeRoute>
  );
};

export default TaskDetailsPage;
