-- Motivos de consulta (src/clinical/README.md): un paciente puede venir varias veces, por problemas distintos, y
-- cada motivo lleva su anamnesis y sus sesiones, exploraciones, mediciones y cuestionarios.
--
-- El primer motivo es el de siempre: su id es el del paciente, su anamnesis sigue en la tabla anamnesis y sus
-- registros tienen episode_id nulo (o el id del paciente). Solo tiene fila aquí si se le cambia el nombre o se cierra.
-- Los demás motivos guardan su anamnesis en `answers`.
create table episodes (
  id         text primary key,
  patient_id text not null references patients (id) on delete cascade,
  title      text not null default '',
  started_at text not null,
  closed_at  text,
  answers    text not null default '{}' check (json_valid(answers)),
  created_at text not null,
  updated_at text not null
);
create index episodes_patient on episodes (patient_id, started_at);

-- Sin clave ajena: el primer motivo puede no tener fila. Nulo quiere decir el primero.
alter table sessions add column episode_id text;
alter table findings add column episode_id text;
alter table questionnaires add column episode_id text;
alter table tests add column episode_id text;

-- El motivo que se está viendo en cada ficha, en este dispositivo ('all': todos). No se sincroniza: es cómo mira
-- cada uno, no un dato del paciente.
create table episode_focus (
  patient_id text primary key references patients (id) on delete cascade,
  episode_id text not null
);

-- Lo que se registra se apunta al motivo que se está viendo (o, viendo todos, al último abierto). Así lo hacen todas
-- las formas de crear sesiones, hallazgos, cuestionarios y mediciones, sin tocar cada una. No al juntar la copia de
-- la nube: esas filas ya traen su motivo. Mientras el paciente tenga un solo motivo, no hace nada.
create trigger episode_sessions after insert on sessions
when new.episode_id is null and (select applying from sync_state) = 0
  and exists (select 1 from episodes where patient_id = new.patient_id)
begin
  update sessions set episode_id = coalesce(
    (select episode_id from episode_focus where patient_id = new.patient_id and episode_id <> 'all'),
    (select id from episodes where patient_id = new.patient_id and closed_at is null order by started_at desc, created_at desc limit 1)
  ) where id = new.id;
end;
create trigger episode_findings after insert on findings
when new.episode_id is null and (select applying from sync_state) = 0
  and exists (select 1 from episodes where patient_id = new.patient_id)
begin
  update findings set episode_id = coalesce(
    (select episode_id from episode_focus where patient_id = new.patient_id and episode_id <> 'all'),
    (select id from episodes where patient_id = new.patient_id and closed_at is null order by started_at desc, created_at desc limit 1)
  ) where id = new.id;
end;
create trigger episode_questionnaires after insert on questionnaires
when new.episode_id is null and (select applying from sync_state) = 0
  and exists (select 1 from episodes where patient_id = new.patient_id)
begin
  update questionnaires set episode_id = coalesce(
    (select episode_id from episode_focus where patient_id = new.patient_id and episode_id <> 'all'),
    (select id from episodes where patient_id = new.patient_id and closed_at is null order by started_at desc, created_at desc limit 1)
  ) where id = new.id;
end;
create trigger episode_tests after insert on tests
when new.episode_id is null and (select applying from sync_state) = 0
  and exists (select 1 from episodes where patient_id = new.patient_id)
begin
  update tests set episode_id = coalesce(
    (select episode_id from episode_focus where patient_id = new.patient_id and episode_id <> 'all'),
    (select id from episodes where patient_id = new.patient_id and closed_at is null order by started_at desc, created_at desc limit 1)
  ) where id = new.id;
end;

-- episodes
create trigger sync_episodes_insert after insert on episodes
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('episodes', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_episodes_update after update on episodes
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('episodes', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_episodes_delete after delete on episodes
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('episodes', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
