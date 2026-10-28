// Agenda › Hoy › «Sin cobrar»: quién tiene algo pendiente en toda la clínica (sesiones sueltas sin pagar y bonos sin
// cobrar) y, con un toque, su cuenta. Vuelve a Hoy.
import { UserRound, Wallet } from "lucide-react";
import { Link } from "react-router";
import { useDataVersion } from "../app/dataVersion";
import { fmtDate } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { todayDay } from "../clinical/pageKit";
import { euros, getPricing, pendingAccounts } from "../data/billing";
import { getDb } from "../data/db";
import { EmptyState } from "../ui/EmptyState";

export function DebtorsPage() {
  const version = useDataVersion();
  const data = useAsync(async () => {
    const db = getDb();
    const [debtors, pricing] = await Promise.all([pendingAccounts(db, todayDay()), getPricing(db)]);
    return { debtors, pricing };
  }, [version]);
  const total = data.data?.debtors.reduce((n, d) => n + d.balanceCents, 0) ?? 0;
  return (
    <Page title="Sin cobrar" backTo="/agenda?vista=hoy" backLabel="Hoy">
      {data.error ? (
        <LoadError error={data.error} />
      ) : !data.data ? (
        <Loading />
      ) : data.data.debtors.length === 0 ? (
        <EmptyState icon={Wallet} title="Nadie tiene nada pendiente">
          {data.data.pricing.sessionCents === null && data.data.pricing.since === null ? (
            <>
              Sin precio de la sesión solo cuentan los bonos.{" "}
              <Link to="/ajustes/cobros" className="font-semibold text-accent underline underline-offset-2">
                Pon el precio
              </Link>{" "}
              para ver también las sesiones sueltas.
            </>
          ) : (
            "Todas las sesiones y los bonos están cobrados."
          )}
        </EmptyState>
      ) : (
        <>
          <p className="text-lg font-semibold">
            {euros(total)} · {data.data.debtors.length === 1 ? "1 paciente" : `${data.data.debtors.length} pacientes`}
          </p>
          <ul aria-label="Pendiente de cobro" className="flex flex-col divide-y divide-border rounded-lg border border-border bg-bg">
            {data.data.debtors.map((x) => (
              <li key={x.patientId} className="flex items-stretch">
                <Link to={`/pacientes/${x.patientId}/cobros`} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3 py-2 hover:bg-surface">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{x.name}</span>
                    <span className="block text-sm text-text-muted">{x.lastPaidOn ? `Último cobro el ${fmtDate(`${x.lastPaidOn}T12:00:00`)}` : "Sin cobros"}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{euros(x.balanceCents)}</span>
                </Link>
                <Link to={`/pacientes/${x.patientId}`} aria-label={`Ficha de ${x.name}`} className="tap flex items-center justify-center border-l border-border px-3 text-accent hover:bg-surface">
                  <UserRound aria-hidden="true" className="size-5" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Page>
  );
}
