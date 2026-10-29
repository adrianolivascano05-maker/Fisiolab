// El perfil CIF redactado como lo escribiría un fisio: por componente, cada código en una frase con su calificador
// («dificultad moderada para andar (d450.2; Oswestry 32 % el 20 oct)»), el dato que lo respalda cuando el calificador
// coincide con lo propuesto (src/clinical/cif/suggest.ts) y, al final, los factores personales de la anamnesis, que
// la CIF no codifica.
import type { Answers } from "../../data/clinical";
import { ageOn } from "../../data/privacy";
import { COMPONENTS, LOCATION, NATURE, formatCoded, readEntry, type Coded, type Component } from "./cif";
import { suggestQualifier, type Evidence } from "./suggest";

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** El título para ir dentro de una frase: sin las comillas de la edición en español y en minúscula. */
const inSentence = (title: string) => lowerFirst(title.replace(/[“”"]/g, "").trim());
/** «Andar», «Mantener la posición…», «Lavarse»: las actividades que empiezan por un verbo van con «para». */
const isVerb = (title: string) => /^(\p{L}+)(ar|er|ir)(se)?$/u.test(title.replace(/[“”"]/g, "").split(/[\s,/]/)[0] ?? "");

const SCALE: Record<number, string> = { 1: "ligera", 2: "moderada", 3: "grave", 4: "completa" };
const SCALE_M: Record<number, string> = { 1: "ligero", 2: "moderado", 3: "grave", 4: "completo" };

/** Una frase en dos partes: la gravedad («dificultad grave») y lo demás («para andar (d450.3)»). */
export type Phrase = { lead: string; rest: string };

/**
 * Un código en una frase: «deficiencia grave en dolor en la espalda (b28013.3)», «dificultad moderada para andar en su
 * entorno habitual, ligera en capacidad (d450.21)», «facilitador moderado: familiares cercanos (e310+2)». Los «no
 * aplicable» no se dicen.
 */
export function phraseParts(c: Coded, title: string): Phrase | null {
  const k = c.code[0] as Component;
  const tail = `(${formatCoded(c)})`;
  const t = inSentence(title);
  if (c.q === 9) return null;
  if (k === "e") {
    const kind = c.facilitator ? "facilitador" : "barrera";
    if (c.q === null || c.q === 8) return { lead: `${kind} sin especificar:`, rest: `${t} ${tail}` };
    if (c.q === 0) return { lead: `no es ${kind}:`, rest: `${t} ${tail}` };
    return { lead: `${kind} ${c.facilitator ? SCALE_M[c.q] : SCALE[c.q]}:`, rest: `${t} ${tail}` };
  }
  const noun = k === "d" ? "dificultad" : "deficiencia";
  const prep = k === "d" && isVerb(title) ? "para" : "en";
  if (c.q === null) return { lead: "", rest: `${t}, sin calificar ${tail}` };
  const lead = c.q === 0 ? `sin ${noun}` : c.q === 8 ? `${noun} de gravedad sin especificar` : `${noun} ${SCALE[c.q]}`;
  let rest = `${prep} ${t}`;
  if (k === "d" && c.capacity !== null && c.capacity !== 9 && c.q !== 0 && c.q !== 8) {
    const cap = c.capacity === 0 ? "sin dificultad" : c.capacity === 8 ? "sin especificar" : SCALE[c.capacity];
    rest += ` en su entorno habitual, ${cap} en capacidad`;
  }
  if (k === "s") {
    const more = [c.nature != null && c.nature !== 8 && c.nature !== 9 ? NATURE[c.nature] : "", c.location != null && c.location !== 8 && c.location !== 9 ? LOCATION[c.location] : ""].filter(Boolean);
    if (more.length) rest += `: ${more.join(", ")}`;
  }
  return { lead, rest: `${rest} ${tail}` };
}


/** Seguidas y con la misma gravedad, se dice una vez: «dificultad grave para andar (d450.3) y para vestirse (d540.3)». */
export function mergeLeads(parts: Phrase[]): string[] {
  return parts.map((p, i) => (i > 0 && p.lead && p.lead === parts[i - 1]!.lead ? p.rest : `${p.lead} ${p.rest}`.trim()));
}

const listText = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}`);

const HEAD: Record<Component, string> = {
  b: "Funciones corporales",
  s: "Estructuras corporales",
  d: "Actividades y participación",
  e: "Factores ambientales",
};

const text = (a: Answers, id: string) => (typeof a[id] === "string" ? (a[id] as string).trim().replace(/\.$/, "") : "");

/** Los factores personales: lo que la CIF no codifica y el fisio tiene en la anamnesis. */
export function personalFactors(a: Answers, birthDate: string | null | undefined): string {
  const years = birthDate ? ageOn(birthDate) : null;
  const sport = [text(a, "actividad"), text(a, "frecuencia")].filter(Boolean).join(", ");
  return [
    years !== null ? `${years} años` : "",
    text(a, "profesion") ? `profesión: ${lowerFirst(text(a, "profesion"))}` : "",
    text(a, "ocupacion") ? `trabajo y postura habitual: ${lowerFirst(text(a, "ocupacion"))}` : "",
    sport ? `actividad física: ${lowerFirst(sport)}` : "",
    text(a, "creencias") ? `cree que ${lowerFirst(text(a, "creencias")).replace(/^que /, "")}` : "",
    text(a, "expectativas") ? `espera ${lowerFirst(text(a, "expectativas")).replace(/^que /, "")}` : "",
    text(a, "objetivo_paciente") ? `quiere volver a ${lowerFirst(text(a, "objetivo_paciente")).replace(/^volver a /, "")}` : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/**
 * El diagnóstico fisioterapéutico redactado con la CIF, un párrafo por componente. Con `evidence`, los calificadores
 * que coinciden con lo propuesto se agrupan por el dato que los respalda («…, según RMDQ 12/24 el 20 oct»); con
 * `personal`, termina con los factores personales.
 */
export function draftDiagnosis(entries: string[], opts: { evidence?: Evidence; personal?: string } = {}): string {
  const parsed = entries.map(readEntry).filter((e): e is NonNullable<ReturnType<typeof readEntry>> => !!e);
  const lines: string[] = [];
  for (const comp of COMPONENTS) {
    // Por el dato que los respalda, en el orden en que salen; sin dato, juntos.
    const byEvidence = new Map<string, Phrase[]>();
    for (const { coded, title } of parsed.filter((e) => e.coded.code[0] === comp.id)) {
      const p = phraseParts(coded, title);
      if (!p) continue;
      const sug = opts.evidence ? suggestQualifier(coded.code, opts.evidence) : null;
      const key = sug && sug.q === coded.q ? sug.short : "";
      byEvidence.set(key, [...(byEvidence.get(key) ?? []), p]);
    }
    const groups = [...byEvidence].map(([why, parts]) => `${listText(mergeLeads(parts))}${why ? `, según ${why}` : ""}`);
    if (groups.length) lines.push(`${HEAD[comp.id]}: ${groups.join("; ")}.`);
  }
  if (opts.personal) lines.push(`Factores personales: ${opts.personal}.`);
  return lines.join("\n");
}
