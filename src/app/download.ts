// Guardar un archivo en el dispositivo (la descarga del navegador): texto o bytes, con su nombre y su tipo. Lo usan
// todos los botones de «Descargar» de la app.
export function saveFile(name: string, data: string | Uint8Array, type: string) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  // En el documento, para que también funcione en Firefox; se quita al momento.
  document.body.append(a);
  a.click();
  a.remove();
  // El navegador ya tiene el archivo; la dirección temporal se libera pasado un rato.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
