// post-its.tsx
// Mural de post-its pessoais: notas coloridas com edição inline, paleta fixa
// de cores, arquivar/restaurar e reordenação por arrastar-e-soltar.
// Cada usuário vê somente os próprios post-its (escopo no servidor).
// Sem toasts nas mutations — o interceptor do api-client já notifica.

import { useEffect, useMemo, useState } from "react";
import {
  IconArchive,
  IconArchiveOff,
  IconGripVertical,
  IconNote,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { FAVORITE_PAGES, routes } from "@/constants";
import type { Postit } from "@/types";
import { usePostits, usePostitMutations } from "@/hooks";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";

// Paleta fixa — os nomes são persistidos no campo `color` do Postit.
const POSTIT_COLOR_CLASSES: Record<string, { card: string; dot: string }> = {
  yellow: {
    card: "bg-yellow-200 border-yellow-300 text-yellow-950 dark:bg-yellow-200/90",
    dot: "bg-yellow-300 border-yellow-400",
  },
  pink: {
    card: "bg-pink-200 border-pink-300 text-pink-950 dark:bg-pink-200/90",
    dot: "bg-pink-300 border-pink-400",
  },
  blue: {
    card: "bg-sky-200 border-sky-300 text-sky-950 dark:bg-sky-200/90",
    dot: "bg-sky-300 border-sky-400",
  },
  green: {
    card: "bg-green-200 border-green-300 text-green-950 dark:bg-green-200/90",
    dot: "bg-green-300 border-green-400",
  },
  orange: {
    card: "bg-orange-200 border-orange-300 text-orange-950 dark:bg-orange-200/90",
    dot: "bg-orange-300 border-orange-400",
  },
  purple: {
    card: "bg-purple-200 border-purple-300 text-purple-950 dark:bg-purple-200/90",
    dot: "bg-purple-300 border-purple-400",
  },
};
const POSTIT_COLOR_NAMES = Object.keys(POSTIT_COLOR_CLASSES);

function colorClasses(color: string) {
  return POSTIT_COLOR_CLASSES[color] ?? POSTIT_COLOR_CLASSES.yellow;
}

export function PostItsPage() {
  usePageTracker({ title: "Post-its", icon: "note" });

  const [showArchived, setShowArchived] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<Postit | null>(null);
  const { data, isLoading } = usePostits({ isArchived: showArchived, limit: 100 } as any);
  const mutations = usePostitMutations();

  const fetched: Postit[] = useMemo(() => data?.data ?? [], [data]);

  // Ordem otimista durante o drag — limpa quando a query devolve dados novos.
  const [optimisticOrder, setOptimisticOrder] = useState<Postit[] | null>(null);
  useEffect(() => {
    setOptimisticOrder(null);
  }, [fetched]);
  const postits = optimisticOrder ?? fetched;

  const sensors = useSensors(
    // 8px de tolerância: cliques nos botões/textarea não iniciam drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = postits.findIndex((p) => p.id === active.id);
    const newIndex = postits.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(postits, oldIndex, newIndex);
    setOptimisticOrder(next);
    mutations.reorder.mutate({ postitIds: next.map((p) => p.id) });
  };

  const handleAdd = () => {
    mutations.create.mutate({ content: "", color: "yellow" });
  };

  const confirmDelete = () => {
    if (!deleteDialog) return;
    mutations.delete.mutate(deleteDialog.id);
    setDeleteDialog(null);
  };

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        title="Post-its"
        icon={IconNote}
        favoritePage={FAVORITE_PAGES.FERRAMENTAS_POST_ITS}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Ferramentas", href: routes.tools.root },
          { label: "Post-its" },
        ]}
        className="flex-shrink-0"
      />

      <div className="flex-1 min-h-0 overflow-y-auto pb-6">
        <Card className="min-h-full border border-border shadow-sm">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1 rounded-md border border-border p-0.5 bg-background">
                <Button
                  type="button"
                  size="sm"
                  variant={!showArchived ? "default" : "ghost"}
                  onClick={() => setShowArchived(false)}
                  className="h-9 px-3"
                >
                  Ativos
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={showArchived ? "default" : "ghost"}
                  onClick={() => setShowArchived(true)}
                  className="h-9 px-3"
                >
                  Arquivados
                </Button>
              </div>
              {!showArchived && (
                <Button type="button" onClick={handleAdd} disabled={mutations.create.isPending}>
                  <IconPlus className="h-4 w-4 mr-1.5" />
                  Novo Post-it
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <LoadingSpinner size="lg" />
              </div>
            ) : postits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                <IconNote className="h-10 w-10 opacity-50" />
                <p className="text-sm">
                  {showArchived
                    ? "Nenhum post-it arquivado."
                    : 'Nenhum post-it ainda — clique em "Novo Post-it" para criar o primeiro.'}
                </p>
              </div>
            ) : showArchived ? (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {postits.map((postit) => (
                  <PostitCard key={postit.id} postit={postit} mutations={mutations} onDelete={setDeleteDialog} archivedView />
                ))}
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={postits.map((p) => p.id)} strategy={rectSortingStrategy}>
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {postits.map((postit) => (
                      <SortablePostitCard key={postit.id} postit={postit} mutations={mutations} onDelete={setDeleteDialog} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este post-it? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type PostitMutations = ReturnType<typeof usePostitMutations>;

function SortablePostitCard({ postit, mutations, onDelete }: { postit: Postit; mutations: PostitMutations; onDelete: (postit: Postit) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: postit.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-70 z-10")}
    >
      <PostitCard postit={postit} mutations={mutations} onDelete={onDelete} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function PostitCard({
  postit,
  mutations,
  onDelete,
  dragHandleProps,
  archivedView = false,
}: {
  postit: Postit;
  mutations: PostitMutations;
  onDelete: (postit: Postit) => void;
  dragHandleProps?: Record<string, any>;
  archivedView?: boolean;
}) {
  // Edição inline: estado local, persiste no blur quando o conteúdo mudou.
  const [content, setContent] = useState(postit.content);
  useEffect(() => {
    setContent(postit.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postit.id, postit.content]);

  const saveContent = () => {
    if (content !== postit.content) {
      mutations.update.mutate({ id: postit.id, data: { content } });
    }
  };

  const classes = colorClasses(postit.color);

  return (
    <div
      className={cn(
        "rounded-lg border-2 shadow-sm flex flex-col min-h-[180px] transition-shadow hover:shadow-md",
        classes.card,
        archivedView && "opacity-75",
      )}
    >
      <div className="flex items-center justify-between gap-1 px-2 pt-1.5">
        {!archivedView && dragHandleProps ? (
          <button
            type="button"
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-black/10 touch-none"
            title="Arrastar para reordenar"
            aria-label="Arrastar para reordenar"
          >
            <IconGripVertical className="h-4 w-4 opacity-60" />
          </button>
        ) : (
          <span className="w-6" />
        )}
        <div className="flex items-center gap-0.5">
          {archivedView ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-black/10"
              title="Restaurar post-it"
              onClick={() => mutations.update.mutate({ id: postit.id, data: { isArchived: false } })}
            >
              <IconArchiveOff className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-black/10"
              title="Arquivar post-it"
              onClick={() => mutations.update.mutate({ id: postit.id, data: { isArchived: true } })}
            >
              <IconArchive className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-black/10 text-destructive hover:text-destructive"
            title="Excluir post-it"
            onClick={() => onDelete(postit)}
          >
            <IconTrash className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Textarea
        value={content}
        onChange={(e) => setContent((e.target as HTMLTextAreaElement).value)}
        onBlur={saveContent}
        readOnly={archivedView}
        placeholder="Escreva sua nota..."
        className={cn(
          "flex-1 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-3 py-1.5 text-sm",
          "placeholder:text-black/40",
        )}
      />

      {!archivedView && (
        <div className="flex items-center gap-1.5 px-3 pb-2.5 pt-1">
          {POSTIT_COLOR_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              title={`Cor ${name}`}
              aria-label={`Mudar cor para ${name}`}
              onClick={() => mutations.update.mutate({ id: postit.id, data: { color: name } })}
              className={cn(
                "h-4 w-4 rounded-full border transition-transform hover:scale-110",
                colorClasses(name).dot,
                postit.color === name && "ring-2 ring-black/40 ring-offset-1 ring-offset-transparent",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default PostItsPage;
