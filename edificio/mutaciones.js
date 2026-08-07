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

import {
  ATRIBUTOS_COMPLETO,
  MODELO_EDIFICIO,
  ORIGEN_PARTE,
  TIPO_PARTE,
  crearEdificio,
} from '../model/edificio.js'
import { SEVERIDAD, TIPO_EDIFICIO, crearDeteccionEdificio, nombreParteGenerico } from './_comun.js'

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
    // F12 · T1.1. Va el PRIMERO y no es cosmético: si `reconstruir` no lo
    // arrastrara, CUALQUIER mutación —renombrar una parte, teclear la referencia
    // catastral— devolvería un edificio sin identidad, y el autoguardado dejaría
    // de reconocer el borrador que él mismo escribió. Un `?? null` de más aquí
    // es un expediente huérfano allí, y en silencio.
    idLocal: edificio.idLocal ?? null,
    refcat: edificio.refcat ?? null,
    modelo: edificio.modelo,
    partes: edificio.partes,
    parcelaContexto: edificio.parcelaContexto ?? null,
    construccionOficial: edificio.construccionOficial ?? null,
    // ⛔ F21 · POR EL MISMO MOTIVO QUE `idLocal`, Y CASI SE ME OLVIDA. Sin esta
    // línea, `crearEdificio` le pondría su `null` por defecto y **cualquier**
    // mutación —renombrar una parte, mover un vértice, cambiar de modelo— borraría
    // la precisión declarada sin decir nada, para reaparecer como `xsi:nil` en un
    // documento firmado. Lo cazó el guardián del shape de `test/model/edificio.js`
    // al ponerse rojo por la clave nueva; el valor no lo miraba nadie todavía, así
    // que `test/edificio/mutaciones.test.js` lo mira ahora.
    precisionMetros: edificio.precisionMetros ?? null,
  }
  for (const clave of ATRIBUTOS_COMPLETO) {
    if (clave in edificio) base[clave] = edificio[clave]
  }
  return crearEdificio({ ...base, ...cambios })
}

/** Enumera claves con sus rótulos: «uso dominante, estado de conservación…». */
const enumerar = (claves) => claves.map((c) => ROTULO_ATRIBUTO[c] ?? c).join(', ')

/**
 * Comprueba el índice de una parte. **LANZA**, y es la misma asimetría que
 * {@link conParteRenombrada} ya razona: un índice no lo escribe nadie a mano,
 * sale de un bucle o de un `data-parte-indice`, así que fuera de rango es un
 * contrato roto por el PROGRAMADOR. Los datos del USUARIO —un nombre en blanco,
 * unas plantas con letras— nunca lanzan.
 *
 * @param {object} edificio
 * @param {number} i
 * @param {string} fn
 * @throws {TypeError|RangeError}
 */
function exigirIndice(edificio, i, fn) {
  if (!Number.isInteger(i)) {
    throw new TypeError(`${fn}: 'i' debe ser un entero; recibido ${JSON.stringify(i)}.`)
  }
  if (i < 0 || i >= edificio.partes.length) {
    throw new RangeError(
      `${fn}: 'i' fuera de rango: ${i}. El edificio tiene ${edificio.partes.length} parte(s), ` +
        `índices válidos 0..${edificio.partes.length - 1}.`,
    )
  }
}

/** Cuántos vértices tiene el contorno de una parte, o `null` si no tiene contorno. */
const nVerticesDe = (parte) =>
  Array.isArray(parte?.recinto?.vertices) ? parte.recinto.vertices.length : null

/**
 * Un número de plantas ACEPTABLE: entero y no negativo. `null` también lo es
 * («aún no se sabe»); un `2,5` o un `-1`, no.
 *
 * ⚠️ `model/edificio.js` acepta cualquier número finito **a propósito** —valida
 * el SHAPE, no el dominio—, así que la regla de «entero ≥ 0» vive aquí, que es
 * la capa que sabe qué es una planta. Sin ella un `1.5` entraría al modelo, de
 * ahí al GML, y lo rechazaría la Sede.
 *
 * @param {unknown} v
 * @returns {boolean}
 */
