import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBackupMutations } from '@/hooks/useBackup';
import { Loader2, AlertCircle, Calendar } from 'lucide-react';
import { format, addDays, addMonths, addYears } from 'date-fns';

interface BackupFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (backupId: string) => void;
}

const RETENTION_OPTIONS = [
  { value: '1_day', label: '1 Day', calculate: (date: Date) => addDays(date, 1) },
  { value: '3_days', label: '3 Days', calculate: (date: Date) => addDays(date, 3) },
  { value: '1_week', label: '1 Week', calculate: (date: Date) => addDays(date, 7) },
  { value: '2_weeks', label: '2 Weeks', calculate: (date: Date) => addDays(date, 14) },
  { value: '1_month', label: '1 Month', calculate: (date: Date) => addMonths(date, 1) },
  { value: '3_months', label: '3 Months', calculate: (date: Date) => addMonths(date, 3) },
  { value: '6_months', label: '6 Months', calculate: (date: Date) => addMonths(date, 6) },
  { value: '1_year', label: '1 Year', calculate: (date: Date) => addYears(date, 1) },
] as const;

export function BackupForm({ open, onClose, onSuccess }: BackupFormProps) {
  const { create } = useBackupMutations();

  const [formData, setFormData] = useState({
    name: '',
    type: 'database' as 'database' | 'files' | 'system' | 'full',
    description: '',
    paths: [] as string[],
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    compressionLevel: 6,
    encrypted: false,
    autoDelete: {
      enabled: false,
      retention: '1_week' as typeof RETENTION_OPTIONS[number]['value'],
    },
  });

  const [pathInput, setPathInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const result = await create.mutateAsync({
        ...formData,
        raidAware: true, // Always use RAID-aware backups
        autoDelete: formData.autoDelete.enabled ? formData.autoDelete : undefined,
      });

      if (result.data?.id) {
        onSuccess?.(result.data.id);
      }

      onClose();
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to create backup:', error);
      }
    }
  };

  const handleAddPath = () => {
    if (pathInput.trim() && !formData.paths.includes(pathInput.trim())) {
      setFormData({
        ...formData,
        paths: [...formData.paths, pathInput.trim()],
      });
      setPathInput('');
    }
  };

  const handleRemovePath = (path: string) => {
    setFormData({
      ...formData,
      paths: formData.paths.filter(p => p !== path),
    });
  };

  const calculateDeleteDate = () => {
    if (!formData.autoDelete.enabled) return null;

    const option = RETENTION_OPTIONS.find(opt => opt.value === formData.autoDelete.retention);
    if (!option) return null;

    return option.calculate(new Date());
  };

  const deleteDate = calculateDeleteDate();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Backup</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Backup Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Daily Database Backup"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Backup Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: any) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="database">Database</SelectItem>
                  <SelectItem value="files">Files</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="full">Full (Database + Files)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description of this backup"
              rows={3}
            />
          </div>

          {(formData.type === 'files' || formData.type === 'system') && (
            <div className="space-y-2">
              <Label>Paths to Backup</Label>
              <div className="flex gap-2">
                <Input
                  value={pathInput}
                  onChange={(e) => setPathInput(e.target.value)}
                  placeholder="/path/to/backup"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPath();
                    }
                  }}
                />
                <Button type="button" onClick={handleAddPath} variant="secondary">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.paths.map((path) => (
                  <div
                    key={path}
                    className="bg-secondary px-3 py-1 rounded-md flex items-center gap-2"
                  >
                    <span className="text-sm">{path}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePath(path)}
                      className="text-destructive hover:text-destructive-foreground"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="compression">Compression Level (1-9)</Label>
              <Input
                id="compression"
                type="number"
                min="1"
                max="9"
                value={formData.compressionLevel}
                onChange={(e) =>
                  setFormData({ ...formData, compressionLevel: parseInt(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="encrypted" className="flex items-center gap-2">
              Encrypt Backup
            </Label>
            <Switch
              id="encrypted"
              checked={formData.encrypted}
              onCheckedChange={(checked) => setFormData({ ...formData, encrypted: checked })}
            />
          </div>

          <div className="border dark:border-border/40 rounded-lg p-4 space-y-4 bg-muted/50">
            <div className="flex items-center justify-between">
              <Label htmlFor="autoDelete" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Auto-Delete After Retention Period
              </Label>
              <Switch
                id="autoDelete"
                checked={formData.autoDelete.enabled}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    autoDelete: { ...formData.autoDelete, enabled: checked },
                  })
                }
              />
            </div>

            {formData.autoDelete.enabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="retention">Retention Period</Label>
                  <Select
                    value={formData.autoDelete.retention}
                    onValueChange={(value: any) =>
                      setFormData({
                        ...formData,
                        autoDelete: { ...formData.autoDelete, retention: value },
                      })
                    }
                  >
                    <SelectTrigger id="retention">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RETENTION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {deleteDate && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      This backup will be automatically deleted on{' '}
                      <strong>{format(deleteDate, 'PPP')}</strong> at{' '}
                      <strong>{format(deleteDate, 'p')}</strong>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>

          {create.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {(create.error as any)?.message || 'Failed to create backup'}
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || !formData.name}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Backup
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default BackupForm;