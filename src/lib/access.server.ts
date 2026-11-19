import type { SupabaseClient } from "@supabase/supabase-js";

export type AccessState = {
  plan: "free";
  freeLimit: number;
  runsThisMonth: number;
  runsLeft: number;
  canRun: boolean;
  fullReport: boolean;
  cancelAtPeriodEnd: boolean;
  periodEnd: string | null;
  pastDue: boolean;
};

/**
 * Free model: every signed-in user gets unlimited runs and the complete report.
 * Payments are parked — no quotas, no subscription checks. Kept as the single
 * source of truth so a paid tier can be reintroduced here later.
 */
export async function computeAccess(
  _supabase: SupabaseClient<any>,
  _userId: string,
  _env: "sandbox" | "live",
): Promise<AccessState> {
  return {
    plan: "free",
    freeLimit: Infinity,
    runsThisMonth: 0,
    runsLeft: Infinity,
    canRun: true,
    fullReport: true,
    cancelAtPeriodEnd: false,
    periodEnd: null,
    pastDue: false,
  };
}
