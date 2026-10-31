// eitje-kijk — eenmalig rondkijken in de eitje-API. Alleen lezen.
//
// POST {}  (met de inlog van een ingelogde beheerder)
//
// Deze functie beantwoordt twee vragen:
//   1. Wat staat er in eitje dat wij met de hand bijhouden? (work_schedules,
//      skill_sets, user_weeks, shift_types)
//   2. Hoe ver terug geeft eitje beschikbaarheid nog? Ons archief begint pas
//      op de dag dat de nachttaak voor het eerst draaide; bewaart eitje het
//      langer, dan valt die periode eenmalig in te halen.
//
// Bewust los van eitje-uren: die functie werkt en draait elke nacht. Daar ga
// je niet in rommelen voor een eenmalige vraag.
//
// Salarissen en contracten staan hier niet bij. Die zijn niet nodig om deze
// vraag te beantwoorden, en wat je niet ophaalt kan ook nergens belanden waar
// het niet hoort.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const EITJE = "https://open-api.eitje.app/open_api";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const EITJE_SLEUTELS = {
  "Partner-Username": Deno.env.get("EITJE_PARTNER_USERNAME") ?? "",
  "Partner-Password": Deno.env.get("EITJE_PARTNER_PASSWORD") ?? "",
  "Api-Username": Deno.env.get("EITJE_API_USERNAME") ?? "",
  "Api-Password": Deno.env.get("EITJE_API_PASSWORD") ?? "",
};

const PAUZE_MS = 1100;
const wacht = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/* verify_jwt laat ook de publieke anon-sleutel door, en die staat in de
   app-bundel. Daarom dezelfde vraag die de database bij elke tabel stelt. */
async function isAppGebruiker(auth: string | null): Promise<boolean> {
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) return false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/is_app_user`, {
      method: "POST",
      headers: {
        apikey: SB_ANON || auth.slice(7),
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    return r.ok && (await r.json()) === true;
  } catch {
    return false;
  }
}

async function eitjeHaal(pad: string, params: Record<string, string> = {}) {
  const url = new URL(`${EITJE}/${pad}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url, { headers: EITJE_SLEUTELS });
  const tekst = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${tekst.slice(0, 200)}`);
  const body = tekst ? JSON.parse(tekst) : {};
  return (body.items ?? []) as Record<string, unknown>[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "alleen POST" }, 405);

  if (!(await isAppGebruiker(req.headers.get("Authorization")))) {
    return json({ ok: false, error: "geen toegang" }, 401);
  }

  const dag = (d: Date) => d.toISOString().slice(0, 10);
  const nu = new Date();
  const terug = (n: number) => dag(new Date(nu.getTime() - n * 86400000));
  const vooruit = (n: number) => dag(new Date(nu.getTime() + n * 86400000));

  /* ISO-weeknummer: de donderdag van deze week bepaalt het jaar. */
  const t = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), nu.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const jaarStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - jaarStart.getTime()) / 86400000 + 1) / 7);

  const vragen: { naam: string; pad: string; params: Record<string, string> }[] = [
    { naam: "work_schedules", pad: "work_schedules", params: {} },
    { naam: "skill_sets", pad: "skill_sets", params: {} },
    { naam: "shift_types", pad: "shift_types", params: {} },
    { naam: "employment_types", pad: "employment_types", params: {} },
    { naam: "environments", pad: "environments", params: {} },
    { naam: "revenue_groups", pad: "revenue_groups", params: {} },
    { naam: "revenue_teams", pad: "revenue_teams", params: {} },
    { naam: "check_ins", pad: "check_ins", params: {} },
    {
      naam: "user_weeks",
      pad: "user_weeks",
      params: {
        "filters[year]": String(t.getUTCFullYear()),
        "filters[weeknumber]": String(week),
      },
    },
    {
      naam: "revenue_days_28d",
      pad: "revenue_days",
      params: { "filters[start_date]": terug(28), "filters[end_date]": dag(nu) },
    },
    {
      naam: "events_60d",
      pad: "events",
      params: { "filters[start_date]": dag(nu), "filters[end_date]": vooruit(60) },
    },
  ];

  /* Losse weken uit het verleden: komt er iets terug, dan valt het in te halen. */
  for (const n of [7, 60, 120, 180, 365]) {
    vragen.push({
      naam: `beschikbaarheid_${n}d_terug`,
      pad: "availability_shifts",
      params: { "filters[start_date]": terug(n), "filters[end_date]": terug(n - 6) },
    });
  }

  /* Elke vraag apart afgeschermd: niet elke endpoint is voor elke klant
     vrijgegeven, en één weigering mag de rest niet meeslepen. */
  const uitkomst: Record<string, unknown> = {};
  for (let i = 0; i < vragen.length; i++) {
    const v = vragen[i];
    if (i > 0) await wacht(PAUZE_MS);
    try {
      const rijen = await eitjeHaal(v.pad, v.params);
      uitkomst[v.naam] = {
        aantal: rijen.length,
        velden: rijen[0] ? Object.keys(rijen[0]) : [],
        voorbeeld: rijen.slice(0, 3),
      };
    } catch (e) {
      uitkomst[v.naam] = { fout: e instanceof Error ? e.message : String(e) };
    }
  }

  return json({ ok: true, week: `${t.getUTCFullYear()}-W${week}`, uitkomst });
});
