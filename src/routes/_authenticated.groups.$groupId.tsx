import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Waveform } from "@/components/UnMuteLogo";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  head: () => ({
    meta: [
      { title: "Gruppe – UnMute" },
      { name: "description", content: "Impuls des Tages, Sprachnachrichten und Meilensteine deiner Gruppe." },
      { property: "og:title", content: "Gruppe – UnMute" },
      { property: "og:description", content: "Impuls des Tages, Sprachnachrichten und Meilensteine deiner Gruppe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GroupPage,
});

function todayIndex(len: number, seed: string) {
  const day = Math.floor(Date.now() / 86_400_000);
  let h = day;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return len ? h % len : 0;
}

function GroupPage() {
  const { groupId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const group = useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, name, topic, invite_code")
        .eq("id", groupId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const prompts = useQuery({
    queryKey: ["prompts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("prompts").select("id, question");
      if (error) throw error;
      return data ?? [];
    },
  });

  const notes = useQuery({
    queryKey: ["notes", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_notes")
        .select("id, user_id, prompt_text, audio_path, duration_seconds, created_at")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const { data: profiles } = await supabase.from("profiles").select("id, display_name");
      const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
      return (data ?? []).map((n) => ({ ...n, author: nameById.get(n.user_id) ?? "Jemand" }));
    },
  });

  const rewards = useQuery({
    queryKey: ["rewards", groupId],
    queryFn: async () => {
      const [{ data: all, error }, { data: unlocked }] = await Promise.all([
        supabase.from("rewards").select("*").order("required_notes"),
        supabase.from("group_rewards").select("reward_id, voucher_code").eq("group_id", groupId),
      ]);
      if (error) throw error;
      const codeById = new Map((unlocked ?? []).map((u) => [u.reward_id, u.voucher_code]));
      return (all ?? []).map((r) => ({ ...r, voucher: codeById.get(r.id) ?? null }));
    },
  });

  const prompt =
    prompts.data && prompts.data.length
      ? prompts.data[todayIndex(prompts.data.length, groupId)]
      : null;

  const upload = useMutation({
    mutationFn: async ({ blob, seconds }: { blob: Blob; seconds: number }) => {
      if (!user) throw new Error("Nicht angemeldet");
      const path = `${groupId}/${user.id}-${Date.now()}.webm`;
      const { error: upErr } = await supabase.storage
        .from("voice-notes")
        .upload(path, blob, { contentType: "audio/webm" });
      if (upErr) throw upErr;
      const { error } = await supabase.from("voice_notes").insert({
        group_id: groupId,
        user_id: user.id,
        prompt_id: prompt?.id ?? null,
        prompt_text: prompt?.question ?? null,
        audio_path: path,
        duration_seconds: seconds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sprachnachricht geteilt");
      qc.invalidateQueries({ queryKey: ["notes", groupId] });
      qc.invalidateQueries({ queryKey: ["rewards", groupId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const noteCount = notes.data?.length ?? 0;
  const nextReward = rewards.data?.find((r) => !r.voucher);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{group.data?.name ?? "Gruppe"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {group.data?.topic ?? "Ohne Thema"} · Code{" "}
          <span className="font-mono text-foreground">{group.data?.invite_code}</span>
        </p>
      </div>

      <section className="surface-card p-7">
        <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">Impuls des Tages</p>
        <h2 className="mt-3 text-2xl leading-snug font-semibold">
          {prompt?.question ?? "Lade Impuls …"}
        </h2>
        <Recorder disabled={upload.isPending} onDone={(blob, seconds) => upload.mutate({ blob, seconds })} />
      </section>

      <section className="surface-card p-7">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Meilenstein</h2>
          <span className="text-sm text-muted-foreground">{noteCount} Sprachnachrichten</span>
        </div>
        {nextReward ? (
          <>
            <Progress
              className="mt-4"
              value={Math.min(100, (noteCount / nextReward.required_notes) * 100)}
            />
            <p className="mt-3 text-sm text-muted-foreground">
              Noch {Math.max(0, nextReward.required_notes - noteCount)} bis „{nextReward.title}" bei{" "}
              {nextReward.partner}.
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Alle Belohnungen freigeschaltet. Stark!</p>
        )}

        <div className="mt-5 space-y-2">
          {rewards.data?.map((r) => (
            <div
              key={r.id}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${
                r.voucher ? "border-primary/50 bg-primary/10" : "border-border"
              }`}
            >
              <div>
                <p className="font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">
                  {r.partner} · {r.category} · ab {r.required_notes}
                </p>
              </div>
              {r.voucher ? (
                <span className="rounded-full bg-primary px-3 py-1 font-mono text-xs text-primary-foreground">
                  {r.voucher}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">gesperrt</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Stimmen der Gruppe</h2>
        {noteCount === 0 && (
          <p className="text-sm text-muted-foreground">Noch nichts gesagt – mach den Anfang.</p>
        )}
        {notes.data?.map((n) => (
          <NoteCard key={n.id} note={n} />
        ))}
      </section>
    </div>
  );
}

function NoteCard({
  note,
}: {
  note: {
    id: string;
    author: string;
    prompt_text: string | null;
    audio_path: string;
    duration_seconds: number;
    created_at: string;
  };
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.storage
      .from("voice-notes")
      .createSignedUrl(note.audio_path, 3600)
      .then(({ data }) => {
        if (active) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [note.audio_path]);

  return (
    <div className="surface-card p-5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{note.author}</span>
        <span className="text-muted-foreground">
          {new Date(note.created_at).toLocaleString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      {note.prompt_text && (
        <p className="mt-1 text-xs text-muted-foreground">„{note.prompt_text}"</p>
      )}
      {url ? (
        <audio controls src={url} className="mt-3 w-full" />
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">Lade Audio …</p>
      )}
    </div>
  );
}

function Recorder({
  onDone,
  disabled,
}: {
  onDone: (blob: Blob, seconds: number) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        onDone(blob, seconds);
        setSeconds(0);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("Kein Mikrofon-Zugriff");
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="mt-7 flex items-center gap-5">
      <button
        type="button"
        disabled={disabled}
        onClick={recording ? stop : start}
        aria-label={recording ? "Aufnahme beenden" : "Aufnahme starten"}
        className={`grid size-16 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:opacity-50 ${
          recording ? "recording-pulse" : ""
        }`}
      >
        {recording ? (
          <span className="size-5 rounded-sm bg-current" />
        ) : (
          <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden="true">
            <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" />
            <path d="M18 11a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.91V20a1 1 0 1 0 2 0v-3.09A6 6 0 0 0 18 11Z" />
          </svg>
        )}
      </button>
      <div className="flex-1">
        <Waveform active={recording} />
        <p className="mt-2 text-sm text-muted-foreground">
          {disabled
            ? "Wird geteilt …"
            : recording
              ? `Aufnahme läuft · ${seconds}s – tippe zum Beenden`
              : "Tippe und sprich einfach los."}
        </p>
      </div>
    </div>
  );
}

export { Button };
