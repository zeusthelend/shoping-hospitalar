import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const checkOverdueDavPushes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { deliverOverdueDavPushes } = await import("./push-delivery.server");
    return deliverOverdueDavPushes(context.userId);
  });
