import { useCallback } from "react";
import { usePrivileges } from "@/hooks/common/use-privileges";
import type { PrivilegeGate } from "./detail-page-types";

interface ViewGate {
  requiredPrivilege?: PrivilegeGate;
}
interface EditGate extends ViewGate {
  editablePrivilege?: PrivilegeGate;
}

/**
 * The single privilege gate for the detail-page system — the exact same semantics the
 * DataTable columns use (`usePrivileges().canAccess`: ADMIN always passes, array = OR).
 *
 * - `canView`  → may the section/field be seen at all (`requiredPrivilege`).
 * - `canEdit`  → may the field be inline-edited (`requiredPrivilege` AND `editablePrivilege`).
 *
 * A `canView=false` item is removed entirely; `canView && !canEdit` renders read-only.
 */
export function useFieldGate() {
  const { canAccess, currentPrivilege } = usePrivileges();

  // `canAccess` is recreated each render; pin the memoized callbacks to the stable
  // `currentPrivilege` string so consumers can use them in deps without re-running.
  const isAllowed = useCallback(
    (gate?: PrivilegeGate) => !gate || canAccess(gate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentPrivilege],
  );

  const canView = useCallback((g?: ViewGate) => isAllowed(g?.requiredPrivilege), [isAllowed]);
  const canEdit = useCallback(
    (g?: EditGate) => isAllowed(g?.requiredPrivilege) && isAllowed(g?.editablePrivilege),
    [isAllowed],
  );

  return { isAllowed, canView, canEdit, currentPrivilege };
}
