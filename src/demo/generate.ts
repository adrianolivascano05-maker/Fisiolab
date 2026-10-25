// La clínica de prueba (src/demo/README.md): cientos de pacientes inventados, con su historia, su agenda y sus cobros,
// para probar la app con volumen y ver cómo responde. Se crea con las mismas funciones que usa la app (las notas de
// los cuestionarios y las mediciones salen de sus cálculos de siempre) y se borra entera de una vez. Solo en una
// clínica sin pacientes: así nunca se mezcla con pacientes de verdad.
import { marksFromFrames } from "../calc/results";
import { getMovement } from "../calc/rom";
import { formatMarks, type Mark, type Symptom } from "../clinical/bodyMap";
import { loadCatalog, parseCoded, makeEntry } from "../clinical/cif/cif";
import { usableForm, type QuestionForm } from "../clinical/forms";
import { getKind, mapScore, psfsScore } from "../clinical/questionnaires";
import { consentContext } from "../consent/context";
import { buildSections, templateById } from "../consent/templates";
import { PRECAUTIONS } from "../consent/precautions";
import { createAppointment, markConfirmed, markReminded, type AppointmentStatus } from "../data/appointments";
import { addPayment, createPack, expiryOf, getPackPresets, getPricing, setPackPresets, setSessionPrice, type Method } from "../data/billing";
import { saveAnamnesisOf, saveFinding, saveQuestionnaire, saveSession, type Answers } from "../data/clinical";
import { saveSignedConsent } from "../data/consents";
import { createClosure } from "../data/closures";
import type { Db } from "../data/db";
import { createEpisode, updateEpisode } from "../data/episodes";
import { memberKey } from "../data/member";
import { getClinic, savePatientPrivacy, saveClinic } from "../data/privacy";
import type { Statement } from "../data/protocol";
import { createJumpTest, createPatient, createRomTest, saveMarksAndCompute, saveVideo, type Patient, type Sex } from "../data/repo";
import { createShift, ensureStaff, removeStaff } from "../data/schedule";
import { addToWaitlist } from "../data/waitlist";
import { tests as GALLERY } from "../gallery/data";
import { atMinutes } from "../schedule/layout";
import * as C from "./cases";
import { DEMO_KEY, DEMO_PATIENTS, demoState, type DemoMarker, type DemoMode } from "./state";

export { demoState, type DemoMarker, type DemoMode } from "./state";

export type DemoSummary = { patients: number; appointments: number; sessions: number; staff: number; waitlist: number; ms: number };
export type DemoProgress = (text: string, done: number, total: number) => void;

const PRICING_KEY = "billing_pricing";
const PACKS_KEY = "billing_pack_presets";
const CLINIC_KEY = "clinic_privacy";
const MODE_KEY = "clinic_mode";
const SLOT = 45;
/** Turnos de 6 horas: de mañana o de tarde, 8 citas de 45 minutos cada uno. */
const SHIFTS = [
  { from: 8 * 60 + 30, to: 14 * 60 + 30 },
  { from: 14 * 60 + 30, to: 20 * 60 + 30 },
];
const SLOTS = 8;
const DAY_MS = 86_400_000;

// ---------- Azar con semilla (las pruebas salen siempre igual) ----------

function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!;
  const chance = (p: number) => next() < p;
  const some = <T>(list: readonly T[], n: number): T[] => [...list].sort(() => next() - 0.5).slice(0, n);
  return { next, int, pick, chance, some };
}
type Rng = ReturnType<typeof rng>;

// ---------- Días, en la hora del dispositivo como la agenda ----------

const pad = (n: number) => String(n).padStart(2, "0");
const dayOfDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return dayOfDate(new Date(y, m - 1, d + n));
}
/** 1 lunes … 7 domingo. */
function weekday(day: string): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return ((new Date(y, m - 1, d).getDay() + 6) % 7) + 1;
}
/** El último día del mes siguiente al de `day`. */
function endOfNextMonth(day: string): string {
  const [y, m] = day.split("-").map(Number) as [number, number];
  return dayOfDate(new Date(y, m + 1, 0));
}

// ---------- Escritura por lotes ----------

/**
 * La base con las escrituras guardadas en lotes grandes: miles de altas en unas pocas transacciones. Las lecturas van
 * a la base y no ven lo que aún no se ha escrito, así que aquí solo se usan funciones que escriben sin leer antes (o
 * cuya lectura no importa para unos datos nuevos), y las que leen van después de `flush`.
 */
