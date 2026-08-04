// edificio/mutaciones.js — F11 · T1.3. Las cuatro mutaciones puras del Edificio.
//
// Lo que el usuario puede cambiar de un edificio ya cargado, sin volver a
// importarlo: el modelo (SIMPLIFICADO ↔ COMPLETO), la referencia catastral, el
// rótulo de una parte y los siete atributos semánticos. Es el equivalente para la
// rama EDIFICIO de lo que `edit/` hace con la parcela, pero sin geometría: en F11
// las huellas no se editan (eso es F12), solo se etiquetan.
//
// ── EL POJO DEL STORE NO SE MUTA JAMÁS ──────────────────────────────────────
// Las cuatro construyen un `Edificio` **NUEVO** con `crearEdificio` y devuelven
// ése; el que había en el store se queda exactamente como estaba, byte a byte.
// No es estilo: es lo que hace que el undo/redo funcione. `structuredClone` sobre
// un POJO plano es toda la maquinaria de historial que este proyecto tiene
// (regla de oro 4), y un historial de referencias compartidas guarda N veces el
// mismo objeto y «deshace» a un estado idéntico al actual. Los tests comparan
// referencia **y** contenido del original antes y después.
//
// Reconstruir en vez de copiar-y-parchear tiene además un efecto que interesa:
// toda mutación vuelve a pasar por las validaciones de `model/edificio.js`
// —dominios de `modelo`/`tipo`/`origen`, plantas numéricas, copia defensiva de
// `partes` y `parcelaContexto`, congelación de `construccionOficial`—, así que
// ninguna de estas funciones puede fabricar un edificio que el modelo no
// aceptaría. `model/edificio.js` NO SE TOCA (desviación 2 del plan): esta capa lo
// usa, no lo amplía.
//
// ── LAS CUATRO DEVUELVEN `{edificio, detecciones}`, NO UN EDIFICIO PELADO ────
// ⚠️ Para el llamante: `conRefcat(e, rc)` **no** devuelve un Edificio, devuelve
// `{edificio, detecciones}`. Es uniforme a propósito. La que obliga es
// `conModelo` —pasar a SIMPLIFICADO borra siete atributos y hay que poder
// decirlo ANTES de aplicarlo—, pero `conAtributos` y `conParteRenombrada` también
// tienen algo que contar, y una firma que cambia según la función es una firma
// que se recuerda mal. Quien no espere detecciones escribe `.edificio` y ya.
//
// Las detecciones se DEVUELVEN, no se aplican: esta capa no decide si se pregunta
// al usuario, si se pinta un aviso o si se aborta. Eso es de `app/` (T3.2), que
// es quien tiene el diálogo. Aquí solo se garantiza que nada pasa en silencio
// (regla de oro 1).
//
// Puro: sin DOM, sin red, sin reloj. Proyecto Vitest `node`.

import { ATRIBUTOS_COMPLETO, MODELO_EDIFICIO, crearEdificio } from '../model/edificio.js'
import { SEVERIDAD, TIPO_EDIFICIO, crearDeteccionEdificio } from './_comun.js'

/**
 * Resultado de cualquiera de las cuatro mutaciones.
 *
 * @typedef {Object} ResultadoMutacion
 * @property {object} edificio  El `Edificio` NUEVO (POJO de `crearEdificio`).
 * @property {import('./_comun.js').DeteccionEdificio[]} detecciones  Lo que hubo
 *   que decidir, perder o ignorar para llegar hasta él. Vacío si no hubo nada.
 */

/**
 * Rótulo humano de cada atributo semántico, en el orden de `ATRIBUTOS_COMPLETO`.
 * Existe para que el mensaje de {@link conModelo} enumere lo que se pierde con
 * palabras y no con nombres de campo. Se exporta para que la interfaz (T2.5)
 * etiquete su diálogo con LAS MISMAS palabras: dos redacciones distintas de «nº
 * de viviendas» en la misma pantalla son dos campos distintos para quien lee.
 *
 * @readonly
 */
