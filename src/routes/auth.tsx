import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Shopping Hospitalar" },
      { name: "description", content: "Acesso restrito aos colaboradores do Shopping Hospitalar." },
      { property: "og:title", content: "Entrar — Shopping Hospitalar" },
      { property: "og:description", content: "Acesso restrito aos colaboradores." },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "forgot" | "signup";

function AuthPage() {
  const nav = useNavigate();
  const { session } = useSession();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) nav({ to: "/dashboard", replace: true });
  }, [session, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Enviamos um link de recuperação para seu e-mail.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        toast.success("Cadastro criado! Confirme pelo link enviado ao seu e-mail.");
        setMode("login");
      }
    } catch (err) {
      toast.error(err instanceof Error ? translate(err.message) : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Não foi possível entrar com Google.");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand p-12 lg:flex lg:flex-col lg:justify-between">
        <Logo light className="[&_img]:h-14" />
        <div className="max-w-md">
          <div className="mb-5 h-1 w-14 rounded-full bg-highlight" />
          <h1 className="text-4xl font-bold leading-tight text-sidebar-foreground">
            Toda a equipe, conectada em um só lugar.
          </h1>
          <p className="mt-4 text-sidebar-foreground/70">
            Avisos, reuniões, documentos e colegas — o portal interno do Shopping Hospitalar.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">© {new Date().getFullYear()} Shopping Hospitalar</p>
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full border-[48px] border-sidebar-foreground/5" />
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Logo className="mb-10 lg:hidden" />
          <h2 className="text-2xl font-bold">
            {mode === "login" ? "Bem-vindo de volta" : mode === "forgot" ? "Recuperar senha" : "Primeiro acesso"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login"
              ? "Entre com seu e-mail corporativo."
              : mode === "forgot"
                ? "Informe seu e-mail para receber o link."
                : "Crie sua conta com o e-mail corporativo."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            <Button type="submit" className="h-11 w-full font-semibold" disabled={busy}>
              {mode === "login" ? "ENTRAR" : mode === "forgot" ? "ENVIAR LINK" : "CRIAR CONTA"}
            </Button>
          </form>

          {mode === "login" && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
              </div>
              <Button variant="outline" className="h-11 w-full font-semibold" onClick={google}>
                ENTRAR COM GOOGLE
              </Button>
            </>
          )}

          <div className="mt-6 flex flex-col items-center gap-2 text-sm">
            {mode === "login" ? (
              <>
                <button className="font-medium text-highlight hover:underline" onClick={() => setMode("forgot")}>
                  Esqueci minha senha
                </button>
                <button className="text-muted-foreground hover:text-foreground" onClick={() => setMode("signup")}>
                  Primeiro acesso? Criar conta
                </button>
              </>
            ) : (
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setMode("login")}>
                Voltar para o login
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function translate(m: string) {
  if (m.includes("Invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("Email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("already registered")) return "Este e-mail já está cadastrado.";
  return m;
}
