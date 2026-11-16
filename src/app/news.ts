// «Novedades»: lo que ha cambiado de sitio o es nuevo, dicho en una frase y con su enlace. Al subir NEWS_VERSION, quien
// ya usaba la app ve un aviso una vez (src/app/NewsNotice.tsx); quien la estrena, no.
export type NewsItem = { title: string; text: string; to?: string };

/** Sube con cada tanda de cambios que mueve cosas de sitio. */
export const NEWS_VERSION = 1;

export const NEWS: NewsItem[] = [
  { title: "Botón «＋» en el centro de la barra", text: "Dar una cita, crear un paciente, volver a los últimos que has abierto y buscar un paciente o una pantalla escribiendo. Dentro de una ficha, primero lo de ese paciente." },
  { title: "La cabecera de la ficha, más corta", text: "El teléfono, el correo, el peso, «Editar sus datos» y quién ha abierto la ficha están ahora en «Más datos» (los tres puntos junto al nombre). Las pestañas de la ficha también se pasan deslizando el dedo." },
  { title: "El calendario del paciente, con color", text: "Cada día dice qué hay con una etiqueta de color: citas, médico, viajes, deporte y otros. Los filtros de arriba cuentan cuántos hay de cada uno." },
  { title: "La agenda del día, en lista", text: "En el móvil, una tira con la semana y el día en una lista con los huecos libres. La rejilla de siempre sigue en el botón «Ver el día en rejilla»; «Bloquear horas o días» es ahora un botón con icono, al lado.", to: "/agenda" },
  { title: "Apuntar una sesión", text: "El dolor de la última vez sale marcado, cada texto tiene «Igual que la última», lo escrito se guarda como borrador en ese dispositivo y «Guardar» está siempre a la vista." },
  { title: "Listas largas que se pliegan", text: "Con más de tres sesiones, solo la última sale abierta: las demás se abren al tocarlas, hay «Abrir todas» y un buscador. Los cobros, igual, con el total de cada mes." },
  { title: "El Resumen de la ficha", text: "Arriba, «Lo siguiente» (lo pendiente más importante) y cuatro cifras que se tocan: dolor, sesiones, cuestionario, y bonos y cobros. Documentos y Legal van plegados en una fila cada uno: se abren al tocarlos." },
  { title: "La lista de pacientes", text: "Debajo del buscador, Todos, Hoy, Sin cita y Deben filtran con un toque. Cada fila dice por qué viene, cuántas sesiones lleva y lo más urgente. Las letras de la A a la Z van en una tira que se desliza." },
  { title: "Dar cita eligiendo un hueco", text: "Al dar una cita, tres huecos libres propuestos (primero su hora de siempre) y las horas libres del día que elijas. La hora a mano sigue donde estaba." },
  { title: "«Deshacer»", text: "Al dar, cambiar o anular una cita, al cobrar y al borrar un evento de su calendario, el aviso lleva «Deshacer» durante unos segundos." },
  { title: "«Hoy», con tres cifras", text: "Arriba de Agenda › Hoy: cuántas citas hay, cuántas quedan por atender y cuánto hay por cobrar.", to: "/agenda?vista=hoy" },
  { title: "Ajustes, con buscador", text: "Escribe lo que buscas («precio», «PIN», «copia»). Los apartados están ahora en cinco grupos: Tu clínica, La consulta, Dinero, Mensajes, y Seguridad y datos.", to: "/ajustes" },
];

const KEY = "omniclin.novedades";

/** La última versión de las novedades vista en este dispositivo (null: nunca se ha apuntado). */
export function newsSeen(): number | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? null : Number(v) || 0;
  } catch {
    return NEWS_VERSION;
  }
}

export function markNewsSeen(): void {
  try {
    localStorage.setItem(KEY, String(NEWS_VERSION));
  } catch {
    /* sin almacenamiento: el aviso vuelve a salir la próxima vez */
  }
}
