import type { SupabaseClient } from "@supabase/supabase-js";

export const FREE_MONTHLY_LIMIT = 3;

export type AccessState = {
  plan: "free" | "pro";
  freeLimit: number;
  runsThisMonth: number;
  runsLeft: number;
  canRun: boolean;
  cancelAtPeriodEnd: boolean;
  periodEnd: string | null;
  pastDue: boolean;
};

function monthStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

/** Plan + quota, computed server-side with the caller's own (RLS-scoped) client. */
export async function computeAccess(
  supabase: SupabaseClient<any>,
  userId: string,
  env: "sandbox" | "live",
): Promise<AccessState> {
  const [{ count }, { data: subs }, { data: legacy }] = await Promise.all([
    supabase
      .from("investigation_runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", monthStart()),
    (supabase as any)
      .from("subscriptions")
      .select("status, current_period_end, cancel_at_period_end")
      .eq("user_id", userId)
      .eq("environment", env)
      .order("created_at", { ascending: false })
      .limit(1),
    // Earlier one-time "unlock forever" buyers keep full access.
    supabase
      .from("purchases")
      .select("id")
      .eq("user_id", userId)
      .eq("environment", env)
      .eq("status", "completed")
      .limit(1),
  ]);

  const sub = subs?.[0] as
    | { status: string; current_period_end: string | null; cancel_at_period_end: boolean | null }
    | undefined;
  const future = (t: string | null) => !t || new Date(t).getTime() > Date.now();
  const subActive =
    !!sub &&
    ((["active", "trialing", "past_due"].includes(sub.status) && future(sub.current_period_end)) ||
      (sub.status === "canceled" && !!sub.current_period_end && future(sub.current_period_end)));
  const pro = subActive || (legacy?.length ?? 0) > 0;

  const runsThisMonth = count ?? 0;
  const runsLeft = Math.max(0, FREE_MONTHLY_LIMIT - runsThisMonth);
  return {
    plan: pro ? "pro" : "free",
    freeLimit: FREE_MONTHLY_LIMIT,
    runsThisMonth,
    runsLeft,
    canRun: pro || runsLeft > 0,
    cancelAtPeriodEnd: !!sub?.cancel_at_period_end || sub?.status === "canceled",
    periodEnd: sub?.current_period_end ?? null,
    pastDue: sub?.status === "past_due",
  };
}
