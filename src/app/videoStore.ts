// El vídeo no se guarda en la base: se queda en la galería del móvil.
// Mientras dura la sesión, guardamos aquí el archivo elegido para cada test.
const files = new Map<string, File>();

export const videoStore = {
  set: (testId: string, file: File) => files.set(testId, file),
  get: (testId: string) => files.get(testId) ?? null,
};
