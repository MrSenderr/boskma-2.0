import { supabase } from './supabase'

/* Een bestand uit de beveiligde opslag openen.

   De bucket `Documenten` is niet publiek: je krijgt er alleen een adres uit dat
   een uur geldig is. Stond eerder in lib/meldingen.ts, maar meldingen bestaan
   niet meer en dossierdocumenten wel. */

export async function documentUrl(pad: string) {
  const { data, error } = await supabase.storage.from('Documenten').createSignedUrl(pad, 3600)
  if (error) throw new Error(error.message)
  return data.signedUrl
}
