import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const submitTestimonial = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        message: z.string().min(1).max(1000),
        rating: z.number().int().min(1).max(5).optional(),
        pageUrl: z.string().optional(),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("testimonials").insert({
      message: data.message,
      rating: data.rating,
      page_url: data.pageUrl,
    });
    if (error) {
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const getTestimonials = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("testimonials")
    .select("id, message, rating, source, page_url, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
});
