// comprobacion/index.js — Barrel de la capa que COMPRUEBA (F08 · F17).
//
// ── POR QUÉ ESTE FICHERO NACE EN F17 Y NO EN F08 ────────────────────────────
// Porque hasta hoy la capa tenía **un solo módulo público** y el barrel raíz podía
// hacer trampa: `index.js:74` decía `export * as comprobacion from
// './comprobacion/gml.js'`, es decir, el espacio de nombres `comprobacion` **era un
// fichero, no una capa**. Con `conjunto.js` ese atajo deja de sostenerse, y las dos
// salidas eran malas: abrir un espacio nuevo en la raíz por cada fichero (la capa
// desparramada) o dejar que `comprobacion` siguiera nombrando a uno solo de los dos
// sin que nada lo dijera. Se hace lo que ya hicieron `gml/` en F04 y `report/` en
// F09: la capa tiene su propio barrel, curado, y en la raíz entra ése.
//
// ── QUÉ COMPRUEBA CADA UNO, Y POR QUÉ SON DOS ───────────────────────────────
//   · `comprobarGml` (F08) mira **UN fichero**: qué es, si su superficie declarada
//     cuadra con la medida, si sus coordenadas caen en el huso que dice, y qué
//     encuentra F02 en su geometría.
//   · `comprobarConjunto` (F17) mira **N parcelas a la vez**: si entre todas cubren
//     exactamente el contorno oficial. Es una pregunta que no se puede hacer sobre
//     un fichero suelto, y de ahí que sean dos módulos y no dos ramas del mismo.
//
// ⛔ **`_comun.js` NO sale por aquí.** Es el vocabulario interno de la capa: la
// fábrica de detecciones, las guardas de contrato y la tabla de etiquetas de
// dialecto. Lo que la aplicación necesita saber de él —el `tipo` de cada
// detección— viaja DENTRO de la detección, que es lo que hace que la interfaz pinte
// las cinco capas con el mismo componente. Se exporta **solo** `TIPO_COMPROBACION`,
// porque quien recibe una detección tiene que poder compararla con algo sin
// escribir el literal a mano.
//
// Esta capa es PURA de arriba abajo —compone `gml/`, `validation/`, `diagnostico/`,
// `derivacion/` y `geo/`, y no toca DOM, red ni reloj—, que es la condición para
// entrar en el barrel raíz y la que vigila `test/contrato.test.js`.

export { comprobarGml } from './gml.js'
export {
  comprobarConjunto,
  toleranciaCierre,
  DESPLAZAMIENTO_MAXIMO_COORD_M,
  GROSOR_REDONDEO_M,
} from './conjunto.js'
export { TIPO_COMPROBACION, etiquetaDialecto } from './_comun.js'
