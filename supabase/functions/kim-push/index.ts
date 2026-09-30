// kim-push
//
// POST { tabel: 'kim_vragen' | 'kim_wachtposten', id }
//
// Stuurt Sander een pushbericht voor een nieuwe vraag van Kim, of voor een wachtpost
// waar iets aan veranderd is. Wordt aangeroepen door een trigger in de database.
//
// Net als stuur-melding: de functie leest de rij zelf op en gebruikt uit het verzoek
// alleen tabel en nummer. Elke rij wordt hooguit een keer gepusht (gepusht_op); een
// tweede aanroep doet niets. Daarom mag verify_jwt uit.
//
// De VAPID-sleutels komen uit Vault (zie zorgVoorVapid), niet uit de secrets.

import webpush from "npm:web-push@3.6.7";

const SB_URL     = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL    = Deno.env.get("APP_URL") ?? "https://nieuw.boskmafoodservice.nl";

const h = { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json" };

// VAPID-sleutels staan in Vault (push_vapid_public / push_vapid_private). Zijn ze er nog
// niet, dan maakt deze functie ze de eerste keer zelf aan. De private key verlaat
// Supabase dus nooit en hoeft door niemand overgetypt te worden.
let vapidKlaar = false;

async function vapidOphalen(): Promise<{ public?: string; private?: string }> {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/push_vapid_ophalen`, { method: "POST", headers: h, body: "{}" });
  if (!r.ok) throw new Error(`VAPID ophalen mislukt: ${await r.text()}`);
  return await r.json();
}

async function zorgVoorVapid() {
  if (vapidKlaar) return;
  let k = await vapidOphalen();
  if (!k.public || !k.private) {
    const nieuw = webpush.generateVAPIDKeys();
    const r = await fetch(`${SB_URL}/rest/v1/rpc/push_vapid_opslaan`, {
      method: "POST", headers: h,
      body: JSON.stringify({ p_public: nieuw.publicKey, p_private: nieuw.privateKey }),
    });
    if (!r.ok) throw new Error(`VAPID opslaan mislukt: ${await r.text()}`);
    k = await vapidOphalen(); // opnieuw lezen: bij twee gelijktijdige aanroepen wint de eerste
  }
  webpush.setVapidDetails("mailto:sander@boskmafoodservice.nl", k.public!, k.private!);
  vapidKlaar = true;
}
const TABELLEN = ["kim_vragen", "kim_wachtposten"] as const;
type Tabel = typeof TABELLEN[number];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function kort(tekst: string, max = 160) {
  const t = (tekst ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

/** Zet gepusht_op, maar alleen als de rij nog gepusht moet worden. Geeft true als
 *  deze aanroep de rij "claimt"; zo gaat er nooit twee keer een push uit. */
async function claim(tabel: Tabel, id: number, filter: string) {
  const r = await fetch(`${SB_URL}/rest/v1/${tabel}?id=eq.${id}&${filter}`, {
    method: "PATCH",
    headers: { ...h, Prefer: "return=representation" },
    body: JSON.stringify({ gepusht_op: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(`claim mislukt: ${await r.text()}`);
  return ((await r.json()) as unknown[]).length === 1;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "alleen POST" }, 405);

  try {
    // Eerst de sleutels: lukt dat niet, dan wordt er ook niets als 'gepusht' gemarkeerd.
    await zorgVoorVapid();

    const { tabel, id } = await req.json().catch(() => ({}));
    const nr = Number(id);
    if (!TABELLEN.includes(tabel) || !Number.isInteger(nr) || nr <= 0) {
      return json({ ok: false, error: "ongeldige tabel of nummer" }, 400);
    }

    const r = await fetch(`${SB_URL}/rest/v1/${tabel}?id=eq.${nr}&select=*`, { headers: h });
    const rij = (await r.json())?.[0];
    if (!rij) return json({ ok: false, error: "rij niet gevonden" }, 404);

    let bericht: { title: string; body: string; url: string; tag: string };

    if (tabel === "kim_vragen") {
      if (rij.beantwoord_op || rij.afgehandeld_op) return json({ ok: true, overgeslagen: "al beantwoord" });
      if (!(await claim(tabel, nr, "gepusht_op=is.null"))) return json({ ok: true, overgeslagen: "al gepusht" });
      bericht = { title: "Kim vraagt", body: kort(rij.vraag), url: `${APP_URL}/kim`, tag: `kim-vraag-${nr}` };
    } else {
      if (!rij.melding || !rij.melding_op || rij.afgedaan_op) return json({ ok: true, overgeslagen: "niets te melden" });
      const na = encodeURIComponent(`"${rij.melding_op}"`); // quotes: tijdstempel bevat : . en +
      if (!(await claim(tabel, nr, `or=(gepusht_op.is.null,gepusht_op.lt.${na})`))) {
        return json({ ok: true, overgeslagen: "al gepusht" });
      }
      bericht = { title: kort(rij.wie, 60), body: kort(rij.melding), url: `${APP_URL}/kim`, tag: `kim-wacht-${nr}` };
    }

    const s = await fetch(`${SB_URL}/rest/v1/push_subscriptions?voor_kim=eq.true&select=endpoint,p256dh,auth`, { headers: h });
    const subs = (await s.json()) as { endpoint: string; p256dh: string; auth: string }[];

    const uitkomst = await Promise.allSettled(subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(bericht),
      ).catch(async (err: { statusCode?: number }) => {
        // Verlopen abonnement: opruimen.
        if (err.statusCode === 404 || err.statusCode === 410) {
          await fetch(`${SB_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, {
            method: "DELETE", headers: h,
          });
        }
        throw err;
      })
    ));

    const gelukt = uitkomst.filter((u) => u.status === "fulfilled").length;
    return json({ ok: true, apparaten: subs.length, gelukt });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "onbekende fout" }, 500);
  }
});
