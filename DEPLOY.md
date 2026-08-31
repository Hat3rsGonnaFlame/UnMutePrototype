# UnMute auf Vercel hosten

UnMute ist eine TanStack-Start-App mit Server-Rendering, Login und Datenbank.
Es gibt daher keine einzelne statische `index.html` — der Build erzeugt eine
Server-Anwendung. Auf Vercel läuft das out of the box:

## Schritte

1. Repository bei Vercel importieren.
2. Framework Preset: **Other** (steht bereits in `vercel.json`).
3. Environment Variables setzen (Production + Preview):

   | Name | Wert |
   | --- | --- |
   | `VITE_SUPABASE_URL` | aus der lokalen `.env` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | aus der lokalen `.env` |
   | `VITE_SUPABASE_PROJECT_ID` | aus der lokalen `.env` |
   | `SUPABASE_URL` | gleicher Wert wie oben |
   | `SUPABASE_PUBLISHABLE_KEY` | gleicher Wert wie oben |
   | `SUPABASE_PROJECT_ID` | gleicher Wert wie oben |

4. Deploy starten.

Der Build erkennt Vercel automatisch (`VERCEL=1`) und baut mit dem Nitro-Preset
`vercel` nach `.vercel/output` (Build Output API v3). Lokal und auf Lovable
bleibt der Cloudflare-Build unverändert.

Lokal testen:

```bash
NITRO_PRESET=vercel npm run build
```

## Nach dem ersten Deploy

Die Deploy-URL im Backend als erlaubte Redirect-URL für Login/OAuth eintragen,
sonst schlägt der Google-Login bzw. der Passwort-Reset auf der Vercel-Domain fehl.
