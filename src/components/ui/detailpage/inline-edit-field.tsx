import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
// The app mounts the custom Toaster (@/components/ui/sonner) which strips background/padding from
// raw sonner toasts — use the wrapper so the validation-error toast renders styled.
import { toast } from "@/components/ui/sonner";
import { IconArrowBackUp } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { DetailRow } from "@/components/ui/detail-row";
import type { DetailFieldDef, FieldDataType, InlineEditDef } from "./detail-page-types";
import { enumOptions, enumTriggerClass, renderFieldValue } from "./inline-widgets";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// dataType → the `<Input type=...>` the inline TextEditor renders. The Brazilian document/contact
// types (cpf/cnpj/phone/pis/cep) map 1:1 onto the Input's own masked types — the Input formats while
// typing and emits the RAW digits via onChange, so the committed value stays the unmasked digits.
const TEXT_INPUT_TYPE: Partial<Record<FieldDataType, "text" | "number" | "integer" | "decimal" | "currency" | "percentage" | "cpf" | "cnpj" | "phone" | "pis" | "cep">> = {
  text: "text",
  number: "number",
  integer: "integer",
  decimal: "decimal",
  money: "currency",
  percentage: "percentage",
  cpf: "cpf",
  cnpj: "cnpj",
  phone: "phone",
  pis: "pis",
  cep: "cep",
};
const TEXT_LIKE = new Set<FieldDataType>(["text", "number", "integer", "decimal", "money", "percentage", "cpf", "cnpj", "phone", "pis", "cep"]);

// How long the inline "Desfazer" affordance stays on the field after a successful edit.
const UNDO_SECONDS = 5;

// A click counts as "outside the editor" only when it is neither inside the editor container
// NOR inside a popover/calendar portal opened by it (combobox list, date picker). Capture-phase
// mousedown → one reliable exit on any outside click (fixes the flaky blur behavior).
const PORTAL_SELECTOR =
  '[data-radix-popper-content-wrapper],[data-radix-popover-content],[role="listbox"],[role="dialog"],[role="menu"],[cmdk-root]';

function useOutsideDismiss(ref: RefObject<HTMLElement | null>, onDismiss: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t) return;
      if (ref.current?.contains(t)) return;
      if (t.closest?.(PORTAL_SELECTOR)) return;
      onDismiss();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [ref, onDismiss, active]);
}

interface EditorProps<TData> {
  field: DetailFieldDef<TData>;
  edit: InlineEditDef<TData>;
  row: TData;
  /** Commit a value. Pass keepOpen=true (multiselect) to stay in edit mode for more changes. */
  onCommit: (value: unknown, keepOpen?: boolean) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Per-type editors (each its own component so hooks are unconditional)
// ---------------------------------------------------------------------------

function TextEditor<TData>({ field, edit, row, onCommit, onCancel }: EditorProps<TData>) {
  const ref = useRef<HTMLInputElement>(null);
  // Enter/Escape call setEditing(false), which unmounts this input → React fires a spurious onBlur on
  // the unmounting node. Without this guard that blur fires a SECOND commit (Escape would save the
  // discarded draft; Enter would double-commit). `settled` is flipped by whichever path resolves the
  // session first; the blur handler then no-ops. Fresh per mount (each edit session remounts).
  const settled = useRef(false);
  const [draft, setDraft] = useState<string | number | null>((edit.get(row) as string | number | null) ?? "");
  useEffect(() => {
    settled.current = false;
    ref.current?.focus();
    ref.current?.select?.();
  }, []);
  return (
    <Input
      ref={ref}
      type={TEXT_INPUT_TYPE[field.dataType ?? "text"] ?? "text"}
      value={draft}
      min={edit.min}
      max={edit.max}
      step={edit.step}
      placeholder={edit.placeholder}
      onChange={(v) => setDraft(v)}
      onBlur={() => {
        if (settled.current) return; // already resolved by Enter/Escape — ignore the unmount blur
        settled.current = true;
        onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          settled.current = true;
          onCommit(draft);
        } else if (e.key === "Escape") {
          e.preventDefault();
          settled.current = true;
          onCancel();
        }
      }}
      className={cn("h-8 w-[16rem] max-w-full", field.block && "w-full")}
    />
  );
}

function TextareaEditor<TData>({ edit, row, onCommit, onCancel }: EditorProps<TData>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // See TextEditor: guards the spurious onBlur fired when Escape/Enter unmount this textarea.
  const settled = useRef(false);
  const [draft, setDraft] = useState<string>(String(edit.get(row) ?? ""));
  useEffect(() => {
    settled.current = false;
    ref.current?.focus();
    ref.current?.select?.();
  }, []);
  return (
    <Textarea
      ref={ref}
      value={draft}
      placeholder={edit.placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (settled.current) return; // already resolved by Enter/Escape — ignore the unmount blur
        settled.current = true;
        onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          settled.current = true;
          onCancel();
        } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          settled.current = true;
          onCommit(draft);
        }
      }}
      className="min-h-[72px] w-full"
    />
  );
}

