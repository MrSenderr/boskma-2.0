import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Live racedata van OpenF1, samengevat tot één compact antwoord voor het scherm.
//
// OpenF1 werkt met inloggegevens die je omwisselt voor een token dat een uur
// geldig is. Die gegevens staan als secret op de functie en komen dus niet in
// de openbare f1.html terecht:
//   supabase secrets set OPENF1_USER=... OPENF1_PASS=...
//
// Zonder gegevens antwoordt deze functie met live:false, zodat de pagina
// gewoon blijft werken.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BASIS = "https://api.openf1.org";
const USER = Deno.env.get("OPENF1_USER") ?? "";
const PASS = Deno.env.get("OPENF1_PASS") ?? "";

// OpenF1 staat 60 verzoeken per minuut toe. We verversen daarom centraal en
// bewaren de momentopname in de database, zodat het aantal aanvragen niet
// meegroeit met het aantal schermen dat meekijkt.
const VERVERS_NA_MS = 15_000;
// Na een fout (bijvoorbeeld een te hoog aanvraagtempo) rustig aan doen, anders
// blijven we tegen dezelfde muur aanlopen.
const FOUT_WACHT_MS = 30_000;
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY") ?? "";

async function leesBuffer(): Promise<{ data: any; leeftijdMs: number } | null> {
  if (!SB_URL || !SB_KEY) return null;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/f1_live_cache?id=eq.1&select=data,bijgewerkt`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
        signal: AbortSignal.timeout(5000) },
    );
    if (!r.ok) return null;
    const rijen = await r.json();
    if (!rijen.length) return null;
    return {
      data: rijen[0].data,
      leeftijdMs: Date.now() - new Date(rijen[0].bijgewerkt).getTime(),
    };
  } catch {
    return null;
  }
}

// Alleen de tijdstempel opschuiven. Doen we dit vóór het ophalen, dan zien
// gelijktijdige aanvragen een verse buffer en gaan zij niet óók verversen —
// anders vuren meerdere tegelijk hun verzoeken af en loopt het tempo over.
async function claimVerversing(): Promise<void> {
  if (!SB_URL || !SB_KEY) return;
  try {
    await fetch(`${SB_URL}/rest/v1/f1_live_cache?id=eq.1`, {
      method: "PATCH",
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ bijgewerkt: new Date().toISOString() }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* niet kritiek */ }
}

async function schrijfBuffer(data: unknown): Promise<void> {
  if (!SB_URL || !SB_KEY) return;
  try {
    await fetch(`${SB_URL}/rest/v1/f1_live_cache?id=eq.1`, {
      method: "PATCH",
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ data, bijgewerkt: new Date().toISOString() }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* buffer is een hulpmiddel, geen vereiste */ }
}

// Token en coureurslijst overleven meerdere aanroepen binnen dezelfde instantie.
let token = "";
let tokenTot = 0;
let coureursCache: { sessie: number; rijen: any[] } | null = null;

async function geefToken(vernieuw = false): Promise<string> {
  if (!vernieuw && token && Date.now() < tokenTot) return token;

  // Ook uit de database proberen: een verse omgeving heeft nog geen token in
  // het geheugen, en opnieuw inloggen kost een verzoek uit ons tempo-budget.
  if (!vernieuw) {
    const uitDb = await leesToken();
    if (uitDb) {
      token = uitDb.token;
      tokenTot = uitDb.tot;
      return token;
    }
  }

  const body = new URLSearchParams({ username: USER, password: PASS });
  const res = await fetch(`${BASIS}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new Error(`inloggen mislukt (${res.status})`);
  const d = await res.json();
  token = d.access_token;
  // Ruim voor het verlopen vernieuwen.
  tokenTot = Date.now() + Math.max(60, (d.expires_in ?? 3600) - 300) * 1000;
  await schrijfToken(token, tokenTot);
  return token;
}

