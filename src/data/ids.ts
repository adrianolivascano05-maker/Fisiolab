// Identificadores y fechas de la capa de datos.

/** Un id nuevo (UUID v4). */
export const newId = () => crypto.randomUUID();
/** Ahora, en ISO (UTC). */
export const now = () => new Date().toISOString();
