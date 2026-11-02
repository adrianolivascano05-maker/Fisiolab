-- Movilidad de rodilla, codo y muñeca (02-11-2026): la regla (CHECK) de la columna tests.type de 001_init.sql solo
-- admitía los tipos de la primera versión. Se amplía la regla en su sitio, como explica la documentación de SQLite
-- («Making Other Kinds Of Table Schema Changes», ALTER TABLE): solo cambia el texto de la definición de la tabla,
-- los datos no se mueven ni se copian. Rehacer la tabla (crear otra, copiar y borrar) borraría en cascada sus
-- resultados, vídeos y marcas por las claves ajenas. Admitir más valores no deja ninguna fila existente fuera de la
-- regla. Un dispositivo sin actualizar no recibe estos cambios: pide actualizar la app (schema en cada lote, engine.ts).
pragma writable_schema = on;
update sqlite_schema
   set sql = replace(sql, '''rom_neck'',', '''rom_neck'', ''rom_knee'', ''rom_elbow'', ''rom_wrist'',')
 where type = 'table' and name = 'tests' and instr(sql, 'rom_knee') = 0;
pragma writable_schema = reset;
-- Si el texto no cambió (otra definición), la migración falla aquí y la base queda como estaba.
create temp table _rom_joints_check (ok integer not null check (ok = 1));
insert into _rom_joints_check select instr(sql, '''rom_knee''') > 0 from sqlite_schema where type = 'table' and name = 'tests';
drop table _rom_joints_check;
