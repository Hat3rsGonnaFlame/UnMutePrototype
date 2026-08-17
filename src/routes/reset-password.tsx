import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/lib/auth-errors";
import { UnMuteLogo } from "@/components/UnMuteLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Neues Passwort – UnMute" },
      { name: "description", content: "Setze ein neues Passwort für dein UnMute-Konto." },
      { property: "og:title", content: "Neues Passwort – UnMute" },
      {
        property: "og:description",
        content: "Setze ein neues Passwort für dein UnMute-Konto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let done = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        done = true;
        setReady("ok");
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        done = true;
        setReady("ok");
      } else {
        // Der Link wird kurz nach dem Laden verarbeitet – etwas Puffer geben.
        setTimeout(() => {
          if (!done) setReady("invalid");
        }, 2000);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Die beiden Passwörter stimmen nicht überein.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Passwort aktualisiert – du bist angemeldet.");
      navigate({ to: "/groups", replace: true });
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <UnMuteLogo className="mb-8" />
        <div className="surface-card p-8">
          <h1 className="text-2xl font-semibold">Neues Passwort</h1>

          {ready === "checking" && (
            <p className="mt-3 text-sm text-muted-foreground">Einen Moment …</p>
          )}

          {ready === "invalid" && (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                Dieser Link ist abgelaufen oder ungültig. Fordere einfach einen neuen an.
              </p>
              <Button className="mt-6 w-full" onClick={() => navigate({ to: "/auth" })}>
                Zurück zur Anmeldung
              </Button>
            </>
          )}

          {ready === "ok" && (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Neues Passwort</Label>
                <Input
                  id="new-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Passwort wiederholen</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Wird gespeichert …" : "Passwort speichern"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
