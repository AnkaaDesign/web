import { memo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { InlineEditField } from "./inline-edit-field";
import { useFieldGate } from "./use-field-gate";
import type { ResolvedSection } from "./use-detail-layout";
import type { DetailFieldDef } from "./detail-page-types";

interface DetailSectionProps<TData> {
  section: ResolvedSection<TData>;
  row: TData;
  /** Persist a user-dragged content height (for resizable sections). */
  onSetHeight?: (id: string, px: number) => void;
  /** Hide a field entirely when it has no value (rather than showing a "—" row). */
  hideEmptyFields?: boolean;
}

/** A field counts as "empty" only when we can read its raw value (accessor or edit.get) and it's blank. */
function fieldIsEmpty<TData>(f: DetailFieldDef<TData>, row: TData): boolean {
  if (!f.accessor && !f.edit) return false; // render-only field — can't tell, so always keep it
  const v = f.accessor ? f.accessor(row) : f.edit!.get(row);
  return v == null || v === "" || (Array.isArray(v) && v.length === 0);
}

const MIN_SECTION_HEIGHT = 140;

/** A fixed-height content box with a drag handle so the user can resize embedded content (tables). */
function ResizableContent({ id, height, onSetHeight, children }: { id: string; height: number; onSetHeight?: (id: string, px: number) => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ y: number; h: number } | null>(null);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!ref.current) return;
    start.current = { y: e.clientY, h: ref.current.offsetHeight };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    // Mutate the DOM directly during the drag so the embedded table doesn't re-render each frame.
    if (!start.current || !ref.current) return;
    ref.current.style.height = `${Math.max(MIN_SECTION_HEIGHT, start.current.h + (e.clientY - start.current.y))}px`;
  };
  const onPointerUp = () => {
    if (!start.current || !ref.current) return;
    start.current = null;
    onSetHeight?.(id, ref.current.offsetHeight);
  };

  return (
    <div>
      <div ref={ref} style={{ height }} className="min-h-0 overflow-hidden">
        {children}
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="Arraste para redimensionar"
        className="mt-1 flex h-3 cursor-ns-resize items-center justify-center"
      >
        <span className="h-1 w-10 rounded-full bg-border transition-colors hover:bg-muted-foreground/40" />
      </div>
    </div>
  );
}

function DetailSectionInner<TData>({ section, row, onSetHeight, hideEmptyFields }: DetailSectionProps<TData>) {
  const { def, height } = section;
  const fields = hideEmptyFields ? section.fields.filter((f) => !fieldIsEmpty(f, row)) : section.fields;
  const { canEdit, isAllowed } = useFieldGate();
  const sectionEditable = isAllowed(def.editablePrivilege);
  const Icon = def.icon;

  const rendered = def.render ? def.render(row) : null;
  const renderBlock = rendered
    ? def.resizableHeight
      ? <ResizableContent id={def.id} height={height ?? def.defaultHeight ?? 320} onSetHeight={onSetHeight}>{rendered}</ResizableContent>
      : <div className={cn(fields.length ? "mt-3" : "")}>{rendered}</div>
    : null;

  const body = (
    <>
      {fields.length ? (
        <div className="space-y-2">
          {fields.map((f) => (
            <InlineEditField key={f.id} field={f} row={row} editable={sectionEditable && canEdit(f)} />
          ))}
        </div>
      ) : null}
      {renderBlock}
    </>
  );

  // "plain": no card chrome — content brings its own container (e.g. an embedded table).
  if (def.variant === "plain") {
    return (
      <section className="flex min-w-0 grow flex-col gap-3 animate-in fade-in-50">
        <div className="flex min-w-0 items-center gap-2 px-1">
          {Icon ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
          <h3 className="truncate text-base font-medium leading-tight tracking-tight text-foreground">
            {def.onTitleClick ? (
              <button type="button" onClick={() => def.onTitleClick!(row)} className="hover:underline">
                {def.label}
              </button>
            ) : (
              def.label
            )}
          </h3>
        </div>
        <div className="min-h-0 flex-1">{body}</div>
      </section>
    );
  }

  // `grow` makes the card fill its band cell (it's a flex child of the column) → both cells of a
  // band reach equal height. No-op outside a flex parent (full-width band / mobile) → natural there.
  return (
    <Card className="flex min-w-0 grow flex-col animate-in fade-in-50">
      <CardHeader>
        <CardTitle className="flex min-w-0 items-center gap-2">
          {Icon ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
          {def.onTitleClick ? (
            <button type="button" onClick={() => def.onTitleClick!(row)} className="truncate text-left hover:underline">
              {def.label}
            </button>
          ) : (
            <span className="truncate">{def.label}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-0">{body}</CardContent>
    </Card>
  );
}

export const DetailSection = memo(DetailSectionInner) as typeof DetailSectionInner;
