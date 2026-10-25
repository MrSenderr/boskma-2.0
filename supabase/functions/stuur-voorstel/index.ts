// stuur-voorstel
// POST { voorstel: uuid, aanhef, blokken, afsluiting, tekst }
// → mailt het contractvoorstel naar de medewerker, stuurt hem een pushbericht
//   als hij meldingen aan heeft staan, en zet verstuurd_op.
//
// Waarom de brief meekomt uit de app en hier niet opnieuw wordt samengesteld:
// Sander ziet de brief voordat hij op versturen drukt, en wat hij zag hoort
// verstuurd te worden. Zou deze functie de tekst zelf opbouwen uit de velden,
// dan zijn er twee plekken waar de brief wordt geschreven en gaan die vroeg of
// laat uit elkaar lopen.
//
// De brief komt binnen als blokken — koppen, alinea's, opsommingen, kaders —
// en wordt hier als mail gezet. Dezelfde blokken en dezelfde platte tekst gaan
// de database in: de tekst als bewijsstuk, de blokken zodat het scherm van de
// medewerker later precies toont wat er is verstuurd.
//
// Wat deze functie zelf opzoekt is wie de medewerker is en of het voorstel nog
// verstuurd mag worden. Dat komt niet uit het verzoek: anders kan wie de
// publieke sleutel heeft — en die staat in elke browser — post namens Sander
// naar een adres naar keuze sturen.
//
// De mail bevat geen inloglink. De medewerker logt in zoals altijd; een link
// die iemand binnenlaat hoort niet in een mail over zijn contract.

import { wieBelt } from "../_shared/beller.ts";
import { pushNaar } from "../_shared/push.ts";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "onboarding@boskmafoodservice.nl";
const CC_EMAIL = "sander@boskmafoodservice.nl";
const APP_URL = Deno.env.get("APP_URL") ?? "https://nieuw.boskmafoodservice.nl";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const h = {
  apikey: SB_SERVICE,
  Authorization: `Bearer ${SB_SERVICE}`,
  "Content-Type": "application/json",
};

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

/** Testmodus staat in de tabel instellingen. Bij twijfel aan: liever een mail
 *  te weinig naar buiten dan een te veel. Zelfde regel als stuur-loonbureau. */
async function leesTestmodus(): Promise<{ aan: boolean; adres: string }> {
  const veilig = { aan: true, adres: CC_EMAIL };
  try {
    const r = await fetch(`${SB_URL}/rest/v1/instellingen?sleutel=eq.testmodus&select=waarde`, {
      headers: h,
    });
    if (!r.ok) return veilig;
    const w = (await r.json())?.[0]?.waarde;
    if (!w || typeof w !== "object") return veilig;
    return { aan: w.aan !== false, adres: w.adres || CC_EMAIL };
  } catch {
    return veilig;
  }
}