function batched(db: Db, size = 3000) {
  let queue: Statement[] = [];
  const flush = async () => {
    if (!queue.length) return;
    const q = queue;
    queue = [];
    await db.transaction(q);
  };
  const wrapped: Db = {
    query: (sql, bind) => db.query(sql, bind),
    transaction: async (statements) => {
      queue.push(...statements);
      if (queue.length >= size) await flush();
    },
    exportBytes: () => db.exportBytes(),
    importBytes: (b) => db.importBytes(b),
    info: () => db.info(),
    snapshot: () => db.snapshot(),
    merge: (b, m) => db.merge(b, m),
    pending: () => db.pending(),
    apply: (i, s) => db.apply(i, s),
    wipe: () => db.wipe(),
  };
  return { db: wrapped, flush };
}

async function rawSetting(db: Db, key: string): Promise<string | null> {
  const [row] = await db.query<{ value: string }>("select value from settings where key = ?", [key]);
  return row?.value ?? null;
}

// ---------- Cuestionarios con la nota de la app ----------

/** Rellena un cuestionario de la app con respuestas de una gravedad (0 bien … 1 muy mal) y lo puntúa con su fórmula. */
export function fillForm(form: QuestionForm, kindBetter: "higher" | "lower", severity: number, r: Rng) {
  // Preguntas con variantes de las que se contesta una (la 8a, 8b u 8c del VISA): si hace falta, solo la primera.
  let skip = new Set<string>();
  const answer = (level: number, noise: boolean) => {
    const a: Record<string, number> = {};
    for (const s of form.sections)
      for (const it of s.items) {
        if (skip.has(it.id)) continue;
        const jitter = noise ? (r.next() - 0.5) * 0.35 : 0;
        const l = Math.max(0, Math.min(1, level + jitter));
        if (it.options?.length) a[it.id] = it.options[Math.round(l * (it.options.length - 1))]!.value;
        else if (it.scale) a[it.id] = Math.round(it.scale.from + l * (it.scale.to - it.scale.from));
        else if (it.input) a[it.id] = Math.round(it.input.min + l * (it.input.max - it.input.min));
      }
    return a;
  };
  const scoreOf = (a: Record<string, number>) => {
    try {
      return form.score(a).score;
    } catch {
      return null;
    }
  };
  // Si las primeras respuestas de cada pregunta son las buenas o las malas, se ve puntuando los dos extremos.
  let low = scoreOf(answer(0, false));
  let high = scoreOf(answer(1, false));
  if (low === null || high === null) {
    skip = new Set(form.sections.flatMap((s) => s.items.map((it) => it.id)).filter((id) => /^\d+[b-z]$/i.test(id)));
    low = scoreOf(answer(0, false));
    high = scoreOf(answer(1, false));
  }
  if (low === null || high === null || low === high) return null;
  const worseIsHigh = kindBetter === "lower";
  const level = (high > low) === worseIsHigh ? severity : 1 - severity;
  const answers = answer(level, true);
  try {
    const out = form.score(answers);
    if (out.score === null) return null;
    return { score: out.score, details: { answers, ...(out.subscores ? { subscores: out.subscores } : {}), ...(out.text ? { text: out.text } : {}) } };
  } catch {
    return null;
  }
}

// ---------- La clínica de prueba ----------

type Fisio = { email: string; name: string; shift: (typeof SHIFTS)[number] };
type Visit = { startsAt: string; day: string; status: AppointmentStatus; id: string };

/**
 * Crea la clínica de prueba. `me`: quien la carga (en una clínica, también atiende, como uno más del equipo). Solo en
 * una clínica sin pacientes. Si algo falla a medias, borra lo que ya había creado.
 */
