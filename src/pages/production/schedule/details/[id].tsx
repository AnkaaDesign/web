import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/contexts/theme-context";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useTaskDetail, useTaskMutations, useServiceOrderMutations, useCutsByTask, useLayoutsByTruck, useCurrentUser, useAirbrushingsByTask, useForecastHistory } from "../../../../hooks";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, getBadgeVariantFromStatus } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import type { ComboboxOption } from "@/components/ui/combobox";
import {
  SECTOR_PRIVILEGES,
  routes,
  TASK_STATUS,
  TASK_STATUS_LABELS,
  SERVICE_ORDER_STATUS,
  SERVICE_ORDER_TYPE_LABELS,
  PAINT_FINISH,
  ENTITY_BADGE_CONFIG,
  PAINT_FINISH_LABELS,
  TRUCK_MANUFACTURER_LABELS,
  SERVICE_ORDER_STATUS_LABELS,
  AIRBRUSHING_STATUS_LABELS,
  COMMISSION_STATUS_LABELS,
  TRUCK_CATEGORY_LABELS,
  IMPLEMENT_TYPE_LABELS,
} from "../../../../constants";
import { formatDate, formatDateTime, formatCurrency, formatChassis, formatTruckSpot, isValidTaskStatusTransition, hasPrivilege } from "../../../../utils";
import { ForecastHistoryTimeline } from "@/components/production/task/form/forecast-history-timeline";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { isTeamLeader } from "@/utils/user";
import { canEditTasks } from "@/utils/permissions/entity-permissions";
import { canCancelServiceOrder, canEditServiceOrder, getVisibleServiceOrderTypes } from "@/utils/permissions/service-order-permissions";
import { canViewQuote, canEditQuote, canUpdateQuoteStatus, getAvailableQuoteStatusTransitions } from "@/utils/permissions/quote-permissions";
import { QuoteStatusBadge } from "@/components/production/task/quote/quote-status-badge";
import { InstallmentStatusBadge } from "@/components/production/task/billing/installment-status-badge";
import { BankSlipStatusBadge } from "@/components/production/task/billing/bank-slip-status-badge";
import { BoletoActions } from "@/components/production/task/billing/boleto-actions";
import { NfseStatusBadge } from "@/components/production/task/billing/nfse-status-badge";
import { NfseActions } from "@/components/production/task/billing/nfse-actions";
import { NfseEnrichedInfo } from "@/components/production/task/billing/nfse-enriched-info";
import { useInvoicesByTask } from "@/hooks/production/use-invoice";
import { invoiceService } from "@/api-client/invoice";
import { nfseService } from "@/api-client/nfse";
import type { Invoice } from "@/types/invoice";
import { taskQuoteService } from "@/api-client/task-quote";
import type { TASK_QUOTE_STATUS } from "@/types/task-quote";
import { isTaskQuoteBillingPhase } from "@/constants/enum-labels";
import { generatePaymentText, generateGuaranteeText } from "@/utils/quote-text-generators";
import { getApiBaseUrl, rewriteCdnUrl } from "@/utils/file";
import { exportDossiePdf } from "@/utils/dossie-pdf-generator";
import { SERVICE_ORDER_TYPE, SERVICE_ORDER_TYPE_DISPLAY_ORDER } from "../../../../constants";
import { RESPONSIBLE_ROLE_LABELS, ResponsibleRole } from "@/types/responsible";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { LoadingSpinner } from "@/components/ui/loading";
import { TaskWithServiceOrdersChangelog } from "@/components/ui/task-with-service-orders-changelog";
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
  IconFile,
  IconFileText,
  IconFileInvoice,
  IconPaint,
  IconFiles,
  IconAlertCircle,
  IconTruck,
  IconHash,
  IconCar,
  IconHome,
  IconBrush,
  IconTruckLoading,
  IconCut,
  IconSpray,
  IconDownload,
  IconLoader2,
  IconLayoutGrid,
  IconBarcode,
  IconList,
  IconCoin,
  IconMapPin,
  IconLayersIntersect,
  IconCalendarTime,
  IconBrandWhatsapp,
  IconNote,
  IconRuler,
  IconCreditCard,
  IconShieldCheck,
  IconPhoto,
  IconWriting,
  IconReceipt,
  IconZoomIn,
  IconZoomOut,
  IconZoomReset,
  IconChevronLeft,
  IconChevronRight,
  IconFolderCheck,
  IconCameraCheck,
  IconCameraBolt,
  IconEye,
} from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CanvasNormalMapRenderer } from "@/components/painting/effects/canvas-normal-map-renderer";
import { useSectionVisibility } from "@/hooks/common/use-section-visibility";
import type { SectionConfig } from "@/hooks/common/use-section-visibility";
import { SectionVisibilityManager } from "@/components/ui/section-visibility-manager";

// Paint badge style - unified neutral, more subtle (no icons)
const PAINT_BADGE_STYLE = "bg-neutral-200/70 text-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-300 hover:bg-neutral-200/70 hover:text-neutral-600 dark:hover:bg-neutral-700/50 dark:hover:text-neutral-300 border-0";
import { FileItem, useFileViewer, type FileViewMode } from "@/components/common/file";
import type { File as CustomFile } from "@/types/file";

