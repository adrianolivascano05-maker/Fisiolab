-- Validación: pares de medidas de lo mismo con Cénit y con otra referencia (plataforma de fuerza,
-- My Jump Lab, encoder, dinamómetro, goniómetro), con una segunda marcación (fiabilidad) o con la
-- propuesta de la IA frente a las marcas finales.
create table validation_pairs (
  id              text primary key,
  kind            text not null check (kind in
                    ('jump_height', 'bar_velocity', 'nordic_torque', 'rom_angle', 'free_angle', 'sprint_time')),
  comparison      text not null check (comparison in ('reference', 'remark', 'ai')),
  reference_label text not null default '',
  impulso_value   real not null,
  reference_value real not null,
  patient_id      text references patients (id) on delete set null,
  test_id         text references tests (id) on delete set null,
  notes           text not null default '',
  created_at      text not null
);
create index validation_pairs_kind on validation_pairs (kind, comparison);
