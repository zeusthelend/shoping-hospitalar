import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/dav-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = await authenticateCronRequest(request);
        if (unauthorized) return unauthorized;
        const { deliverOverdueDavPushes } = await import("@/lib/push-delivery.server");
        const result = await deliverOverdueDavPushes();
        return Response.json(result);
      },
    },
  },
});
