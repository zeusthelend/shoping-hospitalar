import { createFileRoute } from "@tanstack/react-router";

// Called by the database scheduler every 5 minutes with a token stored server-side.
export const Route = createFileRoute("/api/public/dav-push-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-scheduler-token") ?? "";
        if (!provided) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("scheduler_tokens")
          .select("token")
          .eq("name", "dav-push")
          .maybeSingle();
        const { createHash, timingSafeEqual } = await import("node:crypto");
        const h = (v: string) => createHash("sha256").update(v).digest();
        if (!data?.token || !timingSafeEqual(h(provided), h(data.token)))
          return new Response("Unauthorized", { status: 401 });
        const { deliverOverdueDavPushes } = await import("@/lib/push-delivery.server");
        return Response.json(await deliverOverdueDavPushes());
      },
    },
  },
});
