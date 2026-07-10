// note-board.tsx
// Componente COMPARTILHADO <NoteBoard> — usado pela página Ferramentas › Notas e
// pelo widget "Notas" da Home. Ambos consomem `useNotes`/`useNoteMutations` (mesma
// cache do react-query), então criar/editar/arquivar em um lugar reflete no outro.
//
// Dois modos de visualização:
//  - "postit": CANVAS LIVRE — cada nota fica onde o usuário a solta
//    (positionX/positionY) e pode ser redimensionada. Posição/tamanho são
//    persistidos no servidor (saves silenciosos e otimistas via `quietUpdate`),
//    com zoom (roda/botões) e pan (arrastar o fundo).
//  - "board": QUADRO ORGANIZADO — grade responsiva de cards (estilo Google Keep),
//    com busca e ordenação. NÃO é canvas nem tabela.
//
// Cada usuário vê as próprias notas + as compartilhadas com ele (escopo no
// servidor). Notas são sempre claras, então texto/ícones são forçados escuros.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { IconLayoutBoard, IconNote, IconPlus, IconSearch } from "@tabler/icons-react";

import type { Note } from "@/types/note";
import { useNotes, useNoteMutations } from "@/hooks/common/use-notes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading";
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
import { stripHtml } from "./note-colors";
import { NoteCard } from "./note-card";
import { NoteShareDialog } from "./note-share-dialog";
import { NoteHistoryDialog } from "./note-history-dialog";

// Dimensões padrão e limites do canvas.
const DEFAULT_W = 240;
const DEFAULT_H = 200;
const MIN_W = 140;
const MIN_H = 120;
const GRID_GAP = 16;
const BOARD_PAD = 24;

// Limites de zoom do canvas (1 = 100%).
const MIN_SCALE = 0.3;
const MAX_SCALE = 2.5;

// Chave padrão de persistência da visualização do canvas (zoom/pan) em
// localStorage — usada pela página. O widget passa a própria chave (por
// instância) para manter um zoom/pan independente.
export const NOTE_VIEW_STORAGE_KEY = "ankaa.notes.canvasView";

// Chave de persistência do modo de exibição (postit/board) quando não-controlado.
const NOTE_VIEWMODE_STORAGE_KEY = "ankaa.notes.viewMode";

export type NoteViewMode = "postit" | "board";

type Geometry = { positionX: number; positionY: number; width: number; height: number };

// Resolve a geometria de uma nota, gerando um fallback em cascata/grid para
// notas legadas (positionX/Y nulos) com base no índice.
function resolveGeometry(note: Note, fallbackIndex: number, columns: number): Geometry {
  const width = note.width ?? DEFAULT_W;
  const height = note.height ?? DEFAULT_H;
  let positionX = note.positionX;
  let positionY = note.positionY;
  if (positionX == null || positionY == null) {
    const col = fallbackIndex % columns;
    const row = Math.floor(fallbackIndex / columns);
    positionX = BOARD_PAD + col * (DEFAULT_W + GRID_GAP);
    positionY = BOARD_PAD + row * (DEFAULT_H + GRID_GAP);
  }
  return { positionX, positionY, width, height };
}

export interface NoteBoardProps {
  /** Classe extra aplicada ao container raiz (controla altura/flex). */
  className?: string;
  /** Chave de localStorage para persistir o zoom/pan do canvas. */
  viewStorageKey?: string;
  /**
   * Habilita o zoom com a roda do mouse (listener nativo não-passivo que chama
   * preventDefault). A página usa `true`; o widget passa `false` para NÃO
   * sequestrar a rolagem da Home.
   */
  enableWheelZoom?: boolean;
  /** Reduz a barra de ferramentas para caber em espaços pequenos (widget). */
  compact?: boolean;
  /** Modo de exibição controlado. */
  viewMode?: NoteViewMode;
  /** Modo inicial quando não-controlado (default 'postit'). */
  defaultViewMode?: NoteViewMode;
  /** Notifica mudanças do modo (controlado e não-controlado). */
  onViewModeChange?: (mode: NoteViewMode) => void;
  /** Renderiza o alternador segmentado (📌 Post-it / 🗂️ Quadro) na barra. */
  showViewToggle?: boolean;
  /**
   * Renderiza o botão "Nova Nota" na própria barra. A página passa `false` e
   * dispara a criação pelo botão do cabeçalho (via ref); o widget mantém `true`.
   */
  showAddButton?: boolean;
}

/** Handle imperativo exposto via ref — permite ao cabeçalho da página criar notas. */
export interface NoteBoardHandle {
  addNote: () => void;
}

