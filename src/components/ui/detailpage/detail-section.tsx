import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { InlineEditField } from "./inline-edit-field";
import { useFieldGate } from "./use-field-gate";
import type { ResolvedSection } from "./use-detail-layout";
import type { DetailFieldDef } from "./detail-page-types";

interface DetailSectionProps<TData> {
  section: ResolvedSection<TData>;
  row: TData;
  /** Hide a field entirely when it has no value (rather than showing a "—" row). */
  hideEmptyFields?: boolean;
}

/** A field counts as "empty" only when we can read its raw value (accessor or edit.get) and it's blank. */
function fieldIsEmpty<TData>(f: DetailFieldDef<TData>, row: TData): boolean {
  if (!f.accessor && !f.edit) return false; // render-only field — can't tell, so always keep it
  const v = f.accessor ? f.accessor(row) : f.edit!.get(row);
  return v == null || v === "" || (Array.isArray(v) && v.length === 0);
}

/** Default cap (px) for a `scroll: true` section's internal scroll area. */
const DEFAULT_SCROLL_HEIGHT = 440;

function DetailSectionInner<TData>({ section, row, hideEmptyFields }: DetailSectionProps<TData>) {
  const { def } = section;
  const { canEdit, isAllowed } = useFieldGate();
  const sectionEditable = isAllowed(def.editablePrivilege);
  // When hiding empty fields, KEEP an empty field the user can still inline-edit (forecast / notes /
  // paymentMethod / pix, etc.) so it stays reachable; only hide read-only empties. The editable
  // condition mirrors the `editable` prop passed to InlineEditField below (sectionEditable && canEdit
  // && has an edit def).
  const fields = hideEmptyFields
    ? section.fields.filter((f) => !fieldIsEmpty(f, row) || (!!f.edit && sectionEditable && canEdit(f)))
    : section.fields;
  const Icon = def.icon;

  const rendered = def.render ? def.render(row) : null;

  // "Only show a section if it has info": when a render-only section's component returns null/false
  // (the embedded cards self-hide when empty — benefits, dependents, loans, position history, etc.)
  // AND there are no visible fields, render NOTHING (no floating title, no empty card). Required
  // sections always render.
  if (!def.required && fields.length === 0 && (rendered == null || rendered === false)) {
    return null;
  }

  // `scroll: true` → the content sizes to itself up to a cap: `overflow-y-auto` + `maxHeight` means
  // short content → short box (NO empty space, the card does NOT inflate to a taller neighbour), while
  // long content caps at `scrollHeight` and scrolls internally. NO `flex-1`/`min-h-0`/`minHeight` — the
  // scroll section is NATURAL bounded height (the card also drops `grow`/`flex-1`, see below).
  // `scroll: false` (default) → natural height; the card grows to show everything and stretches in its band.
  const renderBlock = rendered
    ? def.scroll
      ? (
        <div
          className={cn("overflow-y-auto", fields.length ? "mt-3" : "")}
          style={{ maxHeight: def.scrollHeight ?? DEFAULT_SCROLL_HEIGHT }}
        >
          {rendered}
        </div>
      )
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
      <section className="flex min-w-0 flex-col gap-3 animate-in fade-in-50">
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
        <div className="flex min-h-0 flex-col">{body}</div>
      </section>
    );
  }

  // Non-scroll cards STRETCH to equal height in their band: `grow` makes the card fill its column and
  // `CardContent flex-1` lets it span the matched height (the band row is `items-stretch`). Content stays
  // TOP-aligned (the body is normal block flow inside CardContent — no `justify-between`), so a short
  // card shows its content at the top with any extra space as plain bottom padding (a clean grid look),
  // never a button pinned to the bottom with a mid-card gap. Outside a flex band (full-width / mobile)
  // `grow`/`flex-1` are no-ops → natural height.
  //
  // SCROLL cards do the OPPOSITE: NO `grow`, NO `CardContent flex-1` → the card is NATURAL bounded height
  // and never inflates to match a taller neighbour. Short content → short card (no empty bottom space);
  // long content caps + scrolls inside the bounded `renderBlock` box above.
  const isScroll = !!def.scroll;
  return (
    <Card className={cn("flex min-w-0 flex-col animate-in fade-in-50", !isScroll && "grow")}>
      <CardHeader>
        <div className="flex min-w-0 items-center justify-between gap-2">
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
          {/* Section header actions (counts / download-all / open buttons) — aligned right of the title. */}
          {def.headerActions ? <div className="flex shrink-0 items-center gap-1.5">{def.headerActions(row)}</div> : null}
        </div>
      </CardHeader>
      <CardContent className={cn("flex flex-col pt-0", !isScroll && "flex-1")}>{body}</CardContent>
    </Card>
  );
}

export const DetailSection = memo(DetailSectionInner) as typeof DetailSectionInner;
