import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const FREE_RUN_LIMIT = 3;

const envValidator = (data: unknown) => {
  const env = (data as { environment?: string })?.environment === "live" ? "live" : "sandbox";
  return { environment: env as "sandbox" | "live" };
};

export type AccessState = {
  freeLimit: number;
  runsUsed: number;
  unlocked: boolean;
  runsLeft: number;
  canRun: boolean;
};

export const getAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(envValidator)
  .handler(async ({ data, context }): Promise<AccessState> => {
    const { supabase, userId } = context;

    const [{ count }, { data: purchases }] = await Promise.all([
      supabase
        .from("investigation_runs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("purchases")
        .select("id")
        .eq("user_id", userId)
        .eq("environment", data.environment)
        .eq("status", "completed")
        .limit(1),
    ]);

    const runsUsed = count ?? 0;
    const unlocked = (purchases?.length ?? 0) > 0;
    const runsLeft = Math.max(0, FREE_RUN_LIMIT - runsUsed);

    return {
      freeLimit: FREE_RUN_LIMIT,
      runsUsed,
      unlocked,
      runsLeft,
      canRun: unlocked || runsLeft > 0,
    };
  });
