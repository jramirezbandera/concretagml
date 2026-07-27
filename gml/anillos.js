// gml/anillos.js — F04 · El corazón NUMÉRICO del serializador de parcela (T2.1).
//
// Este módulo decide, para cada anillo del modelo, EXACTAMENTE qué números se
// escriben en el `gml:posList` y qué `cp:areaValue` los acompaña. Son funciones
// libres puras sobre POJOs: no toca el DOM (eso es `gml/xml.js`), no conoce
// namespaces ni el orden XSD (eso es `gml/_comun.js`) y no fabrica `gml:id`
// (eso es `gml/ids.js`). Solo aritmética — y por eso lleva esta cabecera tan
// larga: cada paso está donde está por un motivo MEDIDO, y reordenarlos «para
// simplificar» rompe la fidelidad al Catastro sin que ningún test de las capas
// de arriba se entere.
//
// ═════════════════════════════════════════════════════════════════════════════
// EL ORDEN DE OPERACIONES ES EL CONTRATO
// ═════════════════════════════════════════════════════════════════════════════
//
//   1.  REDONDEAR  cada vértice a 2 decimales           → redondearAnillo
//   1b. DETECTAR   los vértices que se FUNDEN al hacerlo → COLAPSO_POR_REDONDEO
//   2.  ORIENTAR   exterior HORARIO, huecos antihorario  → ORIENTACION_NORMALIZADA
//   3.  ÁREA       superficie() sobre 1+2, a entero      → areaValue (override O6)
//   4.  CERRAR     solo al EMITIR: el modelo vive ABIERTO (regla de oro 4)
//
// ── Por qué 1 antes que 3 ────────────────────────────────────────────────────
// Es la regla de oro 11 literal: «calcular la superficie publicada desde las
// coordenadas ya redondeadas para que cuadre con el GML». No admite otra
// lectura. Si se midiera el área sobre el modelo en float64 completo y luego se
// redondearan las coordenadas, el `areaValue` publicado sería el de un polígono
// que NO es el que va escrito en el fichero. La diferencia es de centímetros
// cuadrados y nadie la vería… hasta el rechazo del IVG.
//
// ── Por qué el redondeo es `Number(v.toFixed(2))` y NUNCA `Math.round(v*100)/100`
// Divergen en magnitudes UTM reales. MEDIDO con una abscisa del fixture:
//
//     439283.235  →  toFixed:            439283.23
//                 →  Math.round(v*100):  439283.24     (v*100 = 43928323.5)
//
// Solo `toFixed` garantiza la propiedad que necesita el serializador:
//
//     redondearCoord(v).toFixed(2) === v.toFixed(2)
//
// es decir, que **el número sobre el que se calcula el área es exactamente el
// que se escribe en el fichero**. Cualquier otra fórmula deja una rendija por la
// que `areaValue` deja de cuadrar con las coordenadas publicadas. El test
// `test/gml/anillos.test.js` clava esa divergencia con ese valor concreto para
// que nadie «simplifique» la expresión.
//
// ── Por qué 2 antes que 3 ────────────────────────────────────────────────────
// El shoelace es invariante EN SIGNO bajo inversión, pero no bit a bit. MEDIDO
// sobre el anillo real con un `.reverse()` plano:
//
//     −1535.865149996761   →   +1535.8651499967611     (último bit distinto)
//
// Aquí las dos formas redondean a 1536, así que hoy da igual; pero una parcela
// cuya superficie cayera a 1e-12 de un `x.5` volcaría de un entero al otro según
// el orden en que se hicieran las cosas. Fijar el orden elimina la clase entera
// de bug y es gratis. Y conceptualmente cierra el círculo con la regla 11: se
// publica el área del anillo **tal y como se escribe**, orientación incluida.
//
// ── Por qué la inversión PRESERVA EL PIVOTE ──────────────────────────────────
// `invertirAnillo` es `[a[0], ...a.slice(1).reverse()]`, no `[...a].reverse()`:
//   (a) MEDIDO: con el pivote intacto, `|área|` sale BIT-IDÉNTICA a la del
//       anillo original, porque `geo/area.js` traslada al PRIMER vértice antes
//       del sumatorio (regla de oro 5) y así el origen local no cambia. Con un
//       `.reverse()` plano el origen pasa a ser otro vértice y el último bit
//       baila (ver arriba).
//   (b) El `posList` sigue empezando por el vértice con el que el técnico
//       entregó su parcela. Importa para el round-trip y para que, al abrir el
//       GML generado, reconozca su propio dato en vez de una lista rotada.
//
// ── EL PUNTO CIEGO QUE ESTE MÓDULO CIERRA ────────────────────────────────────
// F02 valida el modelo SIN redondear. Dos vértices a 4 mm son perfectamente
// válidos para `validation/reglas-geometria.js` (`duplicadoMetros: 0.001` = 1 mm)
// y **se convierten en el mismo punto** al aplicar `toFixed(2)`: el GML saldría
// con un segmento de longitud cero. NINGÚN test de F02 puede detectarlo, porque
// el redondeo ocurre después de que F02 haya terminado. De ahí
// `COLAPSO_POR_REDONDEO`, que es la única regla geométrica que vive aquí y no
// allí. Se DETECTA, no se corrige: quitar el vértice cambiaría la geometría en
// silencio (regla de oro 1) y la corrección es decisión del usuario.
//
// RESIDUAL CONOCIDO, escrito para que no sorprenda: un colapso puede además
// crear una AUTOINTERSECCIÓN que solo `kinks` vería. Ese chequeo —revalidar la
// topología DESPUÉS de redondear— es de F08, no de esta tarea.
//
// ── Bordes de `toFixed(2)` que se cierran aquí ───────────────────────────────
//   · `(-0.001).toFixed(2)` → `"-0.00"`. Un cero con signo. `redondearCoord`
//     normaliza `-0` → `0` para que el valor redondeado no pueda arrastrar el
//     signo hasta ningún formateador de aguas abajo, y para que la comparación
//     del round-trip no escupa un diff incomprensible (`toEqual` de Vitest
//     distingue `-0` de `0`).
//   · `(1e21).toFixed(2)` → `"1e+21"`. NOTACIÓN EXPONENCIAL DENTRO DEL POSLIST,
//     que rompe el GML sin que nada chille. Inalcanzable con UTM peninsular,
//     pero un DXF corrupto llega hasta aquí a través de F01 sin que nadie mire
//     la magnitud (`crearRecinto` solo exige que el número sea finito). De ahí
//     el `RangeError` por encima de 1e15: es la última barrera antes del
//     fichero, y prefiere reventar a escribir un GML mudo y malo.
//
// ── Fronteras ────────────────────────────────────────────────────────────────
//   · El signo lo da `orientacion()` de `geo/area.js`, que es la fuente de
//     verdad del área y del signo en este proyecto. `@turf/boolean-clockwise`
//     NO se usa en producción: es devDependency y sirve de ORÁCULO externo en
//     el test (regla de oro 8), nunca de implementación.
//   · De Turf solo lo topológico y por SUBPAQUETE (regla 6):
//     `@turf/boolean-point-in-polygon`, `@turf/point-on-feature`, `@turf/helpers`.
//   · Este módulo NO importa `model/parcela.js`: replica las dos etiquetas de
//     `TIPO_RECINTO` en {@link ORIENTACION_ESPERADA}, con test-guarda que
//     prohíbe divergir. Misma fórmula que `gml/_comun.js#SRS_SOPORTADOS` frente
//     a `model/parcela.js#SRS_VALIDOS`, y por el mismo motivo: `gml/` no
//     arrastra el modelo entero para conocer dos cadenas.
//   · Ni aquí ni en ninguna parte de `gml/` se lee el reloj del sistema: la
//     reproducibilidad del test de ida y vuelta de F04 depende de que este
//     módulo sea función pura de sus entradas. Hay un test que lo comprueba con
//     un grep sobre el TEXTO de este fichero.