export async function generateDemo(
  realDb: Db,
  opts: { mode: DemoMode; me?: { email: string; name: string } | null; clinicName?: string; now?: Date; seed?: number; onProgress?: DemoProgress },
): Promise<DemoSummary> {
  const started = Date.now();
  const state = await demoState(realDb);
  if (state.marker) throw new RangeError("Esta clínica ya tiene los datos de prueba. Bórralos antes de volver a cargarlos.");
  if (state.patients > 0)
    throw new RangeError(`Esta clínica ya tiene ${state.patients === 1 ? "1 paciente" : `${state.patients} pacientes`}. Los datos de prueba solo se cargan en una clínica vacía, para no mezclarlos con pacientes de verdad.`);

  const r = rng(opts.seed ?? Date.now());
  const now = opts.now ?? new Date();
  const today = dayOfDate(now);
  // Historia: dos meses atrás; en el modo estrés, seis (más citas, sesiones y cobros que cargar).
  const pastDays = opts.mode === "stress" ? 182 : 56;
  const from = addDays(today, -pastDays);
  const until = endOfNextMonth(today);
  const total = DEMO_PATIENTS[opts.mode];
  const progress = opts.onProgress ?? (() => {});
  const marker: DemoMarker = { v: 1, mode: opts.mode, createdAt: now.toISOString(), patients: [], staff: [], shifts: [], closures: [], previous: {} };
  const meKey = memberKey("professional");
  const calendarKey = memberKey("calendar_auto");
  for (const k of [PRICING_KEY, PACKS_KEY, CLINIC_KEY, MODE_KEY, meKey, calendarKey]) marker.previous[k] = await rawSetting(realDb, k);

  const { db, flush } = batched(realDb);
  const summary: DemoSummary = { patients: 0, appointments: 0, sessions: 0, staff: 0, waitlist: 0, ms: 0 };
  try {
    progress("Preparando la clínica", 0, total);
    // El equipo: quien carga los datos y cinco fisios inventados, con turnos de mañana o de tarde.
    const me = opts.me?.email ? { email: opts.me.email.trim().toLowerCase(), name: opts.me.name } : null;
    const people = [...(me ? [me] : []), ...C.STAFF];
    for (const p of C.STAFF) {
      const before = await realDb.query("select 1 from staff where email = ?", [p.email]);
      await ensureStaff(realDb, p.email, p.name);
      if (!before.length) marker.staff.push(p.email);
    }
    if (me) await ensureStaff(realDb, me.email, me.name, true);
    const fisios: Fisio[] = people.map((p, i) => ({ email: p.email, name: p.name, shift: SHIFTS[i % 2]! }));
    summary.staff = fisios.length;

    // Lo de la clínica, solo si está vacío: nombre, precio de la sesión, bonos y modo con equipo.
    const clinic = await getClinic(realDb);
    if (!clinic.name) await saveClinic(realDb, { ...clinic, name: opts.clinicName?.trim() || "Clínica de prueba", email: clinic.email || "recepcion@example.com" });
    if (!(await getPricing(realDb)).periods.length) await setSessionPrice(realDb, 4000, addDays(from, -30));
    if (!(await getPackPresets(realDb)).length)
      await setPackPresets(realDb, [
        { id: "b5", title: "Bono 5 sesiones", sessions: 5, priceCents: 18000, months: 3 },
        { id: "b10", title: "Bono 10 sesiones", sessions: 10, priceCents: 34000, months: 6 },
      ]);
    // Las citas inventadas no van al Google Calendar de verdad de quien las carga (src/cloud/googleCalendar.ts): en esta
    // clínica queda desactivado, aunque ya hubiera dado el permiso. Al borrar, vuelve a como estaba.
    if (me) {
      const saved = marker.previous[calendarKey] ? (JSON.parse(marker.previous[calendarKey]!) as Record<string, unknown>) : {};
      await realDb.transaction([
        { sql: "insert into settings (key, value) values (?, ?) on conflict (key) do update set value = excluded.value", bind: [calendarKey, JSON.stringify({ names: "initials", ...saved, enabled: false })] },
      ]);
    }
    if (marker.previous[MODE_KEY] === JSON.stringify("solo")) await realDb.transaction([{ sql: "update settings set value = ? where key = ?", bind: [JSON.stringify("team"), MODE_KEY] }]);
    const pricing = await getPricing(realDb);
    const presets = await getPackPresets(realDb);
    const clinicInfo = await getClinic(realDb);

    // Días de trabajo (de lunes a viernes) y turnos de cada fisio, semana a semana.
    const days: string[] = [];
    for (let d = from; d <= until; d = addDays(d, 1)) if (weekday(d) <= 5) days.push(d);
    const firstMonday = addDays(from, 1 - weekday(from));
    const weeks = Math.ceil((Date.parse(`${until}T12:00`) - Date.parse(`${firstMonday}T12:00`)) / (7 * DAY_MS));
    for (const f of fisios)
      for (let w = 0; w < 5; w++) {
        const day = addDays(firstMonday, w);
        marker.shifts.push(...(await createShift(db, { staffEmail: f.email, startsAt: atMinutes(day, f.shift.from), endsAt: atMinutes(day, f.shift.to), note: "" }, weeks)));
      }
    // Vacaciones de una fisio: dos días del mes que viene, sin citas.
    const off = new Set<string>();
    const nextDays = days.filter((d) => d > addDays(today, 7));
    const holidayFisio = fisios.find((f) => f.email === C.STAFF[2]!.email)!;
    if (nextDays.length > 6) {
      const d1 = nextDays[r.int(0, nextDays.length - 3)]!;
      const d2 = nextDays[nextDays.indexOf(d1) + 1]!;
      off.add(`${holidayFisio.email}|${d1}`).add(`${holidayFisio.email}|${d2}`);
      marker.closures.push(await createClosure(db, { staffEmail: holidayFisio.email, startsAt: atMinutes(d1, 0), endsAt: atMinutes(addDays(d2, 1), 0), note: "Vacaciones" }, me?.email ?? ""));
    }

    // La agenda: huecos libres de cada fisio por día.
    const taken = new Set<string>();
    const book = (f: Fisio, target: string, slot: number): { day: string; startsAt: string } | null => {
      for (let tries = 0, day = target; tries < 6 && day <= until; tries++, day = addDays(day, 1)) {
        if (weekday(day) > 5 || off.has(`${f.email}|${day}`)) continue;
        const order = [slot, ...Array.from({ length: SLOTS }, (_, i) => i).filter((i) => i !== slot).sort((a, b) => Math.abs(a - slot) - Math.abs(b - slot))];
        for (const s of order) {
          const key = `${f.email}|${day}|${s}`;
          if (taken.has(key)) continue;
          taken.add(key);
          return { day, startsAt: atMinutes(day, f.shift.from + s * SLOT) };
        }
      }
      return null;
    };

    const catalog = await loadCatalog();
    const titleOf = new Map(catalog.map((e) => [e.code, e.title]));
    const usedNames = new Set<string>();
    const usedPhones = new Set<number>();
    const sportsPatients: { id: string; sessions: string[] }[] = [];
    const closeFirst: { id: string; at: string }[] = [];
    const nowIso = now.toISOString();
    const caseWeights = C.CASES.flatMap((c) => Array<C.DemoCase>(["lumbalgia", "cervicalgia", "hombro"].includes(c.id) ? 3 : c.id === "esguince" || c.id === "rotuliana" ? 2 : 1).fill(c));

    // El plan de cada paciente: su motivo, cuándo empieza (la mayoría ya en tratamiento; algunos, nuevos de este mes o
    // del que viene), cuántas sesiones, a qué hora suele venir y cada cuánto (dos por semana al principio, después una).
    const endOfMonth = addDays(dayOfDate(new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1)), -1);
    const horizon = Math.round((Date.parse(until) - Date.parse(today)) / DAY_MS);
    const plans = Array.from({ length: total }, () => {
      const k = r.pick(caseWeights);
      const roll = r.next();
      // En el modo estrés, más pacientes nuevos que empiezan ya: el mes que viene se llena y el resto espera hueco.
      const [past, soon] = opts.mode === "stress" ? [0.5, 0.65] : [0.72, 0.82];
      const startDay = roll < past ? addDays(today, -r.int(1, pastDays)) : roll < soon ? addDays(today, r.int(0, 7)) : addDays(today, r.int(8, Math.max(9, horizon - 3)));
      const planned = r.int(k.sesiones[0], k.sesiones[1]);
      const gaps = Array.from({ length: planned }, (_, v) => (v < 3 ? r.pick([3, 4]) : 7));
      let nextMonth = 0;
      for (let v = 0, d = startDay; v < planned && d <= until; d = addDays(d, gaps[v]!), v++) if (d > endOfMonth) nextMonth++;
      return { k, startDay, planned, slot: r.int(0, SLOTS - 1), gaps, nextMonth, fisio: null as Fisio | null };
    });
    // Reparto equitativo: los que vienen el mes que viene, de más a menos citas, a quien menos lleva ese mes; los demás,
    // a quien menos pacientes tiene.
    const load = new Map(fisios.map((f) => [f.email, { patients: 0, next: 0 }]));
    const L = (f: Fisio) => load.get(f.email)!;
    for (const p of plans.filter((x) => x.nextMonth > 0).sort((a, b) => b.nextMonth - a.nextMonth)) {
      const f = [...fisios].sort((a, b) => L(a).next - L(b).next || L(a).patients - L(b).patients)[0]!;
      p.fisio = f;
      L(f).next += p.nextMonth;
      L(f).patients++;
    }
    for (const p of plans.filter((x) => !x.fisio)) {
      const f = [...fisios].sort((a, b) => L(a).patients - L(b).patients)[0]!;
      p.fisio = f;
      L(f).patients++;
    }

    for (let i = 0; i < total; i++) {
      if (i % 10 === 0) progress("Creando pacientes", i, total);
      const { k, startDay, planned, slot, gaps } = plans[i]!;
      const fisio = plans[i]!.fisio!;
      const sex: Sex = r.chance(0.52) ? "female" : "male";
      let name = "";
      do name = `${r.pick(sex === "female" ? C.FEMALE : C.MALE)} ${r.pick(C.SURNAMES)} ${r.pick(C.SURNAMES)}`;
      while (usedNames.has(name));
      usedNames.add(name);
      let phone = 0;
      do phone = r.int(0, 999);
      while (usedPhones.has(phone) && usedPhones.size < 1000);
      usedPhones.add(phone);
      const age = r.int(k.age[0], k.age[1]);
      const birth = new Date(now.getFullYear() - age, r.int(0, 11), r.int(1, 28));
      const heightCm = sex === "female" ? r.int(152, 178) : r.int(165, 192);
      const side = r.chance(0.5) ? "d" : "i";
      const lado = (fem = k.femenino) => (side === "d" ? (fem ? "derecha" : "derecho") : fem ? "izquierda" : "izquierdo");
      const fill = (s: string) => s.replaceAll("{lado}", lado());
      const t = (list: string[]) => fill(r.pick(list));

      const pid = await createPatient(db, {
        name,
        birthDate: dayOfDate(birth),
        sex,
        bodyMassKg: Math.round((heightCm - 100) * (sex === "female" ? 0.9 : 1) + r.int(-8, 14)),
        heightCm,
        legLengthCm: null,
        pushOffDistanceCm: null,
        notes: r.chance(0.3) ? r.pick(C.OBSERVATIONS) : "",
        phone: `+44 7700 900${String(phone).padStart(3, "0")}`,
      });
      marker.patients.push(pid);
      summary.patients++;

      const visits: Visit[] = [];
      let target = startDay < from ? from : startDay;
      let waiting = false;
      for (let v = 0; v < planned && target <= until; v++) {
        const got = book(fisio, target, slot);
        if (!got) {
          if (target >= today) waiting = true;
          break;
        }
        const past = got.startsAt < nowIso;
        const status: AppointmentStatus = !past ? "scheduled" : r.chance(0.86) ? "done" : r.chance(0.45) ? "no_show" : "cancelled";
        const id = await createAppointment(db, pid, { startsAt: got.startsAt, minutes: SLOT, assignedTo: fisio.email });
        if (status !== "scheduled") await db.transaction([{ sql: "update appointments set status = ?, updated_at = ? where id = ?", bind: [status, nowIso, id] }]);
        else if (Date.parse(got.startsAt) - now.getTime() < 2 * DAY_MS && r.chance(0.6)) {
          await markReminded(db, id);
          if (r.chance(0.5)) await markConfirmed(db, id, true);
        }
        visits.push({ id, startsAt: got.startsAt, day: got.day, status });
        summary.appointments++;
        target = addDays(got.day, gaps[v]!);
      }
      if (waiting || (opts.mode === "normal" && visits.some((v) => v.status === "scheduled") && r.chance(0.06))) {
        // De todo un poco, para ordenar y filtrar: horas concretas, preferentes, quien aún no puede y días distintos esperando.
        const hours = r.chance(0.2) ? (fisio.shift === SHIFTS[0] ? { fromMin: 9 * 60, toMin: 11 * 60 + 30 } : { fromMin: 18 * 60, toMin: 20 * 60 + 30 }) : {};
        const wid = await addToWaitlist(db, pid, {
          note: waiting ? "Sin hueco con su fisio: quiere la primera cita que se libere." : "Si se libera un hueco antes, prefiere adelantar.",
          assignedTo: r.chance(0.8) ? fisio.email : null,
          preferTime: r.chance(0.2) ? "" : fisio.shift === SHIFTS[0] ? "manana" : "tarde",
          preferDays: r.chance(0.25) ? [] : r.some([1, 2, 3, 4, 5], r.int(2, 4)),
          priority: r.chance(0.15),
          availableFrom: r.chance(0.1) ? addDays(today, r.int(3, 14)) : null,
          ...hours,
        });
        await db.transaction([{ sql: "update waitlist set created_at = ? where id = ?", bind: [atMinutes(addDays(today, -r.int(0, 45)), r.int(9 * 60, 20 * 60)), wid] }]);
        summary.waitlist++;
      }

      // La primera visita a la que vino (la primera cita pudo anularse).
      const first = visits.find((v) => v.status === "done");
      const startedTreatment = !!first;
      const consentAsked = startedTreatment || r.chance(0.4);
      await savePatientPrivacy(db, pid, {
        informedAt: consentAsked ? (first?.day ?? visits[0]?.day ?? today) : undefined,
        consents: consentAsked ? { contact: r.chance(0.93), images: r.chance(0.5), research: r.chance(0.3) } : undefined,
      });
      if (!first) continue;

      // Un motivo anterior, ya resuelto, en algunos pacientes.
      const answersFor = (kc: C.DemoCase, day: string, eva: number, flagged: boolean): Answers => {
        const regionsHit = kc.regions;
        const lc = (s: string) => s.replaceAll("{lado}", lado(kc.femenino));
        const tt = (list: string[]) => lc(r.pick(list));
        const a: Answers = {
          fecha_valoracion: day,
          profesion: r.pick(C.PROFESSIONS),
          derivado_por: r.pick(C.DERIVED),
          motivo: tt(kc.motivo),
          regiones: regionsHit,
          lado: kc.sided ? (side === "d" ? "Derecho" : "Izquierdo") : "No aplica",
          fecha_inicio: tt(kc.inicio),
          forma_inicio: tt(kc.forma),
          localizacion: tt(kc.localizacion),
          tipo_dolor: tt(kc.tipo),
          eva,
          agravantes: tt(kc.agravantes),
          atenuantes: tt(kc.atenuantes),
          ritmo: tt(kc.ritmo),
          irradiacion: tt(kc.irradiacion),
          evolucion: tt(kc.evolucion),
          enfermedades: r.pick(C.DISEASES),
          cirugias: r.pick(C.SURGERIES),
          traumatismos: r.pick(C.PREVIOUS),
          medicacion: r.pick(C.MEDICATION),
          alergias: r.pick(C.ALLERGIES),
          pruebas: tt(kc.pruebas),
          familiares: r.pick(C.FAMILY),
          fisio_previa: r.pick(C.PREV_PHYSIO),
          otros_tratamientos: r.pick(C.OTHER_TREATMENTS),
          respuesta_tratamientos: r.pick(C.RESPONSE),
          creencias: r.pick(C.BELIEFS),
          expectativas: r.pick(C.EXPECTATIONS),
          objetivo_paciente: r.pick(kc.psfs),
          actividad: kc.sport ? r.pick(["Fútbol sala", "Voleibol", "Correr", "Pádel", "Baloncesto"]) : r.pick(C.ACTIVITY),
          frecuencia: r.pick(C.FREQUENCY),
          ocupacion: r.pick(C.POSTURE),
          toxicos: r.pick(C.HABITS),
          sueno: r.pick(C.SLEEP),
          estres: r.pick(C.STRESS),
          avd: r.some(kc.psfs, 2).join(". ") + ".",
          inspeccion: tt(kc.inspeccion),
          palpacion: tt(kc.palpacion),
          rom: tt(kc.movilidad),
          balance_muscular: tt(kc.balance),
          marcha: tt(kc.marcha),
          cif: kc.cif.map((code) => makeEntry(parseCoded(code)!, titleOf.get(parseCoded(code)!.code) ?? code)),
          diagnostico_funcional: tt(kc.diagnostico),
          estructuras: kc.estructuras,
          objetivos_corto: tt(kc.objetivosCorto),
          objetivos_largo: tt(kc.objetivosLargo),
          plan: tt(kc.plan),
          frecuencia_duracion: "2 sesiones por semana las primeras semanas, después 1 por semana",
          sesiones_previstas: planned,
          observaciones: r.chance(0.5) ? r.pick(C.OBSERVATIONS) : "",
        };
        if (kc.id === "lca") a.precauciones = [PRECAUTIONS.find((p) => p.id === "metal")!.label];
        // Unos pocos con una bandera roja de verdad, para ver el aviso.
        if (flagged) {
          a.banderas_rojas = ["Pérdida de peso sin explicación"];
          a.observaciones = "Refiere pérdida de peso de 6 kg en dos meses sin hacer dieta: se le recomienda consultar con su médico.";
        }
        return a;
      };
      const eva = r.int(5, 8);
      const flagged = r.chance(0.03);
      const answers = answersFor(k, first.day, eva, flagged);
      if (r.chance(0.12) && first.day > addDays(from, 7)) {
        // El motivo anterior (hace unos meses), con su anamnesis y dos sesiones, y el de ahora como motivo nuevo.
        const old = r.pick(C.CASES.filter((c) => c.id !== k.id));
        const oldDay = addDays(first.day, -r.int(120, 300));
        await saveAnamnesisOf(db, pid, pid, answersFor(old, oldDay, r.int(4, 7), false));
        for (let s = 0; s < 2; s++)
          await saveSession(db, pid, {
            performedAt: atMinutes(addDays(oldDay, s * 7), fisio.shift.from + slot * SLOT),
            pain: 5 - s * 2,
            subjective: r.pick(s ? C.SUBJECTIVE.late : C.SUBJECTIVE.early),
            objective: r.pick(C.OBJECTIVE),
            treatment: fill(r.pick(old.tratamiento)),
            plan: s ? "Alta: buena evolución." : r.pick(C.NEXT_PLAN),
            reviewOn: null,
            nextAt: null,
            nextMinutes: null,
          });
        await createEpisode(db, pid, { title: k.title, startedAt: first.startsAt, answers });
        closeFirst.push({ id: pid, at: atMinutes(addDays(oldDay, 8), 12 * 60) });
      } else {
        await saveAnamnesisOf(db, pid, pid, answers);
      }

      // Exploración de la primera visita: el test que encaja, positivo; otros de la zona, negativos.
      const region = k.regions[0]!;
      const pool = GALLERY.filter((x) => x.region === region);
      const matching = pool.filter((x) => k.tests.test(x.group));
      const chosen = [...(matching.length ? [matching[0]!] : []), ...r.some(pool.filter((x) => x !== matching[0]), r.int(2, 3))];
      for (const [n, test] of chosen.entries())
        await saveFinding(db, pid, {
          galleryTest: test.id,
          testName: test.name,
          region: test.region,
          performedAt: first.startsAt,
          side: k.sided ? (side === "d" ? "right" : "left") : null,
          result: n === 0 && matching.length ? "positive" : r.chance(0.85) ? "negative" : "inconclusive",
          notes: "",
        });

      // Cuestionarios: al empezar y en la reevaluación (quinta visita), mejor.
      const done = visits.filter((v) => v.status === "done");
      const review = done[4];
      const sideTag = side === "d" ? "_d" : "_i";
      const quest = async (at: string, severity: number, painNow: number, withGroc: boolean) => {
        for (const kind of k.questionnaires) {
          const form = usableForm(kind, []);
          const better = getKind(kind)?.better;
          if (!form || !better) continue;
          const out = fillForm(form, better, severity, r);
          if (out) await saveQuestionnaire(db, pid, { kind, performedAt: at, score: out.score, details: out.details, notes: "" });
        }
        const marks: Mark[] = k.zones.map((z, n) => ({ zone: z.replace("_x", sideTag), symptom: (k.id === "tunel" ? "hormigueo" : "dolor") as Symptom, intensity: Math.max(0, painNow - n) }));
        await saveQuestionnaire(db, pid, { kind: "mapa_dolor", performedAt: at, score: mapScore(marks), details: { marks: formatMarks(marks) }, notes: "" });
        const activities = r.some(k.psfs, Math.min(3, k.psfs.length)).map((a) => ({ name: a, score: Math.round(10 - severity * 10 + r.int(-1, 1)) }));
        const fixed = activities.map((a) => ({ ...a, score: Math.max(0, Math.min(10, a.score)) }));
        await saveQuestionnaire(db, pid, { kind: "psfs", performedAt: at, score: psfsScore(fixed), details: { activities: fixed }, notes: "" });
        if (withGroc) await saveQuestionnaire(db, pid, { kind: "groc", performedAt: at, score: r.int(3, 6), details: {}, notes: "" });
      };
      await quest(first.startsAt, 0.55 + r.next() * 0.2, eva, false);
      if (review) await quest(review.startsAt, 0.2 + r.next() * 0.15, Math.max(1, eva - 4), true);

      // Movilidad: al empezar y en la reevaluación.
      for (const m of k.rom) {
        const mov = getMovement(m.movement);
        if (!mov) continue;
        const measure = async (at: string, value: number) => {
          const tid = await createRomTest(db, { patientId: pid, movement: m.movement, side: mov.sided ? (side === "d" ? "right" : "left") : null, method: "manual", readings: [value - 1, value, value + 1] });
          await db.transaction([{ sql: "update tests set performed_at = ? where id = ?", bind: [at, tid] }]);
        };
        const startValue = m.start + r.int(-4, 4);
        await measure(first.startsAt, startValue);
        if (review) await measure(review.startsAt, startValue + Math.round(m.gain * (0.6 + r.next() * 0.5)));
      }

      // Sesiones: una por cita atendida, con el dolor bajando.
      const sessionIds: string[] = [];
      for (const [n, v] of done.entries()) {
        const phase = n < 2 ? "early" : n < 5 ? "mid" : "late";
        const pain = Math.max(0, Math.min(10, Math.round(eva - (n * (eva - 1)) / Math.max(4, planned - 1) + r.int(-1, 1))));
        const id = await saveSession(db, pid, {
          performedAt: v.startsAt,
          pain,
          subjective: r.pick(C.SUBJECTIVE[phase]),
          objective: r.pick(C.OBJECTIVE),
          treatment: t(k.tratamiento),
          plan: r.pick(C.NEXT_PLAN),
          reviewOn: n === 0 ? addDays(v.day, 28) : null,
          nextAt: null,
          nextMinutes: null,
        });
        sessionIds.push(id);
        summary.sessions++;
      }
      if (k.sport && done.length) sportsPatients.push({ id: pid, sessions: [first.startsAt, ...(review ? [review.startsAt] : [])] });

      // Cobros: un bono al empezar o sesiones sueltas (algunas, sin cobrar todavía).
      const method = (): Method => r.pick(["tarjeta", "tarjeta", "bizum", "bizum", "efectivo", "efectivo", "transferencia"] as Method[]);
      if (r.chance(0.35) && presets.length) {
        const p = r.pick(presets);
        await createPack(db, pid, { title: p.title, sessions: p.sessions, priceCents: p.priceCents, boughtOn: first.day, expiresOn: p.months ? expiryOf(first.day, p.months) : null, note: "" }, method());
      } else {
        for (const v of done) if (r.chance(0.85) && pricing.sessionCents) await addPayment(db, pid, { amountCents: pricing.sessionCents, method: method(), paidOn: v.day, concept: "Sesión de fisioterapia" });
      }

      // Consentimientos, firmados en papel el primer día.
      const ctx = consentContext({ birthDate: dayOfDate(birth), sex } as Patient, answers);
      for (const tid of k.consents) {
        const tpl = templateById(tid);
        if (!tpl || (tid !== "general" && r.chance(0.5)) || r.chance(0.15)) continue;
        const techniques = tpl.techniques.slice(0, tid === "general" ? 3 : 1).map((x) => x.id);
        await saveSignedConsent(
          db,
          pid,
          {
            templateId: tpl.id,
            version: tpl.version,
            title: tpl.title,
            clinic: { name: clinicInfo.name, taxId: clinicInfo.taxId, address: clinicInfo.address },
            professional: { name: fisio.name, license: "" },
            patient: { name, birthDate: dayOfDate(birth), idDoc: "" },
            representative: null,
            techniques: tpl.techniques.filter((x) => techniques.includes(x.id)).map((x) => x.label),
            sections: buildSections(tpl, ctx, techniques),
            date: first.day,
            place: "",
            brand: null,
          },
          "paper",
          {},
        );
      }
    }
    progress("Guardando", total, total);
    await flush();

    // Lo que lee la base antes de escribir: cerrar los motivos anteriores y los saltos de los deportistas.
    for (const c of closeFirst) await updateEpisode(realDb, c.id, c.id, { closedAt: c.at });
    const video = { fileName: "salto.mov", captureFps: 240, containerFps: 240, frameCount: 2400, durationS: 10, fpsSource: "container" as const };
    for (const s of sportsPatients)
      for (const [n, at] of s.sessions.entries()) {
        const tid = await createJumpTest(realDb, { patientId: s.id, type: "cmj" });
        await saveVideo(realDb, tid, video);
        await saveMarksAndCompute(realDb, tid, marksFromFrames({ takeoff: 400, landing: 400 + r.int(100, 118) + n * r.int(3, 8) }));
        await realDb.transaction([{ sql: "update tests set performed_at = ? where id = ?", bind: [at, tid] }]);
      }
    await realDb.transaction([{ sql: "insert into settings (key, value) values (?, ?) on conflict (key) do update set value = excluded.value", bind: [DEMO_KEY, JSON.stringify(marker)] }]);
  } catch (err) {
    // A medias no se queda nada: se borra lo que ya estaba escrito.
    await removeByMarker(realDb, marker).catch(() => {});
    throw err;
  }
  summary.ms = Date.now() - started;
  return summary;
}

