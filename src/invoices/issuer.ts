// Quien emite las facturas: la clínica con los datos de Ajustes › Clínica y protección de datos (o el fisioterapeuta,
// si trabaja por su cuenta y no ha puesto nombre de clínica).
import type { Party } from "../data/invoices";
import type { ClinicInfo } from "../data/privacy";

export const issuerOf = (clinic: ClinicInfo): Party => ({ name: (clinic.name || clinic.professional).trim(), taxId: clinic.taxId.trim(), address: clinic.address.trim() });
