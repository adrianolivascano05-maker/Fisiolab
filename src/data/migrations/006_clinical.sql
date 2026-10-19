-- Ficha clínica: anamnesis (una por paciente), sesiones (cada visita), hallazgos de la exploración
-- (tests especiales de la galería marcados como positivos, negativos o dudosos) y cuestionarios.

-- Respuestas por id de campo de la plantilla (src/clinical/anamnesis.ts). En JSON para poder cambiar la
-- plantilla sin perder lo guardado: un campo que deje de existir se conserva y se sigue viendo.
create table anamnesis (
  patient_id text primary key references patients (id) on delete cascade,
  answers    text not null default '{}' check (json_valid(answers)),
  created_at text not null,
  updated_at text not null
);

create table sessions (
  id           text primary key,
  patient_id   text not null references patients (id) on delete cascade,
  performed_at text not null,
  pain         integer check (pain is null or pain between 0 and 10),  -- dolor 0-10 al llegar
  subjective   text not null default '',  -- qué refiere el paciente
  objective    text not null default '',  -- qué encuentra el fisioterapeuta
  treatment    text not null default '',  -- qué se hace en la sesión
  plan         text not null default '',  -- plan y ejercicios para casa
  review_on    text,                      -- reevaluar el (AAAA-MM-DD)
  created_at   text not null,
  updated_at   text not null
);
create index sessions_patient on sessions (patient_id, performed_at);

-- El nombre y la región se copian al guardar: el hallazgo se sigue leyendo aunque la galería cambie o se quite.
create table findings (
  id           text primary key,
  patient_id   text not null references patients (id) on delete cascade,
  gallery_test text not null,             -- id del test en src/gallery/data
  test_name    text not null,
  region       text not null,
  performed_at text not null,
  side         text check (side in ('left', 'right', 'both')),
  result       text not null check (result in ('positive', 'negative', 'inconclusive')),
  notes        text not null default '',
  created_at   text not null,
  updated_at   text not null
);
create index findings_patient on findings (patient_id, performed_at);

-- Cuestionarios: la PSFS y el cambio global percibido se rellenan en la app; del resto (KOOS, LEFS, NDI…) se
-- guarda solo la puntuación, para ver su evolución. El catálogo está en src/clinical/questionnaires.ts.
create table questionnaires (
  id           text primary key,
  patient_id   text not null references patients (id) on delete cascade,
  kind         text not null,
  performed_at text not null,
  score        real not null,
  details      text not null default '{}' check (json_valid(details)),  -- PSFS: actividades; subescala; «otro»: nombre y rango
  notes        text not null default '',
  created_at   text not null,
  updated_at   text not null
);
create index questionnaires_patient on questionnaires (patient_id, kind, performed_at);
