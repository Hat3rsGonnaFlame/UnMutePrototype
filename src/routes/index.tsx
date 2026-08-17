import { createFileRoute, Link } from "@tanstack/react-router";
import { UnMuteLogo, Waveform } from "@/components/UnMuteLogo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "UnMute – Die Social-Audio-App ohne Algorithmus" },
      {
        name: "description",
        content:
          "UnMute ist Social Audio für kleine Gruppen: ein Impuls, echte Sprachnachrichten, kein Feed. Aktive Gruppen schalten Gutscheine für echte Treffen frei.",
      },
      { property: "og:title", content: "UnMute – Die Social-Audio-App ohne Algorithmus" },
      {
        property: "og:description",
        content: "Echte Stimmen statt endloser Feeds. Kleine Gruppen, ein Impuls, echte Antworten.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const steps = [
  { n: "01", title: "Kleine Gruppen", text: "Themenbasierte Gruppen mit Freunden, Kommilitonen oder dem Verein." },
  { n: "02", title: "Ein Impuls", text: "Eine Frage motiviert dazu, einfach zu sprechen – statt zu schreiben." },
  { n: "03", title: "Echte Antworten", text: "Kurze Sprachnachrichten zeigen Updates & Gedanken echter Menschen." },
  { n: "04", title: "Kein Algorithmus", text: "Kein Feed, kein Ranking, keine Inszenierung – nur deine Gruppe." },
];

function Landing() {
  const { session, loading } = useAuth();
  const target = session ? "/groups" : "/auth";

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <UnMuteLogo />
        <Button asChild variant="ghost" size="sm" disabled={loading}>
          <Link to={target}>{session ? "Zu meinen Gruppen" : "Anmelden"}</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <section className="pt-10 pb-20 sm:pt-20">
          <p className="text-sm font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Social Audio ohne Algorithmus
          </p>
          <h1 className="mt-5 max-w-3xl text-5xl leading-[1.05] font-bold sm:text-7xl">
            Echte Stimmen statt <span className="text-gradient-warm">endloser Feeds</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Verbunden wie nie – und trotzdem allein. UnMute bringt kleine Gruppen zurück ins
            Gespräch: ein Impuls am Tag, kurze Sprachnachrichten, echte Nähe.
          </p>
          <div className="mt-9 flex items-center gap-5">
            <Button asChild size="lg">
              <Link to={target}>Gruppe starten</Link>
            </Button>
            <Waveform />
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {steps.map((s) => (
            <div key={s.n} className="surface-card p-6">
              <span className="font-display text-sm font-bold text-primary">{s.n}</span>
              <h2 className="mt-3 text-xl font-semibold">{s.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </section>

        <section className="surface-card mt-4 p-8">
          <h2 className="text-2xl font-semibold">Belohnung schafft echte Treffen</h2>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Aktive Gruppen erreichen Meilensteine und schalten Gutscheine aus dem Partnernetzwerk
            frei – Café, Kino, Museum oder Gym. Das Ziel: raus aus der App, rein ins echte Leben.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Café", "Kino", "Museum", "Gym-Workout", "Essen"].map((c) => (
              <span
                key={c}
                className="rounded-full border border-border bg-secondary px-4 py-1.5 text-sm text-secondary-foreground"
              >
                {c}
              </span>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
