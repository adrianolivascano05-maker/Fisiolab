// Una dirección de vuelta que llega en la URL (?volver=…): solo se acepta si es una ruta de esta app. «//otra.web» o
// «/\otra.web» las trata el navegador (y React Router) como direcciones de otro sitio: un enlace preparado podría
// llevar el botón «Volver» a una página falsa.

/** La ruta si es interna («/pacientes/…»); null si no lo es. */
export function internalPath(value: string | null | undefined): string | null {
  if (!value || value.length > 2000) return null;
  // Empieza por una sola «/», sin «\», sin espacios ni caracteres de control, y sin «//» ni esquema delante.
  if (!/^\/(?![/\\])/.test(value) || /[\\\s]/.test(value)) return null;
  for (let i = 0; i < value.length; i++) if (value.charCodeAt(i) < 32) return null;
  return value;
}
