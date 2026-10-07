import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FilePlus2, Paperclip, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { PageHeader, Empty } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type DavStatus = "aberto" | "em_andamento" | "concluido" | "cancelado";
type DavAttachment = { id: string; file_path: string; file_name: string };
const statusLabel: Record<DavStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const Route = createFileRoute("/_authenticated/davs")({
  head: () => ({
    meta: [
      { title: "DAVs — Shopping Hospitalar" },
      { name: "description", content: "Cadastro e acompanhamento de DAVs." },
      { property: "og:title", content: "DAVs — Shopping Hospitalar" },
      { property: "og:description", content: "Cadastro e acompanhamento de DAVs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DavsPage,
});

function DavsPage() {
  const [q, setQ] = useState("");
  const { data: me } = useMe();
  const userId = me?.profile?.id;
  const { data: canDeleteDavs = false } = useQuery({
    queryKey: ["can-delete-davs", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return false;
      const { data, error } = await supabase.rpc("can_delete_davs", { _user_id: userId });
      if (error) throw error;
      return data;
    },
  });
  const { data: people = [] } = useQuery({
    queryKey: ["dav-sellers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name")
        .eq("active", true)
        .eq("approved", true)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data = [] } = useQuery({
    queryKey: ["davs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("davs")
        .select("*, dav_attachments(*)")
        .order("due_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  const names = new Map(people.map((person) => [person.id, person.full_name]));
  const shown = data.filter((dav) =>
    `${dav.dav_number} ${dav.client_name} ${names.get(dav.seller_id) ?? ""}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  const overdue = data.filter(
    (dav) =>
      !["concluido", "cancelado"].includes(dav.status) && new Date(dav.due_at) < new Date(),
  ).length;

  return (
    <>
      <PageHeader
        title="DAVs"
        subtitle="Acompanhe documentos e vencimentos por vendedor."
        action={<DavDialog sellers={people} canManage={!!me?.canManage} userId={userId} />}
      />
      {overdue > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <strong>
            {overdue} DAV{overdue > 1 ? "s" : ""} vencido{overdue > 1 ? "s" : ""}
          </strong>
        </div>
      )}
      <div className="relative mb-5 max-w-lg">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Buscar DAV, cliente ou vendedor"
        />
      </div>
      {shown.length ? (
        <div className="space-y-3">
          {shown.map((dav) => {
            const isOverdue =
              !["concluido", "cancelado"].includes(dav.status) &&
              new Date(dav.due_at) < new Date();
            return (
              <article key={dav.id} className="rounded-xl border bg-card p-5 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold">
                        {dav.dav_number} · {dav.client_name}
                      </h2>
                      <Badge variant={isOverdue ? "destructive" : "secondary"}>
                        {isOverdue ? "Vencido" : statusLabel[dav.status as DavStatus]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Vendedor: {names.get(dav.seller_id) ?? "Não identificado"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <time
                      className={
                        isOverdue
                          ? "text-sm font-semibold text-destructive"
                          : "text-sm text-muted-foreground"
                      }
                    >
                      Vence em {new Date(dav.due_at).toLocaleString("pt-BR")}
                    </time>
                    {canDeleteDavs && (
                      <DeleteDavButton dav={dav} />
                    )}
                  </div>
                </div>
                {dav.description && <p className="mt-3 text-sm">{dav.description}</p>}
                {dav.dav_attachments.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {dav.dav_attachments.map((attachment) => (
                      <Attachment
                        key={attachment.id}
                        path={attachment.file_path}
                        name={attachment.file_name}
                      />
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <Empty text="Nenhum DAV encontrado." />
      )}
    </>
  );
}

function DeleteDavButton({
  dav,
}: {
  dav: { id: string; dav_number: string; dav_attachments: DavAttachment[] };
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const paths = dav.dav_attachments.map((attachment) => attachment.file_path);
      if (paths.length) {
        const { error: storageError } = await supabase.storage.from("dav-files").remove(paths);
        if (storageError) throw storageError;
      }
      const { error } = await supabase.from("davs").delete().eq("id", dav.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["davs"] });
      toast.success(`${dav.dav_number} excluído.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir o DAV.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Excluir ${dav.dav_number}`}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {dav.dav_number}?</AlertDialogTitle>
          <AlertDialogDescription>
            O DAV e os arquivos anexados serão removidos permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={() => void remove()}>
            {busy ? "Excluindo..." : "Excluir DAV"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Attachment({ path, name }: { path: string; name: string }) {
  async function open() {
    const { data, error } = await supabase.storage.from("dav-files").createSignedUrl(path, 300);
    if (error) {
      toast.error("Não foi possível abrir o arquivo.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <Button size="sm" variant="outline" onClick={open}>
      <Paperclip className="h-3.5 w-3.5" />
      {name}
    </Button>
  );
}

function DavDialog({
  sellers,
  canManage,
  userId,
}: {
  sellers: Array<{ id: string; full_name: string }>;
  canManage: boolean;
  userId: string | undefined;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    setBusy(true);
    const fd = new FormData(event.currentTarget);
    try {
      const rawNumber = String(fd.get("number")).replace(/\D/g, "");
      const number = `DAV:${rawNumber.padStart(5, "0")}`;
      const client = String(fd.get("client")).trim();
      const seller = canManage ? String(fd.get("seller")) : userId;
      const due = String(fd.get("due_at"));
      if (!rawNumber || !client || !seller || !due)
        throw new Error("Preencha número, cliente, vendedor e vencimento.");

      const { data: dav, error } = await supabase
        .from("davs")
        .insert({
          dav_number: number,
          client_name: client.slice(0, 180),
          description: String(fd.get("description")).trim().slice(0, 2000),
          seller_id: seller,
          due_at: new Date(due).toISOString(),
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw error;

      const files = fd
        .getAll("files")
        .filter((file): file is File => file instanceof File && file.size > 0);
      for (const file of files) {
        if (file.size > 20_000_000) throw new Error(`${file.name} ultrapassa 20 MB.`);
        if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type))
          throw new Error(`${file.name} não é PDF ou imagem aceita.`);
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${dav.id}/${crypto.randomUUID()}-${safe}`;
        const { error: uploadError } = await supabase.storage.from("dav-files").upload(path, file);
        if (uploadError) throw uploadError;
        const { error: attachmentError } = await supabase.from("dav_attachments").insert({
          dav_id: dav.id,
          file_path: path,
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          uploaded_by: userId,
        });
        if (attachmentError) throw attachmentError;
      }
      await qc.invalidateQueries({ queryKey: ["davs"] });
      toast.success("DAV cadastrado.");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao cadastrar DAV.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <FilePlus2 className="h-4 w-4" />
          Novo DAV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Cadastrar DAV</DialogTitle>
          <DialogDescription>Defina o vencimento e anexe PDFs ou fotos.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Número do DAV">
              <Input name="number" inputMode="numeric" required placeholder="00000" maxLength={12} />
            </Field>
            <Field label="Vencimento">
              <Input name="due_at" type="datetime-local" required />
            </Field>
          </div>
          <Field label="Cliente ou empresa">
            <Input name="client" required maxLength={180} />
          </Field>
          {canManage && (
            <Field label="Vendedor">
              <Select name="seller" required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.id} value={seller.id}>
                      {seller.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Descrição">
            <Textarea name="description" maxLength={2000} />
          </Field>
          <Field label="PDFs e fotos">
            <Input
              name="files"
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png,image/webp"
            />
          </Field>
          <Button className="w-full" disabled={busy}>
            {busy ? "Salvando..." : "Cadastrar DAV"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
