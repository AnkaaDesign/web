import { apiClient } from "../axiosClient";

// ============================================================================
// Types — mirror the SecullumSmokeTestRun/Check Prisma models in the API
// (apps/api/src/modules/integrations/secullum/smoke-test).
// ============================================================================

export type SecullumSmokeCheckStatus = "PASS" | "FAIL" | "SKIP";
export type SecullumSmokeRunStatus = "RUNNING" | "PASSED" | "FAILED" | "PARTIAL";
export type SecullumSmokeTrigger = "SCHEDULED" | "MANUAL";

export interface SecullumSmokeCheck {
  id: string;
  runId: string;
  checkKey: string;
  label: string;
  category: string;
  status: SecullumSmokeCheckStatus;
  errorMessage: string | null;
  durationMs: number | null;
  order: number;
  createdAt: string;
}

export interface SecullumSmokeRun {
  id: string;
  trigger: SecullumSmokeTrigger;
  status: SecullumSmokeRunStatus;
  ranAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  passCount: number;
  failCount: number;
  skipCount: number;
  triggeredById: string | null;
  createdAt: string;
  checks: SecullumSmokeCheck[];
}

interface Envelope<T> {
  success: boolean;
  data: T;
}

// ============================================================================
// HTTP helpers — routes exposed by SecullumSmokeTestController (ADMIN only)
// ============================================================================

export const secullumSmokeTestService = {
  run: (includeApuracao = false) =>
    apiClient
      .post<Envelope<SecullumSmokeRun | null>>(
        "/integrations/secullum/smoke-test/run",
        undefined,
        { params: includeApuracao ? { apuracao: "true" } : undefined },
      )
      .then((r) => r.data.data),

  listRuns: (take = 10) =>
    apiClient
      .get<Envelope<SecullumSmokeRun[]>>("/integrations/secullum/smoke-test/runs", {
        params: { take },
      })
      .then((r) => r.data.data),

  latestRun: () =>
    apiClient
      .get<Envelope<SecullumSmokeRun | null>>("/integrations/secullum/smoke-test/runs/latest")
      .then((r) => r.data.data),
};