// ---------- Borrar ----------

async function removeByMarker(db: Db, m: DemoMarker): Promise<number> {
  const chunk = <T>(list: T[], n: number) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
  // Borrar al paciente borra en cascada todo lo suyo: citas, sesiones, cuestionarios, cobros, consentimientos…
  for (const ids of chunk(m.patients, 300)) await db.transaction([{ sql: `delete from patients where id in (${ids.map(() => "?").join(",")})`, bind: ids }]);
  for (const ids of chunk([...m.shifts, ...m.closures], 300))
    await db.transaction([
      { sql: `delete from shifts where id in (${ids.map(() => "?").join(",")})`, bind: ids },
      { sql: `delete from closures where id in (${ids.map(() => "?").join(",")})`, bind: ids },
    ]);
  for (const email of m.staff) await removeStaff(db, email, new Date(0));
  // Los ajustes que se tocaron vuelven a como estaban.
  const restore: Statement[] = Object.entries(m.previous).map(([key, value]) =>
    value === null ? { sql: "delete from settings where key = ?", bind: [key] } : { sql: "insert into settings (key, value) values (?, ?) on conflict (key) do update set value = excluded.value", bind: [key, value] },
  );
  await db.transaction([...restore, { sql: "delete from settings where key = ?", bind: [DEMO_KEY] }]);
  return m.patients.length;
}

/** Borra todo lo que creó la clínica de prueba y deja los ajustes como estaban. Devuelve cuántos pacientes ha borrado. */
export async function removeDemo(db: Db): Promise<number> {
  const { marker } = await demoState(db);
  if (!marker) return 0;
  return removeByMarker(db, marker);
}
