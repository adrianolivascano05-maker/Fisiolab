// Registro en memoria de los cuestionarios propios de la clínica (src/data/ownForms.ts), para que el catálogo
// (questionnaires.ts, forms/index.ts, patientForms.ts) los conozca sin dejar de ser síncrono. Lo rellena
// `loadOwnCatalog` (al abrir la app y cada vez que cambian los ajustes) y lo leen getKind, formFor y compañía.
import { buildForm, OWN_LABEL, scoreRange, type OwnFormSpec } from "./forms/own";
import type { QuestionForm } from "./forms/types";
import type { OwnDetails, QuestionnaireKind } from "./questionnaires";
import type { Db } from "../data/db";
import { listOwnForms, listOwnSnapshots } from "../data/ownForms";

/** El grupo con el que salen en el selector y en la Biblioteca. */
export const OWN_TOPIC = "De la clínica";

type Entry = { spec: OwnFormSpec; archived: boolean };
let current = new Map<string, Entry>();
let versions = new Map<string, OwnFormSpec>();
const forms = new Map<string, QuestionForm>();
let stamp = "";

const versionKey = (id: string, hash: string) => `${id}@${hash}`;

/** Pone los cuestionarios propios en el registro. Devuelve si ha cambiado algo. */
export function setOwnForms(docs: { spec: OwnFormSpec; archived?: boolean }[], snapshots: OwnFormSpec[] = []): boolean {
  const next = JSON.stringify([docs.map((d) => [d.spec.id, d.spec.hash, !!d.archived]), snapshots.map((s) => [s.id, s.hash])]);
  if (next === stamp) return false;
  stamp = next;
  current = new Map(docs.map((d) => [d.spec.id, { spec: d.spec, archived: !!d.archived }]));
  versions = new Map(snapshots.filter((s) => s.hash).map((s) => [versionKey(s.id, s.hash!), s]));
  for (const d of docs) if (d.spec.hash) versions.set(versionKey(d.spec.id, d.spec.hash), d.spec);
  forms.clear();
  return true;
}

/** Lee de la base los cuestionarios propios y sus versiones. Devuelve si ha cambiado algo. */
export async function loadOwnCatalog(db: Db): Promise<boolean> {
  const [docs, snapshots] = await Promise.all([listOwnForms(db), listOwnSnapshots(db)]);
  return setOwnForms(docs, snapshots);
}

/** La versión de un cuestionario propio: con huella, esa; sin ella, la de ahora. */
export function ownSpec(id: string, hash?: string): OwnFormSpec | undefined {
  return (hash ? versions.get(versionKey(id, hash)) : undefined) ?? current.get(id)?.spec;
}

/** El cuestionario propio como uno de la app (con huella, el de esa versión). */
export function ownFormFor(id: string, hash?: string): QuestionForm | undefined {
  const spec = ownSpec(id, hash);
  if (!spec) return undefined;
  const key = versionKey(id, spec.hash ?? "");
  let f = forms.get(key);
  if (!f) {
    f = buildForm(spec);
    forms.set(key, f);
  }
  return f;
}

/** Su ficha de catálogo: nombre, rango de la nota y qué es mejor (solo para la flecha), y la marca de propio. */
export function kindOfSpec(spec: OwnFormSpec, archived = false): QuestionnaireKind {
  const range = scoreRange(spec);
  return {
    id: spec.id,
    name: spec.name,
    min: range.min,
    max: range.max,
    better: spec.scoring?.better ?? "higher",
    topic: OWN_TOPIC,
    own: true,
    ...(spec.scoring ? {} : { noScore: true }),
    ...(spec.note ? { note: spec.note, noteClinic: spec.noteClinic, noteAt: spec.noteAt } : {}),
    ...(archived ? { archived: true } : {}),
    hint: OWN_LABEL,
  };
}

/** Un cuestionario propio por id (también si está archivado), o undefined. */
export function ownKind(id: string): QuestionnaireKind | undefined {
  const e = current.get(id);
  return e ? kindOfSpec(e.spec, e.archived) : undefined;
}

/** Los que se pueden pasar y mandar hoy (sin los archivados), por nombre. */
export function ownKinds(): QuestionnaireKind[] {
  return [...current.values()].filter((e) => !e.archived).map((e) => kindOfSpec(e.spec));
}

/** Lo que se guarda en cada respuesta de un cuestionario propio: la versión (huella) y cómo era. */
export function ownDetails(spec: OwnFormSpec): OwnDetails {
  const range = scoreRange(spec);
  return {
    id: spec.id,
    hash: spec.hash ?? "",
    name: spec.name,
    min: range.min,
    max: range.max,
    better: spec.scoring?.better ?? "higher",
    ...(spec.scoring ? {} : { noScore: true }),
    ...(spec.note ? { note: spec.note, ...(spec.noteClinic ? { noteClinic: spec.noteClinic } : {}), ...(spec.noteAt ? { noteAt: spec.noteAt } : {}) } : {}),
  };
}
