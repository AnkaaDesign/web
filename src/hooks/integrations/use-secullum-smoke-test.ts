import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { secullumSmokeTestService, type SecullumSmokeRun } from "../../api-client/services/secullum-smoke-test";

export const secullumSmokeTestKeys = {
  all: ["secullum-smoke-test"] as const,
  runs: (take: number) => [...secullumSmokeTestKeys.all, "runs", take] as const,
  latest: () => [...secullumSmokeTestKeys.all, "latest"] as const,
};

export const useSecullumSmokeTestRuns = (take = 10, enabled = true) =>
  useQuery({
    queryKey: secullumSmokeTestKeys.runs(take),
    queryFn: () => secullumSmokeTestService.listRuns(take),
    enabled,
    staleTime: 30_000,
  });

export const useLatestSecullumSmokeTestRun = (enabled = true) =>
  useQuery({
    queryKey: secullumSmokeTestKeys.latest(),
    queryFn: () => secullumSmokeTestService.latestRun(),
    enabled,
    staleTime: 30_000,
  });

export const useRunSecullumSmokeTest = () => {
  const qc = useQueryClient();
  return useMutation<SecullumSmokeRun | null, unknown, boolean>({
    mutationFn: (includeApuracao: boolean) => secullumSmokeTestService.run(includeApuracao),
    // The axios interceptor already toasts; just refresh the views.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: secullumSmokeTestKeys.all });
    },
  });
};
