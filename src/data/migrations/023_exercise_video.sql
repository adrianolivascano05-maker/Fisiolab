-- Ejercicios para casa (src/data/exercises.ts): un enlace a un vídeo de cada ejercicio de la biblioteca (YouTube, la web
-- de la clínica…). En la hoja sale con su código QR para verlo desde el móvil.
alter table exercises add column video text not null default '';

drop trigger sync_exercises_update;
create trigger sync_exercises_update after update on exercises
when (select applying from sync_state) = 0
  and (old.id is not new.id or old.title is not new.title or old.region is not new.region or old.dose is not new.dose or old.instructions is not new.instructions or old.created_at is not new.created_at or old.video is not new.video)
begin
  insert into sync_changes (tbl, pk, op, at, device) values ('exercises', new.id, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), (select device from sync_state))
    on conflict (tbl, pk) do update set op = excluded.op, at = excluded.at, device = excluded.device;
  update sync_state set changes = changes + 1;
end;
