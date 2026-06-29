// components/ui/detail-row.tsx
//
// Label/value row used inside detail-page Cards. Mirrors the visual style of
// the canonical Task detail page: a flex row with a slightly different shade
// (bg-muted/50) for the row, a muted-foreground label on the left, and a
// foreground value on the right.
//
// Usage:
//
//   <Card>
//     <CardHeader><CardTitle>Informações</CardTitle></CardHeader>
//     <CardContent>
//       <div className="space-y-2">
//         <DetailRow icon={IconHash} label="Ordem" value={5} />
//         <DetailRow label="Status" value={<Badge>Ativo</Badge>} />
//         <DetailRow label="Descrição" value="..." block />
//       </div>
//     </CardContent>
//   </Card>

import * as React from "react";

import { cn } from "@/lib/utils";

export interface DetailRowProps {
  /** Optional Tabler icon component shown to the left of the label. */
  icon?: React.ComponentType<{ className?: string }>;
  label: React.ReactNode;
  value?: React.ReactNode;
  /**
   * Stack label above value (e.g. for long-form descriptions). Defaults to
   * inline (label left, value right).
   */
  block?: boolean;
  /** Optional alternative tone — defaults to "muted". */
  tone?: "muted" | "alert";
  className?: string;
  /** Slot rendered to the right of the value (e.g. inline actions/icons). */
  trailing?: React.ReactNode;
  /** Interactive props — let the whole row act as a click/keyboard target (inline edit). */
  onDoubleClick?: React.MouseEventHandler<HTMLDivElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  role?: string;
  tabIndex?: number;
  title?: string;
}

const TONE_CLASSES: Record<NonNullable<DetailRowProps["tone"]>, string> = {
  muted: "bg-muted/50",
  alert:
    "bg-red-50/50 dark:bg-red-900/20 border border-red-200/40 dark:border-red-700/40",
};

export function DetailRow({
  icon: Icon,
  label,
  value,
  block,
  tone = "muted",
  trailing,
  className,
  onDoubleClick,
  onKeyDown,
  role,
  tabIndex,
  title,
}: DetailRowProps) {
  const containerCls = cn(
    "rounded-lg px-4",
    block ? "py-3" : "py-2.5",
    "flex gap-3",
    block ? "flex-col" : "items-center justify-between",
    TONE_CLASSES[tone],
    className,
  );

  return (
    <div className={containerCls} onDoubleClick={onDoubleClick} onKeyDown={onKeyDown} role={role} tabIndex={tabIndex} title={title}>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {Icon ? <Icon className="h-4 w-4" /> : null}
        <span>{label}</span>
      </div>
      <div
        className={cn(
          "flex items-center gap-2",
          block
            ? "text-sm text-foreground"
            : // inline: right-aligned, capped at ~half the row so long values wrap instead of
              // crowding the label.
              "min-w-0 max-w-[55%] justify-end text-right text-sm font-semibold text-foreground",
        )}
      >
        <div className={cn("min-w-0", block ? "w-full whitespace-pre-wrap leading-relaxed" : "whitespace-pre-wrap break-words")}>
          {value ?? <span className="text-muted-foreground italic">—</span>}
        </div>
        {trailing}
      </div>
    </div>
  );
}

export default DetailRow;
