// edit/_comun.js — F06 · Edición de parcela. Contrato COMPARTIDO de esta capa.
//
// Este módulo NO edita nada: fija las guardas de contrato que `edit/vertices.js`,
// `edit/offset.js`, `edit/snap.js` y `edit/metricas.js` necesitaban TODAS por
// igual y que la fase 2 dejó duplicadas A PROPÓSITO — `edit/offset.js` lo dejó
// anotado en su propia cabecera (nota de deuda T2.2): las tres tareas de esa
// fase corrían en paralelo sobre estos mismos ficheros, y crear este módulo
// entonces habría sido editar uno que otra tarea estaba escribiendo a la vez.
// Cerradas las tres, T3.4 es la extracción que quedó pendiente.
//
// Es el análogo, para la capa `edit/`, de `validation/_comun.js` y
// `gml/_comun.js` para las suyas: el sitio de lo que NINGÚN módulo de esta capa
// puede permitirse tener por duplicado.
//
// ── QUÉ CONTIENE, Y POR QUÉ ESTOS TRES Y NO MÁS ──────────────────────────────
//
// SPEC §2 regla 1 separa el dato malo del USUARIO (se describe, no se lanza) del
// contrato roto por el PROGRAMADOR (se lanza nombrando el argumento). Los
// `exigir*` de aquí son la mitad del PROGRAMADOR — la que los módulos de esta
// capa comparten LITERALMENTE, no por parecido de familia:
//
//   · `describir(valor)`  — redacta el valor recibido para el mensaje de un
//     `throw`: tipo + JSON si es serializable. La usan los CUATRO módulos de
//     `edit/` (incluso `metricas.js`, que no tiene `exigirRecintos` propio:
//     comprueba `recintos` a mano pero redacta el mensaje con esta función).
//   · `exigirRecintos(recintos, fn)` — `recintos` es un array, o `throw`. La
//     usan `vertices.js` y `offset.js`.
//   · `exigirRef(recintos, refVertice, fn)` — la `RefVertice` `{recinto,
//     indice}` (aliasada de `validation/_comun.js`) apunta a un vértice que
//     EXISTE. La usan `vertices.js` y `offset.js`.
//
// **Lo que NO entra aquí, con su motivo — la regla de este refactor (T3.4):** un
// helper con UN SOLO llamante no es reutilización, es indirección. Se quedan
// donde vivían, sin mover ni una línea:
//   · `exigirDistancia` y `exigirOpciones` — solo los usa `edit/offset.js`.
//   · `exigirPunto`                       — solo lo usa `edit/vertices.js`.
// Moverlos aquí no eliminaría ninguna duplicación real; solo obligaría a
// `offset.js`/`vertices.js` a saltar a otro fichero para leer una guarda que
// únicamente ellos invocan.
//
// **Tampoco entra el `describir`/`exigir*` de `viewer/_comun.js`.** Es OTRA
// capa —la de presentación, con módulos que importan Leaflet— y tiene su propia
// tarea de limpieza abierta en paralelo a esta; unificar ENTRE capas no es el
// alcance de T3.4, solo DENTRO de `edit/`.
//
// ── LA DIVERGENCIA QUE ESTE REFACTOR CIERRA ──────────────────────────────────
// `describir` y `exigirRecintos` habían sobrevivido BYTE A BYTE idénticas en sus
// copias. `exigirRef` no: `offset.js` llamaba a la referencia «de lado» y
// documentaba el índice como «el vértice que ABRE el lado», y su `RangeError`
// de índice fuera de rango nombraba cuál es el lado de CIERRE; `vertices.js` la
// llamaba «de vértice», documentaba el índice como «en el anillo abierto» y no
// mencionaba el cierre. Es el mismo riesgo que ya materializó
// `viewer/_comun.js#validarVistaInicial` (un validador duplicado que llegó a
// aceptar con `typeof === 'number'` en un módulo y rechazar con
// `Number.isFinite` en otro): aquí ninguna de las dos copias ACEPTABA O
// RECHAZABA un dato distinto —el contrato en sí no había divergido, solo su
// redacción—, pero es exactamente el tipo de bifurcación que un `_comun.js`
// existe para no dejar crecer.
//
// La versión unificada:
//   · usa una redacción NEUTRA de la referencia («la referencia debe ser
//     {recinto, indice}», sin «de lado» ni «de vértice»): nombrar uno de los
//     dos papeles habría sido preciso en un módulo y confuso en el otro, porque
//     el mismo `{recinto, indice}` significa «el vértice que abre un lado» para
//     `offset.js` y «el vértice mismo» para `vertices.js`/`snap.js`;
//   · conserva la nota del lado de CIERRE en el `RangeError` del índice —la de
//     `offset.js`, estrictamente MÁS INFORMATIVA— para las dos procedencias:
//     ningún test de `vertices.test.js` fija el texto exacto de esa rama (solo
//     comprueban `RangeError` y que el mensaje contenga el índice recibido y el
//     rango válido), así que la versión más informativa no rompe nada y ayuda
//     igual a quien lee el error desde `insertarVertice`/`eliminarVertice`.
//
// Módulo PURO: sin DOM, sin Leaflet, sin estado, sin reloj. NO entra en el
// barrel `index.js` — es común INTERNO de esta capa, igual que
// `validation/_comun.js` y `gml/_comun.js` tampoco están ahí.

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
 * @param {unknown} recintos
 * @param {string} fn  Nombre de la función pública, para el mensaje.
 */
