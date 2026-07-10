// note-card.tsx
// Card de nota COMPARTILHADO entre os dois modos:
//  - postit (canvas livre): recebe handlers de arraste/redimensionamento + `fill`.
//  - board (quadro organizado): recebe `boardView` → mostra rodapé com avatares
//    de compartilhamento e data de atualização.
//  - arquivados: `archivedView` → somente leitura.
//
// O corpo usa um editor contentEditable leve (NoteEditor). Acima do corpo há uma
// linha de TÍTULO opcional (negrito) mapeada para note.title.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconEye, IconGripVertical, IconPencil } from "@tabler/icons-react";

import type { Note } from "@/types/note";
import { useAuth } from "@/contexts/auth-context";
import { UserAvatarDisplay } from "@/components/ui/avatar-display";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { formatDate } from "@/utils/date";
import { colorClasses } from "./note-colors";
import { NoteContextMenu, type NoteMutations } from "./note-context-menu";

// Deriva as permissões do usuário atual sobre a nota (dono vs compartilhado).
export function useNotePermissions(note: Note) {
  const { user } = useAuth();
  const currentUserId = user?.id;
  const isOwner = !!currentUserId && note.ownerId === currentUserId;
  const myShare = note.shares?.find((s) => s.userId === currentUserId);
  const canEdit = isOwner || myShare?.canEdit === true;
  return { isOwner, canEdit };
}

