import { describe, expect, it } from "vitest";
import { createAppointment } from "../data/appointments";
import { saveAnamnesis, saveFinding, saveSession } from "../data/clinical";
import { saveSignedConsent } from "../data/consents";
import { createPatient } from "../data/repo";
import { loadSeed } from "../data/seed";
import { createTestDb } from "../data/testDb";
import { readTable } from "../data/importPatients";
import { readZip } from "../data/xlsx";
import { buildPackage } from "./fullExport";
import { crc32, writeXlsx } from "./files";

const text = (b: Uint8Array | undefined) => new TextDecoder().decode(b);

describe("archivos", () => {
  it("CRC-32 de referencia", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
  it("un Excel escrito se vuelve a leer igual (texto, números, tildes y saltos de línea)", async () => {
    const bytes = await writeXlsx([{ name: "Hoja: 1/2", header: ["Nombre", "Peso"], rows: [["Ana <Ruiz> & Co", 61.5], ["Línea 1\nLínea 2", null]] }]);
    expect(await readTable(bytes, "x.xlsx")).toEqual([["Nombre", "Peso"], ["Ana <Ruiz> & Co", "61.5"], ["Línea 1\nLínea 2"]]);
  });
});

describe("exportación completa", () => {
  it("lleva la historia legible de cada paciente, un Excel con todo, el JSON y la copia", async () => {
    const db = await createTestDb();
    await loadSeed(db);
    const pid = await createPatient(db, { name: "Lucía Pérez", birthDate: "1985-03-12", sex: "female", bodyMassKg: 60, heightCm: 165, legLengthCm: null, pushOffDistanceCm: null, notes: "Alérgica al látex", phone: "612345678" });
    await saveAnamnesis(db, pid, { motivo: "Dolor lumbar al levantarse", eva: 6, regiones: ["lumbar"] });
    await saveSession(db, pid, { performedAt: "2026-10-01T09:00:00.000Z", pain: 5, subjective: "Mejor que ayer", objective: "Flexión limitada", treatment: "Terapia manual y ejercicio", plan: "Puente de glúteo 3x10", reviewOn: null, nextAt: null, nextMinutes: null });
    await saveFinding(db, pid, { galleryTest: "slr", testName: "Lasègue", region: "lumbar", performedAt: "2026-10-01T09:10:00.000Z", side: "left", result: "positive", notes: "a 45°" });
    await createAppointment(db, pid, { startsAt: "2026-11-02T10:00:00.000Z", minutes: 45 });
    await saveSignedConsent(
      db,
      pid,
      {
        templateId: "manual",
        version: "1",
        title: "Terapia manual",
        clinic: { name: "Fisio Centro", taxId: "", address: "" },
        professional: { name: "Ana Ruiz", license: "123" },
        patient: { name: "Lucía Pérez", birthDate: null, idDoc: "" },
        representative: null,
        techniques: ["Movilización"],
        sections: [{ title: "Riesgos", items: ["Dolor leve transitorio"] }],
        date: "2026-10-01",
        place: "Sevilla",
      },
      "screen",
      { patient: "data:image/png;base64,iVBORw0KGgo=", professional: "data:image/png;base64,iVBORw0KGgo=" },
    );

    const progress: number[] = [];
    const { bytes, patients } = await buildPackage(db, { progress: (d) => progress.push(d), now: new Date("2026-10-21T10:00:00Z") });
    expect(patients).toBe(4);
    expect(progress.at(-1)).toBe(4);
    const files = await readZip(bytes);
    expect([...files.keys()].filter((f) => !f.startsWith("Historias clinicas/"))).toEqual([
      "LEEME.txt",
      "Indice de pacientes.html",
      "Todos los datos.xlsx",
      "Datos para otro programa (JSON).json",
      "Copia de Cenit.sqlite3",
    ]);
    expect([...files.keys()].filter((f) => f.startsWith("Historias clinicas/"))).toHaveLength(4);

    // La historia de Lucía: todo lo registrado, legible.
    const html = text(files.get("Historias clinicas/Lucía Pérez.html"));
    for (const t of ["Dolor lumbar al levantarse", "6/10", "Lumbar", "Mejor que ayer", "Terapia manual y ejercicio", "Puente de glúteo 3x10", "Lasègue", "Positivo", "Alérgica al látex", "Dolor leve transitorio", "Firma del paciente", "<img", "02/11/2026 11:00", "Pendiente"])
      expect(html, t).toContain(t);
    expect(text(files.get("Indice de pacientes.html"))).toContain("Historias%20clinicas/Luc%C3%ADa%20P%C3%A9rez.html");

    // El Excel: una pestaña por tipo de dato.
    const xlsx = await readZip(files.get("Todos los datos.xlsx")!);
    const workbook = text(xlsx.get("xl/workbook.xml"));
    for (const sheet of ["Pacientes", "Motivos de consulta", "Anamnesis", "Sesiones", "Exploración", "Mediciones", "Cuestionarios", "Bienestar", "Consentimientos", "Citas"])
      expect(workbook, sheet).toContain(`name="${sheet}"`);
    const pacientes = await readTable(files.get("Todos los datos.xlsx")!, "x.xlsx");
    expect(pacientes[0]).toEqual(["Código", "Nombre", "Fecha de nacimiento", "Sexo", "Teléfono", "Correo", "Dirección", "Peso (kg)", "Altura (cm)", "Notas", "Alta en Cénit", "Última modificación"]);
    expect(pacientes.find((r) => r[1] === "Lucía Pérez")?.slice(1, 5)).toEqual(["Lucía Pérez", "12/03/1985", "Mujer", "612345678"]);
    const sesiones = text(xlsx.get("xl/worksheets/sheet4.xml"));
    expect(sesiones).toContain("Puente de glúteo 3x10");
    expect(text(xlsx.get("xl/worksheets/sheet6.xml"))).toContain("Altura del salto"); // mediciones de los datos de ejemplo

    // El JSON, con todas las tablas; y la copia, una base de SQLite.
    const data = JSON.parse(text(files.get("Datos para otro programa (JSON).json"))) as { formato: string; tablas: Record<string, unknown[]> };
    expect(data.formato).toBe("cenit-exportacion");
    expect(data.tablas.sessions!.length).toBeGreaterThan(0);
    expect(data.tablas).not.toHaveProperty("settings");
    expect(text(files.get("Copia de Cenit.sqlite3")!.slice(0, 15))).toBe("SQLite format 3");
    expect(text(files.get("LEEME.txt"))).toContain("4 pacientes");
  });
});
