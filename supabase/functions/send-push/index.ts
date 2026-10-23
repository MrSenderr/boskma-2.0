import webpush from 'npm:web-push';

// Push bij een nieuwe sollicitatie. Aangeroepen door de trigger nieuwe-sollicitatie-push.
// 30-09-2026: VAPID-sleutels komen nu uit Vault (push_vapid_ophalen), dezelfde als kim-push.
// De oude VAPID_PRIVATE_KEY in de secrets was ongeldig.
// 30-09-2026: de melding wees naar /#sollicitaties, een adres uit de oude app. In
// boskma-2.0 opent hij nu de kaart van de sollicitant zelf (/personeel/<id>), niet
// de lijst — je tikt op de melding omdat je die ene persoon wilt zien. En de tag was
// voor elke melding gelijk, waardoor een tweede sollicitatie de eerste van het
// scherm duwde.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
// SERVICE_ROLE_JWT eerst: SUPABASE_SERVICE_ROLE_KEY heeft het nieuwe sb_secret-formaat
// en dat weigert PostgREST. Zelfde regel als in alle andere functies hier.
const supabaseKey = (Deno.env.get('SERVICE_ROLE_JWT') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const h = { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey, 'Content-Type': 'application/json' };

let vapidKlaar = false;
async function zorgVoorVapid() {
  if (vapidKlaar) return true;
  const r = await fetch(`${supabaseUrl}/rest/v1/rpc/push_vapid_ophalen`, { method: 'POST', headers: h, body: '{}' });
  const k = r.ok ? await r.json() : null;
  if (!k?.public || !k?.private) return false; // nog geen sleutels: kim-push maakt ze aan
  webpush.setVapidDetails('mailto:sanderboskma@gmail.com', k.public, k.private);
  vapidKlaar = true;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!(await zorgVoorVapid())) {
    return new Response(JSON.stringify({ ok: false, error: 'geen VAPID-sleutels in Vault' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const body = await req.json();
  const record = body.record; // nieuwe sollicitatie row

  // Haal alle subscriptions op
  const res = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth`, { headers: h });
  const subs = await res.json();

  const naam = record ? `${record.voornaam || ''} ${record.achternaam || ''}`.trim() : 'Nieuwe sollicitant';

  await Promise.allSettled(subs.map((s: any) =>
    webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify({
        title: '📋 Nieuwe sollicitatie',
        body: `${naam} heeft zich aangemeld`,
        // Rechtstreeks naar zijn kaart. Zonder nummer valt hij terug op de lijst.
        url: record?.id ? `/personeel/${record.id}` : '/personeel',
        // Eigen tag per sollicitatie: anders vervangt de tweede melding de eerste
        // en mis je er een als je even niet kijkt.
        tag: `sollicitatie-${record?.id ?? Date.now()}`
      })
    ).catch((err: any) => {
      // Verwijder verlopen subscriptions (404/410)
      if (err.statusCode === 404 || err.statusCode === 410) {
        return fetch(`${supabaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, {
          method: 'DELETE',
          headers: h
        });
      }
    })
  ));

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