const esPlantasValidas = (v) => v === null || (Number.isInteger(v) && v >= 0)

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

// ── conIdLocal ───────────────────────────────────────────────────────────────

/**
 * Fija la identidad local del edificio (F12 · T4.3).
 *
 * ⛔ **Por qué hace falta, y no es cosmética.** Sin `idLocal` un `Edificio` no se
 * puede archivar ni autoguardar: `app/cableado-expediente.js` distingue **una
 * edición** de **otro documento** comparando la identidad del store contra la del
 * documento abierto, y con `null` a los dos lados esa comparación dice «es el mismo»
 * siempre. El desenlace sería que cargar un edificio nuevo encima de otro heredaría
 * el nombre y el registro del anterior, y el siguiente guardado lo pisaría.
 * `model/edificio.js` abrió el campo en T1.1; esto es lo que lo llena.
 *
 * **No normaliza nada**, por lo mismo que {@link conRefcat}: el texto sale del
 * nombre de un fichero o de una referencia catastral que ha tecleado alguien, y
 * corregirlo por su cuenta es la regla de oro 1 al revés. Lo único que no pasa es un
 * texto vacío o en blanco — `crearEdificio` lo rechaza, porque una identidad falsa
 * con aspecto de identidad es peor que no tener ninguna.
 *
 * @param {object} edificio  El `Edificio` actual (no se muta).
 * @param {string|null} idLocal  La identidad, o `null` para dejarlo sin archivar.
 * @returns {ResultadoMutacion}  `detecciones` siempre vacío.
 * @throws {TypeError}  Si `edificio` no tiene forma de Edificio, o si `idLocal` no
 *   es texto ni `null` — incluido `undefined`, que aquí NO significa «déjala como
 *   está»: `crearEdificio` lo tomaría por su valor por defecto y borraría la
 *   identidad en silencio, que es el mismo agujero que cerró `conRefcat`.
 * @throws {RangeError}  Lo que lance `crearEdificio` con un texto en blanco.
 */
export function conIdLocal(edificio, idLocal) {
  exigirEdificio(edificio, 'conIdLocal')
  if (idLocal !== null && typeof idLocal !== 'string') {
    throw new TypeError(
      `conIdLocal: 'idLocal' debe ser un texto o null (todavía sin identidad); ` +
        `recibido ${JSON.stringify(idLocal)}.`,
    )
  }
  return { edificio: reconstruir(edificio, { idLocal }), detecciones: [] }
}

// ── conPrecision ─────────────────────────────────────────────────────────────

/**
 * Fija la precisión del trabajo profesional, en metros (F21).
 *
 * ⭐ **Es el dato que la Sede exige tres pantallas antes de que el fichero
 * exista.** El paso 1 del ICUC pide «precisión del trabajo en metros» como campo
 * obligatorio (medido en la subida del 2026-08-07: se declaró 0,010 m con
 * metodología GNSS), y `gml/serialize-bu.js` sabe emitirla desde F13 en su
 * `horizontalGeometryEstimatedAccuracy`. Lo que faltaba era que el técnico pudiera
 * decirla.
 *
 * ⚠️ **`null` es un valor legítimo y NO es lo mismo que no llamar.** Significa «no
 * consta», que es lo que el GML dice con `xsi:nil` y lo que era verdad hasta F21:
 * borrar el campo es una decisión del usuario tan válida como rellenarlo.
 * `undefined`, en cambio, LANZA — por lo mismo que en {@link conRefcat}:
 * `crearEdificio` lo tomaría por su valor por defecto y borraría en silencio un
 * dato que se va a firmar.
 *
 * ⛔ **El rango lo comprueba `crearEdificio` y no esta función**, a propósito: es
 * un invariante del dominio, no de esta mutación, y duplicarlo aquí sería tener dos
 * sitios que pueden divergir sobre cuánto vale un metro. Lo que sí se hace es
 * distinguir los dos fallos, como el resto del módulo — un tipo equivocado es
 * contrato del programador (`TypeError`) y un número fuera de rango sube tal cual
 * el `RangeError` del modelo, con su mensaje, que ya nombra el formulario.
 *
 * @param {object} edificio  El `Edificio` actual (no se muta).
 * @param {number|null} precisionMetros  La precisión, o `null` para dejarla sin
 *   declarar.
 * @returns {ResultadoMutacion}  `detecciones` siempre vacío: no se descarta nada
 *   ni se decide nada por el usuario, así que no hay qué contarle.
 * @throws {TypeError}   Si `edificio` no tiene forma de Edificio, o si
 *   `precisionMetros` no es número ni `null` (incluido `undefined`).
 * @throws {RangeError}  Lo que lance `crearEdificio` fuera de `[0, 9.999]`.
 */
