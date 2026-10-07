import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha — Shopping Hospitalar" },
      { name: "description", content: "Defina uma nova senha de acesso." },
      { property: "og:title", content: "Nova senha — Shopping Hospitalar" },
      { property: "og:description", content: "Defina uma nova senha de acesso." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada!");
    nav({ to: "/dashboard" });
  }
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <Logo className="mb-8" />
        <h1 className="text-2xl font-bold">Definir nova senha</h1>
        <div className="space-y-1.5">
          <Label htmlFor="pw">Nova senha</Label>
          <Input id="pw" type="password" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <Button className="h-11 w-full" disabled={busy}>SALVAR SENHA</Button>
      </form>
    </div>
  );
}