export const ROTULO_ATRIBUTO = Object.freeze({
  usoDominante: 'uso dominante',
  estadoConservacion: 'estado de conservación',
  anioConstruccion: 'año de construcción',
  anioReforma: 'año de reforma',
  numeroInmuebles: 'nº de inmuebles',
  numeroViviendas: 'nº de viviendas',
  superficieConstruida: 'superficie construida',
})

// ── Helpers internos ─────────────────────────────────────────────────────────

/**
 * Comprueba que lo recibido tiene forma de `Edificio`. LANZA: pasar otra cosa es
 * un contrato roto por el PROGRAMADOR, no un dato del usuario (regla 1).
 *
 * No revalida los dominios (`modelo`, `tipo`, `origen`…): de eso se encarga
 * `crearEdificio` unas líneas más abajo, y duplicarlo aquí sería tener dos
 * definiciones de lo que es válido.
 *
 * @param {object} edificio
 * @param {string} fn  Nombre de la función llamante, para el mensaje.
 * @throws {TypeError}
 */
function exigirEdificio(edificio, fn) {
  if (!edificio || typeof edificio !== 'object' || Array.isArray(edificio)) {
    throw new TypeError(
      `${fn}: 'edificio' debe ser el POJO de crearEdificio; recibido ${JSON.stringify(edificio)}.`,
    )
  }
  if (!Array.isArray(edificio.partes)) {
    throw new TypeError(
      `${fn}: 'edificio.partes' debe ser un array; recibido ${typeof edificio.partes}. ` +
        `¿Se ha pasado un ParteConstruccion o un resumen en vez del Edificio?`,
    )
  }
}

/**
 * Reconstruye el edificio entero con `crearEdificio` aplicando `cambios` encima.
 * Es el único sitio de este módulo que crea un edificio.
 *
 * Los siete atributos semánticos se re-aportan **solo si la clave existe** en el
 * original: en SIMPLIFICADO no existen, y pasarlos como `undefined` daría lo
 * mismo, pero así el objeto que se le entrega a `crearEdificio` dice la verdad
 * sobre de dónde viene. Si `cambios.modelo` es SIMPLIFICADO, `crearEdificio`
 * **descarta** los siete aunque se le pasen: eso es exactamente el borrado que
 * {@link conModelo} anuncia antes de hacerlo.
 *
 * @param {object} edificio
 * @param {object} cambios
 * @returns {object} Edificio nuevo.
 */
function reconstruir(edificio, cambios) {
  const base = {
    refcat: edificio.refcat ?? null,
    modelo: edificio.modelo,
    partes: edificio.partes,
    parcelaContexto: edificio.parcelaContexto ?? null,
    construccionOficial: edificio.construccionOficial ?? null,
  }
  for (const clave of ATRIBUTOS_COMPLETO) {
    if (clave in edificio) base[clave] = edificio[clave]
  }
  return crearEdificio({ ...base, ...cambios })
}

/** Enumera claves con sus rótulos: «uso dominante, estado de conservación…». */
const enumerar = (claves) => claves.map((c) => ROTULO_ATRIBUTO[c] ?? c).join(', ')

// ── conModelo ────────────────────────────────────────────────────────────────

