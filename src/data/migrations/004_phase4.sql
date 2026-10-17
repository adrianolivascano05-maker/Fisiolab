-- Fase 4: perfil del sprint y mecánica de carrera. Nuevas métricas: se rehace la tabla de
-- resultados con los mismos datos, como en la migración 2.

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
               'angle_deg', 'wall_distance_cm', 'torque_nm', 'score',
               'max_velocity_m_s', 'f0_n_kg', 'v0_m_s', 'pmax_w_kg', 'tau_s',
               'duty_factor', 'step_length_m')),
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
