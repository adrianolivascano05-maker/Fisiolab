// Ejercicios para casa (migraciones 021 y 023). La biblioteca de la clínica (exercises, con un enlace a un vídeo si se
// quiere) y las hojas de cada paciente (exercise_plans). La hoja copia el texto de cada ejercicio al guardarse: cambiar
// la biblioteca no cambia lo que ya se le dio a nadie. La biblioteca empieza vacía; se pueden añadir unos ejemplos para
// editarlos. Las plantillas (una hoja con nombre: «Lumbalgia, fase 1») se guardan en un ajuste de la clínica.
import type { Db } from "./db";
import { getSetting, setSetting } from "./repo";

const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export type ExerciseInput = { title: string; region: string; dose: string; instructions: string; video?: string };
export type Exercise = ExerciseInput & { id: string };
/** Un ejercicio dentro de una hoja (copiado). */
export type PlanItem = { title: string; dose: string; instructions: string; video?: string };
export type PlanInput = { items: PlanItem[]; note: string };
export type Plan = PlanInput & { id: string; patientId: string; createdAt: string; updatedAt: string };

export const DEFAULT_PLAN_NOTE =
  "Haz los ejercicios despacio y sin dolor intenso. Si algo te molesta más de lo habitual, para y coméntalo en la próxima sesión.";

/** Ejemplos para empezar: ejercicios habituales, descritos de forma general, para que cada fisio los revise y adapte. */
export const STARTER_EXERCISES: ExerciseInput[] = [
  { region: "cervical", title: "Retracción cervical", dose: "10 repeticiones, 2 o 3 veces al día", instructions: "Sentado con la espalda recta, lleva la barbilla hacia atrás sin bajar ni subir la cabeza, como si hicieras papada. Mantén 3 segundos y vuelve." },
  { region: "cervical", title: "Estiramiento lateral del cuello", dose: "3 veces por lado, 2 veces al día", instructions: "Sentado, acerca la oreja al hombro del mismo lado sin subir el hombro, hasta notar un estiramiento suave. Mantén 20 a 30 segundos y cambia de lado." },
  { region: "hombro", title: "Péndulo de hombro", dose: "1 minuto en cada sentido, 2 o 3 veces al día", instructions: "Inclinado hacia delante, con la otra mano apoyada en una mesa, deja colgar el brazo relajado y haz círculos pequeños." },
  { region: "hombro", title: "Rotación externa con banda elástica", dose: "3 series de 10 a 15", instructions: "De pie, con el codo pegado al cuerpo y doblado en ángulo recto, lleva la mano hacia fuera estirando la banda, despacio, y vuelve." },
  { region: "muneca_mano", title: "Excéntrico de muñeca", dose: "3 series de 15, una vez al día", instructions: "Con el antebrazo apoyado, la palma hacia abajo y un peso ligero en la mano, sube la muñeca ayudándote con la otra mano y bájala despacio solo con la que trabaja." },
  { region: "dorsal", title: "Apertura torácica (libro)", dose: "10 por lado", instructions: "Tumbado de lado, con las rodillas dobladas y los brazos estirados por delante, abre el brazo de arriba hacia el otro lado siguiéndolo con la mirada, y vuelve." },
  { region: "lumbar", title: "Gato-camello", dose: "10 repeticiones, 1 o 2 veces al día", instructions: "A cuatro patas, redondea la espalda hacia el techo y luego húndela suavemente, sin llegar a molestar." },
  { region: "lumbar", title: "Rodillas al pecho", dose: "3 veces, 2 veces al día", instructions: "Tumbado boca arriba, lleva una o las dos rodillas hacia el pecho con las manos. Mantén 20 a 30 segundos." },
  { region: "lumbar", title: "Puente de glúteo", dose: "3 series de 10", instructions: "Tumbado boca arriba, con las rodillas dobladas y los pies apoyados, sube la cadera hasta alinear el tronco con los muslos. Mantén 2 segundos y baja despacio." },
  { region: "cadera", title: "Separar la pierna tumbado de lado", dose: "3 series de 10 a 15", instructions: "Tumbado de lado, con la pierna de abajo doblada, sube la de arriba estirada sin girar la pelvis y bájala despacio." },
  { region: "rodilla", title: "Cuádriceps en estático", dose: "3 series de 10", instructions: "Con la pierna estirada y una toalla enrollada bajo la rodilla, aprieta la rodilla contra la toalla tensando el muslo. Mantén 5 segundos y suelta." },
  { region: "rodilla", title: "Sentarse y levantarse de una silla", dose: "3 series de 10", instructions: "De pie delante de una silla, con los pies a la anchura de las caderas, baja como para sentarte hasta rozarla y vuelve a subir. Las rodillas, en la dirección de los pies." },
  { region: "tobillo_pie", title: "Elevación de talones", dose: "3 series de 15", instructions: "De pie, apoyado en una pared o una silla, sube de puntillas despacio y baja despacio." },
  { region: "tobillo_pie", title: "Abecedario con el pie", dose: "El abecedario entero, 2 o 3 veces al día", instructions: "Sentado con el pie en el aire, dibuja las letras del abecedario con la punta del pie." },
];

