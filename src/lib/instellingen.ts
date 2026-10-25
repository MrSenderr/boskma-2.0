import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export type Testmodus = { aan: boolean; adres: string }

/** Bij twijfel gaan we ervan uit dat testmodus aan staat. Dezelfde regel geldt
 *  in de Edge Functions: liever een mail te weinig naar buiten dan een te veel. */
const VEILIG: Testmodus = { aan: true, adres: 'testmail@boskmafoodservice.nl' }

export function useTestmodus() {
  return useQuery({
    queryKey: ['instelling', 'testmodus'],
    queryFn: async (): Promise<Testmodus> => {
      const { data, error } = await supabase
        .from('instellingen')
        .select('waarde')
        .eq('sleutel', 'testmodus')
        .maybeSingle()
      if (error) throw new Error(error.message)
      const w = (data as { waarde?: Partial<Testmodus> } | null)?.waarde
      if (!w) return VEILIG
      return { aan: w.aan !== false, adres: w.adres || VEILIG.adres }
    },
  })
}

export function useTestmodusWijzigen() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (waarde: Testmodus) => {
      const { error } = await supabase
        .from('instellingen')
        .update({ waarde, bijgewerkt_op: new Date().toISOString() })
        .eq('sleutel', 'testmodus')
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['instelling', 'testmodus'] }),
  })
}

/* ------------------------------------------------------------- invullink --- */

export type LinkResultaat = {
  ok: boolean
  link?: string
  testmodus?: boolean
  verstuurd_naar?: string | null
  error?: string
}

/** Maakt een nieuwe invullink. Met verstuurMail=false wordt er niets gemaild en
 *  krijg je alleen de link terug, om zelf via WhatsApp te delen. */
export async function maakInvullink(
  sollicitatieId: string,
  verstuurMail: boolean,
): Promise<LinkResultaat> {
  const { data, error } = await supabase.functions.invoke('send-onboarding', {
    body: { sollicitatie_id: sollicitatieId, verstuur_mail: verstuurMail },
  })
  if (error) return { ok: false, error: error.message }
  return data as LinkResultaat
}

/* Het adres van het loonbureau, uit instellingen.loonbureau_naar.
 *
 * De serverfuncties lezen dezelfde instelling; die blijft de bron. Hier is hij
 * alleen nodig om vast te leggen waarheen iets is gegaan toen Sander het zelf
 * verstuurde. Lukt het lezen niet, dan het algemene adres — nooit een
 * contactpersoon die er misschien niet meer werkt. */
const LOONBUREAU_STANDAARD = 'info@lbwf.nl'

export function useLoonbureauAdres() {
  return useQuery({
    queryKey: ['instelling', 'loonbureau_naar'],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase
        .from('instellingen')
        .select('waarde')
        .eq('sleutel', 'loonbureau_naar')
        .maybeSingle()
      if (error) throw new Error(error.message)
      const adres = (data as { waarde?: { adres?: string } } | null)?.waarde?.adres
      return typeof adres === 'string' && adres.includes('@') ? adres : LOONBUREAU_STANDAARD
    },
  })
}
