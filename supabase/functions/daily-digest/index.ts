// Daily digest e-mail — elke ochtend 07:00 Amsterdam
// Triggered via cron-job.org met Supabase anon key als Authorization header

const RESEND_KEY  = Deno.env.get('RESEND_API_KEY')!;
const SB_URL      = Deno.env.get('SUPABASE_URL')!;
const SB_KEY      = (Deno.env.get('SERVICE_ROLE_JWT') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const TO_EMAIL    = 'sander@boskmafoodservice.nl';
const FROM_EMAIL  = 'noreply@boskmafoodservice.nl';

// ── Datum-helpers (altijd Amsterdam-tijd) ──────────────────────────────────
function toAmsDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam',
    year:'numeric', month:'2-digit', day:'2-digit' }).format(d);
}
function today(): string { return toAmsDate(new Date()); }
function yesterday(): string {
  const d = new Date(); d.setDate(d.getDate() - 1); return toAmsDate(d);
}
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z'); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysUntil(dateStr: string): number {
  const t = today();
  const ms = new Date(dateStr+'T12:00:00Z').getTime() - new Date(t+'T12:00:00Z').getTime();
  return Math.round(ms / 86400000);
}
function fDate(s: string): string {
  if (!s) return '–';
  const [y,m,d] = s.split('-');
  const months = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`;
}
function fEuro(n: number): string {
  return '€ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function dayName(dateStr: string): string {
  const days = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
  return days[new Date(dateStr+'T12:00:00Z').getDay()];
}

// ── Deadline-items genereren (replica van getDeadlines in de app) ──────────
interface DlItem { date: string; label: string; urgency: 'rood'|'oranje'|'blauw'|'groen'; }

function buildDeadlines(data: any, sols: any[]): DlItem[] {
  const t = today();
  const cfg = data.settings || {};
  const cWarn = cfg.contractWarnDays ?? 60;
  const cUrg  = cfg.contractUrgentDays ?? 30;
  const dWarn = cfg.docWarnDays ?? 60;
  const dUrg  = cfg.docUrgentDays ?? 14;
  const eWarn = cfg.empContractWarnDays ?? 60;
  const eUrg  = cfg.empContractUrgentDays ?? 30;
  const mDays = cfg.equipMaintenanceDays ?? 30;
  const oWarn = cfg.olieWarnDays ?? 30;

  const items: DlItem[] = [];
  const add = (date: string, label: string, urgency: DlItem['urgency']) => {
    if (date >= t) items.push({ date, label, urgency });
  };

  // Taken
  (data.tasks || []).filter((t: any) => !t.done && t.due).forEach((t: any) => {
    const d = daysUntil(t.due);
    if (d <= 14)
      add(t.due, `Taak: ${t.title}`, t.prio === 'urgent' ? 'rood' : t.prio === 'hoog' ? 'oranje' : 'blauw');
  });

  // Contracten
  (data.contracts || []).filter((c: any) => !c.gearchiveerd).forEach((c: any) => {
    if (c.endDate) {
      const d = daysUntil(c.endDate);
      if (d >= 0 && d <= cWarn)
        add(c.endDate, `Contract verloopt: ${c.name}`, d <= cUrg ? 'rood' : 'oranje');
    }
    if (c.actionDate) {
      const d = daysUntil(c.actionDate);
      if (d >= 0 && d <= cWarn)
        add(c.actionDate, `Actiedatum contract: ${c.name}`, d <= cUrg ? 'rood' : 'oranje');
    }
  });

  // Documenten
  (data.documents || []).filter((d: any) => !d.gearchiveerd && d.expiry).forEach((d: any) => {
    const days = daysUntil(d.expiry);
    if (days >= 0 && days <= dWarn)
      add(d.expiry, `Document verloopt: ${d.name}`, days <= dUrg ? 'rood' : 'oranje');
    if (d.categorie === 'keuring' && d.toestand === 'in_aanvraag' && d.geplandDatum) {
      const days2 = daysUntil(d.geplandDatum);
      if (days2 >= 0 && days2 <= 30)
        add(d.geplandDatum, `Keuring gepland: ${d.name}${d.geplandTijd ? ' om ' + d.geplandTijd : ''}`, 'blauw');
    }
  });

  // Medewerkers
  (data.employees || []).filter((e: any) => e.status === 'actief').forEach((e: any) => {
    // Contract
    if (e.contractEnd) {
      const d = daysUntil(e.contractEnd);
      if (d >= 0 && d <= eWarn)
        add(e.contractEnd, `Contract ${e.name} verloopt`, d <= eUrg ? 'rood' : 'oranje');
    }
    // Verjaardag (komende 14 dagen)
    if (e.birthDate) {
      const birth = new Date(e.birthDate + 'T12:00:00Z');
      const thisYear = new Date().getFullYear();
      for (const yr of [thisYear, thisYear + 1]) {
        const nb = new Date(yr, birth.getMonth(), birth.getDate());
        const nbStr = nb.toISOString().slice(0, 10);
        const d = daysUntil(nbStr);
        if (d >= 0 && d <= 14) {
          const age = yr - birth.getFullYear();
          add(nbStr, `🎂 Verjaardag ${e.name} (${age} jaar)`, 'groen');
          break;
        }
      }
    }
    // Proefperiode
    (e.contractHistory || []).forEach((c: any) => {
      if (!c.proefperiode || c.proefperiode < t) return;
      const d = daysUntil(c.proefperiode);
      if (d >= 0 && d <= 14)
        add(c.proefperiode, `⏱ Proefperiode ${e.name} eindigt`, 'blauw');
    });
    // Herinneringen
    (e.reminders || []).forEach((r: any) => {
      if (!r.date) return;
      const d = daysUntil(r.date);
      if (d >= 0 && d <= 14)
        add(r.date, `🔔 ${e.name}: ${r.title}`, 'oranje');
    });
  });

  // Apparatuur
  (data.equipment || []).forEach((e: any) => {
    if (e.plannedServiceDate) {
      const d = daysUntil(e.plannedServiceDate);
      if (d >= 0 && d <= 30)
        add(e.plannedServiceDate, `Afspraak servicebedrijf: ${e.name}`, 'blauw');
    }
    (e.history || []).forEach((h: any) => {
      if (h.type === 'Afspraak' && h.plannedDate) {
        const d = daysUntil(h.plannedDate);
        if (d >= 0 && d <= 30)
          add(h.plannedDate, `Afspraak ${e.name}${h.plannedTime ? ' om ' + h.plannedTime : ''}`, 'blauw');
      }
    });
  });

  // Frituurolie
  const activeOlie = (data.oliePrijzen || []).find((o: any) =>
    (!o.startDate || o.startDate <= t) && (!o.endDate || o.endDate >= t));
  if (activeOlie?.endDate) {
    const d = daysUntil(activeOlie.endDate);
    if (d >= 0 && d <= oWarn)
      add(activeOlie.endDate, `Prijsafspraak frituurolie verloopt`, d <= 7 ? 'rood' : 'oranje');
  }

  // Sollicitaties te jong
  sols.filter((s: any) => s.status === 'te_jong' && s.geboortedatum).forEach((s: any) => {
    const birth = new Date(s.geboortedatum + 'T12:00:00Z');
    const sixteenth = new Date(birth.getFullYear() + 15, birth.getMonth(), birth.getDate());
    const sixStr = sixteenth.toISOString().slice(0, 10);
    const d = daysUntil(sixStr);
    if (d >= 0 && d <= 30)
      add(sixStr, `${s.voornaam} ${s.achternaam} wordt 15 – eerder aangemeld als te jong`, 'oranje');
  });

  return items.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Urgente alerts (gebaseerd op dashboard-logica) ─────────────────────────
function buildAlerts(data: any): string[] {
  const alerts: string[] = [];
  (data.equipment || []).filter((e: any) => e.status === 'defect')
    .forEach((e: any) => alerts.push(`🔴 ${e.name} is defect – reparatie noodzakelijk`));
  (data.storingen || []).filter((s: any) => s.status !== 'opgelost' && s.priority === 'urgent')
    .forEach((s: any) => alerts.push(`🔴 Urgente storing: ${s.title}`));
  (data.employees || []).filter((e: any) => e.status === 'actief' && !e.contractEnd && !e.contractStart)
    .forEach((e: any) => alerts.push(`⚠️ ${e.name} heeft geen actief contract`));
  return alerts;
}

// ── HTML e-mail opbouwen ───────────────────────────────────────────────────
function buildHtml(data: any, sols: any[], todayStr: string, yesterdayStr: string): string {
  const deadlines = buildDeadlines(data, sols);
  const alerts = buildAlerts(data);
  const in7days = addDays(todayStr, 7);

  const todayItems  = deadlines.filter(d => d.date === todayStr);
  const week7Items  = deadlines.filter(d => d.date > todayStr && d.date <= in7days);
  const laterItems  = deadlines.filter(d => d.date > in7days && daysUntil(d.date) <= 30);

  // Omzet gisteren
  const gisteren = (data.revData || []).find((r: any) => r.date === yesterdayStr);
  const totaal = gisteren ? (gisteren.pin || 0) + (gisteren.contant || 0) + (gisteren.online || 0) : null;

  // Taken
  const openTaken = (data.tasks || []).filter((t: any) => !t.done);
  const overdueTask = openTaken.filter((t: any) => t.due && t.due < todayStr);
  const todayTaken  = openTaken.filter((t: any) => t.due === todayStr);

  // Storingen open
  const openStoringen = (data.storingen || []).filter((s: any) => s.status !== 'opgelost');

  // Sollicitaties
  const nieuweSol = sols.filter((s: any) => s.status === 'nieuw');
  const inProc    = sols.filter((s: any) => ['eerste_contact','introductie_gepland','dienst_meegedraaid'].includes(s.status));

  const urgColor: Record<string, string> = {
    rood: '#ef4444', oranje: '#f97316', blauw: '#3b82f6', groen: '#10b981'
  };
  const urgBg: Record<string, string> = {
    rood: '#fef2f2', oranje: '#fff7ed', blauw: '#eff6ff', groen: '#f0fdf4'
  };

  function dlRow(item: DlItem): string {
    const d = daysUntil(item.date);
    const tag = d === 0 ? 'vandaag' : d === 1 ? 'morgen' : `over ${d} dagen`;
    return `<tr>
      <td style="padding:7px 12px;border-bottom:1px solid #cdbfa0;font-size:14px;font-family:Georgia,'Times New Roman',serif;color:#2c1f0e">${item.label}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #cdbfa0;font-size:13px;color:#6b5a3e;white-space:nowrap;font-family:Georgia,'Times New Roman',serif">${fDate(item.date)}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #cdbfa0;text-align:right">
        <span style="background:${urgBg[item.urgency]};color:${urgColor[item.urgency]};border-radius:99px;padding:2px 10px;font-size:12px;font-weight:600;font-family:Georgia,'Times New Roman',serif">${tag}</span>
      </td>
    </tr>`;
  }

  function section(icon: string, title: string, body: string, accent = '#1d6e72'): string {
    return `<div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid ${accent}">
        <span style="font-size:20px">${icon}</span>
        <h2 style="margin:0;font-size:16px;font-weight:700;color:#2c1f0e;font-family:Georgia,'Times New Roman',serif">${title}</h2>
      </div>
      ${body}
    </div>`;
  }

  function emptyNote(msg: string): string {
    return `<p style="margin:0;font-size:14px;color:#a89272;font-style:italic;font-family:Georgia,'Times New Roman',serif">${msg}</p>`;
  }

  // ── Sectie: Agenda vandaag ──
  const agendaVandaag = todayItems.length === 0
    ? emptyNote('Niets gepland voor vandaag.')
    : `<table style="width:100%;border-collapse:collapse">${todayItems.map(dlRow).join('')}</table>`;

  // ── Sectie: Komende 7 dagen ──
  const agenda7 = week7Items.length === 0
    ? emptyNote('Niets bijzonders komende week.')
    : `<table style="width:100%;border-collapse:collapse">${week7Items.map(dlRow).join('')}</table>`;

  // ── Sectie: Later (8-30 dgn) ──
  const agendaLater = laterItems.length > 0
    ? `<table style="width:100%;border-collapse:collapse">${laterItems.map(dlRow).join('')}</table>`
    : '';

  // ── Sectie: Urgente alerts ──
  const alertsHtml = alerts.length === 0 ? '' : section('🚨', 'Actie vereist',
    `<ul style="margin:0;padding:0 0 0 20px">${alerts.map(a =>
      `<li style="font-size:14px;color:#2c1f0e;margin-bottom:6px;font-family:Georgia,'Times New Roman',serif">${a}</li>`).join('')}</ul>`,
    '#ef4444'
  );

  // ── Sectie: Omzet gisteren ──
  const omzetHtml = section('📊', `Omzet ${dayName(yesterdayStr)} ${fDate(yesterdayStr)}`,
    gisteren
      ? `<div style="display:flex;gap:16px;flex-wrap:wrap">
          <div style="background:#f7edd8;border-radius:6px;padding:12px 20px;text-align:center;min-width:90px">
            <div style="font-size:22px;font-weight:700;color:#c8953a;font-family:Georgia,'Times New Roman',serif">${fEuro(totaal!)}</div>
            <div style="font-size:12px;color:#6b5a3e;margin-top:2px;font-family:Georgia,'Times New Roman',serif">Totaal</div>
          </div>
          <div style="background:#f7edd8;border-radius:6px;padding:12px 20px;text-align:center;min-width:90px">
            <div style="font-size:18px;font-weight:600;color:#2c1f0e;font-family:Georgia,'Times New Roman',serif">${fEuro(gisteren.pin || 0)}</div>
            <div style="font-size:12px;color:#6b5a3e;margin-top:2px;font-family:Georgia,'Times New Roman',serif">Pin</div>
          </div>
          <div style="background:#f7edd8;border-radius:6px;padding:12px 20px;text-align:center;min-width:90px">
            <div style="font-size:18px;font-weight:600;color:#2c1f0e;font-family:Georgia,'Times New Roman',serif">${fEuro(gisteren.contant || 0)}</div>
            <div style="font-size:12px;color:#6b5a3e;margin-top:2px;font-family:Georgia,'Times New Roman',serif">Contant</div>
          </div>
          <div style="background:#f7edd8;border-radius:6px;padding:12px 20px;text-align:center;min-width:90px">
            <div style="font-size:18px;font-weight:600;color:#2c1f0e;font-family:Georgia,'Times New Roman',serif">${fEuro(gisteren.online || 0)}</div>
            <div style="font-size:12px;color:#6b5a3e;margin-top:2px;font-family:Georgia,'Times New Roman',serif">Online</div>
          </div>
        </div>`
      : emptyNote('Geen omzet ingevoerd voor gisteren.')
  );

  // ── Sectie: Taken ──
  const takenBody = openTaken.length === 0
    ? emptyNote('Geen open taken. 🎉')
    : `${overdueTask.length > 0 ? `<p style="margin:0 0 8px;font-size:13px;color:#ef4444;font-weight:600;font-family:Georgia,'Times New Roman',serif">⚠️ ${overdueTask.length} verlopen taak${overdueTask.length > 1 ? 'en' : ''}:</p>
      <ul style="margin:0 0 12px;padding:0 0 0 20px">${overdueTask.map((t: any) =>
        `<li style="font-size:14px;color:#2c1f0e;margin-bottom:4px;font-family:Georgia,'Times New Roman',serif">${t.title} <span style="color:#ef4444;font-size:12px">(${fDate(t.due)})</span></li>`).join('')}</ul>` : ''}
      ${todayTaken.length > 0 ? `<p style="margin:0 0 8px;font-size:13px;color:#c8953a;font-weight:600;font-family:Georgia,'Times New Roman',serif">Vandaag af:</p>
      <ul style="margin:0 0 12px;padding:0 0 0 20px">${todayTaken.map((t: any) =>
        `<li style="font-size:14px;color:#2c1f0e;margin-bottom:4px;font-family:Georgia,'Times New Roman',serif">${t.title}</li>`).join('')}</ul>` : ''}
      <p style="margin:0;font-size:13px;color:#6b5a3e;font-family:Georgia,'Times New Roman',serif">${openTaken.length} open taken totaal</p>`;

  const takenHtml = section('✅', 'Taken', takenBody);

  // ── Sectie: Sollicitaties ──
  const solBody = nieuweSol.length === 0 && inProc.length === 0
    ? emptyNote('Geen openstaande sollicitaties.')
    : `${nieuweSol.length > 0 ? `<p style="margin:0 0 6px;font-size:14px;color:#2c1f0e;font-family:Georgia,'Times New Roman',serif"><strong>${nieuweSol.length} nieuwe</strong> sollicitatie${nieuweSol.length > 1 ? 's' : ''} wacht${nieuweSol.length === 1 ? '' : 'en'} op beoordeling:</p>
      <ul style="margin:0 0 10px;padding:0 0 0 20px">${nieuweSol.map((s: any) =>
        `<li style="font-size:14px;color:#2c1f0e;margin-bottom:3px;font-family:Georgia,'Times New Roman',serif">${s.voornaam} ${s.achternaam}</li>`).join('')}</ul>` : ''}
      ${inProc.length > 0 ? `<p style="margin:0;font-size:13px;color:#6b5a3e;font-family:Georgia,'Times New Roman',serif">${inProc.length} sollicitant${inProc.length > 1 ? 'en' : ''} in procedure</p>` : ''}`;

  const solHtml = section('👥', 'Sollicitaties', solBody);

  // ── Sectie: Storingen ──
  const storingenHtml = openStoringen.length > 0
    ? section('🔧', 'Open storingen',
        `<ul style="margin:0;padding:0 0 0 20px">${openStoringen.map((s: any) =>
          `<li style="font-size:14px;color:#2c1f0e;margin-bottom:5px;font-family:Georgia,'Times New Roman',serif">${s.title}
            <span style="font-size:12px;color:${s.priority === 'urgent' ? '#ef4444' : '#f97316'};margin-left:6px;font-weight:600">${s.priority || ''}</span>
          </li>`).join('')}</ul>`,
        '#f97316')
    : '';

  const dayNow = dayName(todayStr);
  const dayFmt = dayNow.charAt(0).toUpperCase() + dayNow.slice(1);

  return `<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ede0c4;font-family:Georgia,'Times New Roman',serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ede0c4;padding:32px 16px">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;border-collapse:separate;border-spacing:0">

        <!-- Header -->
        <tr>
          <td style="background:#1d6e72;padding:28px 32px 24px;border-radius:4px 4px 0 0">
            <div style="font-size:11px;color:rgba(245,237,224,.65);margin-bottom:4px;text-transform:uppercase;letter-spacing:.1em;font-family:Georgia,'Times New Roman',serif">Dagelijks overzicht</div>
            <div style="width:36px;height:1px;background:#c8953a;margin:8px 0"></div>
            <div style="font-size:24px;font-weight:600;color:#f5ead4;font-family:Georgia,'Times New Roman',serif">Goedemorgen Sander! ☀️</div>
            <div style="font-size:14px;color:rgba(245,237,224,.75);margin-top:6px;font-family:Georgia,'Times New Roman',serif">${dayFmt} ${fDate(todayStr)}</div>
          </td>
        </tr>

        <!-- Gold stripe -->
        <tr><td style="background:#c8953a;height:3px;line-height:3px;font-size:3px">&nbsp;</td></tr>

        <!-- Body -->
        <tr>
          <td style="background:#f5ead4;padding:28px 32px">
            ${alerts.length > 0 ? alertsHtml : ''}
            ${section('📅', 'Agenda vandaag', agendaVandaag)}
            ${week7Items.length > 0 ? section('📆', 'Komende 7 dagen', agenda7) : ''}
            ${agendaLater ? section('🔮', 'Komende maand', agendaLater, '#8b5cf6') : ''}
            ${omzetHtml}
            ${takenHtml}
            ${solHtml}
            ${storingenHtml}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#1d6e72;padding:16px 32px;border-radius:0 0 4px 4px;text-align:center">
            <a href="https://app.boskmafoodservice.nl" style="color:rgba(245,237,224,.85);font-size:13px;font-weight:600;text-decoration:none;font-family:Georgia,'Times New Roman',serif">→ Open de Boskma app</a>
            <div style="font-size:11px;color:rgba(245,237,224,.5);margin-top:4px;font-family:Georgia,'Times New Roman',serif">Snackerie 't Zonnetje · automatisch gegenereerd</div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ── Handler ────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Dagelijkse opruiming van ID-kopieën. In een eigen try zodat het
  // dagoverzicht gewoon doorgaat als dit misgaat.
  try {
    const opruim = await fetch(`${SB_URL}/functions/v1/ruim-id-kopieen-op`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
    });
    console.log('[digest] opruimen ID-kopieën:', opruim.status, (await opruim.text()).slice(0, 200));
  } catch (e) {
    console.error('[digest] opruimen ID-kopieën mislukt:', e);
  }

  // Data ophalen
  const [stateRes, solRes] = await Promise.all([
    fetch(`${SB_URL}/rest/v1/boskma_state?id=eq.1&select=data`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    }),
    fetch(`${SB_URL}/rest/v1/sollicitaties?select=*`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    })
  ]);

  const stateRows = await stateRes.json();
  const sols: any[] = await solRes.json();
  const data = stateRows?.[0]?.data ?? {};

  const todayStr     = today();
  const yesterdayStr = yesterday();
  const html         = buildHtml(data, sols, todayStr, yesterdayStr);
  const dayFmt       = dayName(todayStr);

  // Versturen via Resend
  const mailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to:   [TO_EMAIL],
      subject: `☀️ Dagoverzicht ${dayFmt.charAt(0).toUpperCase() + dayFmt.slice(1)} ${todayStr.slice(8,10)}-${todayStr.slice(5,7)}`,
      html
    })
  });

  const result = await mailRes.json();
  if (!mailRes.ok) {
    console.error('[daily-digest] Resend fout:', result);
    return new Response(JSON.stringify({ error: result }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, id: result.id }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