/**
 * Cambia el modelo de serialización del edificio.
 *
 * ⚠️ **Es la que tiene chicha.** Pasar de COMPLETO a SIMPLIFICADO **borra los
 * siete atributos semánticos** —`crearEdificio` no añade esas claves en
 * SIMPLIFICADO, así que no quedan a `null`: dejan de existir— y el borrado es
 * IRREVERSIBLE por esta vía: volver a COMPLETO los repone a `null`, no a lo que
 * valían. De ahí que la detección {@link TIPO_EDIFICIO}.MODELO_CAMBIADO se
 * devuelva JUNTO al edificio nuevo, con la lista de lo que se pierde y de lo que
 * de esa lista tenía valor: la interfaz puede enseñarla y preguntar **antes** de
 * escribir el resultado en el store, que es la regla de oro 1 aplicada a una
 * acción destructiva.
 *
 * En el sentido contrario (SIMPLIFICADO → COMPLETO) las siete claves aparecen a
 * `null`. **No se inventa ningún valor**: `null` es «aún no conocido», y el aviso
 * lo dice para que nadie dé por rellenado un formulario vacío.
 *
 * @param {object} edificio  El `Edificio` actual (no se muta).
 * @param {'SIMPLIFICADO'|'COMPLETO'} modelo  El modelo destino.
 * @returns {ResultadoMutacion}
 * @throws {TypeError}   Si `edificio` no tiene forma de Edificio.
 * @throws {RangeError}  Si `modelo` no está en `MODELO_EDIFICIO` (un typo no puede
 *   degradar en silencio a SIMPLIFICADO: misma barrera que `crearEdificio`).
 */
export function conModelo(edificio, modelo) {
  exigirEdificio(edificio, 'conModelo')
  const modelosValidos = Object.values(MODELO_EDIFICIO)
  if (!modelosValidos.includes(modelo)) {
    throw new RangeError(
      `conModelo: 'modelo' inválido: ${JSON.stringify(modelo)}. Válidos: ${modelosValidos.join(', ')}.`,
    )
  }

  const detecciones = []
  const anterior = edificio.modelo

  if (anterior !== modelo && modelo === MODELO_EDIFICIO.SIMPLIFICADO) {
    const perdidos = [...ATRIBUTOS_COMPLETO]
    const conValor = perdidos
      .filter((c) => c in edificio && edificio[c] !== null && edificio[c] !== undefined)
      .map((c) => ({ clave: c, rotulo: ROTULO_ATRIBUTO[c], valor: edificio[c] }))
    detecciones.push(
      crearDeteccionEdificio(
        TIPO_EDIFICIO.MODELO_CAMBIADO,
        `Al pasar a modelo SIMPLIFICADO se pierden los ${perdidos.length} atributos ` +
          `semánticos del edificio (${enumerar(perdidos)}). ` +
          (conValor.length === 0
            ? 'Ahora mismo ninguno tiene valor.'
            : `${conValor.length} de ellos tienen valor: ${enumerar(conValor.map((a) => a.clave))}. ` +
              'Volver a COMPLETO los repone vacíos, no con estos valores.'),
        SEVERIDAD.AVISO,
        { desde: anterior, hacia: modelo, atributosPerdidos: perdidos, conValor },
      ),
    )
  } else if (anterior !== modelo && modelo === MODELO_EDIFICIO.COMPLETO) {
    detecciones.push(
      crearDeteccionEdificio(
        TIPO_EDIFICIO.MODELO_CAMBIADO,
        `Al pasar a modelo COMPLETO se añaden los ${ATRIBUTOS_COMPLETO.length} atributos ` +
          `semánticos del edificio (${enumerar([...ATRIBUTOS_COMPLETO])}), todos VACÍOS: ` +
          'hay que rellenarlos, no se deduce ninguno.',
        SEVERIDAD.INFO,
        { desde: anterior, hacia: modelo, atributosAnadidos: [...ATRIBUTOS_COMPLETO] },
      ),
    )
  }

  return { edificio: reconstruir(edificio, { modelo }), detecciones }
}

// ── conRefcat ────────────────────────────────────────────────────────────────

/**
 * Fija la referencia catastral del edificio.
 *
 * **No normaliza nada**: ni recorta espacios, ni pasa a mayúsculas, ni convierte
 * `''` en `null`. Corregir por su cuenta lo que el usuario ha escrito en un campo
 * es la regla de oro 1 al revés, y esa decisión —con su aviso— es de la interfaz,
 * que es quien sabe si el texto viene de un teclado o del Catastro.
 *
 * @param {object} edificio  El `Edificio` actual (no se muta).
 * @param {string|null} refcat  La RC, o `null` para dejarla sin fijar.
 * @returns {ResultadoMutacion}  `detecciones` siempre vacío.
 * @throws {TypeError}  Si `edificio` no tiene forma de Edificio, o si `refcat` no
 *   es texto ni `null` — incluido `undefined`, que aquí NO significa «déjala como
 *   está»: `crearEdificio` lo tomaría por su valor por defecto y borraría la RC
 *   en silencio.
 */
