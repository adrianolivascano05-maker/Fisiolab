// La ficha de anamnesis de la clínica: la de siempre más sus campos propios (Ajustes → Anamnesis de la clínica).
import { useMemo } from "react";
import { useDataVersion } from "../app/dataVersion";
import { useAsync } from "../app/useAsync";
import { getCustomFields } from "../data/customFields";
import { getDb } from "../data/db";
import { withCustom, type Section } from "./anamnesis";

export function useAnamnesisSections(): Section[] {
  const version = useDataVersion();
  const custom = useAsync(() => getCustomFields(getDb()), [version]);
  return useMemo(() => withCustom(custom.data ?? []), [custom.data]);
}