import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import pointOnFeature from '@turf/point-on-feature'
import { polygon } from '@turf/helpers'
import { orientacion, superficie } from '../geo/area.js'
import { TIPO_GML, SEVERIDAD, crearDeteccionGml } from './_comun.js'

// ── Constantes ────────────────────────────────────────────────────────────────

/**
 * Decimales del `gml:posList` (dossier §1.1 y feature-04 §"Detalles"): pares
 * X Y con `toFixed(2)`. El centímetro es la unidad de publicación del Catastro;
 * el modelo sigue viviendo en float64 completo (regla de oro 11).
 *
 * @readonly
 */
export const DECIMALES_COORD = 2

/**
 * Magnitud por encima de la cual una coordenada deja de ser publicable y
 * {@link redondearCoord} LANZA en vez de escribir cualquier cosa.
 *
 * 1e15 es holgadísimo para UTM (el Este vive en ~10⁵–10⁶ y el Norte en ~10⁶) y
 * a la vez muy por debajo de 1e21, que es donde `toFixed` cambia a notación
 * exponencial y colaría un `1e+21` dentro del `posList`. Entre 1e15 y 1e21 el
 * texto seguiría siendo decimal pero los 2 decimales ya no significarían nada
 * (el espaciado de float64 en 1e15 es 0,125 m), así que la barrera se pone
 * antes: a partir de ahí el dato NO es una coordenada UTM, es basura.
 *
 * @readonly
 */
export const LIMITE_MAGNITUD_COORD = 1e15

/**
 * Override O1 — orientación que el Catastro exige a cada tipo de anillo, en la
 * convención de signo de `geo/area.js#orientacion` (−1 horario, +1 antihorario).
 *
 * Es lo INVERSO de OGC/GeoJSON, y está VERIFICADO contra el GML real del WFS:
 * el área firmada de su anillo exterior es −1535,86 (horario) y su `areaValue`
 * es 1536. El plan v4 §8/§9 dice lo contrario y está equivocado (SPEC §3).
 *
 * Las claves duplican a propósito `model/parcela.js#TIPO_RECINTO` (ver cabecera:
 * `gml/` no importa el modelo). El test-guarda del fichero de pruebas compara
 * las dos listas y falla si divergen.
 *
 * @readonly
 * @type {Readonly<{EXTERIOR: -1, HUECO: 1}>}
 */
export const ORIENTACION_ESPERADA = Object.freeze({ EXTERIOR: -1, HUECO: 1 })

/**
 * De dónde salió el punto de referencia que devuelve {@link puntoInterior}.
 * Va en el resultado para que la UI y el informe puedan decir la verdad sobre
 * un dato que el usuario cree suyo (regla de oro 1).
 *
 * @readonly
 */
export const ORIGEN_PUNTO = Object.freeze({
  APORTADO: 'APORTADO',
  POINT_ON_FEATURE: 'POINT_ON_FEATURE',
  BARRIDO_PROPIO: 'BARRIDO_PROPIO',
})

// ── Tipos ─────────────────────────────────────────────────────────────────────

/**
 * Un recinto del modelo: anillo ABIERTO (sin repetir el vértice de cierre) en
 * UTM `[x, y]`, con su papel. `recintos[0]` es SIEMPRE el exterior.
 *
 * @typedef {Object} Recinto
 * @property {Array<[number, number]>} vertices  Pares UTM `[Este, Norte]`.
 * @property {'EXTERIOR'|'HUECO'} tipo
 */

