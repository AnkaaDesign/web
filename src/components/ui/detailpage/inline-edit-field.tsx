import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
// The app mounts the custom Toaster (@/components/ui/sonner) which strips background/padding from
// raw sonner toasts — use the wrapper so the validation-error toast renders styled.
import { toast } from "@/components/ui/sonner";
import { IconArrowBackUp, IconBellPlus } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useAttentionField, attentionRowClass, useAnnouncePresence, useSendWarning, canSendAttentionWarning, type AttentionEntityType } from "@/lib/attention";
import { useAuth } from "@/contexts/auth-context";
import { usePricingVisible } from "@/hooks/common/use-pricing-visible";
import { SECTOR_PRIVILEGES } from "@/constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { DetailRow } from "@/components/ui/detail-row";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
// Also excludes the "send warning" bell (data-attn-send-warning): it sits OUTSIDE the editor's
// own ref'd container (rendered via DetailRow's `trailing` slot), so without this exclusion the
// capture-phase mousedown on it fires `onDismiss` (cancelling the edit) BEFORE the button's own
// click ever reaches it — the modal never opens. Same mechanism as excluding popover portals.
const PORTAL_SELECTOR =
  '[data-radix-popper-content-wrapper],[data-radix-popover-content],[role="listbox"],[role="dialog"],[role="menu"],[cmdk-root],[data-attn-send-warning]';

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
  const raw = edit.get(row);
  const value = raw ? new Date(raw as string | number | Date) : null;
  const mode = field.dataType === "time" ? "time" : field.dataType === "datetime" ? "datetime" : "date";

  // In `datetime` mode a single edit spans TWO picks in the same popover — first the calendar day,
  // then the time. The date pick fires onChange, so committing on it tears the editor down before the
  // time can be entered. So buffer the value locally (feeding it back into the picker so the calendar
  // reflects each pick) and commit ONCE when the editor is dismissed. `date`/`time` are single-pick,
  // so they keep the original commit-on-change behavior.
  const isDateTime = mode === "datetime";
  const [draft, setDraft] = useState<Date | null>(value);
  const draftRef = useRef<Date | null>(draft);
  draftRef.current = draft;
  const commitDraft = useCallback(() => onCommit(draftRef.current), [onCommit]);

  useOutsideDismiss(ref, isDateTime ? commitDraft : onCancel, true);

  return (
    // Force the inner control (a h-10 div, not a button) to h-8 so the row keeps its height.
    <div ref={ref} className="[&_.h-10]:!h-8" onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      {/* `DateTimeInput.onChange` is typed `Date | DateRange | null` because the same control also
          serves range pickers. `mode` here is only date/time/datetime, so a DateRange cannot
          arrive — collapse anything that is not a Date to null rather than forwarding a range
          this editor (and the field it commits to) has no meaning for. */}
      {isDateTime ? (
        <DateTimeInput mode={mode} value={draft} onChange={(d) => setDraft(d instanceof Date ? d : null)} hideLabel />
      ) : (
        <DateTimeInput mode={mode} value={value} onChange={(d) => onCommit(d instanceof Date ? d : null)} hideLabel />
      )}
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
  /** When set, editing is LOCKED (another user is editing) — shown as a hover tooltip. */
  lockedReason?: string;
}

