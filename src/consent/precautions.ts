// Precauciones de la anamnesis que cambian los riesgos de un tratamiento (campo «precauciones» del apartado de
// antecedentes) y las palabras que, escritas en el texto libre sin marcar la casilla, hacen avisar de que quizá
// haya que marcarla. Las palabras se buscan sin tildes ni mayúsculas, como principio de palabra.
import type { Answers } from "../data/clinical";

export type Precaution = { id: string; label: string; words: string[] };

export const PRECAUTIONS: Precaution[] = [
  { id: "anticoagulantes", label: "Toma anticoagulantes o antiagregantes", words: ["anticoagul", "antiagreg", "sintrom", "acenocumarol", "warfarina", "apixaban", "eliquis", "rivaroxaban", "xarelto", "dabigatran", "pradaxa", "edoxaban", "heparina", "clopidogrel", "adiro", "aspirina"] },
  { id: "coagulacion", label: "Trastorno de la coagulación (hemofilia, plaquetas bajas…)", words: ["hemofil", "coagulopat", "trombocitopen", "von willebrand"] },
  { id: "marcapasos", label: "Marcapasos, desfibrilador u otro implante electrónico", words: ["marcapas", "desfibrilador", "dai ", "neuroestimulador", "implante coclear", "bomba de insulina"] },
  { id: "embarazo", label: "Embarazo o posible embarazo", words: ["embaraz", "gestante", "gestacion", "semanas de gestacion"] },
  { id: "osteoporosis", label: "Osteoporosis", words: ["osteopor", "osteopenia"] },
  { id: "cancer", label: "Cáncer activo o tratado en los últimos 5 años", words: ["cancer", "tumor", "neoplas", "carcinoma", "linfoma", "leucemia", "metasta", "quimioterap", "radioterap"] },
  { id: "diabetes", label: "Diabetes", words: ["diabet", "insulina", "metformina"] },
  { id: "epilepsia", label: "Epilepsia o convulsiones", words: ["epilep", "convuls"] },
  { id: "metal", label: "Prótesis o material metálico en la zona (placas, tornillos…)", words: ["protesis", "placa", "tornillo", "osteosintesis", "clavo", "artroplastia"] },
  { id: "alergia_metal", label: "Alergia a metales (níquel) o al látex", words: ["niquel", "latex", "alergia a metal"] },
  { id: "agujas", label: "Miedo a las agujas o mareos/desmayos con ellas", words: ["miedo a las agujas", "aicmofobia", "belonefobia", "se marea", "desmayo", "sincope"] },
  { id: "inmunosupresion", label: "Defensas bajas (inmunosupresión, corticoides mucho tiempo)", words: ["inmunosupre", "corticoide", "prednison", "trasplant", "vih"] },
  { id: "piel", label: "Heridas, infección o problemas de piel en la zona", words: ["herida", "ulcera", "dermatitis", "psoriasis", "celulitis", "infeccion"] },
  { id: "sensibilidad", label: "Sensibilidad alterada en la zona", words: ["hipoestesia", "anestesia", "neuropatia", "parestesia", "insensibilidad"] },
  { id: "trombosis", label: "Trombosis o varices importantes en la zona", words: ["trombosis", "tromboflebitis", "flebitis", "trombo"] },
  { id: "cardiaco", label: "Enfermedad del corazón o tensión alta sin controlar", words: ["cardiopat", "infarto", "angina", "insuficiencia cardiaca", "arritmia", "hipertension"] },
  { id: "cervical_vascular", label: "Problemas de arterias del cuello, mareos o vértigo de origen cervical", words: ["vertigo", "diseccion", "insuficiencia vertebrobasilar", "carotid"] },
  { id: "reuma", label: "Artritis reumatoide u otra enfermedad reumática inflamatoria", words: ["artritis reumatoide", "espondilitis", "lupus", "reumat"] },
  { id: "linfedema", label: "Linfedema o ganglios extirpados en ese miembro", words: ["linfedema", "vaciamiento ganglionar", "mastectom"] },
];

export const precautionLabel = (id: string) => PRECAUTIONS.find((p) => p.id === id)?.label ?? id;

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Campos de texto libre de la anamnesis donde se buscan las palabras. */
const FREE_TEXT = ["enfermedades", "cirugias", "traumatismos", "medicacion", "alergias", "observaciones"];

/** Precauciones que parecen escritas en el texto libre y no están marcadas. */
export function detectPrecautions(a: Answers, marked: string[]): { precaution: string; word: string }[] {
  const text = ` ${FREE_TEXT.map((id) => (typeof a[id] === "string" ? fold(a[id] as string) : "")).join(" \n ")} `;
  const out: { precaution: string; word: string }[] = [];
  for (const p of PRECAUTIONS) {
    if (marked.includes(p.id)) continue;
    for (const w of p.words) {
      // La palabra entera tal como está escrita (sin tildes): «sintrom», «diabetes»…
      const m = new RegExp(`(?:^|[^a-z])(${fold(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[a-zñ]*)`).exec(text);
      if (m) {
        out.push({ precaution: p.id, word: m[1]!.trim() });
        break;
      }
    }
  }
  return out;
}
