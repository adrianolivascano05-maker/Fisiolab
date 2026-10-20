-- Tablas del servidor de datos de Cénit en Cloudflare D1 (ver README.md).
-- Se pueden ejecutar varias veces: no borran nada.

-- La copia vigente de cada clínica («owner»: «clinic:<id>») o, de versiones anteriores, de cada fisioterapeuta
-- («owner»: su identificador de Google, «sub»).
-- «size»: caracteres del texto base64 de la copia.
CREATE TABLE IF NOT EXISTS heads (
  owner TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  parts INTEGER NOT NULL,
  size INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

-- Los trozos de cada copia, en texto base64 de como mucho 1 000 000 caracteres (D1 no admite filas de más de
-- 2 MB). La copia siempre llega cifrada desde el dispositivo: aquí solo hay datos ilegibles sin la contraseña.
CREATE TABLE IF NOT EXISTS parts (
  owner TEXT NOT NULL,
  version TEXT NOT NULL,
  idx INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (owner, version, idx)
);

-- Las clínicas: quien está en ALLOWED_EMAILS crea la suya y queda como administrador. Su copia va en heads/parts
-- con owner «clinic:<id>», cifrada con la contraseña de la clínica, que el servidor no conoce.
CREATE TABLE IF NOT EXISTS clinics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- El equipo de cada clínica, por correo de Google (en minúsculas). «admin» añade y quita gente; «member» trabaja
-- con los pacientes de la clínica. Siempre queda al menos un administrador.
CREATE TABLE IF NOT EXISTS members (
  clinic_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  added_by TEXT NOT NULL,
  added_at TEXT NOT NULL,
  PRIMARY KEY (clinic_id, email)
);
CREATE INDEX IF NOT EXISTS members_by_email ON members (email);

-- La clave de la copia de cada clínica cerrada con su código de recuperación (src/cloud/crypt.ts). Sin el código,
-- que solo tiene la clínica en su kit impreso, no sirve para nada.
CREATE TABLE IF NOT EXISTS recovery (
  clinic_id TEXT PRIMARY KEY,
  blob TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
