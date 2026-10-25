/* Wat elke mail naar het loonbureau nodig heeft: het adres, de testmodus en de
 * balk die in testmodus bovenaan staat.
 *
 * stuur-loonbureau heeft deze stukken nog in zijn eigen bestand. Die is
 * goedgekeurd en draait; overzetten kan bij de volgende keer dat hij toch open
 * moet. */

const SB_URL     = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export const TO_STANDAARD = "info@lbwf.nl";
export const CC_EMAIL     = "sander@boskmafoodservice.nl";
export const FROM_EMAIL   = "onboarding@boskmafoodservice.nl";

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

export function bufNaarBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}
