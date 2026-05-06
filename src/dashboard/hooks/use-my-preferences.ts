// Hook fetching (and lazily creating) the current user's Preferences record.
// Used by the dashboard layout hook to read/write dashboardLayoutWeb.

import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../contexts/auth-context";
import { usePreferences, useCreatePreferences, useUpdatePreferences } from "../../hooks/common/use-preferences";
import { preferencesKeys } from "../../hooks/common/query-keys";
import type { Preferences } from "../../types";

export function useMyPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  // The generated `usePreferences` query type only declares `include` fields, but
  // the underlying service accepts the full GetMany shape (where, orderBy, etc.).
  // Cast through `any` here so we can pass `userId` filter — the backend accepts it.
  const list = usePreferences(
    { userId: userId ?? undefined, limit: 1 } as any,
    { enabled: !!userId } as any,
  );

  const createMutation = useCreatePreferences();
  const updateMutation = useUpdatePreferences();

  const existing: Preferences | undefined = list.data?.data?.[0];
  const hasExisting = !!existing;
  const hasResolvedQuery = list.isSuccess || list.isError;

  // Lazily create a Preferences record if the user has none yet — avoids
  // forcing a manual save just to bootstrap the dashboard layout.
  const creationAttempted = useRef(false);
  useEffect(() => {
    if (!userId) return;
    if (!hasResolvedQuery) return;
    if (hasExisting) return;
    if (creationAttempted.current) return;
    if (createMutation.isPending) return;
    creationAttempted.current = true;
    // createMutation from createEntityHooks expects { data, include? } — not the data directly.
    createMutation
      .mutateAsync({ data: { userId } } as any)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: preferencesKeys.all });
      })
      .catch((err: unknown) => {
        // Common case: a preferences record was created by another tab / earlier
        // session, so the unique-userId constraint kicks in. Treat that as
        // success and refetch — the existing record is what we wanted anyway.
        const status = (err as { statusCode?: number; response?: { status?: number } })?.statusCode
          ?? (err as { response?: { status?: number } })?.response?.status;
        if (status === 409) {
          queryClient.invalidateQueries({ queryKey: preferencesKeys.all });
          return;
        }
        // Otherwise allow another attempt on next mount.
        creationAttempted.current = false;
      });
  }, [userId, hasResolvedQuery, hasExisting, createMutation, queryClient]);

  const updateMine = useMemo(() => {
    return async (data: Parameters<typeof updateMutation.mutateAsync>[0]["data"]) => {
      if (!existing?.id) {
        throw new Error("Preferências do usuário ainda não estão disponíveis.");
      }
      const res = await updateMutation.mutateAsync({ id: existing.id, data });
      queryClient.invalidateQueries({ queryKey: preferencesKeys.all });
      return res;
    };
  }, [existing?.id, updateMutation, queryClient]);

  return {
    preferences: existing ?? null,
    isLoading: list.isLoading || (createMutation.isPending && !hasExisting),
    isError: list.isError,
    error: list.error,
    isUpdating: updateMutation.isPending,
    updateMine,
  };
}
