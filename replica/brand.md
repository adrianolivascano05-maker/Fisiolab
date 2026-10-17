# Marca: Impulso · Fisiolab

Fecha: 2026-10-17. App interna de la clínica Fisiolab para medir el salto por vídeo.

## 1. Nombre

Ángulo: medir con rigor, en la consulta, sin aparatos (todavía no hay `replica/fixes.md`: se fijará al
pasar `/replica-entrepreneur`). Regla: nada parecido a «My Jump», «Jump Lab» ni a otras apps de salto.

20 candidatos:

| estilo | candidatos |
| --- | --- |
| descriptivo | Altímetro, Saltometría, Mide Salto, Vuelo Medido |
| compuesto | Brincómetro, Saltix, Altivo, Vuelómetro |
| inventado | Vuelia, Saltea, Kinea, Briova |
| metáfora | **Impulso**, Despegue, Resorte, Ascenso, Trampolín |
| verbo | Despega, Impulsa, Mide |

Descartados en el filtro: «Vuelia» (suena a Vueling), «Saltix»/«Saltometría» (demasiado cerca de «salto + lab»),
«Trampolín» y «Resorte» (otras ideas: rebote, no medición), «Mide» (genérico).

Cinco finalistas y comprobaciones. Son comprobaciones de cribado, no un registro legal:

| nombre | marca España (OEPM) / UE (EUIPO) | WIPO | dominio | Play / App Store | redes | web «nombre + salto» |
| --- | --- | --- | --- | --- | --- | --- |
| **Impulso** | por hacer | por hacer | por hacer | por hacer | por hacer | hecho 2026-10-17: ninguna app de medición del salto con ese nombre |
| Despegue | por hacer | por hacer | por hacer | por hacer | por hacer | por hacer |
| Altivo | por hacer | por hacer | por hacer | por hacer | por hacer | por hacer |
| Ascenso | por hacer | por hacer | por hacer | por hacer | por hacer | por hacer |
| Kinea | por hacer | por hacer | por hacer | por hacer | por hacer | por hacer |

Elegido: **Impulso** (nombre completo «Impulso · Fisiolab»). El impulso es la fase de empuje de la que
salen todas las medidas de la app. Es una palabra común, así que como marca registrada sería débil; para uso
interno, siempre junto a «Fisiolab», no es problema. Si algún día se vende, hay que hacer las comprobaciones
de la tabla y consultar a un abogado de marcas.

## 2. Paleta «petróleo y pizarra»

Colores del original: no se encontró una descripción pública de su icono ni de su color de marca (búsqueda del
2026-10-17); por eso `brand.json` no lleva colores. La paleta es propia desde el principio.

| rol | color | por qué |
| --- | --- | --- |
| accent (acción principal) | `#0e6672` petróleo | verde azulado profundo: asociado a salud y calma, serio sin ser frío |
| accent-hover | `#0a4f59` | |
| accent-soft | `#e3f1f2` | fondos de selección |
| text | `#0f2530` tinta azul marino | más suave que el negro, mismo contraste |
| text-muted | `#4c5e66` pizarra | |
| surface / border | `#f3f6f7` / `#dce3e6` | grises fríos, a juego |
| chart-primary, chart-left | `#0083a3` | el petróleo es demasiado gris para una gráfica: este tono pasa el mínimo de croma |
| chart-right | `#b4532a` cobre | segundo color de gráficas (pierna derecha) |
| danger / success / warning | `#b42318` / `#19764a` / `#8a5300` | estados, siempre con icono y texto |

Comprobado: `contrast.py` 41 pares, 0 fallos AA (texto principal 15,8:1; botón 6,6:1). Validador de
dataviz para el par de gráficas `#0083a3` / `#b4532a`: todo correcto en claro y oscuro (separación para
daltonismo ΔE 17,6).

## 3. Logo

- Idea: la trayectoria del salto. Una parábola del despegue al aterrizaje con un punto en lo más alto (la altura,
  lo que mide la app) sobre la línea del suelo.
- Tipo: símbolo + palabra («Impulso», Inter semibold, con «Fisiolab» debajo en pequeño).
- Hecho como provisional en código: `src/ui/Logo.tsx` (SVG) y `tools/build-icons.py` (iconos PNG 64-1024 px,
  maskable para Android, sin transparencia para iOS). Se lee a 16 px.
- Para un diseñador: mantener la idea (arco + punto + suelo), afinar el grosor y la curva, versión monocroma,
  imagen para compartir 1200×630.
- No debe parecerse al logo del original. Antes de usar un logo definitivo, ponerlo al lado del icono de My Jump
  Lab y comprobarlo a ojo (no se pudo ver desde aquí).

## 4. Voz

Tres palabras:

- **Precisa**, no técnica de más: dice el número y su unidad; explica lo técnico cuando hace falta.
- **Cercana**, no coloquial: habla de tú, sin bromas ni exclamaciones.
- **Serena**, no fría: los avisos dicen qué pasa y qué hacer, sin alarmar.

| sí | no |
| --- | --- |
| «Valor poco habitual: revisa las marcas y los fps de grabación.» | «¡Error! Resultado inválido.» |
| «Añade a tu primer paciente y mide su salto en un par de minutos.» | «¡Empieza ya!» |
| «Paciente añadido» | «¡Genial! Paciente creado con éxito 🎉» |
| «Rinde menos la pierna izquierda.» | «La pierna izquierda es débil.» |
| «El vídeo no sale de tu galería: Impulso solo guarda las marcas y el resultado.» | «Tus datos están 100 % seguros.» |

Textos reescritos (los más vistos):

1. Lista vacía: «Todavía no hay pacientes» / «Añade a tu primer paciente y mide su salto en un par de minutos.»
2. Botón principal de la ficha: «Nueva medición» (antes «Nuevo test»).
3. Ficha sin tests: «Pulsa «Nueva medición» para registrar su primer salto.»
4. Título del selector: «Nueva medición».
5. Aviso al crear: «Paciente añadido».
6. Botón del marcado: «Calcular resultado».
7. Pantalla del vídeo: «Graba el salto a cámara lenta y elígelo aquí. El vídeo no sale de tu galería: Impulso solo guarda las marcas y el resultado.»
8. Tarjeta de instalación: «Ten Impulso a un toque» / «Instálala: abre sin internet y el navegador cuida tus datos.»
9. Otra pestaña abierta: «Impulso ya está abierta en otra pestaña».
10. Nombre en el móvil y en el navegador: «Impulso» / «Impulso · Fisiolab».

## 5. Barrido

`python3 .claude/skills/replica-brand/sweep.py . --config replica/brand.json` → limpio (exit 0): ni el nombre, ni
los productos, ni los dominios del original en el código que se publica.
