-- Esquema de la base de datos local (SQLite en el navegador, vía SQLite WASM + OPFS).
-- Todo vive en el dispositivo: no hay servidor, ni usuarios, ni columna de propietario.
-- Convenciones:
--   id        texto UUID generado en la app con crypto.randomUUID()
--   fechas    texto ISO 8601 en UTC ('2026-10-17T09:30:00.000Z'); se muestran en Europe/Madrid
--   unidades  en el nombre de la columna (_kg, _cm, _s) y SI en los cálculos
-- Versión del esquema: PRAGMA user_version (las migraciones la suben de una en una).

-- La app aplica las migraciones en orden y fija PRAGMA user_version; foreign_keys se activa al abrir.

create table patients (
  id                  text primary key,
  name                text not null check (length(trim(name)) > 0),
  birth_date          text,                          -- 'AAAA-MM-DD'
  sex                 text check (sex in ('female', 'male', 'other')),
  body_mass_kg        real check (body_mass_kg is null or body_mass_kg between 10 and 300),
  height_cm           real check (height_cm is null or height_cm between 50 and 250),
  leg_length_cm       real check (leg_length_cm is null or leg_length_cm between 30 and 150),
  -- distancia de empuje (hpo) de Samozino: longitud de pierna extendida menos altura en sentadilla
  pushoff_distance_cm real check (pushoff_distance_cm is null or pushoff_distance_cm between 5 and 80),
  notes               text not null default '',
  created_at          text not null,
  updated_at          text not null
);
create index patients_name on patients (name collate nocase);

-- Un test = una medición (un salto, una serie de barra, un sprint, una toma de ROM...).
create table tests (
  id             text primary key,
  patient_id     text not null references patients (id) on delete cascade,
  category       text not null check (category in
                   ('jump', 'strength', 'sprint', 'cod', 'running', 'rom', 'nordic')),
  type           text not null check (type in (
                   'cmj', 'sj', 'cmj_arms', 'dj', 'horizontal', 'single_leg', 'rj_10_5',
                   'vbt',
                   'sprint_linear', 'sprint_curved', 'deceleration', 'smas',
                   'cod_505', 'cod_5plus5', 'cod_vcut', 'cod_illinois',
                   'running',
                   'rom_ankle', 'rom_hip', 'rom_shoulder', 'rom_neck',
                   'nordic')),
  side           text check (side in ('left', 'right')),     -- unipodal, ROM, sprint curvo
  performed_at   text not null,
  extra_load_kg  real not null default 0 check (extra_load_kg >= 0),  -- perfil F-V y VBT
  drop_height_cm real check (drop_height_cm is null or drop_height_cm > 0),  -- solo DJ
  details        text not null default '{}' check (json_valid(details)),  -- parámetros propios del test (distancias, ítems S-MAS...)
  notes          text not null default '',
  created_at     text not null,
  updated_at     text not null,
  check (type <> 'dj' or drop_height_cm is not null)
);
create index tests_patient_type_date on tests (patient_id, type, performed_at);
create index tests_type_date on tests (type, performed_at);   -- ranking y comparación (S23)

-- Metadatos del vídeo usado. El vídeo en sí se queda en la galería del móvil salvo que
-- se elija guardarlo (stored = 1, copiado a OPFS).
create table videos (
  id           text primary key,
  test_id      text not null unique references tests (id) on delete cascade,
  file_name    text not null,
  -- fps de GRABACIÓN (los que usan los cálculos) y fps del ARCHIVO (los que usa el reproductor).
  -- Coinciden salvo en un vídeo a cámara lenta exportado "ralentizado" (p. ej. 240 grabados, 30 en el archivo).
  fps          real not null check (fps > 0),
  container_fps real not null check (container_fps > 0),
  frame_count  integer check (frame_count is null or frame_count > 0),
  duration_s   real check (duration_s is null or duration_s > 0),
  fps_source   text not null check (fps_source in ('container', 'user')),  -- leído del archivo o escrito a mano
  stored       integer not null default 0 check (stored in (0, 1)),
  opfs_path    text,
  created_at   text not null,
  check (stored = 0 or opfs_path is not null)
);

-- Eventos marcados en el vídeo. Se guardan siempre: permiten recalcular si cambia una fórmula.
create table marks (
  id           text primary key,
  test_id      text not null references tests (id) on delete cascade,
  event        text not null check (event in (
                 'movement_start', 'contact', 'takeoff', 'landing',
                 'bar_start', 'bar_end', 'start', 'split', 'finish', 'break_point')),
  series_index integer not null default 0 check (series_index >= 0),  -- nº de salto en 10-5, de paso en carrera, de split
  time_s       real not null check (time_s >= 0),
  frame_index  integer check (frame_index is null or frame_index >= 0),
  created_at   text not null,
  unique (test_id, event, series_index)
);
create index marks_test on marks (test_id);

-- Resultados calculados. Se pueden regenerar a partir de las marcas.
create table results (
  id         text primary key,
  test_id    text not null references tests (id) on delete cascade,
  metric     text not null check (metric in (
               'jump_height_cm', 'flight_time_ms', 'contact_time_ms', 'time_to_takeoff_ms',
               'rsi', 'rsi_mod', 'stiffness_kn_m', 'dri',
               'force_n', 'velocity_m_s', 'power_w', 'relative_power_w_kg',
               'jump_distance_cm', 'asymmetry_pct',
               'bar_velocity_m_s', 'velocity_loss_pct',
               'time_s', 'split_time_s', 'step_frequency_spm',
               'angle_deg', 'torque_nm', 'score')),
  value      real not null,
  unit       text not null,
  series_index integer not null default 0,
  formula_version integer not null default 1,   -- sube cuando cambia una fórmula
  created_at text not null,
  unique (test_id, metric, series_index)
);
create index results_test on results (test_id);

-- Perfiles que combinan varios tests (fuerza-velocidad en salto, carga-velocidad en barra).
create table profiles (
  id                  text primary key,
  patient_id          text not null references patients (id) on delete cascade,
  kind                text not null check (kind in ('force_velocity', 'load_velocity')),
  performed_at        text not null,
  exercise            text,                    -- carga-velocidad: 'squat', 'bench_press'...
  f0_n_kg             real,                    -- fuerza máxima teórica relativa
  v0_m_s              real,
  pmax_w_kg           real,
  slope               real,
  optimal_slope       real,
  imbalance_pct       real,
  min_velocity_threshold_m_s real,             -- VMT usado para estimar el 1RM
  one_rm_kg           real,
  r_squared           real check (r_squared is null or r_squared between 0 and 1),
  created_at          text not null,
  updated_at          text not null
);
create index profiles_patient_kind_date on profiles (patient_id, kind, performed_at);

create table profile_tests (
  profile_id text not null references profiles (id) on delete cascade,
  test_id    text not null references tests (id) on delete cascade,
  primary key (profile_id, test_id)
);
create index profile_tests_test on profile_tests (test_id);

create table wellness (
  id           text primary key,
  patient_id   text not null references patients (id) on delete cascade,
  performed_at text not null,
  sleep        integer not null check (sleep between 1 and 5),
  fatigue      integer not null check (fatigue between 1 and 5),
  stress       integer not null check (stress between 1 and 5),
  soreness     integer not null check (soreness between 1 and 5),
  notes        text not null default '',
  created_at   text not null
);
create index wellness_patient_date on wellness (patient_id, performed_at);

-- Ajustes de la app (unidades, idioma, VMT por ejercicio, fecha de la última copia de seguridad).
create table settings (
  key   text primary key,
  value text not null check (json_valid(value))
);
