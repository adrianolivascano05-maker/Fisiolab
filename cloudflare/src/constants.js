// @ts-check

// ---------- Límites y constantes ----------

/**
 * La versión de este servidor (el día del último cambio; «.2» si es el segundo de ese día). La app la compara con la que espera
 * (src/cloud/serverStatus.ts) y, si es anterior, avisa a quien gestiona el servidor de que pegue el worker.js nuevo.
 */
export const SERVER_VERSION = "2026-10-30";

/** Las copias cifradas por la app (src/cloud/crypt.ts) empiezan por «CENITENC1»: en base64, así. */
export const MAGIC = "Q0VOSVRFTkMx";

/** Caracteres por trozo (1 MB, todo ASCII): D1 no admite filas de más de 2 MB. */
export const PART_CHARS = 1_000_000;

/** Tamaño máximo de una copia: 50 MB, en caracteres de base64. */
export const MAX_CHARS = Math.ceil((50 * 1024 * 1024) / 3) * 4;

/** Trozos por viaje a D1, al escribir y al leer. */
export const PARTS_PER_TRIP = 4;

/** La copia en R2: empieza por «CENITENC2» (cifrada por trozos, src/cloud/crypt.ts) y se sube en trozos de 8 MiB. */
export const COPY_MAGIC = new TextEncoder().encode("CENITENC2");

export const COPY_PART_BYTES = 8 * 1024 * 1024;

/** Tamaño máximo de una copia en R2: de sobra (una clínica de 10.000 pacientes ocupa unos 54 MB). */
export const MAX_COPY_BYTES = 2 * 1024 * 1024 * 1024;

/** Lotes de cambios por respuesta, y caracteres como mucho (se piden los siguientes con «more»). */
export const DELTAS_PER_TRIP = 100;

export const DELTA_TRIP_CHARS = 3_000_000;

/** Días que una clínica borrada se puede recuperar antes de borrarse para siempre. */
export const DELETE_GRACE_DAYS = 30;

/** Solicitudes de acceso pendientes como mucho (para que nadie llene la base pidiendo sin parar). */
export const MAX_PENDING_REQUESTS = 200;

/** Personas como mucho en el equipo de una clínica. */
export const MAX_MEMBERS = 100;

// Formularios para el paciente: la app los cifra con una clave que va solo en el enlace (después de «#», que el
// navegador no manda al servidor), así que aquí no hay más que bytes ilegibles. El id lo pone la app al azar.
export const FORM_ID = /^[A-Za-z0-9_-]{22,64}$/;

/** Caracteres del formulario cifrado y de las respuestas cifradas (base64). */
export const MAX_FORM_CHARS = 200_000;

export const MAX_ANSWER_CHARS = 400_000;

/** Un enlace vale como mucho estos días; las respuestas que nadie recoge se borran a los 60. */
export const MAX_FORM_DAYS = 30;

export const KEEP_ANSWERS_DAYS = 60;

/** Formularios sin recoger a la vez en una clínica. */
export const MAX_OPEN_FORMS = 500;

// Documentos: la app los cifra antes de subirlos («CENITDOC1», vector de inicio y AES-GCM) con una clave que solo está
// en la base de la clínica (o en el enlace del paciente), así que en R2 solo hay bytes ilegibles. Cada uno se guarda
// en R2 como «<clínica>/<id>» y en la tabla documents se apunta lo que ocupa, para el tope de todo el almacén.
export const DOC_MAGIC = new TextEncoder().encode("CENITDOC1");

/** Id de un documento: el que pone la app al azar, o «<formulario>.<n>» si lo subió un paciente con su enlace. */
export const DOC_ID = /^[A-Za-z0-9_-]{22,64}(\.(?:[1-9]|10))?$/;

/** Un documento, como mucho: 5 MB y lo que añade el cifrado (con margen). */
export const MAX_DOC_BYTES = 5 * 1024 * 1024 + 64 * 1024;

/** Tope de todo el almacén si no se dice otro con DOCS_CAP_GB (el nivel gratuito de R2 es de 10 GB al mes). */
export const DOCS_CAP_GB = 10;

/** Desde qué parte del tope se avisa (en la app y en el panel del proveedor). */
export const WARN_SHARE = 0.7;

/** Lo que puede ocupar la base D1, en MB, si no se dice otro con D1_CAP_MB: 500 en el plan gratuito (10 000 de pago). */
export const D1_CAP_MB = 500;

/** Peticiones al día del plan gratuito de Workers, para toda la cuenta (se ponen a cero a las 00:00 UTC). */
export const DAILY_REQUESTS = 100_000;

/** Documentos que puede subir un paciente con un mismo enlace, como mucho. */
export const MAX_DOCS_PER_FORM = 10;

/** Documentos de pacientes sin recoger que se limpian en cada pasada. */
export const DOC_PURGE_BATCH = 100;

/** Tokens comprobados que se recuerdan, y durante cuánto como mucho (segundos). */
export const CACHE_ENTRIES = 200;

export const CACHE_SECONDS = 300;
