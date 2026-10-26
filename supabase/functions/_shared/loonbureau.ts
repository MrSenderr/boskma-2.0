/* Wat elke mail naar het loonbureau nodig heeft: het adres, de testmodus en de
 * balk die in testmodus bovenaan staat.
 *
 * stuur-loonbureau gebruikt sinds 26 oktober 2026 bufNaarBase64 hiervandaan;
 * zijn eigen kopie ging byte voor byte en liep op het geheugen stuk. De
 * overige stukken — het adres, de testmodus, de balk — staan daar nog dubbel.
 * Die draaien en zijn goedgekeurd; overzetten kan bij de volgende keer dat die
 * functie toch open moet. */

const SB_URL     = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export const TO_STANDAARD = "info@lbwf.nl";
export const CC_EMAIL     = "sander@boskmafoodservice.nl";
export const FROM_EMAIL   = "onboarding@boskmafoodservice.nl";

/* Hoe de afzender in de inbox van het loonbureau komt te staan.
 *
 * Het adres blijft onboarding@boskmafoodservice.nl — dat is het adres dat bij
 * Resend is gecontroleerd en daar mag niet zomaar iets anders staan. Maar een
 * mail heeft naast het adres ook een naam, en die was leeg. Dan toont Outlook
 * het adres zelf, en las het loonbureau post over een arbeidscontract als
 * afkomstig van "onboarding" — alsof er een machine aan de andere kant zit in
 * plaats van de werkgever.
 *
 * Alleen voor post naar het loonbureau. Mail aan een sollicitant of een
 * medewerker gaat over iets anders en blijft zoals hij was. */
export const VAN_LOONBUREAU = `"Sander Boskma — Boskma Foodservice" <${FROM_EMAIL}>`;

export const service = { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` };

async function instelling(sleutel: string) {
  const r = await fetch(`${SB_URL}/rest/v1/instellingen?sleutel=eq.${sleutel}&select=waarde`, {
    headers: service,
  });
  if (!r.ok) throw new Error(`instellingen ${r.status}`);
  return (await r.json())?.[0]?.waarde;
}

/** Bij twijfel staat de testmodus AAN. Liever een mail te weinig naar buiten. */
export async function leesTestmodus(): Promise<{ aan: boolean; adres: string }> {
  try {
    const w = await instelling("testmodus");
    if (!w || typeof w !== "object") return { aan: true, adres: CC_EMAIL };
    return { aan: w.aan !== false, adres: w.adres || CC_EMAIL };
  } catch {
    return { aan: true, adres: CC_EMAIL };
  }
}

/** Het adres van het loonbureau, uit instellingen.loonbureau_naar. */
export async function leesOntvanger(): Promise<string> {
  try {
    const adres = (await instelling("loonbureau_naar"))?.adres;
    return typeof adres === "string" && adres.includes("@") ? adres : TO_STANDAARD;
  } catch {
    return TO_STANDAARD;
  }
}

export function testBalk(echteOntvanger: string) {
  return `<div style="background:#fff4d6;border:2px solid #b87a22;border-radius:6px;padding:12px 16px;margin:0 0 16px;font-family:Arial,sans-serif;font-size:14px;color:#5c4310">
    <strong>TESTMODUS</strong> — deze mail was bedoeld voor <strong>${echteOntvanger}</strong>.
    Het loonbureau heeft niets ontvangen.
  </div>`;
}

/* Een bestand naar base64, in blokken van tweeëndertigduizend tekens.
 *
 * Niet byte voor byte, zoals stuur-loonbureau het tot 26 oktober 2026 deed.
 * Dat gaat goed bij een kleine PDF, maar een foto van een identiteitsbewijs is
 * zo drie megabyte, en dan vraagt zo'n lus drie miljoen keer om geheugen.
 * Nagemeten op een bestand van 3,3 MB: byte voor byte 113 MB en 162 ms, in
 * blokken nul meetbare megabytes en 73 ms, met hetzelfde resultaat. Met drie
 * bijlagen liep de functie zo tegen de geheugengrens aan en kreeg je in de app
 * alleen "Edge Function returned a non-2xx status code" te zien. */
export function bufNaarBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/* Is dit een oefenkaart?
 *
 * Sinds 25 oktober 2026 staat er een testmedewerker in de personeelslijst om
 * de contractstroom mee te kunnen doorlopen. Zonder deze controle zou het
 * loonbureau bij de eerste oefening een verzoek krijgen om een contract voor
 * een verzonnen persoon op te stellen. Post over een oefenkaart gaat daarom
 * nooit naar buiten, ook niet als de testmodus uit staat.
 *
 * Bij twijfel — tabel onbereikbaar, rij weg — luidt het antwoord ja. Een mail
 * die ten onrechte binnen blijft kun je alsnog versturen; een mail die ten
 * onrechte naar het loonbureau gaat niet. */
export async function isOefenkaart(medewerkerId: string | null | undefined): Promise<boolean> {
  if (!medewerkerId) return false;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/sollicitaties?id=eq.${medewerkerId}&select=is_test`,
      { headers: service },
    );
    if (!r.ok) return true;
    const rijen = await r.json();
    if (!Array.isArray(rijen) || rijen.length === 0) return true;
    return rijen[0]?.is_test === true;
  } catch {
    return true;
  }
}

export function oefenBalk(echteOntvanger: string) {
  return `<div style="background:#e6f0f1;border:2px solid #003a41;border-radius:6px;padding:12px 16px;margin:0 0 16px;font-family:Arial,sans-serif;font-size:14px;color:#003a41">
    <strong>OEFENING</strong> — dit gaat over de testmedewerker, niet over een echt persoon.
    Deze mail was bedoeld voor <strong>${echteOntvanger}</strong> en is daar niet naartoe gegaan.
  </div>`;
}
