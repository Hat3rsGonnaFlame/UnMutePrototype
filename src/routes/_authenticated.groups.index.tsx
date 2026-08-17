import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/groups/")({
  head: () => ({
    meta: [
      { title: "Meine Gruppen – UnMute" },
      { name: "description", content: "Deine UnMute-Gruppen: sprechen, zuhören, Meilensteine erreichen." },
      { property: "og:title", content: "Meine Gruppen – UnMute" },
      { property: "og:description", content: "Deine UnMute-Gruppen: sprechen, zuhören, Meilensteine erreichen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GroupsPage,
});

function GroupsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(false);

  const groups = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data: memberships, error } = await supabase
        .from("group_members")
        .select("group_id, groups(id, name, topic, invite_code)")
        .order("joined_at", { ascending: false });
      if (error) throw error;
      return (memberships ?? [])
        .map((m) => m.groups)
        .filter((g): g is NonNullable<typeof g> => Boolean(g));
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Nicht angemeldet");
      const { data, error } = await supabase
        .from("groups")
        .insert({ name, topic: topic || null, created_by: user.id })
        .select("id")
        .single();
      if (error) throw error;
      const { error: memberError } = await supabase
        .from("group_members")
        .insert({ group_id: data.id, user_id: user.id });
      if (memberError) throw memberError;
      return data.id;
    },
    onSuccess: (id) => {
      setName("");
      setTopic("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["groups"] });
      navigate({ to: "/groups/$groupId", params: { groupId: id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const join = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("join_group_by_code", { _code: code });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => {
      setCode("");
      qc.invalidateQueries({ queryKey: ["groups"] });
      navigate({ to: "/groups/$groupId", params: { groupId: id } });
    },
    onError: () => toast.error("Kein Gruppen-Code gefunden"),
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Deine Gruppen</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Kleine Runden. Echte Stimmen. Kein Feed.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Neue Gruppe</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gruppe erstellen</DialogTitle>
              <DialogDescription>Lade danach Freunde mit dem Beitrittscode ein.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gname">Name</Label>
                <Input id="gname" value={name} onChange={(e) => setName(e.target.value)} placeholder="WG Küche" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gtopic">Thema (optional)</Label>
                <Input id="gtopic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Alltag & Studium" />
              </div>
              <Button className="w-full" disabled={!name || create.isPending} onClick={() => create.mutate()}>
                Gruppe erstellen
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="surface-card mt-8 flex flex-wrap items-end gap-3 p-5">
        <div className="min-w-48 flex-1 space-y-2">
          <Label htmlFor="code">Gruppe beitreten</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Code z. B. 7F3A9C"
          />
        </div>
        <Button variant="secondary" disabled={!code || join.isPending} onClick={() => join.mutate()}>
          Beitreten
        </Button>
      </div>

      <div className="mt-8 space-y-3">
        {groups.isLoading && <p className="text-sm text-muted-foreground">Lade Gruppen …</p>}
        {groups.data?.length === 0 && (
          <div className="surface-card p-8 text-center">
            <p className="font-display text-lg font-semibold">Noch keine Gruppe</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Erstelle eine Gruppe oder tritt mit einem Code bei.
            </p>
          </div>
        )}
        {groups.data?.map((g) => (
          <Link
            key={g.id}
            to="/groups/$groupId"
            params={{ groupId: g.id }}
            className="surface-card flex items-center justify-between p-5 transition-colors hover:border-primary/60"
          >
            <div>
              <p className="font-display text-lg font-semibold">{g.name}</p>
              <p className="text-sm text-muted-foreground">{g.topic ?? "Ohne Thema"}</p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 font-mono text-xs text-secondary-foreground">
              {g.invite_code}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
