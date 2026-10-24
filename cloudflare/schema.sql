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

-- Quién puede crear clínicas además de ALLOWED_EMAILS: lo da de alta el proveedor desde su panel de la app.
CREATE TABLE IF NOT EXISTS creators (
  email TEXT PRIMARY KEY,
  added_by TEXT NOT NULL,
  added_at TEXT NOT NULL
);

-- El estado de cada clínica: suspendida (no sube nada, sí baja) o borrada (papelera de 30 días, con la declaración de
-- quién la borró). Sin fila, normal.
CREATE TABLE IF NOT EXISTS clinic_status (
  clinic_id TEXT PRIMARY KEY,
  suspended_at TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  declaration TEXT,
  purge_after TEXT
);

-- Sincronización por cambios de las clínicas (src/cloud/README.md): cada dispositivo sube solo lo que ha cambiado,
-- cifrado, con un número correlativo («seq»); los demás bajan lo que va después del último que tienen. Cada cierto
-- tiempo un dispositivo sube la copia entera, que ya lleva todo hasta «seq» de delta_base, y los cambios anteriores
-- se borran. «epoch» cambia si se borra la copia: los dispositivos saben que tienen que volver a empezar.
CREATE TABLE IF NOT EXISTS deltas (
  owner TEXT NOT NULL,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (owner, seq)
);
CREATE TABLE IF NOT EXISTS delta_base (
  owner TEXT PRIMARY KEY,
  epoch TEXT NOT NULL,
  seq INTEGER NOT NULL
);

-- Solicitudes de acceso: quien entra con Google sin permiso para dar de alta una clínica puede pedirlo desde la app;
-- el proveedor la acepta (pasa a creators) o la rechaza desde su panel. Una por correo.
CREATE TABLE IF NOT EXISTS access_requests (
  email TEXT PRIMARY KEY,
  clinic TEXT NOT NULL,
  note TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'rejected')),
  created_at TEXT NOT NULL,
  answered_at TEXT
);

-- Formularios para el paciente: la clínica manda un enlace (su parte de la anamnesis o un cuestionario) y el paciente
-- lo rellena en su móvil, sin cuenta. El formulario («request») y las respuestas («response») llegan cifrados con una
-- clave que solo está en el enlace: aquí no se puede leer nada. Los que caducan sin responder se borran; las
-- respuestas, en cuanto la app las recoge (o a los 60 días si nadie lo hace).
CREATE TABLE IF NOT EXISTS patient_forms (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  request TEXT NOT NULL,
  response TEXT,
  answered_at TEXT
);
CREATE INDEX IF NOT EXISTS patient_forms_by_clinic ON patient_forms (clinic_id, answered_at);

-- Reserva online: la página pública de cada clínica. La app sube su clave PÚBLICA (con la que el móvil del paciente
-- cifra sus datos), lo que se enseña (nombre, tipos de cita, fisios por su nombre de pila) y las franjas libres.
-- Nunca las citas ni los pacientes.
CREATE TABLE IF NOT EXISTS booking_pages (
  clinic_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  page TEXT NOT NULL,
  windows TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Las reservas: hora, duración, con quién y el tipo, en claro (para no dar dos veces el mismo hueco); los datos del
-- paciente, cifrados para la clínica, y se borran al recogerlos. «cancel_hash»: la huella del código del enlace para
-- anular (el código solo lo tienen el paciente y la clínica). «client»: huella del origen, para limitar abusos.
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  pro TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT,
  cancel_hash TEXT NOT NULL UNIQUE,
  client TEXT NOT NULL,
  created_at TEXT NOT NULL,
  collected_at TEXT,
  cancelled_at TEXT,
  cancel_seen_at TEXT
);
CREATE INDEX IF NOT EXISTS bookings_by_clinic ON bookings (clinic_id, starts_at);
CREATE INDEX IF NOT EXISTS bookings_by_client ON bookings (client, created_at);

-- Enlaces para anular las citas que da la clínica (los de las reservas van en «bookings»): a qué cita de la app van
-- («ref», su id), cuándo es y con quién, para enseñarlo al paciente. Nada más.
CREATE TABLE IF NOT EXISTS cancel_links (
  hash TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  ref TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  label TEXT NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 0,
  pro TEXT,
  created_at TEXT NOT NULL,
  cancelled_at TEXT,
  cancel_seen_at TEXT
);
CREATE INDEX IF NOT EXISTS cancel_links_by_clinic ON cancel_links (clinic_id, cancelled_at);