export function conPrecision(edificio, precisionMetros) {
  exigirEdificio(edificio, 'conPrecision')
  if (precisionMetros !== null && typeof precisionMetros !== 'number') {
    throw new TypeError(
      `conPrecision: 'precisionMetros' debe ser un número o null (sin declarar); ` +
        `recibido ${JSON.stringify(precisionMetros)}.`,
    )
  }
  return { edificio: reconstruir(edificio, { precisionMetros }), detecciones: [] }
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

// ═════════════════════════════════════════════════════════════════════════════
// F12 · T1.2 · LAS CINCO QUE HACEN QUE LA LISTA DE PARTES SEA UNA LISTA
// ═════════════════════════════════════════════════════════════════════════════
// Hasta aquí, todo lo de arriba es de F11 y trata al edificio como algo que YA
// está: se le cambia el modelo, la referencia y el rótulo de sus partes, pero la
// lista de partes es la que trajo el fichero y no se toca. Estas cinco son las
// que la convierten en una lista de verdad — se añade, se quita, se clasifica,
// se le ponen plantas y se le cambia el contorno—, que es el objetivo entero de
// F12 (`spec/feature-12-edificio-partes.md` §15.1 y §15.2).
//
// Mismo contrato que las cuatro de arriba, y no es estilo: `{edificio,
// detecciones}` siempre, `crearEdificio` como único constructor, y el POJO del
// store intacto byte a byte. Lo que sostiene el undo/redo es eso.
//
// ── LA ASIMETRÍA, OTRA VEZ Y EN LAS CINCO ───────────────────────────────────
//   · Índice fuera de rango, tipo desconocido  → **LANZA** (contrato roto por el
//     programador: eso sale de un bucle o de un `data-parte-indice`).
//   · Plantas con letras, un decimal, un negativo, un nombre en blanco
//                                              → **detección**, nunca `throw`:
//     eso sale de un teclado y no puede reventar dentro de un `click`.

// ── conParteAnadida ──────────────────────────────────────────────────────────

/**
 * Añade una parte NUEVA al final de la lista.
 *
 * Nace **sin contorno** (`recinto: null`), que es un estado que el modelo admite
 * desde F00 y que la ficha llama «pendiente de dibujar el recinto»: es el caso
 * común de esta fase —declarar un porche o una piscina que no estaban— y el
 * dibujo viene después, con `edit/dibujo.js`. Se devuelve una detección
 * {@link TIPO_EDIFICIO}.PARTE_SIN_GEOMETRIA que lo dice, porque una parte que no
 * se ve en el mapa y sí se cuenta en la lista es exactamente la clase de
 * desajuste que la regla de oro 1 persigue.
 *
 * **El nombre por defecto sale de `nombreParteGenerico`**, la misma función que
 * usan las tres fábricas de entrada. No es aseo: el barrel lo dice con estas
 * palabras —«quien cree una parte por otra vía, el dibujo a mano de F12, tiene
 * que usar la misma o la aplicación acabará con dos convenciones de nombre para
 * el mismo objeto en la misma lista»—. Y se numera por la POSICIÓN que va a
 * ocupar, así que tras eliminar la 2 de tres partes, la siguiente vuelve a ser
 * «Parte 3»: los nombres genéricos describen el sitio, no la historia.
 *
 * `origen` es siempre `DIBUJADA` y no se puede elegir: una parte creada aquí no
 * viene de ningún fichero. Las que sí vienen de uno entran por `edificio/entrada.js`.
 *
 * @param {object} edificio  El `Edificio` actual (no se muta).
 * @param {object} [opciones]
 * @param {string} [opciones.nombre]  Rótulo. Si falta, o viene en blanco, se usa
 *   el genérico — y a diferencia de {@link conParteRenombrada}, aquí un nombre
 *   vacío NO es un aviso: nadie ha borrado nada, es que no se ha dicho.
 * @param {'PRINCIPAL'|'OTRA'} [opciones.tipo='PRINCIPAL']
 * @returns {ResultadoMutacion}
 * @throws {TypeError}   Si `edificio` no tiene forma de Edificio.
 * @throws {RangeError}  Si `tipo` no está en `TIPO_PARTE` (lo lanza el modelo).
 */
export function conParteAnadida(edificio, { nombre, tipo = TIPO_PARTE.PRINCIPAL } = {}) {
  exigirEdificio(edificio, 'conParteAnadida')

  const indice = edificio.partes.length
  const rotulo =
    typeof nombre === 'string' && nombre.trim().length > 0 ? nombre : nombreParteGenerico(indice)

  const parte = {
    nombre: rotulo,
    tipo,
    recinto: null,
    plantasSobreRasante: null,
    plantasBajoRasante: null,
    origen: ORIGEN_PARTE.DIBUJADA,
  }

  const detecciones = [
    crearDeteccionEdificio(
      TIPO_EDIFICIO.PARTE_SIN_GEOMETRIA,
      `«${rotulo}» se ha añadido sin contorno: está pendiente de dibujar el recinto. ` +
        'Hasta que lo tenga no se pinta en el mapa ni suma superficie.',
      SEVERIDAD.INFO,
      { indice, nombre: rotulo, tipo },
    ),
  ]

  return { edificio: reconstruir(edificio, { partes: [...edificio.partes, parte] }), detecciones }
}

// ── conParteEliminada ────────────────────────────────────────────────────────

/**
 * Quita la parte `i` de la lista.
 *
 * Devuelve una detección {@link TIPO_EDIFICIO}.PARTE_ELIMINADA **con lo que se
 * lleva**: el nombre, el tipo y cuántos vértices tenía el contorno. Quitar una
 * fila vacía y quitar un recinto de 35 vértices que alguien acaba de dibujar se
 * piden con el mismo botón, y la lista de un edificio real tiene trece filas que
 * se parecen mucho entre sí.
 *
 * ⚠️ **No pregunta ni impide nada**: eso es de `app/`, que es quien tiene el
 * diálogo. Y no hace falta que sea irreversible — `edit/historial.js` fotografía
 * el POJO entero con `structuredClone`, así que deshacer la devuelve entera.
 *
 * @param {object} edificio  El `Edificio` actual (no se muta).
 * @param {number} i  Índice 0-based en `edificio.partes`.
 * @returns {ResultadoMutacion}
 * @throws {TypeError}   Si `edificio` no tiene forma de Edificio o `i` no es entero.
 * @throws {RangeError}  Si `i` está fuera de `[0, partes.length)`.
 */
export function conParteEliminada(edificio, i) {
  exigirEdificio(edificio, 'conParteEliminada')
  exigirIndice(edificio, i, 'conParteEliminada')

  const parte = edificio.partes[i]
  const nVertices = nVerticesDe(parte)

  const detecciones = [
    crearDeteccionEdificio(
      TIPO_EDIFICIO.PARTE_ELIMINADA,
      `Se ha quitado «${parte.nombre}»` +
        (nVertices === null
          ? ', que no tenía contorno dibujado.'
          : `, con su contorno de ${nVertices} vértice${nVertices === 1 ? '' : 's'}.`) +
        ' Deshacer la devuelve.',
      SEVERIDAD.AVISO,
      {
        indice: i,
        nombre: parte.nombre,
        tipo: parte.tipo,
        nVertices,
        origen: parte.origen,
      },
    ),
  ]

  const partes = edificio.partes.filter((_, j) => j !== i)
  return { edificio: reconstruir(edificio, { partes }), detecciones }
}

// ── conPlantas ───────────────────────────────────────────────────────────────

/**
 * Fija las plantas sobre y bajo rasante de la parte `i`.
 *
 * Los tres casos, y cada uno con su motivo:
 *   · **La parte es `OTRA`** (piscina y similares) → no se guarda nada y sale
 *     {@link TIPO_EDIFICIO}.PLANTAS_NO_APLICAN con `motivo: 'ASIGNACION'`. En una
 *     piscina las plantas **no son cero: no aplican**, y ése es el convenio que
 *     el modelo defiende forzándolas a `null` (override O11).
 *   · **Un valor no es un número de plantas** —un decimal, un negativo, texto—
 *     → ese valor se ignora, el otro sí se aplica, y sale
 *     {@link TIPO_EDIFICIO}.PLANTAS_NO_VALIDAS. **No lanza**: viene de un teclado.
 *   · **Todo correcto** → se aplica, sin detecciones.
 *
 * `undefined` significa **no tocar** (el campo que el usuario no ha rellenado);
 * `null` significa **vaciar** («aún no se sabe»). Es el mismo convenio que
 * {@link conAtributos}, y por el mismo motivo: un formulario a medio rellenar no
 * puede borrar lo que no menciona.
 *
 * @param {object} edificio  El `Edificio` actual (no se muta).
 * @param {number} i  Índice 0-based en `edificio.partes`.
 * @param {object} plantas
 * @param {number|null} [plantas.sobre]  Plantas sobre rasante.
 * @param {number|null} [plantas.bajo]   Plantas bajo rasante (sótanos).
 * @returns {ResultadoMutacion}
 * @throws {TypeError}   Si `edificio` no tiene forma de Edificio, `i` no es
 *   entero o `plantas` no es un objeto plano.
 * @throws {RangeError}  Si `i` está fuera de rango.
 */
export function conPlantas(edificio, i, plantas) {
  exigirEdificio(edificio, 'conPlantas')
  exigirIndice(edificio, i, 'conPlantas')
  if (!plantas || typeof plantas !== 'object' || Array.isArray(plantas)) {
    throw new TypeError(
      `conPlantas: 'plantas' debe ser un objeto plano {sobre?, bajo?}; ` +
        `recibido ${JSON.stringify(plantas)}.`,
    )
  }

  const parte = edificio.partes[i]
  const detecciones = []

  // 1 · Las partes OTRA no llevan plantas. Se para ANTES de validar los valores:
  //     decirle a alguien que «2,5 no es un número de plantas» en una piscina
  //     sería contestar a la pregunta equivocada.
  if (parte.tipo === TIPO_PARTE.OTRA) {
    const pedidas = ['sobre', 'bajo'].filter((k) => plantas[k] !== undefined)
    if (pedidas.length > 0) {
      detecciones.push(
        crearDeteccionEdificio(
          TIPO_EDIFICIO.PLANTAS_NO_APLICAN,
          `«${parte.nombre}» es una construcción de tipo «otra» (piscina y similares), y en ` +
            'ésas las plantas no son cero: no aplican. No se ha guardado ninguna. Si de verdad ' +
            'tiene plantas, cámbiala antes a tipo «principal».',
          SEVERIDAD.AVISO,
          { indice: i, nombre: parte.nombre, motivo: 'ASIGNACION', pedidas },
        ),
      )
    }
    return { edificio: reconstruir(edificio, { partes: edificio.partes }), detecciones }
  }

  // 2 · Valor a valor: lo que no es un número de plantas se ignora y se dice.
  const siguiente = { ...parte }
  const ignorados = []
  for (const [clave, campo] of [
    ['sobre', 'plantasSobreRasante'],
    ['bajo', 'plantasBajoRasante'],
  ]) {
    const valor = plantas[clave]
    if (valor === undefined) continue
    if (esPlantasValidas(valor)) siguiente[campo] = valor
    else ignorados.push({ clave, valor })
  }

  if (ignorados.length > 0) {
    detecciones.push(
      crearDeteccionEdificio(
        TIPO_EDIFICIO.PLANTAS_NO_VALIDAS,
        `Un número de plantas es un entero de cero para arriba. En «${parte.nombre}» no se ha ` +
          `guardado ${ignorados
            .map((x) => `${x.clave === 'sobre' ? 'sobre rasante' : 'bajo rasante'} (${JSON.stringify(x.valor)})`)
            .join(' ni ')}.`,
        SEVERIDAD.AVISO,
        { indice: i, nombre: parte.nombre, ignorados },
      ),
    )
  }

  const partes = edificio.partes.map((p, j) => (j === i ? siguiente : p))
  return { edificio: reconstruir(edificio, { partes }), detecciones }
}

// ── conTipoParte ─────────────────────────────────────────────────────────────

/**
 * Cambia el tipo de la parte `i` entre `PRINCIPAL` y `OTRA`.
 *
 * ⚠️ **Pasar a `OTRA` BORRA las plantas**, porque `crearParteConstruccion` las
 * fuerza a `null` en ese tipo (`model/edificio.js:161-168`). Es el mismo caso que
 * {@link conModelo} con los siete atributos: una acción destructiva que hay que
 * poder enseñar ANTES de aplicarla, así que el borrado se anuncia con
 * {@link TIPO_EDIFICIO}.PLANTAS_NO_APLICAN y `motivo: 'CAMBIO_DE_TIPO'`, con lo
 * que valían. Y solo se anuncia **si había algo que perder**: avisar de que se
 * pierden dos `null` es ruido.
 *
 * En el otro sentido (`OTRA` → `PRINCIPAL`) las plantas quedan a `null`, no se
 * reponen a lo que valían antes: aquí no hay memoria de eso, y **no se inventa
 * ninguna** (regla de oro 9).
 *
 * @param {object} edificio  El `Edificio` actual (no se muta).
 * @param {number} i  Índice 0-based en `edificio.partes`.
 * @param {'PRINCIPAL'|'OTRA'} tipo  El tipo destino.
 * @returns {ResultadoMutacion}
 * @throws {TypeError}   Si `edificio` no tiene forma de Edificio o `i` no es entero.
 * @throws {RangeError}  Si `i` está fuera de rango, o si `tipo` no está en
 *   `TIPO_PARTE` — un typo no puede degradar en silencio a PRINCIPAL, que es la
 *   misma barrera que `crearParteConstruccion` pone.
 */
export function conTipoParte(edificio, i, tipo) {
  exigirEdificio(edificio, 'conTipoParte')
  exigirIndice(edificio, i, 'conTipoParte')
  const tiposValidos = Object.values(TIPO_PARTE)
  if (!tiposValidos.includes(tipo)) {
    throw new RangeError(
      `conTipoParte: 'tipo' inválido: ${JSON.stringify(tipo)}. Válidos: ${tiposValidos.join(', ')}.`,
    )
  }

  const parte = edificio.partes[i]
  const detecciones = []

  const teniaPlantas = parte.plantasSobreRasante !== null || parte.plantasBajoRasante !== null
  if (tipo === TIPO_PARTE.OTRA && parte.tipo !== TIPO_PARTE.OTRA && teniaPlantas) {
    detecciones.push(
      crearDeteccionEdificio(
        TIPO_EDIFICIO.PLANTAS_NO_APLICAN,
        `«${parte.nombre}» pasa a ser una construcción de tipo «otra», y ésas no llevan plantas: ` +
          `se pierden las que tenía (${parte.plantasSobreRasante ?? 'sin indicar'} sobre rasante, ` +
          `${parte.plantasBajoRasante ?? 'sin indicar'} bajo rasante). Volver a «principal» las ` +
          'deja vacías, no como estaban.',
        SEVERIDAD.AVISO,
        {
          indice: i,
          nombre: parte.nombre,
          motivo: 'CAMBIO_DE_TIPO',
          sobreRasante: parte.plantasSobreRasante,
          bajoRasante: parte.plantasBajoRasante,
        },
      ),
    )
  }

  const partes = edificio.partes.map((p, j) => (j === i ? { ...p, tipo } : p))
  return { edificio: reconstruir(edificio, { partes }), detecciones }
}

// ── conParteRedibujada ───────────────────────────────────────────────────────

/**
 * Reemplaza el contorno de la parte `i`.
 *
 * Es por donde entra TODO lo que el mapa le hace a la geometría de una parte:
 * lo que dibuja `edit/dibujo.js` desde cero y lo que devuelve la edición de F06
 * a través del store adaptador. Una sola puerta, para que el POJO del store se
 * reconstruya siempre igual.
 *
 * ⛔ **NO toca `origen`, y es una decisión.** Arrastrar un vértice de una parte
 * que vino de un DXF no la convierte en «dibujada»: `origen` dice **de dónde
 * entró** la geometría, no quién la ha tocado después — que es exactamente lo que
 * `ORIGEN_PARCELA` significa en la otra rama desde F00. Si cambiara aquí, la
 * primera vez que alguien moviera un vértice el edificio entero dejaría de saber
 * de qué fichero salió, y lo haría en silencio. Lo que sí nace `DIBUJADA` es la
 * parte que crea {@link conParteAnadida}, porque ésa no viene de ningún sitio.
 *
 * ⚠️ **No valida la geometría.** Ni cierra el anillo, ni comprueba que no se
 * cruce consigo mismo, ni exige un mínimo de vértices: de eso saben `validation/`
 * y `edit/dibujo.js`, y duplicarlo aquí sería tener dos definiciones de lo que es
 * un contorno válido. Lo único que se exige es la FORMA (`{vertices:[…]}` o
 * `null`), y eso lo hace el modelo.
 *
 * @param {object} edificio  El `Edificio` actual (no se muta).
 * @param {number} i  Índice 0-based en `edificio.partes`.
 * @param {{vertices: Array<[number,number]>, tipo?: string}|null} recinto  El
 *   contorno nuevo, o `null` para dejar la parte pendiente de dibujar otra vez.
 * @returns {ResultadoMutacion}  `detecciones` lleva un
 *   {@link TIPO_EDIFICIO}.PARTE_SIN_GEOMETRIA si el contorno se ha quitado.
 * @throws {TypeError}   Si `edificio` no tiene forma de Edificio, `i` no es
 *   entero, o `recinto` no es `null` ni `{vertices: Array}` (lo lanza el modelo).
 * @throws {RangeError}  Si `i` está fuera de rango.
 */
export function conParteRedibujada(edificio, i, recinto) {
  exigirEdificio(edificio, 'conParteRedibujada')
  exigirIndice(edificio, i, 'conParteRedibujada')

  const parte = edificio.partes[i]
  const detecciones = []

  if (recinto === null && parte.recinto !== null) {
    detecciones.push(
      crearDeteccionEdificio(
        TIPO_EDIFICIO.PARTE_SIN_GEOMETRIA,
        `«${parte.nombre}» se queda sin contorno: vuelve a estar pendiente de dibujar el ` +
          'recinto, y mientras tanto no se pinta en el mapa ni suma superficie.',
        SEVERIDAD.AVISO,
        { indice: i, nombre: parte.nombre, nVerticesAnteriores: nVerticesDe(parte) },
      ),
    )
  }

  const partes = edificio.partes.map((p, j) => (j === i ? { ...p, recinto } : p))
  return { edificio: reconstruir(edificio, { partes }), detecciones }
}