// Component to display truck layout SVG preview
const TruckLayoutPreview = ({ truckId, taskName }: { truckId: string; taskName?: string }) => {
  const { data: layouts } = useLayoutsByTruck(truckId, { includePhoto: true });
  const [selectedSide, setSelectedSide] = useState<'left' | 'right' | 'back'>('left');

  // Theme detection for SVG colors (matching mobile version)
  const { theme } = useTheme();
  const isDark = useMemo(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return theme === 'dark';
  }, [theme]);

  // Theme-aware SVG colors matching mobile version
  const svgColors = useMemo(() => ({
    stroke: isDark ? '#e5e5e5' : '#171717',
    divider: isDark ? '#a3a3a3' : '#525252',
    dimension: isDark ? '#60a5fa' : '#0066cc',
  }), [isDark]);

  // Zoom state
  const [zoomScale, setZoomScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, translateX: 0, translateY: 0 });
  const zoomContainerRef = useRef<HTMLDivElement>(null);

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 3;

  // Zoom control functions
  const handleZoomIn = useCallback(() => {
    setZoomScale(prev => Math.min(prev + 0.5, MAX_SCALE));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomScale(prev => Math.max(prev - 0.5, MIN_SCALE));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomScale(1);
    setTranslateX(0);
    setTranslateY(0);
  }, []);

  // Mouse wheel zoom handler - uses native event to properly prevent scroll
  const handleWheelZoom = useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.25 : 0.25; // Fast zoom
    setZoomScale(prev => Math.min(Math.max(prev + delta, MIN_SCALE), MAX_SCALE));
  }, []);

  // Attach wheel event listener with passive: false to prevent page scroll
  // Note: We depend on `layouts` because the container ref isn't available until layouts load
  // (component returns null while loading, so the ref doesn't exist yet)
  useEffect(() => {
    const container = zoomContainerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheelZoom);
    };
  }, [handleWheelZoom, layouts]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      translateX,
      translateY,
    };
  }, [translateX, translateY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    setTranslateX(dragStartRef.current.translateX + deltaX);
    setTranslateY(dragStartRef.current.translateY + deltaY);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Reset zoom when side changes - need to use useEffect but component can return early
  // So we'll handle this in the side button click handlers instead

  if (!layouts) return null;

  const hasLayouts = layouts.leftSideLayout || layouts.rightSideLayout || layouts.backSideLayout;
  if (!hasLayouts) return null;

  // Get current layout
  const currentLayout = selectedSide === 'left' ? layouts.leftSideLayout :
                       selectedSide === 'right' ? layouts.rightSideLayout :
                       layouts.backSideLayout;

  if (!currentLayout) return null;

  // Generate SVG preview - uses theme colors for display, black for export
  const generatePreviewSVG = (layout: any, side: string, forExport: boolean = false) => {
    const getSideLabel = (s: string) => {
      switch (s) {
        case 'left': return 'Motorista';
        case 'right': return 'Sapo';
        case 'back': return 'Traseira';
        default: return s;
      }
    };

    // Use theme colors for display, black for export
    const colors = forExport ? {
      stroke: '#000000',
      divider: '#333333',
      dimension: '#0066cc',
    } : svgColors;

    const height = layout.height * 100;
    const sections = layout.layoutSections;
    const totalWidth = sections.reduce((sum: number, s: any) => sum + s.width * 100, 0);

    // For export: use cm values as mm (no scaling - 840cm becomes 840mm in SVG)
    const margin = forExport ? 50 : 50;
    const extraSpace = forExport ? 100 : 50;
    const scaleFactor = 1; // No scaling - cm values used directly as mm
    const strokeWidth = forExport ? 1 : 1;
    const fontSize = forExport ? 12 : 12;
    const arrowSize = forExport ? 5 : 5;

    const scaledWidth = totalWidth * scaleFactor;
    const scaledHeight = height * scaleFactor;
    const svgWidth = scaledWidth + margin * 2 + extraSpace;
    const svgHeight = scaledHeight + margin * 2 + extraSpace;

    let svg = forExport
      ? `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgWidth}mm" height="${svgHeight}mm" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <text x="${margin}" y="25" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="${colors.stroke}">${getSideLabel(side)}</text>`
      : `<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">`;

    svg += `
  <rect x="${margin}" y="${margin}" width="${scaledWidth}" height="${scaledHeight}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>`;

    // Section dividers using path
    let currentPos = 0;
    sections.forEach((section: any, index: number) => {
      const sectionWidth = section.width * 100 * scaleFactor;
      if (index > 0) {
        const prevSection = sections[index - 1];
        if (!section.isDoor && !prevSection.isDoor) {
          const lineX = margin + currentPos;
          svg += `
  <path d="M${lineX},${margin} L${lineX},${margin + scaledHeight}" fill="none" stroke="${colors.divider}" stroke-width="${strokeWidth * 0.5}"/>`;
        }
      }
      currentPos += sectionWidth;
    });

    // Doors using path
    if (layout.doors && layout.doors.length > 0) {
      layout.doors.forEach((door: any) => {
        const doorX = margin + (door.position || 0) * 100 * scaleFactor;
        const doorWidth = (door.width || 0) * 100 * scaleFactor;
        const doorOffsetTop = (door.offsetTop || door.topOffset || 0) * 100 * scaleFactor;
        const doorY = margin + doorOffsetTop;
        const doorBottomY = margin + scaledHeight;
        svg += `
  <path d="M${doorX},${doorY} L${doorX},${doorBottomY}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>
  <path d="M${doorX + doorWidth},${doorY} L${doorX + doorWidth},${doorBottomY}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>
  <path d="M${doorX},${doorY} L${doorX + doorWidth},${doorY}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>`;
      });
    } else if (layout.layoutSections) {
      let currentPos = 0;
      layout.layoutSections.forEach((section: any) => {
        const sectionWidth = section.width * 100 * scaleFactor;
        const sectionX = margin + currentPos;
        if (section.isDoor && section.doorHeight !== null && section.doorHeight !== undefined) {
          const doorHeightCm = section.doorHeight * 100 * scaleFactor;
          const doorTopY = margin + (scaledHeight - doorHeightCm);
          const doorBottomY = margin + scaledHeight;
          svg += `
  <path d="M${sectionX},${doorTopY} L${sectionX},${doorBottomY}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>
  <path d="M${sectionX + sectionWidth},${doorTopY} L${sectionX + sectionWidth},${doorBottomY}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>
  <path d="M${sectionX},${doorTopY} L${sectionX + sectionWidth},${doorTopY}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>`;
        }
        currentPos += sectionWidth;
      });
    }

    // Width dimensions using path
    currentPos = 0;
    sections.forEach((section: any) => {
      const sectionWidth = section.width * 100 * scaleFactor;
      const startX = margin + currentPos;
      const endX = margin + currentPos + sectionWidth;
      const centerX = startX + sectionWidth / 2;
      const dimY = margin + scaledHeight + 20;
      svg += `
  <path d="M${startX},${dimY} L${endX},${dimY}" fill="none" stroke="${colors.dimension}" stroke-width="${strokeWidth}"/>
  <path d="M${startX},${dimY} L${startX + arrowSize},${dimY - arrowSize * 0.6} L${startX + arrowSize},${dimY + arrowSize * 0.6} Z" fill="${colors.dimension}" stroke="none"/>
  <path d="M${endX},${dimY} L${endX - arrowSize},${dimY - arrowSize * 0.6} L${endX - arrowSize},${dimY + arrowSize * 0.6} Z" fill="${colors.dimension}" stroke="none"/>
  <text x="${centerX}" y="${dimY + fontSize * 1.25}" font-family="Arial, sans-serif" font-size="${fontSize}" text-anchor="middle" fill="${colors.dimension}">${Math.round(section.width * 100)}</text>`;
      currentPos += sectionWidth;
    });

    // Height dimension using path (no transform)
    const dimX = margin - 20;
    svg += `
  <path d="M${dimX},${margin} L${dimX},${margin + scaledHeight}" fill="none" stroke="${colors.dimension}" stroke-width="${strokeWidth}"/>
  <path d="M${dimX},${margin} L${dimX - arrowSize * 0.6},${margin + arrowSize} L${dimX + arrowSize * 0.6},${margin + arrowSize} Z" fill="${colors.dimension}" stroke="none"/>
  <path d="M${dimX},${margin + scaledHeight} L${dimX - arrowSize * 0.6},${margin + scaledHeight - arrowSize} L${dimX + arrowSize * 0.6},${margin + scaledHeight - arrowSize} Z" fill="${colors.dimension}" stroke="none"/>
  <text x="${dimX - fontSize * 1.25}" y="${margin + scaledHeight / 2 + 4}" font-family="Arial, sans-serif" font-size="${fontSize}" text-anchor="middle" fill="${colors.dimension}" writing-mode="tb">${Math.round(height)}</text>
</svg>`;

    return svg;
  };

  // Generate a single SVG element for one layout (used in combined SVG for export)
  // Uses <path> instead of <line> and avoids transforms to prevent CorelDRAW locking
  // All values use cm values as mm (no scaling - 840cm becomes 840mm)
  const generateLayoutElement = (layout: any, side: string, offsetX: number, offsetY: number) => {
    const getSideLabel = (s: string) => {
      switch (s) {
        case 'left': return 'Motorista';
        case 'right': return 'Sapo';
        case 'back': return 'Traseira';
        default: return s;
      }
    };

    // Export uses cm values as mm (no scaling)
    const height = layout.height * 100;
    const sections = layout.layoutSections;
    const totalWidth = sections.reduce((sum: number, s: any) => sum + s.width * 100, 0);
    const margin = 50; // 50mm margin
    const strokeWidth = 1;
    const fontSize = 12;
    const arrowSize = 5;

    const ox = offsetX;
    const oy = offsetY;

    // Export colors - always black
    const colors = {
      stroke: '#000000',
      divider: '#333333',
      dimension: '#0066cc',
    };

    let svg = `
  <text x="${ox + margin}" y="${oy + 25}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="${colors.stroke}">${getSideLabel(side)}</text>
  <rect x="${ox + margin}" y="${oy + margin}" width="${totalWidth}" height="${height}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>`;

    // Add section dividers using path
    let currentPos = 0;
    sections.forEach((section: any, index: number) => {
      const sectionWidth = section.width * 100;
      if (index > 0) {
        const prevSection = sections[index - 1];
        if (!section.isDoor && !prevSection.isDoor) {
          const lineX = ox + margin + currentPos;
          svg += `
  <path d="M${lineX},${oy + margin} L${lineX},${oy + margin + height}" fill="none" stroke="${colors.divider}" stroke-width="${strokeWidth * 0.5}"/>`;
        }
      }
      currentPos += sectionWidth;
    });

    // Add doors using path
    currentPos = 0;
    sections.forEach((section: any) => {
      const sectionWidth = section.width * 100;
      const sectionX = ox + margin + currentPos;
      if (section.isDoor && section.doorHeight !== null && section.doorHeight !== undefined) {
        const doorHeightMm = section.doorHeight * 100;
        const doorTopY = oy + margin + (height - doorHeightMm);
        const doorBottomY = oy + margin + height;
        svg += `
  <path d="M${sectionX},${doorTopY} L${sectionX},${doorBottomY}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>
  <path d="M${sectionX + sectionWidth},${doorTopY} L${sectionX + sectionWidth},${doorBottomY}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>
  <path d="M${sectionX},${doorTopY} L${sectionX + sectionWidth},${doorTopY}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>`;
      }
      currentPos += sectionWidth;
    });

    // Add width dimensions using path (labels show cm values)
    currentPos = 0;
    sections.forEach((section: any) => {
      const sectionWidthMm = section.width * 100;
      const startX = ox + margin + currentPos;
      const endX = ox + margin + currentPos + sectionWidthMm;
      const centerX = startX + sectionWidthMm / 2;
      const dimY = oy + margin + height + 20;
      svg += `
  <path d="M${startX},${dimY} L${endX},${dimY}" fill="none" stroke="${colors.dimension}" stroke-width="${strokeWidth}"/>
  <path d="M${startX},${dimY} L${startX + arrowSize},${dimY - arrowSize * 0.6} L${startX + arrowSize},${dimY + arrowSize * 0.6} Z" fill="${colors.dimension}" stroke="none"/>
  <path d="M${endX},${dimY} L${endX - arrowSize},${dimY - arrowSize * 0.6} L${endX - arrowSize},${dimY + arrowSize * 0.6} Z" fill="${colors.dimension}" stroke="none"/>
  <text x="${centerX}" y="${dimY + fontSize * 1.25}" font-family="Arial, sans-serif" font-size="${fontSize}" text-anchor="middle" fill="${colors.dimension}">${Math.round(section.width * 100)}</text>`;
      currentPos += sectionWidthMm;
    });

    // Height dimension using path (label shows cm value)
    const dimX = ox + margin - 20;
    const dimTopY = oy + margin;
    const dimBottomY = oy + margin + height;
    svg += `
  <path d="M${dimX},${dimTopY} L${dimX},${dimBottomY}" fill="none" stroke="${colors.dimension}" stroke-width="${strokeWidth}"/>
  <path d="M${dimX},${dimTopY} L${dimX - arrowSize * 0.6},${dimTopY + arrowSize} L${dimX + arrowSize * 0.6},${dimTopY + arrowSize} Z" fill="${colors.dimension}" stroke="none"/>
  <path d="M${dimX},${dimBottomY} L${dimX - arrowSize * 0.6},${dimBottomY - arrowSize} L${dimX + arrowSize * 0.6},${dimBottomY - arrowSize} Z" fill="${colors.dimension}" stroke="none"/>
  <text x="${dimX - fontSize * 1.25}" y="${oy + margin + height / 2 + 4}" font-family="Arial, sans-serif" font-size="${fontSize}" text-anchor="middle" fill="${colors.dimension}" writing-mode="tb">${Math.round(layout.height * 100)}</text>`;

    return svg;
  };

  // Calculate dimensions for a layout element (in mm for export)
  // Uses cm values as mm (no scaling - 840cm becomes 840mm)
  const getLayoutDimensions = (layout: any) => {
    const height = layout.height * 100;
    const sections = layout.layoutSections;
    const totalWidth = sections.reduce((sum: number, s: any) => sum + s.width * 100, 0);
    const margin = 50; // 50mm margin
    const extraSpace = 50; // Space for dimensions
    return {
      width: totalWidth + margin * 2 + extraSpace,
      height: height + margin * 2 + extraSpace
    };
  };

  // Generate combined SVG with all layouts (uses cm values as mm)
  const generateCombinedSVG = () => {
    const gap = 50; // 50mm gap between layouts
    const margin = 30; // 30mm overall margin

    // Calculate dimensions for each layout
    const leftDims = layouts.leftSideLayout ? getLayoutDimensions(layouts.leftSideLayout) : null;
    const rightDims = layouts.rightSideLayout ? getLayoutDimensions(layouts.rightSideLayout) : null;
    const backDims = layouts.backSideLayout ? getLayoutDimensions(layouts.backSideLayout) : null;

    // Calculate total SVG dimensions
    // Left column: Motorista on top, Sapo below
    const leftColumnWidth = Math.max(leftDims?.width || 0, rightDims?.width || 0);
    const leftColumnHeight = (leftDims?.height || 0) + (rightDims ? gap + (rightDims?.height || 0) : 0);

    // Right column: Traseira aligned with top
    const rightColumnWidth = backDims?.width || 0;
    const rightColumnHeight = backDims?.height || 0;

    const totalWidth = margin * 2 + leftColumnWidth + (backDims ? gap + rightColumnWidth : 0);
    const totalHeight = margin * 2 + Math.max(leftColumnHeight, rightColumnHeight);

    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${totalWidth}mm" height="${totalHeight}mm" viewBox="0 0 ${totalWidth} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">`;

    // Add Motorista (left side) at top-left
    if (layouts.leftSideLayout) {
      svg += generateLayoutElement(layouts.leftSideLayout, 'left', margin, margin);
    }

    // Add Sapo (right side) below Motorista, left-aligned
    if (layouts.rightSideLayout) {
      const offsetY = margin + (leftDims?.height || 0) + gap;
      svg += generateLayoutElement(layouts.rightSideLayout, 'right', margin, offsetY);
    }

    // Add Traseira (back side) next to Motorista, top-aligned
    if (layouts.backSideLayout) {
      const offsetX = margin + leftColumnWidth + gap;
      svg += generateLayoutElement(layouts.backSideLayout, 'back', offsetX, margin);
    }

    svg += `
</svg>`;

    return svg;
  };

  const downloadSVG = () => {
    if (!currentLayout) return;

    const svgContent = generatePreviewSVG(currentLayout, selectedSide, true); // forExport = true
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
    // Filename shows mm (cm values used directly as mm)
    link.download = `${taskPrefix}layout-${getSideLabel(selectedSide)}-${Math.round(totalWidth)}mm.svg`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Calculate dimensions from current layout
  const getDimensions = () => {
    if (currentLayout?.height && currentLayout?.layoutSections?.length > 0) {
      const totalWidth = currentLayout.layoutSections.reduce((sum: number, section: any) => sum + (section.width || 0), 0);
      return { width: totalWidth, height: currentLayout.height };
    }
    return null;
  };
  const dimensions = getDimensions();

  return (
    <div className="space-y-4">
      {/* Side selector and dimensions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={selectedSide === 'left' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setSelectedSide('left'); handleResetZoom(); }}
            disabled={!layouts.leftSideLayout}
          >
            Motorista
          </Button>
          <Button
            type="button"
            variant={selectedSide === 'right' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setSelectedSide('right'); handleResetZoom(); }}
            disabled={!layouts.rightSideLayout}
          >
            Sapo
          </Button>
          <Button
            type="button"
            variant={selectedSide === 'back' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setSelectedSide('back'); handleResetZoom(); }}
            disabled={!layouts.backSideLayout}
            className="gap-1"
          >
            Traseira
            {(layouts.backSideLayout as any)?.photo && (
              <IconPhoto className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        {/* Dimensions */}
        {dimensions && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <IconRuler className="h-4 w-4" />
            <span>Medidas: <span className="font-medium text-foreground">{Math.round(dimensions.width * 100)} x {Math.round(dimensions.height * 100)} cm</span></span>
          </div>
        )}
      </div>

      {/* SVG Preview with Zoom Controls */}
      {currentLayout && (
        <div className="border border-border rounded-lg bg-background/50 backdrop-blur-sm">
          {/* Zoom Controls */}
          <div className="flex justify-end items-center gap-1 p-2 border-b border-border/30">
            <span className="text-xs text-muted-foreground mr-2">
              {Math.round(zoomScale * 100)}%
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoomScale <= MIN_SCALE}
              className="h-8 w-8 p-0"
            >
              <IconZoomOut size={18} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetZoom}
              className="h-8 w-8 p-0"
            >
              <IconZoomReset size={18} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoomScale >= MAX_SCALE}
              className="h-8 w-8 p-0"
            >
              <IconZoomIn size={18} />
            </Button>
          </div>

          {/* Zoomable Container */}
          <div
            ref={zoomContainerRef}
            className="overflow-hidden cursor-grab active:cursor-grabbing select-none"
            style={{ minHeight: '300px' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              className="p-8 flex items-center justify-center min-h-[300px]"
              style={{
                transform: `scale(${zoomScale}) translate(${translateX / zoomScale}px, ${translateY / zoomScale}px)`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.2s ease-out',
              }}
            >
              <div
                dangerouslySetInnerHTML={{
                  __html: generatePreviewSVG(currentLayout, selectedSide, false) // forExport = false (use theme colors)
                }}
                className="w-full max-w-full [&>svg]:mx-auto [&>svg]:block [&>svg]:w-auto [&>svg]:h-auto [&>svg]:max-w-full [&>svg]:max-h-[400px]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Download buttons */}
      <div className="flex gap-2 justify-end">
        {/* Download all layouts - combined SVG or ZIP with photo */}
        <Button
          onClick={async () => {
            const apiUrl = getApiBaseUrl();
            const taskPrefix = taskName ? `${taskName}-` : '';

            // Generate combined SVG with all layouts
            const combinedSvgContent = generateCombinedSVG();

            // Check if backside has a photo
            const hasBacksidePhoto = layouts.backSideLayout?.photo;

            if (hasBacksidePhoto) {
              // Create ZIP with combined SVG + backside photo
              const JSZip = (await import('jszip')).default;
              const zip = new JSZip();

              // Add combined SVG
              zip.file(`${taskPrefix}layouts.svg`, combinedSvgContent);

              // Add backside photo
              try {
                if (layouts.backSideLayout?.photo?.id) {
                  const photoUrl = `${apiUrl}/files/${layouts.backSideLayout.photo.id}/download`;
                  const response = await fetch(photoUrl);
                  if (response.ok) {
                    const blob = await response.blob();
                    const extension = layouts.backSideLayout.photo.mimeType?.split('/')[1] || 'jpg';
                    zip.file(`${taskPrefix}layout-traseira-foto.${extension}`, blob);
                  }
                }
              } catch (error) {
                console.error('Error downloading backside photo:', error);
              }

              // Generate zip and download
              const content = await zip.generateAsync({ type: 'blob' });
              const url = URL.createObjectURL(content);
              const link = document.createElement('a');
              link.href = url;
              link.download = `${taskPrefix}layouts.zip`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            } else {
              // No backside photo - download combined SVG directly
              const blob = new Blob([combinedSvgContent], { type: 'image/svg+xml' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `${taskPrefix}layouts.svg`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }
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
              const apiUrl = getApiBaseUrl();
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
      { id: "responsibles", label: "Responsáveis", sectionId: "overview" },
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
      { id: "finishedAt", label: "Finalizado Em", sectionId: "overview" },
      { id: "invoiceToCustomers", label: "Faturar Para", sectionId: "overview" },
    ],
  },
  {
    id: "dates",
    label: "Datas",
    defaultVisible: true,
    fields: [
      { id: "created", label: "Criado", sectionId: "dates" },
      { id: "forecast", label: "Previsão de Liberação", sectionId: "dates" },
      { id: "entry", label: "Entrada", sectionId: "dates" },
      { id: "term", label: "Prazo", sectionId: "dates" },
      { id: "started", label: "Iniciado", sectionId: "dates" },
      { id: "finished", label: "Finalizado", sectionId: "dates" },
    ],
  },
  {
    id: "quote",
    label: "Orçamento / Faturamento",
    defaultVisible: true,
    fields: [
      { id: "quoteItems", label: "Itens do Orçamento", sectionId: "quote" },
      { id: "totalValue", label: "Valor Total", sectionId: "quote" },
    ],
  },
  {
    id: "layout",
    label: "Medidas do Caminhão",
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
    id: "artworks",
    label: "Layouts",
    defaultVisible: true,
    fields: [
      { id: "artworkFiles", label: "Arquivos de Layout", sectionId: "artworks" },
    ],
  },
  {
    id: "files",
    label: "Arquivos",
    defaultVisible: true,
    fields: [
      { id: "baseFileFiles", label: "Arquivos Base", sectionId: "files" },
      { id: "projectFileFiles", label: "Projetos", sectionId: "files" },
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
    id: "dossie",
    label: "Dossiê",
    defaultVisible: true,
    fields: [
      { id: "dossieContent", label: "Registros por Ordem de Serviço", sectionId: "dossie" },
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

function ForecastHistoryCollapsible({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false);
  const { data } = useForecastHistory(taskId);
  const entries = (data?.data ?? []) as any[];

  // Show when there are actual reschedules (non-INITIAL entries)
  const hasReschedules = entries.some((e: any) => e.source !== 'INITIAL');
  if (!hasReschedules) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="h-auto px-4 py-1 text-xs text-muted-foreground hover:text-foreground">
          {open ? "Ocultar historico" : "Ver historico de reagendamentos"}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pt-1 pb-2">
        <ForecastHistoryTimeline taskId={taskId} />
      </CollapsibleContent>
    </Collapsible>
  );
}

export const TaskDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const { update } = useTaskMutations();
  const { update: updateServiceOrder } = useServiceOrderMutations();
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusChangeDialogOpen, setStatusChangeDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TASK_STATUS | null>(null);
  const [filesViewMode, setFilesViewMode] = useState<FileViewMode>("grid");
  const [artworksViewMode, setArtworksViewMode] = useState<FileViewMode>("grid");
  const [quoteCustomerFilter, setQuoteCustomerFilter] = useState<string | null>(null);
  const [isUpdatingQuoteStatus, setIsUpdatingQuoteStatus] = useState(false);
  const [quoteConfirmDialog, setQuoteConfirmDialog] = useState<{
    open: boolean;
    newStatus: string;
    currentStatus: string;
    title: string;
    description: string;
  }>({ open: false, newStatus: '', currentStatus: '', title: '', description: '' });
  // Reject-reason dialog used when downgrading any non-PENDING status to PENDING.
  const [rejectDialog, setRejectDialog] = useState<{
    open: boolean;
    newStatus: string;
    reason: string;
  }>({ open: false, newStatus: '', reason: '' });
  // Get user's sector privilege for service order permissions
  const userSectorPrivilege = currentUser?.sector?.privileges as SECTOR_PRIVILEGES | undefined;

  // Check if user is from Financial sector (for other UI elements)
  const isFinancialSector = currentUser ? hasPrivilege(currentUser, SECTOR_PRIVILEGES.FINANCIAL) && currentUser.sector?.privileges === SECTOR_PRIVILEGES.FINANCIAL : false;

  // Check if user is from Warehouse sector (should hide documents, budgets, and changelog)
  const isWarehouseSector = currentUser?.sector?.privileges === SECTOR_PRIVILEGES.WAREHOUSE;

  // Check if user is from Production sector (for changelog visibility)
  const isProductionSector = currentUser?.sector?.privileges === SECTOR_PRIVILEGES.PRODUCTION;

  // Check if user is from Designer sector (for responsible filtering)
  const isDesignerSector = currentUser?.sector?.privileges === SECTOR_PRIVILEGES.DESIGNER;

  // Check if user can view base files (ADMIN, COMMERCIAL, LOGISTIC, DESIGNER only)
  const canViewBaseFiles = currentUser && (
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.COMMERCIAL) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.LOGISTIC) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.DESIGNER)
  );

  // Check if user can view project files (ADMIN, COMMERCIAL, LOGISTIC, DESIGNER only)
  const canViewProjectFiles = currentUser && (
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.COMMERCIAL) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.LOGISTIC) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.DESIGNER)
  );
  // Check if user can view checkin files (ADMIN, COMMERCIAL, FINANCIAL, LOGISTIC only)
  const canViewCheckinFiles = currentUser && (
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.COMMERCIAL) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.FINANCIAL) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.LOGISTIC) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.PRODUCTION_MANAGER)
  );
  // Check if user can view artwork badges and non-approved artworks (ADMIN, COMMERCIAL, FINANCIAL, LOGISTIC, DESIGNER only)
  const canViewArtworkBadges = currentUser && (
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.COMMERCIAL) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.FINANCIAL) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.LOGISTIC) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.DESIGNER)
  );

  // Check if user can view restricted fields (forecastDate, responsibles) - ADMIN, COMMERCIAL, FINANCIAL, LOGISTIC, DESIGNER only
  const canViewRestrictedFields = canViewArtworkBadges;

  // Get visible service order types based on user's sector privilege
  const visibleServiceOrderTypes = useMemo(
    () => getVisibleServiceOrderTypes(userSectorPrivilege),
    [userSectorPrivilege]
  );

  // Check if user has any visible service order types
  const hasVisibleServiceOrders = visibleServiceOrderTypes.length > 0;

  // Check if user can access customer pages (ADMIN, FINANCIAL, LOGISTIC, COMMERCIAL)
  const canAccessCustomerPages = currentUser && (
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.FINANCIAL) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.LOGISTIC) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.COMMERCIAL)
  );

  // Check if user can view airbrushing financial data (FINANCIAL or ADMIN only)
  const canViewAirbrushingFinancials = currentUser && (hasPrivilege(currentUser, SECTOR_PRIVILEGES.FINANCIAL) || hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN));

  // Check if user can access airbrushing details page (ADMIN, FINANCIAL, or COMMERCIAL only)
  const canAccessAirbrushingDetails = currentUser && (
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.FINANCIAL) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.COMMERCIAL)
  );

  // Check if user can edit tasks (PRODUCTION, LEADER, ADMIN)
  const canEdit = canEditTasks(currentUser ?? null);

  // Check if user can view quote (ADMIN, FINANCIAL, COMMERCIAL only)
  const canViewQuoteSection = canViewQuote(currentUser?.sector?.privileges || '');
  const canEditQuoteSection = canEditQuote(currentUser?.sector?.privileges || '');
  const canChangeQuoteStatus = canUpdateQuoteStatus(currentUser?.sector?.privileges || '');

  // Fetch invoice data for inline boleto/NFS-e display in quote section (only for roles that can view quotes)
  const { data: invoiceResponse } = useInvoicesByTask(canViewQuoteSection ? id! : "");
  const invoices: Invoice[] = useMemo(() => {
    const data = invoiceResponse?.data;
    return Array.isArray(data) ? data : (data ? [data] : []);
  }, [invoiceResponse]);

  // Check if user can view commission field - ADMIN, FINANCIAL, COMMERCIAL, PRODUCTION only
  // (Production users receive commission, so they need to see it)
  const canViewCommissionField = currentUser && (
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.FINANCIAL) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.COMMERCIAL) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.PRODUCTION)
  );

  // Fields that should only be visible to users who can view commission (ADMIN, FINANCIAL, COMMERCIAL, PRODUCTION)
  const COMMISSION_RESTRICTED_FIELDS = ['commission'];

  // Fields that should only be visible to privileged users (ADMIN, FINANCIAL, COMMERCIAL, LOGISTIC, DESIGNER only)
  // Includes: forecastDate, responsibles
  const PRIVILEGED_RESTRICTED_FIELDS = ['responsibles', 'forecast'];

  // Check if user can view layout section (ADMIN, LOGISTIC, PRODUCTION_MANAGER, or PRODUCTION team leaders only)
  const canViewLayoutSection = currentUser && (
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.LOGISTIC) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.PRODUCTION_MANAGER) ||
    (isProductionSector && isTeamLeader(currentUser))
  );

  // Sections completely hidden for financial users (not even toggleable)
  const FINANCIAL_HIDDEN_SECTIONS = ['cuts', 'observation', 'serviceOrders', 'files', 'changelog'];
  // Sections hidden by default but toggleable for financial users
  const FINANCIAL_DEFAULT_HIDDEN_SECTIONS = ['dates', 'layout', 'artworks', 'paints', 'airbrushings'];
  // Overview fields hidden by default for financial users (toggleable)
  const FINANCIAL_DEFAULT_HIDDEN_FIELDS = [
    'responsibles', 'sector', 'plate', 'chassisNumber', 'truckCategory',
    'implementType', 'truckSpot', 'vehicle',
  ];
  // Filter sections and fields based on user privileges
  const filteredSections = useMemo(() => {
    return TASK_SECTIONS
      .filter(section => {
        // Financial users: completely hide certain sections
        if (isFinancialSector && FINANCIAL_HIDDEN_SECTIONS.includes(section.id)) return false;
        // Hide quote section for users without permission (ADMIN, FINANCIAL, COMMERCIAL only)
        if (section.id === 'quote' && !canViewQuoteSection) return false;
        // Hide files section if user can't view any file type
        if (section.id === 'files' && !canViewBaseFiles && !canViewProjectFiles) return false;
        // Hide dossiê section for users who can't view checkin files (same permissions)
        if (section.id === 'dossie' && !canViewCheckinFiles) return false;
        // Hide layout section for users without permission (ADMIN, LOGISTIC, PRODUCTION team leaders only)
        if (section.id === 'layout' && !canViewLayoutSection) return false;
        // Artworks section is visible to ALL users (content is filtered by approval status)
        // Hide changelog section for warehouse users and production users (except team leaders)
        if (section.id === 'changelog' && (isWarehouseSector || (isProductionSector && !isTeamLeader(currentUser)))) return false;
        return true;
      })
      .map(section => {
        let filteredFields = section.fields;

        // Financial users: hide finishedAt and invoiceToCustomers from non-financial overview
        if (!isFinancialSector && section.id === 'overview') {
          filteredFields = filteredFields.filter(field => field.id !== 'finishedAt' && field.id !== 'invoiceToCustomers');
        }

        // Filter commission field (ADMIN, FINANCIAL, COMMERCIAL, PRODUCTION only)
        if (!canViewCommissionField) {
          filteredFields = filteredFields.filter(field => !COMMISSION_RESTRICTED_FIELDS.includes(field.id));
        }

        // Filter privileged restricted fields (ADMIN, FINANCIAL, COMMERCIAL, LOGISTIC, DESIGNER only)
        if (!canViewRestrictedFields) {
          filteredFields = filteredFields.filter(field => !PRIVILEGED_RESTRICTED_FIELDS.includes(field.id));
        }

        // Financial users: sections that are hidden by default but toggleable
        if (isFinancialSector && FINANCIAL_DEFAULT_HIDDEN_SECTIONS.includes(section.id)) {
          return { ...section, fields: filteredFields, defaultVisible: false };
        }

        // Financial users: hide certain overview fields by default (still toggleable)
        if (isFinancialSector && section.id === 'overview') {
          filteredFields = filteredFields.map(field =>
            FINANCIAL_DEFAULT_HIDDEN_FIELDS.includes(field.id)
              ? { ...field, defaultVisible: false }
              : field
          );
          return { ...section, fields: filteredFields };
        }

        if (filteredFields.length !== section.fields.length) {
          return { ...section, fields: filteredFields };
        }
        return section;
      });
  }, [canViewQuoteSection, canViewBaseFiles, canViewProjectFiles, canViewCheckinFiles, canViewLayoutSection, isWarehouseSector, isProductionSector, currentUser, canViewCommissionField, canViewRestrictedFields, isFinancialSector]);

  // Initialize section visibility hook with filtered sections
  const sectionVisibility = useSectionVisibility(
    "task-detail-visibility",
    filteredSections
  );

  // Try to get file viewer context (optional)
  let fileViewerContext: ReturnType<typeof useFileViewer> | null = null;
  try {
    fileViewerContext = useFileViewer();
  } catch {
    // Context not available
  }

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

  // Handler for projectFiles collection viewing
  const handleProjectFileClick = (file: CustomFile) => {
    if (!fileViewerContext) return;
    const projectFilesList = task?.projectFiles || [];
    const index = projectFilesList.findIndex(f => f.id === file.id);
    fileViewerContext.actions.viewFiles(projectFilesList, index);
  };

  // Handler for artworks collection viewing
  const handleArtworkFileClick = (file: any) => {
    if (!fileViewerContext) return;
    // Extract file objects from artworks - file data can be nested in .file or directly on artwork
    const artworkFiles = (task?.artworks || []).map(artwork => artwork.file || artwork).filter((f): f is CustomFile => Boolean(f && typeof f === 'object' && 'id' in f));
    const index = artworkFiles.findIndex(f => f?.id === file.id);
    fileViewerContext.actions.viewFiles(artworkFiles, index);
  };

  // Handler for cuts collection viewing
  const handleCutFileClick = (file: any) => {
    if (!fileViewerContext) return;
    const cutFiles = cuts.map(cut => cut.file).filter((f): f is CustomFile => Boolean(f && typeof f === 'object' && 'id' in f));
    const index = cutFiles.findIndex(f => f?.id === file.id);
    fileViewerContext.actions.viewFiles(cutFiles, index);
  };

  // Fetch task details with all relations
  const {
    data: response,
    isLoading,
    error,
    refresh: refreshTask,
  } = useTaskDetail(id!, {
    enabled: !!id,
    include: {
      sector: true,
      customer: {
        include: {
          logo: true,
        },
      },
      createdBy: true,
      responsibles: true,
      serviceOrders: {
        include: {
          assignedTo: true,
          checkinFiles: true,
          checkoutFiles: true,
        },
      },
      baseFiles: true,
      projectFiles: true,
      artworks: {
        include: {
          file: true,
        },
      },
      quote: {
        include: {
          customerConfigs: {
            include: {
              customer: {
                include: {
                  logo: true,
                },
              },
              installments: { orderBy: { number: 'asc' } },
              responsible: true,
              customerSignature: true,
            },
          },
        },
      },
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
      truck: {
        include: {
          leftSideLayout: {
            include: {
              layoutSections: true,
            },
          },
          rightSideLayout: {
            include: {
              layoutSections: true,
            },
          },
          backSideLayout: {
            include: {
              layoutSections: true,
            },
          },
        },
      },
    },
  });

  const task = response?.data;

  // Handler for dossiê file viewing — shows ALL dossiê files across all service orders
  // Order: SO1 checkin, SO1 checkout, SO2 checkin, SO2 checkout, ...
  const handleDossieFileClick = useCallback((_serviceOrder: any, file: CustomFile) => {
    if (!fileViewerContext || !task?.serviceOrders) return;
    const productionSOs = (task.serviceOrders as any[])
      .filter((so) => so.type === SERVICE_ORDER_TYPE.PRODUCTION && (so.checkinFiles?.length > 0 || so.checkoutFiles?.length > 0))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const allFiles: any[] = [];
    for (const so of productionSOs) {
      const checkin = so.checkinFiles || [];
      const checkout = so.checkoutFiles || [];
      const maxLen = Math.max(checkin.length, checkout.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < checkin.length) allFiles.push(checkin[i]);
        if (i < checkout.length) allFiles.push(checkout[i]);
      }
    }
    const index = allFiles.findIndex((f: any) => f.id === file.id);
    fileViewerContext.actions.viewFiles(allFiles, index >= 0 ? index : 0);
  }, [fileViewerContext, task?.serviceOrders]);

  // Filter artworks based on user permissions - only show approved artworks to non-privileged users
  const filteredArtworks = useMemo(() => {
    if (!task?.artworks) return [];
    return task.artworks.filter(artwork => {
      const hasFileData = artwork.file || (artwork as any).filename || (artwork as any).path;
      return hasFileData && (canViewArtworkBadges || artwork.status === 'APPROVED');
    });
  }, [task?.artworks, canViewArtworkBadges]);

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
          artworks: {
            include: {
              file: true,
            },
          },
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
  // 1. Type: only types the user has permission to view based on sector privilege
  // 2. Status: Show canceled orders to appropriate users, but hide canceled PRODUCTION orders from PRODUCTION/WAREHOUSE users
  const filteredServiceOrders = useMemo(() => {
    if (!task?.serviceOrders) return [];
    return task.serviceOrders
      .filter((service) => {
        // Filter by type based on user's sector privilege
        const serviceType = service.type as SERVICE_ORDER_TYPE;
        if (!visibleServiceOrderTypes.includes(serviceType)) return false;

        // Handle canceled service orders visibility
        if (service.status === SERVICE_ORDER_STATUS.CANCELLED) {
          // Hide canceled PRODUCTION service orders from PRODUCTION and WAREHOUSE users
          if (serviceType === SERVICE_ORDER_TYPE.PRODUCTION) {
            if (userSectorPrivilege === SECTOR_PRIVILEGES.PRODUCTION ||
                userSectorPrivilege === SECTOR_PRIVILEGES.WAREHOUSE) {
              return false;
            }
          }
        }

        return true;
      })
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }, [task?.serviceOrders, visibleServiceOrderTypes, userSectorPrivilege]);

  // Check if there's any dossiê content (PRODUCTION service orders with checkin or checkout files)
  const hasDossieContent = useMemo(() => {
    if (!task?.serviceOrders) return false;
    return task.serviceOrders.some(
      (so: any) => so.type === SERVICE_ORDER_TYPE.PRODUCTION && (so.checkinFiles?.length > 0 || so.checkoutFiles?.length > 0)
    );
  }, [task?.serviceOrders]);

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
          quoteRoute: routes.financial.budget.details,
        };
      case 'historico':
        return {
          label: 'Histórico',
          href: routes.production.history.root,
          editRoute: routes.production.history.edit,
          quoteRoute: routes.financial.budget.details,
        };
      case 'cronograma':
      default:
        return {
          label: 'Cronograma',
          href: routes.production.schedule.list,
          editRoute: routes.production.schedule.edit,
          quoteRoute: routes.financial.budget.details,
        };
    }
  };

  const breadcrumbConfig = getBreadcrumbConfig(source);

  // Task navigation from preparation (agenda) page
  const taskIds = (location.state as { taskIds?: string[] } | null)?.taskIds;
  const taskNavigation = useMemo(() => {
    if (!taskIds || !id) return null;
    const currentIndex = taskIds.indexOf(id);
    if (currentIndex === -1) return null;
    return {
      currentIndex,
      total: taskIds.length,
      previousTaskId: currentIndex > 0 ? taskIds[currentIndex - 1] : null,
      nextTaskId: currentIndex < taskIds.length - 1 ? taskIds[currentIndex + 1] : null,
    };
  }, [taskIds, id]);

  // Get display name with fallbacks
  const getTaskDisplayName = (task: any) => {
    if (task.name) return task.name;
    if (task.customer?.corporateName) return task.customer.corporateName;
    if (task.serialNumber) return `Série ${task.serialNumber}`;
    if (task.truck?.plate) return task.truck.plate;
    return "Sem nome";
  };

  const taskDisplayName = task ? getTaskDisplayName(task) : "Carregando...";

  // Compute which grid cards should span full width (when they'd be alone in a row)
  const fullSpanSections = useMemo(() => {
    if (!task) return new Set<string>();

    type CardDef = { id: string; span: 1 | 2 };
    const visibleCards: CardDef[] = [];

    if (sectionVisibility.isSectionVisible("overview")) {
      visibleCards.push({ id: 'overview', span: 1 });
    }
    // Financial users: place dossié next to overview (both span: 1)
    if (isFinancialSector && sectionVisibility.isSectionVisible("dossie") && canViewCheckinFiles && hasDossieContent) {
      visibleCards.push({ id: 'dossie', span: 1 });
    }
    if (sectionVisibility.isSectionVisible("dates")) {
      visibleCards.push({ id: 'dates', span: 1 });
    }
    if (sectionVisibility.isSectionVisible("quote") && canViewQuoteSection && task.quote?.services?.length) {
      const hasMultipleCustomers = (task.quote?.customerConfigs?.length ?? 0) >= 2;
      visibleCards.push({ id: 'quote', span: hasMultipleCustomers && !quoteCustomerFilter ? 2 : 1 });
    }
    if (sectionVisibility.isSectionVisible("serviceOrders") && hasVisibleServiceOrders && filteredServiceOrders.length > 0) {
      visibleCards.push({ id: 'serviceOrders', span: 1 });
    }
    if (sectionVisibility.isSectionVisible("layout") && task.truck && (task.truck.leftSideLayout || task.truck.rightSideLayout || task.truck.backSideLayout)) {
      visibleCards.push({ id: 'layout', span: 1 });
    }
    if (sectionVisibility.isSectionVisible("artworks") && filteredArtworks.length > 0) {
      visibleCards.push({ id: 'artworks', span: 1 });
    }
    if (sectionVisibility.isSectionVisible("cuts") && !isFinancialSector && cuts.length > 0) {
      visibleCards.push({ id: 'cuts', span: 1 });
    }
    if (sectionVisibility.isSectionVisible("files")) {
      const hasBaseFiles = canViewBaseFiles && task.baseFiles && task.baseFiles.length > 0;
      const hasProjectFiles = canViewProjectFiles && task.projectFiles && task.projectFiles.length > 0;
      if (hasBaseFiles || hasProjectFiles) {
        visibleCards.push({ id: 'files', span: 1 });
      }
    }
    if (sectionVisibility.isSectionVisible("paints") && (task.generalPainting || (task.logoPaints && task.logoPaints.length > 0))) {
      visibleCards.push({ id: 'paints', span: 1 });
    }
    if (sectionVisibility.isSectionVisible("observation") && task.observation) {
      visibleCards.push({ id: 'observation', span: 1 });
    }
    if (sectionVisibility.isSectionVisible("airbrushings") && airbrushings.length > 0) {
      visibleCards.push({ id: 'airbrushings', span: 1 });
    }
    if (!isFinancialSector && sectionVisibility.isSectionVisible("dossie") && canViewCheckinFiles && hasDossieContent) {
      visibleCards.push({ id: 'dossie', span: 2 });
    }

    const result = new Set<string>();
    let slot = 0; // 0 = left col, 1 = right col
    let lastSpan1Idx = -1;

    for (let i = 0; i < visibleCards.length; i++) {
      const card = visibleCards[i];
      if (card.span === 2) {
        if (slot === 1) result.add(visibleCards[lastSpan1Idx].id);
        slot = 0;
      } else {
        if (slot === 0) {
          lastSpan1Idx = i;
          slot = 1;
        } else {
          slot = 0;
        }
      }
    }
    if (slot === 1) result.add(visibleCards[lastSpan1Idx].id);

    return result;
  }, [task, sectionVisibility, canViewQuoteSection, quoteCustomerFilter, hasVisibleServiceOrders, filteredServiceOrders, filteredArtworks, isFinancialSector, cuts, canViewBaseFiles, canViewProjectFiles, canViewCheckinFiles, airbrushings, hasDossieContent]);

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
      // Note: startedAt and finishedAt are auto-filled by the backend when status changes
      // to IN_PRODUCTION or COMPLETED respectively
      const updateData: any = { id: task.id, data: { status: pendingStatus } };

      await update(updateData);
      setStatusChangeDialogOpen(false);
    } catch (error) {
      console.error("Error updating task status:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle quote status change
  const handleQuoteStatusChange = async (newStatus: string, currentStatus?: string) => {
    if (!task?.quote?.id) return;

    // Confirmation for BILLING_APPROVED (triggers invoice/boleto generation)
    if (newStatus === 'BILLING_APPROVED') {
      setQuoteConfirmDialog({
        open: true,
        newStatus,
        currentStatus: currentStatus || '',
        title: 'BILLING_APPROVED_WARNING',
        description: '',
      });
      return;
    }

    // Reject/cancel — downgrading any non-PENDING status to PENDING needs a reason.
    if (newStatus === 'PENDING' && currentStatus && currentStatus !== 'PENDING') {
      setRejectDialog({ open: true, newStatus, reason: '' });
      return;
    }

    // Confirmation for reverting SETTLED → PARTIAL (payment reversal)
    if (currentStatus === 'SETTLED' && newStatus === 'PARTIAL') {
      setQuoteConfirmDialog({
        open: true,
        newStatus,
        currentStatus: currentStatus || '',
        title: 'Reverter para Parcial',
        description: 'Reverter o status de liquidado para parcial? Isso indica que houve estorno de pagamento.',
      });
      return;
    }

    await executeQuoteStatusChange(newStatus);
  };

  const executeQuoteStatusChange = async (newStatus: string, reason?: string) => {
    if (!task?.quote?.id) return;
    setIsUpdatingQuoteStatus(true);
    try {
      await taskQuoteService.updateStatus(task.quote.id, newStatus, reason);
      refreshTask();
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (error) {
      console.error("Error updating quote status:", error);
    } finally {
      setIsUpdatingQuoteStatus(false);
    }
  };

  // Handle "Disponibilizar para Produção" - manually release task to production
  // Note: Automatic sync still works - when artwork SO becomes COMPLETED, task auto-transitions
  const handleReleaseToProduction = () => {
    if (!task) return;

    // Proceed with status change to WAITING_PRODUCTION (no artwork validation for manual changes)
    handleStatusChange(TASK_STATUS.WAITING_PRODUCTION);
  };

  // Handle service order status change
  const handleServiceOrderStatusChange = async (serviceOrderId: string, newStatus: SERVICE_ORDER_STATUS) => {
    const serviceOrder = task?.serviceOrders?.find((s) => s.id === serviceOrderId);
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
    } catch (error) {
      console.error("Error updating service order status:", error);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PRODUCTION_MANAGER, SECTOR_PRIVILEGES.PLOTTING, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
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
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PRODUCTION_MANAGER, SECTOR_PRIVILEGES.PLOTTING, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
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
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PRODUCTION_MANAGER, SECTOR_PRIVILEGES.PLOTTING, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
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
              ...(taskNavigation ? [
                {
                  key: "previous",
                  label: "Anterior",
                  icon: IconChevronLeft,
                  onClick: () => taskNavigation.previousTaskId && navigate(
                    routes.production.preparation.details(taskNavigation.previousTaskId),
                    { state: { taskIds } }
                  ),
                  variant: "outline" as const,
                  group: "secondary" as const,
                  disabled: !taskNavigation.previousTaskId,
                },
                {
                  key: "task-position",
                  label: `${taskNavigation.currentIndex + 1} / ${taskNavigation.total}`,
                  onClick: () => {},
                  variant: "ghost" as const,
                  group: "secondary" as const,
                  className: "pointer-events-none tabular-nums",
                },
                {
                  key: "next",
                  label: "Próximo",
                  icon: IconChevronRight,
                  onClick: () => taskNavigation.nextTaskId && navigate(
                    routes.production.preparation.details(taskNavigation.nextTaskId),
                    { state: { taskIds } }
                  ),
                  variant: "outline" as const,
                  group: "secondary" as const,
                  disabled: !taskNavigation.nextTaskId,
                },
              ] : []),
              ...(canEdit && task.status === TASK_STATUS.WAITING_PRODUCTION
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
              ...(canEdit && task.status === TASK_STATUS.PREPARATION
                ? [
                    {
                      key: "resume",
                      label: "Disponibilizar para Produção",
                      icon: IconPlayerPlay,
                      onClick: handleReleaseToProduction,
                      variant: "default" as const,
                    },
                  ]
                : []),
              {
                key: "section-visibility",
                label: (
                  <SectionVisibilityManager
                    sections={filteredSections}
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
                onClick: () => navigate(breadcrumbConfig.editRoute(task.id), {
                  state: taskIds ? { taskIds } : undefined,
                }),
              }] : []),
            ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Overview Card */}
              {sectionVisibility.isSectionVisible("overview") && (
                <Card className={cn("border flex flex-col animate-in-50 duration-700", fullSpanSections.has("overview") && "lg:col-span-2")}>
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
                  Razão Social
                    </span>
                    <div className="flex items-center gap-2">
                  <CustomerLogoDisplay
                    logo={task.customer.logo}
                    customerName={task.customer.corporateName || task.customer.fantasyName}
                    size="sm"
                    shape="rounded"
                    className="flex-shrink-0"
                  />
                  {canAccessCustomerPages ? (
                    <span
                      className="text-sm font-semibold text-foreground text-right cursor-pointer hover:text-primary hover:underline transition-colors"
                      onClick={() => navigate(routes.financial.customers.details(task.customer!.id))}
                    >
                      {task.customer.corporateName || task.customer.fantasyName}
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-foreground text-right">{task.customer.corporateName || task.customer.fantasyName}</span>
                  )}
                    </div>
                  </div>
                )}

                {/* Responsibles - Designers only see MARKETING reps (fallback to COMMERCIAL) */}
                {sectionVisibility.isFieldVisible("responsibles") && (() => {
                  if (!task.responsibles || task.responsibles.length === 0) return null;
                  const reps = isDesignerSector
                    ? (() => {
                        const marketing = task.responsibles.filter(r => r.role === ResponsibleRole.MARKETING);
                        return marketing.length > 0 ? marketing : task.responsibles.filter(r => r.role === ResponsibleRole.COMMERCIAL);
                      })()
                    : task.responsibles;
                  if (reps.length === 0) return null;
                  return reps.map((rep) => {
                      const cleanPhone = rep.phone.replace(/\D/g, "");
                      const whatsappNumber = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
                      const formatPhone = (phone: string) => {
                        const numbers = phone.replace(/\D/g, "");
                        if (numbers.length === 11) {
                          return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
                        }
                        if (numbers.length === 10) {
                          return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`;
                        }
                        return phone;
                      };
                      const roleLabel = RESPONSIBLE_ROLE_LABELS[rep.role] || rep.role;

                      return (
                        <div key={rep.id} className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                          <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <IconUser className="h-4 w-4" />
                            Responsável {roleLabel}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-foreground">{rep.name}</span>
                            <a
                              href={`tel:${rep.phone}`}
                              className="text-sm font-medium text-green-600 dark:text-green-600 hover:underline"
                            >
                              {formatPhone(rep.phone)}
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
                    });
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

                {/* Details */}
                {sectionVisibility.isFieldVisible("details") && task.details && (
                  <div className="bg-muted/50 rounded-lg px-4 py-2.5">
                    <div className="flex items-center gap-2 mb-2">
                      <IconFileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Detalhes</span>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.details}</p>
                  </div>
                )}

                {/* Finished At - Financial sector overview field */}
                {sectionVisibility.isFieldVisible("finishedAt") && task.finishedAt && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconCalendarCheck className="h-4 w-4" />
                      Finalizado Em
                    </span>
                    <span className="text-sm font-semibold text-foreground">{formatDate(task.finishedAt)}</span>
                  </div>
                )}

                {/* Invoice To Customers - Financial sector overview field */}
                {sectionVisibility.isFieldVisible("invoiceToCustomers") && (task as any).quote?.customerConfigs?.length > 0 && (
                  (task as any).quote.customerConfigs.map((c: any) => {
                    const name = c.customer?.corporateName || c.customer?.fantasyName;
                    if (!name) return null;
                    return (
                      <div key={c.customerId || c.id} className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-1.5">
                        <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <IconReceipt className="h-4 w-4" />
                          Faturar Para
                        </span>
                        <div className="flex items-center gap-2">
                          <CustomerLogoDisplay
                            logo={c.customer?.logo}
                            customerName={name}
                            size="sm"
                            shape="rounded"
                            className="flex-shrink-0"
                          />
                          {canAccessCustomerPages && c.customerId ? (
                            <span
                              className="text-sm font-semibold text-foreground text-right cursor-pointer hover:text-primary hover:underline transition-colors"
                              onClick={() => navigate(routes.financial.customers.details(c.customerId))}
                            >
                              {name}
                            </span>
                          ) : (
                            <span className="text-sm font-semibold text-foreground text-right">{name}</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
                </CardContent>
              </Card>
          )}

              {/* Dates Card */}
              {sectionVisibility.isSectionVisible("dates") && (
              <Card className={cn("border flex flex-col animate-in fade-in-50 duration-800", fullSpanSections.has("dates") && "lg:col-span-2")}>
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
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <IconCalendarTime className="h-4 w-4" />
                        Previsao de Liberacao
                      </span>
                      <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                        {task.cleared && (
                          <span className="text-xs font-medium text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded">Liberado</span>
                        )}
                        {formatDateTime(task.forecastDate)}
                      </span>
                    </div>
                    <ForecastHistoryCollapsible taskId={task.id} />
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


              {/* Pricing Card - Only visible to ADMIN, FINANCIAL, and COMMERCIAL sectors */}
              {sectionVisibility.isSectionVisible("quote") && canViewQuoteSection && task.quote && task.quote.services && task.quote.services.length > 0 && (() => {
                const hasMultipleCustomers = (task.quote?.customerConfigs?.length ?? 0) >= 2;
                const isCompleteView = !quoteCustomerFilter;
                const shouldSpanFull = hasMultipleCustomers && isCompleteView;
                return (
                  <Card className={cn("border flex flex-col animate-in fade-in-50 duration-825", shouldSpanFull && "lg:col-span-2")}>
                    <CardHeader className="pb-6">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
          <IconFileInvoice className="h-5 w-5 text-muted-foreground" />
          {(!task.quote?.status || task.quote.status === 'PENDING') ? 'Orçamento Detalhado' : 'Faturamento Detalhado'}
        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const customerId = quoteCustomerFilter || 'all';
                              window.open(`/cliente/${customerId}/orcamento/${task.quote?.id}`, '_blank');
                            }}
                            className="gap-2"
                          >
                            <IconLayoutGrid className="h-4 w-4" />
                            Visualizar
                          </Button>
                          {canEditQuoteSection && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(
                                isTaskQuoteBillingPhase(task.quote?.status)
                                  ? routes.financial.billing.details(task.id)
                                  : routes.financial.budget.details(task.id)
                              )}
                              className="gap-2"
                            >
                              <IconEdit className="h-4 w-4" />
                              Editar
                            </Button>
                          )}
                          {/* Customer filter combobox - only show when 2+ invoiceTo customers */}
                          {task.quote?.customerConfigs && task.quote.customerConfigs.length >= 2 && (
                            <Combobox
                              value={quoteCustomerFilter || "all"}
                              onValueChange={(value) => setQuoteCustomerFilter(value === "all" ? null : (typeof value === 'string' ? value : null))}
                              options={[
                                { value: "all", label: "Completo" },
                                ...task.quote.customerConfigs.map((config) => ({
                                  value: config.customerId,
                                  label: config.customer?.corporateName || config.customer?.fantasyName || "Cliente",
                                })),
                              ]}
                              searchable={false}
                              placeholder="Filtrar cliente"
                              className="h-9 rounded-md"
                            />
                          )}
                          {(() => {
                            if (!task.quote) return null;
                            const quoteStatus = task.quote.status;

                            if (!canChangeQuoteStatus) {
                              return <QuoteStatusBadge status={quoteStatus} size="lg" />;
                            }

                            const statusLabels: Record<TASK_QUOTE_STATUS, string> = {
                              PENDING: 'Pendente',
                              BUDGET_APPROVED: 'Orçamento Aprovado',
                              COMMERCIAL_APPROVED: 'Aprovado pelo Comercial',
                              BILLING_APPROVED: 'Faturamento Aprovado',
                              UPCOMING: 'A Vencer',
                              DUE: 'Vencido',
                              PARTIAL: 'Parcial',
                              SETTLED: 'Liquidado',
                            };

                            // Task detail page only exposes PENDING and BUDGET_APPROVED;
                            // further status changes must be done in the financial billing page.
                            // The transitions helper still gates by user role.
                            const allStatuses: TASK_QUOTE_STATUS[] = [
                              'PENDING', 'BUDGET_APPROVED',
                            ];
                            const userPrivilege = currentUser?.sector?.privileges || '';
                            const allowedNext = getAvailableQuoteStatusTransitions(
                              quoteStatus,
                              userPrivilege,
                            );
                            const statusOptions: ComboboxOption[] = allStatuses
                              .map((s) => {
                                const isCurrent = s === quoteStatus;
                                const allowed = isCurrent || allowedNext.includes(s);
                                return {
                                  value: s,
                                  label: statusLabels[s],
                                  disabled: isCurrent || !allowed,
                                };
                              });

                            const getQuoteStatusTriggerClass = (status: TASK_QUOTE_STATUS) => {
                              switch (status) {
                                case 'PENDING':
                                  return "bg-neutral-500 text-white hover:bg-neutral-600 border-neutral-600";
                                case 'BUDGET_APPROVED':
                                  return "bg-green-700 text-white hover:bg-green-800 border-green-800";
                                case 'COMMERCIAL_APPROVED':
                                  return "bg-blue-700 text-white hover:bg-blue-800 border-blue-800";
                                case 'BILLING_APPROVED':
                                  return "bg-green-700 text-white hover:bg-green-800 border-green-800";
                                case 'UPCOMING':
                                  return "bg-amber-600 text-white hover:bg-amber-700 border-amber-700";
                                case 'DUE':
                                  return "bg-red-600 text-white hover:bg-red-700 border-red-700";
                                case 'PARTIAL':
                                  return "bg-blue-700 text-white hover:bg-blue-800 border-blue-800";
                                case 'SETTLED':
                                  return "bg-green-700 text-white hover:bg-green-800 border-green-800";
                                default:
                                  return "";
                              }
                            };

                            return (
                              <Combobox
                                value={quoteStatus}
                                onValueChange={(value) => {
                                  if (value && typeof value === 'string' && value !== quoteStatus) {
                                    handleQuoteStatusChange(value, quoteStatus);
                                  }
                                }}
                                options={statusOptions}
                                searchable={false}
                                clearable={false}
                                disabled={isUpdatingQuoteStatus}
                                className="w-[220px] h-9 rounded-md"
                                triggerClassName={cn(
                                  "font-medium",
                                  getQuoteStatusTriggerClass(quoteStatus)
                                )}
                              />
                            );
                          })()}
                        </div>
                      </div>
                    </CardHeader>
              <CardContent className="pt-0 flex-1">
                <div className="space-y-4">
                  {/* Budget Number and Validity */}
                  <div className="flex flex-wrap gap-3">
                    {task.quote.budgetNumber && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                        <IconReceipt className="h-4 w-4" />
                        <span>Orçamento Nº: <span className="font-medium text-foreground">{String(task.quote.budgetNumber).padStart(4, '0')}</span></span>
                      </div>
                    )}
                    {task.quote.expiresAt && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                        <IconCalendar className="h-4 w-4" />
                        <span>Validade: <span className="font-medium text-foreground">{formatDate(task.quote.expiresAt)}</span></span>
                      </div>
                    )}
                  </div>

                  {/* Pricing items table */}
                  {(() => {
                    const filteredServices = task.quote.services
                      .filter((item) => !quoteCustomerFilter || item.invoiceToCustomer?.id === quoteCustomerFilter || !item.invoiceToCustomerId);

                    const renderServiceRow = (item: any, index: number, showCustomerCol: boolean) => {
                      const isOutrosWithObservation = item.description === 'Outros' && !!item.observation;
                      const displayDescription = isOutrosWithObservation ? item.observation : item.description;
                      const amount = typeof item.amount === 'number' ? item.amount : Number(item.amount) || 0;
                      return (
                        <tr key={item.id || index} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-1.5 text-sm align-middle">
                            <div className="flex items-center gap-2">
                              <span>{displayDescription}</span>
                              {!isOutrosWithObservation && item.observation && (
                                <HoverCard openDelay={100} closeDelay={100}>
                                  <HoverCardTrigger asChild>
                                    <button className="relative flex items-center justify-center h-5 w-5 rounded border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors">
                                      <IconNote className="h-3.5 w-3.5" />
                                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
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
                                      <p className="text-sm text-muted-foreground">{item.observation}</p>
                                    </div>
                                  </HoverCardContent>
                                </HoverCard>
                              )}
                            </div>
                          </td>
                          {showCustomerCol && (
                            <td className="px-4 py-1.5 text-sm text-muted-foreground align-middle">
                              {canAccessCustomerPages && item.invoiceToCustomer?.id ? (
                                <span
                                  className="cursor-pointer hover:text-primary hover:underline transition-colors"
                                  onClick={() => navigate(routes.financial.customers.details(item.invoiceToCustomer!.id))}
                                >
                                  {item.invoiceToCustomer.corporateName || item.invoiceToCustomer.fantasyName}
                                </span>
                              ) : (
                                item.invoiceToCustomer?.corporateName || item.invoiceToCustomer?.fantasyName || "-"
                              )}
                            </td>
                          )}
                          <td className="px-4 py-1.5 text-sm text-right font-medium align-middle">
                            {formatCurrency(amount)}
                          </td>
                        </tr>
                      );
                    };

                    // Group by customer when "Completo" with 2+ customers — 2-column layout
                    // Use customerConfigs order to ensure consistent "Cliente N" numbering with billing section
                    if (!quoteCustomerFilter && (task.quote?.customerConfigs?.length ?? 0) >= 2) {
                      const servicesByCustomer = new Map<string, typeof filteredServices>();
                      for (const item of filteredServices) {
                        const customerId = item.invoiceToCustomer?.id || '__unassigned__';
                        if (!servicesByCustomer.has(customerId)) {
                          servicesByCustomer.set(customerId, []);
                        }
                        servicesByCustomer.get(customerId)!.push(item);
                      }

                      // Follow customerConfigs order for consistent numbering
                      const orderedGroups = task.quote!.customerConfigs!.map((config) => ({
                        customerId: config.customerId,
                        name: config.customer?.corporateName || config.customer?.fantasyName || 'Sem cliente',
                        services: servicesByCustomer.get(config.customerId) || [],
                      }));

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 items-stretch gap-3">
                          {orderedGroups.map((group, groupIndex) => (
                            <div key={group.customerId} className="border border-border dark:border-border/30 rounded-lg overflow-hidden">
                              <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border dark:border-border/30">
                                <IconBuilding className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-semibold">
                                  <span className="text-muted-foreground font-medium">Cliente {groupIndex + 1}:</span>{" "}
                                  {canAccessCustomerPages && group.customerId !== '__unassigned__' ? (
                                    <span
                                      className="cursor-pointer hover:text-primary hover:underline transition-colors"
                                      onClick={() => navigate(routes.financial.customers.details(group.customerId))}
                                    >
                                      {group.name}
                                    </span>
                                  ) : (
                                    group.name
                                  )}
                                </span>
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {formatCurrency(
                                    (() => {
                                      const config = task.quote?.customerConfigs?.find((c: any) => c.customerId === group.customerId);
                                      return config?.total != null ? Number(config.total) : group.services.reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0);
                                    })()
                                  )}
                                </span>
                              </div>
                              <div>
                                <table className="w-full">
                                  <thead className="bg-muted/50">
                                    <tr>
                                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-muted-foreground">Descrição</th>
                                      <th className="px-4 py-2.5 text-right text-sm font-semibold text-muted-foreground w-28">Valor</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border dark:divide-border/30">
                                    {group.services.map((item, index) => renderServiceRow(item, index, false))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    }

                    // Single customer or filtered view: flat table
                    return (
                      <div className="border border-border dark:border-border/30 rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Descrição</th>
                              <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground w-32">Valor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border dark:divide-border/30">
                            {filteredServices.map((item, index) => renderServiceRow(item, index, false))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}

                  {/* Pricing Summary */}
                  {(() => {
                    const configs = task.quote?.customerConfigs || [];
                    const hasConfigs = configs.length > 0;

                    // Determine which discount/total source to use
                    // Discounts are on customerConfig level (global per customer)
                    let displaySubtotal: number;
                    let discountAmount = 0;
                    let displayTotal: number;
                    let discountLabel = 'Desconto';

                    if (quoteCustomerFilter) {
                      // Specific customer filtered: use that config's data
                      const selectedConfig = configs.find((c) => c.customerId === quoteCustomerFilter);
                      if (selectedConfig) {
                        displaySubtotal = typeof selectedConfig.subtotal === 'number' ? selectedConfig.subtotal : Number(selectedConfig.subtotal) || 0;
                        displayTotal = typeof selectedConfig.total === 'number' ? selectedConfig.total : Number(selectedConfig.total) || 0;
                        if (displaySubtotal !== displayTotal) {
                          discountAmount = displaySubtotal - displayTotal;
                          if (selectedConfig.discountType === 'PERCENTAGE' && selectedConfig.discountValue) {
                            discountLabel = `Desconto (${selectedConfig.discountValue}%)`;
                          }
                          if (selectedConfig.discountReference) {
                            discountLabel += ` — ${selectedConfig.discountReference}`;
                          }
                        }
                      } else {
                        // Fallback: compute from filtered services + global discount
                        const filtered = task.quote.services.filter((item) => item.invoiceToCustomer?.id === quoteCustomerFilter || !item.invoiceToCustomerId);
                        displaySubtotal = filtered.reduce((sum, item) => sum + (typeof item.amount === 'number' ? item.amount : Number(item.amount) || 0), 0);
                        displayTotal = displaySubtotal;
                      }
                    } else if (hasConfigs && configs.length >= 2) {
                      // "Completo" with 2+ configs: aggregate from configs, no global discount
                      displaySubtotal = configs.reduce((sum, c) => sum + (typeof c.subtotal === 'number' ? c.subtotal : Number(c.subtotal) || 0), 0);
                      displayTotal = configs.reduce((sum, c) => sum + (typeof c.total === 'number' ? c.total : Number(c.total) || 0), 0);
                      // Show aggregate discount if subtotal != total
                      if (displaySubtotal !== displayTotal) {
                        discountAmount = displaySubtotal - displayTotal;
                      }
                    } else if (hasConfigs && configs.length === 1) {
                      // Single config: use that config's data
                      const config = configs[0];
                      let configSubtotal = typeof config.subtotal === 'number' ? config.subtotal : Number(config.subtotal) || 0;
                      if (configSubtotal === 0 && task.quote.services?.length > 0) {
                        configSubtotal = task.quote.services.reduce((sum: number, item: any) => sum + (typeof item.amount === 'number' ? item.amount : Number(item.amount) || 0), 0);
                      }
                      displaySubtotal = configSubtotal;
                      let configTotal = typeof config.total === 'number' ? config.total : Number(config.total) || 0;
                      if (configTotal === 0 && displaySubtotal > 0) {
                        configTotal = displaySubtotal;
                      }
                      displayTotal = configTotal;
                      if (displaySubtotal !== displayTotal) {
                        discountAmount = displaySubtotal - displayTotal;
                        if (config.discountType === 'PERCENTAGE' && config.discountValue) {
                          discountLabel = `Desconto (${config.discountValue}%)`;
                        }
                        if (config.discountReference) {
                          discountLabel += ` — ${config.discountReference}`;
                        }
                      }
                    } else {
                      // No configs: fallback to global quote aggregates (no per-config discount)
                      displaySubtotal = typeof task.quote.subtotal === 'number' ? task.quote.subtotal : Number(task.quote.subtotal) || 0;
                      displayTotal = typeof task.quote.total === 'number' ? task.quote.total : Number(task.quote.total) || 0;
                    }

                    return (
                  <div className="bg-muted/20 border border-border dark:border-border/30 rounded-lg p-4 space-y-3">
                    {/* Subtotal */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">
                        {formatCurrency(displaySubtotal)}
                      </span>
                    </div>

                    {/* Discount (from customer config) */}
                    {discountAmount > 0 && (
                      <div className="flex items-center justify-between text-sm text-destructive">
                        <span>{discountLabel}</span>
                        <span className="font-medium">
                          - {formatCurrency(discountAmount)}
                        </span>
                      </div>
                    )}

                    {/* Total */}
                    <div className="flex items-center justify-between pt-3 border-t border-border dark:border-border/30">
                      <span className="text-base font-bold text-foreground">TOTAL</span>
                      <span className="text-xl font-bold text-primary">
                        {formatCurrency(displayTotal)}
                      </span>
                    </div>
                  </div>
                    );
                  })()}

                  {/* Per-Customer Config Cards */}
                  {task.quote?.customerConfigs && task.quote.customerConfigs.length > 0 && (() => {
                    const configs = quoteCustomerFilter
                      ? task.quote!.customerConfigs!.filter((c) => c.customerId === quoteCustomerFilter)
                      : task.quote!.customerConfigs!.length >= 2
                        ? task.quote!.customerConfigs!
                        : [];

                    if (configs.length === 0) return null;

                    const isMultiColumnLayout = !quoteCustomerFilter && configs.length >= 2;

                    return (
                      <div className={cn("gap-3", isMultiColumnLayout ? "grid grid-cols-1 md:grid-cols-2 items-stretch" : "space-y-3")}>
                        {configs.map((config, configIndex) => {
                          const configSubtotal = typeof config.subtotal === 'number' ? config.subtotal : Number(config.subtotal) || 0;
                          const configTotal = typeof config.total === 'number' ? config.total : Number(config.total) || 0;
                          const configDiscountAmount = Math.max(0, configSubtotal - configTotal);
                          let configDiscountLabel = 'Desconto';
                          if (config.discountType === 'PERCENTAGE' && config.discountValue) {
                            configDiscountLabel = `Desconto (${config.discountValue}%)`;
                          }
                          if (config.discountReference) {
                            configDiscountLabel += ` — ${config.discountReference}`;
                          }
                          const configPaymentText = generatePaymentText({
                            customPaymentText: config.customPaymentText,
                            paymentCondition: config.paymentCondition,

                            total: configTotal,
                          });

                          return (
                            <div key={config.id} className="bg-muted/30 rounded-lg p-4 space-y-2 flex flex-col">
                              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                <IconBuilding className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground font-medium">Cliente {configIndex + 1}:</span>
                                {canAccessCustomerPages && config.customerId ? (
                                  <span
                                    className="cursor-pointer hover:text-primary hover:underline transition-colors"
                                    onClick={() => navigate(routes.financial.customers.details(config.customerId))}
                                  >
                                    {config.customer?.corporateName || config.customer?.fantasyName || 'Cliente'}
                                  </span>
                                ) : (
                                  config.customer?.corporateName || config.customer?.fantasyName || 'Cliente'
                                )}
                              </div>

                              {config.responsible?.name && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <IconUser className="h-4 w-4" />
                                  <span>Responsável: <span className="font-medium text-foreground">{config.responsible.name}</span></span>
                                </div>
                              )}

                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span className="font-medium">{formatCurrency(configSubtotal)}</span>
                              </div>

                              {configDiscountAmount > 0 ? (
                                <div className="flex items-center justify-between text-sm text-destructive">
                                  <span>{configDiscountLabel}</span>
                                  <span className="font-medium">- {formatCurrency(configDiscountAmount)}</span>
                                </div>
                              ) : null}

                              <div className="flex items-center justify-between pt-2 border-t border-border dark:border-border/30">
                                <span className="text-sm font-bold text-foreground">Total</span>
                                <span className="text-base font-bold text-primary">{formatCurrency(configTotal)}</span>
                              </div>

                              {configPaymentText && (
                                <div className="pt-2">
                                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-1">
                                    <IconCreditCard className="h-4 w-4 text-muted-foreground" />
                                    Condições de Pagamento
                                  </div>
                                  <p className="text-sm text-muted-foreground">{configPaymentText}</p>
                                </div>
                              )}

                              {config.orderNumber && (
                                <div className="text-sm text-muted-foreground">
                                  N° do Pedido: <span className="font-medium text-foreground">{config.orderNumber}</span>
                                </div>
                              )}

                              {/* Boletos (from invoice data or fallback to simple parcelas) */}
                              {(() => {
                                const configInvoice = invoices.find((inv) => inv.customerConfigId === config.id);
                                if (configInvoice) {
                                  const invoiceInstallments = configInvoice.installments
                                    ? [...configInvoice.installments].sort((a, b) => a.number - b.number)
                                    : [];
                                  return (
                                    <div className="pt-2 space-y-2">
                                      {/* Parcelas */}
                                      <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                                        <div className="flex items-center gap-2">
                                          <IconReceipt className="h-3.5 w-3.5 text-muted-foreground" />
                                          Parcelas
                                        </div>
                                        <DownloadAllBoletosButton installments={invoiceInstallments} />
                                      </div>
                                      <div className="divide-y divide-border/50 rounded-md border border-border/50 overflow-hidden">
                                        {invoiceInstallments.map((installment) => (
                                          <div key={installment.id} className="px-3 py-2 hover:bg-muted/40 transition-colors">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
                                                <span className="text-xs text-muted-foreground">
                                                  {formatDate(installment.dueDate)}
                                                </span>
                                                <span className="text-xs font-medium">
                                                  {formatCurrency(installment.amount)}
                                                </span>
                                                <InstallmentStatusBadge status={installment.status} size="sm" />
                                                {installment.bankSlip && (
                                                  <BankSlipStatusBadge status={installment.bankSlip.status} size="sm" />
                                                )}
                                              </div>
                                              <BoletoActions
                                                installmentId={installment.id}
                                                bankSlip={installment.bankSlip}
                                                installmentStatus={installment.status}
                                              />
                                            </div>
                                          </div>
                                        ))}
                                      </div>

                                      {/* NFS-e */}
                                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground pt-1">
                                        <IconFileInvoice className="h-3.5 w-3.5 text-muted-foreground" />
                                        NFS-e
                                      </div>
                                      <div className="rounded-md border border-border/50 px-3 py-2">
                                        {(() => {
                                          const nfseDocuments = configInvoice.nfseDocuments ?? [];
                                          const activeNfse = nfseDocuments.find((d) => d.status === 'AUTHORIZED') ?? nfseDocuments[nfseDocuments.length - 1] ?? null;
                                          return (
                                            <>
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                  {activeNfse ? (
                                                    <NfseStatusBadge status={activeNfse.status} size="sm" />
                                                  ) : (
                                                    <span className="text-xs text-muted-foreground">Nao emitida</span>
                                                  )}
                                                  {nfseDocuments.length > 1 && (
                                                    <span className="text-xs text-muted-foreground">
                                                      ({nfseDocuments.length} emissões)
                                                    </span>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                  {activeNfse?.elotechNfseId && (
                                                    <NfsePdfButtons elotechNfseId={activeNfse.elotechNfseId} />
                                                  )}
                                                  <NfseActions invoiceId={configInvoice.id} nfseDocuments={nfseDocuments} />
                                                </div>
                                              </div>
                                              {activeNfse?.elotechNfseId && (
                                                <NfseEnrichedInfo elotechNfseId={activeNfse.elotechNfseId} />
                                              )}
                                              {activeNfse?.status === 'ERROR' && activeNfse.errorMessage && (
                                                <p className="text-xs text-destructive mt-1">{activeNfse.errorMessage}</p>
                                              )}
                                            </>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  );
                                }

                                // Fallback: simple parcelas when no invoice data
                                if (config.installments && config.installments.length > 0) {
                                  return (
                                    <div className="pt-2">
                                      <div className="text-sm font-semibold text-foreground mb-1">Parcelas</div>
                                      <div className="space-y-1">
                                        {config.installments.map((inst) => (
                                          <div key={inst.id} className="flex items-center justify-between text-sm text-muted-foreground">
                                            <span>{inst.number}ª — {formatDate(inst.dueDate)}</span>
                                            <span className="font-medium text-foreground">{formatCurrency(inst.amount)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                }

                                return null;
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Delivery Deadline */}
                  {(task.quote.customForecastDays || (task.quote.simultaneousTasks && task.quote.simultaneousTasks > 1)) && (
                    <div className="bg-muted/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                        <IconTruck className="h-4 w-4 text-muted-foreground" />
                        Prazo de Entrega
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {task.quote.customForecastDays && (
                          <>O prazo de entrega é de {task.quote.customForecastDays} dias úteis a partir da data de liberação.</>
                        )}
                        {task.quote.simultaneousTasks && task.quote.simultaneousTasks > 1 && (
                          <>{task.quote.customForecastDays ? ' ' : ''}Capacidade de produção: {task.quote.simultaneousTasks} tarefas simultâneas.</>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Payment Conditions */}
                  {(() => {
                    const configs = task.quote?.customerConfigs || [];
                    // When filtering a specific customer, use that config's payment data
                    if (quoteCustomerFilter) {
                      const selectedConfig = configs.find((c) => c.customerId === quoteCustomerFilter);
                      if (selectedConfig) return null; // Already shown in per-customer card above
                    }
                    // When "Completo" with 2+ configs, skip global (shown in per-customer cards)
                    if (!quoteCustomerFilter && configs.length >= 2) return null;
                    // When 1 config, use that config's data
                    if (configs.length === 1) {
                      const config = configs[0];
                      const configTotal = typeof config.total === 'number' ? config.total : Number(config.total) || 0;
                      const paymentText = generatePaymentText({
                        customPaymentText: config.customPaymentText,
                        paymentCondition: config.paymentCondition,

                        total: configTotal,
                      });
                      const hasContent = paymentText || config.orderNumber;
                      return hasContent ? (
                        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                          {paymentText && (
                            <>
                              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                <IconCreditCard className="h-4 w-4 text-muted-foreground" />
                                Condições de Pagamento
                              </div>
                              <p className="text-sm text-muted-foreground">{paymentText}</p>
                            </>
                          )}
                          {config.orderNumber && (
                            <div className="text-sm text-muted-foreground">
                              N° do Pedido: <span className="font-medium text-foreground">{config.orderNumber}</span>
                            </div>
                          )}
                        </div>
                      ) : null;
                    }
                    // Fallback to global quote (paymentCondition now lives on config level)
                    const paymentText = generatePaymentText({
                      customPaymentText: null,
                      paymentCondition: null,
                      total: typeof task.quote.total === 'number' ? task.quote.total : Number(task.quote.total) || 0,
                    });
                    return paymentText ? (
                      <div className="bg-muted/30 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                          <IconCreditCard className="h-4 w-4 text-muted-foreground" />
                          Condições de Pagamento
                        </div>
                        <p className="text-sm text-muted-foreground">{paymentText}</p>
                      </div>
                    ) : null;
                  })()}

                  {/* Boletos & NFS-e for single-customer case (not shown in per-customer cards) */}
                  {(() => {
                    const configs = task.quote?.customerConfigs || [];
                    // Only show here when there's a single config and no customer filter (per-customer cards don't render)
                    if (quoteCustomerFilter || configs.length !== 1) return null;
                    const config = configs[0];
                    const configInvoice = invoices.find((inv) => inv.customerConfigId === config.id);
                    if (!configInvoice) {
                      // Fallback: simple parcelas
                      if (!config.installments || config.installments.length === 0) return null;
                      return (
                        <div className="bg-muted/30 rounded-lg p-4">
                          <div className="text-sm font-semibold text-foreground mb-2">Parcelas</div>
                          <div className="space-y-1">
                            {config.installments.map((inst) => (
                              <div key={inst.id} className="flex items-center justify-between text-sm text-muted-foreground">
                                <span>{inst.number}ª — {formatDate(inst.dueDate)}</span>
                                <span className="font-medium text-foreground">{formatCurrency(inst.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    const invoiceInstallments = configInvoice.installments
                      ? [...configInvoice.installments].sort((a, b) => a.number - b.number)
                      : [];

                    return (
                      <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                        {/* Parcelas */}
                        {invoiceInstallments.length > 0 && (
                          <>
                            <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                              <div className="flex items-center gap-2">
                                <IconReceipt className="h-3.5 w-3.5 text-muted-foreground" />
                                Parcelas
                              </div>
                              <DownloadAllBoletosButton installments={invoiceInstallments} />
                            </div>
                            <div className="divide-y divide-border/50 rounded-md border border-border/50 overflow-hidden">
                              {invoiceInstallments.map((installment) => (
                                <div key={installment.id} className="px-3 py-2 hover:bg-muted/40 transition-colors">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
                                      <span className="text-xs text-muted-foreground">
                                        {formatDate(installment.dueDate)}
                                      </span>
                                      <span className="text-xs font-medium">
                                        {formatCurrency(installment.amount)}
                                      </span>
                                      <InstallmentStatusBadge status={installment.status} size="sm" />
                                      {installment.bankSlip && (
                                        <BankSlipStatusBadge status={installment.bankSlip.status} size="sm" />
                                      )}
                                    </div>
                                    <BoletoActions
                                      installmentId={installment.id}
                                      bankSlip={installment.bankSlip}
                                      installmentStatus={installment.status}
                                    />
                                  </div>
                                  {installment.bankSlip?.pdfFile && (
                                    <div className="mt-1.5">
                                      <FileItem
                                        file={installment.bankSlip.pdfFile as unknown as CustomFile}
                                        viewMode="list"
                                        onPreview={(file) => fileViewerContext?.actions.viewFile(file)}
                                        onDownload={(file) => fileViewerContext?.actions.downloadFile(file)}
                                        showActions
                                      />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </>
                        )}

                        {/* NFS-e */}
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground pt-1">
                          <IconFileInvoice className="h-3.5 w-3.5 text-muted-foreground" />
                          NFS-e
                        </div>
                        <div className="rounded-md border border-border/50 px-3 py-2">
                          {(() => {
                            const nfseDocuments = configInvoice.nfseDocuments ?? [];
                            const activeNfse = nfseDocuments.find((d) => d.status === 'AUTHORIZED') ?? nfseDocuments[nfseDocuments.length - 1] ?? null;
                            return (
                              <>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    {activeNfse ? (
                                      <NfseStatusBadge status={activeNfse.status} size="sm" />
                                    ) : (
                                      <span className="text-xs text-muted-foreground">Nao emitida</span>
                                    )}
                                    {nfseDocuments.length > 1 && (
                                      <span className="text-xs text-muted-foreground">
                                        ({nfseDocuments.length} emissões)
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {activeNfse?.elotechNfseId && activeNfse.status === 'AUTHORIZED' && (
                                      <NfsePdfButtons elotechNfseId={activeNfse.elotechNfseId} />
                                    )}
                                    <NfseActions invoiceId={configInvoice.id} nfseDocuments={nfseDocuments} />
                                  </div>
                                </div>
                                {activeNfse?.elotechNfseId && (
                                  <NfseEnrichedInfo elotechNfseId={activeNfse.elotechNfseId} />
                                )}
                                {activeNfse?.status === 'ERROR' && activeNfse.errorMessage && (
                                  <p className="text-xs text-destructive mt-1">{activeNfse.errorMessage}</p>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Guarantee */}
                  {(() => {
                    const guaranteeText = generateGuaranteeText(task.quote);
                    return guaranteeText ? (
                      <div className="bg-muted/30 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                          <IconShieldCheck className="h-4 w-4 text-muted-foreground" />
                          Garantia
                        </div>
                        <p className="text-sm text-muted-foreground">{guaranteeText}</p>
                      </div>
                    ) : null;
                  })()}

                  {/* Layout File Preview */}
                  {task.quote.layoutFile && (
                    <div className="bg-muted/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                        <IconPhoto className="h-4 w-4 text-muted-foreground" />
                        Layout Aprovado
                      </div>
                      <div className="flex justify-start">
                        <img
                          src={`${getApiBaseUrl()}/files/thumbnail/${task.quote.layoutFile.id}`}
                          alt="Layout aprovado"
                          className="max-h-48 rounded-lg shadow-sm object-contain cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => {
                            if (fileViewerContext && task.quote?.layoutFile) {
                              fileViewerContext.actions.viewFile(task.quote.layoutFile);
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Customer Signature - read from the first config (or filtered config) */}
                  {(() => {
                    const sigConfig = quoteCustomerFilter
                      ? task.quote.customerConfigs?.find((c: any) => c.customerId === quoteCustomerFilter)
                      : task.quote.customerConfigs?.[0];
                    const configSig = sigConfig?.customerSignature;
                    if (!configSig) return null;
                    return (
                    <div className="bg-muted/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                        <IconWriting className="h-4 w-4 text-muted-foreground" />
                        Assinatura do Cliente
                      </div>
                      <div className="flex justify-center">
                        <img
                          src={`${getApiBaseUrl()}/files/serve/${configSig.id}`}
                          alt="Assinatura do cliente"
                          className="max-h-24 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => {
                            if (fileViewerContext && configSig) {
                              fileViewerContext.actions.viewFile(configSig);
                            }
                          }}
                        />
                      </div>
                    </div>
                    );
                  })()}
                </div>
              </CardContent>
                </Card>
                );
              })()}

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
                  <Card className={cn("border flex flex-col animate-in fade-in-50 duration-900", fullSpanSections.has("serviceOrders") && "lg:col-span-2")}>
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
                    {SERVICE_ORDER_TYPE_DISPLAY_ORDER
                      .filter(type => groupedServiceOrders[type]?.length > 0)
                      .map((type) => {
                        const orders = groupedServiceOrders[type];
                        return (
                      <div key={type} className="space-y-2">
                        {/* Group Header */}
                        <div className="flex items-center gap-2 pb-2 border-b border-border/30">
                          <h3 className="text-sm font-semibold text-foreground">
                            {SERVICE_ORDER_TYPE_LABELS[type as SERVICE_ORDER_TYPE]}
                          </h3>
                          <Badge variant="outline" className="text-xs">
                            {orders.length}
                          </Badge>
                        </div>

                        {/* Service Orders in this group */}
                        {orders.map((serviceOrder) => {
                          const isOutrosWithObservation = serviceOrder.description === 'Outros' && !!serviceOrder.observation;
                          const displayDescription = isOutrosWithObservation ? serviceOrder.observation : serviceOrder.description;
                          return (
                      <div key={serviceOrder.id} className="bg-muted/50 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold">{displayDescription}</h4>
                          {/* Observation Indicator with HoverCard */}
                          {!isOutrosWithObservation && serviceOrder.observation && (
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
                            const variant = getBadgeVariantFromStatus(serviceOrder.status ?? '', "SERVICE_ORDER");
                            return (
                              <Badge
                                variant={variant}
                                className="w-[200px] h-8 flex items-center justify-start pl-3 text-sm font-medium"
                              >
                                {SERVICE_ORDER_STATUS_LABELS[serviceOrder.status as SERVICE_ORDER_STATUS]}
                              </Badge>
                            );
                          }

                          // Determine available status options based on service order type, user role, and CURRENT STATUS (state machine)
                          const isArtworkServiceOrder = serviceOrder.type === SERVICE_ORDER_TYPE.ARTWORK;
                          const isDesignerUser = userSectorPrivilege === SECTOR_PRIVILEGES.DESIGNER;
                          const isAdminUser = userSectorPrivilege === SECTOR_PRIVILEGES.ADMIN;
                          const currentSOStatus = serviceOrder.status as SERVICE_ORDER_STATUS | null;

                          // State-machine: options depend on current status; current state keeps its name, transitions use action verbs.
                          const statusOptions: ComboboxOption[] = [];

                          if (currentSOStatus === SERVICE_ORDER_STATUS.PENDING) {
                            // Pendente → can only Iniciar. Admin can Cancelar.
                            statusOptions.push(
                              { value: SERVICE_ORDER_STATUS.PENDING, label: "Pendente" },
                              { value: SERVICE_ORDER_STATUS.IN_PROGRESS, label: "Iniciar" },
                            );
                            if (isAdminUser) {
                              statusOptions.push({ value: SERVICE_ORDER_STATUS.CANCELLED, label: "Cancelar" });
                            }
                          } else if (currentSOStatus === SERVICE_ORDER_STATUS.IN_PROGRESS) {
                            // Em Andamento → can Pausar, (artwork) Enviar para Aprovação, Concluir, (cancel-capable) Cancelar.
                            statusOptions.push(
                              { value: SERVICE_ORDER_STATUS.IN_PROGRESS, label: "Em Andamento" },
                              { value: SERVICE_ORDER_STATUS.PAUSED, label: "Pausar" },
                            );
                            if (isArtworkServiceOrder) {
                              statusOptions.push({ value: SERVICE_ORDER_STATUS.WAITING_APPROVE, label: "Enviar para Aprovação" });
                            }
                            if (!(isArtworkServiceOrder && isDesignerUser)) {
                              statusOptions.push({ value: SERVICE_ORDER_STATUS.COMPLETED, label: "Concluir" });
                            }
                            if (isAdminUser) {
                              statusOptions.push({ value: SERVICE_ORDER_STATUS.PENDING, label: "Voltar para Pendente" });
                            }
                            if (canCancelServiceOrder(userSectorPrivilege)) {
                              statusOptions.push({ value: SERVICE_ORDER_STATUS.CANCELLED, label: "Cancelar" });
                            }
                          } else if (currentSOStatus === SERVICE_ORDER_STATUS.PAUSED) {
                            // Pausado → can Continuar (resume to IN_PROGRESS), Concluir, (cancel-capable) Cancelar.
                            statusOptions.push(
                              { value: SERVICE_ORDER_STATUS.PAUSED, label: "Pausado" },
                              { value: SERVICE_ORDER_STATUS.IN_PROGRESS, label: "Continuar" },
                              { value: SERVICE_ORDER_STATUS.COMPLETED, label: "Concluir" },
                            );
                            if (isAdminUser) {
                              statusOptions.push({ value: SERVICE_ORDER_STATUS.PENDING, label: "Voltar para Pendente" });
                            }
                            if (canCancelServiceOrder(userSectorPrivilege)) {
                              statusOptions.push({ value: SERVICE_ORDER_STATUS.CANCELLED, label: "Cancelar" });
                            }
                          } else if (currentSOStatus === SERVICE_ORDER_STATUS.WAITING_APPROVE) {
                            // Aguardando Aprovação → Admin: Aprovar / Reprovar. Designer: Retirar. Others: read-only (badge shown above).
                            statusOptions.push({ value: SERVICE_ORDER_STATUS.WAITING_APPROVE, label: "Aguardando Aprovação" });
                            if (isAdminUser) {
                              statusOptions.push(
                                { value: SERVICE_ORDER_STATUS.COMPLETED, label: "Aprovar" },
                                { value: SERVICE_ORDER_STATUS.IN_PROGRESS, label: "Reprovar" },
                              );
                            } else if (!isDesignerUser) {
                              statusOptions.push({ value: SERVICE_ORDER_STATUS.COMPLETED, label: "Aprovar" });
                            } else {
                              statusOptions.push({ value: SERVICE_ORDER_STATUS.IN_PROGRESS, label: "Retirar Envio" });
                            }
                            if (canCancelServiceOrder(userSectorPrivilege)) {
                              statusOptions.push({ value: SERVICE_ORDER_STATUS.CANCELLED, label: "Cancelar" });
                            }
                          } else if (currentSOStatus === SERVICE_ORDER_STATUS.COMPLETED) {
                            // Concluído → terminal. Admin can Reabrir.
                            statusOptions.push({ value: SERVICE_ORDER_STATUS.COMPLETED, label: "Concluído" });
                            if (isAdminUser) {
                              statusOptions.push({ value: SERVICE_ORDER_STATUS.IN_PROGRESS, label: "Reabrir" });
                            }
                          } else if (currentSOStatus === SERVICE_ORDER_STATUS.CANCELLED) {
                            // Cancelado → terminal. Admin can Restaurar.
                            statusOptions.push({ value: SERVICE_ORDER_STATUS.CANCELLED, label: "Cancelado" });
                            if (isAdminUser) {
                              statusOptions.push({ value: SERVICE_ORDER_STATUS.PENDING, label: "Restaurar" });
                            }
                          } else {
                            // Fallback
                            statusOptions.push(
                              { value: SERVICE_ORDER_STATUS.PENDING, label: "Pendente" },
                              { value: SERVICE_ORDER_STATUS.IN_PROGRESS, label: "Iniciar" },
                              { value: SERVICE_ORDER_STATUS.PAUSED, label: "Pausar" },
                              { value: SERVICE_ORDER_STATUS.COMPLETED, label: "Concluir" },
                            );
                          }

                          // Get trigger style based on current status (matching badge colors)
                          const getStatusTriggerClass = (status: SERVICE_ORDER_STATUS | null) => {
                            switch (status) {
                              case SERVICE_ORDER_STATUS.PENDING:
                                return "bg-neutral-500 text-white hover:bg-neutral-600 border-neutral-600";
                              case SERVICE_ORDER_STATUS.IN_PROGRESS:
                                return "bg-blue-700 text-white hover:bg-blue-800 border-blue-800";
                              case SERVICE_ORDER_STATUS.PAUSED:
                                return "bg-yellow-500 text-white hover:bg-yellow-600 border-yellow-600";
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
                              clearable={false}
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
                          );
                        })}
                      </div>
                        );
                      })}
                  </div>
                </CardContent>
                  </Card>
                );
              })()}

              {/* Truck Layout Card - Only show if truck has at least one layout */}
              {sectionVisibility.isSectionVisible("layout") && task.truck && (task.truck.leftSideLayout || task.truck.rightSideLayout || task.truck.backSideLayout) && (
                <Card className={cn("border flex flex-col animate-in fade-in-50 duration-850", fullSpanSections.has("layout") && "lg:col-span-2")}>
                  <CardHeader className="pb-6">
                    <CardTitle className="flex items-center gap-2">
                      <IconLayoutGrid className="h-5 w-5 text-muted-foreground" />
                      Medidas do Caminhão
                    </CardTitle>
                  </CardHeader>
              <CardContent className="pt-0">
                <TruckLayoutPreview truckId={task.truck.id} taskName={taskDisplayName} />
              </CardContent>
                </Card>
              )}

              {/* Artworks Card - Visible to ALL users, content filtered by approval status */}
              {sectionVisibility.isSectionVisible("artworks") && filteredArtworks.length > 0 && (
                <Card className={cn("border flex flex-col animate-in fade-in-50 duration-1000", fullSpanSections.has("artworks") ? "lg:col-span-2" : "lg:col-span-1")}>
                  <CardHeader className="pb-6">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <IconFiles className="h-5 w-5 text-muted-foreground" />
                        Layouts
                        <Badge variant="secondary" className="ml-2">
                          {filteredArtworks.length}
                        </Badge>
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {filteredArtworks.length > 1 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const apiUrl = getApiBaseUrl();
                              for (let i = 0; i < filteredArtworks.length; i++) {
                                const artwork = filteredArtworks[i];
                                const fileId = (artwork as any)?.file?.id || (artwork as any)?.id;
                                if (fileId) {
                                  const downloadUrl = `${apiUrl}/files/${fileId}/download`;
                                  window.open(downloadUrl, "_blank");
                                }
                                if (i < filteredArtworks.length - 1) {
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
                      {filteredArtworks.map((artwork) => {
                        const fileData = artwork.file || artwork;
                        return (
                          <div key={artwork.id} className="relative">
                            <FileItem
                              file={fileData as any}
                              viewMode={artworksViewMode}
                              onPreview={handleArtworkFileClick}
                              onDownload={handleDownload}
                              showActions
                            />
                            {canViewArtworkBadges && (artwork as any).status && (
                              <div className="absolute top-2 right-2">
                                <Badge
                                  variant={(artwork as any).status === 'APPROVED' ? 'approved' : (artwork as any).status === 'REPROVED' ? 'rejected' : 'secondary'}
                                  className="text-xs"
                                >
                                  {(artwork as any).status === 'APPROVED' ? 'Aprovado' : (artwork as any).status === 'REPROVED' ? 'Reprovado' : 'Rascunho'}
                                </Badge>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Cuts Card - Hidden for Financial sector users */}
              {sectionVisibility.isSectionVisible("cuts") && !isFinancialSector && cuts.length > 0 && (
                <Card className={cn("border flex flex-col animate-in fade-in-50 duration-950", fullSpanSections.has("cuts") ? "lg:col-span-2" : "lg:col-span-1")}>
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
                            const apiUrl = getApiBaseUrl();
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

              {/* Files Card - Unified section for base files and projects */}
              {sectionVisibility.isSectionVisible("files") && (() => {
                const hasBaseFiles = canViewBaseFiles && task.baseFiles && task.baseFiles.length > 0;
                const hasProjectFiles = canViewProjectFiles && task.projectFiles && task.projectFiles.length > 0;
                const totalFiles = (hasBaseFiles ? task.baseFiles!.length : 0) + (hasProjectFiles ? task.projectFiles!.length : 0);

                if (totalFiles === 0) return null;

                return (
                  <Card className={cn("border flex flex-col animate-in fade-in-50 duration-1000", fullSpanSections.has("files") ? "lg:col-span-2" : "lg:col-span-1")}>
                    <CardHeader className="pb-6">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <IconFiles className="h-5 w-5 text-muted-foreground" />
                          Arquivos
                          <Badge variant="secondary" className="ml-2">
                            {totalFiles}
                          </Badge>
                        </CardTitle>
                        <div className="flex gap-1">
                          <Button
                            variant={filesViewMode === "list" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setFilesViewMode("list")}
                            className="h-7 w-7 p-0"
                          >
                            <IconList className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant={filesViewMode === "grid" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setFilesViewMode("grid")}
                            className="h-7 w-7 p-0"
                          >
                            <IconLayoutGrid className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 flex-1">
                      <div className="space-y-6">
                        {/* Base Files - Arquivos Base */}
                        {hasBaseFiles && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <IconFile className="h-4 w-4 text-muted-foreground" />
                              <h4 className="text-sm font-semibold">Arquivos Base</h4>
                              <Badge variant="outline" className="text-xs">{task.baseFiles!.length}</Badge>
                            </div>
                            <div className={cn(filesViewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
                              {task.baseFiles!.map((file) => (
                                <FileItem
                                  key={file.id}
                                  file={file}
                                  viewMode={filesViewMode}
                                  onPreview={handleBaseFileClick}
                                  onDownload={handleDownload}
                                  showActions
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Project Files - Projetos */}
                        {hasProjectFiles && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <IconFile className="h-4 w-4 text-muted-foreground" />
                              <h4 className="text-sm font-semibold">Projetos</h4>
                              <Badge variant="outline" className="text-xs">{task.projectFiles!.length}</Badge>
                            </div>
                            <div className={cn(filesViewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
                              {task.projectFiles!.map((file) => (
                                <FileItem
                                  key={file.id}
                                  file={file}
                                  viewMode={filesViewMode}
                                  onPreview={handleProjectFileClick}
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
                );
              })()}

              {/* Paints Card - Show only if task has general painting or logo paints */}
              {sectionVisibility.isSectionVisible("paints") && (task.generalPainting || (task.logoPaints && task.logoPaints.length > 0)) && (
                <Card className={cn("border flex flex-col animate-in fade-in-50 duration-1150", fullSpanSections.has("paints") && "lg:col-span-2")}>
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
                        {PAINT_FINISH_LABELS[groundPaint.finish as PAINT_FINISH]}
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
                    <h4 className="text-sm font-semibold">Tintas da Logomarca</h4>
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
                <Card className={cn("border flex flex-col animate-in fade-in-50 duration-1200", fullSpanSections.has("observation") && "lg:col-span-2")}>
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
                    if (fileViewerContext && task.observation?.files) {
                      fileViewerContext.actions.viewFiles(task.observation.files, index);
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
                <Card className={cn("border flex flex-col animate-in fade-in-50 duration-1250", fullSpanSections.has("airbrushings") ? "lg:col-span-2" : "lg:col-span-1")}>
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
                    let apiUrl = getApiBaseUrl();
                    apiUrl = apiUrl.replace(/\/+$/, ''); // Remove trailing slashes

                    // Generate proper thumbnail URL - same logic as FileItem component
                    const getArtworkThumbnailUrl = () => {
                      if (!firstArtwork) return null;

                      // If thumbnailUrl exists and is already a full URL
                      if (firstArtwork.thumbnailUrl?.startsWith("http")) {
                        return rewriteCdnUrl(firstArtwork.thumbnailUrl);
                      }

                      // If thumbnailUrl exists (relative path), use thumbnail endpoint
                      if (firstArtwork.thumbnailUrl) {
                        return `${apiUrl}/files/thumbnail/${firstArtwork.id}?size=small`;
                      }

                      // For images without thumbnails, check mimetype and use serve endpoint
                      const mimetype = (firstArtwork as any).mimetype || (firstArtwork as any).mimeType || '';
                      if (typeof mimetype === 'string' && mimetype.startsWith('image/')) {
                        return `${apiUrl}/files/serve/${firstArtwork.id}`;
                      }

                      // Fallback: try to serve anyway (backend will handle it)
                      return `${apiUrl}/files/serve/${firstArtwork.id}`;
                    };
                    const artworkThumbnailUrl = getArtworkThumbnailUrl();

                    return (
                      <div
                        key={airbrushing.id}
                        className={cn(
                          "border border-border dark:border-border/30 rounded-lg p-4 transition-colors",
                          canAccessAirbrushingDetails && "hover:bg-muted/50 cursor-pointer"
                        )}
                        onClick={canAccessAirbrushingDetails ? () => navigate(routes.production.airbrushings.details(airbrushing.id)) : undefined}
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

              {/* Dossiê Card - Proof of services organized by service order with check-in/check-out files */}
              {sectionVisibility.isSectionVisible("dossie") && canViewCheckinFiles && hasDossieContent && (() => {
                const serviceOrdersWithFiles = (task.serviceOrders || [])
                  .filter((so: any) => so.type === SERVICE_ORDER_TYPE.PRODUCTION && (so.checkinFiles?.length > 0 || so.checkoutFiles?.length > 0))
                  .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));

                if (serviceOrdersWithFiles.length === 0) return null;

                const totalDossieFiles = serviceOrdersWithFiles.reduce(
                  (sum: number, so: any) => sum + (so.checkinFiles?.length || 0) + (so.checkoutFiles?.length || 0), 0
                );

                return (
                  <Card className={cn("border border-border/40 flex flex-col animate-in fade-in-50 duration-1200", fullSpanSections.has("dossie") ? "lg:col-span-2" : "lg:col-span-1")}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <IconFolderCheck className="h-5 w-5 text-muted-foreground" />
                          Dossiê
                          <Badge variant="secondary" className="ml-1">
                            {totalDossieFiles} {totalDossieFiles === 1 ? 'foto' : 'fotos'}
                          </Badge>
                        </CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1"
                          onClick={() => {
                            exportDossiePdf({
                              taskDisplayName,
                              customerName: task.customer?.corporateName || task.customer?.fantasyName || undefined,
                              serialNumber: task.serialNumber,
                              plate: task.truck?.plate,
                              serviceOrders: serviceOrdersWithFiles.map((so: any) => ({
                                id: so.id,
                                description: so.description,
                                observation: so.observation,
                                position: so.position,
                                checkinFiles: so.checkinFiles || [],
                                checkoutFiles: so.checkoutFiles || [],
                              })),
                            }).catch((err) => {
                              console.error('[Dossiê PDF] Error:', err);
                            });
                          }}
                        >
                          <IconDownload className="h-3.5 w-3.5" />
                          PDF
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Registro fotográfico dos serviços por ordem de serviço
                      </p>
                    </CardHeader>
                    <CardContent className="pt-0 flex-1">
                      <div className="grid grid-cols-2 gap-4">
                        {serviceOrdersWithFiles.map((serviceOrder: any) => {
                          const isOutrosWithObservation = serviceOrder.description === 'Outros' && !!serviceOrder.observation;
                          const displayDescription = isOutrosWithObservation ? serviceOrder.observation : serviceOrder.description;
                          const checkinFiles = serviceOrder.checkinFiles || [];
                          const checkoutFiles = serviceOrder.checkoutFiles || [];
                          const apiUrl = getApiBaseUrl();

                          return (
                            <div key={serviceOrder.id} className="border border-border/30 rounded-lg overflow-hidden">
                              {/* Service Order Header */}
                              <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b border-border/30">
                                <h4 className="text-xs font-semibold truncate">{displayDescription}</h4>
                                {!isOutrosWithObservation && serviceOrder.observation && (
                                  <HoverCard openDelay={100} closeDelay={100}>
                                    <HoverCardTrigger asChild>
                                      <button className="relative flex items-center justify-center h-4 w-4 rounded border border-border/40 bg-background hover:bg-accent transition-colors flex-shrink-0">
                                        <IconNote className="h-2.5 w-2.5" />
                                      </button>
                                    </HoverCardTrigger>
                                    <HoverCardContent className="w-64 p-3" side="top">
                                      <p className="text-sm text-muted-foreground">{serviceOrder.observation}</p>
                                    </HoverCardContent>
                                  </HoverCard>
                                )}
                              </div>

                              {/* Check-in / Check-out Content */}
                              <div className="px-3 py-3 space-y-5">
                                {/* Check-in */}
                                <div className="space-y-2">
                                  <div className="flex items-center gap-1.5">
                                    <IconCameraCheck className="h-4 w-4 text-blue-500" />
                                    <span className="text-xs font-medium">Check-in</span>
                                    <span className="text-[11px] text-muted-foreground">{checkinFiles.length}</span>
                                  </div>
                                  {checkinFiles.length > 0 ? (
                                    <div className="flex gap-1.5 flex-wrap">
                                      {checkinFiles.map((file: any) => {
                                        const src = file.thumbnailUrl
                                          ? (file.thumbnailUrl.startsWith('/api') ? `${apiUrl}${file.thumbnailUrl}` : file.thumbnailUrl)
                                          : `${apiUrl}/files/thumbnail/${file.id}`;
                                        return (
                                          <button
                                            key={file.id}
                                            onClick={() => handleDossieFileClick(serviceOrder, file)}
                                            className="relative flex-shrink-0 w-16 h-16 rounded overflow-hidden border border-border/30 bg-muted hover:opacity-80 transition-opacity cursor-pointer"
                                          >
                                            <img
                                              src={src}
                                              alt={file.originalName || file.filename}
                                              className="w-full h-full object-cover"
                                            />
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-[11px] text-muted-foreground italic">Nenhuma foto</p>
                                  )}
                                </div>

                                {/* Check-out */}
                                <div className="space-y-2">
                                  <div className="flex items-center gap-1.5">
                                    <IconCameraBolt className="h-4 w-4 text-green-500" />
                                    <span className="text-xs font-medium">Check-out</span>
                                    <span className="text-[11px] text-muted-foreground">{checkoutFiles.length}</span>
                                  </div>
                                  {checkoutFiles.length > 0 ? (
                                    <div className="flex gap-1.5 flex-wrap">
                                      {checkoutFiles.map((file: any) => {
                                        const src = file.thumbnailUrl
                                          ? (file.thumbnailUrl.startsWith('/api') ? `${apiUrl}${file.thumbnailUrl}` : file.thumbnailUrl)
                                          : `${apiUrl}/files/thumbnail/${file.id}`;
                                        return (
                                          <button
                                            key={file.id}
                                            onClick={() => handleDossieFileClick(serviceOrder, file)}
                                            className="relative flex-shrink-0 w-16 h-16 rounded overflow-hidden border border-border/30 bg-muted hover:opacity-80 transition-opacity cursor-pointer"
                                          >
                                            <img
                                              src={src}
                                              alt={file.originalName || file.filename}
                                              className="w-full h-full object-cover"
                                            />
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-[11px] text-muted-foreground italic">Nenhuma foto</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </div>

            {/* Changelog History - Hidden for Warehouse and Production (except team leaders) */}
            {sectionVisibility.isSectionVisible("changelog") && !isWarehouseSector && (!isProductionSector || isTeamLeader(currentUser)) && (
              <TaskWithServiceOrdersChangelog
                taskId={task.id}
                taskName={taskDisplayName}
                taskCreatedAt={task.createdAt}
                serviceOrderIds={task.serviceOrders?.map(s => s.id) || []}
                truckId={task.truck?.id}
                layoutIds={[
                  task.truck?.leftSideLayoutId,
                  task.truck?.rightSideLayoutId,
                  task.truck?.backSideLayoutId,
                ].filter(Boolean) as string[]}
                quoteId={canViewQuoteSection ? task.quote?.id : undefined}
                className="lg:w-1/2 animate-in fade-in-50 duration-1300"
                maxHeight="45rem"
              />
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

        {/* Pricing Status Confirmation Dialog */}
        <AlertDialog open={quoteConfirmDialog.open} onOpenChange={(open) => setQuoteConfirmDialog((prev) => ({ ...prev, open }))}>
          <AlertDialogContent className={quoteConfirmDialog.title === 'BILLING_APPROVED_WARNING' ? 'max-w-lg border-red-500 border-2' : ''}>
            {quoteConfirmDialog.title === 'BILLING_APPROVED_WARNING' ? (
              <>
                <AlertDialogHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                      <IconAlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
                    </div>
                    <AlertDialogTitle className="text-xl text-red-700 dark:text-red-400">
                      Faturamento Aprovado - Ação Irreversível
                    </AlertDialogTitle>
                  </div>
                </AlertDialogHeader>

                <div className="rounded-lg border-2 border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-4 my-2 space-y-3">
                  <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                    Ao confirmar, as seguintes ações serão executadas automaticamente:
                  </p>
                  <ul className="text-sm text-red-700 dark:text-red-400 space-y-2 list-none">
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 font-bold">1.</span>
                      <span><strong>Faturas</strong> serão geradas para cada cliente vinculado ao orçamento</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 font-bold">2.</span>
                      <span><strong>Boletos bancários</strong> serão emitidos automaticamente no Sicredi para cada parcela</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 font-bold">3.</span>
                      <span><strong>Notas Fiscais (NFS-e)</strong> serao emitidas automaticamente para cada fatura</span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 my-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Verifique antes de confirmar:
                  </p>
                  <ul className="text-sm text-amber-700 dark:text-amber-400 mt-1 space-y-1 list-disc list-inside">
                    <li>Valores, descontos e condições de pagamento estão corretos?</li>
                    <li>Os dados do(s) cliente(s) estão atualizados (CNPJ/CPF, endereço)?</li>
                    <li>As parcelas e datas de vencimento estão configuradas?</li>
                  </ul>
                </div>

                <AlertDialogDescription className="text-sm text-muted-foreground mt-1">
                  Essa ação não pode ser desfeita facilmente. Boletos e notas fiscais emitidos precisarão ser cancelados manualmente caso haja algum erro.
                </AlertDialogDescription>

                <AlertDialogFooter className="mt-2">
                  <AlertDialogCancel disabled={isUpdatingQuoteStatus}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isUpdatingQuoteStatus}
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={async () => {
                      await executeQuoteStatusChange(quoteConfirmDialog.newStatus);
                      setQuoteConfirmDialog((prev) => ({ ...prev, open: false }));
                    }}
                  >
                    {isUpdatingQuoteStatus ? 'Processando...' : 'Confirmar Faturamento Aprovado'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            ) : (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>{quoteConfirmDialog.title}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {quoteConfirmDialog.description}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isUpdatingQuoteStatus}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isUpdatingQuoteStatus}
                    onClick={async () => {
                      await executeQuoteStatusChange(quoteConfirmDialog.newStatus);
                      setQuoteConfirmDialog((prev) => ({ ...prev, open: false }));
                    }}
                  >
                    {isUpdatingQuoteStatus ? 'Processando...' : 'Confirmar'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            )}
          </AlertDialogContent>
        </AlertDialog>

        {/* Reject/Cancel reason dialog — required min 5 chars when reverting to PENDING. */}
        <Dialog
          open={rejectDialog.open}
          onOpenChange={(open) => setRejectDialog((prev) => ({ ...prev, open }))}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeitar Orçamento</DialogTitle>
              <DialogDescription>
                Informe o motivo da rejeição. O status do orçamento voltará para Pendente.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-2">
              <Label htmlFor="quote-reject-reason" className="text-sm font-medium">
                Motivo da rejeição <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="quote-reject-reason"
                value={rejectDialog.reason}
                onChange={(e) =>
                  setRejectDialog((prev) => ({ ...prev, reason: e.target.value }))
                }
                placeholder="Descreva o motivo (mínimo 5 caracteres)..."
                rows={4}
                className="resize-none"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRejectDialog({ open: false, newStatus: '', reason: '' })}
                disabled={isUpdatingQuoteStatus}
              >
                Voltar
              </Button>
              <Button
                variant="destructive"
                disabled={
                  isUpdatingQuoteStatus || rejectDialog.reason.trim().length < 5
                }
                onClick={async () => {
                  const reason = rejectDialog.reason.trim();
                  if (reason.length < 5) return;
                  const targetStatus = rejectDialog.newStatus;
                  await executeQuoteStatusChange(targetStatus, reason);
                  setRejectDialog({ open: false, newStatus: '', reason: '' });
                }}
              >
                {isUpdatingQuoteStatus ? 'Processando...' : 'Confirmar Rejeição'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

    </PrivilegeRoute>
  );
};

function DownloadAllBoletosButton({ installments }: { installments: any[] }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadable = installments.filter(
    (inst) => inst.bankSlip && (inst.bankSlip.status === 'ACTIVE' || inst.bankSlip.status === 'OVERDUE'),
  );

  if (downloadable.length < 2) return null;

  const handleDownloadAll = async () => {
    setIsDownloading(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (const inst of downloadable) {
        const res = await invoiceService.getBoletoPdf(inst.id);
        const blob = res.data instanceof Blob
          ? res.data
          : new Blob([res.data], { type: 'application/pdf' });
        zip.file(`boleto-parcela-${inst.number}.pdf`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `boletos.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDownloadAll}
      disabled={isDownloading}
      title="Baixar todos os boletos"
      className="h-7 px-2 text-xs gap-1"
    >
      {isDownloading ? (
        <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <IconDownload className="h-3.5 w-3.5" />
      )}
      Baixar todos
    </Button>
  );
}

function NfsePdfButtons({ elotechNfseId }: { elotechNfseId: number }) {
  const [isViewing, setIsViewing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchPdf = async () => {
    const res = await nfseService.getPdf(elotechNfseId);
    return res.data instanceof Blob
      ? res.data
      : new Blob([res.data], { type: 'application/pdf' });
  };

  const handleView = async () => {
    setIsViewing(true);
    try {
      const blob = await fetchPdf();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      // silently fail
    } finally {
      setIsViewing(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const blob = await fetchPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nfse-${elotechNfseId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleView}
        disabled={isViewing}
        title="Visualizar NFS-e"
        className="h-7 w-7 p-0"
      >
        {isViewing ? (
          <IconLoader2 className="h-4 w-4 animate-spin" />
        ) : (
          <IconEye className="h-4 w-4" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDownload}
        disabled={isDownloading}
        title="Baixar NFS-e"
        className="h-7 w-7 p-0"
      >
        {isDownloading ? (
          <IconLoader2 className="h-4 w-4 animate-spin" />
        ) : (
          <IconDownload className="h-4 w-4" />
        )}
      </Button>
    </>
  );
}

export default TaskDetailsPage;
