// Atajos de fisioterapia para ir acotando en la CIF: por componente, los grupos con los que piensa un fisio («Dolor»,
// «Movilidad y estabilidad», «Posturas y transferencias»…) y, en cada uno, las categorías que más se usan, de la más
// general a la más concreta. Desde cualquiera se puede seguir bajando por el árbol de la propia CIF. Son una
// selección de la app, no un «core set» oficial.
import type { CifEntry, Component } from "./cif";

export type CifGroup = { id: string; label: string; codes: string[] };

export const GROUPS: Record<Component, CifGroup[]> = {
  b: [
    { id: "dolor", label: "Dolor", codes: ["b280", "b28010", "b28013", "b28014", "b28015", "b28016", "b2802", "b2803", "b2804", "b2800"] },
    { id: "movilidad", label: "Movilidad y estabilidad articular", codes: ["b710", "b7100", "b7101", "b7102", "b715", "b720"] },
    { id: "fuerza", label: "Fuerza, tono y resistencia muscular", codes: ["b730", "b7300", "b7301", "b7303", "b7305", "b735", "b740"] },
    { id: "control", label: "Control motor y marcha", codes: ["b760", "b770", "b780", "b750", "b755"] },
    { id: "sensibilidad", label: "Sensibilidad y propiocepción", codes: ["b260", "b265", "b270", "b2702"] },
    { id: "equilibrio", label: "Equilibrio y mareo", codes: ["b235", "b2401", "b2402", "b755"] },
    { id: "esfuerzo", label: "Respiración y tolerancia al esfuerzo", codes: ["b440", "b445", "b455", "b4550", "b4552", "b460"] },
    { id: "suelo_pelvico", label: "Suelo pélvico", codes: ["b620", "b6202", "b525", "b640"] },
    { id: "animo", label: "Sueño, energía y ánimo", codes: ["b134", "b130", "b152", "b1801"] },
  ],
  s: [
    { id: "columna", label: "Columna y tronco", codes: ["s760", "s76000", "s76001", "s76002", "s76003", "s76004", "s7601", "s7602"] },
    { id: "cabeza", label: "Cabeza, cuello y ATM", codes: ["s710", "s7103", "s7104", "s7105", "s7102"] },
    { id: "hombro", label: "Hombro", codes: ["s720", "s7201", "s7202", "s7203", "s7200"] },
    { id: "brazo", label: "Brazo, codo, muñeca y mano", codes: ["s730", "s73001", "s73002", "s73011", "s73012", "s73021", "s73022", "s73023"] },
    { id: "pelvis", label: "Pelvis y suelo pélvico", codes: ["s740", "s7401", "s7402", "s7403", "s620"] },
    { id: "pierna", label: "Cadera, rodilla, tobillo y pie", codes: ["s750", "s75001", "s75002", "s75011", "s75012", "s75013", "s75021", "s75022", "s75023"] },
    { id: "general", label: "Huesos, músculos y ligamentos en general", codes: ["s770", "s7700", "s7701", "s7702", "s7703"] },
    { id: "nervios", label: "Médula y nervios espinales", codes: ["s120", "s1200", "s1201", "s12003"] },
  ],
  d: [
    { id: "posturas", label: "Posturas y transferencias", codes: ["d410", "d4100", "d4101", "d4103", "d4104", "d4105", "d415", "d4153", "d4154", "d420"] },
    { id: "brazos", label: "Levantar, llevar y usar brazos y manos", codes: ["d430", "d4300", "d4301", "d445", "d4452", "d4451", "d440", "d435"] },
    { id: "andar", label: "Andar, correr y subir escaleras", codes: ["d450", "d4500", "d4501", "d4502", "d455", "d4551", "d4552", "d4553", "d460", "d465"] },
    { id: "transporte", label: "Transporte y conducción", codes: ["d470", "d475", "d4751"] },
    { id: "autocuidado", label: "Autocuidado", codes: ["d510", "d540", "d520", "d530", "d550", "d570"] },
    { id: "casa", label: "Tareas de casa y cuidar de otros", codes: ["d640", "d6402", "d630", "d620", "d650", "d660"] },
    { id: "trabajo", label: "Trabajo y estudios", codes: ["d850", "d855", "d845", "d820", "d825", "d830"] },
    { id: "ocio", label: "Deporte, ocio y vida social", codes: ["d920", "d9201", "d9204", "d910", "d750", "d760"] },
    { id: "rutina", label: "Rutina diaria y estrés", codes: ["d230", "d240", "d2401"] },
  ],
  e: [
    { id: "ayudas", label: "Medicación y ayudas técnicas", codes: ["e1101", "e1151", "e1201", "e1351", "e140"] },
    { id: "edificios", label: "Casa, trabajo y edificios", codes: ["e155", "e150"] },
    { id: "apoyo", label: "Personas que le apoyan", codes: ["e310", "e315", "e320", "e325", "e330", "e340", "e355", "e360"] },
    { id: "actitudes", label: "Actitudes de su entorno", codes: ["e410", "e420", "e425", "e450"] },
    { id: "servicios", label: "Servicios sanitarios, laborales y sociales", codes: ["e5800", "e5900", "e5700", "e580", "e590", "e570"] },
  ],
};

/** Los capítulos de un componente. */
export const chaptersOf = (catalog: CifEntry[], component: Component) => catalog.filter((e) => e.component === component && e.level === 1);

/** Del capítulo a la categoría: «b7» › «b710» › «b7100». */
export function ancestorsOf(code: string): string[] {
  const out: string[] = [];
  if (code.length > 2) out.push(code.slice(0, 2));
  for (let n = 4; n < code.length; n++) out.push(code.slice(0, n));
  return out;
}