export function conRefcat(edificio, refcat) {
  exigirEdificio(edificio, 'conRefcat')
  if (refcat !== null && typeof refcat !== 'string') {
    throw new TypeError(
      `conRefcat: 'refcat' debe ser un texto o null (para dejarla sin fijar); ` +
        `recibido ${JSON.stringify(refcat)}.`,
    )
  }
  return { edificio: reconstruir(edificio, { refcat }), detecciones: [] }
}

// ── conParteRenombrada ───────────────────────────────────────────────────────

/**
 * Cambia el rótulo de la parte `i`. Las demás partes se quedan idénticas, y la
 * `i` conserva todo lo suyo (recinto, tipo, plantas, origen): solo cambia el
 * nombre.
 *
 * Los dos fallos posibles se tratan DISTINTO, y a propósito:
 *   · **Índice fuera de rango → LANZA.** Es un contrato roto por el programador:
 *     nadie escribe un índice a mano, sale de un bucle o de un `data-parte-indice`.
 *   · **Nombre vacío → NO lanza.** Es un dato del usuario: un campo de texto que
 *     se ha borrado. `crearParteConstruccion` sí lanza con un nombre vacío
 *     (`model/edificio.js:137`, comprobado antes de escribir esto), y dejar que
 *     esa excepción suba reventaría dentro de un `click`. Se conserva el nombre
 *     anterior y se devuelve una detección `RENOMBRADO_IGNORADO`.
 *
 * Un nombre que solo son espacios cuenta como vacío. Uno con espacios alrededor
 * se guarda LITERAL, sin recortar: el rótulo es del usuario.
 *
 * @param {object} edificio  El `Edificio` actual (no se muta).
 * @param {number} i  Índice de la parte en `edificio.partes`, 0-based.
 * @param {string} nombre  El rótulo nuevo.
 * @returns {ResultadoMutacion}
 * @throws {TypeError}   Si `edificio` no tiene forma de Edificio, si `i` no es
 *   entero o si `nombre` no es un string.
 * @throws {RangeError}  Si `i` está fuera de `[0, partes.length)`.
 */
export function conParteRenombrada(edificio, i, nombre) {
  exigirEdificio(edificio, 'conParteRenombrada')
  if (!Number.isInteger(i)) {
    throw new TypeError(
      `conParteRenombrada: 'i' debe ser un entero; recibido ${JSON.stringify(i)}.`,
    )
  }
  if (i < 0 || i >= edificio.partes.length) {
    throw new RangeError(
      `conParteRenombrada: 'i' fuera de rango: ${i}. El edificio tiene ` +
        `${edificio.partes.length} parte(s), índices válidos 0..${edificio.partes.length - 1}.`,
    )
  }
  if (typeof nombre !== 'string') {
    throw new TypeError(
      `conParteRenombrada: 'nombre' debe ser un string; recibido ${JSON.stringify(nombre)}.`,
    )
  }

  const detecciones = []
  let partes = edificio.partes

  if (nombre.trim().length === 0) {
    detecciones.push(
      crearDeteccionEdificio(
        TIPO_EDIFICIO.RENOMBRADO_IGNORADO,
        `La parte ${i + 1} conserva su nombre («${edificio.partes[i].nombre}»): el nombre ` +
          'nuevo estaba vacío y una parte sin nombre no se puede distinguir de las demás.',
        SEVERIDAD.AVISO,
        { indice: i, nombreAnterior: edificio.partes[i].nombre },
      ),
    )
  } else {
    partes = edificio.partes.map((p, j) => (j === i ? { ...p, nombre } : p))
  }

  return { edificio: reconstruir(edificio, { partes }), detecciones }
}

