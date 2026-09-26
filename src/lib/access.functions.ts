import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeAccess, type AccessState } from "./access.server";

export type { AccessState };

const envValidator = (data: unknown) => {
  const env = (data as { environment?: string })?.environment === "live" ? "live" : "sandbox";
  return { environment: env as "sandbox" | "live" };
};

export const getAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(envValidator)
  .handler(async ({ data, context }): Promise<AccessState> =>
    computeAccess(context.supabase, context.userId, data.environment),
  );
