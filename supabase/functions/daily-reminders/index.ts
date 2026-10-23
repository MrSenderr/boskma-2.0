import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TODOIST_TOKEN = Deno.env.get('TODOIST_TOKEN')!
const SB_URL        = Deno.env.get('SUPABASE_URL')!
const SB_KEY        = (Deno.env.get('SERVICE_ROLE_JWT') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

// ── Helpers ────────────────────────────────────────────────────────────────────

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function daysUntil(s: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((new Date(s + 'T00:00:00').getTime() - today.getTime()) / 86_400_000)
}

function nlDate(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function nextOccurrence(birthDate: string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const monthDay = birthDate.slice(4)
  let year = today.getFullYear()
  let d = new Date(`${year}${monthDay}T00:00:00`)
  if (d < today) d = new Date(`${year + 1}${monthDay}T00:00:00`)
  return dateStr(d)
}

// ── Todoist ────────────────────────────────────────────────────────────────────

async function createTask(content: string, dueDate: string, priority = 2) {
  const resp = await fetch('https://api.todoist.com/api/v1/tasks', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TODOIST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content, due_date: dueDate, priority }),
  })
  if (!resp.ok) console.error(`Todoist fout (${resp.status}):`, await resp.text())
}

// ── Hoofdlogica ────────────────────────────────────────────────────────────────

Deno.serve(async () => {
  try {
    const sb = createClient(SB_URL, SB_KEY)
    const { data, error } = await sb.from('boskma_state').select('data').eq('id', 1).single()
    if (error) throw error

    const state          = data.data
    const employees      = (state.employees      || []) as any[]
    const contracts      = (state.contracts      || []) as any[]
    const otherContracts = (state.otherContracts || []) as any[]
    const documents      = (state.documents      || []) as any[]
    const equipment      = (state.equipment      || []) as any[]

    const today    = new Date(); today.setHours(0, 0, 0, 0)
    const todayStr = dateStr(today)
    const thisYear = today.getFullYear()

    const queue: Array<{ content: string; dueDate: string; priority?: number }> = []

    // ── Verjaardagen: taak 5 dagen van tevoren, vervaldatum op de dag zelf ──
    for (const emp of employees) {
      if (!emp.birthDate || emp.status === 'archief') continue
      const next = nextOccurrence(emp.birthDate)
      if (daysUntil(next) !== 5) continue
      const age = thisYear - parseInt(emp.birthDate.slice(0, 4))
      queue.push({
        content:  `🎂 Verjaardag ${emp.name} (${age} jaar) — ${nlDate(next)}`,
        dueDate:  next,
        priority: 2,
      })
    }

    // ── Jubilea: 1, 2, 5, 10, 25 jaar — taak 5 dagen van tevoren ──
    const jubJaren = [1, 2, 5, 10, 25]
    for (const emp of employees) {
      if (emp.status === 'archief') continue
      const start = emp.currentContractStart || emp.contractStart
      if (!start) continue
      const startYear     = parseInt(start.slice(0, 4))
      const startMonthDay = start.slice(4)
      for (const j of jubJaren) {
        const jubDate = `${startYear + j}${startMonthDay}`
        if (daysUntil(jubDate) !== 5) continue
        queue.push({
          content:  `🏆 Jubileum ${emp.name} — ${j} jaar in dienst op ${nlDate(jubDate)}`,
          dueDate:  jubDate,
          priority: 2,
        })
      }
    }

    // ── Medewerkercontracten: herinnering 60, 30 en 15 dagen voor einde ──
    for (const emp of employees) {
      if (!emp.contractEnd || emp.status === 'archief') continue
      const d = daysUntil(emp.contractEnd)
      if (d !== 60 && d !== 30 && d !== 15) continue
      queue.push({
        content:  `📋 Contract ${emp.name} verloopt over ${d} dagen — ${nlDate(emp.contractEnd)}`,
        dueDate:  todayStr,
        priority: d <= 15 ? 3 : 2,
      })
    }

    // ── Keuringen: 30, 14 en 7 dagen voor verloopdatum ──
    for (const doc of documents) {
      if (doc.categorie !== 'keuring' || !doc.expiry || doc.toestand === 'gearchiveerd') continue
      const d = daysUntil(doc.expiry)
      if (d !== 30 && d !== 14 && d !== 7) continue
      const eq = equipment.find((e: any) => e.id === doc.equipmentId)
      const naam = eq ? `${eq.name} — ${doc.name}` : doc.name
      queue.push({
        content:  `🔧 Keuring "${naam}" verloopt over ${d} dagen — ${nlDate(doc.expiry)}`,
        dueDate:  todayStr,
        priority: d <= 7 ? 3 : 2,
      })
    }

    // ── Bedrijfscontracten: 30 en 7 dagen vóór het begin van de opzegtermijn ──
    for (const con of [...contracts, ...otherContracts]) {
      if (!con.endDate || con.gearchiveerd) continue
      const noticeDays = con.noticeDays || 30
      const noticeStart = new Date(con.endDate + 'T00:00:00')
      noticeStart.setDate(noticeStart.getDate() - noticeDays)
      const daysToDeadline = Math.round((noticeStart.getTime() - today.getTime()) / 86_400_000)
      if (daysToDeadline !== 30 && daysToDeadline !== 7) continue
      queue.push({
        content:  `⚠️ "${con.name}" — nog ${daysToDeadline} dagen om op te zeggen (opzegtermijn ${noticeDays} dgn, eindigt ${nlDate(con.endDate)})`,
        dueDate:  todayStr,
        priority: daysToDeadline === 7 ? 3 : 2,
      })
    }

    if (queue.length === 0) {
      return new Response(JSON.stringify({ ok: true, created: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    await Promise.all(queue.map(t => createTask(t.content, t.dueDate, t.priority)))

    return new Response(JSON.stringify({ ok: true, created: queue.length, items: queue.map(t => t.content) }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
})
