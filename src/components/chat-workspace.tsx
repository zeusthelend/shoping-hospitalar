import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Copy,
  FileText,
  Image,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Pencil,
  Plus,
  Reply,
  Search,
  Send,
  Smile,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { initials, livePresence } from "@/components/brand";

type ProfileLite = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  status: string;
  last_seen_at?: string | null;
};
type ConversationRow = {
  conversation_id: string;
  is_admin: boolean;
  muted: boolean;
  pinned: boolean;
  last_read_at: string;
  chat_conversations: {
    id: string;
    name: string | null;
    kind: string;
    image_url: string | null;
    updated_at: string;
    created_by: string;
  } | null;
};
type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  reply_to_id: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  profiles: ProfileLite | null;
  chat_reactions: Array<{ emoji: string; user_id: string }>;
};
const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export function ChatWorkspace({ conversationId }: { conversationId?: string | undefined }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"conversations" | "contacts">("conversations");

  const {
    data: profiles = [],
    isError: profilesError,
    refetch: refetchProfiles,
  } = useQuery({
    queryKey: ["chat-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,avatar_url,status,last_seen_at")
        .eq("active", true)
        .eq("approved", true)
        .order("full_name");
      if (error) throw error;
      return data as ProfileLite[];
    },
    refetchInterval: 30_000,
  });

  const {
    data: memberships = [],
    isError: membershipsError,
    isLoading: membershipsLoading,
    isFetching: membershipsFetching,
    refetch: refetchMemberships,
  } = useQuery({
    queryKey: ["chat-conversations", me?.profile?.id],
    enabled: !!me?.profile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_participants")
        .select(
          "conversation_id,is_admin,muted,pinned,last_read_at,chat_conversations(id,name,kind,image_url,updated_at,created_by)",
        )
        .eq("user_id", me?.profile?.id ?? "")
        .order("pinned", { ascending: false });
      if (error) throw error;
      return data as ConversationRow[];
    },
    refetchInterval: 15_000,
  });

  // Dedicated query when opening a specific conversation so it doesn't wait for the full list
  const { data: directConversation, isLoading: directLoading } = useQuery({
    queryKey: ["chat-conversation-single", conversationId, me?.profile?.id],
    enabled: !!conversationId && !!me?.profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_participants")
        .select(
          "conversation_id,is_admin,muted,pinned,last_read_at,chat_conversations(id,name,kind,image_url,updated_at,created_by)",
        )
        .eq("conversation_id", conversationId!)
        .eq("user_id", me?.profile?.id ?? "")
        .maybeSingle();
      if (error) throw error;
      return data as ConversationRow | null;
    },
  });

  const conversationIds = memberships.map((x) => x.conversation_id);
  const { data: allParticipants = [] } = useQuery({
    queryKey: ["chat-participants", conversationIds.join(",")],
    enabled: conversationIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_participants")
        .select(
          "conversation_id,user_id,is_admin,profiles(id,full_name,avatar_url,status,last_seen_at)",
        )
        .in("conversation_id", conversationIds);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  const { data: singleParticipants = [] } = useQuery({
    queryKey: ["chat-participants-single", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_participants")
        .select(
          "conversation_id,user_id,is_admin,profiles(id,full_name,avatar_url,status,last_seen_at)",
        )
        .eq("conversation_id", conversationId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const otherProfiles = profiles.filter((p) => p.id !== me?.profile?.id);
  const filteredContacts = otherProfiles.filter((p) =>
    p.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  const filtered = memberships.filter((m) =>
    conversationTitle(m, allParticipants, me?.profile?.id)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  useEffect(() => {
    const channel = supabase
      .channel("chat-list-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_conversations" },
        () => void qc.invalidateQueries({ queryKey: ["chat-conversations"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_participants" }, () => {
        void qc.invalidateQueries({ queryKey: ["chat-conversations"] });
        void qc.invalidateQueries({ queryKey: ["chat-participants"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const active =
    memberships.find((x) => x.conversation_id === conversationId) ?? directConversation;

  const currentParticipants =
    allParticipants.filter((p) => p.conversation_id === conversationId).length > 0
      ? allParticipants.filter((p) => p.conversation_id === conversationId)
      : singleParticipants;

  async function handleStartDirect(peerId: string) {
    await openOrCreateDirectChat({ peerId, qc, navigate });
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-card lg:grid lg:h-[calc(100vh-7.5rem)] lg:grid-cols-[330px_minmax(0,1fr)]">
      <aside className={cn("flex flex-col border-r bg-card", conversationId && "hidden lg:flex")}>
        <div className="flex h-16 items-center justify-between border-b px-4">
          <div>
            <h1 className="text-lg font-bold">Chat</h1>
            <p className="text-xs text-muted-foreground">
              {tab === "conversations"
                ? `${memberships.length} conversa${memberships.length === 1 ? "" : "s"}`
                : `${otherProfiles.length} contato${otherProfiles.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <NewConversationDialog
            profiles={otherProfiles}
            userId={me?.profile?.id}
            trigger={
              <Button size="sm" className="gap-1.5 shadow-sm">
                <Plus className="h-4 w-4" />
                <span>Nova conversa</span>
              </Button>
            }
          />
        </div>

        {/* Abas Alternáveis: Conversas vs Contatos */}
        <div className="grid grid-cols-2 border-b bg-muted/20 text-center text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab("conversations")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2.5 transition-colors border-b-2",
              tab === "conversations"
                ? "border-primary text-primary bg-background shadow-xs"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Conversas ({memberships.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("contacts")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2.5 transition-colors border-b-2",
              tab === "contacts"
                ? "border-primary text-primary bg-background shadow-xs"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Users className="h-3.5 w-3.5" />
            Contatos ({otherProfiles.length})
          </button>
        </div>

        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9"
              placeholder={tab === "conversations" ? "Buscar conversa..." : "Buscar colega..."}
            />
          </div>
        </div>

        <ScrollArea className="flex-1 h-[calc(100vh-17.5rem)] lg:h-[calc(100vh-17.5rem)]">
          <div className="space-y-1 px-2 pb-3">
            {tab === "contacts" ? (
              profilesError ? (
                <div className="space-y-3 px-4 py-8 text-center text-sm">
                  <p className="text-destructive">Não foi possível carregar os colaboradores.</p>
                  <Button variant="outline" size="sm" onClick={() => void refetchProfiles()}>
                    Tentar novamente
                  </Button>
                </div>
              ) : filteredContacts.length ? (
                filteredContacts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void handleStartDirect(p.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg p-2.5 text-left hover:bg-muted transition-colors border border-transparent hover:border-border"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={p.avatar_url ?? undefined} />
                          <AvatarFallback>{initials(p.full_name)}</AvatarFallback>
                        </Avatar>
                        <span
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card",
                            livePresence(p) === "online" ? "bg-success" : "bg-muted-foreground/30",
                          )}
                        />
                      </div>
                      <div className="min-w-0">
                        <strong className="block truncate text-sm font-semibold">{p.full_name}</strong>
                        <p className="truncate text-xs text-muted-foreground">
                          {livePresence(p) === "online" ? "Online" : "Offline"}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-colors">
                      Conversar 💬
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Nenhum contato encontrado.
                </div>
              )
            ) : membershipsError ? (
              <div className="space-y-3 px-4 py-8 text-center text-sm">
                <p className="text-destructive">Não foi possível carregar suas conversas.</p>
                <Button variant="outline" size="sm" onClick={() => void refetchMemberships()}>
                  Tentar novamente
                </Button>
              </div>
            ) : filtered.length ? (
              filtered.map((m) => {
                const title = conversationTitle(m, allParticipants, me?.profile?.id);
                const peer = conversationPeer(m, allParticipants, me?.profile?.id);
                return (
                  <Link
                    key={m.conversation_id}
                    to="/chat/$conversationId"
                    params={{ conversationId: m.conversation_id }}
                    className="flex items-center gap-3 rounded-lg p-3 hover:bg-muted transition-colors"
                    activeProps={{ className: "!bg-primary/10" }}
                  >
                    <ConversationAvatar
                      conversation={m.chat_conversations}
                      title={title}
                      peer={peer}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <strong className="truncate text-sm">{title}</strong>
                        {m.pinned && <span className="text-xs text-highlight">●</span>}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.chat_conversations?.kind === "group"
                          ? "Grupo corporativo"
                          : livePresence(peer) === "online"
                            ? "Online"
                            : "Offline"}
                      </p>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground space-y-3">
                <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p>Nenhuma conversa iniciada ainda.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setTab("contacts")}
                >
                  <Users className="h-4 w-4" />
                  Ver contatos disponíveis
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </aside>

      <main className={cn("min-w-0 bg-card", !conversationId && "hidden lg:flex lg:items-center lg:justify-center")}>
        {conversationId && active && me?.profile ? (
          <Conversation
            conversation={active}
            title={conversationTitle(active, currentParticipants, me.profile.id)}
            participants={currentParticipants}
            me={me.profile}
          />
        ) : conversationId && (directLoading || membershipsLoading || membershipsFetching) && !active ? (
          <div className="grid h-full place-items-center p-8 text-center text-sm text-muted-foreground">
            <div className="flex flex-col items-center gap-3">
              <MessageCircle className="h-10 w-10 animate-pulse text-primary" />
              <p>Carregando conversa...</p>
            </div>
          </div>
        ) : conversationId && membershipsError ? (
          <div className="grid h-full place-items-center p-8 text-center">
            <div>
              <MessageCircle className="mx-auto h-10 w-10 text-destructive" />
              <p className="mt-3 text-sm text-destructive">Não foi possível verificar o acesso.</p>
              <Button className="mt-4" variant="outline" onClick={() => void refetchMemberships()}>
                Tentar novamente
              </Button>
            </div>
          </div>
        ) : conversationId ? (
          <div className="grid h-full place-items-center p-8 text-center">
            <div>
              <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Conversa não encontrada ou sem acesso.
              </p>
              <Button className="mt-4" variant="outline" onClick={() => navigate({ to: "/chat" })}>
                Voltar
              </Button>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-lg p-6 sm:p-10 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-highlight/10 text-highlight">
              <MessageCircle className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold">Mensagens Corporativas</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Comunique-se diretamente com qualquer colega ou crie grupos para seus projetos e setores.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <NewConversationDialog
                profiles={otherProfiles}
                userId={me?.profile?.id}
                defaultType="direct"
                trigger={
                  <Button className="w-full gap-2 py-6 text-sm font-semibold shadow-sm">
                    <MessageCircle className="h-5 w-5" />
                    <span>Conversar com colega</span>
                  </Button>
                }
              />
              <NewConversationDialog
                profiles={otherProfiles}
                userId={me?.profile?.id}
                defaultType="group"
                trigger={
                  <Button variant="outline" className="w-full gap-2 py-6 text-sm font-semibold">
                    <Users className="h-5 w-5" />
                    <span>Criar novo grupo</span>
                  </Button>
                }
              />
            </div>
            {otherProfiles.length > 0 && (
              <div className="mt-8 text-left rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Contatos rápidos:
                  </h3>
                  <button
                    type="button"
                    onClick={() => setTab("contacts")}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Ver todos ({otherProfiles.length})
                  </button>
                </div>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {otherProfiles.slice(0, 5).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-lg p-2 hover:bg-muted/60 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={p.avatar_url ?? undefined} />
                          <AvatarFallback>{initials(p.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{p.full_name}</p>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                livePresence(p) === "online" ? "bg-success" : "bg-muted-foreground/40",
                              )}
                            />
                            {livePresence(p) === "online" ? "Online" : "Offline"}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-xs text-primary hover:bg-primary/10"
                        onClick={() => void handleStartDirect(p.id)}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Conversar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Conversation({
  conversation,
  title,
  participants,
  me,
}: {
  conversation: ConversationRow;
  title: string;
  participants: Array<{
    conversation_id: string;
    user_id: string;
    is_admin: boolean;
    profiles: ProfileLite | null;
  }>;
  me: ProfileLite;
}) {
  const id = conversation.conversation_id;
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [reply, setReply] = useState<MessageRow | null>(null);
  const [editing, setEditing] = useState<MessageRow | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const {
    data: messages = [],
    isError: messagesError,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ["chat-messages", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select(
          "*, profiles!chat_messages_sender_id_fkey(id,full_name,avatar_url,status,last_seen_at), chat_reactions(emoji,user_id)",
        )
        .eq("conversation_id", id)
        .order("created_at");
      if (error) throw error;
      return data as MessageRow[];
    },
    refetchInterval: 10_000,
  });
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${id}`,
        },
        () => void qc.invalidateQueries({ queryKey: ["chat-messages", id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_reactions" },
        () => void qc.invalidateQueries({ queryKey: ["chat-messages", id] }),
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          void qc.invalidateQueries({ queryKey: ["chat-messages", id] });
          void qc.invalidateQueries({ queryKey: ["chat-conversations", me.id] });
        }
      });
    void supabase
      .from("chat_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", id)
      .eq("user_id", me.id)
      .then(({ error }) => {
        if (error) console.error("Unable to mark chat conversation read", error);
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, me.id, qc]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);
  async function send() {
    if (sending || (!text.trim() && !file)) return;
    setSending(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("chat_messages")
          .update({ body: text.trim(), edited_at: new Date().toISOString() })
          .eq("id", editing.id);
        if (error) throw error;
        setEditing(null);
      } else {
        let attachment: {
          attachment_path?: string;
          attachment_name?: string;
          attachment_type?: string;
          attachment_size?: number;
        } = {};
        if (file) {
          if (file.size > 20_000_000) throw new Error("O arquivo ultrapassa 20 MB.");
          const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${id}/${crypto.randomUUID()}-${safe}`;
          const { error } = await supabase.storage.from("chat-files").upload(path, file);
          if (error) throw error;
          attachment = {
            attachment_path: path,
            attachment_name: file.name,
            attachment_type: file.type || "application/octet-stream",
            attachment_size: file.size,
          };
        }
        const { data: inserted, error } = await supabase
          .from("chat_messages")
          .insert({
            conversation_id: id,
            sender_id: me.id,
            body: text.trim(),
            reply_to_id: reply?.id ?? null,
            ...attachment,
          })
          .select("id")
          .single();
        if (error) throw error;
        if (!inserted?.id) throw new Error("O servidor não confirmou o envio da mensagem.");
      }
      setText("");
      setFile(null);
      setReply(null);
      await qc.invalidateQueries({ queryKey: ["chat-messages", id] });
      inputRef.current?.focus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  }
  function startEdit(message: MessageRow) {
    setEditing(message);
    setReply(null);
    setText(message.body);
    inputRef.current?.focus();
  }
  return (
    <div className="flex h-[calc(100vh-7.5rem)] min-h-[520px] flex-col">
      <header className="flex h-16 items-center gap-3 border-b px-3 sm:px-5">
        <Button asChild variant="ghost" size="icon" className="lg:hidden">
          <Link to="/chat">
            <ArrowLeft />
          </Link>
        </Button>
        <Avatar className="h-9 w-9">
          <AvatarFallback>{initials(title)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-bold">{title}</h2>
          <p className="text-xs text-muted-foreground">
            {conversation.chat_conversations?.kind === "group"
              ? `${participants.length} participantes`
              : livePresence(participants.find((p) => p.user_id !== me.id)?.profiles) === "online"
                ? "Online"
                : "Offline"}
          </p>
        </div>
      </header>
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
          {messagesError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <p className="text-destructive">Não foi possível carregar as mensagens.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => void refetchMessages()}
              >
                Tentar novamente
              </Button>
            </div>
          ) : (
            messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                mine={message.sender_id === me.id}
                all={messages}
                onReply={() => {
                  setReply(message);
                  setEditing(null);
                  inputRef.current?.focus();
                }}
                onEdit={() => startEdit(message)}
                onChanged={() => void qc.invalidateQueries({ queryKey: ["chat-messages", id] })}
                userId={me.id}
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      {(reply || editing) && (
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 border-t bg-muted/50 px-4 py-2 text-xs">
          <div className="min-w-0 flex-1 border-l-2 border-highlight pl-3">
            <strong>
              {editing
                ? "Editando mensagem"
                : `Respondendo a ${reply?.profiles?.full_name ?? "mensagem"}`}
            </strong>
            <p className="truncate text-muted-foreground">{editing ? editing.body : reply?.body}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setReply(null);
              setEditing(null);
              setText("");
            }}
            aria-label="Cancelar"
          >
            ×
          </Button>
        </div>
      )}
      {file && (
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 border-t px-4 py-2 text-xs">
          <Paperclip className="h-4 w-4" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setFile(null)}
            aria-label="Remover arquivo"
          >
            ×
          </Button>
        </div>
      )}
      <div className="border-t p-3 sm:p-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <label
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-md hover:bg-muted"
            aria-label="Anexar arquivo"
          >
            <Paperclip className="h-4 w-4" />
            <input
              className="sr-only"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Textarea
            ref={inputRef}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            className="max-h-36 min-h-10 resize-none"
            placeholder="Escreva uma mensagem"
          />
          <Button
            size="icon"
            disabled={sending || (!text.trim() && !file)}
            onClick={() => void send()}
            aria-label="Enviar"
          >
            <Send />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageItem({
  message,
  mine,
  all,
  onReply,
  onEdit,
  onChanged,
  userId,
}: {
  message: MessageRow;
  mine: boolean;
  all: MessageRow[];
  onReply: () => void;
  onEdit: () => void;
  onChanged: () => void;
  userId: string;
}) {
  const reply = all.find((x) => x.id === message.reply_to_id);
  const grouped = Object.entries(
    message.chat_reactions.reduce<Record<string, string[]>>((acc, r) => {
      (acc[r.emoji] ??= []).push(r.user_id);
      return acc;
    }, {}),
  );
  async function react(emoji: string) {
    const mineReaction = message.chat_reactions.some(
      (r) => r.user_id === userId && r.emoji === emoji,
    );
    const query = supabase.from("chat_reactions");
    const { error } = mineReaction
      ? await query.delete().eq("message_id", message.id).eq("user_id", userId).eq("emoji", emoji)
      : await query.insert({ message_id: message.id, user_id: userId, emoji });
    if (error) toast.error("Não foi possível registrar a reação.");
    else onChanged();
  }
  async function remove() {
    const { error } = await supabase
      .from("chat_messages")
      .update({
        body: "Mensagem excluída",
        deleted_at: new Date().toISOString(),
        attachment_path: null,
        attachment_name: null,
        attachment_type: null,
        attachment_size: null,
      })
      .eq("id", message.id);
    if (error) toast.error("Não foi possível excluir a mensagem.");
    else onChanged();
  }
  return (
    <div className={cn("flex gap-2", mine && "justify-end")}>
      <div className={cn("max-w-[85%] sm:max-w-[72%]", mine && "items-end")}>
        <div
          className={cn(
            "group relative rounded-lg px-3 py-2",
            mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
          )}
        >
          <div className="mb-1 flex items-center gap-2 text-[11px] opacity-70">
            <strong>{mine ? "Você" : (message.profiles?.full_name ?? "Colaborador")}</strong>
            <time>
              {new Date(message.created_at).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </div>
          {reply && (
            <div
              className={cn(
                "mb-2 border-l-2 pl-2 text-xs",
                mine ? "border-primary-foreground/50" : "border-highlight",
              )}
            >
              <strong>{reply.profiles?.full_name}</strong>
              <p className="truncate opacity-80">{reply.body}</p>
            </div>
          )}
          <p
            className={cn(
              "whitespace-pre-wrap break-words text-sm",
              message.deleted_at && "italic opacity-70",
            )}
          >
            {message.body}
          </p>
          {message.attachment_path && <Attachment message={message} />}
          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-65">
            {message.edited_at && <span>editada</span>}
            {mine &&
              (message.deleted_at ? (
                <Check className="h-3 w-3" />
              ) : (
                <CheckCheck className="h-3 w-3" />
              ))}
          </div>
          {!message.deleted_at && (
            <div
              className={cn(
                "absolute -top-3 hidden items-center rounded-md border bg-popover p-0.5 text-popover-foreground shadow-sm group-hover:flex",
                mine ? "right-2" : "left-2",
              )}
            >
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7">
                    <Smile />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="flex w-auto gap-1 p-2">
                  {REACTIONS.map((e) => (
                    <Button
                      key={e}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-base"
                      onClick={() => void react(e)}
                    >
                      {e}
                    </Button>
                  ))}
                </PopoverContent>
              </Popover>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onReply}>
                <Reply />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7">
                    <MoreVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={mine ? "end" : "start"}>
                  <DropdownMenuItem
                    onClick={() => void navigator.clipboard.writeText(message.body)}
                  >
                    <Copy />
                    Copiar
                  </DropdownMenuItem>
                  {mine && (
                    <DropdownMenuItem onClick={onEdit}>
                      <Pencil />
                      Editar
                    </DropdownMenuItem>
                  )}
                  {mine && (
                    <DropdownMenuItem className="text-destructive" onClick={() => void remove()}>
                      <Trash2 />
                      Excluir
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        {grouped.length > 0 && (
          <div className={cn("mt-1 flex flex-wrap gap-1", mine && "justify-end")}>
            {grouped.map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => void react(emoji)}
                className={cn(
                  "rounded-full border bg-card px-2 py-0.5 text-xs",
                  users.includes(userId) && "border-highlight bg-highlight/10",
                )}
              >
                {emoji} {users.length}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Attachment({ message }: { message: MessageRow }) {
  async function open() {
    if (!message.attachment_path) return;
    const { data, error } = await supabase.storage
      .from("chat-files")
      .createSignedUrl(message.attachment_path, 300);
    if (error) {
      toast.error("Não foi possível abrir o arquivo.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }
  const isImage = message.attachment_type?.startsWith("image/");
  return (
    <button
      onClick={() => void open()}
      className="mt-2 flex max-w-full items-center gap-2 rounded-md border border-current/20 p-2 text-left text-xs"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-background/20">
        {isImage ? <Image className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
      </span>
      <span className="truncate">{message.attachment_name}</span>
    </button>
  );
}

export async function openOrCreateDirectChat({
  peerId,
  qc,
  navigate,
}: {
  peerId: string;
  qc: ReturnType<typeof useQueryClient>;
  navigate: (opts: { to: string; params: { conversationId: string } }) => void;
}) {
  try {
    const { data: conversationId, error } = await supabase.rpc("create_chat_conversation", {
      _kind: "direct",
      _name: "",
      _members: [peerId],
    });
    if (error) throw error;
    if (typeof conversationId !== "string" || !conversationId) {
      throw new Error("Não foi possível iniciar a conversa.");
    }
    await qc.invalidateQueries({ queryKey: ["chat-conversations"] });
    await qc.invalidateQueries({ queryKey: ["chat-participants"] });
    navigate({ to: "/chat/$conversationId", params: { conversationId } });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Não foi possível abrir o chat.");
  }
}

export function NewConversationDialog({
  profiles,
  userId,
  trigger,
  defaultType = "direct",
}: {
  profiles: ProfileLite[];
  userId: string | undefined;
  trigger?: React.ReactNode;
  defaultType?: "direct" | "group";
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"direct" | "group">(defaultType);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setType(defaultType);
      setSelected([]);
      setName("");
      setSearch("");
    }
  }, [open, defaultType]);

  const visible = profiles.filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase()));

  function toggleGroupMember(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  async function createConversation(kind: "direct" | "group", members: string[]) {
    if (!userId || !members.length || (kind === "group" && !name.trim())) return;
    setBusy(true);
    try {
      const { data: conversationId, error } = await supabase.rpc("create_chat_conversation", {
        _kind: kind,
        _name: kind === "group" ? name.trim() : "",
        _members: members,
      });
      if (error) throw error;
      if (typeof conversationId !== "string" || !conversationId)
        throw new Error("O servidor não confirmou a criação da conversa.");
      await qc.invalidateQueries({ queryKey: ["chat-conversations"] });
      await qc.invalidateQueries({ queryKey: ["chat-participants"] });
      setOpen(false);
      setSelected([]);
      setName("");
      nav({ to: "/chat/$conversationId", params: { conversationId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a conversa.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button size="icon" aria-label="Nova conversa">
            <Plus />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {type === "direct" ? "Iniciar conversa individual" : "Criar grupo corporativo"}
          </DialogTitle>
          <DialogDescription>
            {type === "direct"
              ? "Selecione um colega abaixo para abrir o chat imediatamente."
              : "Defina o nome do grupo e selecione os participantes."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={type === "direct" ? "default" : "outline"}
            onClick={() => {
              setType("direct");
              setSelected([]);
            }}
            className="gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            Individual (1 a 1)
          </Button>
          <Button
            type="button"
            variant={type === "group" ? "default" : "outline"}
            onClick={() => {
              setType("group");
              setSelected([]);
            }}
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            Grupo corporativo
          </Button>
        </div>
        {type === "group" && (
          <div className="space-y-1.5">
            <Label htmlFor="group-name-input">Nome do grupo *</Label>
            <Input
              id="group-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Ex.: Equipe de Vendas, Enfermagem Geral"
            />
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar colaborador..."
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            {type === "direct"
              ? "Clique no colaborador para conversar:"
              : `Selecione os membros (${selected.length} selecionado${selected.length === 1 ? "" : "s"}):`}
          </p>
          <ScrollArea className="h-64 rounded-md border p-2">
            <div className="space-y-1 pr-2">
              {visible.length ? (
                visible.map((p) => {
                  const isSelected = selected.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        type === "direct"
                          ? void createConversation("direct", [p.id])
                          : toggleGroupMember(p.id)
                      }
                      disabled={busy}
                      aria-label={
                        type === "direct"
                          ? `Conversar com ${p.full_name}`
                          : `Selecionar ${p.full_name}`
                      }
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-lg p-2 text-left transition-colors",
                        type === "group" && isSelected
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted",
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {type === "group" ? (
                          <Checkbox checked={isSelected} />
                        ) : (
                          <MessageCircle className="h-4 w-4 shrink-0 text-primary" />
                        )}
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={p.avatar_url ?? undefined} />
                          <AvatarFallback>{initials(p.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-medium">{p.full_name}</span>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                livePresence(p) === "online"
                                  ? "bg-success"
                                  : "bg-muted-foreground/30",
                              )}
                            />
                            {livePresence(p) === "online" ? "Online" : "Offline"}
                          </span>
                        </div>
                      </div>
                      {type === "direct" && (
                        <span className="shrink-0 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Conversar 💬
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  Nenhum colaborador encontrado.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        {type === "direct" && busy ? (
          <p role="status" className="text-center text-sm font-medium text-primary animate-pulse">
            Abrindo conversa...
          </p>
        ) : type === "group" ? (
          <Button
            type="button"
            className="w-full gap-2 font-semibold"
            onClick={() => void createConversation("group", selected)}
            disabled={busy || !selected.length || !name.trim()}
          >
            <Users className="h-4 w-4" />
            {busy
              ? "Criando grupo..."
              : `Criar grupo com ${selected.length} participante(s)`}
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function conversationTitle(
  m: ConversationRow,
  participants: Array<{ conversation_id: string; user_id: string; profiles: ProfileLite | null }>,
  userId?: string,
) {
  if (m.chat_conversations?.kind === "group") return m.chat_conversations.name ?? "Grupo";
  return (
    participants.find((p) => p.conversation_id === m.conversation_id && p.user_id !== userId)
      ?.profiles?.full_name ?? "Conversa"
  );
}
function conversationPeer(
  m: ConversationRow,
  participants: Array<{ conversation_id: string; user_id: string; profiles: ProfileLite | null }>,
  userId?: string,
) {
  return (
    participants.find((p) => p.conversation_id === m.conversation_id && p.user_id !== userId)
      ?.profiles ?? null
  );
}
function ConversationAvatar({
  conversation,
  title,
  peer,
}: {
  conversation: ConversationRow["chat_conversations"];
  title: string;
  peer: ProfileLite | null;
}) {
  return (
    <div className="relative">
      <Avatar className="h-10 w-10">
        <AvatarImage
          src={
            conversation?.kind === "group"
              ? (conversation.image_url ?? undefined)
              : (peer?.avatar_url ?? undefined)
          }
        />
        <AvatarFallback>
          {conversation?.kind === "group" ? <Users className="h-4 w-4" /> : initials(title)}
        </AvatarFallback>
      </Avatar>
      {conversation?.kind !== "group" && (
        <span
          className={cn(
            "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card",
            livePresence(peer) === "online" ? "bg-success" : "bg-muted-foreground/40",
          )}
        />
      )}
    </div>
  );
}