/**
 * Resultado de {@link prepararRecintos}: los anillos listos para emitir más
 * todo lo que hubo que decidir por el camino.
 *
 * @typedef {Object} RecintosPreparados
 * @property {Recinto[]} recintos  Anillos REDONDEADOS y ORIENTADOS, todavía
 *   ABIERTOS (regla de oro 4). Copias nuevas: no comparten referencia con la
 *   entrada, que queda intacta.
 * @property {number} areaValue  `Math.round(superficieRedondeada)`. El entero
 *   que va en `cp:areaValue uom="m2"` (override O6).
 * @property {number} superficieRedondeada  Superficie NETA (exterior − huecos)
 *   calculada sobre `recintos`, es decir sobre las coordenadas que se escriben
 *   (regla de oro 11). Sin redondear a entero: el llamante puede publicarla en
 *   el informe con decimales sin recalcular nada.
 * @property {number} superficieModelo  La misma superficie NETA sobre las
 *   coordenadas ORIGINALES en float64 completo. No se publica: existe para que
 *   el diagnóstico pueda enseñar cuánto costó el redondeo.
 * @property {Array<-1|1>} orientacionOriginal  Orientación de cada anillo MEDIDA
 *   SOBRE EL ANILLO YA REDONDEADO y ANTES de normalizar (paso 2 del contrato).
 *   No es la del modelo crudo: el redondeo puede, en teoría, voltear el signo de
 *   un anillo casi degenerado, y lo que importa es el signo de lo que se publica.
 * @property {boolean[]} invertidos  `true` en los anillos que hubo que invertir.
 * @property {number} nVertices  Total de vértices de los anillos ABIERTOS ya
 *   preparados. Al emitir, cada anillo aporta uno más (el cierre), así que el
 *   `count` de su `posList` es `vertices.length + 1`.
 * @property {import('./_comun.js').DeteccionGml[]} detecciones
 */

/**
 * Resultado de {@link puntoInterior}.
 *
 * @typedef {Object} PuntoDeReferencia
 * @property {[number, number]|null} punto  Punto YA REDONDEADO garantizado
 *   ESTRICTAMENTE interior al polígono (huecos descontados), o `null` si no se
 *   pudo encontrar ninguno — en cuyo caso hay una detección de severidad ERROR.
 * @property {'APORTADO'|'POINT_ON_FEATURE'|'BARRIDO_PROPIO'|null} origen
 *   Ver {@link ORIGEN_PUNTO}. `null` cuando `punto` es `null`.
 * @property {import('./_comun.js').DeteccionGml[]} detecciones
 */

// ── Redondeo ──────────────────────────────────────────────────────────────────

/**
 * Redondea UNA coordenada a los decimales de publicación.
 *
 * `Number(v.toFixed(2))` y NUNCA `Math.round(v * 100) / 100`: ver la cabecera
 * del módulo (divergen en magnitudes UTM reales y solo `toFixed` garantiza que
 * el número calculado y el número escrito sean el mismo).
 *
 * Normaliza `-0` → `0`: `(-0.001).toFixed(2)` es `"-0.00"`, y un cero con signo
 * no tiene sitio ni en el fichero ni en las comparaciones del round-trip.
 *
 * @param {number} v  Coordenada UTM en metros.
 * @returns {number}  La misma coordenada con {@link DECIMALES_COORD} decimales.
 * @throws {TypeError}   Si `v` no es un número. El modelo garantiza pares de
 *   números (`model/parcela.js#crearRecinto` los valida), así que otra cosa es
 *   contrato roto por el programador, no dato del usuario.
 * @throws {RangeError}  Si `v` no es finito o si `|v| >= LIMITE_MAGNITUD_COORD`.
 *   Última barrera contra el `1e+21` dentro del `posList` (ver cabecera).
 */
export function redondearCoord(v) {
  if (typeof v !== 'number') {
    throw new TypeError(
      `redondearCoord: se esperaba un número; recibido ${JSON.stringify(v)}.`,
    )
  }
  if (!Number.isFinite(v)) {
    throw new RangeError(
      `redondearCoord: la coordenada no es finita (${String(v)}). ` +
        `Un posList con NaN o Infinity es un GML roto en silencio (regla de oro 1).`,
    )
  }
  if (Math.abs(v) >= LIMITE_MAGNITUD_COORD) {
    throw new RangeError(
      `redondearCoord: coordenada fuera de rango publicable (${v}); ` +
        `el límite es ${LIMITE_MAGNITUD_COORD}. Por encima, toFixed acaba emitiendo ` +
        `notación exponencial (p. ej. (1e21).toFixed(2) === "1e+21") y el posList ` +
        `dejaría de ser un GML válido. Eso no es una coordenada UTM: revisa el origen ` +
        `del dato (F01) antes de serializar.`,
    )
  }
  const r = Number(v.toFixed(DECIMALES_COORD))
  // `r + 0` no basta para matar el cero negativo (−0 + 0 es +0 pero −0 + 0 en
  // otras rutas no lo es); se compara explícitamente y se devuelve el cero
  // positivo literal.
  return r === 0 ? 0 : r
}

