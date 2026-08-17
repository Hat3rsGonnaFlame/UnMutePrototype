import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { authErrorMessage } from "@/lib/auth-errors";
import { UnMuteLogo } from "@/components/UnMuteLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Anmelden – UnMute" },
      { name: "description", content: "Melde dich bei UnMute an und starte deine Audio-Gruppe." },
      { property: "og:title", content: "Anmelden – UnMute" },
      {
        property: "og:description",
        content: "Melde dich bei UnMute an und starte deine Audio-Gruppe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<null | "confirm" | "reset">(null);

  useEffect(() => {
    if (session) navigate({ to: "/groups", replace: true });
  }, [session, navigate]);

  function switchMode(next: Mode) {
    setMode(next);
    setSent(null);
    setPassword("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { display_name: name.trim() || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Konto erstellt – willkommen bei UnMute!");
        } else {
          setSent("confirm");
        }
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent("reset");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        toast.success("Willkommen zurück!");
      }
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth` },
      });
      if (error) throw error;
      toast.success("E-Mail wurde erneut verschickt.");
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Google-Anmeldung fehlgeschlagen");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/groups", replace: true });
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <UnMuteLogo className="mb-8" />
          <div className="surface-card p-8 text-center">
            <h1 className="text-2xl font-semibold">
              {sent === "confirm" ? "Nur noch ein Klick" : "E-Mail ist unterwegs"}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {sent === "confirm" ? (
                <>
                  Wir haben dir eine Bestätigungsmail an{" "}
                  <span className="text-foreground">{email}</span> geschickt. Öffne den Link darin –
                  danach kannst du direkt loslegen.
                </>
              ) : (
                <>
                  Falls ein Konto zu <span className="text-foreground">{email}</span> existiert,
                  liegt gleich ein Link zum Zurücksetzen im Postfach.
                </>
              )}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Nichts da? Schau kurz im Spam-Ordner nach.
            </p>
            {sent === "confirm" && (
              <Button
                variant="outline"
                className="mt-6 w-full"
                onClick={resendConfirmation}
                disabled={busy}
              >
                E-Mail erneut senden
              </Button>
            )}
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="mt-4 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Zurück zur Anmeldung
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <UnMuteLogo className="mb-8" />
        <div className="surface-card p-8">
          <h1 className="text-2xl font-semibold">
            {mode === "signin" && "Willkommen zurück"}
            {mode === "signup" && "Konto erstellen"}
            {mode === "forgot" && "Passwort vergessen"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "forgot"
              ? "Wir schicken dir einen Link, mit dem du ein neues Passwort setzt."
              : "Sprich mit Menschen, die du wirklich kennst."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Wie sollen dich andere sehen?"
                  autoComplete="name"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Passwort</Label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                    >
                      Vergessen?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {mode === "signup" && (
                  <p className="text-xs text-muted-foreground">Mindestens 6 Zeichen.</p>
                )}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "signin" && (busy ? "Wird angemeldet …" : "Anmelden")}
              {mode === "signup" && (busy ? "Konto wird erstellt …" : "Registrieren")}
              {mode === "forgot" && (busy ? "Wird gesendet …" : "Link senden")}
            </Button>
          </form>

          {mode !== "forgot" && (
            <Button variant="outline" className="mt-3 w-full" onClick={google} disabled={busy}>
              Mit Google fortfahren
            </Button>
          )}

          <button
            type="button"
            onClick={() => switchMode(mode === "signup" ? "signin" : mode === "forgot" ? "signin" : "signup")}
            className="mt-6 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {mode === "signin" && "Noch kein Konto? Registrieren"}
            {mode === "signup" && "Schon dabei? Anmelden"}
            {mode === "forgot" && "Zurück zur Anmeldung"}
          </button>
        </div>
      </div>
    </div>
  );
}