export function exigirRecintos(recintos, fn) {
  if (!Array.isArray(recintos)) {
    throw new TypeError(
      `${fn}: 'recintos' debe ser un array de recintos; recibido ${describir(recintos)}.`,
    )
  }
}

/**
 * Contrato del llamante: la `RefVertice` (`{recinto, indice}`, ver
 * `validation/_comun.js#RefVertice`) apunta a un vértice que EXISTE. `TypeError`
 * si la forma no es la del typedef; `RangeError` si el recinto o el índice se
 * salen del rango real de la estructura recibida.
 *
 * Compartido por `edit/vertices.js` y `edit/offset.js`, que leen el MISMO
 * `{recinto, indice}` con dos papeles distintos —el vértice en sí para
 * `vertices.js`, el vértice que ABRE un lado para `offset.js`—; por eso el
 * mensaje es deliberadamente NEUTRO (ver la cabecera de este fichero para la
 * divergencia que esto resuelve).
 *
 * @param {Array<{vertices: Array<[number,number]>}>} recintos
 * @param {unknown} refVertice
 * @param {string} fn  Nombre de la función pública, para el mensaje.
 * @returns {{recinto: number, indice: number, vertices: Array<[number,number]>}}
 */
export function exigirRef(recintos, refVertice, fn) {
  if (refVertice === null || typeof refVertice !== 'object' || Array.isArray(refVertice)) {
    throw new TypeError(
      `${fn}: la referencia debe ser {recinto, indice}; recibido ${describir(refVertice)}.`,
    )
  }
  const { recinto, indice } = refVertice
  if (!Number.isInteger(recinto)) {
    throw new TypeError(
      `${fn}: 'recinto' debe ser un entero (índice en recintos); recibido ${describir(recinto)}.`,
    )
  }
  if (!Number.isInteger(indice)) {
    throw new TypeError(
      `${fn}: 'indice' debe ser un entero (índice de un vértice en el anillo ABIERTO); ` +
        `recibido ${describir(indice)}.`,
    )
  }
  if (recinto < 0 || recinto >= recintos.length) {
    throw new RangeError(
      `${fn}: 'recinto' fuera de rango: ${recinto}. ` +
        (recintos.length === 0
          ? 'No hay ningún recinto.'
          : `Válidos 0..${recintos.length - 1} (${recintos.length} recinto(s)).`),
    )
  }
  const rec = recintos[recinto]
  if (rec === null || typeof rec !== 'object' || !Array.isArray(rec.vertices)) {
    throw new TypeError(
      `${fn}: recintos[${recinto}] debe ser un recinto con 'vertices' array; ` +
        `recibido ${describir(rec)}.`,
    )
  }
  const n = rec.vertices.length
  if (indice < 0 || indice >= n) {
    throw new RangeError(
      `${fn}: 'indice' fuera de rango: ${indice}. ` +
        (n === 0
          ? `El recinto ${recinto} no tiene ningún vértice.`
          : `Válidos 0..${n - 1} (el recinto ${recinto} tiene ${n} vértice(s), anillo ABIERTO; ` +
            `el lado ${n - 1} es el de CIERRE).`),
    )
  }
  return { recinto, indice, vertices: rec.vertices }
}
