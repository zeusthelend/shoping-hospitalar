import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, BellRing, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Empty } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { registerPushNotifications, type PushRegistrationResult } from "@/lib/push-notifications";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — Shopping Hospitalar" },
      { name: "description", content: "Central de alertas de DAVs e presença." },
      { property: "og:title", content: "Notificações — Shopping Hospitalar" },
      { property: "og:description", content: "Central de alertas de DAVs e presença." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [registering, setRegistering] = useState(false);
  const userId = me?.profile?.id;
  const { data: prefs } = useQuery({
    queryKey: ["notification-preferences", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: davs = [] } = useQuery({
    queryKey: ["overdue-davs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("davs")
        .select("id,dav_number,client_name,due_at,status")
        .lt("due_at", new Date().toISOString())
        .not("status", "in", "(concluido,cancelado)")
        .order("due_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  async function setPref(
    field: "dav_push_enabled" | "presence_sound_enabled",
    value: boolean,
  ) {
    if (!userId) return false;
    const result =
      field === "dav_push_enabled"
        ? await supabase
            .from("notification_preferences")
            .upsert({ user_id: userId, dav_push_enabled: value }, { onConflict: "user_id" })
        : await supabase
            .from("notification_preferences")
            .upsert({ user_id: userId, presence_sound_enabled: value }, { onConflict: "user_id" });
    if (result.error) {
      toast.error("Não foi possível salvar a preferência.");
      return false;
    }
    await qc.invalidateQueries({ queryKey: ["notification-preferences", userId] });
    return true;
  }
  function registrationMessage(status: PushRegistrationResult["status"]) {
    if (status === "open-in-new-tab")
      return "Abra o aplicativo em uma nova aba ou use a versão publicada para permitir notificações.";
    if (status === "denied")
      return "Permita notificações nas configurações deste site e tente novamente.";
    if (status === "not-configured")
      return "Atualize a conexão do Firebase com a opção de web push.";
    return "Este aparelho não oferece notificações push.";
  }
  async function enableNotifications() {
    if (!userId || registering) return;
    setRegistering(true);
    try {
      const result = await registerPushNotifications(userId);
      if (result.status === "registered") {
        if (await setPref("dav_push_enabled", true))
          toast.success("Alertas push ativados neste aparelho.");
      } else toast.error(registrationMessage(result.status));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Não foi possível ativar os alertas: ${error.message}`
          : "Não foi possível ativar os alertas neste aparelho.",
      );
    } finally {
      setRegistering(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Notificações"
        subtitle="Alertas de vencimento e atividade da equipe."
        action={
          <Button onClick={enableNotifications} disabled={registering}>
            <BellRing className="h-4 w-4" />
            {registering ? "Ativando…" : "Ativar no celular"}
          </Button>
        }
      />
      <section className="mb-6 grid gap-3 sm:grid-cols-2">
        <Preference
          icon={Bell}
          label="Alertas de DAV vencido"
          checked={prefs?.dav_push_enabled ?? true}
          onChange={(v) => setPref("dav_push_enabled", v)}
        />
        <Preference
          icon={Volume2}
          label="Som quando alguém ficar online"
          checked={prefs?.presence_sound_enabled ?? true}
          onChange={(v) => setPref("presence_sound_enabled", v)}
        />
      </section>
      <h2 className="mb-3 font-bold">DAVs vencidos</h2>
      {davs.length ? (
        <div className="space-y-3">
          {davs.map((d) => (
            <Link
              key={d.id}
              to="/davs"
              className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-card p-4 shadow-card"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <strong>
                  {d.dav_number} · {d.client_name}
                </strong>
                <p className="text-sm text-muted-foreground">
                  Venceu em {new Date(d.due_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Empty text="Nenhum DAV vencido." />
      )}
    </>
  );
}
function Preference({
  icon: Icon,
  label,
  checked,
  onChange,
}: {
  icon: typeof Bell;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-card">
      <Icon className="h-5 w-5 text-highlight" />
      <Label className="flex-1">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
