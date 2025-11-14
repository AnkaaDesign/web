import React, { useState } from 'react';
import { useBackups, useBackupMutations } from '@/hooks/useBackup';
import { BackupProgressBar } from './BackupProgress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDistanceToNow, isAfter, isBefore, addDays } from 'date-fns';
import {
  CheckCircle2,
  Clock,
  Database,
  FileStack,
  HardDrive,
  Loader2,
  MoreVertical,
  Package,
  Shield,
  Trash2,
  XCircle,
  Calendar,
  AlertTriangle,
  Download,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BackupListProps {
  className?: string;
  onViewDetails?: (backupId: string) => void;
}

const RETENTION_LABELS: Record<string, string> = {
  '1_day': '1 Day',
  '3_days': '3 Days',
  '1_week': '1 Week',
  '2_weeks': '2 Weeks',
  '1_month': '1 Month',
  '3_months': '3 Months',
  '6_months': '6 Months',
  '1_year': '1 Year',
};

export function BackupList({ className, onViewDetails }: BackupListProps) {
  const { data: backups, isLoading, refetch } = useBackups();
  const mutations = useBackupMutations();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await mutations.delete.mutateAsync(deleteTarget);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Failed to delete backup:', error);
    }
  };

  const handleRestore = async (backupId: string) => {
    try {
      await mutations.restore.mutateAsync({ id: backupId });
    } catch (error) {
      console.error('Failed to restore backup:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'in_progress':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'database':
        return <Database className="w-4 h-4" />;
      case 'files':
        return <FileStack className="w-4 h-4" />;
      case 'system':
        return <HardDrive className="w-4 h-4" />;
      case 'full':
        return <Package className="w-4 h-4" />;
      default:
        return <FileStack className="w-4 h-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getDeleteWarning = (deleteAfter?: string) => {
    if (!deleteAfter) return null;

    const deleteDate = new Date(deleteAfter);
    const now = new Date();
    const daysUntilDeletion = Math.ceil((deleteDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDeletion <= 0) {
      return { type: 'expired', message: 'Expired - Will be deleted soon' };
    } else if (daysUntilDeletion <= 1) {
      return { type: 'critical', message: 'Deleting tomorrow' };
    } else if (daysUntilDeletion <= 7) {
      return { type: 'warning', message: `Deleting in ${daysUntilDeletion} days` };
    }

    return null;
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className={cn('rounded-md border', className)}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Auto-Delete</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {backups?.map((backup) => {
              const deleteWarning = getDeleteWarning(backup.autoDelete?.deleteAfter);

              return (
                <TableRow key={backup.id}>
                  <TableCell>{getTypeIcon(backup.type)}</TableCell>
                  <TableCell className="font-medium">
                    <div>
                      <div className="flex items-center gap-2">
                        {backup.name}
                        {backup.encrypted && (
                          <Shield className="w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                      {backup.description && (
                        <p className="text-sm text-muted-foreground">{backup.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {backup.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(backup.status)}
                      <span className="capitalize">{backup.status}</span>
                      {backup.status === 'in_progress' && backup.progress !== undefined && (
                        <div className="w-24">
                          <BackupProgressBar backupId={backup.id} />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatFileSize(backup.size)}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-sm">
                        {format(new Date(backup.createdAt), 'MMM d, yyyy')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(backup.createdAt), 'h:mm a')}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {backup.autoDelete?.enabled ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span className="text-sm">
                            {RETENTION_LABELS[backup.autoDelete.retention]}
                          </span>
                        </div>
                        {backup.autoDelete.deleteAfter && (
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(backup.autoDelete.deleteAfter), 'MMM d, yyyy')}
                          </div>
                        )}
                        {deleteWarning && (
                          <Badge
                            variant={
                              deleteWarning.type === 'expired'
                                ? 'destructive'
                                : deleteWarning.type === 'critical'
                                ? 'destructive'
                                : 'secondary'
                            }
                            className="text-xs"
                          >
                            {deleteWarning.type === 'critical' && (
                              <AlertTriangle className="w-3 h-3 mr-1" />
                            )}
                            {deleteWarning.message}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onViewDetails?.(backup.id)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        {backup.status === 'completed' && (
                          <>
                            <DropdownMenuItem>
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRestore(backup.id)}>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Restore
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteTarget(backup.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}

            {(!backups || backups.length === 0) && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No backups found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Backup</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this backup? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default BackupList;