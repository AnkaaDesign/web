import { useState } from 'react';
import { useBackupProgress } from '@/hooks/server/use-backup-progress';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Clock,
  FileStack,
  Gauge,
  Loader2,
  WifiOff,
  AlertCircle,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BackupProgressProps {
  backupId: string;
  backupName?: string;
  onComplete?: () => void;
  className?: string;
}

export function BackupProgress({
  backupId,
  backupName,
  onComplete,
  className,
}: BackupProgressProps) {
  const {
    displayProgress,
    filesProcessed,
    totalFiles,
    rate,
    formattedRate,
    isConnected,
    isCompleted,
    error,
    reconnect,
    getEstimatedTimeRemaining,
  } = useBackupProgress(backupId, {
    onComplete: () => {
      onComplete?.();
    },
  });

  const [showDetails, setShowDetails] = useState(false);
  const estimatedTime = getEstimatedTimeRemaining();

  // Calculate visual progress with smooth interpolation
  const visualProgress = Math.min(100, Math.max(0, displayProgress));

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <Loader2 className="w-5 h-5 animate-spin" />
            )}
            {backupName || `Backup ${backupId.substring(0, 8)}`}
          </CardTitle>
          <div className="flex items-center gap-2">
            {!isConnected && !isCompleted && (
              <Badge variant="outline" className="gap-1">
                <WifiOff className="w-3 h-3" />
                Offline
              </Badge>
            )}
            {isCompleted ? (
              <Badge className="bg-green-500">Completed</Badge>
            ) : (
              <Badge variant="secondary">{Math.round(displayProgress)}%</Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={visualProgress} className="h-3" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{Math.round(displayProgress)}%</span>
            {estimatedTime && !isCompleted && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {estimatedTime.formatted} remaining
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 pt-2">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <FileStack className="w-4 h-4" />
              <span className="text-xs">Files</span>
            </div>
            <p className="text-sm font-medium">
              {filesProcessed.toLocaleString()}
              {totalFiles > 0 && ` / ${totalFiles.toLocaleString()}`}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Gauge className="w-4 h-4" />
              <span className="text-xs">Speed</span>
            </div>
            <p className="text-sm font-medium">{formattedRate || '—'}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="text-xs">Time</span>
            </div>
            <p className="text-sm font-medium">
              {estimatedTime ? estimatedTime.formatted : '—'}
            </p>
          </div>
        </div>

        {/* Error or Connection Issues */}
        {error && (
          <Alert variant="destructive" className="mt-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error.message}</span>
              <Button size="sm" variant="outline" onClick={reconnect}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!isConnected && !isCompleted && !error && (
          <Alert className="mt-3">
            <WifiOff className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Connection lost. Trying to reconnect...</span>
              <Button size="sm" variant="outline" onClick={reconnect}>
                Reconnect
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Detailed View Toggle */}
        {!isCompleted && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full"
          >
            {showDetails ? 'Hide' : 'Show'} Details
          </Button>
        )}

        {/* Detailed Stats (when expanded) */}
        {showDetails && !isCompleted && (
          <div className="border-t pt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Connection Status:</span>
              <span className={cn(isConnected ? 'text-green-500' : 'text-red-500')}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Backup ID:</span>
              <span className="font-mono text-xs">{backupId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Processing Rate:</span>
              <span>{rate.toFixed(2)} files/sec</span>
            </div>
            {totalFiles > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Progress:</span>
                <span>
                  {filesProcessed} / {totalFiles} files
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact progress bar for use in lists or tables
 */
export function BackupProgressBar({ backupId, className }: { backupId: string; className?: string }) {
  const { displayProgress, isCompleted, isConnected } = useBackupProgress(backupId);

  return (
    <div className={cn('flex items-center gap-2 w-full', className)}>
      {!isConnected && !isCompleted && <WifiOff className="w-3 h-3 text-muted-foreground" />}
      <Progress value={displayProgress} className="flex-1 h-2" />
      <span className="text-xs font-medium min-w-[3rem] text-right">
        {isCompleted ? (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        ) : (
          `${Math.round(displayProgress)}%`
        )}
      </span>
    </div>
  );
}

export default BackupProgress;