// Clínicas con equipo (src/data/member.ts y src/cloud/clinic.ts): llevar a la base de la clínica los pacientes de la
// cuenta, los ajustes de cada persona y las citas de cada una.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAppointment, upcomingAppointments } from "./appointments";
import { saveSession } from "./clinical";
import type { Db } from "./db";
import { member, memberKey, setMember } from "./member";
import { emptyClinic, getClinic, saveClinic } from "./privacy";
import { createPatient, getSetting, setSetting } from "./repo";
import { createTestDb } from "./testDb";

const patient = (name: string) => ({ name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
const NOW = new Date("2026-10-20T08:00:00.000Z");
const ANA = "1001";
const EVA = "1002";

let account: Db; // la base de la cuenta de Ana en su dispositivo
let clinic: Db; // la base nueva de la clínica en ese dispositivo
beforeEach(async () => {
  setMember(null);
  account = await createTestDb();
  clinic = await createTestDb();
});
afterEach(() => setMember(null));

describe("ajustes de cada persona", () => {
  it("sin clínica, los de siempre; en una clínica, los de quien ha entrado", () => {
    expect(member()).toBeNull();
    expect(memberKey("calendar_id")).toBe("calendar_id");
    setMember(ANA);
    expect(member()).toBe(ANA);
    expect(memberKey("calendar_id")).toBe(`calendar_id@${ANA}`);
  });

  it("en una clínica, cada fisioterapeuta firma con su nombre; los datos de la clínica son de todos", async () => {
    setMember(ANA);
    await saveClinic(clinic, { ...emptyClinic, name: "Fisiolab", email: "hola@fisiolab.es", professional: "Ana Ruiz", license: "123" });
    setMember(EVA);
    expect(await getClinic(clinic)).toMatchObject({ name: "Fisiolab", email: "hola@fisiolab.es", professional: "", license: "" });
    await saveClinic(clinic, { ...(await getClinic(clinic)), professional: "Eva Gil", license: "456", city: "Madrid" });
    setMember(ANA);
    expect(await getClinic(clinic)).toMatchObject({ name: "Fisiolab", city: "Madrid", professional: "Ana Ruiz", license: "123" });
  });

  it("cada cita es de quien la da y a su calendario solo van las suyas", async () => {
    const pid = await createPatient(clinic, patient("Paciente"));
    setMember(ANA);
    const a = await createAppointment(clinic, pid, { startsAt: "2026-10-21T09:00:00.000Z", minutes: 45 });
    const s = await saveSession(clinic, pid, {
      performedAt: "2026-10-19T10:00:00.000Z",
      pain: null,
      subjective: "",
      objective: "",
      treatment: "",
      plan: "",
      reviewOn: null,
      nextAt: "2026-10-23T09:00:00.000Z",
      nextMinutes: 45,
    });
    setMember(EVA);
    const e = await createAppointment(clinic, pid, { startsAt: "2026-10-22T09:00:00.000Z", minutes: 45 });
    expect((await upcomingAppointments(clinic, NOW)).map((x) => x.id)).toEqual([a, e, s]);
    expect((await upcomingAppointments(clinic, NOW, { sub: ANA, email: null })).map((x) => x.id)).toEqual([a, s]);
    expect((await upcomingAppointments(clinic, NOW, { sub: EVA, email: null })).map((x) => x.id)).toEqual([e]);
  });
});

describe("llevar a la clínica los pacientes de la cuenta", () => {
  async function accountWithData() {
    const pid = await createPatient(account, patient("Ana Paciente"));
    await createAppointment(account, pid, { startsAt: "2026-10-21T09:00:00.000Z", minutes: 45 });
    await setSetting(account, "drive_encryption", { salt: "sal-de-la-cuenta" });
    await setSetting(account, "calendar_id", "cal-de-ana");
    await setSetting(account, "calendar_auto", { enabled: true, names: "full" });
    await setSetting(account, "drive_folder_id", "carpeta-de-ana");
    await setSetting(account, "mvt.squat", 0.3);
    await saveClinic(account, { ...emptyClinic, name: "Consulta de Ana", email: "ana@consulta.es", professional: "Ana Ruiz", license: "123" });
    return pid;
  }

  it("pasan los pacientes; lo de la persona, a su nombre; la contraseña de la cuenta no", async () => {
    const pid = await accountWithData();
    expect(await clinic.merge((await account.snapshot()).bytes, ANA)).toMatchObject({ pulled: expect.any(Number) });
    expect(await clinic.query("select id, name from patients")).toEqual([{ id: pid, name: "Ana Paciente" }]);
    expect(await clinic.query("select created_by from appointments")).toEqual([{ created_by: ANA }]);
    expect(await getSetting(clinic, "drive_encryption")).toBeNull();
    expect(await getSetting(clinic, "calendar_id")).toBeNull();
    expect(await getSetting(clinic, `calendar_id@${ANA}`)).toBe("cal-de-ana");
    expect(await getSetting(clinic, `calendar_auto@${ANA}`)).toEqual({ enabled: true, names: "full" });
    expect(await getSetting(clinic, `drive_folder_id@${ANA}`)).toBe("carpeta-de-ana");
    expect(await getSetting(clinic, "mvt.squat")).toBe(0.3);
    setMember(ANA);
    expect(await getClinic(clinic)).toMatchObject({ name: "Consulta de Ana", professional: "Ana Ruiz", license: "123" });
    setMember(EVA);
    expect(await getClinic(clinic)).toMatchObject({ name: "Consulta de Ana", professional: "", license: "" });
    // La base de la cuenta no cambia.
    expect(await getSetting(account, "calendar_id")).toBe("cal-de-ana");
    expect(await getSetting(account, "drive_encryption")).toEqual({ salt: "sal-de-la-cuenta" });
    // El registro de cambios lleva lo que hay que subir a la copia de la clínica, sin la contraseña de la cuenta.
    const log = (await clinic.query<{ pk: string }>("select pk from sync_changes where tbl = 'settings' order by pk")).map((r) => r.pk);
    expect(log).toEqual([`calendar_auto@${ANA}`, `calendar_id@${ANA}`, "clinic_privacy", `drive_folder_id@${ANA}`, "mvt.squat", `professional@${ANA}`]);
  });

  it("si la clínica ya tiene sus ajustes, ganan los suyos; los pacientes se juntan", async () => {
    await accountWithData();
    // La copia de la clínica, ya en marcha (con su contraseña y sus datos), llega antes a este dispositivo.
    const team = await createTestDb();
    setMember(EVA);
    await createPatient(team, patient("Paciente de Eva"));
    await setSetting(team, "drive_encryption", { salt: "sal-de-la-clinica" });
    await saveClinic(team, { ...emptyClinic, name: "Fisiolab", email: "hola@fisiolab.es", professional: "Eva Gil" });
    await setSetting(team, "mvt.squat", 0.25);
    setMember(null);
    await clinic.merge((await team.snapshot()).bytes);
    await clinic.merge((await account.snapshot()).bytes, ANA);
    expect((await clinic.query<{ name: string }>("select name from patients order by name")).map((p) => p.name)).toEqual(["Ana Paciente", "Paciente de Eva"]);
    expect(await getSetting(clinic, "drive_encryption")).toEqual({ salt: "sal-de-la-clinica" });
    expect(await getSetting(clinic, "mvt.squat")).toBe(0.25);
    setMember(ANA);
    expect(await getClinic(clinic)).toMatchObject({ name: "Fisiolab", professional: "Ana Ruiz" });
    setMember(EVA);
    expect(await getClinic(clinic)).toMatchObject({ name: "Fisiolab", professional: "Eva Gil" });
    // Y al revés: si la base de la cuenta llega primero, la de la clínica sigue ganando al juntarse con ella.
    const other = await createTestDb();
    await other.merge((await account.snapshot()).bytes, ANA);
    expect(await other.merge((await team.snapshot()).bytes)).toMatchObject({ needUpload: true });
    expect(await getSetting(other, "mvt.squat")).toBe(0.25);
    expect(await getSetting(other, "drive_encryption")).toEqual({ salt: "sal-de-la-clinica" });
  });
});
