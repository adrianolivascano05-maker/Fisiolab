// La cuenta con la que se ha entrado en este dispositivo. Cada cuenta tiene su propia base en el dispositivo
// (fisiolab-u<id de Google>.sqlite3) y su propia copia en su Google Drive: los pacientes de un fisioterapeuta
// no se mezclan con los de otro aunque usen el mismo móvil.

export type Account = { sub: string; email: string; name: string; picture?: string };

const KEY = "fisiolab.account";
/** Pasar a esta cuenta los datos que había en el dispositivo sin cuenta (se hace una vez, al entrar). */
const ADOPT_KEY = "fisiolab.adopt";

export function getAccount(): Account | null {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) ?? "null") as Account | null;
    return a?.sub ? a : null;
  } catch {
    return null;
  }
}

export function setAccount(a: Account, adoptLocalData: boolean) {
  localStorage.setItem(KEY, JSON.stringify(a));
  if (adoptLocalData) localStorage.setItem(ADOPT_KEY, a.sub);
  else localStorage.removeItem(ADOPT_KEY);
}

export function clearAccount() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(ADOPT_KEY);
}

/** Nombre de la base de la cuenta en el dispositivo y si hay que pasarle los datos sin cuenta. */
export function dbFileFor(a: Account): { name: string; adopt: boolean } {
  return { name: `fisiolab-u${a.sub.replace(/[^0-9a-zA-Z]/g, "")}`, adopt: localStorage.getItem(ADOPT_KEY) === a.sub };
}

/** Ya se han pasado los datos: no se vuelve a intentar. */
export function adoptionDone() {
  localStorage.removeItem(ADOPT_KEY);
}
