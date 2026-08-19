import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/prompts")({
  head: () => ({
    meta: [
      { title: "Fragen-Sets verwalten – UnMute" },
      {
        name: "description",
        content: "Fragen-Sets anlegen, Impulse bearbeiten und Reihenfolge festlegen.",
      },
      { property: "og:title", content: "Fragen-Sets verwalten – UnMute" },
      {
        property: "og:description",
        content: "Fragen-Sets anlegen, Impulse bearbeiten und Reihenfolge festlegen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPromptsPage,
});

type PromptSet = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  emoji: string | null;
  sort_order: number;
  is_active: boolean;
};

type Prompt = {
  id: string;
  question: string;
  position: number;
  is_active: boolean;
  set_id: string | null;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function AdminPromptsPage() {
  const { isAdmin, loading } = useIsAdmin();
  const qc = useQueryClient();
  const [activeSet, setActiveSet] = useState<string | null>(null);
  const [newSetName, setNewSetName] = useState("");
  const [newSetEmoji, setNewSetEmoji] = useState("");
  const [newSetDescription, setNewSetDescription] = useState("");
  const [setOpen, setSetOpen] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");

  const sets = useQuery({
    queryKey: ["prompt-sets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prompt_sets")
        .select("id, slug, name, description, emoji, sort_order, is_active")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as PromptSet[];
    },
  });

  const selectedSetId = activeSet ?? sets.data?.[0]?.id ?? null;
  const selectedSet = sets.data?.find((s) => s.id === selectedSetId) ?? null;

  const prompts = useQuery({
    queryKey: ["prompts-admin", selectedSetId],
    enabled: Boolean(selectedSetId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prompts")
        .select("id, question, position, is_active, set_id")
        .eq("set_id", selectedSetId!)
        .order("position");
      if (error) throw error;
      return (data ?? []) as Prompt[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["prompt-sets"] });
    qc.invalidateQueries({ queryKey: ["prompts-admin", selectedSetId] });
    qc.invalidateQueries({ queryKey: ["prompts"] });
  };

  const createSet = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("prompt_sets")
        .insert({
          name: newSetName,
          slug: slugify(newSetName) || `set-${Date.now()}`,
          emoji: newSetEmoji || null,
          description: newSetDescription || null,
          sort_order: (sets.data?.length ?? 0) + 1,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      setNewSetName("");
      setNewSetEmoji("");
      setNewSetDescription("");
      setSetOpen(false);
      setActiveSet(id);
      invalidate();
      toast.success("Set angelegt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSet = useMutation({
    mutationFn: async (patch: Partial<PromptSet> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from("prompt_sets").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSet = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prompt_sets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setActiveSet(null);
      invalidate();
      toast.success("Set gelöscht");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPrompt = useMutation({
    mutationFn: async () => {
      const nextPos = (prompts.data?.at(-1)?.position ?? 0) + 1;
      const { error } = await supabase
        .from("prompts")
        .insert({ question: newQuestion, set_id: selectedSetId, position: nextPos });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewQuestion("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePrompt = useMutation({
    mutationFn: async (patch: Partial<Prompt> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from("prompts").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePrompt = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prompts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  function move(index: number, dir: -1 | 1) {
    const list = prompts.data ?? [];
    const a = list[index];
    const b = list[index + dir];
    if (!a || !b) return;
    updatePrompt.mutate({ id: a.id, position: b.position });
    updatePrompt.mutate({ id: b.id, position: a.position });
  }

  if (loading) return <p className="text-sm text-muted-foreground">Einen Moment …</p>;
  if (!isAdmin)
    return (
      <div className="surface-card p-8 text-center">
        <h1 className="font-display text-xl font-semibold">Kein Zugriff</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Diese Seite ist nur für Admins. Frag im Team nach den nötigen Rechten.
        </p>
      </div>
    );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Fragen-Sets</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sets anlegen, Fragen bearbeiten, Reihenfolge bestimmen.
          </p>
        </div>
        <Dialog open={setOpen} onOpenChange={setSetOpen}>
          <DialogTrigger asChild>
            <Button>Neues Set</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set erstellen</DialogTitle>
              <DialogDescription>Ein Set bündelt Fragen zu einem Thema.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sname">Name</Label>
                <Input
                  id="sname"
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  placeholder="Familie & Herkunft"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="semoji">Emoji (optional)</Label>
                <Input
                  id="semoji"
                  value={newSetEmoji}
                  onChange={(e) => setNewSetEmoji(e.target.value)}
                  placeholder="🏡"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sdesc">Beschreibung (optional)</Label>
                <Textarea
                  id="sdesc"
                  value={newSetDescription}
                  onChange={(e) => setNewSetDescription(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={!newSetName || createSet.isPending}
                onClick={() => createSet.mutate()}
              >
                Set erstellen
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2">
        {sets.data?.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveSet(s.id)}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
              s.id === selectedSetId
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {s.emoji ? `${s.emoji} ` : ""}
            {s.name}
            {!s.is_active && " (inaktiv)"}
          </button>
        ))}
      </div>

      {selectedSet && (
        <section className="surface-card space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                defaultValue={selectedSet.name}
                key={`n-${selectedSet.id}`}
                onBlur={(e) =>
                  e.target.value !== selectedSet.name &&
                  updateSet.mutate({ id: selectedSet.id, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Emoji</Label>
              <Input
                defaultValue={selectedSet.emoji ?? ""}
                key={`e-${selectedSet.id}`}
                onBlur={(e) =>
                  e.target.value !== (selectedSet.emoji ?? "") &&
                  updateSet.mutate({ id: selectedSet.id, emoji: e.target.value || null })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Beschreibung</Label>
            <Textarea
              defaultValue={selectedSet.description ?? ""}
              key={`d-${selectedSet.id}`}
              onBlur={(e) =>
                e.target.value !== (selectedSet.description ?? "") &&
                updateSet.mutate({ id: selectedSet.id, description: e.target.value || null })
              }
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <label className="flex items-center gap-3 text-sm">
              <Switch
                checked={selectedSet.is_active}
                onCheckedChange={(v) => updateSet.mutate({ id: selectedSet.id, is_active: v })}
              />
              Set aktiv
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteSet.mutate(selectedSet.id)}
              className="text-destructive"
            >
              Set löschen
            </Button>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Fragen ({prompts.data?.length ?? 0})</h2>
        {prompts.data?.map((p, i) => (
          <div key={p.id} className="surface-card flex items-start gap-3 p-4">
            <div className="flex flex-col gap-1 pt-1">
              <button
                type="button"
                aria-label="Nach oben"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Nach unten"
                disabled={i === (prompts.data?.length ?? 0) - 1}
                onClick={() => move(i, 1)}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                ↓
              </button>
            </div>
            <Textarea
              defaultValue={p.question}
              rows={2}
              className="flex-1"
              onBlur={(e) =>
                e.target.value.trim() &&
                e.target.value !== p.question &&
                updatePrompt.mutate({ id: p.id, question: e.target.value.trim() })
              }
            />
            <div className="flex flex-col items-end gap-2">
              <Switch
                checked={p.is_active}
                onCheckedChange={(v) => updatePrompt.mutate({ id: p.id, is_active: v })}
              />
              <button
                type="button"
                onClick={() => deletePrompt.mutate(p.id)}
                className="text-xs text-destructive hover:underline"
              >
                Löschen
              </button>
            </div>
          </div>
        ))}

        <div className="surface-card flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-56 flex-1 space-y-2">
            <Label htmlFor="newq">Neue Frage</Label>
            <Input
              id="newq"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Was hat dich diese Woche überrascht?"
            />
          </div>
          <Button
            disabled={!newQuestion.trim() || !selectedSetId || addPrompt.isPending}
            onClick={() => addPrompt.mutate()}
          >
            Hinzufügen
          </Button>
        </div>
      </section>
    </div>
  );
}