// ---------- Biblioteca ----------

type ExerciseRow = { id: string; title: string; region: string; dose: string; instructions: string; video: string | null };
const toExercise = (r: ExerciseRow): Exercise => ({ id: r.id, title: r.title, region: r.region, dose: r.dose, instructions: r.instructions, video: r.video ?? "" });

/** Un enlace de vídeo válido (http o https), o vacío. */
export function cleanVideo(v: string | undefined): string {
  const t = (v ?? "").trim();
  if (!t) return "";
  const url = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(url);
    if (!u.hostname.includes(".")) throw new Error();
    return u.toString();
  } catch {
    throw new RangeError("El enlace del vídeo no es una dirección web.");
  }
}

export async function listExercises(db: Db): Promise<Exercise[]> {
  return (await db.query<ExerciseRow>("select * from exercises order by title collate nocase")).map(toExercise);
}

function checkExercise(e: ExerciseInput) {
  if (!e.title.trim()) throw new RangeError("Ponle un nombre al ejercicio.");
}

export async function saveExercise(db: Db, e: ExerciseInput, id?: string): Promise<string> {
  checkExercise(e);
  const t = now();
  const bind = [e.title.trim(), e.region, e.dose.trim(), e.instructions.trim(), cleanVideo(e.video)];
  if (id) {
    await db.transaction([{ sql: "update exercises set title = ?, region = ?, dose = ?, instructions = ?, video = ?, updated_at = ? where id = ?", bind: [...bind, t, id] }]);
    return id;
  }
  const nid = newId();
  await db.transaction([{ sql: "insert into exercises (title, region, dose, instructions, video, id, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)", bind: [...bind, nid, t, t] }]);
  return nid;
}

export async function deleteExercise(db: Db, id: string): Promise<void> {
  await db.transaction([{ sql: "delete from exercises where id = ?", bind: [id] }]);
}

/** Añade los ejemplos que no estén ya (por nombre). Devuelve cuántos. */
export async function addStarterExercises(db: Db): Promise<number> {
  const have = new Set((await listExercises(db)).map((e) => e.title.toLowerCase()));
  const t = now();
  const add = STARTER_EXERCISES.filter((e) => !have.has(e.title.toLowerCase()));
  if (!add.length) return 0;
  await db.transaction(
    add.map((e) => ({
      sql: "insert into exercises (id, title, region, dose, instructions, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)",
      bind: [newId(), e.title, e.region, e.dose, e.instructions, t, t],
    })),
  );
  return add.length;
}

// ---------- Hojas del paciente ----------

type PlanRow = { id: string; patient_id: string; items: string; note: string; created_at: string; updated_at: string };
function toPlan(r: PlanRow): Plan {
  let items: PlanItem[] = [];
  try {
    const raw = JSON.parse(r.items) as unknown;
    if (Array.isArray(raw))
      items = raw
        .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
        .map((x) => ({ title: String(x.title ?? ""), dose: String(x.dose ?? ""), instructions: String(x.instructions ?? ""), video: String(x.video ?? "") }));
  } catch {
    /* una hoja dañada se ve vacía */
  }
  return { id: r.id, patientId: r.patient_id, items, note: r.note, createdAt: r.created_at, updatedAt: r.updated_at };
}