function DateEditor<TData>({ field, edit, row, onCommit, onCancel }: EditorProps<TData>) {
  const ref = useRef<HTMLDivElement>(null);
  useOutsideDismiss(ref, onCancel, true);
  const raw = edit.get(row);
  const value = raw ? new Date(raw as string | number | Date) : null;
  const mode = field.dataType === "time" ? "time" : field.dataType === "datetime" ? "datetime" : "date";
  return (
    // Force the inner control (a h-10 div, not a button) to h-8 so the row keeps its height.
    <div ref={ref} className="[&_.h-10]:!h-8" onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <DateTimeInput mode={mode} value={value} onChange={(d) => onCommit(d instanceof Date ? d : (d ?? null))} hideLabel />
    </div>
  );
}

function BooleanEditor<TData>({ edit, row, onCommit, onCancel }: EditorProps<TData>) {
  const ref = useRef<HTMLDivElement>(null);
  useOutsideDismiss(ref, onCancel, true);
  return (
    <div ref={ref} className="flex items-center justify-end gap-2" onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <Switch autoFocus checked={!!edit.get(row)} onCheckedChange={(b) => onCommit(b)} />
    </div>
  );
}

function EnumEditor<TData>({ edit, row, onCommit, onCancel }: EditorProps<TData>) {
  const ref = useRef<HTMLDivElement>(null);
  useOutsideDismiss(ref, onCancel, true);
  const cfg = edit.enum!;
  const current = (edit.get(row) as string | null) ?? null;
  const options = enumOptions(cfg, current, row);
  return (
    <div ref={ref} onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <Combobox
        value={current ?? undefined}
        onValueChange={(v) => {
          if (typeof v === "string") onCommit(v);
        }}
        options={options}
        mode="single"
        searchable={options.length > 8}
        clearable={false}
        defaultOpen
        // Same box as the display badge (enumBadge) → no size jump entering/leaving edit mode.
        className="h-7 w-[12rem] max-w-full"
        // Entirely-colored trigger (service-order look); options stay plain text.
        triggerClassName={enumTriggerClass(current, cfg)}
      />
    </div>
  );
}

function RelationEditor<TData>({ field, edit, row, onCommit, onCancel }: EditorProps<TData>) {
  const ref = useRef<HTMLDivElement>(null);
  useOutsideDismiss(ref, onCancel, true);
  const current = (edit.get(row) as string | null) ?? undefined;
  const useAsync = !!edit.loadOptions;
  // Seed the combobox with the current selection (resolved from the row) + any static options, so the
  // trigger shows the LABEL immediately on open instead of the raw id while loadOptions resolves.
  const seed = [...(edit.currentOptions?.(row) ?? []), ...(edit.options ?? [])];
  const seedOpts = seed.length ? seed : undefined;
  return (
    <div ref={ref} onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <Combobox
        value={current}
        onValueChange={(v) => onCommit(v == null ? null : typeof v === "string" ? v : v[0] ?? null)}
        mode="single"
        async={useAsync}
        queryKey={useAsync ? [field.id, "relation-options"] : undefined}
        queryFn={useAsync ? (s, p) => edit.loadOptions!(s, p) : undefined}
        options={useAsync ? undefined : seedOpts}
        initialOptions={seedOpts}
        minSearchLength={0}
        clearable
        searchable
        defaultOpen
        className="h-8 w-[16rem] max-w-full"
        placeholder={edit.placeholder}
      />
    </div>
  );
}

function MultiselectEditor<TData>({ field, edit, row, onCommit, onCancel }: EditorProps<TData>) {
  const ref = useRef<HTMLDivElement>(null);
  useOutsideDismiss(ref, onCancel, true);
  const current = Array.isArray(edit.get(row)) ? (edit.get(row) as string[]) : [];
  const useAsync = !!edit.loadOptions;
  // Seed with the current selections (resolved from the row) + static options so the chips render
  // labels immediately instead of raw ids before loadOptions resolves.
  const seed = [...(edit.currentOptions?.(row) ?? []), ...(edit.options ?? [])];
  const seedOpts = seed.length ? seed : undefined;
  return (
    <div ref={ref} onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <Combobox
        value={current}
        // keepOpen: each toggle commits but stays in edit mode (the dropdown stays open for
        // more selections — exit with click-away or Esc).
        onValueChange={(v) => onCommit(Array.isArray(v) ? v : v == null ? [] : [v], true)}
        mode="multiple"
        async={useAsync}
        queryKey={useAsync ? [field.id, "multiselect-options"] : undefined}
        queryFn={useAsync ? (s, p) => edit.loadOptions!(s, p) : undefined}
        options={useAsync ? undefined : seedOpts}
        initialOptions={seedOpts}
        minSearchLength={0}
        clearable
        searchable
        defaultOpen
        showCount
        hideDefaultBadges
        className="h-8 w-[18rem] max-w-full"
        placeholder={edit.placeholder}
      />
    </div>
  );
}

