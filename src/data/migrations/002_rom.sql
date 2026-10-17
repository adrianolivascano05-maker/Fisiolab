-- Movilidad (fase 3). Añade la distancia pie-pared del lunge como métrica propia.
-- SQLite no deja cambiar un CHECK: se rehace la tabla de resultados con los mismos datos.
-- Nada apunta a `results`, así que borrarla y renombrar la nueva es seguro con foreign_keys activadas.

create table results_new (
  id         text primary key,
  test_id    text not null references tests (id) on delete cascade,
  metric     text not null check (metric in (
               'jump_height_cm', 'flight_time_ms', 'contact_time_ms', 'time_to_takeoff_ms',
               'rsi', 'rsi_mod', 'stiffness_kn_m', 'dri',
               'force_n', 'velocity_m_s', 'power_w', 'relative_power_w_kg',
               'jump_distance_cm', 'asymmetry_pct',
               'bar_velocity_m_s', 'velocity_loss_pct',
               'time_s', 'split_time_s', 'step_frequency_spm',
               'angle_deg', 'wall_distance_cm', 'torque_nm', 'score')),
  value      real not null,
  unit       text not null,
  series_index integer not null default 0,
  formula_version integer not null default 1,
  created_at text not null,
  unique (test_id, metric, series_index)
);
insert into results_new (rowid, id, test_id, metric, value, unit, series_index, formula_version, created_at)
  select rowid, id, test_id, metric, value, unit, series_index, formula_version, created_at from results;
drop table results;
alter table results_new rename to results;
create index results_test on results (test_id);

-- Movimiento medido (catálogo en src/calc/rom.ts), guardado en tests.details: {"movement": "...", "method": "..."}.
create index tests_rom_movement on tests (patient_id, json_extract(details, '$.movement')) where category = 'rom';
