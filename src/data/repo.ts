// Capa de datos: una función por operación. Las pantallas solo hablan con estas funciones, nunca con SQL.
// Está repartida por dominios (un archivo por cada uno, abajo); este índice las reúne para que `from "./repo"` siga
// valiendo en toda la app. Lo nuevo puede importar directamente del archivo que toque.
export * from "./patients"; // Pacientes: la ficha (datos, buscar en memoria, crear, cambiar, borrar).
export * from "./tests"; // Tests con vídeo y marcas (saltos; también lo común a todos los tests: leer, guardar el vídeo, borrar, listar).
export * from "./profiles"; // Perfil fuerza-velocidad (S09) y asimetría entre piernas (S10).
export * from "./romTests"; // Movilidad (S19): mediciones de rango articular.
export * from "./strengthTests"; // Fuerza: velocidad de barra (S13) y perfil carga-velocidad (S14).
export * from "./wellness"; // Bienestar (S21): un registro por día.
export * from "./nordicTests"; // Nórdico de isquios (S20).
export * from "./timedTests"; // Sprint, cambio de dirección (S15-S16) y carrera (S18): tiempos y marcas.
export * from "./settings"; // Ajustes de la app guardados en la base (clave → JSON).
export * from "./exportCsv"; // Exportación de todo en CSV.