/**
 * Redondea un anillo entero. Copia nueva; la entrada no se toca.
 *
 * IDEMPOTENTE: redondear lo ya redondeado no lo mueve (esa es justo la
 * propiedad `redondearCoord(v).toFixed(2) === v.toFixed(2)`). Por eso las
 * funciones de más abajo pueden volver a redondear sin miedo para GARANTIZAR el
 * invariante en lugar de confiar en que el llamante ya lo hizo.
 *
 * @param {Array<[number, number]>} anillo  Anillo ABIERTO en UTM.
 * @returns {Array<[number, number]>}  Anillo nuevo con las coords redondeadas.
 * @throws {TypeError}   Si `anillo` no es un array o algún vértice no es un par.
 * @throws {RangeError}  Lo que lance {@link redondearCoord}.
 */
export function redondearAnillo(anillo) {
  if (!Array.isArray(anillo)) {
    throw new TypeError(
      `redondearAnillo: se esperaba un array de pares [x,y]; recibido ${typeof anillo}.`,
    )
  }
  return anillo.map((v, i) => {
    if (!Array.isArray(v) || v.length < 2) {
      throw new TypeError(
        `redondearAnillo: el vértice ${i} no es un par [x,y]: ${JSON.stringify(v)}.`,
      )
    }
    return [redondearCoord(v[0]), redondearCoord(v[1])]
  })
}

/**
 * Redondea un punto suelto (el `referencePoint`). Mismo contrato que
 * {@link redondearAnillo} para un solo par.
 *
 * @param {[number, number]} punto
 * @param {string} contexto  Nombre de la función llamante, para el mensaje.
 * @returns {[number, number]}
 * @throws {TypeError}
 */
function redondearPunto(punto, contexto) {
  if (!Array.isArray(punto) || punto.length < 2) {
    throw new TypeError(
      `${contexto}: se esperaba un punto [x,y]; recibido ${JSON.stringify(punto)}.`,
    )
  }
  return [redondearCoord(punto[0]), redondearCoord(punto[1])]
}

// ── Orientación y cierre ──────────────────────────────────────────────────────

/**
 * Invierte el sentido de recorrido de un anillo PRESERVANDO EL PIVOTE: el
 * primer vértice se queda donde está y se le da la vuelta al resto.
 *
 *     [a, b, c, d]  →  [a, d, c, b]        (no  [d, c, b, a])
 *
 * Los dos motivos están medidos y explicados en la cabecera del módulo: el
 * `|área|` sale bit-idéntica (el origen de traslación del shoelace no cambia) y
 * el `posList` sigue empezando por el vértice que entregó el técnico.
 *
 * Es una INVOLUCIÓN: aplicarla dos veces devuelve el anillo original.
 *
 * @param {Array<[number, number]>} anillo  Anillo ABIERTO.
 * @returns {Array<[number, number]>}  Anillo nuevo, con el sentido invertido.
 * @throws {TypeError}  Si `anillo` no es un array.
 */
export function invertirAnillo(anillo) {
  if (!Array.isArray(anillo)) {
    throw new TypeError(
      `invertirAnillo: se esperaba un array de pares [x,y]; recibido ${typeof anillo}.`,
    )
  }
  if (anillo.length === 0) return []
  return [anillo[0], ...anillo.slice(1).reverse()]
}

/**
 * Cierra un anillo: copia con el PRIMER vértice repetido al final. Es el paso 4
 * del contrato y se hace SOLO al emitir — el modelo guarda los anillos abiertos
 * (regla de oro 4), y `model/parcela.js#crearRecinto` retira el cierre de todo
 * lo que llega cerrado.
 *
 * Deliberadamente TONTA: repite el primer vértice y punto. No comprueba si el
 * anillo «ya venía cerrado» ni deduplica nada. Si el redondeo hubiera fundido el
 * último vértice con el primero, el anillo cerrado tendría un segmento de
 * longitud cero — y ese hecho YA lo ha reportado {@link prepararRecintos} como
 * `COLAPSO_POR_REDONDEO` sobre el par (n−1, 0). Corregirlo aquí, callado y a
 * espaldas de la detección, sería exactamente lo que prohíbe la regla de oro 1.
 *
 * @param {Array<[number, number]>} anillo  Anillo ABIERTO, no vacío.
 * @returns {Array<[number, number]>}  Anillo cerrado de `n + 1` posiciones.
 * @throws {TypeError}  Si no es un array o está vacío (no hay primer vértice
 *   que repetir): contrato roto por el programador.
 */
export function cerrarAnillo(anillo) {
  if (!Array.isArray(anillo)) {
    throw new TypeError(
      `cerrarAnillo: se esperaba un array de pares [x,y]; recibido ${typeof anillo}.`,
    )
  }
  if (anillo.length === 0) {
    throw new TypeError(
      'cerrarAnillo: el anillo está vacío; no hay primer vértice que repetir al final.',
    )
  }
  return [...anillo, anillo[0]]
}

// ── Helpers internos ──────────────────────────────────────────────────────────

/** Nombre legible del recinto para los mensajes (0 = exterior; resto = huecos). */
const nombreRecinto = (indice) =>
  indice === 0 ? 'el contorno exterior' : `el hueco nº ${indice}`

/**
 * Igual que {@link nombreRecinto} pero con la contracción `de + el = del`, para
 * los mensajes que lo llevan detrás de esa preposición. Existe como helper
 * propio y no como un `.replace()` en el sitio de uso porque son varios los
 * mensajes que la necesitan y la errata («de el contorno exterior») solo se ve
 * leyendo el texto ya compuesto — que es justo como se detectó, en el panel de
 * avisos durante el guion de humo, no en ninguna prueba.
 */
const delRecinto = (indice) => `del ${nombreRecinto(indice).replace(/^el /, '')}`

/** Tipo que le toca al recinto por su posición: el 0 es el exterior, el resto huecos. */
const tipoPorIndice = (indice) => (indice === 0 ? 'EXTERIOR' : 'HUECO')

