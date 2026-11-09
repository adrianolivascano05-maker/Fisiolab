// Un paso del formulario de la anamnesis del paciente (src/patientForm/PublicFormPage.tsx): un apartado con sus
// preguntas, las que tienen «Mostrar solo si…» debajo de la suya cuando se cumple, y las obligatorias con
// «(necesaria)». También la vista previa «Ver cómo lo verá» de la ficha (todos los pasos seguidos).
import { useState, type Ref } from "react";
import { visibleFields, type Field, type Section } from "../clinical/anamnesis";
import { FieldInput } from "../clinical/FieldInput";
import type { AnswerValue } from "../data/clinical";
import { Card } from "../ui/Card";

const filled = (v: unknown) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);

/** Las obligatorias de un paso que se ven y están sin contestar, en su orden. */
export function missingRequired(section: Section, answers: Record<string, unknown>): Field[] {
  return visibleFields(section.fields, answers).filter((f) => f.required && !f.sensitive && !filled(answers[f.id]));
}

/** Lleva a una pregunta y pone el foco en su primer campo. */
export function focusField(id: string) {
  const el = document.getElementById(`campo-${id}`);
  el?.scrollIntoView({ block: "center" });
  el?.querySelector<HTMLElement>("input, textarea, select, button")?.focus();
}

/** Las respuestas de las preguntas que, por su condición, no se ven: no se mandan. */
export function withoutHidden(sections: Section[], answers: Record<string, unknown>): Record<string, unknown> {
  const out = { ...answers };
  for (const s of sections) {
    const shown = new Set(visibleFields(s.fields, answers).map((f) => f.id));
    for (const f of s.fields) if (!shown.has(f.id)) delete out[f.id];
  }
  return out;
}

export function AnamnesisStep({
  section,
  answers,
  onAnswer,
  titleRef,
}: {
  section: Section;
  answers: Record<string, unknown>;
  onAnswer: (id: string, v: AnswerValue) => void;
  titleRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <h2 ref={titleRef} tabIndex={-1} className="text-lg outline-none">
        {section.title}
      </h2>
      {visibleFields(section.fields, answers).map((f) => (
        <div key={f.id} id={`campo-${f.id}`}>
          <FieldInput patient field={f} value={answers[f.id] as AnswerValue | undefined} onChange={(v) => onAnswer(f.id, v)} />
        </div>
      ))}
    </Card>
  );
}

/** «Ver cómo lo verá»: los pasos del formulario uno detrás de otro, para probarlos (no se guarda nada). */
export function AnamnesisPreview({ sections, guardian }: { sections: Section[]; guardian?: boolean }) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  return (
    <div className="flex flex-col gap-4">
      {guardian && <p className="text-sm">Al principio se le pregunta quién contesta: el propio paciente o su madre, padre o tutor.</p>}
      {sections.map((s, i) => (
        <section key={s.id} aria-label={`Paso ${i + 1} de ${sections.length}`} className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-text-muted">
            Paso {i + 1} de {sections.length}
          </p>
          <AnamnesisStep section={s} answers={answers} onAnswer={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))} />
        </section>
      ))}
      <p className="text-sm text-text-muted">Es una prueba: lo que marques aquí no se guarda.</p>
    </div>
  );
}
