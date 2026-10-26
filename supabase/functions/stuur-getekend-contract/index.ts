// stuur-getekend-contract
// POST { document_id }
// → Stuurt één getekend contract uit het dossier naar het loonbureau en legt
//   vast wanneer en waarheen.
//
// Wordt door de app aangeroepen direct na het uploaden van een getekend
// contract bij een medewerker van wie het loonbureau het contract opstelt, en
// met de hand vanaf het dossier of het startscherm als dat niet lukte.
//
// In testmodus gaat het naar het testadres en blijft naar_loonbureau_op leeg:
// het loonbureau weet dan nog van niets, en de app blijft dat ook zeggen.

import { wieBelt } from "../_shared/beller.ts";
import {
  CC_EMAIL, VAN_LOONBUREAU, bufNaarBase64, isOefenkaart, leesOntvanger, leesTestmodus, oefenBalk,
  service, testBalk,
} from "../_shared/loonbureau.ts";

const SB_URL     = Deno.env.get("SUPABASE_URL")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function antwoord(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function bijwerken(id: number, velden: Record<string, unknown>) {
  await fetch(`${SB_URL}/rest/v1/dossier_documenten?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...service, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(velden),
  });
}

function veiligeNaam(naam: string) {
  return naam.replace(/\s+/g, "_").replace(/[^\w-]/g, "");
}

function extensie(naam: string, mime: string | null) {
  const punt = naam.lastIndexOf(".");
  if (punt > 0) return naam.slice(punt).toLowerCase();
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return antwoord({ ok: false, error: "Method not allowed" }, 405);

  // Een getekend contract is een vertrouwelijk stuk. Alleen een beheerder mag
  // het laten versturen.
  if (!(await wieBelt(req))) return antwoord({ ok: false, error: "hier mag je niet bij" }, 403);

  let id: number;
  try {
    id = Number((await req.json())?.document_id);
  } catch {
    return antwoord({ ok: false, error: "document_id ontbreekt" }, 400);
  }
  if (!Number.isInteger(id) || id <= 0) return antwoord({ ok: false, error: "document_id ontbreekt" }, 400);

  try {
    // 1. Het document en de medewerker
    const dRes = await fetch(
      `${SB_URL}/rest/v1/dossier_documenten?id=eq.${id}` +
        `&select=id,soort,naam,pad,mime_type,vervallen_op,naar_loonbureau_op,medewerker_id,` +
        `sollicitaties(voornaam,achternaam)`,
      { headers: service },
    );
    if (!dRes.ok) throw new Error(`document lezen: ${dRes.status}`);
    const doc = (await dRes.json())?.[0];
    if (!doc) return antwoord({ ok: false, error: "Dit document bestaat niet." }, 404);
    if (doc.soort !== "contract_getekend") {
      return antwoord({ ok: false, error: "Alleen een getekend contract gaat via deze weg." }, 400);
    }
    if (doc.vervallen_op) {
      return antwoord({ ok: false, error: "Dit contract is vervallen; stuur het actuele." }, 400);
    }
    if (doc.naar_loonbureau_op) {
      // Twee keer hetzelfde stuk naar het loonbureau helpt niemand.
      return antwoord({ ok: true, al_verstuurd: true, verstuurd_op: doc.naar_loonbureau_op });
    }

    const naam = [doc.sollicitaties?.voornaam, doc.sollicitaties?.achternaam].filter(Boolean).join(" ") ||
      "medewerker";

    // 2. Het bestand, met de serversleutel zodat de bak dicht kan blijven
    const fRes = await fetch(`${SB_URL}/storage/v1/object/Documenten/${doc.pad}`, { headers: service });
    if (!fRes.ok) throw new Error(`Het bestand is niet op te halen (${fRes.status}).`);
    const inhoud = bufNaarBase64(await fRes.arrayBuffer());
    const bestandsnaam = `getekend_contract_${veiligeNaam(naam)}${extensie(doc.naam, doc.mime_type)}`;

    // 3. Versturen
    const tm = await leesTestmodus();
    const loonbureau = await leesOntvanger();

    /* Een getekend oefencontract hoort niet bij het loonbureau. Dit gaat vóór
       de testmodus: ook met de testmodus uit blijft het binnen. */
    const oefening = await isOefenkaart(doc.medewerker_id);
    const binnenhouden = tm.aan || oefening;
    const naar = oefening ? CC_EMAIL : tm.aan ? tm.adres : loonbureau;

    const mail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: VAN_LOONBUREAU,
        to: [naar],
        ...(binnenhouden ? {} : { cc: [CC_EMAIL] }),
        subject: `${oefening ? "[OEFENING] " : tm.aan ? "[TEST] " : ""}Getekend contract — ${naam}`,
        html:
          (oefening ? oefenBalk(loonbureau) : tm.aan ? testBalk(loonbureau) : "") +
          `<p>Hierbij het getekende arbeidscontract van <strong>${naam}</strong>, ` +
          `retour na ondertekening.</p>` +
          `<p>Bijgevoegd: ${bestandsnaam}</p>` +
          `<p style="color:#888;font-size:12px;margin-top:24px">Boskma Foodservice V.O.F. · ` +
          `Dorpsstraat 82, 1693 AH Wervershoof</p>`,
        attachments: [{ filename: bestandsnaam, content: inhoud }],
      }),
    });
    if (!mail.ok) throw new Error(`Verzenden mislukt: ${await mail.text()}`);

    // 4. Vastleggen. Binnengehouden post telt niet: het loonbureau heeft niets gekregen.
    if (binnenhouden) {
      await bijwerken(id, { naar_loonbureau_fout: null });
    } else {
      await bijwerken(id, {
        naar_loonbureau_op: new Date().toISOString(),
        naar_loonbureau_adres: loonbureau,
        naar_loonbureau_fout: null,
      });
    }

    return antwoord({ ok: true, testmodus: binnenhouden, oefening, verstuurd_naar: naar });
  } catch (e) {
    const fout = e instanceof Error ? e.message : String(e);
    console.error("[stuur-getekend-contract]", fout);
    await bijwerken(id, { naar_loonbureau_fout: fout.slice(0, 500) }).catch(() => {});
    return antwoord({ ok: false, error: fout }, 500);
  }
});
