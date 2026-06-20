// postit-board.tsx
// Mural de post-its pessoais como CANVAS LIVRE: cada nota é posicionada
// exatamente onde o usuário a soltar (positionX/positionY) e pode ser
// redimensionada (width/height). Posição e tamanho são persistidos no servidor
// (saves silenciosos, otimistas, no fim do arraste/redimensionamento), de modo
// que cada nota permanece no lugar entre recargas, navegação e reinícios.
// Cada usuário vê somente os próprios post-its (escopo no servidor).
// Sem toasts nas mutations de geometria — usamos a mutation "quiet".
//
// Este componente é COMPARTILHADO entre a página Ferramentas › Post-its e o
// widget de mesmo nome na Home. Ambos consomem `usePostits`/`usePostitMutations`
// (mesma cache do react-query), então editar/criar/arquivar em um lugar reflete
// imediatamente no outro — são literalmente os mesmos post-its.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  IconArchive,
  IconArchiveOff,
  IconArrowUp,
  IconArrowDown,
  IconGripVertical,
  IconNote,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";

import type { Postit } from "@/types";
import { usePostits, usePostitMutations } from "@/hooks";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading";
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

// =====================================================
// Paleta — nomes persistidos no campo `color` do Postit.
// Estilo escolhido para bom contraste de texto em claro/escuro.
// =====================================================
// IMPORTANT: keys must match the API enum POSTIT_COLORS exactly
// (yellow | pink | blue | green | orange | purple) — other values are rejected (400).
const POSTIT_COLOR_CLASSES: Record<string, { card: string; dot: string; label: string }> = {
  yellow: { card: "bg-yellow-200 border-yellow-400", dot: "bg-yellow-300 border-yellow-500", label: "Amarelo" },
  orange: { card: "bg-orange-200 border-orange-400", dot: "bg-orange-300 border-orange-500", label: "Laranja" },
  pink: { card: "bg-pink-200 border-pink-400", dot: "bg-pink-300 border-pink-500", label: "Rosa" },
  purple: { card: "bg-purple-200 border-purple-400", dot: "bg-purple-300 border-purple-500", label: "Roxo" },
  blue: { card: "bg-sky-200 border-sky-400", dot: "bg-sky-300 border-sky-500", label: "Azul" },
  green: { card: "bg-green-200 border-green-400", dot: "bg-green-300 border-green-500", label: "Verde" },
};
const POSTIT_COLOR_NAMES = Object.keys(POSTIT_COLOR_CLASSES);

function colorClasses(color: string) {
  return POSTIT_COLOR_CLASSES[color] ?? POSTIT_COLOR_CLASSES.yellow;
}

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
// localStorage — usada pela página. O widget passa a sua própria chave
// (por instância) para manter um zoom/pan independente.
export const POSTIT_VIEW_STORAGE_KEY = "ankaa.postits.canvasView";

type Geometry = { positionX: number; positionY: number; width: number; height: number };

// Resolve a geometria de uma nota, gerando um fallback em cascata/grid para
// notas legadas (positionX/Y nulos) com base no índice.
function resolveGeometry(postit: Postit, fallbackIndex: number, columns: number): Geometry {
  const width = postit.width ?? DEFAULT_W;
  const height = postit.height ?? DEFAULT_H;
  let positionX = postit.positionX;
  let positionY = postit.positionY;
  if (positionX == null || positionY == null) {
    const col = fallbackIndex % columns;
    const row = Math.floor(fallbackIndex / columns);
    positionX = BOARD_PAD + col * (DEFAULT_W + GRID_GAP);
    positionY = BOARD_PAD + row * (DEFAULT_H + GRID_GAP);
  }
  return { positionX, positionY, width, height };
}

export interface PostitBoardProps {
  /** Classe extra aplicada ao container raiz (controla altura/flex). */
  className?: string;
  /**
   * Chave de localStorage para persistir o zoom/pan do canvas. A página usa a
   * chave global; cada widget passa uma chave por instância para ter a sua
   * própria visualização.
   */
  viewStorageKey?: string;
  /**
   * Habilita o zoom com a roda do mouse (listener nativo não-passivo que chama
   * preventDefault). A página usa `true`. O widget passa `false` para NÃO
   * sequestrar a rolagem da Home — lá o zoom é feito pelos botões +/− e o pan
   * arrastando o fundo.
   */
  enableWheelZoom?: boolean;
  /**
   * Reduz a barra de ferramentas (botões Ativos/Arquivados e Novo Post-it) para
   * caber em espaços pequenos como o widget da Home. A página usa o tamanho cheio.
   */
  compact?: boolean;
}