async function leesToken(): Promise<{ token: string; tot: number } | null> {
  if (!SB_URL || !SB_KEY) return null;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/f1_live_cache?id=eq.1&select=token,token_tot`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
        signal: AbortSignal.timeout(5000) },
    );
    if (!r.ok) return null;
    const rijen = await r.json();
    const t = rijen[0]?.token;
    const tot = rijen[0]?.token_tot ? new Date(rijen[0].token_tot).getTime() : 0;
    if (!t || Date.now() >= tot) return null;
    return { token: t, tot };
  } catch {
    return null;
  }
}

async function schrijfToken(t: string, tot: number): Promise<void> {
  if (!SB_URL || !SB_KEY) return;
  try {
    await fetch(`${SB_URL}/rest/v1/f1_live_cache?id=eq.1`, {
      method: "PATCH",
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ token: t, token_tot: new Date(tot).toISOString() }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* niet kritiek */ }
}

async function haal(pad: string, tweedePoging = false): Promise<any[]> {
  const t = await geefToken(tweedePoging);
  const res = await fetch(`${BASIS}/v1${pad}`, {
    headers: { Authorization: `Bearer ${t}`, Accept: "application/json" },
    signal: AbortSignal.timeout(9000),
  });
  if ((res.status === 401 || res.status === 403) && !tweedePoging) {
    return haal(pad, true); // token verlopen: één keer opnieuw met een verse
  }
  if (!res.ok) throw new Error(`${pad} → ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// Van een reeks metingen per coureur alleen de nieuwste per coureur houden.
function nieuwstePerCoureur(rijen: any[]): Map<number, any> {
  const uit = new Map<number, any>();
  for (const r of rijen) {
    const nr = r.driver_number;
    const vorige = uit.get(nr);
    if (!vorige || new Date(r.date) > new Date(vorige.date)) uit.set(nr, r);
  }
  return uit;
}

function minutenTerug(min: number): string {
  return new Date(Date.now() - min * 60_000).toISOString();
}

function tijdKort(sec: number | null): string {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(3).padStart(6, "0");
  return m > 0 ? `${m}:${s}` : s;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const antwoord = (body: unknown) =>
    new Response(JSON.stringify(body), {
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=5",
      },
    });

  if (!USER || !PASS) return antwoord({ live: false, reden: "geen-gegevens" });

  // Verse momentopname in de buffer? Dan die teruggeven en OpenF1 niet belasten.
  const gebufferd = await leesBuffer();
  if (gebufferd) {
    const wasFout = gebufferd.data?.reden === "fout";
    const wachttijd = wasFout ? FOUT_WACHT_MS : VERVERS_NA_MS;
    if (gebufferd.leeftijdMs < wachttijd) return antwoord(gebufferd.data);
  }

  try {
    await claimVerversing();
    const verse = await bouwMomentopname(gebufferd?.data ?? null);
    await schrijfBuffer(verse);
    return antwoord(verse);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Liever een iets oudere momentopname dan een leeg scherm. De gegevens
    // blijven ongewijzigd; alleen de tijdstempel schuift op, zodat we niet bij
    // elke aanvraag opnieuw tegen dezelfde fout aanlopen.
    if (gebufferd?.data?.live) {
      await schrijfBuffer(gebufferd.data);
      return antwoord({ ...gebufferd.data, verouderd: true });
    }
    const fout = { live: false, reden: "fout", detail: msg };
    await schrijfBuffer(fout);
    return antwoord(fout);
  }
});

// Het totale aantal ronden zit niet in OpenF1. We leiden het af uit de race van
// vorig jaar op hetzelfde circuit: de winnaar reed de volledige afstand.
// Raceafstand per circuit. Staat niet in OpenF1, en de externe bron waar we het
// eerst uit haalden weigert aanvragen vanaf de server. Deze aantallen liggen per
// circuit vast, dus een tabel is hier betrouwbaarder dan een extra koppeling.
const RONDEN_PER_CIRCUIT: Record<string, number> = {
  sakhir: 57, jeddah: 50, melbourne: 58, suzuka: 53, shanghai: 56, miami: 57,
  imola: 63, monaco: 78, catalunya: 66, montreal: 70, spielberg: 71,
  silverstone: 52, spa: 44, hungaroring: 70, zandvoort: 72, monza: 53,
  baku: 51, singapore: 62, austin: 56, mexico: 71, interlagos: 71,
  vegas: 50, lusail: 57, "yas marina": 58,
};

function rondenUitTabel(circuit: string): number | null {
  const naam = (circuit ?? "").toLowerCase();
  for (const sleutel of Object.keys(RONDEN_PER_CIRCUIT)) {
    if (naam.includes(sleutel)) return RONDEN_PER_CIRCUIT[sleutel];
  }
  return null;
}

