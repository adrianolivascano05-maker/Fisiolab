-- Sincronización por cambios (src/cloud/sync.ts). En vez de subir la base entera, cada dispositivo sube solo lo que
-- ha cambiado desde la última vez. Cada fila de sync_changes lleva el número del cambio de este dispositivo que la
-- tocó por última vez («n», como sync_state.changes en ese momento): lo que falta por subir es lo que tiene n mayor
-- que sync_state.pushed. Lo que llega de otros dispositivos (applying = 1) no lleva número: ya está en el servidor.
alter table sync_changes add column n integer not null default 0;
create index sync_changes_by_n on sync_changes (n);

-- Los disparadores de cada tabla escriben en sync_changes y después suman uno a sync_state.changes.
create trigger sync_changes_n_insert after insert on sync_changes
when (select applying from sync_state) = 0
begin
  update sync_changes set n = (select changes from sync_state) + 1 where rowid = new.rowid;
end;
create trigger sync_changes_n_update after update of op, at, device on sync_changes
when (select applying from sync_state) = 0
begin
  update sync_changes set n = (select changes from sync_state) + 1 where rowid = new.rowid;
end;

-- legacy: había cambios sin subir de antes de esta versión (sin número). La primera vez que este dispositivo
-- sincroniza por cambios, sube la copia entera para que no se pierdan.
alter table sync_state add column legacy integer not null default 0;
update sync_state set legacy = changes > pushed;
