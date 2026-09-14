// stuur-melding
//
// POST { melding_id }
//
// Mailt een melding uit de zaak naar Sander. De melding staat op dat moment al
// in de database — dit is alleen het duwtje, zodat hij het ziet zonder de app te
// openen.
//
// De functie leest de melding zelf op uit de database en gebruikt niets uit het
// verzoek behalve het nummer. Zo kan er via deze weg geen tekst naar buiten die
// niet in de database staat.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SB_URL     = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = (Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "onboarding@boskmafoodservice.nl";
const MANAGER    = "sander@boskmafoodservice.nl";
const APP_URL    = Deno.env.get("APP_URL") ?? "https://nieuw.boskmafoodservice.nl";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const h = { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json" };

const SOORT: Record<string, string> = {
  stuk: "Stuk",
  voorraad: "Bijna op",
  hygiene: "Hygiëne of veiligheid",
  overig: "Melding",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function veilig(v: unknown) {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function leesInstelling(sleutel: string) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/instellingen?sleutel=eq.${sleutel}&select=waarde`, { headers: h });
    if (!r.ok) return null;
    return (await r.json())?.[0]?.waarde ?? null;
  } catch {
    return null;
  }
}

/** Bij twijfel gaan we ervan uit dat testmodus aan staat. Liever een mail te
 *  weinig naar buiten dan een te veel. */
async function leesTestmodus() {
  const w = await leesInstelling("testmodus");
  if (!w || typeof w !== "object") return { aan: true, adres: MANAGER };
  return { aan: (w as { aan?: boolean }).aan !== false, adres: (w as { adres?: string }).adres || MANAGER };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { melding_id } = await req.json();
    const id = Number(melding_id);
    if (!Number.isInteger(id) || id <= 0) return json({ ok: false, error: "geen geldige melding" }, 400);

    const r = await fetch(
      `${SB_URL}/rest/v1/meldingen?id=eq.${id}&select=soort,tekst,apparaat_naam,door_naam,gemeld_op,foto_pad`,
      { headers: h },
    );
    const melding = (await r.json())?.[0];
    if (!melding) return json({ ok: false, error: "melding niet gevonden" }, 404);

    const testmodus = await leesTestmodus();
    const naar = testmodus.aan
      ? testmodus.adres
      : ((await leesInstelling("meldingen_naar")) as { adres?: string } | null)?.adres || MANAGER;

    const kop = melding.apparaat_naam
      ? `${SOORT[melding.soort] ?? "Melding"}: ${melding.apparaat_naam}`
      : (SOORT[melding.soort] ?? "Melding");

    const wanneer = new Date(melding.gemeld_op).toLocaleString("nl-NL", {
      weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
      timeZone: "Europe/Amsterdam",
    });

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:520px;color:#1a1a1a">
        <p style="margin:0 0 4px;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#6b6558">
          Melding uit de zaak
        </p>
        <h1 style="margin:0 0 12px;font-size:22px">${veilig(kop)}</h1>
        <p style="margin:0 0 16px;white-space:pre-wrap;font-size:16px">${veilig(melding.tekst)}</p>
        <p style="margin:0 0 20px;font-size:14px;color:#6b6558">
          Door ${veilig(melding.door_naam || "onbekend")} · ${veilig(wanneer)}${melding.foto_pad ? " · met foto" : ""}
        </p>
        <a href="${APP_URL}/" style="display:inline-block;background:#003A41;color:#F0EBD5;text-decoration:none;padding:12px 20px;border-radius:4px;font-weight:600">
          Openen in de app
        </a>
        <p style="margin:20px 0 0;font-size:13px;color:#6b6558">
          De melding staat ook op je startscherm en blijft daar tot je hem aftikt.
        </p>
      </div>`;

    const mail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Snackerie 't Zonnetje <${FROM_EMAIL}>`,
        to: [naar],
        subject: `${kop}${testmodus.aan ? " (testmodus)" : ""}`,
        html,
      }),
    });

    if (!mail.ok) {
      // De melding staat al in de database; een mislukte mail mag dat niet
      // ongedaan maken. Alleen zeggen dat het niet gelukt is.
      return json({ ok: false, error: `mail mislukt: ${await mail.text()}` }, 502);
    }

    return json({ ok: true, verstuurd_naar: naar, testmodus: testmodus.aan });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "onbekende fout" }, 500);
  }
});