/** Igualdad EXACTA de dos pares. Tras redondear, «casi igual» no existe: o son el mismo número o no. */
const mismoPunto = (a, b) => a[0] === b[0] && a[1] === b[1]

/**
 * Valida la estructura que exigen {@link prepararRecintos} y
 * {@link puntoInterior}: array no vacío, `recintos[0]` EXTERIOR y el resto
 * HUECO (multiparcela está fuera de alcance, SPEC §1).
 *
 * LANZA en vez de emitir detección a propósito: el invariante lo impone
 * `model/parcela.js` desde F00 y `geo/area.js#superficie` ya lanza por lo mismo.
 * Si llega roto hasta el serializador es un bug del programa, no un dato malo
 * del usuario.
 *
 * @param {Recinto[]} recintos
 * @param {string} contexto  Nombre de la función llamante, para el mensaje.
 * @throws {TypeError}
 */
function validarRecintos(recintos, contexto) {
  if (!Array.isArray(recintos) || recintos.length === 0) {
    throw new TypeError(
      `${contexto}: 'recintos' debe ser un array NO vacío de {vertices, tipo}; ` +
        `recibido ${JSON.stringify(recintos)}.`,
    )
  }
  for (let i = 0; i < recintos.length; i++) {
    const r = recintos[i]
    if (!r || typeof r !== 'object' || !Array.isArray(r.vertices)) {
      throw new TypeError(
        `${contexto}: recintos[${i}] debe ser un objeto con 'vertices' array; ` +
          `recibido ${JSON.stringify(r)}.`,
      )
    }
    const esperado = tipoPorIndice(i)
    if (r.tipo !== esperado) {
      throw new TypeError(
        `${contexto}: recintos[${i}].tipo debe ser '${esperado}' ` +
          `(recintos[0] es SIEMPRE el exterior y el resto huecos; multiparcela está ` +
          `fuera de alcance); recibido ${JSON.stringify(r.tipo)}.`,
      )
    }
  }
}

/**
 * Nº de vértices DISTINTOS del anillo colapsando los duplicados CONSECUTIVOS del
 * ciclo (incluida la arista de cierre n−1 → 0). Cuenta las «fronteras» del ciclo;
 * si todo colapsa a un único punto (0 fronteras) devuelve 1.
 *
 * Misma fórmula que `validation/reglas-geometria.js#contarVerticesDistintos`,
 * pero con igualdad EXACTA en vez de la tolerancia de 1 mm: allí se mide una
 * geometría continua, aquí ya se ha redondeado y dos vértices o son el mismo
 * número o no lo son.
 *
 * @param {Array<[number, number]>} anillo
 * @returns {number}
 */
function contarVerticesDistintos(anillo) {
  const n = anillo.length
  if (n === 0) return 0
  let fronteras = 0
  for (let i = 0; i < n; i++) {
    if (!mismoPunto(anillo[i], anillo[(i + 1) % n])) fronteras++
  }
  return fronteras === 0 ? 1 : fronteras
}

/**
 * Paso 1b — detecciones `COLAPSO_POR_REDONDEO` de un anillo.
 *
 * Solo se reportan los pares que ESTABAN SEPARADOS y han quedado IGUALES: un
 * duplicado que ya venía duplicado del modelo no es cosa de este módulo, lo
 * detecta `validation/reglas-geometria.js` («Vértices consecutivos duplicados»)
 * antes de llegar aquí. Lo que F02 no puede ver —y este módulo sí— es el par
 * que estaba a 4 mm, era legal, y el `toFixed(2)` ha fundido.
 *
 * Severidad, según pide el contrato de la tarea: ERROR si tras el colapso el
 * anillo CERRADO baja de 4 posiciones (un `gml:LinearRing` con menos de 4
 * puntos es rechazo directo del IVG); AVISO en cualquier otro caso. Es una
 * propiedad del ANILLO, así que todas las detecciones del mismo anillo la
 * comparten.
 *
 * @param {Array<[number, number]>} original    Anillo tal cual venía del modelo.
 * @param {Array<[number, number]>} redondeado  El mismo tras el paso 1.
 * @param {number} indice  Posición del recinto (0 = exterior).
 * @returns {import('./_comun.js').DeteccionGml[]}
 */
function deteccionesColapso(original, redondeado, indice) {
  const n = redondeado.length
  if (n < 2) return []

  // Aristas del CICLO. Con n === 2 las aristas (0,1) y (1,0) son el mismo par
  // físico: se recorre una sola vez para no doblar la detección (mismo criterio
  // que reglas-geometria.js para el dígono).
  const numAristas = n === 2 ? 1 : n
  const pares = []
  for (let i = 0; i < numAristas; i++) {
    const j = (i + 1) % n
    if (mismoPunto(redondeado[i], redondeado[j]) && !mismoPunto(original[i], original[j])) {
      pares.push([i, j])
    }
  }
  if (pares.length === 0) return []

  const distintos = contarVerticesDistintos(redondeado)
  const posicionesAlCerrar = distintos + 1
  const severidad = posicionesAlCerrar < 4 ? SEVERIDAD.ERROR : SEVERIDAD.AVISO

  return pares.map(([i, j]) => {
    const separacion = Math.hypot(
      original[j][0] - original[i][0],
      original[j][1] - original[i][1],
    )
    return crearDeteccionGml(
      TIPO_GML.COLAPSO_POR_REDONDEO,
      `Los vértices nº ${i} y nº ${j} ${delRecinto(indice)} estaban a ` +
        `${(separacion * 1000).toFixed(1)} mm y se funden en el mismo punto al redondear ` +
        `a ${DECIMALES_COORD} decimales: el GML llevaría un segmento de longitud cero. ` +
        (severidad === SEVERIDAD.ERROR
          ? 'Además el anillo se queda por debajo de los 4 puntos que exige un gml:LinearRing.'
          : 'La validación previa no puede verlo, porque trabaja sobre las coordenadas sin redondear.'),
      severidad,
      {
        recinto: indice,
        tipo: tipoPorIndice(indice),
        vertices: [i, j],
        antes: [
          [original[i][0], original[i][1]],
          [original[j][0], original[j][1]],
        ],
        despues: [redondeado[i][0], redondeado[i][1]],
        separacionMetros: separacion,
        posicionesAlCerrar,
      },
    )
  })
}

