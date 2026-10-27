-- Los fisios que llevan a cada paciente (src/data/patientStaff.ts): uno o varios del equipo, elegidos en su ficha. El
-- filtro «Fisio» de la lista de pacientes los usa (src/data/patientSearch.ts). Una fila por paciente y fisio, con
-- id «<paciente>|<correo>»: si dos dispositivos asignan el mismo fisio a la vez, es la misma fila; si asignan fisios
-- distintos, se quedan los dos. No va unido a staff: si alguien sale del equipo, sus pacientes siguen diciendo que
-- los llevaba (con su correo).
create table patient_staff (
  id          text primary key,
  patient_id  text not null references patients (id) on delete cascade,
  staff_email text not null,
  created_at  text not null,
  updated_at  text not null
);
create index patient_staff_patient on patient_staff (patient_id);
create index patient_staff_email on patient_staff (staff_email, patient_id);

create trigger sync_patient_staff_insert after insert on patient_staff
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('patient_staff', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_patient_staff_update after update on patient_staff
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.staff_email is not new.staff_email or old.created_at is not new.created_at)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('patient_staff', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_patient_staff_delete after delete on patient_staff
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('patient_staff', old.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_fields_patient_staff after update on patient_staff
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'patient_staff', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'patient_id' as f where old.patient_id is not new.patient_id
      union all select 'staff_email' where old.staff_email is not new.staff_email
      union all select 'created_at' where old.created_at is not new.created_at
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;
