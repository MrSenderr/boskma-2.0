/* Pushberichten aanzetten op dit apparaat.

   Twee soorten: de meldingen van Kim (die gaan naar de tablet in de zaak) en
   de meldingen voor jezelf, zoals een contractvoorstel. Het verschil zit in
   één vlag, voor_kim, en in wie ze mag zetten: alleen een beheerder. Een
   medewerker kan alleen zijn eigen apparaat aanmelden, en dat regelt de
   database (policy eigen_abonnementen), niet deze code.

   Heette tot 25 oktober 2026 kimpush.ts, toen de meldingen alleen voor Kim
   waren.

   Twee dingen om te weten:

   - meldingenAan() moet uit een tik komen. iOS weigert de toestemmingsvraag
     als die niet direct uit een klik van de gebruiker volgt.
   - Op iPhone werkt het alleen als de app via Safari → Deel → "Zet op
     beginscherm" is geïnstalleerd en vanaf dat icoon wordt geopend.

   De VAPID-sleutel staat niet in deze code: die wordt opgehaald via
   rpc push_public_key, die hem uit Supabase Vault leest. */

import { supabase } from './supabase'

export type Meldingstand = 'aan' | 'uit' | 'niet-ondersteund' | 'geweigerd'

export async function meldingenStatus(): Promise<Meldingstand> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'niet-ondersteund'
  if (Notification.permission === 'denied') return 'geweigerd'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg && (await reg.pushManager.getSubscription())
  return sub ? 'aan' : 'uit'
}

export async function meldingenAan(voorKim = false): Promise<Meldingstand> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error(
      'Dit apparaat kan geen pushberichten ontvangen. Op iPhone: zet de app op je beginscherm en open hem vanaf dat icoon.',
    )
  }

  const { data: sleutel, error: sleutelfout } = await supabase.rpc('push_public_key')
  if (sleutelfout || !sleutel) throw new Error('Kon de pushsleutel niet ophalen. Ben je ingelogd?')

  const toestemming = await Notification.requestPermission()
  if (toestemming !== 'granted') {
    throw new Error('Meldingen staan uit. Zet ze aan in de instellingen van je telefoon.')
  }

  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64NaarBytes(sleutel as string),
    }))

  const j = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: j.endpoint,
      p256dh: j.keys!.p256dh,
      auth: j.keys!.auth,
      voor_kim: voorKim,
      apparaat: navigator.userAgent.slice(0, 120),
    },
    { onConflict: 'endpoint' },
  )
  /* Een apparaat kan één abonnement hebben. Staat er al een van iemand anders
     — de tablet van Kim, of een vorige gebruiker van dit toestel — dan houdt
     de database het tegen, en dat hoort leesbaar te zijn. */
  if (error) {
    if (/row-level security|policy/i.test(error.message)) {
      throw new Error(
        'Dit apparaat is al voor iemand anders aangemeld. Zet de meldingen aan op je eigen telefoon.',
      )
    }
    throw new Error(`Opslaan mislukt: ${error.message}`)
  }
  return 'aan'
}

export async function meldingenUit(): Promise<Meldingstand> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg && (await reg.pushManager.getSubscription())
  if (!sub) return 'uit'
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
  return 'uit'
}

/** De sleutel komt als tekst binnen, de browser wil bytes. Bewust over een
 *  eigen ArrayBuffer: alleen dan accepteert de browsertypering hem. */
function base64NaarBytes(b64: string): Uint8Array<ArrayBuffer> {
  const opvulling = '='.repeat((4 - (b64.length % 4)) % 4)
  const ruw = atob((b64 + opvulling).replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(ruw.length))
  for (let i = 0; i < ruw.length; i += 1) bytes[i] = ruw.charCodeAt(i)
  return bytes
}