// ── Paso central: preparar los recintos ───────────────────────────────────────

/**
 * Aplica los pasos 1, 1b, 2 y 3 del contrato a un conjunto de recintos y
 * devuelve todo lo que el serializador necesita para emitir la geometría y el
 * `cp:areaValue`, más las detecciones de lo que hubo que decidir.
 *
 * NO cierra los anillos (paso 4): eso lo hace {@link cerrarAnillo} en el momento
 * de escribir cada `posList`, porque el modelo vive abierto (regla de oro 4).
 *
 * NO toca la entrada: `recintos` sale intacto y el resultado son copias nuevas.
 *
 * @param {Recinto[]} recintos  `recintos[0]` EXTERIOR, el resto HUECO. Anillos
 *   ABIERTOS en UTM, en float64 completo (sin redondear: de eso se encarga esto).
 * @returns {RecintosPreparados}
 * @throws {TypeError}   Si la estructura de `recintos` rompe el invariante del
 *   modelo, o si algún vértice no es un par de números.
 * @throws {RangeError}  Si alguna coordenada no es publicable (ver
 *   {@link redondearCoord}).
 */
export function prepararRecintos(recintos) {
  validarRecintos(recintos, 'prepararRecintos')

  // Se mide ANTES de tocar nada: es el término de comparación del redondeo, no
  // el valor que se publica (ese es `superficieRedondeada`, regla de oro 11).
  const superficieModelo = superficie(recintos)

  const detecciones = []
  const orientacionOriginal = []
  const invertidos = []
  const preparados = []

  for (let i = 0; i < recintos.length; i++) {
    const tipo = tipoPorIndice(i)
    const original = recintos[i].vertices

    // ── 1 · REDONDEAR ────────────────────────────────────────────────────────
    const redondeado = redondearAnillo(original)

    // ── 1b · COLAPSO POR REDONDEO ────────────────────────────────────────────
    detecciones.push(...deteccionesColapso(original, redondeado, i))

    // ── 2 · ORIENTAR ─────────────────────────────────────────────────────────
    // El signo se mide sobre el anillo YA REDONDEADO: se normaliza el sentido de
    // lo que se va a escribir, no el de un polígono que no llega al fichero.
    // Anillo degenerado (área firmada 0): `geo/area.js` devuelve +1 por convenio
    // documentado, así que un exterior degenerado se «invertirá» sin efecto
    // real. Es inocuo, y su problema de fondo —la degeneración— lo señala F02.
    const signo = orientacion(redondeado)
    const deseada = ORIENTACION_ESPERADA[tipo]
    const invertir = signo !== deseada
    const anillo = invertir ? invertirAnillo(redondeado) : redondeado

    if (invertir) {
      detecciones.push(
        crearDeteccionGml(
          TIPO_GML.ORIENTACION_NORMALIZADA,
          `Se ha invertido el sentido ${delRecinto(i)} para dejarlo ` +
            `${deseada === -1 ? 'HORARIO' : 'ANTIHORARIO'}, que es lo que exige el ` +
            `Catastro para ${tipo === 'EXTERIOR' ? 'el contorno exterior' : 'los huecos'} ` +
            `(override O1). El primer vértice no se mueve: solo cambia el orden de los demás.`,
          SEVERIDAD.INFO,
          {
            recinto: i,
            tipo,
            orientacionAntes: signo,
            orientacionDespues: deseada,
          },
        ),
      )
    }

    orientacionOriginal.push(signo)
    invertidos.push(invertir)
    preparados.push({ vertices: anillo, tipo })
  }

  // ── 3 · ÁREA ───────────────────────────────────────────────────────────────
  // Sobre los anillos ya redondeados Y ya orientados: regla de oro 11 (el número
  // publicado es el de las coordenadas publicadas) y el orden 2-antes-que-3 de
  // la cabecera.
  const superficieRedondeada = superficie(preparados)
  const areaValue = Math.round(superficieRedondeada)
  const nVertices = preparados.reduce((n, r) => n + r.vertices.length, 0)

  return {
    recintos: preparados,
    areaValue,
    superficieRedondeada,
    superficieModelo,
    orientacionOriginal,
    invertidos,
    nVertices,
    detecciones,
  }
}

// ── Punto de referencia interior ──────────────────────────────────────────────
//
// `cp:referencePoint` tiene que caer DENTRO de la parcela. `turf.pointOnFeature`
// no basta, y no es una sospecha: es su implementación. Calcula el `center` (que
// en Turf es el centro del BBOX, no el centroide) y, **si ese centro cae fuera**,
// devuelve el VÉRTICE MÁS PRÓXIMO. Un vértice está en el BORDE, y en el borde
// `booleanPointInPolygon(..., {ignoreBoundary: true})` es `false`.
//
// MEDIDO con dos polígonos de manual:
//   · parcela en L  → pointOnFeature devuelve el vértice del codo.
//   · parcela con hueco cuyo centro cae en el hueco → devuelve un vértice del hueco.
// En los dos casos el punto está sobre la línea, y el Catastro lo rechaza. Es un
// error de rechazo REAL, no una hipótesis.
//
// De ahí la cascada de tres escalones, con una regla que las gobierna todas: NO
// SE CONFÍA EN NADIE, SE VERIFICA. Ni en el punto que aporta el llamante, ni en
// Turf, ni en el barrido propio.
//
// Y la verificación corre sobre el punto YA REDONDEADO contra los anillos YA
// REDONDEADOS. Un punto 3 mm dentro puede salirse al pasar a 2 decimales;
// verificar antes del redondeo es verificar otro polígono y otro punto.

