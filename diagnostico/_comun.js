// diagnostico/_comun.js — F07 · Diagnóstico de encaje. Contrato COMPARTIDO de esta capa.
//
// Este módulo NO diagnostica nada: fija las guardas de contrato y los typedefs que
// `diagnostico/topologia.js`, `diagnostico/desviacion.js`, `diagnostico/bandas.js`,
// `diagnostico/margen.js` y `diagnostico/parcela.js` necesitan por igual.
//
// Es el análogo, para la capa `diagnostico/`, de `validation/_comun.js`,
// `gml/_comun.js` y `edit/_comun.js` para las suyas: el sitio de lo que NINGÚN
// módulo de esta capa puede permitirse tener por duplicado.
//
// ── POR QUÉ EXISTE ANTES QUE SUS CONSUMIDORES, Y NO DESPUÉS ──────────────────
// `edit/_comun.js` nació TARDE: las tres tareas de la fase 2 de F06 corrían en
// paralelo sobre los ficheros que lo iban a necesitar, así que crearlo entonces
// habría sido editar un fichero que otra tarea estaba escribiendo a la vez. Se
// duplicaron las guardas a propósito y la extracción quedó como deuda (su
// cabecera lo cuenta, y para cuando se pagó `exigirRef` ya había DIVERGIDO en la
// redacción entre las dos copias). Aquí se escribe PRIMERO, con las firmas
// congeladas por el plan, precisamente para no volver a pasar por eso: las tareas
// de la fase 2 de F07 importan un contrato que ya existe en vez de inventarse cada
// una el suyo.
//
// ── LA CUARTA COPIA DE `describir`, DECLARADA ───────────────────────────────
// `describir` existe ya en `validation/_comun.js`, en `viewer/_comun.js` y en
// `edit/_comun.js`, y ésta es la cuarta. No es un olvido: es la regla que este
// repo se dio en `edit/_comun.js` («unificar ENTRE capas no es el alcance»), y la
// alternativa —importar la de `edit/`— sería una dependencia
// `diagnostico/ → edit/` para redactar un mensaje de error, exactamente la
// dependencia al revés que obligó a bajar `distancia` a `geo/metrica.js` en F06 y
// `anilloCerrado` a `geo/poligono.js` en F07.
//
// Lo honesto es decir qué costaría arreglarlo de verdad: un `_comun` neutro por
// debajo de las cuatro capas. Son ~15 líneas movidas y cuatro ficheros tocados de
// tres capas distintas, cosmético y sin ningún consumidor que lo pida. Queda
// anotado como DEUDA en `spec/feature-07-diagnostico-parcela.md`, no disimulado.
//
// Módulo PURO: sin DOM, sin Leaflet, sin Turf, sin estado, sin reloj. NO entra en
// el barrel `index.js` — es común INTERNO de esta capa.

/**
 * Un recinto del modelo: anillo ABIERTO en UTM más su papel.
 *
 * @typedef {{vertices: Array<[number,number]>, tipo: 'EXTERIOR'|'HUECO'}} Recinto
 */

/**
 * Una parcela vecina, tal como la consume esta capa.
 *
 * **NO es una `ParcelaGml`**, y la distinción importa: `gml/parse.js` devuelve un
 * POJO con veinte campos (refcat, inspireId, areaValue, srs, orientación…) y aquí
 * solo se necesitan dos. Traducir en la frontera —trabajo del cableado, no de esta
 * capa— es lo que mantiene `diagnostico/` ciego a de dónde vino el dato: F07 lo
 * recibe del WFS y F08 lo recibirá de un fichero que el usuario suelta encima.
 *
 * @typedef {Object} Vecina
 * @property {string|null} refcat  Referencia catastral de la vecina, para poder
 *   NOMBRARLA en el hallazgo de invasión. `null` si no consta: se presentará como
 *   «parcela sin referencia», nunca como cadena vacía.
 * @property {Recinto[]} recintos  Su geometría, con el invariante del modelo.
 */

/** Describe un valor para el mensaje de un `throw`: tipo + valor si es serializable. */
export function describir(valor) {
  if (valor === undefined) return 'undefined'
  if (typeof valor === 'function') return 'function'
  try {
    const json = JSON.stringify(valor)
    return json === undefined ? String(valor) : `${typeof valor} ${json}`
  } catch {
    return `${typeof valor} (no serializable)`
  }
}

/**
 * Contrato del llamante: `recintos` es un array. LANZA (bug del programador).
 *
 * No comprueba el invariante EXTERIOR/HUECO: eso lo hacen `geo/area.js#superficie`
 * y `geo/metrica.js#perimetro` cuando les toca medir, y duplicar la comprobación
 * aquí significaría tener DOS sitios donde ese invariante se define.
 *
 * @param {unknown} recintos
 * @param {string} fn  Nombre de la función pública, para el mensaje.
 * @param {string} [nombre='recintos']  Nombre del argumento en el mensaje, para
 *   que un `diagnosticar({geometriaOficial})` no diga «'recintos'» al quejarse de
 *   otra cosa.
 */
export function exigirRecintos(recintos, fn, nombre = 'recintos') {
  if (!Array.isArray(recintos)) {
    throw new TypeError(
      `${fn}: '${nombre}' debe ser un array de recintos; recibido ${describir(recintos)}.`,
    )
  }
}

/**
 * Contrato del llamante: un número finito, o `null` cuando `null` significa «no
 * consta» (que en esta capa es casi siempre: superficie catastral, superficie
 * registral).
 *
 * **`null` NO es 0, y ésa es media razón de ser de F07.** La distinción está
 * razonada en `model/parcela.js` y en `edit/metricas.js`: si «no hay dato» se
 * colara como 0, la tabla a tres bandas diría «no hay discrepancia» cuando lo
 * cierto es «no hay con qué comparar» — dos afirmaciones opuestas escritas con el
 * mismo número, y la falsa es la tranquilizadora.
 *
 * @param {unknown} valor
 * @param {string} fn      Nombre de la función pública, para el mensaje.
 * @param {string} nombre  Nombre del argumento, para el mensaje.
 */
export function exigirNumeroONulo(valor, fn, nombre) {
  if (valor !== null && !(typeof valor === 'number' && Number.isFinite(valor))) {
    throw new TypeError(
      `${fn}: '${nombre}' debe ser un número finito o null (null = no consta); ` +
        `recibido ${describir(valor)}.`,
    )
  }
}

/**
 * Contrato del llamante: `opciones` es un objeto llano.
 *
 * Existe por el mismo motivo que su gemela de `edit/metricas.js`: sin esta guarda,
 * un `diagnosticar(recintos, 1536)` desestructuraría un número, todas las opciones
 * saldrían con su valor por defecto y **la superficie declarada se perdería por el
 * camino en silencio** — la ficha diría «No consta» teniendo el dato delante.
 *
 * @param {unknown} opciones
 * @param {string} fn      Nombre de la función pública, para el mensaje.
 * @param {string} [forma='un objeto de opciones']  Cómo describir lo esperado.
 */
export function exigirOpciones(opciones, fn, forma = 'un objeto de opciones') {
  if (opciones === null || typeof opciones !== 'object' || Array.isArray(opciones)) {
    throw new TypeError(`${fn}: se esperaba ${forma}; recibido ${describir(opciones)}.`)
  }
}
