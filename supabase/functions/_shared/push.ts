/* Een pushbericht naar één persoon.
 *
 * Tot nu toe gingen alle meldingen naar Sander: kim-push stuurt naar elk
 * apparaat met voor_kim = true, send-push naar álle apparaten. Een
 * contractvoorstel is de eerste melding die naar een medewerker gaat, en dan
 * moet je weten wélk apparaat van wie is.
 *
 * Dat staat al in de tabel: push_subscriptions.email wordt gevuld met het
 * mailadres uit het token van degene die het abonnement aanmaakte, en een
 * medewerker wordt in de hele app op datzelfde adres herkend
 * (huidige_medewerker). Hier wordt dus niets nieuws verzonnen.
 *
 * De apparaten van Kim blijven buiten beeld: dat is de tablet in de zaak, en
 * een voorstel voor één medewerker hoort niet op een scherm waar iedereen
 * langsloopt.
 *
 * kim-push en send-push hebben nog hun eigen kopie van deze code. Die zijn niet
 * meeverhuisd omdat ze werken en er niets aan verandert; dit is de plek waar
 * het heen gaat als er een derde bij komt.
 */

import webpush from "npm:web-push@3.6.7";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const h = {
  apikey: SB_SERVICE,
  Authorization: `Bearer ${SB_SERVICE}`,
  "Content-Type": "application/json",
};

export type Bericht = { title: string; body: string; url: string; tag: string };

let vapidKlaar = false;

/* De sleutels staan in Vault. Hier worden ze alleen gelezen, niet aangemaakt:
   kim-push maakt ze de eerste keer aan, en twee plekken die sleutels kunnen
   maken is één plek te veel. */
async function zorgVoorVapid(): Promise<boolean> {
  if (vapidKlaar) return true;
  const r = await fetch(`${SB_URL}/rest/v1/rpc/push_vapid_ophalen`, {
    method: "POST",
    headers: h,
    body: "{}",
  });
  if (!r.ok) return false;
  const k = await r.json();
  if (!k?.public || !k?.private) return false;
  webpush.setVapidDetails("mailto:sander@boskmafoodservice.nl", k.public, k.private);
  vapidKlaar = true;
  return true;
}

/** Stuurt het bericht naar alle apparaten van dit mailadres. Geeft terug
 *  hoeveel apparaten er waren en hoeveel het haalden; nul apparaten is geen
 *  fout, maar wel iets wat de aanroeper hoort te weten. */
export async function pushNaar(
  email: string,
  bericht: Bericht,
): Promise<{ apparaten: number; gelukt: number }> {
  if (!email || !(await zorgVoorVapid())) return { apparaten: 0, gelukt: 0 };

  const q = new URLSearchParams({
    email: `eq.${email.toLowerCase()}`,
    voor_kim: "eq.false",
    select: "endpoint,p256dh,auth",
  });
  const r = await fetch(`${SB_URL}/rest/v1/push_subscriptions?${q}`, { headers: h });
  if (!r.ok) return { apparaten: 0, gelukt: 0 };
  const subs = (await r.json()) as { endpoint: string; p256dh: string; auth: string }[];

  const uitkomst = await Promise.allSettled(
    subs.map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(bericht),
        )
        .catch(async (err: { statusCode?: number }) => {
          // Een telefoon die de app heeft weggegooid: abonnement opruimen.
          if (err.statusCode === 404 || err.statusCode === 410) {
            await fetch(
              `${SB_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`,
              { method: "DELETE", headers: h },
            );
          }
          throw err;
        }),
    ),
  );

  return {
    apparaten: subs.length,
    gelukt: uitkomst.filter((u) => u.status === "fulfilled").length,
  };
}