/**
 * Mediana de una lista de números (media de los dos centrales si son pares).
 *
 * @param {number[]} valores
 * @returns {number}  `NaN` si la lista está vacía.
 */
function mediana(valores) {
  const n = valores.length
  if (n === 0) return NaN
  const orden = [...valores].sort((a, b) => a - b)
  const medio = Math.floor(n / 2)
  return n % 2 === 1 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2
}

/**
 * Ordenadas candidatas para el barrido, ordenadas por cercanía a la ORDENADA
 * MEDIANA del contorno exterior.
 *
 * Las candidatas son los PUNTOS MEDIOS entre ordenadas consecutivas distintas de
 * TODOS los anillos (exterior y huecos). Con eso ninguna horizontal pasa jamás
 * por un vértice, que es el caso degenerado clásico del barrido (una recta que
 * roza un vértice cuenta 1 o 2 cortes según cómo se mire y descoloca la
 * paridad). La mediana se toma del exterior porque es la que describe dónde está
 * el grueso de la parcela; los huecos solo aportan candidatas, para que la línea
 * elegida no se apoye en el borde de un hueco.
 *
 * @param {Array<Array<[number, number]>>} anillos  Anillos ABIERTOS ya redondeados.
 * @returns {number[]}  Ordenadas candidatas, la mejor primero.
 */
function ordenadasDeBarrido(anillos) {
  const todas = [...new Set(anillos.flat().map((v) => v[1]))].sort((a, b) => a - b)
  const centro = mediana(anillos[0].map((v) => v[1]))
  const candidatas = []
  for (let i = 0; i + 1 < todas.length; i++) candidatas.push((todas[i] + todas[i + 1]) / 2)
  return candidatas.sort((a, b) => Math.abs(a - centro) - Math.abs(b - centro))
}

/**
 * Segmento INTERIOR más largo que la horizontal `y` recorta en el polígono.
 *
 * Barrido par-impar clásico: se calculan las abscisas donde `y` cruza cada
 * arista (regla SEMIABIERTA `(y1 > y) !== (y2 > y)`, que hace que los cruces
 * vengan siempre en número par), se ordenan y se emparejan 1-2, 3-4, … Cada par
 * es un tramo dentro del polígono, con los huecos ya descontados porque sus
 * aristas entran en el mismo recuento.
 *
 * @param {Array<Array<[number, number]>>} anillosCerrados
 * @param {number} y
 * @returns {{x0: number, x1: number, largo: number}|null}  `null` si no hay tramo.
 */
function segmentoInteriorMasLargo(anillosCerrados, y) {
  const cortes = []
  for (const anillo of anillosCerrados) {
    for (let i = 0; i + 1 < anillo.length; i++) {
      const [x1, y1] = anillo[i]
      const [x2, y2] = anillo[i + 1]
      const arribaInicio = y1 > y
      const arribaFin = y2 > y
      if (arribaInicio === arribaFin) continue
      cortes.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1))
    }
  }
  cortes.sort((a, b) => a - b)

  let mejor = null
  for (let i = 0; i + 1 < cortes.length; i += 2) {
    const largo = cortes[i + 1] - cortes[i]
    if (mejor === null || largo > mejor.largo) mejor = { x0: cortes[i], x1: cortes[i + 1], largo }
  }
  return mejor
}

/**
 * Escalón 3 de la cascada: punto interior POR BARRIDO PROPIO, sin dependencias.
 *
 * Es el `representative point` de PostGIS simplificado: horizontal por la
 * ordenada mediana, punto medio del segmento interior más largo. Si esa
 * horizontal no sirve (parcela con un estrangulamiento justo ahí, o punto que se
 * sale al redondear porque el tramo mide menos de un centímetro), se prueba la
 * siguiente candidata en orden de cercanía a la mediana. Cada candidato se
 * VERIFICA antes de aceptarlo, igual que los otros dos escalones.
 *
 * @param {Array<Array<[number, number]>>} anillos         Abiertos, redondeados.
 * @param {Array<Array<[number, number]>>} anillosCerrados Los mismos, cerrados.
 * @param {object} poligono  Feature<Polygon> de Turf con sus huecos.
 * @returns {[number, number]|null}
 */
function puntoPorBarrido(anillos, anillosCerrados, poligono) {
  for (const y of ordenadasDeBarrido(anillos)) {
    const seg = segmentoInteriorMasLargo(anillosCerrados, y)
    if (seg === null || seg.largo <= 0) continue
    const candidato = [redondearCoord((seg.x0 + seg.x1) / 2), redondearCoord(y)]
    if (booleanPointInPolygon(candidato, poligono, { ignoreBoundary: true })) return candidato
  }
  return null
}