export function PostitBoard({
  className,
  viewStorageKey = POSTIT_VIEW_STORAGE_KEY,
  enableWheelZoom = true,
  compact = false,
}: PostitBoardProps) {
  const [showArchived, setShowArchived] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<Postit | null>(null);
  const { data, isLoading } = usePostits({ isArchived: showArchived, limit: 100 } as any);
  const mutations = usePostitMutations();

  const postits: Postit[] = useMemo(() => data?.data ?? [], [data]);

  const boardRef = useRef<HTMLDivElement | null>(null);

  // Transformação de visualização do canvas: pan (x/y em px de tela) + zoom (scale).
  // Substitui a rolagem nativa do board — a roda do mouse passa a dar zoom no cursor
  // e arrastar o fundo vazio move (pan) o canvas. Persistida em localStorage para
  // sobreviver a recargas/navegação (assim como posição/tamanho das notas).
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

  // Persiste a visualização (zoom/pan) sempre que mudar.
  useEffect(() => {
    try {
      localStorage.setItem(viewStorageKey, JSON.stringify(view));
    } catch {
      /* ignore */
    }
  }, [view, viewStorageKey]);

  // Número de colunas para o fallback de notas legadas (estável o bastante).
  const fallbackColumns = 4;

  // Persiste a posição inicial das notas legadas (positionX/Y nulos) uma única
  // vez, para que não empilhem em 0,0 e fiquem fixas no grid de cascata.
  const placedLegacyRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (showArchived) return;
    let fallbackIndex = 0;
    for (const p of postits) {
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
  }, [postits, showArchived]);

  const handleAdd = useCallback(() => {
    // Posiciona a nova nota próxima ao topo-esquerda do viewport visível do board,
    // convertendo o canto visível (em px de tela) para coordenadas de mundo via pan/zoom.
    const worldLeft = (-view.x) / view.scale;
    const worldTop = (-view.y) / view.scale;
    // Pequeno deslocamento aleatório para não sobrepor exatamente cliques seguidos.
    const jitter = (postits.length % 6) * 24;
    mutations.create.mutate({
      content: "",
      color: "yellow",
      positionX: Math.max(0, worldLeft) + BOARD_PAD + jitter,
      positionY: Math.max(0, worldTop) + BOARD_PAD + jitter,
      width: DEFAULT_W,
      height: DEFAULT_H,
    } as any);
  }, [mutations, postits.length, view.x, view.y, view.scale]);

  const confirmDelete = () => {
    if (!deleteDialog) return;
    mutations.delete.mutate(deleteDialog.id);
    setDeleteDialog(null);
  };

  // Menor `position` do conjunto (pode ser negativa após "enviar para trás").
  // Usada para normalizar o z-index renderizado para sempre >= 1, evitando que
  // uma nota com z-index negativo desapareça ATRÁS do fundo do board.
  const minPosition = useMemo(
    () => Math.min(0, ...postits.map((p) => p.position ?? 0)),
    [postits],
  );

  // Ordem de empilhamento (z-index) das notas no canvas — persistida no campo
  // `position`. Trazer para frente = maior+1; enviar para trás = menor-1.
  const reorder = useCallback(
    (postit: Postit, where: "front" | "back") => {
      const positions = postits.map((p) => p.position ?? 0);
      const nextPos =
        where === "front" ? Math.max(0, ...positions) + 1 : Math.min(0, ...positions) - 1;
      mutations.update.mutate({ id: postit.id, data: { position: nextPos } });
    },
    [postits, mutations],
  );

  // Tamanho do board: envolve todas as notas + folga, com mínimo do viewport.
  const boardSize = useMemo(() => {
    let maxX = 0;
    let maxY = 0;
    let fallbackIndex = 0;
    for (const p of postits) {
      const geo = resolveGeometry(p, fallbackIndex, fallbackColumns);
      if (p.positionX == null || p.positionY == null) fallbackIndex++;
      maxX = Math.max(maxX, geo.positionX + geo.width);
      maxY = Math.max(maxY, geo.positionY + geo.height);
    }
    return { width: maxX + 320, height: maxY + 320 };
  }, [postits]);

  // --- Zoom com a roda do mouse, centrado no cursor ---
  // React's onWheel é passivo e não pode chamar preventDefault, então
  // anexamos um listener nativo não-passivo no board. Desabilitado quando
  // `enableWheelZoom` é falso (widget) para não sequestrar a rolagem da página.
  useEffect(() => {
    if (!enableWheelZoom) return;
    const board = boardRef.current;
    if (!board || showArchived) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = board.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setView((v) => {
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
        // Mantém o ponto sob o cursor fixo enquanto faz zoom.
        const worldX = (cx - v.x) / v.scale;
        const worldY = (cy - v.y) / v.scale;
        return { scale: next, x: cx - worldX * next, y: cy - worldY * next };
      });
    };
    board.addEventListener("wheel", onWheel, { passive: false });
    return () => board.removeEventListener("wheel", onWheel);
    // Reexecuta quando o board passa a existir (após o load / sair do modo arquivados),
    // senão o boardRef ainda é null na montagem e o listener nunca é anexado.
  }, [showArchived, isLoading, postits.length, enableWheelZoom]);

  // --- Arrastar o fundo vazio para mover (pan) ---
  // Inicia somente quando o pointerdown ocorre no próprio fundo (notas param
  // a propagação no cabeçalho/editor/alça). Pan é em espaço de tela (não dividido
  // pela escala).
  const onBoardPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const downTarget = e.target as HTMLElement;
    // CRÍTICO: a barra de formatação e os menus de contexto são renderizados via
    // PORTAL (fora do DOM do board), mas em React continuam DESCENDENTES do board,
    // então o pointerdown deles BORBULHA (na árvore React) até este handler. Se
    // chamarmos preventDefault aqui, o navegador suprime o mousedown/click desses
    // elementos — era exatamente por isso que clicar na barra (B/P/N/G/GG) e no
    // menu "Cor" não fazia nada (o pointerdown chegava, o mousedown nunca). Só
    // fazemos pan quando o pointerdown ocorre REALMENTE dentro do board; conteúdo
    // portado não está contido no DOM do board.
    if (!(e.currentTarget as HTMLElement).contains(downTarget)) return;
    // Só faz pan no FUNDO — nunca quando o clique cai sobre uma nota (ou dentro
    // dela). Verificar o ancestral `[data-postit-card]` é mais robusto que
    // comparar target===currentTarget (que falha quando se clica numa área
    // interna da nota que não interrompe a propagação).
    if (downTarget.closest("[data-postit-card]")) return;
    e.preventDefault();
    e.stopPropagation(); // evita pan duplicado (handler no board externo + no inner)
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

  // Controles de zoom flutuantes (− / Reset / +).
  const zoomBy = useCallback((factor: number) => {
    setView((v) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      return { ...v, scale: next };
    });
  }, []);
  const resetView = useCallback(() => setView({ scale: 1, x: 0, y: 0 }), []);

  return (
    <div className={cn("flex flex-col min-h-0 gap-3", className)}>
      <div className="flex items-center justify-between gap-2 flex-wrap flex-shrink-0">
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5 bg-background">
          <Button
            type="button"
            size="sm"
            variant={!showArchived ? "default" : "ghost"}
            onClick={() => setShowArchived(false)}
            className={compact ? "h-7 px-2 text-xs" : "h-9 px-3"}
          >
            Ativos
          </Button>
          <Button
            type="button"
            size="sm"
            variant={showArchived ? "default" : "ghost"}
            onClick={() => setShowArchived(true)}
            className={compact ? "h-7 px-2 text-xs" : "h-9 px-3"}
          >
            Arquivados
          </Button>
        </div>
        {!showArchived && (
          <Button
            type="button"
            size={compact ? "sm" : "default"}
            onClick={handleAdd}
            disabled={mutations.create.isPending}
            className={compact ? "h-7 px-2 text-xs" : undefined}
          >
            <IconPlus className={compact ? "h-3.5 w-3.5 mr-1" : "h-4 w-4 mr-1.5"} />
            {compact ? "Novo" : "Novo Post-it"}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center flex-1">
          <LoadingSpinner size="lg" />
        </div>
      ) : postits.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
          <IconNote className="h-10 w-10 opacity-50" />
          <p className="text-sm">
            {showArchived
              ? "Nenhum post-it arquivado."
              : 'Nenhum post-it ainda — clique em "Novo Post-it" para criar o primeiro.'}
          </p>
        </div>
      ) : showArchived ? (
        // Arquivados: grade simples somente-leitura (sem canvas).
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {postits.map((postit) => (
              <div key={postit.id} className="h-[200px]">
                <PostitCard postit={postit} mutations={mutations} onDelete={setDeleteDialog} archivedView />
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Canvas livre: roda do mouse dá zoom no cursor; arrastar o fundo move (pan).
        <div
          ref={boardRef}
          onPointerDown={onBoardPointerDown}
          className="relative flex-1 min-h-0 overflow-hidden rounded-md border border-border/60 bg-muted/30 cursor-grab active:cursor-grabbing [background-image:radial-gradient(circle,_hsl(var(--border))_1px,_transparent_1px)] [background-size:24px_24px]"
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
            {postits.map((postit, index) => (
              <CanvasPostit
                key={postit.id}
                postit={postit}
                fallbackIndex={index}
                fallbackColumns={fallbackColumns}
                zIndex={(postit.position ?? 0) - minPosition + 1}
                scale={view.scale}
                mutations={mutations}
                onDelete={setDeleteDialog}
                onReorder={reorder}
              />
            ))}
          </div>

          {/* Controle de zoom flutuante (canto inferior-direito). */}
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

// =====================================================
// CanvasPostit — nota arrastável + redimensionável no canvas.
// Durante o gesto, a geometria é mantida em estado LOCAL (drag visualmente
// fluido); ao soltar (pointer-up) persistimos uma única vez via quietUpdate
// (otimista, sem toast). Isso funciona como um save naturalmente "debounced":
// só grava no fim do gesto, não a cada pixel.
// =====================================================
function CanvasPostit({
  postit,
  fallbackIndex,
  fallbackColumns,
  zIndex,
  scale,
  mutations,
  onDelete,
  onReorder,
}: {
  postit: Postit;
  fallbackIndex: number;
  fallbackColumns: number;
  zIndex: number;
  scale: number;
  mutations: PostitMutations;
  onDelete: (postit: Postit) => void;
  onReorder: (postit: Postit, where: "front" | "back") => void;
}) {
  const serverGeo = resolveGeometry(postit, fallbackIndex, fallbackColumns);

  // Geometria local: dirige o render enquanto arrasta/redimensiona. Sincroniza
  // com o servidor quando não há gesto em andamento.
  const [geo, setGeo] = useState<Geometry>(serverGeo);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (draggingRef.current) return;
    setGeo(serverGeo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postit.positionX, postit.positionY, postit.width, postit.height]);

  const persist = useCallback(
    (next: Geometry) => {
      mutations.quietUpdate.mutate({
        id: postit.id,
        data: {
          positionX: Math.round(next.positionX),
          positionY: Math.round(next.positionY),
          width: Math.round(next.width),
          height: Math.round(next.height),
        },
      });
    },
    [mutations, postit.id],
  );

  // --- Arraste (move) pelo cabeçalho ---
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
        // Delta de tela → unidades de mundo: divide pela escala do canvas.
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        // Sem piso em 0 — com pan/zoom a nota pode ir para qualquer lugar do canvas
        // (inclusive à esquerda/acima da origem).
        setGeo((g) => ({
          ...g,
          positionX: origin.positionX + dx,
          positionY: origin.positionY + dy,
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

  // --- Redimensionamento pelo canto inferior-direito ---
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
        // Delta de tela → unidades de mundo: divide pela escala do canvas.
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
      style={{
        left: geo.positionX,
        top: geo.positionY,
        width: geo.width,
        height: geo.height,
        zIndex,
      }}
    >
      <PostitCard
        postit={postit}
        mutations={mutations}
        onDelete={onDelete}
        onReorder={onReorder}
        onDragPointerDown={onDragPointerDown}
        onResizePointerDown={onResizePointerDown}
        fill
      />
    </div>
  );
}

// =====================================================
// PostitEditor — corpo da nota com edição rich-text leve.
// Usa um div contentEditable (innerHTML inicializado do conteúdo salvo) e
// uma barra de ferramentas FLUTUANTE que aparece ao selecionar texto, com
// Negrito e três tamanhos de fonte. Formatação aplicada via execCommand
// (deprecado, porém cross-browser e suficiente para uma ferramenta pessoal).
// =====================================================
function PostitEditor({
  postit,
  mutations,
  archivedView,
}: {
  postit: Postit;
  mutations: PostitMutations;
  archivedView: boolean;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  // Guarda a seleção ativa quando o usuário interage com a barra. Sem isso, ao
  // clicar num botão a seleção pode colapsar/perder o foco antes do onClick
  // rodar, e execCommand acaba sem nada para formatar (clique "não funciona").
  const savedRange = useRef<Range | null>(null);
  // Barra flutuante: posição (em coords de viewport, position: fixed) + visível.
  const [toolbar, setToolbar] = useState<{ top: number; left: number } | null>(null);
  // Estado do placeholder: contentEditable não tem placeholder nativo.
  const [isEmpty, setIsEmpty] = useState(!postit.content);

  // Inicializa o HTML do editor a partir do conteúdo salvo. NÃO refazer a cada
  // tecla (causaria salto de cursor); só quando troca a nota (postit.id).
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = postit.content ?? "";
    setIsEmpty(!el.textContent?.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postit.id]);

  const persist = () => {
    const el = editorRef.current;
    if (!el) return;
    const content = el.innerHTML.slice(0, 2000); // respeita limite da API (string max 2000)
    if (content !== postit.content) {
      mutations.update.mutate({ id: postit.id, data: { content } });
    }
  };

  // Verifica se há uma seleção não-colapsada dentro DESTE editor e posiciona a
  // barra flutuante logo acima do retângulo da seleção. Caso contrário esconde.
  const updateToolbar = () => {
    if (archivedView) return;
    const el = editorRef.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setToolbar(null);
      return;
    }
    const range = sel.getRangeAt(0);
    // A seleção precisa estar contida dentro deste editor.
    if (!el.contains(range.commonAncestorContainer)) {
      setToolbar(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setToolbar(null);
      return;
    }
    // Memoriza a seleção atual para restaurá-la na hora do clique no botão.
    savedRange.current = range.cloneRange();
    setToolbar({
      top: rect.top - 8, // acima da seleção; transladado para cima no estilo
      left: rect.left + rect.width / 2,
    });
  };

  // Aplica um estilo inline à seleção atual envolvendo o conteúdo num <span>.
  // Não usamos document.execCommand (obsoleto e que silenciosamente não faz
  // nada em vários navegadores) — manipulamos o Range diretamente, o que é
  // confiável. Roda no onMouseDown do botão (com preventDefault), quando a
  // seleção de texto ainda está viva.
  const applyStyle = (apply: (span: HTMLSpanElement) => void) => {
    const el = editorRef.current;
    if (!el) return;
    const sel = window.getSelection();
    let range = sel && sel.rangeCount > 0 && !sel.isCollapsed ? sel.getRangeAt(0) : null;
    // Fallback para a seleção memorizada se a atual tiver se perdido.
    if ((!range || !el.contains(range.commonAncestorContainer)) && savedRange.current) {
      range = savedRange.current;
    }
    if (!range || range.collapsed || !el.contains(range.commonAncestorContainer)) return;

    const span = document.createElement("span");
    apply(span);
    span.appendChild(range.extractContents());
    range.insertNode(span);

    // Re-seleciona o conteúdo recém-formatado para encadear formatações.
    if (sel) {
      sel.removeAllRanges();
      const next = document.createRange();
      next.selectNodeContents(span);
      sel.addRange(next);
      savedRange.current = next.cloneRange();
    }
    setIsEmpty(!el.textContent?.trim());
    persist();
  };

  const applyBold = () => {
    applyStyle((span) => {
      span.style.fontWeight = "bold";
    });
  };

  // px: "12" (pequeno) | "14" (normal) | "20" (grande) | "28" (maior)
  const applyFontSize = (px: string) => {
    applyStyle((span) => {
      span.style.fontSize = `${px}px`;
    });
  };

  // Leitura: arquivados renderizam o HTML salvo, sem edição.
  if (archivedView) {
    return (
      <div
        className="flex-1 px-3 py-2 text-sm leading-snug text-neutral-900 whitespace-pre-wrap break-words overflow-auto"
        dangerouslySetInnerHTML={{ __html: postit.content ?? "" }}
      />
    );
  }

  return (
    <div className="relative flex-1 flex min-h-0">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        // Impede que clicar no editor inicie o arraste do cabeçalho.
        onPointerDown={(e) => e.stopPropagation()}
        onMouseUp={updateToolbar}
        onKeyUp={updateToolbar}
        onInput={() => setIsEmpty(!editorRef.current?.textContent?.trim())}
        onBlur={() => {
          persist();
          // Pequeno atraso para permitir o clique nos botões da barra antes de esconder.
          setTimeout(() => {
            const active = document.activeElement;
            if (!active || !active.closest?.("[data-postit-toolbar]")) setToolbar(null);
          }, 0);
        }}
        className={cn(
          // select-text é OBRIGATÓRIO: o card tem `select-none` (user-select:none),
          // que é herdado e torna a seleção de texto no contentEditable instável —
          // ela colapsa antes do clique nos botões da barra, fazendo a formatação
          // parecer "ignorada". Forçar user-select:text restaura a seleção real.
          "flex-1 px-3 py-2 text-sm leading-snug text-neutral-900 cursor-text select-text",
          "outline-none whitespace-pre-wrap break-words overflow-auto",
        )}
      />
      {isEmpty && (
        <span className="pointer-events-none absolute left-3 top-2 text-sm leading-snug text-black/40">
          Escreva sua nota...
        </span>
      )}
      {/* A barra é renderizada via portal no <body> porque um elemento
          position:fixed dentro de um ancestral com CSS transform (o zoom do
          canvas) passa a se posicionar relativo ao transform, não à viewport —
          o portal escapa disso e mantém o alinhamento com a seleção em qualquer zoom. */}
      {toolbar && createPortal(
        <div
          data-postit-toolbar
          // onMouseDown preventDefault em cada botão garante que a seleção não
          // seja limpa antes do comando rodar.
          className="fixed z-[60] flex items-center gap-0.5 rounded-md border border-neutral-300 bg-white px-1 py-0.5 shadow-lg -translate-x-1/2 -translate-y-full"
          style={{ top: toolbar.top, left: toolbar.left }}
        >
          <button
            type="button"
            // Executa no onMouseDown (preventDefault preserva a seleção); o
            // onClick chega tarde demais e pode rodar sem seleção ativa.
            onMouseDown={(e) => {
              e.preventDefault();
              applyBold();
            }}
            title="Negrito"
            className="inline-flex h-6 min-w-[24px] items-center justify-center rounded px-1.5 text-xs font-bold text-neutral-800 hover:bg-neutral-100"
          >
            B
          </button>
          <span className="mx-0.5 h-4 w-px bg-neutral-200" aria-hidden />
          {[
            { label: "P", size: "12", title: "Pequeno" },
            { label: "N", size: "14", title: "Normal" },
            { label: "G", size: "20", title: "Grande" },
            { label: "GG", size: "28", title: "Maior" },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                applyFontSize(opt.size);
              }}
              title={opt.title}
              className="inline-flex h-6 min-w-[24px] items-center justify-center rounded px-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
            >
              {opt.label}
            </button>
          ))}
        </div>,
        // IMPORTANTE: portar para o #root (container do React), NÃO document.body.
        // O React (v18) delega eventos no container raiz; um portal para body fica
        // FORA da raiz, então cliques nos botões nunca chegam aos handlers React
        // (onMouseDown/onClick não disparam — só o editor perde foco/blur). Portar
        // para #root mantém os eventos funcionando E o position:fixed continua
        // relativo à viewport, pois #root não tem CSS transform (só o canvas tem).
        document.getElementById("root") ?? document.body,
      )}
    </div>
  );
}

function PostitCard({
  postit,
  mutations,
  onDelete,
  onReorder,
  onDragPointerDown,
  onResizePointerDown,
  archivedView = false,
  fill = false,
}: {
  postit: Postit;
  mutations: PostitMutations;
  onDelete: (postit: Postit) => void;
  onReorder?: (postit: Postit, where: "front" | "back") => void;
  onDragPointerDown?: (e: React.PointerEvent) => void;
  onResizePointerDown?: (e: React.PointerEvent) => void;
  archivedView?: boolean;
  fill?: boolean;
}) {
  const classes = colorClasses(postit.color);

  const setColor = (name: string) => mutations.update.mutate({ id: postit.id, data: { color: name } });
  const setArchived = (isArchived: boolean) =>
    mutations.update.mutate({ id: postit.id, data: { isArchived } });

  // Blindagem contra a seleção "fantasma" no clique-direito. Em certos cenários
  // (nota dentro do canvas, com ancestral em `transform`/zoom) o próprio gesto
  // que ABRE o menu de contexto também seleciona o item que ficou sob o cursor —
  // arquivando/excluindo a nota sem intenção (e fazendo o menu apenas "piscar").
  // Como toda ação destrutiva passa por `onSelect`, interceptamos ali: qualquer
  // seleção disparada nos primeiros 250ms após abrir é considerada acidental;
  // `event.preventDefault()` a ignora E mantém o menu ABERTO para o clique real
  // (que sempre vem bem depois — o usuário precisa ver o menu, mover e clicar).
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
      <ContextMenuTrigger asChild>
        {/* Notes are always light-colored, so text/icons are FORCED dark (text-neutral-900)
            regardless of the app theme — otherwise the inherited foreground is white in dark
            mode and invisible on the pastel note. */}
        <div
          data-postit-card
          className={cn(
            // cursor-default: sobre a nota NÃO mostramos o cursor de "pan" (grab) do
            // board; o cabeçalho reativa grab e o editor usa cursor-text.
            "rounded-lg border-2 shadow-md flex flex-col transition-shadow hover:shadow-lg select-none text-neutral-900 cursor-default",
            classes.card,
            fill ? "h-full w-full" : "h-full min-h-[180px]",
            archivedView && "opacity-75",
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between gap-1 px-2 pt-1.5 pb-1 border-b border-black/10",
              onDragPointerDown && "cursor-grab active:cursor-grabbing touch-none",
            )}
            onPointerDown={onDragPointerDown}
            title={onDragPointerDown ? "Arrastar para mover • clique direito para opções" : undefined}
          >
            {onDragPointerDown ? (
              <IconGripVertical className="h-4 w-4 text-neutral-500" />
            ) : (
              <span className="h-4" />
            )}
            <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
              {archivedView ? "Arquivado" : ""}
            </span>
          </div>

          <PostitEditor postit={postit} mutations={mutations} archivedView={archivedView} />

          {/* Alça de redimensionamento (canto inferior-direito) */}
          {onResizePointerDown && !archivedView && (
            <div
              onPointerDown={onResizePointerDown}
              title="Redimensionar"
              className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize touch-none"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, transparent 0 50%, rgba(0,0,0,0.35) 50% 60%, transparent 60% 70%, rgba(0,0,0,0.35) 70% 80%, transparent 80%)",
              }}
            />
          )}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        {!archivedView && (
          <>
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <span
                  className={cn("mr-2 h-3.5 w-3.5 rounded-full border", classes.dot)}
                  aria-hidden
                />
                Cor
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="min-w-[150px]">
                {POSTIT_COLOR_NAMES.map((name) => (
                  <ContextMenuItem key={name} onSelect={guardSelect(() => setColor(name))}>
                    <span
                      className={cn(
                        "mr-2 h-3.5 w-3.5 rounded-full border",
                        colorClasses(name).dot,
                        postit.color === name && "ring-2 ring-black/50 ring-offset-1",
                      )}
                      aria-hidden
                    />
                    {colorClasses(name).label}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
            {onReorder && (
              <>
                <ContextMenuItem onSelect={guardSelect(() => onReorder(postit, "front"))}>
                  <IconArrowUp className="mr-2 h-4 w-4" />
                  Trazer para frente
                </ContextMenuItem>
                <ContextMenuItem onSelect={guardSelect(() => onReorder(postit, "back"))}>
                  <IconArrowDown className="mr-2 h-4 w-4" />
                  Enviar para trás
                </ContextMenuItem>
              </>
            )}
            <ContextMenuSeparator />
          </>
        )}

        {archivedView ? (
          <ContextMenuItem onSelect={guardSelect(() => setArchived(false))}>
            <IconArchiveOff className="mr-2 h-4 w-4" />
            Restaurar
          </ContextMenuItem>
        ) : (
          <ContextMenuItem onSelect={guardSelect(() => setArchived(true))}>
            <IconArchive className="mr-2 h-4 w-4" />
            Arquivar
          </ContextMenuItem>
        )}

        <ContextMenuItem
          onSelect={guardSelect(() => onDelete(postit))}
          className="text-destructive focus:text-destructive"
        >
          <IconTrash className="mr-2 h-4 w-4" />
          Excluir
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export default PostitBoard;
