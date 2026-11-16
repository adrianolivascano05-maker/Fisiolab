// Las pantallas de la app que se encuentran escribiendo (el buscador del botón «＋», src/app/QuickAdd.tsx): su nombre,
// a dónde lleva y otras palabras con que se buscan («precio», «tarifa»…). Sin pantalla: se prueba sola.
export type Screen = { label: string; to: string; words: string };

export const SCREENS: Screen[] = [
  { label: "Agenda de hoy", to: "/agenda?vista=hoy", words: "hoy citas dia" },
  { label: "Agenda", to: "/agenda", words: "calendario semana citas horario" },
  { label: "Envíos pendientes", to: "/agenda/envios", words: "whatsapp recordatorios mensajes mandar bandeja" },
  { label: "Recordatorios de mañana", to: "/agenda/recordatorios", words: "whatsapp avisar citas" },
  { label: "Lista de espera", to: "/agenda/espera", words: "hueco adelantar esperando" },
  { label: "Pendiente de cobro", to: "/agenda/cobros", words: "deben deudas cobrar sin pagar" },
  { label: "Nuevo paciente", to: "/pacientes/nuevo", words: "alta crear añadir" },
  { label: "Biblioteca de tests", to: "/biblioteca", words: "exploracion pruebas ortopedicos guia" },
  { label: "Cuestionarios", to: "/biblioteca/cuestionarios", words: "escalas oswestry ndi dash" },
  { label: "Mediciones", to: "/biblioteca/mediciones", words: "saltos fuerza sprint movilidad" },
  { label: "Clínica y protección de datos", to: "/ajustes/clinica", words: "nombre direccion nif colegiado rgpd datos de la clinica" },
  { label: "Marca", to: "/ajustes/marca", words: "logo colores nombre aspecto documentos membrete" },
  { label: "Equipo de la clínica", to: "/ajustes/equipo", words: "fisios compañeros añadir permisos" },
  { label: "Anamnesis de la clínica", to: "/ajustes/anamnesis", words: "preguntas plantilla historia" },
  { label: "Cuestionarios propios", to: "/ajustes/cuestionarios-propios", words: "satisfaccion encuesta crear" },
  { label: "La clínica en números", to: "/ajustes/estadisticas", words: "estadisticas sesiones ausencias graficas" },
  { label: "Precios y cobros", to: "/ajustes/cobros", words: "precio tarifa bono bonos sesion cobrado excel facturar" },
  { label: "Mensajes a pacientes", to: "/ajustes/mensajes", words: "textos whatsapp correo firma plantillas" },
  { label: "Cuenta de Google y copia", to: "/ajustes/cuenta", words: "sincronizar nube servidor dispositivos" },
  { label: "Copias de seguridad y exportar", to: "/ajustes/datos", words: "copia descargar exportar excel restaurar datos de prueba" },
  { label: "Importar datos", to: "/ajustes/importar", words: "excel csv otro programa traer" },
  { label: "Bloqueo con PIN", to: "/ajustes/bloqueo", words: "pin contraseña clave seguridad bloquear" },
  { label: "Aspecto", to: "/ajustes/aspecto", words: "oscuro claro tema modo noche" },
  { label: "Cómo se usa", to: "/ayuda", words: "ayuda manual instrucciones dudas" },
];

const plain = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Las pantallas que encajan con lo escrito (todas sus palabras, sin tildes ni mayúsculas); primero las que lo llevan en el nombre. */
export function findScreens(query: string, limit = 5): Screen[] {
  const words = plain(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hit = (s: Screen) => {
    const name = plain(s.label);
    const all = `${name} ${plain(s.words)}`;
    if (!words.every((w) => all.includes(w))) return 0;
    return words.every((w) => name.includes(w)) ? 2 : 1;
  };
  return SCREENS.map((s) => ({ s, n: hit(s) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((x) => x.s);
}
