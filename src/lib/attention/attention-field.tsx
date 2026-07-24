// =====================================================
// Attention system — <AttentionField> primitive
// =====================================================
//
// Drop-in wrapper for a single value in a table cell or a detail field. It
// subscribes to the field's blink state and applies the animation class while a
// burst is active, driving the number of pulses from the rule's cadence so the
// field really does "blink the 5× it will do". Renders an inline-block span by
// default so it never disturbs table/flex layout.
//
// On detail pages, pass `sendWarning` to expose a manual "Enviar aviso" affordance
// (a small icon + double-click) that opens the recipient picker targeting exactly
// this field — the icon-only trigger the detail page uses.

import { IconBellPlus } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

import { useSendWarning } from "./send-warning";
import { useAttentionField, attentionFieldClass } from "./use-attention";
import type { AttentionEntityType } from "./types";

interface AttentionFieldProps {
  type: AttentionEntityType;
  id: string | undefined;
  field: string;
  children: React.ReactNode;
  className?: string;
  /** Render as a block element instead of inline (e.g. wrapping a whole cell). */
  block?: boolean;
  /** Enable the manual "send a warning" affordance (detail pages only). */
  sendWarning?: { entityLabel?: string; fieldLabel?: string };
}

export function AttentionField({ type, id, field, children, className, block, sendWarning }: AttentionFieldProps) {
  const state = useAttentionField(type, id, field);
  const { open } = useSendWarning();
  const blinkCount = state?.match.rule.cadence.blinkCount;
  const pulseMs = state?.match.rule.cadence.pulseMs;

  const openWarning = () => {
    if (!id || !sendWarning) return;
    open({ entityType: type, entityId: id, target: { level: "field", field }, entityLabel: sendWarning.entityLabel, fieldLabel: sendWarning.fieldLabel });
  };

  return (
    <span
      data-attention={state?.active ? (state.bursting ? "burst" : "active") : undefined}
      className={cn(block ? "block" : "inline-block", "group/attn relative rounded-sm", attentionFieldClass(state), className)}
      style={
        state?.bursting
          ? { animationIterationCount: blinkCount ?? 5, animationDuration: pulseMs ? `${pulseMs}ms` : undefined }
          : undefined
      }
      onDoubleClick={sendWarning ? openWarning : undefined}
    >
      {children}
      {sendWarning ? (
        <button
          type="button"
          title="Enviar aviso"
          onClick={(e) => {
            e.stopPropagation();
            openWarning();
          }}
          className="ml-1 inline-flex opacity-0 transition-opacity group-hover/attn:opacity-100 text-muted-foreground hover:text-foreground"
        >
          <IconBellPlus className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </span>
  );
}
