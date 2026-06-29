import { Fragment } from "react";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { cn } from "@/lib/utils";
import type { DataTableRowAction } from "./data-table-types";

export interface DataTableContextMenuState<TData> {
  x: number;
  y: number;
  rows: TData[];
  isBulk: boolean;
}

interface DataTableContextMenuProps<TData> {
  state: DataTableContextMenuState<TData> | null;
  onClose: () => void;
  actions: DataTableRowAction<TData>[];
}

/**
 * A single positioned context menu rendered once at table level (O(1)), driven by
 * the right-clicked row's coordinates — NOT a per-row Radix menu (which would churn
 * under virtualization). Bulk/single is resolved by the caller via `state.isBulk`.
 *
 * Actions carrying a `group` collapse into a nested submenu (e.g. "Avançados"), placed
 * at the position of the group's first action.
 */
export function DataTableContextMenu<TData>({ state, onClose, actions }: DataTableContextMenuProps<TData>) {
  const open = !!state;
  const rows = state?.rows ?? [];
  const visible = actions.filter((a) => !a.hidden?.(rows));

  const renderItem = (action: DataTableRowAction<TData>) => (
    <DropdownMenuItem
      disabled={action.disabled?.(rows)}
      onSelect={() => {
        action.onClick(rows);
        onClose();
      }}
      className={cn("gap-2", action.variant === "destructive" && "text-destructive focus:text-destructive")}
    >
      {action.icon}
      {action.label}
    </DropdownMenuItem>
  );

  const renderedGroups = new Set<string>();

  return (
    <DropdownMenu open={open} onOpenChange={(o) => !o && onClose()}>
      <PositionedDropdownMenuContent position={state ? { x: state.x, y: state.y } : null} isOpen={open} className="w-56">
        {state?.isBulk && (
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {rows.length} {rows.length === 1 ? "item selecionado" : "itens selecionados"}
          </DropdownMenuLabel>
        )}
        {visible.map((action) => {
          if (action.group) {
            // Render the whole submenu once, at the first grouped action's position.
            if (renderedGroups.has(action.group.id)) return null;
            renderedGroups.add(action.group.id);
            const groupActions = visible.filter((a) => a.group?.id === action.group!.id);
            return (
              <Fragment key={`group-${action.group.id}`}>
                {action.separatorBefore && <DropdownMenuSeparator />}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2">
                    {action.group.icon}
                    {action.group.label}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {groupActions.map((ga, i) => (
                      <Fragment key={ga.key}>
                        {/* The first action's separatorBefore drives the submenu TRIGGER, not a stray
                            divider at the top of the submenu. */}
                        {i > 0 && ga.separatorBefore && <DropdownMenuSeparator />}
                        {renderItem(ga)}
                      </Fragment>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </Fragment>
            );
          }
          return (
            <Fragment key={action.key}>
              {action.separatorBefore && <DropdownMenuSeparator />}
              {renderItem(action)}
            </Fragment>
          );
        })}
      </PositionedDropdownMenuContent>
    </DropdownMenu>
  );
}
