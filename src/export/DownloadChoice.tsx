// Al descargar una copia (Descargar todo, la copia .sqlite3 o una de antes de actualizar), elegir: cifrada con
// contraseña (recomendado) dentro de un .omniclin (encryptedExport.ts), o sin cifrar para entregarla o llevarla a
// otro programa.
import { Download } from "lucide-react";
import { useState, type FormEvent } from "react";
import { saveFile } from "../app/download";
import { MIN_PASSWORD } from "../cloud/crypt";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { checkExportPassword } from "./encryptedExport";

/** `null`: sin cifrar. */
export type DownloadPick = { password: string | null };

export function DownloadChoice({ open, onClose, what, onPick }: { open: boolean; onClose: () => void; what: string; onPick: (pick: DownloadPick) => void }) {
  const [mode, setMode] = useState<"encrypted" | "plain">("encrypted");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reset = () => {
    setPassword("");
    setRepeat("");
    setError(null);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "encrypted") {
      const problem = checkExportPassword(password, repeat);
      if (problem) return setError(problem);
    }
    const pick = { password: mode === "encrypted" ? password : null };
    reset();
    onPick(pick);
  };
  const option = (value: "encrypted" | "plain", title: string, text: string) => (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
      <input type="radio" name="download-mode" className="mt-1 size-5 accent-accent" checked={mode === value} onChange={() => setMode(value)} />
      <span className="flex flex-col">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-text-muted">{text}</span>
      </span>
    </label>
  );
  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Cómo descargar"
    >
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <p className="text-sm text-text-muted">{what}</p>
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Cómo descargar</legend>
          {option("encrypted", "Cifrada con contraseña (recomendado)", "Un archivo .omniclin que solo se abre con la contraseña (en Ajustes → «Abrir una copia cifrada», también sin cuenta).")}
          {option("plain", "Sin cifrar (para entregarla o llevarla a otro programa)", "El archivo tal cual: se abre en cualquier sitio.")}
        </fieldset>
        {mode === "encrypted" ? (
          <>
            <TextField
              label="Contraseña"
              type="password"
              autoComplete="new-password"
              hint={`Al menos ${MIN_PASSWORD} caracteres. Puede ser la de la clínica u otra.`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <TextField label="Repite la contraseña" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
            <Alert tone="warning" title="Si la olvidas, esta copia no se puede abrir">
              Nadie puede recuperarla: ni la clínica ni quien lleva el servidor.
            </Alert>
          </>
        ) : (
          <Alert tone="warning" title="Contiene historias clínicas sin proteger">
            Guárdala en un sitio seguro y bórrala cuando no haga falta.
          </Alert>
        )}
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
        <Button type="submit" icon={<Download aria-hidden="true" className="size-5" />}>
          Descargar
        </Button>
      </form>
    </Sheet>
  );
}

/** Guarda el archivo tal cual, o cifrado con la contraseña dentro de un .omniclin. */
export async function saveMaybeEncrypted(name: string, bytes: Uint8Array, type: string, password: string | null) {
  if (password === null) return saveFile(name, bytes, type);
  const { encryptExport, encryptedName } = await import("./encryptedExport");
  saveFile(encryptedName(name), await encryptExport(bytes, name, password), "application/octet-stream");
}