export const NoteBoard = forwardRef<NoteBoardHandle, NoteBoardProps>(function NoteBoard(
  {
    className,
    viewStorageKey = NOTE_VIEW_STORAGE_KEY,
    enableWheelZoom = true,
    compact = false,
    viewMode: viewModeProp,
    defaultViewMode = "postit",
    onViewModeChange,
    showViewToggle = false,
    showAddButton = true,
  }: NoteBoardProps,
  ref,
) {
  // --- Modo de exibição (controlado vs não-controlado + persistência) ---
  const isControlled = viewModeProp !== undefined;
  const [internalMode, setInternalMode] = useState<NoteViewMode>(() => {
    try {
      const s = localStorage.getItem(NOTE_VIEWMODE_STORAGE_KEY);
      if (s === "postit" || s === "board") return s;
    } catch {
      /* ignore */
    }
    return defaultViewMode;
  });
  const viewMode: NoteViewMode = isControlled ? (viewModeProp as NoteViewMode) : internalMode;
  const setViewMode = useCallback(
    (mode: NoteViewMode) => {
      onViewModeChange?.(mode);
      if (!isControlled) {
        setInternalMode(mode);
        try {
          localStorage.setItem(NOTE_VIEWMODE_STORAGE_KEY, mode);
        } catch {
          /* ignore */
        }
      }
    },
    [isControlled, onViewModeChange],
  );

  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");

  const [deleteDialog, setDeleteDialog] = useState<Note | null>(null);
  const [shareNote, setShareNote] = useState<Note | null>(null);
  const [historyNote, setHistoryNote] = useState<Note | null>(null);

  // Inclui shares (com user) e owner para avatares/permissões no board.
  const { data, isLoading } = useNotes({
    isArchived: showArchived,
    limit: 100,
    include: { shares: true, owner: true },
  } as any);
  const mutations = useNoteMutations();

  const notes: Note[] = useMemo(() => data?.data ?? [], [data]);

  // Grades (board ativo OU arquivados) usam busca + ordenação client-side.
  const isGridView = showArchived || viewMode === "board";

  const gridNotes: Note[] = useMemo(() => {
    let list = notes;
    const q = search.trim().toLowerCase();
    if (isGridView && q) {
      list = list.filter(
        (n) =>
          (n.title ?? "").toLowerCase().includes(q) ||
          stripHtml(n.content).toLowerCase().includes(q),
      );
    }
    if (isGridView) {
      // Ordem estável por data de CRIAÇÃO (mais recentes primeiro). Usar
      // `createdAt` (imutável) — e não `updatedAt` — evita que editar uma nota
      // (ex.: trocar a cor) a reordene, o que dava a ilusão de "a outra nota
      // mudou de cor" quando na verdade os cards trocavam de posição.
      list = [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    return list;
  }, [notes, isGridView, search]);

  // Canvas (postit): a busca também filtra as notas visíveis (sem reordenar —
  // no canvas cada nota tem posição livre). minPosition/boardSize continuam sobre
  // o conjunto completo para não deslocar as demais.
  const canvasNotes: Note[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        (n.title ?? "").toLowerCase().includes(q) ||
        stripHtml(n.content).toLowerCase().includes(q),
    );
  }, [notes, search]);

  const boardRef = useRef<HTMLDivElement | null>(null);

  // Transformação de visualização do canvas: pan (x/y de tela) + zoom (scale).
  const [view, setView] = useState<{ scale: number; x: number; y: number }>(() => {
    try {
      const raw = localStorage.getItem(viewStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.scale === "number" && typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          return { scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, parsed.scale)), x: parsed.x, y: parsed.y };
        }
      }
    } catch {
      /* ignore */
    }
    return { scale: 1, x: 0, y: 0 };
  });

  useEffect(() => {
    try {
      localStorage.setItem(viewStorageKey, JSON.stringify(view));
    } catch {
      /* ignore */
    }
  }, [view, viewStorageKey]);

  const fallbackColumns = 4;

  // O canvas só é montado no modo postit ativo.
  const canvasActive = viewMode === "postit" && !showArchived;

  // Persiste a posição inicial das notas legadas (positionX/Y nulos) uma única
  // vez, para que não empilhem em 0,0.
  const placedLegacyRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!canvasActive) return;
    let fallbackIndex = 0;
    for (const p of notes) {
      const isLegacy = p.positionX == null || p.positionY == null;
      const idx = fallbackIndex;
      if (p.positionX == null || p.positionY == null) fallbackIndex++;
      if (!isLegacy) continue;
      if (placedLegacyRef.current.has(p.id)) continue;
      placedLegacyRef.current.add(p.id);
      const geo = resolveGeometry(p, idx, fallbackColumns);
      mutations.quietUpdate.mutate({
        id: p.id,
        data: {
          positionX: geo.positionX,
          positionY: geo.positionY,
          width: p.width ?? DEFAULT_W,
          height: p.height ?? DEFAULT_H,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, canvasActive]);

  const handleAdd = useCallback(() => {
    const worldLeft = -view.x / view.scale;
    const worldTop = -view.y / view.scale;
    const jitter = (notes.length % 6) * 24;
    mutations.create.mutate({
      title: null,
      content: "",
      color: "yellow",
      positionX: Math.max(0, worldLeft) + BOARD_PAD + jitter,
      positionY: Math.max(0, worldTop) + BOARD_PAD + jitter,
      width: DEFAULT_W,
      height: DEFAULT_H,
    } as any);
  }, [mutations, notes.length, view.x, view.y, view.scale]);

  // Expõe a criação ao cabeçalho da página (botão "Adicionar" fora do board).
  useImperativeHandle(ref, () => ({ addNote: handleAdd }), [handleAdd]);

  const confirmDelete = () => {
    if (!deleteDialog) return;
    mutations.delete.mutate(deleteDialog.id);
    setDeleteDialog(null);
  };

  // Menor `position` do conjunto (pode ser negativa após "enviar para trás").
  const minPosition = useMemo(() => Math.min(0, ...notes.map((p) => p.position ?? 0)), [notes]);

  // Ordem de empilhamento (z-index) — persistida em `position`.
  const reorder = useCallback(
    (note: Note, where: "front" | "back") => {
      const positions = notes.map((p) => p.position ?? 0);
      const nextPos = where === "front" ? Math.max(0, ...positions) + 1 : Math.min(0, ...positions) - 1;
      mutations.update.mutate({ id: note.id, data: { position: nextPos } });
    },
    [notes, mutations],
  );

  // Tamanho do board: envolve todas as notas + folga, mínimo do viewport.
  const boardSize = useMemo(() => {
    let maxX = 0;
    let maxY = 0;
    let fallbackIndex = 0;
    for (const p of notes) {
      const geo = resolveGeometry(p, fallbackIndex, fallbackColumns);
      if (p.positionX == null || p.positionY == null) fallbackIndex++;
      maxX = Math.max(maxX, geo.positionX + geo.width);
      maxY = Math.max(maxY, geo.positionY + geo.height);
    }
    return { width: maxX + 320, height: maxY + 320 };
  }, [notes]);

  // --- Zoom com a roda do mouse, centrado no cursor ---
  useEffect(() => {
    if (!enableWheelZoom) return;
    const board = boardRef.current;
    if (!board || !canvasActive) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = board.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setView((v) => {
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
        const worldX = (cx - v.x) / v.scale;
        const worldY = (cy - v.y) / v.scale;
        return { scale: next, x: cx - worldX * next, y: cy - worldY * next };
      });
    };
    board.addEventListener("wheel", onWheel, { passive: false });
    return () => board.removeEventListener("wheel", onWheel);
  }, [canvasActive, isLoading, notes.length, enableWheelZoom]);

  // --- Arrastar o fundo vazio para mover (pan) ---
  const onBoardPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const downTarget = e.target as HTMLElement;
    // Conteúdo portado (barra de formatação, menus) borbulha na árvore React até
    // aqui, mas NÃO está contido no DOM do board — só fazemos pan no board real.
    if (!(e.currentTarget as HTMLElement).contains(downTarget)) return;
    if (downTarget.closest("[data-note-card]")) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    let origin = { x: 0, y: 0 };
    setView((v) => {
      origin = { x: v.x, y: v.y };
      return v;
    });
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      setView((v) => ({ ...v, x: origin.x + dx, y: origin.y + dy }));
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  }, []);

  const zoomBy = useCallback((factor: number) => {
    setView((v) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      return { ...v, scale: next };
    });
  }, []);
  const resetView = useCallback(() => setView({ scale: 1, x: 0, y: 0 }), []);

  const emptyState = (
    <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
      <IconNote className="h-10 w-10 opacity-50" />
      <p className="text-sm">
        {showArchived
          ? "Nenhuma nota arquivada."
          : search.trim()
            ? "Nenhuma nota corresponde à busca."
            : "Nenhuma nota ainda — crie a primeira."}
      </p>
    </div>
  );

  return (
    <div className={cn("flex flex-col min-h-0 gap-3", className)}>
      {/* Barra de ferramentas (estilo tabela): busca à esquerda ocupando o
          espaço; à direita status, ordenação e o alternador de modo. */}
      <div className={cn("flex items-center gap-2 flex-shrink-0", compact && "flex-wrap")}>
        {/* Busca — à esquerda, cresce; disponível em AMBOS os modos */}
        <div className="relative flex-1 min-w-0">
          <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(value) => setSearch(String(value ?? ""))}
            placeholder="Buscar notas..."
            className={cn("w-full pl-8", compact ? "h-7 text-xs" : "h-9")}
          />
        </div>

        {/* Ativas / Arquivadas — só na página (o widget mostra apenas ativas) */}
        {!compact && (
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5 bg-background shrink-0">
            <Button
              type="button"
              size="sm"
              variant={!showArchived ? "default" : "ghost"}
              onClick={() => setShowArchived(false)}
              className="h-9 px-3"
            >
              Ativas
            </Button>
            <Button
              type="button"
              size="sm"
              variant={showArchived ? "default" : "ghost"}
              onClick={() => setShowArchived(true)}
              className="h-9 px-3"
            >
              Arquivadas
            </Button>
          </div>
        )}

        {/* Alternador de modo (Post-it / Quadro) — à direita, onde ficava o Adicionar */}
        {showViewToggle && (
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5 bg-background shrink-0">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "postit" ? "default" : "ghost"}
              onClick={() => setViewMode("postit")}
              className={compact ? "h-7 px-2 text-xs" : "h-9 px-3"}
              title="Modo Post-it (canvas livre)"
            >
              <IconNote className={compact ? "h-3.5 w-3.5 sm:mr-1" : "h-4 w-4 mr-1.5"} />
              <span className={compact ? "hidden sm:inline" : undefined}>Post-it</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "board" ? "default" : "ghost"}
              onClick={() => setViewMode("board")}
              className={compact ? "h-7 px-2 text-xs" : "h-9 px-3"}
              title="Modo Quadro (grade organizada)"
            >
              <IconLayoutBoard className={compact ? "h-3.5 w-3.5 sm:mr-1" : "h-4 w-4 mr-1.5"} />
              <span className={compact ? "hidden sm:inline" : undefined}>Quadro</span>
            </Button>
          </div>
        )}

        {/* Adicionar — na barra apenas quando showAddButton (widget); na página
            este botão vai para o cabeçalho (disparado via ref). */}
        {showAddButton && !showArchived && (
          <Button
            type="button"
            size={compact ? "sm" : "default"}
            onClick={handleAdd}
            disabled={mutations.create.isPending}
            className={cn("shrink-0", compact ? "h-7 px-2 text-xs" : undefined)}
          >
            <IconPlus className={compact ? "h-3.5 w-3.5 mr-1" : "h-4 w-4 mr-1.5"} />
            {compact ? "Nova" : "Nova Nota"}
          </Button>
        )}
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="flex items-center justify-center flex-1">
          <LoadingSpinner size="lg" />
        </div>
      ) : (isGridView ? gridNotes : canvasNotes).length === 0 ? (
        emptyState
      ) : isGridView ? (
        // Grade organizada (board ativo OU arquivados).
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {gridNotes.map((note) => (
              <div key={note.id} className="h-64">
                <NoteCard
                  note={note}
                  mutations={mutations}
                  onDelete={setDeleteDialog}
                  onShare={setShareNote}
                  onHistory={setHistoryNote}
                  archivedView={showArchived}
                  boardView
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Canvas livre: roda dá zoom no cursor; arrastar o fundo faz pan.
        <div
          ref={boardRef}
          onPointerDown={onBoardPointerDown}
          className="relative flex-1 min-h-0 overflow-hidden rounded-lg border border-border bg-background dark:bg-[hsl(0_0%_13%)] cursor-grab active:cursor-grabbing [background-image:radial-gradient(circle,_hsl(var(--border))_1px,_transparent_1px)] [background-size:24px_24px]"
        >
          <div
            onPointerDown={onBoardPointerDown}
            className="relative"
            style={{
              width: boardSize.width,
              height: boardSize.height,
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
              transformOrigin: "0 0",
            }}
          >
            {canvasNotes.map((note, index) => (
              <CanvasNote
                key={note.id}
                note={note}
                fallbackIndex={index}
                fallbackColumns={fallbackColumns}
                zIndex={(note.position ?? 0) - minPosition + 1}
                scale={view.scale}
                mutations={mutations}
                onDelete={setDeleteDialog}
                onShare={setShareNote}
                onHistory={setHistoryNote}
                onReorder={reorder}
              />
            ))}
          </div>

          {/* Controle de zoom flutuante */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute bottom-3 right-3 z-50 flex items-center gap-0.5 rounded-md border border-border bg-background/95 p-0.5 shadow-md backdrop-blur"
          >
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => zoomBy(1 / 1.1)} title="Reduzir zoom">
              −
            </Button>
            <button
              type="button"
              onClick={resetView}
              title="Redefinir zoom"
              className="min-w-[3rem] rounded px-1.5 text-xs font-medium tabular-nums text-muted-foreground hover:bg-muted"
            >
              {Math.round(view.scale * 100)}%
            </button>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => zoomBy(1.1)} title="Aumentar zoom">
              +
            </Button>
          </div>
        </div>
      )}

      {/* Diálogo de exclusão */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta nota? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de compartilhamento */}
      <NoteShareDialog
        note={shareNote}
        open={!!shareNote}
        onOpenChange={(open) => !open && setShareNote(null)}
        mutations={mutations}
      />

      {/* Diálogo de histórico */}
      <NoteHistoryDialog
        note={historyNote}
        open={!!historyNote}
        onOpenChange={(open) => !open && setHistoryNote(null)}
      />
    </div>
  );
});

