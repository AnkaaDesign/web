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
  IconListCheck,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { routes, SECTOR_PRIVILEGES, SERVICE_ORDER_STATUS as SO_STATUS, SERVICE_ORDER_STATUS_LABELS, SERVICE_ORDER_TYPE } from '@/constants';
import { getServiceOrderStatusColor } from '@/utils/serviceOrder';
import { useNavigate } from 'react-router-dom';
import { hasPrivilege } from '@/utils/user';
import { getApiBaseUrl } from '@/config/api';

interface TruckDetailModalProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}


export function TruckDetailModal({ taskId, open, onOpenChange }: TruckDetailModalProps) {
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();

  // File preview state
  const [previewFiles, setPreviewFiles] = useState<any[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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
      serviceOrders: true,
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

  // Get layout dimensions (both sides have the same measures)
  const layoutDimensions = useMemo(() => {
    if (!task?.truck) return null;
    const truck = task.truck as any;
    const layout = truck?.leftSideLayout || truck?.rightSideLayout;
    if (!layout || !layout.layoutSections || layout.layoutSections.length === 0) return null;
    const totalLength = layout.layoutSections.reduce(
      (sum: number, section: { width: number }) => sum + (section.width || 0),
      0
    );
    return {
      totalLength,
      height: layout.height,
    };
  }, [task]);

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

            {/* Layout dimensions */}
            {layoutDimensions && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconLayoutGrid className="h-4 w-4" />
                  Layout
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {Math.round(layoutDimensions.totalLength * 100)} x {Math.round(layoutDimensions.height * 100)} cm
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

            {/* Service Orders (Production) */}
            {task.serviceOrders && (() => {
              const productionSOs = (task.serviceOrders as any[]).filter(
                (so: any) => so.type === SERVICE_ORDER_TYPE.PRODUCTION
              );
              if (productionSOs.length === 0) return null;

              const completedCount = productionSOs.filter((so: any) => so.status === SO_STATUS.COMPLETED).length;
              const totalCount = productionSOs.length;

              return (
                <div className="bg-muted/50 rounded-lg px-4 py-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconListCheck className="h-4 w-4" />
                      Ordens de Produção
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {completedCount}/{totalCount}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="relative h-5 w-full bg-gray-200 dark:bg-gray-700 rounded overflow-hidden shadow-sm mb-2">
                    {(() => {
                      const completed = productionSOs.filter((so: any) => so.status === SO_STATUS.COMPLETED).length;
                      const waitingApprove = productionSOs.filter((so: any) => so.status === SO_STATUS.WAITING_APPROVE).length;
                      const inProgress = productionSOs.filter((so: any) => so.status === SO_STATUS.IN_PROGRESS).length;
                      const pending = productionSOs.filter((so: any) => so.status === SO_STATUS.PENDING).length;
                      const cancelled = productionSOs.filter((so: any) => so.status === SO_STATUS.CANCELLED).length;

                      const pCompleted = (completed / totalCount) * 100;
                      const pWaiting = (waitingApprove / totalCount) * 100;
                      const pProgress = (inProgress / totalCount) * 100;
                      const pPending = (pending / totalCount) * 100;
                      const pCancelled = (cancelled / totalCount) * 100;

                      return (
                        <>
                          {completed > 0 && <div className="absolute h-full bg-green-700 transition-all duration-300" style={{ left: '0%', width: `${pCompleted}%` }} />}
                          {waitingApprove > 0 && <div className="absolute h-full bg-purple-600 transition-all duration-300" style={{ left: `${pCompleted}%`, width: `${pWaiting}%` }} />}
                          {inProgress > 0 && <div className="absolute h-full bg-blue-700 transition-all duration-300" style={{ left: `${pCompleted + pWaiting}%`, width: `${pProgress}%` }} />}
                          {pending > 0 && <div className="absolute h-full bg-neutral-500 transition-all duration-300" style={{ left: `${pCompleted + pWaiting + pProgress}%`, width: `${pPending}%` }} />}
                          {cancelled > 0 && <div className="absolute h-full bg-red-700 transition-all duration-300" style={{ left: `${pCompleted + pWaiting + pProgress + pPending}%`, width: `${pCancelled}%` }} />}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                              {completedCount}/{totalCount}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  {/* Service order list */}
                  <div className="space-y-1.5">
                    {productionSOs.map((so: any, index: number) => (
                      <div key={so.id || index} className="flex items-center justify-between gap-2 py-1 border-b border-border/30 last:border-0">
                        <span className="text-xs flex-1 break-words text-foreground">
                          {so.description || <span className="text-muted-foreground italic">Sem descrição</span>}
                        </span>
                        <Badge
                          variant={getServiceOrderStatusColor(so.status)}
                          className="text-[10px] px-1.5 py-0 h-5 flex-shrink-0"
                        >
                          {SERVICE_ORDER_STATUS_LABELS[so.status as SO_STATUS]}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

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
