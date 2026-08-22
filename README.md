# Boskma 2.0

Beheerapp voor Boskma Foodservice · Snackerie 't Zonnetje, Wervershoof.

## Lokaal draaien

```bash
cp .env.example .env   # vul de publieke Supabase-sleutel in
npm install
npm run dev            # http://localhost:3010
```

## Uitrollen

Coolify bouwt de Dockerfile. Zet in Coolify twee environment variables en vink
bij allebei **Build variable** aan — Vite bakt ze tijdens het bouwen in:

| naam | waarde |
|---|---|
| `VITE_SUPABASE_URL` | `https://xukzumqddeateztmjpzf.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | de publieke sleutel uit Supabase → Settings → API |

Verder: build pack `dockerfile`, port `80`.

## Inloggen

Met het account uit Supabase → Authentication → Users. Wie toegang heeft, staat
in de databasefunctie `public.is_app_user()`.

Zie `CLAUDE.md` voor de afspraken in deze codebase.
