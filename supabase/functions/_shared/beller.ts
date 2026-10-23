/* Wie belt er aan bij een serverfunctie?
 *
 * Supabase controleert met verify_jwt alleen dát er een geldige sleutel
 * meekomt. De publieke anon-sleutel is er zo een, en die staat in elke browser
 * die de app opent. "Beveiligd" betekent daarmee in de praktijk "open" — en bij
 * verify_jwt = false is er helemaal niets.
 *
 * Een functie die namens Sander post verstuurt, een factuurnummer uitdeelt of
 * een invullink aanmaakt hoort daarom zelf te vragen wie er aanbelt. Dat doet
 * deze module, op één plek, zodat het overal hetzelfde werkt.
 *
 * Er wordt niets hardgecodeerd: de database weet wie beheerder is
 * (is_app_user), en dat blijft de enige plek waar dat staat.
 */

const SB_URL  = Deno.env.get("SUPABASE_URL")!;
const ANON    = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SERVICE_ROLE_JWT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export type Beller =
  /** Een ingelogde beheerder. `token` is zijn sleutel, om namens hem te lezen. */
  | { soort: "beheerder"; email: string; token: string }
  /** Een andere serverfunctie, met de sleutel van de server. */
  | { soort: "server" };

/** Geeft null als de beller er niet bij mag. */
export async function wieBelt(
  req: Request,
  opties: { serverMag?: boolean } = {},
): Promise<Beller | null> {
  const token = req.headers.get("Authorization") ?? "";
  if (!token) return null;

  /* Een aanroep van een andere serverfunctie. Die heeft de serversleutel, en
     wie die heeft kan toch al alles — het is geen extra recht, alleen een
     andere weg naar binnen. */
  if (opties.serverMag && token === `Bearer ${SERVICE}`) return { soort: "server" };

  const wie = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: token },
  });
  if (!wie.ok) return null;
  const email = (await wie.json())?.email;
  if (!email) return null;

  const mag = await fetch(`${SB_URL}/rest/v1/rpc/is_app_user`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: token, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!mag.ok || (await mag.json()) !== true) return null;

  return { soort: "beheerder", email: String(email), token };
}
