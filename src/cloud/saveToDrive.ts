// Guardar un archivo a la vista en la carpeta «Cénit · Fisiolab» del Drive de quien ha entrado (drive.ts).
import type { Db } from "../data/db";
import { getSetting, setSetting } from "../data/repo";
import { DRIVE_FILE_SCOPE, getToken, hasGranted } from "./auth";
import { AuthError, ensureFolder, uploadVisible, type VisibleFile } from "./drive";

/** Ajuste sincronizado: el id de la carpeta, para que todos los dispositivos de la cuenta usen la misma. */
const FOLDER_KEY = "drive_folder_id";

/** Falta el permiso de archivos de Drive, o la sesión de Google ha caducado: hay que volver a entrar. */
export class NeedsLogin extends Error {}

export async function saveToDrive(db: Db, file: { name: string; mimeType: string; bytes: Uint8Array }): Promise<VisibleFile> {
  if (!hasGranted(DRIVE_FILE_SCOPE)) throw new NeedsLogin("Falta el permiso para guardar archivos en tu Drive: vuelve a entrar con Google y acéptalo.");
  const token = getToken();
  if (!token) throw new NeedsLogin("La sesión de Google ha caducado: vuelve a entrar.");
  if (!navigator.onLine) throw new Error("Sin conexión: guárdalo cuando vuelva internet.");
  try {
    const saved = await getSetting<string>(db, FOLDER_KEY);
    const folder = await ensureFolder(token.accessToken, saved);
    if (folder !== saved) await setSetting(db, FOLDER_KEY, folder);
    return await uploadVisible(token.accessToken, folder, file.name, file.mimeType, file.bytes);
  } catch (e) {
    if (e instanceof AuthError) throw new NeedsLogin(e.message);
    throw e;
  }
}

/** Un nombre de archivo sin caracteres que Drive o los sistemas de archivos no admiten. */
export const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").trim();