// ── conAtributos ─────────────────────────────────────────────────────────────

/**
 * Fija uno o varios de los siete atributos semánticos del edificio.
 *
 * `parciales` es un subconjunto de `ATRIBUTOS_COMPLETO`. Dentro:
 *   · un valor cualquiera **fija** ese atributo,
 *   · `null` lo **vacía** («aún no conocido»),
 *   · `undefined` significa **no tocar** — la clave se ignora, que es lo que un
 *     formulario a medio rellenar produce sin querer.
 *
 * Dos cosas que NO hace, cada una por su motivo:
 *   · **No valida los valores.** Que `anioConstruccion` sea un número finito y que
 *     `estadoConservacion` esté en `ESTADO_CONSERVACION` lo comprueba
 *     `crearEdificio`, y **lanza**. Convertir el texto de un `<input>` a número es
 *     de la interfaz: si llega `'1998'`, la excepción es correcta y el que la
 *     provoca es el cableado, no el usuario.
 *   · **No cambia el modelo por su cuenta.** Si el edificio es SIMPLIFICADO, esas
 *     claves no existen y `crearEdificio` las descarta: el resultado sale sin
 *     ellas y con una detección `ATRIBUTO_NO_MAPEADO` que lo dice. Cambiar el
 *     modelo a escondidas para que «funcione» sería decidir por el usuario justo
 *     lo que el selector de la ficha F11 §14.1 le pregunta primero de todo.
 *
 * @param {object} edificio  El `Edificio` actual (no se muta).
 * @param {Record<string, unknown>} parciales  Subconjunto de `ATRIBUTOS_COMPLETO`.
 * @returns {ResultadoMutacion}
 * @throws {TypeError}   Si `edificio` no tiene forma de Edificio o `parciales` no
 *   es un objeto plano.
 * @throws {RangeError}  Si `parciales` trae una clave que no es de los siete: un
 *   typo en el nombre de un atributo no puede quedarse en «no ha pasado nada»
 *   (misma barrera que `crearEdificio` con `modelo`, auditoría A4).
 */
export function conAtributos(edificio, parciales) {
  exigirEdificio(edificio, 'conAtributos')
  if (!parciales || typeof parciales !== 'object' || Array.isArray(parciales)) {
    throw new TypeError(
      `conAtributos: 'parciales' debe ser un objeto plano con un subconjunto de los ` +
        `atributos semánticos; recibido ${JSON.stringify(parciales)}.`,
    )
  }
  const desconocidas = Object.keys(parciales).filter((c) => !ATRIBUTOS_COMPLETO.includes(c))
  if (desconocidas.length > 0) {
    throw new RangeError(
      `conAtributos: atributo(s) desconocido(s): ${desconocidas.join(', ')}. ` +
        `Válidos: ${ATRIBUTOS_COMPLETO.join(', ')}.`,
    )
  }

  const cambios = {}
  for (const [clave, valor] of Object.entries(parciales)) {
    if (valor !== undefined) cambios[clave] = valor
  }

  const detecciones = []
  const claves = Object.keys(cambios)
  if (claves.length > 0 && edificio.modelo !== MODELO_EDIFICIO.COMPLETO) {
    detecciones.push(
      crearDeteccionEdificio(
        TIPO_EDIFICIO.ATRIBUTO_NO_MAPEADO,
        `El edificio es de modelo ${edificio.modelo}, que no guarda atributos semánticos: ` +
          `${claves.length === 1 ? 'el atributo indicado' : `los ${claves.length} atributos indicados`} ` +
          `(${enumerar(claves)}) no se ${claves.length === 1 ? 'ha guardado' : 'han guardado'}. ` +
          'Cambia primero el modelo a COMPLETO.',
        SEVERIDAD.AVISO,
        { modelo: edificio.modelo, atributosIgnorados: claves },
      ),
    )
  }

  return { edificio: reconstruir(edificio, cambios), detecciones }
}