// =====================================================
// NoteEditor — corpo da nota com edição rich-text leve.
// Div contentEditable (innerHTML do conteúdo salvo) + barra FLUTUANTE que
// aparece ao selecionar texto (Negrito + tamanhos). Formatação via manipulação
// direta do Range (execCommand é obsoleto e não confiável).
// =====================================================
function NoteEditor({
  note,
  mutations,
  editable,
}: {
  note: Note;
  mutations: NoteMutations;
  editable: boolean;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedRange = useRef<Range | null>(null);
  const [toolbar, setToolbar] = useState<{ top: number; left: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(!note.content);

  // Inicializa o HTML do editor a partir do conteúdo salvo. NÃO refazer a cada
  // tecla (causaria salto de cursor); só quando troca a nota (note.id).
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = note.content ?? "";
    setIsEmpty(!el.textContent?.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  const persist = () => {
    const el = editorRef.current;
    if (!el) return;
    const content = el.innerHTML.slice(0, 2000); // respeita limite da API (max 2000)
    if (content !== note.content) {
      mutations.update.mutate({ id: note.id, data: { content } });
    }
  };

  const updateToolbar = () => {
    if (!editable) return;
    const el = editorRef.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setToolbar(null);
      return;
    }
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) {
      setToolbar(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setToolbar(null);
      return;
    }
    savedRange.current = range.cloneRange();
    setToolbar({ top: rect.top - 8, left: rect.left + rect.width / 2 });
  };

  const applyStyle = (apply: (span: HTMLSpanElement) => void) => {
    const el = editorRef.current;
    if (!el) return;
    const sel = window.getSelection();
    let range = sel && sel.rangeCount > 0 && !sel.isCollapsed ? sel.getRangeAt(0) : null;
    if ((!range || !el.contains(range.commonAncestorContainer)) && savedRange.current) {
      range = savedRange.current;
    }
    if (!range || range.collapsed || !el.contains(range.commonAncestorContainer)) return;

    const span = document.createElement("span");
    apply(span);
    span.appendChild(range.extractContents());
    range.insertNode(span);

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

  const applyBold = () => applyStyle((span) => (span.style.fontWeight = "bold"));
  const applyFontSize = (px: string) => applyStyle((span) => (span.style.fontSize = `${px}px`));

  // Leitura: viewers e arquivados renderizam o HTML salvo, sem edição.
  if (!editable) {
    return (
      <div
        className="flex-1 px-3 py-2 text-sm leading-snug text-neutral-900 whitespace-pre-wrap break-words overflow-auto"
        dangerouslySetInnerHTML={{ __html: note.content ?? "" }}
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
        onPointerDown={(e) => e.stopPropagation()}
        onMouseUp={updateToolbar}
        onKeyUp={updateToolbar}
        onInput={() => setIsEmpty(!editorRef.current?.textContent?.trim())}
        onBlur={() => {
          persist();
          setTimeout(() => {
            const active = document.activeElement;
            if (!active || !active.closest?.("[data-note-toolbar]")) setToolbar(null);
          }, 0);
        }}
        className={cn(
          // select-text é OBRIGATÓRIO: o card tem `select-none`, herdado, que torna
          // a seleção de texto instável — ela colapsa antes do clique nos botões da
          // barra. Forçar user-select:text restaura a seleção real.
          "flex-1 px-3 py-2 text-sm leading-snug text-neutral-900 cursor-text select-text",
          "outline-none whitespace-pre-wrap break-words overflow-auto",
        )}
      />
      {isEmpty && (
        <span className="pointer-events-none absolute left-3 top-2 text-sm leading-snug text-black/40">
          Escreva sua nota...
        </span>
      )}
      {toolbar &&
        createPortal(
          <div
            data-note-toolbar
            className="fixed z-[60] flex items-center gap-0.5 rounded-md border border-neutral-300 bg-white px-1 py-0.5 shadow-lg -translate-x-1/2 -translate-y-full"
            style={{ top: toolbar.top, left: toolbar.left }}
          >
            <button
              type="button"
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
          // Portar para o #root (container do React), NÃO document.body: o React (v18)
          // delega eventos na raiz; um portal para body ficaria FORA e os cliques nos
          // botões nunca chegariam aos handlers. #root não tem CSS transform, então o
          // position:fixed continua relativo à viewport.
          document.getElementById("root") ?? document.body,
        )}
    </div>
  );
}

// =====================================================
// NoteTitle — linha de título opcional (negrito) mapeada para note.title.
// Editável: input transparente de uma linha (persiste no blur). Somente leitura:
// div em negrito; se vazio, some.
// =====================================================
function NoteTitle({
  note,
  mutations,
  editable,
  boardView,
}: {
  note: Note;
  mutations: NoteMutations;
  editable: boolean;
  boardView: boolean;
}) {
  const persistTitle = (raw: string) => {
    const next = raw.trim().slice(0, 200);
    if (next !== (note.title ?? "")) {
      mutations.update.mutate({ id: note.id, data: { title: next || null } });
    }
  };

  if (!editable) {
    if (!note.title) return null;
    return (
      <div
        className={cn(
          "px-3 pt-2 font-bold text-neutral-900 break-words",
          boardView ? "text-sm line-clamp-2" : "text-sm truncate",
        )}
      >
        {note.title}
      </div>
    );
  }

  return (
    <input
      key={note.id}
      type="text"
      defaultValue={note.title ?? ""}
      maxLength={200}
      placeholder="Título"
      // Impede que clicar/focar o título inicie o arraste do cabeçalho.
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={(e) => persistTitle(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="w-full bg-transparent px-3 pt-2 font-bold text-sm text-neutral-900 placeholder:text-black/30 outline-none"
    />
  );
}

// =====================================================
// SharePermissionChip / SharedAvatar — avatar de compartilhamento com popover
// (nome, setor e permissão) ao passar o mouse.
// =====================================================
function SharePermissionChip({ canEdit }: { canEdit: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        canEdit
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-muted text-muted-foreground",
      )}
    >
      {canEdit ? <IconPencil className="h-3 w-3" /> : <IconEye className="h-3 w-3" />}
      {canEdit ? "Editor" : "Visualizador"}
    </span>
  );
}

function SharedAvatar({ share }: { share: NonNullable<Note["shares"]>[number] }) {
  const user = share.user!;
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span className="inline-flex">
          <UserAvatarDisplay
            avatar={user.avatar ?? null}
            userName={user.name}
            size="xs"
            shape="circle"
            className="ring-1 ring-white/70 cursor-default"
          />
        </span>
      </HoverCardTrigger>
      <HoverCardContent side="top" className="w-60 p-3">
        <div className="flex items-center gap-2.5">
          <UserAvatarDisplay avatar={user.avatar ?? null} userName={user.name} size="sm" shape="circle" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-tight">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.sector?.name ?? "Sem setor"}</p>
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Permissão:</span>
          <SharePermissionChip canEdit={share.canEdit === true} />
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

// =====================================================
// NoteMeta — rodapé de compartilhamento: avatares (com popover de nome/setor/
// permissão) + data de atualização. Usado no board E no canvas.
// =====================================================
function NoteMeta({ note }: { note: Note }) {
  const shares = (note.shares ?? []).filter((s) => s.user);
  const visible = shares.slice(0, 5);
  const extra = shares.length - visible.length;

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-t border-black/10">
      {visible.length > 0 ? (
        <div className="flex items-center -space-x-2">
          {visible.map((s) => (
            <SharedAvatar key={s.user!.id} share={s} />
          ))}
          {extra > 0 && (
            <span className="ml-3 text-[10px] font-medium text-neutral-600">+{extra}</span>
          )}
        </div>
      ) : (
        <span className="text-[10px] text-neutral-500">Somente você</span>
      )}
      <span className="text-[10px] text-neutral-500 whitespace-nowrap">
        {formatDate(note.updatedAt)}
      </span>
    </div>
  );
}

// =====================================================
// NoteCard — o card em si (usa NoteContextMenu como wrapper de clique-direito).
// =====================================================
export function NoteCard({
  note,
  mutations,
  onDelete,
  onShare,
  onHistory,
  onReorder,
  onDragPointerDown,
  onResizePointerDown,
  archivedView = false,
  boardView = false,
  fill = false,
}: {
  note: Note;
  mutations: NoteMutations;
  onDelete: (note: Note) => void;
  onShare: (note: Note) => void;
  onHistory: (note: Note) => void;
  onReorder?: (note: Note, where: "front" | "back") => void;
  onDragPointerDown?: (e: React.PointerEvent) => void;
  onResizePointerDown?: (e: React.PointerEvent) => void;
  archivedView?: boolean;
  boardView?: boolean;
  fill?: boolean;
}) {
  const classes = colorClasses(note.color);
  const { isOwner, canEdit } = useNotePermissions(note);
  const editable = canEdit && !archivedView;

  return (
    <NoteContextMenu
      note={note}
      mutations={mutations}
      isOwner={isOwner}
      canEdit={canEdit}
      archivedView={archivedView}
      onDelete={onDelete}
      onShare={onShare}
      onHistory={onHistory}
      onReorder={onReorder}
    >
      {/* As notas são sempre claras, então texto/ícones são FORÇADOS escuros
          (text-neutral-900) independentemente do tema — senão o foreground
          herdado é branco no modo escuro e some sobre o pastel. */}
      <div
        data-note-card
        className={cn(
          "rounded-lg border-2 shadow-md flex flex-col transition-shadow hover:shadow-lg select-none text-neutral-900 cursor-default",
          classes.card,
          fill ? "h-full w-full" : "h-full min-h-[180px]",
          archivedView && "opacity-75",
        )}
      >
        {onDragPointerDown && (
          <div
            className="flex items-center justify-between gap-1 px-2 pt-1.5 pb-1 border-b border-black/10 cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={onDragPointerDown}
            title="Arrastar para mover • clique direito para opções"
          >
            <IconGripVertical className="h-4 w-4 text-neutral-500" />
            <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
              {archivedView ? "Arquivado" : ""}
            </span>
          </div>
        )}

        <NoteTitle note={note} mutations={mutations} editable={editable} boardView={boardView} />

        <NoteEditor note={note} mutations={mutations} editable={editable} />

        {/* Rodapé de compartilhamento: sempre no board; no canvas só quando há
            compartilhamentos (para não ocupar espaço em notas privadas). */}
        {(boardView || (note.shares?.length ?? 0) > 0) && <NoteMeta note={note} />}

        {/* Alça de redimensionamento (canvas, canto inferior-direito) */}
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
    </NoteContextMenu>
  );
}

export default NoteCard;
