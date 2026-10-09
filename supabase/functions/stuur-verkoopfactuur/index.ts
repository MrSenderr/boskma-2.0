// stuur-verkoopfactuur
//
// POST { factuur_id, tekst?, test?: boolean }
//
// Zet een concept om in een echte factuur en stuurt hem weg. In deze volgorde,
// en de volgorde is het punt:
//
//   1. nummer toekennen   (verkoopfactuur_definitief, deelt er hoogstens een uit)
//   2. pdf maken          (verkoopfactuur-pdf, bewaart hem in de prive-bucket)
//   3. mail naar de klant (met de pdf als bijlage)
//   4. mail naar Basecone (dezelfde pdf, los, voor de boekhouding)
//   5. vastleggen dat hij verstuurd is
//
// Gaat stap 3 of 4 mis, dan staat het nummer er al op en is de pdf bewaard.
// Opnieuw proberen kost daarom geen tweede nummer: verkoopfactuur_definitief
// geeft het bestaande terug.
//
// Testmodus of test: true -> alles naar het testadres, en het nummer blijft
// ongemoeid. Een testfactuur krijgt TEST op de pdf en een nepnummer, zodat je
// hem nooit aanziet voor een echte.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SB_URL     = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;
const VAN        = "Snackerie 't Zonnetje <sander@boskmafoodservice.nl>";
const ANTWOORD   = "sander@boskmafoodservice.nl";

const h = { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json" };
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EURO = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const veilig = (t: unknown) =>
  String(t ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));

