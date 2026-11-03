-- Pruebas funcionales con cifra (03-11-2026): resistencia de extensores y flexores, marchas, sentarse y levantarse,
-- alcance con carga… no son positivas ni negativas, dan un número (segundos, metros, centímetros). El hallazgo
-- guarda ese número y su unidad, con el resultado 'measured'.
alter table findings add column value real;
alter table findings add column unit text not null default '';

-- Amplía la regla (CHECK) de findings.result en su sitio, como en 037: solo cambia el texto de la definición; los
-- datos no se mueven (rehacer la tabla no hace falta y admitir un valor más no deja ninguna fila fuera de la regla).
pragma writable_schema = on;
update sqlite_schema
   set sql = replace(sql, '''inconclusive'')', '''inconclusive'', ''measured'')')
 where type = 'table' and name = 'findings' and instr(sql, '''measured''') = 0;
pragma writable_schema = reset;
-- Si el texto no cambió (otra definición), la migración falla aquí y la base queda como estaba.
create temp table _finding_value_check (ok integer not null check (ok = 1));
insert into _finding_value_check select instr(sql, '''measured''') > 0 from sqlite_schema where type = 'table' and name = 'findings';
drop table _finding_value_check;

drop trigger sync_findings_update;
create trigger sync_findings_update after update on findings
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.patient_id is not new.patient_id or old.gallery_test is not new.gallery_test or old.test_name is not new.test_name or old.region is not new.region or old.performed_at is not new.performed_at or old.side is not new.side or old.result is not new.result or old.notes is not new.notes or old.created_at is not new.created_at or old.episode_id is not new.episode_id or old.value is not new.value or old.unit is not new.unit)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('findings', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;

drop trigger sync_fields_findings;
create trigger sync_fields_findings after update on findings
when (select applying from sync_state) = 0
begin
  insert into sync_fields (tbl, pk, field, at, device)
    select 'findings', new.id, f, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state) from (
      select 'patient_id' as f where old.patient_id is not new.patient_id
      union all select 'gallery_test' where old.gallery_test is not new.gallery_test
      union all select 'test_name' where old.test_name is not new.test_name
      union all select 'region' where old.region is not new.region
      union all select 'performed_at' where old.performed_at is not new.performed_at
      union all select 'side' where old.side is not new.side
      union all select 'result' where old.result is not new.result
      union all select 'notes' where old.notes is not new.notes
      union all select 'created_at' where old.created_at is not new.created_at
      union all select 'episode_id' where old.episode_id is not new.episode_id
      union all select 'value' where old.value is not new.value
      union all select 'unit' where old.unit is not new.unit
    ) where true
    on conflict (tbl, pk, field) do update set at = excluded.at, device = excluded.device;
end;
