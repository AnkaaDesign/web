// note-context-menu.tsx
// Menu de contexto (clique-direito) COMPARTILHADO entre a nota do canvas
// (postit mode) e o card do quadro (board mode). Centraliza as ações e a
// blindagem contra a seleção "fantasma" na abertura do menu.

import { useCallback, useRef } from "react";
import {
  IconArchive,
  IconArchiveOff,
  IconArrowUp,
  IconArrowDown,
  IconHistory,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";

import type { Note } from "@/types/note";
import { useNoteMutations } from "@/hooks/common/use-notes";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu-shadcn";
import { cn } from "@/lib/utils";
import { NOTE_COLOR_NAMES, colorClasses } from "./note-colors";

export type NoteMutations = ReturnType<typeof useNoteMutations>;

export interface NoteContextMenuProps {
  note: Note;
  mutations: NoteMutations;
  /** Dono da nota → pode compartilhar / reordenar / excluir. */
  isOwner: boolean;
  /** Dono OU compartilhado com canEdit → pode alterar cor / arquivar. */
  canEdit: boolean;
  archivedView?: boolean;
  onDelete: (note: Note) => void;
  onShare: (note: Note) => void;
  onHistory: (note: Note) => void;
  /** Reordenação de z-index (apenas no canvas). */
  onReorder?: (note: Note, where: "front" | "back") => void;
  /** O gatilho do menu (o card). Renderizado com asChild. */
  children: React.ReactNode;
}

export function NoteContextMenu({
  note,
  mutations,
  isOwner,
  canEdit,
  archivedView = false,
  onDelete,
  onShare,
  onHistory,
  onReorder,
  children,
}: NoteContextMenuProps) {
  const setColor = (name: string) => mutations.update.mutate({ id: note.id, data: { color: name } });
  const archive = () => mutations.archive.mutate(note.id);
  const unarchive = () => mutations.unarchive.mutate(note.id);

  // Blindagem contra a seleção "fantasma" no clique-direito. Em certos cenários
  // (nota dentro do canvas, com ancestral em `transform`/zoom) o próprio gesto
  // que ABRE o menu de contexto também seleciona o item sob o cursor —
  // arquivando/excluindo a nota sem intenção (e fazendo o menu apenas "piscar").
  // Como toda ação passa por `onSelect`, interceptamos ali: qualquer seleção
  // disparada nos primeiros 250ms após abrir é considerada acidental;
  // `event.preventDefault()` a ignora E mantém o menu ABERTO para o clique real.
  const openedAtRef = useRef(0);
  const handleMenuOpenChange = useCallback((open: boolean) => {
    if (open) openedAtRef.current = performance.now();
  }, []);
  const guardSelect = useCallback(
    (action: () => void) => (event: Event) => {
      if (performance.now() - openedAtRef.current < 250) {
        event.preventDefault();
        return;
      }
      action();
    },
    [],
  );

  return (
    <ContextMenu onOpenChange={handleMenuOpenChange}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        {!archivedView && canEdit && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <span className={cn("mr-2 h-3.5 w-3.5 rounded-full border", colorClasses(note.color).dot)} aria-hidden />
              Cor
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="min-w-[150px]">
              {NOTE_COLOR_NAMES.map((name) => (
                <ContextMenuItem key={name} onSelect={guardSelect(() => setColor(name))}>
                  <span
                    className={cn(
                      "mr-2 h-3.5 w-3.5 rounded-full border",
                      colorClasses(name).dot,
                      note.color === name && "ring-2 ring-black/50 ring-offset-1",
                    )}
                    aria-hidden
                  />
                  {colorClasses(name).label}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        {!archivedView && isOwner && onReorder && (
          <>
            <ContextMenuItem onSelect={guardSelect(() => onReorder(note, "front"))}>
              <IconArrowUp className="mr-2 h-4 w-4" />
              Trazer para frente
            </ContextMenuItem>
            <ContextMenuItem onSelect={guardSelect(() => onReorder(note, "back"))}>
              <IconArrowDown className="mr-2 h-4 w-4" />
              Enviar para trás
            </ContextMenuItem>
          </>
        )}

        {isOwner && (
          <>
            {(canEdit || onReorder) && <ContextMenuSeparator />}
            <ContextMenuItem onSelect={guardSelect(() => onShare(note))}>
              <IconUsers className="mr-2 h-4 w-4" />
              Compartilhar
            </ContextMenuItem>
          </>
        )}

        <ContextMenuItem onSelect={guardSelect(() => onHistory(note))}>
          <IconHistory className="mr-2 h-4 w-4" />
          Histórico
        </ContextMenuItem>

        {canEdit && (
          <>
            <ContextMenuSeparator />
            {archivedView ? (
              <ContextMenuItem onSelect={guardSelect(unarchive)}>
                <IconArchiveOff className="mr-2 h-4 w-4" />
                Restaurar
              </ContextMenuItem>
            ) : (
              <ContextMenuItem onSelect={guardSelect(archive)}>
                <IconArchive className="mr-2 h-4 w-4" />
                Arquivar
              </ContextMenuItem>
            )}
          </>
        )}

        {isOwner && (
          <ContextMenuItem
            onSelect={guardSelect(() => onDelete(note))}
            className="text-destructive focus:text-destructive"
          >
            <IconTrash className="mr-2 h-4 w-4" />
            Excluir
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export default NoteContextMenu;
