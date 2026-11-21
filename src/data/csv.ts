// Una celda de texto para los CSV que se abren en Excel u hojas de cálculo (punto y coma, como las exportaciones de la
// app). Un texto que empieza por «=», «+», «-», «@», tabulador o retorno lo ejecutaría la hoja como una fórmula (un
// nombre o una nota escritos a propósito podrían, al abrir el archivo, llamar a otra web o ejecutar algo): se le pone
// delante una comilla simple, que la hoja enseña como texto. Los números (también los negativos, «-12,50») se quedan
// tal cual. Si hace falta, entre comillas dobles.

/** Un número escrito como lo escribe la app: «12», «-3,5», «0,25». */
const NUMBER = /^-?\d+(?:[.,]\d+)?$/;

export function csvCell(s: string, { quote = false }: { quote?: boolean } = {}): string {
  const safe = /^[=+\-@\t\r]/.test(s) && !NUMBER.test(s) ? `'${s}` : s;
  return quote || /[;"\n\r]/.test(safe) || safe !== s ? `"${safe.replace(/"/g, '""')}"` : safe;
}