/** Las hojas del paciente, la más reciente primero. */
export async function listPlans(db: Db, patientId: string): Promise<Plan[]> {
  return (await db.query<PlanRow>("select * from exercise_plans where patient_id = ? order by created_at desc", [patientId])).map(toPlan);
}


const clean = (p: PlanInput) => {
  const items = p.items
    .map((i) => ({ title: i.title.trim(), dose: i.dose.trim(), instructions: i.instructions.trim(), ...(i.video?.trim() ? { video: cleanVideo(i.video) } : {}) }))
    .filter((i) => i.title);
  if (!items.length) throw new RangeError("Añade al menos un ejercicio.");
  return { items: JSON.stringify(items), note: p.note.trim() };
};

export async function savePlan(db: Db, patientId: string, p: PlanInput, id?: string): Promise<string> {
  const c = clean(p);
  const t = now();
  if (id) {
    if (!(await db.query("select 1 from exercise_plans where id = ? and patient_id = ?", [id, patientId])).length) throw new RangeError("Esta hoja ya no existe: se ha borrado en otro dispositivo.");
    await db.transaction([{ sql: "update exercise_plans set items = ?, note = ?, updated_at = ? where id = ? and patient_id = ?", bind: [c.items, c.note, t, id, patientId] }]);
    return id;
  }
  const nid = newId();
  await db.transaction([{ sql: "insert into exercise_plans (id, patient_id, items, note, created_at, updated_at) values (?, ?, ?, ?, ?, ?)", bind: [nid, patientId, c.items, c.note, t, t] }]);
  return nid;
}

export async function deletePlan(db: Db, id: string): Promise<void> {
  await db.transaction([{ sql: "delete from exercise_plans where id = ?", bind: [id] }]);
}

/** La hoja en texto, para WhatsApp o correo. */
export function planText(p: PlanInput, patientName: string, clinic: string): string {
  const first = patientName.trim().split(/\s+/)[0] ?? patientName;
  const lines = [`Hola, ${first}. Tus ejercicios para casa${clinic.trim() ? ` (${clinic.trim()})` : ""}:`, ""];
  p.items.forEach((i, n) => {
    lines.push(`${n + 1}. ${i.title}${i.dose ? ` — ${i.dose}` : ""}`);
    if (i.instructions) lines.push(i.instructions);
    if (i.video) lines.push(`Vídeo: ${i.video}`);
    lines.push("");
  });
  if (p.note.trim()) lines.push(p.note.trim());
  return lines.join("\n").trim();
}

// ---------- Plantillas ----------

/** Una hoja con nombre para darla a otros pacientes («Lumbalgia, fase 1»). Ajuste de la clínica (se sincroniza). */
export type PlanTemplate = PlanInput & { id: string; title: string };
const PLAN_TEMPLATES_KEY = "exercise_templates";

export async function listTemplates(db: Db): Promise<PlanTemplate[]> {
  return ((await getSetting<PlanTemplate[]>(db, PLAN_TEMPLATES_KEY)) ?? []).sort((a, b) => a.title.localeCompare(b.title, "es"));
}

/** Guarda la hoja como plantilla; con el mismo nombre, la cambia. */
export async function saveTemplate(db: Db, title: string, p: PlanInput): Promise<void> {
  const name = title.trim();
  if (!name) throw new RangeError("Ponle un nombre a la plantilla.");
  const c = clean(p);
  const all = await listTemplates(db);
  const same = all.find((t) => t.title.toLowerCase() === name.toLowerCase());
  const tpl: PlanTemplate = { id: same?.id ?? newId(), title: name, items: JSON.parse(c.items) as PlanItem[], note: c.note };
  await setSetting(db, PLAN_TEMPLATES_KEY, [...all.filter((t) => t.id !== tpl.id), tpl]);
}

export async function deleteTemplate(db: Db, id: string): Promise<void> {
  await setSetting(db, PLAN_TEMPLATES_KEY, (await listTemplates(db)).filter((t) => t.id !== id));
}
