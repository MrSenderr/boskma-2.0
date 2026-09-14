import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  console.log('[notify] Functie aangeroepen');
  try {
    const payload = await req.json()
    console.log('[notify] Payload ontvangen:', JSON.stringify(payload).slice(0, 300));
    const record = payload.record
    if (!record) { console.error('[notify] Geen record in payload'); return new Response('no record', { status: 400 }); }

    // Alleen echte sollicitaties via werkenbij melden. Een medewerker die
    // rechtstreeks wordt toegevoegd of uit de oude app is overgenomen is geen
    // sollicitatie, en daar hoeft geen mail over.
    if (record.fase && record.fase !== 'sollicitant') {
      console.log('[notify] fase =', record.fase, '- geen melding verstuurd');
      return new Response('overgeslagen: geen sollicitant', { status: 200 });
    }

    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) { console.error('[notify] RESEND_API_KEY niet gevonden!'); return new Response('no api key', { status: 500 }); }
    console.log('[notify] API key gevonden, mail versturen...');

    const naam = `${record.voornaam} ${record.achternaam}`
    const leeftijd = berekenLeeftijd(record.geboortedatum)
    const teJong = leeftijd < 16

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Werkenbij Snackerie <noreply@boskmafoodservice.nl>',
        to: ['sander@boskmafoodservice.nl'],
        subject: teJong ? `Aanmelding te jong: ${naam}` : `Nieuwe sollicitatie: ${naam}`,
        html: `
          <h2>${teJong ? '⚠️ Aanmelding — nog te jong' : '✅ Nieuwe sollicitatie'}</h2>
          <table style="font-family:sans-serif;font-size:14px">
            <tr><td style="padding:6px 12px;color:#666">Naam</td><td style="padding:6px 12px"><strong>${naam}</strong></td></tr>
            <tr><td style="padding:6px 12px;color:#666">Geboortedatum</td><td style="padding:6px 12px">${record.geboortedatum}${teJong ? ` (${leeftijd} jaar)` : ''}</td></tr>
            <tr><td style="padding:6px 12px;color:#666">Telefoon</td><td style="padding:6px 12px">${record.telefoonnummer}</td></tr>
            <tr><td style="padding:6px 12px;color:#666">E-mail</td><td style="padding:6px 12px">${record.email}</td></tr>
            <tr><td style="padding:6px 12px;color:#666">Voorkeusdagen</td><td style="padding:6px 12px">${(record.voorkeur_dagen || []).join(', ') || '–'}</td></tr>
          </table>
        `
      })
    })

    const resText = await res.text()
    console.log('[notify] Resend response:', res.status, resText)

    return new Response(JSON.stringify({ ok: res.ok, status: res.status }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('[notify] Fout:', String(err))
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})

function berekenLeeftijd(geboortedatum: string): number {
  const today = new Date()
  const birth = new Date(geboortedatum)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}