-- Ejercicios para casa (src/data/exercises.ts). La biblioteca de la clínica y las hojas de cada paciente; la hoja
-- guarda el texto de cada ejercicio (items, JSON) tal como se le dio. Se sincroniza.
create table exercises (
  id           text primary key,
  title        text not null,
  region       text not null default '',
  dose         text not null default '',
  instructions text not null default '',
  created_at   text not null,
  updated_at   text not null
);

create table exercise_plans (
  id         text primary key,
  patient_id text not null references patients (id) on delete cascade,
  items      text not null default '[]',
  note       text not null default '',
  created_at text not null,
  updated_at text not null
);
create index exercise_plans_patient on exercise_plans (patient_id, created_at);

create trigger sync_exercises_insert after insert on exercises
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('exercises', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_exercises_update after update on exercises
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.title is not new.title or old.region is not new.region or old.dose is not new.dose or old.instructions is not new.instructions or old.created_at is not new.created_at)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('exercises', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_exercises_delete after delete on exercises
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('exercises', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_exercise_plans_insert after insert on exercise_plans
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('exercise_plans', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_exercise_plans_update after update on exercise_plans
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.items is not new.items or old.note is not new.note or old.created_at is not new.created_at)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('exercise_plans', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_exercise_plans_delete after delete on exercise_plans
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('exercise_plans', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