let rondesDiagnose = "";
async function haalTotaalRondes(datum: string): Promise<number | null> {
  try {
    const jaar = new Date(datum).getUTCFullYear();
    const r1 = await fetch(`https://api.jolpi.ca/ergast/f1/${jaar}/races/?limit=30`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!r1.ok) { rondesDiagnose = `races ${r1.status}`; return null; }
    const races = (await r1.json())?.MRData?.RaceTable?.Races ?? [];
    const dag = datum.slice(0, 10);
    const race = races.find((r: any) => r.date === dag);
    const circuit = race?.Circuit?.circuitId;
    if (!circuit) { rondesDiagnose = `geen circuit voor ${dag} (${races.length} races)`; return null; }

    const r2 = await fetch(
      `https://api.jolpi.ca/ergast/f1/${jaar - 1}/circuits/${circuit}/results/?limit=1`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (!r2.ok) { rondesDiagnose = `vorig jaar ${r2.status}`; return null; }
    const vorig = (await r2.json())?.MRData?.RaceTable?.Races ?? [];
    const rondes = parseInt(vorig[0]?.Results?.[0]?.laps ?? "", 10);
    if (!(Number.isFinite(rondes) && rondes > 10)) {
      rondesDiagnose = `geen ronden in ${jaar - 1}/${circuit}`;
      return null;
    }
    return rondes;
  } catch (e) {
    rondesDiagnose = "fout: " + (e instanceof Error ? e.message : String(e));
    return null;
  }
}

// Baanstatus uit de meldingen van de wedstrijdleiding. Blauwe vlaggen slaan we
// over: die gelden één auto die gedubbeld wordt, niet de baan.
function bepaalStatus(meldingen: any[]): { code: string; tekst: string } {
  const opTijd = [...meldingen].sort((a, b) =>
    new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime()
  );
  let status = { code: "GROEN", tekst: "Race onderweg" };
  const openSectoren = new Set<number>();

  for (const m of opTijd) {
    const bericht = String(m.message ?? "").toUpperCase();
    const vlag = String(m.flag ?? "").toUpperCase();

    if (m.category === "SafetyCar" || bericht.includes("SAFETY CAR")) {
      if (bericht.includes("IN THIS LAP") || bericht.includes("ENDING")) {
        status = { code: "GROEN", tekst: "Race onderweg" };
      } else if (bericht.includes("VIRTUAL")) {
        status = { code: "VSC", tekst: "Virtual safety car" };
      } else {
        status = { code: "SC", tekst: "Safety car" };
      }
      continue;
    }
    if (vlag === "RED") { status = { code: "ROOD", tekst: "Race stilgelegd" }; continue; }
    if (vlag === "CHEQUERED") { status = { code: "FINISH", tekst: "Race afgelopen" }; continue; }
    if (m.scope === "Sector" && typeof m.sector === "number") {
      if (vlag === "YELLOW" || vlag === "DOUBLE YELLOW") openSectoren.add(m.sector);
      if (vlag === "CLEAR") openSectoren.delete(m.sector);
      continue;
    }
    if (vlag === "GREEN" && status.code !== "ROOD") {
      status = { code: "GROEN", tekst: "Race onderweg" };
    }
  }

  if (status.code === "GROEN" && openSectoren.size) {
    return { code: "GEEL", tekst: "Gele vlag op de baan" };
  }
  return status;
}

const BAND_NL: Record<string, string> = {
  SOFT: "zachte band",
  MEDIUM: "medium band",
  HARD: "harde band",
  INTERMEDIATE: "intermediates",
  WET: "regenband",
};

// Verslagregels maken door de nieuwe stand met de vorige te vergelijken.
// Zo ontstaat een lopend verhaal zonder dat er een extra databron nodig is.
function bouwVerslag(nieuw: any[], vorig: any[], ronde: number | null,
                     nieuweSnelste: any, vorigeSnelste: any): any[] {
  const regels: any[] = [];
  const nu = new Date().toISOString();
  const voegToe = (tekst: string, soort: string) =>
    regels.push({ ronde, tijd: nu, tekst, soort });

  if (!vorig.length) return regels;

  const vorigOp = new Map<number, any>();
  for (const r of vorig) vorigOp.set(r.nummer, r);
  const nieuwOpPositie = new Map<number, any>();
  for (const r of nieuw) nieuwOpPositie.set(r.positie, r);

  // Nieuwe leider
  const leider = nieuw.find((r) => r.positie === 1);
  const oudeLeider = vorig.find((r) => r.positie === 1);
  if (leider && oudeLeider && leider.nummer !== oudeLeider.nummer) {
    voegToe(`${leider.code} aan de leiding, voorbij ${oudeLeider.code}`, "leiding");
  }

  for (const r of nieuw) {
    const v = vorigOp.get(r.nummer);
    if (!v) continue;

    // Pitstop: het aantal stops is opgelopen
    if ((r.pits ?? 0) > (v.pits ?? 0)) {
      // Soms is de bandkeuze nog niet doorgegeven; dan die toevoeging weglaten.
      const bandNaam = r.band ? BAND_NL[r.band] : null;
      const band = bandNaam ? ` en gaat op de ${bandNaam}` : "";
      voegToe(`${r.code} komt naar binnen${band}`, "pit");
      continue; // niet ook als positieverlies melden
    }

    // Inhaalactie: plek gewonnen, en we weten wie er nu achter ligt
    if (r.positie < v.positie && r.positie > 1) {
      const ingehaald = nieuwOpPositie.get(r.positie + 1);
      if (ingehaald && (vorigOp.get(ingehaald.nummer)?.positie ?? 0) < v.positie) {
        voegToe(`${r.code} gaat voorbij ${ingehaald.code} — nu P${r.positie}`, "inhaal");
      } else {
        voegToe(`${r.code} klimt naar P${r.positie}`, "inhaal");
      }
    }
  }

  // Nieuwe snelste ronde van de sessie
  if (nieuweSnelste && (!vorigeSnelste || nieuweSnelste.tijd !== vorigeSnelste.tijd)) {
    voegToe(`Snelste ronde: ${nieuweSnelste.code} ${nieuweSnelste.tijd}`, "snelste");
  }

  return regels;
}

async function bouwMomentopname(vorige: any): Promise<any> {
    const sessies = await haal("/sessions?session_key=latest");
    const sessie = sessies[0];
    if (!sessie) return { live: false, reden: "geen-sessie" };

    // Live van 5 minuten voor de start tot 15 minuten na het einde.
    const nu = Date.now();
    const start = new Date(sessie.date_start).getTime();
    const eind = new Date(sessie.date_end).getTime();
    if (!(nu > start - 5 * 60_000 && nu < eind + 15 * 60_000)) {
      return {
        live: false,
        reden: "sessie-niet-actief",
        sessie: { naam: sessie.session_name, locatie: sessie.location },
      };
    }

    // Coureurs veranderen niet binnen een sessie: één keer ophalen is genoeg.
    if (!coureursCache || coureursCache.sessie !== sessie.session_key) {
      coureursCache = { sessie: sessie.session_key, rijen: await haal("/drivers?session_key=latest") };
    }
    const coureurs = coureursCache.rijen;

    // Posities over de hele sessie: een coureur die niet van plek wisselt komt
    // in een kort tijdvenster niet voor, en zou dan uit het klassement vallen.
    const [posities, intervallen, rondes] = await Promise.all([
      haal("/position?session_key=latest"),
      haal(`/intervals?session_key=latest&date>=${minutenTerug(3)}`),
      haal("/laps?session_key=latest"),
    ]);
    // Even wachten tussen de groepen: de API staat 6 verzoeken per seconde toe.
    await new Promise((r) => setTimeout(r, 400));
    const [stints, weer, pitstops, meldingen] = await Promise.all([
      haal("/stints?session_key=latest"),
      haal(`/weather?session_key=latest&date>=${minutenTerug(20)}`),
      haal("/pit?session_key=latest"),
      haal("/race_control?session_key=latest"),
    ]);

    const perNr = new Map<number, any>();
    for (const c of coureurs) perNr.set(c.driver_number, c);

    const laatstePos = nieuwstePerCoureur(posities);
    const laatsteInt = nieuwstePerCoureur(intervallen);

    // Laatste stint per coureur = de band die er nu onder ligt.
    const huidigeStint = new Map<number, any>();
    for (const s of stints) {
      const vorige = huidigeStint.get(s.driver_number);
      if (!vorige || (s.stint_number ?? 0) >= (vorige.stint_number ?? 0)) {
        huidigeStint.set(s.driver_number, s);
      }
    }

    // Aantal pitstops per coureur.
    const pits = new Map<number, number>();
    for (const p of pitstops) {
      pits.set(p.driver_number, (pits.get(p.driver_number) ?? 0) + 1);
    }

    // Per coureur: laatste voltooide ronde, eigen beste ronde en topsnelheid.
    // De ronde die nog loopt heeft nog geen tijd, die slaan we over.
    const laatsteRonde = new Map<number, number>();
    const besteRonde = new Map<number, number>();
    const topsnelheid = new Map<number, number>();
    const laatsteRondeNr = new Map<number, number>();

    let ronde: number | null = null;
    let snelste: { nr: number; tijd: number } | null = null;

    for (const r of rondes) {
      const nr = r.driver_number;
      if (typeof r.lap_number === "number" && (ronde === null || r.lap_number > ronde)) {
        ronde = r.lap_number;
      }
      const d = r.lap_duration;
      if (typeof d === "number" && d > 0) {
        if (!snelste || d < snelste.tijd) snelste = { nr, tijd: d };
        const best = besteRonde.get(nr);
        if (best === undefined || d < best) besteRonde.set(nr, d);
        const vorigeNr = laatsteRondeNr.get(nr) ?? -1;
        if ((r.lap_number ?? 0) >= vorigeNr) {
          laatsteRondeNr.set(nr, r.lap_number ?? 0);
          laatsteRonde.set(nr, d);
        }
      }
      if (typeof r.st_speed === "number" && r.st_speed > 0) {
        const t = topsnelheid.get(nr);
        if (t === undefined || r.st_speed > t) topsnelheid.set(nr, r.st_speed);
      }
    }

    const klassement = [...laatstePos.values()]
      .sort((a, b) => a.position - b.position)
      .map((p) => {
        const nr = p.driver_number;
        const c = perNr.get(nr) ?? {};
        const i = laatsteInt.get(nr) ?? {};
        const st = huidigeStint.get(nr);
        // Bandleeftijd: ronden op deze set, plus de ronden die er al op zaten.
        const leeftijd = st && ronde
          ? Math.max(0, ronde - (st.lap_start ?? ronde)) + (st.tyre_age_at_start ?? 0)
          : null;
        const best = besteRonde.get(nr);
        return {
          positie: p.position,
          nummer: nr,
          code: c.name_acronym ?? String(nr),
          naam: c.full_name ?? "",
          team: c.team_name ?? "",
          land: c.country_code ?? null,
          kleur: c.team_colour ? "#" + String(c.team_colour).replace(/^#/, "") : null,
          achterstand: i.gap_to_leader ?? null,
          interval: i.interval ?? null,
          band: st?.compound ?? null,
          bandLeeftijd: leeftijd,
          laatsteRonde: tijdKort(laatsteRonde.get(nr) ?? null),
          besteRonde: tijdKort(best ?? null),
          isSnelste: snelste ? snelste.nr === nr : false,
          pits: pits.get(nr) ?? 0,
          top: topsnelheid.get(nr) ?? null,
        };
      });

    const w = weer[weer.length - 1];
    const snelsteCoureur = snelste ? perNr.get(snelste.nr) : null;
    const snelsteRonde = snelste
      ? {
          code: snelsteCoureur?.name_acronym ?? String(snelste.nr),
          tijd: tijdKort(snelste.tijd),
        }
      : null;

    // Totaal aantal ronden hoeft maar één keer per sessie opgezocht te worden.
    const zelfdeSessie = vorige?.sessieKey === sessie.session_key;
    const totaalRondes = (zelfdeSessie && vorige?.totaalRondes)
      ? vorige.totaalRondes
      : (rondenUitTabel(sessie.circuit_short_name) ??
         await haalTotaalRondes(sessie.date_start));

    const status = bepaalStatus(meldingen);

    // Verwacht einde: resterende ronden maal het recente rondetempo. Alleen bij
    // een race zinvol, en niet tijdens een neutralisatie (dan klopt het tempo niet).
    let verwachtEinde: string | null = null;
    if (totaalRondes && ronde && ronde < totaalRondes && sessie.session_type === "Race") {
      const recente = rondes
        .filter((r: any) => typeof r.lap_duration === "number" && r.lap_duration > 0)
        .slice(-40)
        .map((r: any) => r.lap_duration)
        .sort((a: number, b: number) => a - b);
      const mediaan = recente.length ? recente[Math.floor(recente.length / 2)] : null;
      if (mediaan) {
        verwachtEinde = new Date(Date.now() + (totaalRondes - ronde) * mediaan * 1000)
          .toISOString();
      }
    }

    // Verslag: nieuwe regels vooraan, en samen met de vorige bewaren.
    const vorigKlassement = Array.isArray(vorige?.klassement) ? vorige.klassement : [];
    const vorigVerslag = Array.isArray(vorige?.verslag) ? vorige.verslag : [];
    const nieuweRegels = bouwVerslag(
      klassement, vorigKlassement, ronde, snelsteRonde, vorige?.snelsteRonde ?? null,
    );
    const verslag = [...nieuweRegels.reverse(), ...vorigVerslag].slice(0, 14);

    return {
      live: true,
      verslag,
      sessie: {
        naam: sessie.session_name ?? "",
        type: sessie.session_type ?? "",
        locatie: sessie.location ?? "",
        land: sessie.country_name ?? "",
      },
      sessieKey: sessie.session_key,
      ronde,
      totaalRondes,
      rondesDiagnose: totaalRondes ? undefined : rondesDiagnose,
      verwachtEinde,
      status,
      snelsteRonde,
      klassement,
      weer: w
        ? {
            lucht: w.air_temperature ?? null,
            baan: w.track_temperature ?? null,
            regen: w.rainfall ?? null,
            vocht: w.humidity ?? null,
          }
        : null,
    };
}
