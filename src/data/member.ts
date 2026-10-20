// En una clínica (src/cloud/clinic.ts) todo el equipo comparte la base, pero algunas cosas son de cada
// fisioterapeuta: su Google Calendar y su carpeta de Drive, su nombre y nº de colegiado para firmar, y las citas
// que da. Aquí se sabe quién está trabajando (el «sub» de su cuenta de Google); sin clínica, nadie en concreto y
// los ajustes se guardan como siempre.
let current: string | null = null;
let currentEmail: string | null = null;

/** Al abrir la base de una clínica: quién ha entrado (y su correo, con el que sale en el horario). */
export function setMember(sub: string | null, email: string | null = null) {
  current = sub;
  currentEmail = sub && email ? email.trim().toLowerCase() : null;
}

/** Quién trabaja en la base de la clínica, o null sin clínica. */
export const member = () => current;

/** Su correo (en minúsculas), con el que figura en el equipo y en el horario (src/schedule); null sin clínica. */
export const memberEmail = () => currentEmail;

/** La clave de un ajuste de cada persona: en una clínica, «clave@sub»; sin clínica, la de siempre. */
export const memberKey = (key: string) => (current ? `${key}@${current}` : key);

/**
 * Los ajustes de cada persona que hasta ahora eran de la cuenta (src/cloud/googleCalendar.ts y saveToDrive.ts): al
 * llevar los pacientes de la cuenta a una clínica, pasan a ser suyos (syncMerge.ts, prepareForClinic).
 */
export const MEMBER_SETTINGS = ["calendar_auto", "calendar_id", "drive_folder_id"];
