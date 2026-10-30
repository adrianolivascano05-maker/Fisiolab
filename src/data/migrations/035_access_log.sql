-- Registro de accesos (src/data/accessLog.ts): quién abrió qué ficha, la exportó o imprimió su historia. Una fila por
-- persona, paciente, acción y día (id «<día>|<correo>|<paciente>|<acción>»): no crece sin medida. Se sincroniza como
-- las demás tablas (viaja cifrado; el servidor no lo lee), pero SOLO SE AÑADE: ningún borrado viaja (syncMerge.ts,
-- APPEND_ONLY) y aquí un borrado de una fila de menos de 2 años falla, salvo al borrar toda la base (applying = 1,
-- wipeAll). Lo de más de 2 años se poda en cada dispositivo (pruneAccessLog) sin que viaje. Sin clave ajena a
-- patients: si se borra el paciente, el registro se queda (con su id). Lo ve quien administra la clínica.
create table access_log (
  id         text primary key,
  at         text not null,
  member     text not null,
  patient_id text not null,
  action     text not null
);
create index access_log_patient on access_log (patient_id, at);
create index access_log_member on access_log (member, at);

create trigger sync_access_log_insert after insert on access_log
when (select applying from sync_state) = 0
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('access_log', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
create trigger sync_access_log_update after update on access_log
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.at is not new.at or old.member is not new.member or old.patient_id is not new.patient_id or old.action is not new.action)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('access_log', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
-- Solo se añade: borrar una fila reciente falla (y nunca se apunta un borrado para sincronizar).
create trigger sync_access_log_delete before delete on access_log
when (select applying from sync_state) = 0 and old.at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 years')
begin
  select raise(abort, 'El registro de accesos solo se añade.');
end;
create trigger sync_fields_access_log after update on access_log
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'access_log', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'at' as f where old.at is not new.at
      union all select 'member' where old.member is not new.member
      union all select 'patient_id' where old.patient_id is not new.patient_id
      union all select 'action' where old.action is not new.action
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;
