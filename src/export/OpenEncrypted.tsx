// «Abrir una copia cifrada»: el archivo .omniclin y su contraseña, y se descarga lo que hay dentro (el .zip de
// «Descargar todo» o la copia .sqlite3). En Ajustes → Copias y exportar y, sin cuenta ni conexión, en
// /abrir-copia desde la pantalla de entrada (App.tsx, PUBLIC_PAGES): la copia no depende de poder entrar en la app.
import { FileUp, LockOpen } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { saveFile } from "../app/download";
import { WrongPassword } from "../cloud/crypt";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/Field";
import { Logo } from "../ui/Logo";
import { EXPORT_EXTENSION } from "./encryptedExport";

const types: Record<string, string> = { zip: "application/zip", sqlite3: "application/vnd.sqlite3" };
const typeOf = (name: string) => types[name.split(".").pop() ?? ""] ?? "application/octet-stream";

export function OpenEncryptedCard() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const open = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return setError("Elige el archivo .omniclin.");
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const { decryptExport } = await import("./encryptedExport");
      const inner = await decryptExport(new Uint8Array(await file.arrayBuffer()), password);
      saveFile(inner.name, inner.bytes, typeOf(inner.name));
      setDone(inner.name);
      setPassword("");
    } catch (err) {
      setError(err instanceof WrongPassword ? "La contraseña no es la de esta copia." : err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="flex flex-col gap-3">
      <h3 className="font-semibold">Abrir una copia cifrada</h3>
      <p className="text-sm text-text-muted">Un archivo .omniclin (de «Descargar todo» o de la copia de seguridad) y su contraseña: se descarga lo que hay dentro.</p>
      <form className="flex flex-col gap-3" onSubmit={(e) => void open(e)}>
        <input
          ref={input}
          type="file"
          accept={`${EXPORT_EXTENSION},application/octet-stream`}
          className="sr-only"
          aria-label="Elegir copia cifrada"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
            setDone(null);
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" icon={<FileUp aria-hidden="true" className="size-5" />} onClick={() => input.current?.click()}>
            Elegir el archivo
          </Button>
          <span className="text-sm text-text-muted">{file ? file.name : "Ninguno elegido."}</span>
        </div>
        <TextField label="Contraseña de la copia" type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
        {done && (
          <Alert tone="success" title="Copia abierta">
            Descargado: {done}
          </Alert>
        )}
        <Button type="submit" loading={busy} disabled={!file || !password} icon={<LockOpen aria-hidden="true" className="size-5" />}>
          Abrir y descargar lo de dentro
        </Button>
      </form>
    </Card>
  );
}

/** La página pública /abrir-copia: sin cuenta, sin PIN y sin conexión (la app ya instalada la abre igual). */
export function OpenEncryptedPage() {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b-2 border-highlight bg-brand text-on-brand">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Logo onDark />
        </div>
      </header>
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-5 pb-16">
        <h1 className="text-2xl leading-tight font-bold">Abrir una copia cifrada</h1>
        <p className="text-sm text-text-muted">Funciona sin cuenta y sin conexión: la copia no depende de poder entrar en la app.</p>
        <OpenEncryptedCard />
        <a href={import.meta.env.BASE_URL} className="inline-flex min-h-11 items-center font-semibold text-accent underline underline-offset-2">
          Volver a la app
        </a>
      </main>
    </div>
  );
}