type NoteMutations = ReturnType<typeof useNoteMutations>;

// =====================================================
// CanvasNote — nota arrastável + redimensionável no canvas (postit mode).
// Durante o gesto a geometria fica em estado LOCAL (fluido); ao soltar
// persistimos uma vez via quietUpdate (otimista, sem toast) — save naturalmente
// "debounced".
// =====================================================
function CanvasNote({
  note,
  fallbackIndex,
  fallbackColumns,
  zIndex,
  scale,
  mutations,
  onDelete,
  onShare,
  onHistory,
  onReorder,
}: {
  note: Note;
  fallbackIndex: number;
  fallbackColumns: number;
  zIndex: number;
  scale: number;
  mutations: NoteMutations;
  onDelete: (note: Note) => void;
  onShare: (note: Note) => void;
  onHistory: (note: Note) => void;
  onReorder: (note: Note, where: "front" | "back") => void;
}) {
  const serverGeo = resolveGeometry(note, fallbackIndex, fallbackColumns);

  const [geo, setGeo] = useState<Geometry>(serverGeo);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (draggingRef.current) return;
    setGeo(serverGeo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.positionX, note.positionY, note.width, note.height]);

  const persist = useCallback(
    (next: Geometry) => {
      mutations.quietUpdate.mutate({
        id: note.id,
        data: {
          positionX: Math.round(next.positionX),
          positionY: Math.round(next.positionY),
          width: Math.round(next.width),
          height: Math.round(next.height),
        },
      });
    },
    [mutations, note.id],
  );

  const onDragPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      draggingRef.current = true;
      const startX = e.clientX;
      const startY = e.clientY;
      const origin = { ...geo };
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const move = (ev: PointerEvent) => {
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        setGeo((g) => ({ ...g, positionX: origin.positionX + dx, positionY: origin.positionY + dy }));
      };
      const up = () => {
        target.removeEventListener("pointermove", move);
        target.removeEventListener("pointerup", up);
        target.removeEventListener("pointercancel", up);
        setGeo((g) => {
          persist(g);
          draggingRef.current = false;
          return g;
        });
      };
      target.addEventListener("pointermove", move);
      target.addEventListener("pointerup", up);
      target.addEventListener("pointercancel", up);
    },
    [geo, persist, scale],
  );

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      draggingRef.current = true;
      const startX = e.clientX;
      const startY = e.clientY;
      const origin = { ...geo };
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const move = (ev: PointerEvent) => {
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        setGeo((g) => ({
          ...g,
          width: Math.max(MIN_W, origin.width + dx),
          height: Math.max(MIN_H, origin.height + dy),
        }));
      };
      const up = () => {
        target.removeEventListener("pointermove", move);
        target.removeEventListener("pointerup", up);
        target.removeEventListener("pointercancel", up);
        setGeo((g) => {
          persist(g);
          draggingRef.current = false;
          return g;
        });
      };
      target.addEventListener("pointermove", move);
      target.addEventListener("pointerup", up);
      target.addEventListener("pointercancel", up);
    },
    [geo, persist, scale],
  );

  return (
    <div
      className="absolute"
      style={{ left: geo.positionX, top: geo.positionY, width: geo.width, height: geo.height, zIndex }}
    >
      <NoteCard
        note={note}
        mutations={mutations}
        onDelete={onDelete}
        onShare={onShare}
        onHistory={onHistory}
        onReorder={onReorder}
        onDragPointerDown={onDragPointerDown}
        onResizePointerDown={onResizePointerDown}
        fill
      />
    </div>
  );
}

export default NoteBoard;
