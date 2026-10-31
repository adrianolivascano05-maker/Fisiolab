import { FPS, flatSentences, norm, SCENES, SceneId, Sentence, Timings, WordTiming } from "./config";

export type SentenceClock = { start: number; end: number; sentence: Sentence; words: { w: string; start: number; end: number }[] };
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

/** Convierte los tiempos de la voz en escenas: cada escena arranca un poco antes de su primera frase. */
export const buildTimeline = (t: Timings): { scenes: SceneClock[]; total: number } => {
  const flat = flatSentences();
  const LEAD = 0.12;
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
        words: (t.sentences[j].words ?? []).map((w: WordTiming) => ({ w: norm(w.w), start: f(w.start) - from, end: f(w.end) - from })),
      }));
    return { id: sc.id, from, dur: next - from, s };
  });
  return { scenes, total };
};

/** Frame (relativo a la escena) en que EMPIEZA una palabra de la frase (n-ésima aparición, desde 0). */
export const wordAt = (c: SentenceClock, word: string, nth = 0): number => {
  const target = norm(word);
  let k = 0;
  for (const w of c.words) {
    if (w.w === target || w.w.startsWith(target)) {
      if (k === nth) return w.start;
      k++;
    }
  }
  return c.start;
};

/** Frame en que TERMINA una palabra. */
export const wordEnd = (c: SentenceClock, word: string, nth = 0): number => {
  const target = norm(word);
  let k = 0;
  for (const w of c.words) {
    if (w.w === target || w.w.startsWith(target)) {
      if (k === nth) return w.end;
      k++;
    }
  }
  return c.end;
};
