import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, FileText, Megaphone, MessageSquare, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { Empty, livePresence, PageHeader } from "@/components/brand";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "Início — Shopping Hospitalar" },
    { name: "description", content: "Resumo do portal corporativo Shopping Hospitalar." },
    { property: "og:title", content: "Início — Shopping Hospitalar" },
    { property: "og:description", content: "Resumo do portal corporativo Shopping Hospitalar." },
  ]}),
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useMe();
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: async () => {
    const [p, a, m, d, posts, davs] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,status,last_seen_at")
        .eq("active", true)
        .eq("approved", true),
      supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(3),
      supabase.from("meetings").select("*").gte("starts_at", new Date().toISOString()).order("starts_at").limit(3),
      supabase.from("documents").select("*").order("created_at", { ascending: false }).limit(3),
      supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(3),
      supabase.from("davs").select("id,dav_number,client_name,due_at,status").lt("due_at",new Date().toISOString()).not("status","in",'(concluido,cancelado)').order("due_at"),
    ]);
    const online = p.data?.filter((profile) => livePresence(profile) === "online").length ?? 0;
    return { online, announcements: a.data ?? [], meetings: m.data ?? [], documents: d.data ?? [], posts: posts.data ?? [], overdueDavs:davs.data??[] };
  }, refetchInterval:30_000});
  const first = me?.profile?.full_name?.split(" ")[0] || "colaborador";
  const cards = [
    ["Funcionários online", data?.online ?? 0, Users, "text-success bg-success/10"],
    ["Novas mensagens", 0, MessageSquare, "text-primary bg-primary/10"],
    ["Próximas reuniões", data?.meetings.length ?? 0, CalendarDays, "text-warning bg-warning/10"],
    ["Novos documentos", data?.documents.length ?? 0, FileText, "text-highlight bg-highlight/10"],
  ] as const;
  return <>
    <PageHeader title={`Olá, ${first}`} subtitle="Aqui está o que está acontecendo hoje." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value,Icon,style]) => <div key={label} className="rounded-xl border bg-card p-5 shadow-card"><div className={`mb-4 grid h-10 w-10 place-items-center rounded-lg ${style}`}><Icon className="h-5 w-5" /></div><div className="text-3xl font-bold">{value}</div><div className="mt-1 text-sm text-muted-foreground">{label}</div></div>)}</div>
    {!!data?.overdueDavs.length&&<div className="mt-5 flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive"><AlertTriangle className="h-5 w-5"/><strong>{data.overdueDavs.length} DAV{data.overdueDavs.length>1?'s':''} vencido{data.overdueDavs.length>1?'s':''}</strong></div>}
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <Section title="Avisos importantes" icon={Megaphone}>{data?.announcements.length ? data.announcements.map(x => <Item key={x.id} title={x.title} body={x.body} date={x.created_at} important={x.important} />) : <Empty text="Nenhum aviso publicado." />}</Section>
      <Section title="Reuniões próximas" icon={CalendarDays}>{data?.meetings.length ? data.meetings.map(x => <Item key={x.id} title={x.title} body={x.location || "Online"} date={x.starts_at} />) : <Empty text="Nenhuma reunião agendada." />}</Section>
      <Section title="Documentos recentes" icon={FileText}>{data?.documents.length ? data.documents.map(x => <Item key={x.id} title={x.title} body={x.category || "Documento"} date={x.created_at} />) : <Empty text="Nenhum documento recente." />}</Section>
      <Section title="Publicações recentes" icon={MessageSquare}>{data?.posts.length ? data.posts.map(x => <Item key={x.id} title={x.title} body={x.body} date={x.created_at} />) : <Empty text="Nenhuma publicação recente." />}</Section>
    </div>
  </>;
}

function Section({ title, icon: Icon, children }: { title:string; icon: typeof Users; children: React.ReactNode }) { return <section className="rounded-xl border bg-card p-5 shadow-card"><h2 className="mb-4 flex items-center gap-2 text-base font-bold"><Icon className="h-5 w-5 text-highlight" />{title}</h2><div className="space-y-2">{children}</div></section> }
function Item({title,body,date,important}:{title:string;body:string;date:string;important?:boolean}) { return <div className="flex gap-3 rounded-lg bg-muted/60 p-3"><div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${important ? "bg-highlight" : "bg-primary"}`} /><div className="min-w-0"><div className="truncate text-sm font-semibold">{title}</div><div className="line-clamp-1 text-xs text-muted-foreground">{body}</div><div className="mt-1 text-[11px] text-muted-foreground">{new Date(date).toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" })}</div></div></div> }