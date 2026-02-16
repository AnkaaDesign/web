import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useTaskDetail, useCurrentUser } from '@/hooks';
import { formatDateTime } from '@/lib/utils';
import { CustomerLogoDisplay } from '@/components/ui/avatar-display';
import { FilePreviewCard } from '@/components/common/file/file-preview-card';
import { FilePreviewModal } from '@/components/common/file';
import {
  IconHash,
  IconCar,
  IconBuilding,
  IconCalendarTime,
  IconCalendarEvent,
  IconFiles,
  IconExternalLink,
  IconLayoutGrid,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { routes, SECTOR_PRIVILEGES } from '@/constants';
import { useNavigate } from 'react-router-dom';
import { hasPrivilege } from '@/utils/user';
import { getApiBaseUrl } from '@/config/api';

interface TruckDetailModalProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Generate SVG preview for layout
function generateLayoutSVG(layout: any): string {
  if (!layout || !layout.layoutSections || layout.layoutSections.length === 0) {
    return '';
  }

  const height = layout.height * 100; // Convert to cm
  const sections = layout.layoutSections;
  const totalWidth = sections.reduce((sum: number, s: any) => sum + s.width * 100, 0);
  const margin = 30;
  const svgWidth = totalWidth + margin * 2;
  const svgHeight = height + margin * 2 + 30; // Extra space for dimensions

  let svg = `<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">`;

  // Main container
  svg += `<rect x="${margin}" y="${margin}" width="${totalWidth}" height="${height}" fill="none" stroke="currentColor" stroke-width="1"/>`;

  // Add section dividers
  let currentPos = 0;
  sections.forEach((section: any, index: number) => {
    const sectionWidth = section.width * 100;

    if (index > 0) {
      const prevSection = sections[index - 1];
      if (!section.isDoor && !prevSection.isDoor) {
        const lineX = margin + currentPos;
        svg += `<line x1="${lineX}" y1="${margin}" x2="${lineX}" y2="${margin + height}" stroke="currentColor" stroke-width="0.5" opacity="0.5"/>`;
      }
    }

    // Handle doors
    if (section.isDoor && section.doorHeight !== null && section.doorHeight !== undefined) {
      const doorHeightCm = section.doorHeight * 100;
      const doorTopY = margin + (height - doorHeightCm);
      const sectionX = margin + currentPos;

      svg += `<line x1="${sectionX}" y1="${doorTopY}" x2="${sectionX}" y2="${margin + height}" stroke="currentColor" stroke-width="1"/>`;
      svg += `<line x1="${sectionX + sectionWidth}" y1="${doorTopY}" x2="${sectionX + sectionWidth}" y2="${margin + height}" stroke="currentColor" stroke-width="1"/>`;
      svg += `<line x1="${sectionX}" y1="${doorTopY}" x2="${sectionX + sectionWidth}" y2="${doorTopY}" stroke="currentColor" stroke-width="1"/>`;
    }

    currentPos += sectionWidth;
  });

  // Add dimension labels
  currentPos = 0;
  sections.forEach((section: any) => {
    const sectionWidth = section.width * 100;
    const startX = margin + currentPos;
    const centerX = startX + sectionWidth / 2;
    const dimY = margin + height + 15;

    svg += `<text x="${centerX}" y="${dimY}" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">${Math.round(sectionWidth)}</text>`;
    currentPos += sectionWidth;
  });

  svg += '</svg>';
  return svg;
}

export function TruckDetailModal({ taskId, open, onOpenChange }: TruckDetailModalProps) {
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();

  // File preview state
  const [previewFiles, setPreviewFiles] = useState<any[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Layout side toggle state
  const [layoutSide, setLayoutSide] = useState<'left' | 'right'>('left');

  const { data: taskResponse, isLoading } = useTaskDetail(taskId ?? '', {
    enabled: open && !!taskId,
    include: {
      customer: true,
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
        },
      },
      artworks: {
        include: {
          file: true,
        },
      },
    },
  });

  const task = taskResponse?.data;

  // Check if user can view artwork badges and non-approved artworks (ADMIN, COMMERCIAL, LOGISTIC, DESIGNER only)
  const canViewArtworkBadges = currentUser && (
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.COMMERCIAL) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.LOGISTIC) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.DESIGNER)
  );

  // Get layout data for both sides
  const layoutsData = useMemo(() => {
    if (!task?.truck) return null;
    const truck = task.truck as any;

    const buildLayoutData = (layout: any) => {
      if (!layout || !layout.layoutSections || layout.layoutSections.length === 0) return null;
      const sectionsSum = layout.layoutSections.reduce(
        (sum: number, section: { width: number }) => sum + (section.width || 0),
        0
      );
      return {
        name: layout?.name || 'Layout',
        sectionsCount: layout.layoutSections.length,
        totalLength: sectionsSum,
        height: layout.height,
        layout: layout,
        svg: generateLayoutSVG(layout),
      };
    };

    const left = buildLayoutData(truck?.leftSideLayout);
    const right = buildLayoutData(truck?.rightSideLayout);

    if (!left && !right) return null;

    return { left, right };
  }, [task]);

  // Current layout based on selected side
  const currentLayout = layoutsData ? (layoutSide === 'left' ? layoutsData.left : layoutsData.right) : null;
  const hasMultipleSides = layoutsData?.left && layoutsData?.right;

  // Check if term is overdue
  const isOverdue = useMemo(() => {
    if (!task?.term) return false;
    return new Date(task.term) < new Date();
  }, [task]);

  // Filter artworks: show all if user can view badges, otherwise only approved
  // Note: artwork can have file data nested in .file OR directly on artwork object
  const filteredArtworks = useMemo(() => {
    if (!task?.artworks) return [];

    return (task.artworks as any[]).filter((artwork) => {
      // Check if artwork has file data - either nested in .file or directly on artwork
      const hasFileData = artwork.file || artwork.filename || artwork.path;
      return hasFileData && (canViewArtworkBadges || artwork.status === 'APPROVED');
    });
  }, [task, canViewArtworkBadges]);

  const handleOpenTaskDetail = () => {
    if (taskId) {
      navigate(routes.production.schedule.details(taskId));
      onOpenChange(false);
    }
  };

  const handleDownload = (file: any) => {
    const apiUrl = getApiBaseUrl();
    const downloadUrl = `${apiUrl}/files/${file.id}/download`;
    window.open(downloadUrl, '_blank');
  };

  // Handle file preview
  const handlePreview = (_file: any, index: number) => {
    // Get all file data from filtered artworks
    const allFiles = filteredArtworks.map(artwork => artwork.file || artwork);
    setPreviewFiles(allFiles);
    setPreviewIndex(index);
    setIsPreviewOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center justify-between">
            <span>{task?.name || 'Detalhes da Tarefa'}</span>
            {task && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenTaskDetail}
                className="text-muted-foreground hover:text-foreground -mr-2"
              >
                <IconExternalLink className="h-4 w-4 mr-1" />
                Abrir
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : task ? (
          <div className="space-y-3">
            {/* Customer */}
            {task.customer && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconBuilding className="h-4 w-4" />
                  Cliente
                </span>
                <div className="flex items-center gap-2">
                  <CustomerLogoDisplay
                    logo={(task.customer as any).logo}
                    customerName={(task.customer as any).fantasyName}
                    size="sm"
                    shape="rounded"
                    className="flex-shrink-0"
                  />
                  <span className="text-sm font-semibold text-foreground text-right">
                    {(task.customer as any).fantasyName}
                  </span>
                </div>
              </div>
            )}

            {/* Serial Number */}
            {task.serialNumber && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconHash className="h-4 w-4" />
                  Número de Série
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {task.serialNumber}
                </span>
              </div>
            )}

            {/* Plate */}
            {(task.truck as any)?.plate && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCar className="h-4 w-4" />
                  Placa
                </span>
                <span className="text-sm font-semibold text-foreground uppercase">
                  {(task.truck as any).plate}
                </span>
              </div>
            )}

            {/* Forecast Date */}
            {task.forecastDate && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCalendarTime className="h-4 w-4" />
                  Previsão
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {formatDateTime(task.forecastDate)}
                </span>
              </div>
            )}

            {/* Term */}
            {task.term && (
              <div
                className={cn(
                  'flex justify-between items-center rounded-lg px-4 py-2.5',
                  isOverdue
                    ? 'bg-red-50/50 dark:bg-red-900/20 border border-red-200/40 dark:border-red-700/40'
                    : 'bg-muted/50'
                )}
              >
                <span
                  className={cn(
                    'text-sm font-medium flex items-center gap-2',
                    isOverdue ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground'
                  )}
                >
                  <IconCalendarEvent className="h-4 w-4" />
                  Prazo
                </span>
                <span
                  className={cn(
                    'text-sm font-semibold',
                    isOverdue ? 'text-red-800 dark:text-red-200' : 'text-foreground'
                  )}
                >
                  {formatDateTime(task.term)}
                  {isOverdue && ' (Atrasado)'}
                </span>
              </div>
            )}

            {/* Artworks */}
            {filteredArtworks.length > 0 && (
              <div className="flex justify-between items-start bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2 pt-1">
                  <IconFiles className="h-4 w-4" />
                  Artes
                </span>
                <div className="flex flex-wrap gap-2 justify-end">
                  {filteredArtworks.map((artwork: any, index: number) => {
                    // File data can be nested in .file or directly on artwork
                    const fileData = artwork.file || artwork;
                    return (
                      <div key={artwork.id} className="relative">
                        <FilePreviewCard
                          file={fileData}
                          size="sm"
                          index={index}
                          onPreview={handlePreview}
                          onDownload={handleDownload}
                          showActions
                          showMetadata={false}
                        />
                        {canViewArtworkBadges && artwork.status && (
                          <div className="absolute top-1 right-1">
                            <Badge
                              variant={artwork.status === 'APPROVED' ? 'approved' : artwork.status === 'REJECTED' ? 'rejected' : 'secondary'}
                              className="text-[10px] px-1.5 py-0"
                            >
                              {artwork.status === 'APPROVED' ? 'Aprovado' : artwork.status === 'REJECTED' ? 'Reprovado' : 'Rascunho'}
                            </Badge>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Layout Visual Preview - Last position with side toggle */}
            {layoutsData && (
              <div className="bg-muted/50 rounded-lg px-4 py-3">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconLayoutGrid className="h-4 w-4" />
                    Layout
                  </span>
                  <div className="flex items-center gap-2">
                    {hasMultipleSides && (
                      <div className="flex rounded-md border border-border overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setLayoutSide('left')}
                          className={cn(
                            'px-2 py-0.5 text-xs transition-colors',
                            layoutSide === 'left'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-background text-muted-foreground hover:bg-muted'
                          )}
                        >
                          Esquerdo
                        </button>
                        <button
                          type="button"
                          onClick={() => setLayoutSide('right')}
                          className={cn(
                            'px-2 py-0.5 text-xs transition-colors',
                            layoutSide === 'right'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-background text-muted-foreground hover:bg-muted'
                          )}
                        >
                          Direito
                        </button>
                      </div>
                    )}
                    {currentLayout && (
                      <span className="text-xs text-muted-foreground">
                        {Math.round(currentLayout.totalLength * 100)} x {Math.round(currentLayout.height * 100)} cm
                      </span>
                    )}
                  </div>
                </div>
                {currentLayout ? (
                  <div className="bg-background rounded border p-3 flex items-center justify-center">
                    <div
                      dangerouslySetInnerHTML={{ __html: currentLayout.svg }}
                      className="w-full max-w-full overflow-hidden [&>svg]:mx-auto [&>svg]:block [&>svg]:w-auto [&>svg]:h-auto [&>svg]:max-w-full [&>svg]:max-h-[120px] text-foreground"
                    />
                  </div>
                ) : (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    Layout {layoutSide === 'left' ? 'esquerdo' : 'direito'} não disponível
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Tarefa não encontrada
          </div>
        )}
      </DialogContent>

      {/* File Preview Modal */}
      <FilePreviewModal
        files={previewFiles}
        initialFileIndex={previewIndex}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
      />
    </Dialog>
  );
}
