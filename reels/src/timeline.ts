import { FPS, flatSentences, SCENES, SceneId, Sentence, Timings } from "./config";

export type SentenceClock = { start: number; end: number; sentence: Sentence };
export type SceneClock = {
  id: SceneId;
  /** Frame de inicio en la línea de tiempo principal */
  from: number;
  /** Duración en frames */
  dur: number;
  /** Frases en frames RELATIVOS al inicio de la escena */
  s: SentenceClock[];
};

const f = (sec: number) => Math.round(sec * FPS);

/** Convierte los tiempos de la voz en escenas: cada escena arranca con su primera frase
 *  (un poco antes, para que el corte caiga justo antes de hablar). */
export const buildTimeline = (t: Timings): { scenes: SceneClock[]; total: number } => {
  const flat = flatSentences();
  const LEAD = 0.12; // s que la escena empieza antes de su primera frase
  const starts: number[] = SCENES.map((sc, i) => {
    const idx = flat.findIndex((x) => x.scene === sc.id);
    return i === 0 ? 0 : f(t.sentences[idx].start - LEAD);
  });
  const total = f(t.sentences[t.sentences.length - 1].end + t.tail);
  const scenes = SCENES.map((sc, i) => {
    const from = starts[i];
    const next = i + 1 < SCENES.length ? starts[i + 1] : total;
    const s = flat
      .map((x, j) => ({ x, j }))
      .filter(({ x }) => x.scene === sc.id)
      .map(({ x, j }) => ({
        start: f(t.sentences[j].start) - from,
        end: f(t.sentences[j].end) - from,
        sentence: x.sentence,
      }));
    return { id: sc.id, from, dur: next - from, s };
  });
  return { scenes, total };
};

/** Frame (relativo) en el que se pronuncia aproximadamente una palabra de la frase. */
export const wordAt = (c: SentenceClock, word: string): number => {
  const text = c.sentence.text;
  const i = text.toLowerCase().indexOf(word.toLowerCase());
  const pos = i < 0 ? 0 : i;
  return Math.round(c.start + ((c.end - c.start) * pos) / Math.max(1, text.length));
};
