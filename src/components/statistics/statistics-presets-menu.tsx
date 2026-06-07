import { useState } from 'react';
import {
  IconBookmark,
  IconBookmarkFilled,
  IconBookmarkPlus,
  IconCheck,
  IconDeviceFloppy,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import type { StatisticsPreset } from '../../types';

interface StatisticsPresetsMenuProps {
  presets: StatisticsPreset[];
  /** Preset currently matching the page config, if any — shown on the trigger button. */
  activePreset?: StatisticsPreset | null;
  onSave: (name: string) => Promise<void>;
  onApply: (preset: StatisticsPreset) => boolean;
  onOverwrite: (id: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isSaving?: boolean;
}

/**
 * Shared toolbar menu for statistics pages: apply, save, overwrite, rename and
 * delete named view presets. Write toasts come from the api-client interceptor —
 * this component must not toast its own writes.
 */
export function StatisticsPresetsMenu({
  presets,
  activePreset,
  onSave,
  onApply,
  onOverwrite,
  onRename,
  onDelete,
  isSaving,
}: StatisticsPresetsMenuProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [renameTarget, setRenameTarget] = useState<StatisticsPreset | null>(null);
  const [renameName, setRenameName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<StatisticsPreset | null>(null);

  const handleSave = async () => {
    const name = saveName.trim();
    if (!name) return;
    try {
      await onSave(name);
      setSaveOpen(false);
      setSaveName('');
    } catch {
      // Error toast handled by the api-client interceptor
    }
  };

  const handleApply = (preset: StatisticsPreset) => {
    if (!onApply(preset)) {
      toast.error('Visualização inválida', 'Esta visualização foi salva em uma versão anterior e não pode mais ser aplicada.');
    }
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const name = renameName.trim();
    if (!name) return;
    try {
      await onRename(renameTarget.id, name);
      setRenameTarget(null);
    } catch {
      // Error toast handled by the api-client interceptor
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await onDelete(deleteTarget.id);
    } catch {
      // Error toast handled by the api-client interceptor
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={activePreset ? 'default' : 'outline'} size="sm">
            {activePreset ? (
              <IconBookmarkFilled className="h-4 w-4 mr-2 shrink-0" />
            ) : (
              <IconBookmark className="h-4 w-4 mr-2 shrink-0" />
            )}
            <span className="max-w-56 truncate">
              {activePreset ? `Visualização - ${activePreset.name}` : 'Visualizações'}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Visualizações salvas</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {presets.length === 0 && (
            <div className="px-2 py-3 text-sm text-muted-foreground text-center">
              Nenhuma visualização salva ainda
            </div>
          )}
          {presets.map(preset => {
            const isActive = preset.id === activePreset?.id;
            return (
              <DropdownMenuItem
                key={preset.id}
                className="group flex items-center gap-2"
                onSelect={() => handleApply(preset)}
              >
                {isActive ? (
                  <IconBookmarkFilled className="h-4 w-4 shrink-0" />
                ) : (
                  <IconBookmark className="h-4 w-4 shrink-0" />
                )}
                <span className={cn('flex-1 truncate', isActive && 'font-medium')}>{preset.name}</span>
                {isActive && <IconCheck className="h-4 w-4 shrink-0" />}
                {/* Always rendered (reserved space) — fades in on hover so the row never shifts */}
                <span
                  className={cn(
                    'flex items-center gap-0.5 opacity-0 transition-opacity duration-150',
                    'group-hover:opacity-100 group-data-[highlighted]:opacity-100 group-focus-within:opacity-100',
                  )}
                >
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-foreground/10"
                    title="Sobrescrever com a configuração atual"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      void onOverwrite(preset.id);
                    }}
                  >
                    <IconDeviceFloppy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-foreground/10"
                    title="Renomear"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setRenameTarget(preset);
                      setRenameName(preset.name);
                    }}
                  >
                    <IconPencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-foreground/10 text-destructive"
                    title="Excluir"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteTarget(preset);
                    }}
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                  </button>
                </span>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              setSaveName('');
              setSaveOpen(true);
            }}
          >
            <IconBookmarkPlus className="h-4 w-4 mr-2" />
            Salvar visualização atual...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save-as dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar visualização</DialogTitle>
            <DialogDescription>
              Salva os filtros e a configuração de gráfico atuais como uma visualização nomeada.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Nome da visualização"
            value={saveName}
            onChange={v => setSaveName(v == null ? '' : String(v))}
            onKeyDown={e => {
              if (e.key === 'Enter') void handleSave();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} disabled={!saveName.trim() || isSaving}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={open => !open && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renomear visualização</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nome da visualização"
            value={renameName}
            onChange={v => setRenameName(v == null ? '' : String(v))}
            onKeyDown={e => {
              if (e.key === 'Enter') void handleRename();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleRename()} disabled={!renameName.trim()}>
              Renomear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir visualização</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a visualização "{deleteTarget?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
