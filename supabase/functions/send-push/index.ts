import webpush from 'npm:web-push';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

webpush.setVapidDetails(
  'mailto:sanderboskma@gmail.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const body = await req.json();
  const record = body.record; // nieuwe sollicitatie row

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = (Deno.env.get('SERVICE_ROLE_JWT') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Haal alle subscriptions op
  const res = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth`, {
    headers: { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey }
  });
  const subs = await res.json();

  const naam = record ? `${record.voornaam || ''} ${record.achternaam || ''}`.trim() : 'Nieuwe sollicitant';

  await Promise.allSettled(subs.map((s: any) =>
    webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify({
        title: '📋 Nieuwe sollicitatie',
        body: `${naam} heeft zich aangemeld`,
        url: '/#sollicitaties',
        tag: 'sollicitatie'
      })
    ).catch((err: any) => {
      // Verwijder verlopen subscriptions (410 Gone)
      if (err.statusCode === 410) {
        return fetch(`${supabaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, {
          method: 'DELETE',
          headers: { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey }
        });
      }
    })
  ));

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});