/**
 * Punto ESTRICTAMENTE interior a la parcela (huecos descontados), listo para el
 * `cp:referencePoint`.
 *
 * Cascada, y en todos los escalones se verifica en lugar de confiar:
 *   1. El punto que aporte el llamante — se VERIFICA. Si no cae dentro se
 *      descarta con una detección y se sigue bajando.
 *   2. `turf.pointOnFeature` sobre el polígono CON sus huecos — se verifica.
 *   3. Barrido propio (ver {@link puntoPorBarrido}) — se verifica.
 *   4. Si nada funciona: `punto: null` y detección de severidad ERROR. Nunca se
 *      devuelve un punto sin comprobar (regla de oro 1).
 *
 * Los anillos se REDONDEAN aquí dentro aunque ya vinieran redondeados: el
 * redondeo es idempotente y así el invariante «punto redondeado contra anillos
 * redondeados» está GARANTIZADO por esta función, no delegado en la disciplina
 * del llamante.
 *
 * @param {Recinto[]} recintos  `recintos[0]` EXTERIOR, el resto HUECO.
 * @param {object} [opciones]
 * @param {[number, number]|null} [opciones.aportado=null]  Punto propuesto por
 *   el llamante (p. ej. el `referencePoint` que traía el GML original).
 * @returns {PuntoDeReferencia}
 * @throws {TypeError}   Si `recintos` rompe el invariante o `aportado` no es un par.
 * @throws {RangeError}  Si alguna coordenada no es publicable.
 */
export function puntoInterior(recintos, { aportado = null } = {}) {
  validarRecintos(recintos, 'puntoInterior')

  const detecciones = []
  const anillos = recintos.map((r) => redondearAnillo(r.vertices))

  // Un anillo abierto de menos de 3 vértices no forma un `LinearRing` (al
  // cerrar quedarían menos de 4 posiciones) y `polygon()` de Turf lanzaría. Esa
  // degeneración es dato del usuario y la señala F02: aquí no se lanza, se
  // devuelve la imposibilidad como detección y `punto: null`.
  const degenerados = anillos
    .map((a, i) => (a.length < 3 ? i : -1))
    .filter((i) => i >= 0)

  if (degenerados.length > 0) {
    detecciones.push(
      crearDeteccionGml(
        TIPO_GML.PUNTO_REFERENCIA_RECALCULADO,
        `No se puede calcular el punto de referencia: ` +
          `${degenerados.map(nombreRecinto).join(' y ')} ` +
          `${degenerados.length === 1 ? 'tiene' : 'tienen'} menos de 3 vértices, ` +
          `así que no ${degenerados.length === 1 ? 'llega' : 'llegan'} a ser un recinto. ` +
          `Corrige la geometría antes de generar el GML.`,
        SEVERIDAD.ERROR,
        { recintosDegenerados: degenerados },
      ),
    )
    return { punto: null, origen: null, detecciones }
  }

  const cerrados = anillos.map((a) => cerrarAnillo(a))
  const poligono = polygon(cerrados)
  const dentro = (p) => booleanPointInPolygon(p, poligono, { ignoreBoundary: true })

  // ── 1 · El punto aportado: se verifica, no se confía ──────────────────────
  if (aportado !== null && aportado !== undefined) {
    const propuesto = redondearPunto(aportado, 'puntoInterior')
    if (dentro(propuesto)) {
      return { punto: propuesto, origen: ORIGEN_PUNTO.APORTADO, detecciones }
    }
    detecciones.push(
      crearDeteccionGml(
        TIPO_GML.PUNTO_REFERENCIA_RECALCULADO,
        `El punto de referencia aportado (${propuesto[0]}, ${propuesto[1]}) NO cae dentro ` +
          `de la parcela una vez redondeado a ${DECIMALES_COORD} decimales — está fuera, ` +
          `en un hueco o justo sobre el borde—, así que se ha calculado otro. ` +
          `El Catastro rechaza un referencePoint que no sea interior.`,
        SEVERIDAD.AVISO,
        { descartado: propuesto },
      ),
    )
  }

  // ── 2 · turf.pointOnFeature, verificado ───────────────────────────────────
  const deTurf = redondearPunto(
    pointOnFeature(poligono).geometry.coordinates,
    'puntoInterior',
  )
  if (dentro(deTurf)) {
    return { punto: deTurf, origen: ORIGEN_PUNTO.POINT_ON_FEATURE, detecciones }
  }

  // ── 3 · Barrido propio ────────────────────────────────────────────────────
  const delBarrido = puntoPorBarrido(anillos, cerrados, poligono)
  if (delBarrido !== null) {
    detecciones.push(
      crearDeteccionGml(
        TIPO_GML.PUNTO_REFERENCIA_RECALCULADO,
        `El punto de referencia se ha recalculado con el barrido propio ` +
          `(${delBarrido[0]}, ${delBarrido[1]}): la parcela es cóncava o tiene huecos y ` +
          `pointOnFeature devolvía un vértice del contorno, que está en el BORDE y el ` +
          `Catastro no admite como punto interior.`,
        SEVERIDAD.INFO,
        { descartado: deTurf, punto: delBarrido },
      ),
    )
    return { punto: delBarrido, origen: ORIGEN_PUNTO.BARRIDO_PROPIO, detecciones }
  }

  // ── 4 · Nada ha funcionado ────────────────────────────────────────────────
  detecciones.push(
    crearDeteccionGml(
      TIPO_GML.PUNTO_REFERENCIA_RECALCULADO,
      'No se ha podido encontrar ningún punto estrictamente interior a la parcela: ' +
        'ni el centro, ni el barrido por ninguna de sus ordenadas. La geometría es ' +
        'degenerada (área nula, anillo colapsado o huecos que la anulan) y el GML no ' +
        'puede llevar un cp:referencePoint válido.',
      SEVERIDAD.ERROR,
      { descartado: deTurf },
    ),
  )
  return { punto: null, origen: null, detecciones }
}
