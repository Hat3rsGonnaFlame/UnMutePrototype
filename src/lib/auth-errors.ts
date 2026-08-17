/** Übersetzt Supabase-Auth-Fehler in verständliche deutsche Meldungen. */
export function authErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const msg = raw.toLowerCase();

  if (msg.includes("invalid login credentials")) {
    return "E-Mail oder Passwort stimmt nicht.";
  }
  if (msg.includes("email not confirmed")) {
    return "Bitte bestätige zuerst deine E-Mail-Adresse – schau in dein Postfach.";
  }
  if (msg.includes("user already registered") || msg.includes("already been registered")) {
    return "Diese E-Mail ist schon registriert. Melde dich einfach an.";
  }
  if (msg.includes("password should be at least")) {
    return "Das Passwort braucht mindestens 6 Zeichen.";
  }
  if (msg.includes("pwned") || msg.includes("compromised")) {
    return "Dieses Passwort taucht in Datenlecks auf. Bitte wähle ein anderes.";
  }
  if (msg.includes("unable to validate email") || msg.includes("invalid email")) {
    return "Diese E-Mail-Adresse sieht nicht gültig aus.";
  }
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return "Zu viele Versuche. Bitte warte kurz und probier es erneut.";
  }
  if (msg.includes("same password")) {
    return "Das neue Passwort muss sich vom alten unterscheiden.";
  }
  if (msg.includes("expired") || msg.includes("invalid token")) {
    return "Der Link ist abgelaufen. Fordere bitte einen neuen an.";
  }
  if (msg.includes("failed to fetch") || msg.includes("network")) {
    return "Keine Verbindung. Prüfe kurz dein Netzwerk.";
  }
  return raw || "Etwas ist schiefgelaufen.";
}