/** Vertelt bij welke stap het misging; dat scheelt zoeken. */
function mislukt(stap: string, waarom: string, status = 500) {
  return new Response(JSON.stringify({ ok: false, stap, error: waarom }), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}

/* Standaard aan: kan hij de instelling niet lezen, dan gaat er liever niets
   naar een echte klant dan per ongeluk wel. */
async function leesTestmodus() {
  const veiligeStand = { aan: true, adres: ANTWOORD };
  try {
    const r = await fetch(`${SB_URL}/rest/v1/instellingen?sleutel=eq.testmodus&select=waarde`, { headers: h });
    if (!r.ok) return veiligeStand;
    const w = (await r.json())?.[0]?.waarde;
    if (!w || typeof w !== "object") return veiligeStand;
    return { aan: w.aan !== false, adres: w.adres || ANTWOORD };
  } catch {
    return veiligeStand;
  }
}

const datumNL = (d: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) : "";

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function standaardTekst(klant: any, f: any, nummer: string): string {
  const aanhef = klant?.contactpersoon?.trim() || "administratie";
  return [
    `Beste ${aanhef},`,
    "",
    `In de bijlage vind je factuur ${nummer}${f.onderwerp ? ` voor ${f.onderwerp}` : ""}. ` +
      `Het totaalbedrag is ${EURO.format(Number(f.totaal_incl))} inclusief btw. ` +
      `Graag betalen vóór ${datumNL(f.vervaldatum)}.`,
    "",
    "Vriendelijke groet,",
    "Sander Boskma – Boskma Foodservice / Snackerie 't Zonnetje",
  ].join("\n");
}

const alsHtml = (tekst: string) =>
  tekst.split("\n").map((r) => (r.trim() === "" ? "<br>" : `<p style="margin:0 0 10px">${veilig(r)}</p>`)).join("");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return mislukt("verzoek", "alleen POST", 405);

  try {
    const { factuur_id, tekst, test, herinnering } = await req.json().catch(() => ({}));
    const id = Number(factuur_id);
    if (!Number.isInteger(id) || id <= 0) return mislukt("verzoek", "ongeldig factuurnummer", 400);

    const tm = await leesTestmodus();
    // Een proef gaat nooit naar een klant, en kost nooit een nummer.
    const proef = Boolean(test) || tm.aan;

    const f = (await fetch(`${SB_URL}/rest/v1/verkoopfacturen?id=eq.${id}&select=*`, { headers: h })
      .then((r) => r.json()))?.[0];
    if (!f) return mislukt("ophalen", "factuur niet gevonden", 404);
    // Een herinnering is dezelfde factuur nog een keer; die is dus al verstuurd.
    if (herinnering) {
      if (f.status !== "verzonden") return mislukt("ophalen", "deze factuur staat niet open", 400);
    } else if (f.status !== "concept" && !proef) {
      return mislukt("ophalen", `deze factuur is al ${f.status}`, 400);
    }

    const klant = (await fetch(`${SB_URL}/rest/v1/klanten?id=eq.${f.klant_id}&select=*`, { headers: h })
      .then((r) => r.json()))?.[0];
    if (!klant?.factuur_email) return mislukt("klant", "deze klant heeft geen factuuradres", 400);

    // 1. Nummer. Bij een proef slaan we dit over, dus de telling blijft kloppen.
    let nummer: number | null = f.nummer;
    if (!proef && !herinnering) {
      const r = await fetch(`${SB_URL}/rest/v1/rpc/verkoopfactuur_definitief`, {
        method: "POST", headers: h, body: JSON.stringify({ p_id: id }),
      });
      if (!r.ok) return mislukt("nummer toekennen", await r.text());
      nummer = Number(await r.json());
    }

    // De factuur opnieuw ophalen: datum en vervaldatum zijn er net bij gezet.
    const fNu = (await fetch(`${SB_URL}/rest/v1/verkoopfacturen?id=eq.${id}&select=*`, { headers: h })
      .then((r) => r.json()))?.[0] ?? f;
    const nummerTekst = proef ? `TEST-${nummer ?? id}` : String(nummer);

    // 2. Pdf.
    const pdfRes = await fetch(`${SB_URL}/functions/v1/verkoopfactuur-pdf`, {
      method: "POST", headers: h,
      body: JSON.stringify({ factuur_id: id, soort: proef ? "test" : "definitief" }),
    });
    if (!pdfRes.ok) return mislukt("pdf maken", await pdfRes.text());
    const pdf = bufToBase64(await pdfRes.arrayBuffer());
    const bestandsnaam = `Snackerie 't Zonnetje - Factuur ${nummerTekst}.pdf`;

    const body = typeof tekst === "string" && tekst.trim()
      ? tekst
      : standaardTekst(klant, fNu, nummerTekst);

    const naarKlant = proef ? [tm.adres] : [klant.factuur_email];
    const kopie = !proef && klant.cc_email ? [klant.cc_email] : undefined;

    // 3. Naar de klant.
    const mail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: VAN, to: naarKlant, ...(kopie ? { cc: kopie } : {}), reply_to: ANTWOORD,
        subject: `${proef ? "[TEST] " : ""}${herinnering ? "Herinnering: factuur" : "Factuur"} ${nummerTekst} — Snackerie 't Zonnetje`,
        html: (proef ? `<p style="background:#fde;padding:8px">Testbericht. Zou naar ${veilig(klant.factuur_email)} zijn gegaan.</p>` : "") + alsHtml(body),
        attachments: [{ filename: bestandsnaam, content: pdf }],
      }),
    });
    if (!mail.ok) return mislukt("mail naar de klant", await mail.text());

    // Een herinnering is geen nieuwe factuur: Basecone heeft hem al, en de
    // status verandert niet. Alleen onthouden wanneer we hem stuurden, zodat
    // het seintje daarna zeven dagen wacht.
    if (herinnering) {
      await fetch(`${SB_URL}/rest/v1/rpc/verkoopfactuur_herinnerd`, {
        method: "POST", headers: h, body: JSON.stringify({ p_id: id }),
      });
      return new Response(JSON.stringify({
        ok: true, test: proef, nummer, verstuurd_naar: naarKlant[0], basecone: "niet nodig",
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 4. Los naar Basecone, voor de boekhouding.
    const bc = (await fetch(`${SB_URL}/rest/v1/instellingen?sleutel=eq.basecone_verkoop&select=waarde`, { headers: h })
      .then((r) => r.json()))?.[0]?.waarde?.adres;
    let basecone = "overgeslagen";
    if (bc) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: VAN, to: [proef ? tm.adres : bc],
          subject: `${proef ? "[TEST] " : ""}Verkoopfactuur ${nummerTekst}`,
          text: `Verkoopfactuur ${nummerTekst} aan ${klant.naam}, factuurdatum ` +
                `${(fNu.factuurdatum ?? "").split("-").reverse().join("-")}, ` +
                `EUR ${Number(fNu.totaal_incl).toFixed(2)} incl. BTW.`,
          attachments: [{ filename: bestandsnaam, content: pdf }],
        }),
      });
      basecone = r.ok ? "verstuurd" : `mislukt: ${await r.text()}`;
    }

    // 5. Vastleggen. Bij een proef niet: er is niets verstuurd dat telt.
    if (!proef) {
      await fetch(`${SB_URL}/rest/v1/verkoopfacturen?id=eq.${id}`, {
        method: "PATCH", headers: h,
        body: JSON.stringify({
          status: "verzonden",
          verzonden_op: new Date().toISOString(),
          verzonden_naar: klant.factuur_email,
        }),
      });
      // Een creditfactuur sluit de oorspronkelijke af.
      if (fNu.credit_van) {
        await fetch(`${SB_URL}/rest/v1/verkoopfacturen?id=eq.${fNu.credit_van}`, {
          method: "PATCH", headers: h, body: JSON.stringify({ status: "gecrediteerd" }),
        });
      }
    }

    return new Response(JSON.stringify({
      ok: true, test: proef, nummer: proef ? null : nummer,
      verstuurd_naar: naarKlant[0], basecone,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return mislukt("onbekend", e instanceof Error ? e.message : "onbekende fout");
  }
});
