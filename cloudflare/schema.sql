-- Tablas del servidor de datos de Cénit en Cloudflare D1 (ver README.md).
-- Se pueden ejecutar varias veces: no borran nada.

-- La copia vigente de cada fisioterapeuta («owner» es su identificador de Google, «sub»).
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
