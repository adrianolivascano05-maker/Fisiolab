// Una pantalla dentro de un panel (Pacientes en el ordenador: la lista a la izquierda y la ficha a la derecha). El
// panel ya pone el menú lateral y deja su sitio, así que la pantalla no los repite.
import { createContext, useContext } from "react";

export const PaneContext = createContext(false);
export const useInPane = () => useContext(PaneContext);