function Editor<TData>(props: EditorProps<TData>) {
  const dt = props.field.dataType ?? "text";
  if (dt === "textarea") return <TextareaEditor {...props} />;
  if (dt === "date" || dt === "datetime" || dt === "time") return <DateEditor {...props} />;
  if (dt === "boolean") return <BooleanEditor {...props} />;
  if (dt === "enum" && props.edit.enum) return <EnumEditor {...props} />;
  if (dt === "relation") return <RelationEditor {...props} />;
  if (dt === "multiselect") return <MultiselectEditor {...props} />;
  if (TEXT_LIKE.has(dt)) return <TextEditor {...props} />;
  return <TextEditor {...props} />;
}

// ---------------------------------------------------------------------------
// The field controller — display ⇄ edit (generalizes GoalCell)
// ---------------------------------------------------------------------------

interface InlineEditFieldProps<TData> {
  field: DetailFieldDef<TData>;
  row: TData;
  /** Whether the user may inline-edit this field (privilege + edit def present). */
  editable: boolean;
}

function InlineEditFieldInner<TData>({ field, row, editable }: InlineEditFieldProps<TData>) {
  const { dataType = "text", edit } = field;
  const canEdit = editable && !!edit;
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  // Re-entrancy guard: a blur firing mid-commit must not kick off a second mutation / confirm dialog.
  const inFlight = useRef(false);
  // Inline rows keep a constant height whether showing text or an h-8 editor (no jump on edit).
  const inlineRowCls = field.block ? undefined : "min-h-[2.5rem] py-1";

  // Inline "Desfazer" affordance: after a successful edit we park the previous value and a live
  // countdown right ON the field (not a corner toast), so the undo sits next to what changed and
  // disappears after UNDO_SECONDS.
  const [undo, setUndo] = useState<{ previousValue: unknown } | null>(null);
  const [remaining, setRemaining] = useState(0);
  const undoTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pause the countdown without losing the parked value/time (used on hover/focus of the button).
  const pauseUndo = useCallback(() => {
    if (undoTimer.current) {
      clearInterval(undoTimer.current);
      undoTimer.current = null;
    }
  }, []);

  const clearUndo = useCallback(() => {
    pauseUndo();
    setUndo(null);
    setRemaining(0);
  }, [pauseUndo]);

  // (Re)start the per-second tick from whatever `remaining` currently is — drives both the initial
  // countdown and resume-after-hover.
  const runCountdown = useCallback(() => {
    pauseUndo();
    undoTimer.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          pauseUndo();
          setUndo(null);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }, [pauseUndo]);

  const startUndo = useCallback((previousValue: unknown) => {
    setUndo({ previousValue });
    setRemaining(UNDO_SECONDS);
    runCountdown();
  }, [runCountdown]);

  // Resume the tick when the pointer leaves the button — only if an undo is still parked with time left.
  const resumeUndo = useCallback(() => {
    if (undo && remaining > 0 && !undoTimer.current) runCountdown();
  }, [undo, remaining, runCountdown]);

  // Stop the countdown if the field unmounts mid-window.
  useEffect(() => () => clearUndo(), [clearUndo]);

  const begin = useCallback(() => {
    if (canEdit && !pending) {
      clearUndo(); // a fresh edit supersedes any pending undo
      setEditing(true);
    }
  }, [canEdit, pending, clearUndo]);
  const cancel = useCallback(() => setEditing(false), []);

  // Roll back to a previous value (the inline "Desfazer" button). Goes STRAIGHT to onCommit —
  // deliberately bypassing the no-op check, the `beforeCommit` gate (which would re-prompt / read
  // stale reason refs) and the undo affordance itself (so undo can't re-arm). A rejected revert (e.g.
  // an illegal backward enum transition) is swallowed — the axios interceptor already surfaced it.
  const revert = useCallback(
    async (previousValue: unknown) => {
      clearUndo(); // dismiss the affordance immediately on click
      if (!edit || inFlight.current) return;
      setPending(true);
      inFlight.current = true;
      try {
        await Promise.resolve(edit.onCommit(previousValue, row));
      } catch {
        // interceptor already toasted; keep the current value
      } finally {
        setPending(false);
        inFlight.current = false;
      }
    },
    [edit, row, clearUndo],
  );

  const commit = useCallback(
    async (value: unknown, keepOpen = false) => {
      if (!edit) return;
      // A commit is already running — drop this one (e.g. blur after Enter, or a second dialog).
      if (inFlight.current) return;
      if (edit.validate) {
        const err = edit.validate(value);
        if (err) {
          toast.error(err);
          return;
        }
      }
      // No-op edits just exit (cheap structural compare; treat null/undefined/"" as equal so an
      // untouched empty field doesn't fire a spurious commit on blur).
      const norm = (x: unknown) => (x == null || x === "" ? null : x);
      if (JSON.stringify(norm(value)) === JSON.stringify(norm(edit.get(row)))) {
        if (!keepOpen) setEditing(false);
        return;
      }
      // Snapshot the pre-mutation value (shape-symmetric with onCommit) for the undo action. Read
      // from the closure `row`, which stays the pre-commit record even after a refetch swaps the prop.
      const previousValue = edit.get(row);
      setPending(true);
      inFlight.current = true;
      try {
        // Optional confirm/reason gate — resolving false (or throwing) aborts silently and reverts.
        if (edit.beforeCommit) {
          const proceed = await Promise.resolve(edit.beforeCommit(value, row));
          if (!proceed) {
            if (!keepOpen) setEditing(false);
            return;
          }
        }
        await Promise.resolve(edit.onCommit(value, row));
        if (!keepOpen) setEditing(false);
        // Arm the inline undo on real, edit-closing commits. Skip multiselect's keepOpen toggles and
        // gated fields (beforeCommit) — those changes are intentional/audited and an undo would bypass
        // their confirm/reason capture and leave a reasonless reversal.
        if (!keepOpen && !edit.beforeCommit) {
          startUndo(previousValue);
        }
      } catch {
        // Mutation/axios interceptor already surfaces the error; keep the old value.
      } finally {
        setPending(false);
        inFlight.current = false;
      }
    },
    [edit, row, startUndo],
  );

  if (editing && edit) {
    return (
      <DetailRow
        icon={field.icon}
        label={field.label}
        value={<Editor field={field} edit={edit} row={row} onCommit={commit} onCancel={cancel} />}
        block={field.block}
        className={inlineRowCls}
      />
    );
  }

  const display = field.render ? field.render(row) : renderFieldValue(dataType, field.accessor ? field.accessor(row) : edit?.get(row), edit, row);
  const node = display ?? <span className="italic text-muted-foreground">—</span>;

  if (canEdit) {
    // Inline undo button — sits next to the value that just changed, with a live Ns countdown. Its
    // click reverts and is stopped from bubbling so it doesn't double-click the row into edit mode.
    const undoButton = undo ? (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void revert(undo.previousValue);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        // Pause the countdown while the user is hovering/focusing — gives them time to actually click.
        onMouseEnter={pauseUndo}
        onMouseLeave={resumeUndo}
        onFocus={pauseUndo}
        onBlur={resumeUndo}
        title="Desfazer alteração"
        className={cn(
          "group/undo inline-flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-3 pr-1.5 text-xs font-semibold shadow-sm outline-none",
          "bg-destructive text-destructive-foreground",
          "transition-all duration-150 hover:brightness-110 hover:shadow-md active:scale-[0.97]",
          "focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          "animate-in fade-in-50 zoom-in-95",
        )}
      >
        <IconArrowBackUp className="h-4 w-4 transition-transform duration-150 group-hover/undo:-translate-x-0.5" />
        <span>Desfazer</span>
        <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive-foreground/20 px-1.5 text-[11px] font-bold leading-none tabular-nums">
          {remaining}
        </span>
      </button>
    ) : null;

    // Inline fields: chip to the right of the value. Block fields: chip beneath the stacked value.
    const valueNode = undoButton
      ? field.block
        ? (
          <div className="flex flex-col gap-1.5">
            {node}
            <div className="flex justify-start">{undoButton}</div>
          </div>
        )
        : (
          <div className="flex w-full items-center justify-end gap-2">
            <span className="min-w-0 truncate">{node}</span>
            {undoButton}
          </div>
        )
      : node;

    // The WHOLE row is the double-click target (big, easy hit area) with a neutral hover.
    return (
      <DetailRow
        icon={field.icon}
        label={field.label}
        value={valueNode}
        block={field.block}
        role="button"
        tabIndex={0}
        title="Duplo clique para editar"
        onDoubleClick={begin}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "F2") {
            e.preventDefault();
            begin();
          }
        }}
        className={cn(
          inlineRowCls,
          // select-none so the double-click that enters edit mode doesn't select/copy the text.
          "cursor-pointer select-none outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-1 focus-visible:ring-border",
          pending && "pointer-events-none opacity-60",
        )}
      />
    );
  }

  return <DetailRow icon={field.icon} label={field.label} value={node} block={field.block} className={inlineRowCls} />;
}

export const InlineEditField = memo(InlineEditFieldInner) as typeof InlineEditFieldInner;