function ontsnap(t: string): string {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const AARDKOP: Record<string, string> = {
  verlengen: "Een voorstel om je contract te verlengen",
  stoppen: "Over het einde van je contract",
  vaste_uren: "Een aanbod voor vaste uren",
  verlengen_en_vaste_uren: "Een voorstel om te verlengen, en een aanbod voor vaste uren",
};

type Blok =
  | { soort: "alinea"; tekst: string }
  | { soort: "kop"; tekst: string }
  | { soort: "lijst"; regels: string[] }
  | { soort: "kader"; tekst: string };

function blokAlsHtml(b: Blok): string {
  if (b.soort === "kop") {
    return `<p style="margin:20px 0 6px;font-weight:700">${ontsnap(b.tekst)}</p>`;
  }
  if (b.soort === "lijst") {
    return `<ul style="margin:0 0 12px;padding-left:20px">${b.regels
      .map((r) => `<li style="margin:0 0 4px">${ontsnap(r)}</li>`)
      .join("")}</ul>`;
  }
  if (b.soort === "kader") {
    return `<div style="border-left:3px solid #003a41;background:#f1efe6;padding:10px 14px;margin:16px 0">${ontsnap(b.tekst)}</div>`;
  }
  return `<p style="margin:0 0 12px">${ontsnap(b.tekst)}</p>`;
}

function mailtekst(opties: {
  aanhef: string;
  blokken: Blok[];
  afsluiting: string[];
  testAdres?: string;
}): string {
  const { aanhef, blokken, afsluiting, testAdres } = opties;
  const balk = testAdres
    ? `<div style="background:#fff4d6;border:2px solid #b87a22;border-radius:6px;padding:12px 16px;margin:0 0 16px;font-size:14px;color:#5c4310">
         <strong>TESTMODUS</strong> — deze mail was bedoeld voor <strong>${ontsnap(testAdres)}</strong>. De medewerker heeft niets ontvangen.
       </div>`
    : "";

  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1b1b1b;max-width:560px">
    ${balk}
    <p style="margin:0 0 16px">${ontsnap(aanhef)}</p>
    ${blokken.map(blokAlsHtml).join("")}
    <p style="margin:20px 0 0">${afsluiting.map(ontsnap).join("<br>")}</p>
    <p style="margin-top:24px"><a href="${APP_URL}/mijn-dossier" style="color:#1b1b1b">Naar Mijn dossier</a></p>
    <p style="color:#6b6b6b;font-size:13px;margin-top:24px">Kom je er niet in of klopt er iets niet?
    Laat het me weten, dan geef ik het je op papier.</p>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "alleen POST" }, 405);

  try {
    if (!(await wieBelt(req))) return json({ ok: false, error: "hier mag je niet bij" }, 403);

    const { voorstel, aanhef, blokken, afsluiting, tekst } = await req.json().catch(() => ({}));
    if (typeof voorstel !== "string" || !voorstel) {
      return json({ ok: false, error: "geen voorstel meegegeven" }, 400);
    }
    if (!Array.isArray(blokken) || blokken.length === 0 || typeof tekst !== "string" || !tekst.trim()) {
      return json({ ok: false, error: "de brief is leeg" }, 400);
    }

    // De rij zelf opzoeken, inclusief naam en adres van de medewerker.
    const velden =
      "id,aard,uiterlijk,verstuurd_op,ingetrokken_op,medewerker_id," +
      "sollicitaties(voornaam,achternaam,email)";
    const r = await fetch(
      `${SB_URL}/rest/v1/contractvoorstellen?id=eq.${voorstel}&select=${encodeURIComponent(velden)}`,
      { headers: h },
    );
    if (!r.ok) return json({ ok: false, error: `voorstel lezen mislukt: ${await r.text()}` }, 500);
    const v = (await r.json())?.[0];
    if (!v) return json({ ok: false, error: "voorstel niet gevonden" }, 404);
    if (v.ingetrokken_op) return json({ ok: false, error: "dit voorstel is ingetrokken" }, 409);
    if (v.verstuurd_op) return json({ ok: false, error: "dit voorstel is al verstuurd" }, 409);

    const mw = v.sollicitaties;
    const naar = (mw?.email ?? "").trim();
    if (!naar) {
      return json(
        { ok: false, error: "deze medewerker heeft geen mailadres; geef het voorstel op papier" },
        400,
      );
    }

    const tm = await leesTestmodus();
    const ontvanger = tm.aan ? tm.adres : naar;

    const mail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ontvanger],
        // Een kopie naar Sander: dit is het bewijsstuk dat de aanzegging de
        // deur uit is gegaan, en dat hoort niet alleen in de app te staan.
        ...(tm.aan ? {} : { bcc: [CC_EMAIL] }),
        subject: `${tm.aan ? "[TEST] " : ""}${AARDKOP[v.aard] ?? "Over je contract"}`,
        html: mailtekst({
          aanhef: typeof aanhef === "string" && aanhef ? aanhef : `Hoi ${mw?.voornaam ?? ""},`,
          blokken: blokken as Blok[],
          afsluiting: Array.isArray(afsluiting) ? afsluiting : ["Groet,", "Sander"],
          testAdres: tm.aan ? naar : undefined,
        }),
      }),
    });

    if (!mail.ok) {
      const fout = await mail.text();
      console.error("[stuur-voorstel] Resend fout:", fout);
      return json({ ok: false, error: `verzenden mislukt: ${fout}` }, 500);
    }

    /* Pas vastleggen als de mail eruit is. Omgekeerd zou er "verstuurd" staan
       bij een voorstel dat nooit is aangekomen, en daar reken je straks de
       aanzegtermijn mee. */
    const nu = new Date().toISOString();
    const bij = await fetch(`${SB_URL}/rest/v1/contractvoorstellen?id=eq.${voorstel}`, {
      method: "PATCH",
      headers: { ...h, Prefer: "return=minimal" },
      body: JSON.stringify({
        verstuurd_op: nu,
        verstuurd_naar: ontvanger,
        brief: tekst,
        brief_opbouw: blokken,
        bijgewerkt_op: nu,
      }),
    });
    if (!bij.ok) {
      console.error("[stuur-voorstel] vastleggen mislukt:", await bij.text());
      return json(
        { ok: false, error: "de mail is verstuurd, maar het vastleggen mislukte" },
        500,
      );
    }

    /* Push als hij meldingen aan heeft. Mislukt dat, dan is dat geen fout: de
       mail is het bericht, de push is de tik op de schouder. In testmodus gaat
       er ook geen push naar de medewerker. */
    let push = { apparaten: 0, gelukt: 0 };
    if (!tm.aan) {
      try {
        push = await pushNaar(naar, {
          title: AARDKOP[v.aard] ?? "Over je contract",
          body: "Lees het in de app en laat weten dat je het gezien hebt.",
          url: `${APP_URL}/mijn-dossier`,
          tag: `voorstel-${voorstel}`,
        });
      } catch (e) {
        console.warn("[stuur-voorstel] push mislukt:", e);
      }
    }

    return json({
      ok: true,
      testmodus: tm.aan,
      verstuurd_naar: ontvanger,
      apparaten: push.apparaten,
      push_gelukt: push.gelukt,
    });
  } catch (e) {
    const bericht = e instanceof Error ? e.message : "onbekende fout";
    console.error("[stuur-voorstel]", bericht);
    return json({ ok: false, error: bericht }, 500);
  }
});
