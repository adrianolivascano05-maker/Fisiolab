// Los rangos publicados de un cuestionario, con su cita: una tabla para leer la nota al lado. No se marca en qué
// rango cae el paciente ni se dice nada de él: la lectura es del profesional.
import type { QuestionnaireKind } from "./questionnaires";

export function RangesTable({ ranges }: { ranges: NonNullable<QuestionnaireKind["ranges"]> }) {
  return (
    <figure className="flex flex-col gap-1">
      <table className="w-full text-sm">
        <caption className="pb-1 text-left font-semibold">Rangos publicados: {ranges.title.toLowerCase()}</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Nota</th>
            <th scope="col">Rango</th>
          </tr>
        </thead>
        <tbody>
          {ranges.rows.map((r) => (
            <tr key={r.from} className="border-t border-border">
              <td className="nums py-1 pr-3 whitespace-nowrap">{r.from === r.to ? r.from : `${r.from}–${r.to}`}</td>
              <td className="py-1">{r.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption className="text-xs text-text-muted">Fuente: {ranges.cite}</figcaption>
    </figure>
  );
}
