import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * URL-driven dialog open state. Reads a query param and exposes
 * `{ value, open, set, clear }`. Setting/clearing pushes a new history entry
 * so browser back/forward navigates between "modal open" and "modal closed",
 * and the URL is shareable.
 *
 * Why URL state? Reconciliation works across two pages (transactions <-> NFs)
 * and we want cross-links — clicking an NF inside the TX modal should navigate
 * to /notas?nfId=… and have that modal auto-open. Local React state can't do
 * that; URL state can.
 *
 * Usage:
 *   const txDialog = useUrlDialog("txId");
 *   <Dialog open={txDialog.open} onOpenChange={o => !o && txDialog.clear()}>
 *   <button onClick={() => txDialog.set(row.id)}>
 */
export function useUrlDialog(paramName: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(paramName);

  const set = useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(searchParams);
      if (next) params.set(paramName, next);
      else params.delete(paramName);
      setSearchParams(params, { replace: false });
    },
    [paramName, searchParams, setSearchParams],
  );

  const clear = useCallback(() => set(null), [set]);

  return useMemo(
    () => ({
      value,
      open: !!value,
      set,
      clear,
    }),
    [value, set, clear],
  );
}