function InlineEditFieldInner<TData>({ field, row, editable, lockedReason }: InlineEditFieldProps<TData>) {
  const { dataType = "text", edit } = field;
  const canEdit = editable && !!edit;
  // memo()'d on (field, row, editable, lockedReason) — none of which change when "mostrar/ocultar
  // valores" flips. Money fields (and any custom `render`) would otherwise keep their stale masking.
  void usePricingVisible();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  // Re-entrancy guard: a blur firing mid-commit must not kick off a second mutation / confirm dialog.
  const inFlight = useRef(false);
  // Inline rows keep a constant height whether showing text or an h-8 editor (no jump on edit).
  const inlineRowCls = field.block ? undefined : "min-h-[2.5rem] py-1";

  // Attention system: blink the WHOLE row (not just the value) while a rule targets this
  // field. Hooks are unconditional (no-op when `field.attention` is absent — id
  // undefined → null state).
  const attnRowId = field.attention ? (row as { id?: string } | null)?.id : undefined;
  const attnState = useAttentionField((field.attention?.entityType as AttentionEntityType) ?? "TASK", attnRowId, field.id);
  const { open: openSendWarning } = useSendWarning();
  const attnRowCls = field.attention ? cn("group/attnrow", attentionRowClass(attnState)) : undefined;

  // WHY this field is ringing, on hover of the field itself — a ring with no explanation is
  // the thing users ask about. Styled (Radix) rather than a `title` attribute: the native
  // browser tooltip looks out of place and, worse, renders alongside the styled tooltips
  // already used elsewhere in the header, so the user got two different popups at once.
  // For a manual warning the rule's `name` IS the sender's message (see `pushedRule`).
  const attnReason = attnState?.active ? attnState.match.rule.name : undefined;

  // Anchoring for the row tooltip — see `withRowTooltip`.
  const rowAnchorRef = useRef<HTMLDivElement>(null);
  const pointerXRef = useRef(0);
  const [tooltipAlignOffset, setTooltipAlignOffset] = useState(0);

  // PRESENCE: while this field is actually open in edit mode, announce that this user
  // holds the record, so everyone else sees "está editando" and their own edit
  // affordances lock. Inline edits used to be completely invisible to the guard — a
  // user could sit editing a field on the detail page while someone else opened the
  // full edit form and overwrote it, with neither side warned.
  //
  // Only announces when the field declares its entity type: guessing (e.g. defaulting
  // to TASK) would broadcast presence onto the wrong entity from every other detail page.
  // The gateway refcounts per tab, so several fields open at once release correctly.
  const presenceEntityType = field.attention?.entityType as AttentionEntityType | undefined;
  const presenceRowId = presenceEntityType ? (row as { id?: string } | null)?.id : undefined;
  useAnnouncePresence(presenceEntityType ?? "TASK", presenceRowId, editing && !!presenceRowId);

  // "Enviar aviso" (send a manual warning) — ADMIN/COMMERCIAL only, and never a
  // standing icon on the row: it only appears once the field is actually opened
  // (double-click), next to the editor for editable fields, or as the double-click
  // action itself for read-only fields (which have no editor to sit next to).
  const { user } = useAuth();
  const canSendWarning = canSendAttentionWarning(user?.sector?.privileges);
  // Recipients = the people who can ACT on this field. Normally that is the field's own
  // privilege gate, but a field whose edit gate is a capability (team leadership, a state
  // machine, ownership) declares nothing here — and an undeclared audience widens the picker
  // to EVERY active user, which is how "Status" ended up offering PRODUCTION (who can't touch
  // it at all). `attention.warnPrivileges` is the explicit override for exactly that case.
  const allowedPrivileges = field.attention?.warnPrivileges ?? field.editablePrivilege ?? field.requiredPrivilege;
  // ADMIN can edit/see every field (privileges are inherited), so admins are always
  // valid recipients even when they aren't in the field's literal privilege list —
  // otherwise "send to another admin" silently returns nobody.
  const normalizedAllowedPrivileges = allowedPrivileges
    ? Array.from(new Set([...(Array.isArray(allowedPrivileges) ? allowedPrivileges : [allowedPrivileges]), SECTOR_PRIVILEGES.ADMIN]))
    : undefined;
  const openWarningForField = () => {
    if (!attnRowId) return;
    openSendWarning({
      entityType: (field.attention?.entityType as AttentionEntityType) ?? "TASK",
      entityId: attnRowId,
      target: { level: "field", field: field.id },
      entityLabel: (row as { name?: string } | null)?.name,
      fieldLabel: typeof field.label === "string" ? field.label : undefined,
      allowedPrivileges: normalizedAllowedPrivileges as string[] | undefined,
    });
  };
  const sendWarningBtn =
    field.attention?.sendWarning && attnRowId && canSendWarning ? (
      <button
        type="button"
        title="Enviar aviso"
        data-attn-send-warning
        // Blur-committing editors (Text/Textarea) commit-on-blur; outside-dismiss editors
        // (Date/Enum/Boolean) cancel on capture-phase mousedown. Both fire on the mousedown
        // that precedes this click, tearing the editor (and this very button) down before the
        // click itself can land. preventDefault here stops the browser's default focus-shift
        // so no blur fires; the `data-attn-send-warning` marker (see PORTAL_SELECTOR) keeps the
        // outside-dismiss check from treating this button as "outside."
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          openWarningForField();
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <IconBellPlus className="h-3.5 w-3.5" />
      </button>
    ) : null;

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

  /**
   * ONE tooltip per field row, always the styled (Radix) one — the same component the header's
   * action buttons use. The three things a row can have to say used to arrive by two different
   * mechanisms: the attention reason and the interaction hint as native `title` attributes, the
   * edit lock as a styled popup on "Editar". Mixing them let two visually unrelated popups sit
   * on screen at once, one of them the browser's.
   *
   * Order is by usefulness: why it is ringing, then why you cannot edit it, and the "what do I
   * do here" hint only when there is nothing more important to say.
   *
   * `DetailRow` is a plain function component (no ref forwarding), so `asChild` gets a wrapper
   * element rather than the row itself; the wrapper is layout-neutral and the ring stays on the
   * row inside it.
   */
  const withRowTooltip = (rowNode: ReactNode, hint?: string) => {
    const lines: string[] = [];
    if (attnReason) lines.push(attnReason);
    if (lockedReason && field.edit) lines.push(lockedReason);
    if (lines.length === 0 && hint) lines.push(hint);
    if (lines.length === 0) return rowNode;
    return (
      <Tooltip
        // A field row spans the whole card, and Radix anchors to the TRIGGER — so a
        // centred tooltip landed a long way from wherever the pointer actually was.
        // Resolve the horizontal offset from the last pointer position at OPEN time.
        onOpenChange={(open) => {
          if (!open) return;
          const rect = rowAnchorRef.current?.getBoundingClientRect();
          if (rect) setTooltipAlignOffset(Math.round(pointerXRef.current - rect.left));
        }}
      >
        <TooltipTrigger asChild>
          {/* Tracked on a ref, not state: a row re-render per mousemove is not worth it. */}
          <div ref={rowAnchorRef} onPointerMove={(e) => (pointerXRef.current = e.clientX)}>
            {rowNode}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" alignOffset={tooltipAlignOffset} sideOffset={6} collisionPadding={8}>
          {lines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </TooltipContent>
      </Tooltip>
    );
  };

  if (editing && edit) {
    return withRowTooltip(
      <DetailRow
        icon={field.icon}
        label={field.label}
        value={<Editor field={field} edit={edit} row={row} onCommit={commit} onCancel={cancel} />}
        block={field.block}
        trailing={sendWarningBtn}
        className={cn(inlineRowCls, attnRowCls)}
      />,
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
    // No standing "send warning" affordance here — double-click enters edit mode, above,
    // where the bell appears next to the editor for ADMIN/COMMERCIAL.
    return withRowTooltip(
      <DetailRow
        icon={field.icon}
        label={field.label}
        value={valueNode}
        block={field.block}
        role="button"
        tabIndex={0}
        onDoubleClick={begin}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "F2") {
            e.preventDefault();
            begin();
          }
        }}
        className={cn(
          inlineRowCls,
          attnRowCls,
          // select-none so the double-click that enters edit mode doesn't select/copy the text.
          "cursor-pointer select-none outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-1 focus-visible:ring-border",
          pending && "pointer-events-none opacity-60",
        )}
      />,
      "Duplo clique para editar",
    );
  }

  // Read-only fields have no double-click behavior to protect (editable fields use it to
  // enter edit mode, above, where the bell sits next to the editor instead) — so a field
  // opted into `attention.sendWarning` gets the whole row as a double-click target,
  // ADMIN/COMMERCIAL only. No standing icon; the row itself is the only affordance.
  const openWarningOnRow = field.attention?.sendWarning && attnRowId && canSendWarning ? openWarningForField : undefined;

  return withRowTooltip(
    <DetailRow
      icon={field.icon}
      label={field.label}
      value={node}
      block={field.block}
      onDoubleClick={openWarningOnRow}
      className={cn(inlineRowCls, attnRowCls, openWarningOnRow && "cursor-pointer", lockedReason && field.edit && "opacity-70")}
    />,
    openWarningOnRow ? "Duplo clique para enviar aviso" : undefined,
  );
}

export const InlineEditField = memo(InlineEditFieldInner) as typeof InlineEditFieldInner;
