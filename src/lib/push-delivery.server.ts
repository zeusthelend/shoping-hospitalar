type PushTarget = { id: string; user_id: string; token: string };

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const DAV_ALERT_URL = "https://shopping-hospitalar.lovable.app/davs";

async function sendFirebaseMessage(target: PushTarget, title: string, body: string) {
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const connectionApiKey = process.env["FIREBASE_MESSAGING_API_KEY"];
  if (!lovableApiKey || !connectionApiKey) throw new Error("Firebase Messaging is not configured");

  const response = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "X-Connection-Api-Key": connectionApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token: target.token,
        notification: { title, body },
        data: { path: "/davs" },
        android: { priority: "HIGH", ttl: "86400s", notification: { channel_id: "dav_alerts", default_sound: true, visibility: "PUBLIC", notification_priority: "PRIORITY_MAX" } },
        apns: { headers: { "apns-priority": "10" }, payload: { aps: { sound: "default" } } },
        webpush: {
          headers: { Urgency: "high", TTL: "86400" },
          notification: { title, body, icon: "/icon-192.png", badge: "/favicon.png", requireInteraction: true, tag: `dav-${target.id}`, renotify: true, vibrate: [300, 100, 300] },
          fcm_options: { link: DAV_ALERT_URL },
        },
      },
    }),
  });
  if (response.ok) return "sent" as const;
  const errorBody = await response.text();
  if (
    (response.status === 404 && errorBody.includes("UNREGISTERED")) ||
    (response.status === 400 && errorBody.includes("INVALID_ARGUMENT"))
  ) {
    return "stale" as const;
  }
  console.error(`Firebase Messaging failed [${response.status}]: ${errorBody}`);
  return "failed" as const;
}

export async function deliverOverdueDavPushes(onlyUserId?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: davs, error: davError }, { data: managerRoles, error: roleError }] =
    await Promise.all([
      supabaseAdmin
        .from("davs")
        .select("id,dav_number,client_name,seller_id")
        .lt("due_at", new Date().toISOString())
        .not("status", "in", "(concluido,cancelado)"),
      supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "diretor", "gerente"]),
    ]);
  if (davError) throw davError;
  if (roleError) throw roleError;

  const managers = new Set((managerRoles ?? []).map((role) => role.user_id));
  let delivered = 0;
  for (const dav of davs ?? []) {
    const recipientIds = new Set([dav.seller_id, ...managers]);
    for (const userId of recipientIds) {
      if (onlyUserId && userId !== onlyUserId) continue;
      const [{ data: preference }, { data: prior }, { data: targets }] = await Promise.all([
        supabaseAdmin
          .from("notification_preferences")
          .select("dav_push_enabled")
          .eq("user_id", userId)
          .maybeSingle(),
        supabaseAdmin
          .from("dav_alert_deliveries")
          .select("id")
          .eq("dav_id", dav.id)
          .eq("user_id", userId)
          .maybeSingle(),
        supabaseAdmin.from("firebase_push_tokens").select("id,user_id,token").eq("user_id", userId),
      ]);
      if (preference?.dav_push_enabled === false || prior || !targets?.length) continue;

      let sent = false;
      for (const target of targets) {
        const result = await sendFirebaseMessage(
          target,
          `DAV vencido: ${dav.dav_number}`,
          dav.client_name,
        );
        if (result === "sent") sent = true;
        if (result === "stale")
          await supabaseAdmin.from("firebase_push_tokens").delete().eq("id", target.id);
      }
      if (sent) {
        await supabaseAdmin
          .from("dav_alert_deliveries")
          .insert({ dav_id: dav.id, user_id: userId });
        delivered += 1;
      }
    }
  }
  return { delivered };
}
