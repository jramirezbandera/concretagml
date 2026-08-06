// edit/dibujo.js — F12 · T2.1. DIBUJAR UN RECINTO DESDE CERO, VÉRTICE A VÉRTICE.
//
// La deuda declarada 1 de F06, entera: aquella fase lo listó entre sus ficheros,
// no lo escribió, y lo difirió a ésta con su motivo («ningún criterio de
// aceptación lo mide y hoy toda parcela entra por Catastro, DXF, TXT o LIST»).
// F12 sí lo necesita, y no como extra: **es el caso común de la rama EDIFICIO**
// —declarar el porche o la piscina que no estaban en ningún fichero— y sin él
// «añadir una parte» produce una fila que no se puede rellenar.
//
// ═════════════════════════════════════════════════════════════════════════════
// QUÉ ES ESTO Y QUÉ NO
// ═════════════════════════════════════════════════════════════════════════════
// Es una **máquina de estados pura** sobre un trazo en curso. Entra un trazo y
// un punto, sale un trazo nuevo. No conoce Leaflet, ni el DOM, ni el ratón, ni
// el reloj: los gestos son de `viewer/`, que traduce clics a llamadas de aquí.
// Y **no engancha**: el punto llega YA AJUSTADO por `edit/snap.js#ajustar`, que
// es el mismo enganche que usa el arrastre de F06. Un dibujo con su propia idea
// de dónde está el parcelario sería un segundo sitio donde corregir el snap.
//
// ⛔ **No produce huecos.** Un trazo cierra en UN anillo `EXTERIOR` y nada más,
// que es el criterio de aceptación 4 de la ficha («las partes no admiten huecos
// interiores»). No es que la herramienta de hueco esté escondida: **no existe**,
// aquí y en `viewer/barra-edicion.js`, cuyos ocho gestos tampoco crean ninguno.
//
// ── EL TRAZO ES UN POJO, Y ESO ES LA MITAD DEL DISEÑO ───────────────────────
// `{puntos: [[x,y],…], cerrado: false}`, plano y clonable. Las funciones son
// libres y devuelven trazos nuevos, como `edit/vertices.js` y `edit/historial.js`
// —no como `viewer/edicion.js`, que es un closure con estado—. Así el trazo en
// curso se puede fotografiar, comparar por identidad y pasar por `structuredClone`
// sin ceremonia, y el día que alguien quiera deshacer PUNTO A PUNTO ya está hecho.
//
// ── DÓNDE ESTÁ LA FRONTERA CON LA VALIDACIÓN ────────────────────────────────
// Aquí se comprueba lo que impide que exista un recinto: menos de
// {@link MINIMO_VERTICES} puntos, o dos puntos consecutivos en el mismo sitio.
// **NO se comprueba si el contorno se cruza consigo mismo**, y es deliberado:
// de eso sabe `validation/reglas-topologia.js` con `@turf/kinks`, cerrar un
// polígono que se cruza es un HALLAZGO y no un fallo de la herramienta, y quien
// dibuja tiene derecho a cerrar y arreglarlo después viendo dónde está el nudo.
// Duplicar la regla aquí daría dos definiciones de «contorno válido».
//
// Módulo PURO: sin DOM, sin Leaflet, sin estado global, sin reloj.

import { describir } from './_comun.js'
import { MINIMO_VERTICES } from './vertices.js'

/**
 * Un trazo en curso.
 *
 * @typedef {Object} Trazo
 * @property {Array<[number,number]>} puntos  Los vértices puestos, en orden, en
 *   UTM. Anillo ABIERTO: el cierre no se materializa, igual que en el modelo.
 * @property {boolean} cerrado  `true` cuando ya se ha cerrado y no admite más
 *   puntos. Un trazo cerrado es el resultado, no un estado intermedio.
 */

/**
 * Resultado de cualquier operación del dibujo. **Siempre la misma forma**, y por
 * el mismo motivo que las mutaciones de `edificio/`: una firma que cambia según
 * la función es una firma que se recuerda mal.
 *
 * @typedef {Object} ResultadoDibujo
 * @property {Trazo} trazo  El trazo NUEVO. Ante una operación rechazada es el
 *   MISMO objeto de entrada (identidad `===`), para que el llamante pueda
 *   distinguir «no ha pasado nada» sin comparar contenidos.
 * @property {string|null} motivo  Clave de {@link MOTIVO_DIBUJO} si la operación
 *   no se aplicó; `null` si sí. Nunca las dos cosas ni ninguna.
 */

// ── Vocabulario público ──────────────────────────────────────────────────────

/**
 * Por qué no se ha podido hacer la operación. **Códigos estables: la interfaz
 * decide con ellos y no analizando el texto** (mismo trato que
 * `MOTIVO_VERTICE` en `edit/vertices.js` y `MOTIVO_CATASTRO` en `services/`).
 *
 * Todos son DATOS DEL USUARIO: pinchar dos veces en el mismo sitio, querer
 * cerrar con dos puntos, seguir pinchando después de cerrar. Ninguno lanza.
 *
 * @readonly
 */
export const MOTIVO_DIBUJO = Object.freeze({
  /**
   * El punto cae exactamente encima del anterior. Pasa **más de lo que parece**
   * con el enganche puesto: dos clics cerca del mismo vértice del parcelario se
   * ajustan los dos a ese vértice, y el segundo no aporta nada. Se ignora en vez
   * de meter un lado de longitud cero, que es geometría degenerada que después
   * hay que explicar.
   */
  PUNTO_REPETIDO: 'PUNTO_REPETIDO',
  /**
   * Se ha intentado cerrar con menos de {@link MINIMO_VERTICES} puntos. Con dos
   * no hay recinto, hay un segmento. Mismo suelo, y mismo argumento, que
   * `edit/vertices.js`: es más honesto negarse que cerrar y luego informar de
   * que la geometría quedó rota.
   */
  MINIMO_TRES_VERTICES: 'MINIMO_TRES_VERTICES',
  /** No hay nada que deshacer: el trazo no tiene ni un punto. */
  TRAZO_VACIO: 'TRAZO_VACIO',
  /**
   * El trazo ya está cerrado. Un trazo cerrado es el RESULTADO: no admite más
   * puntos, ni se vuelve a cerrar, ni se le deshace el último. Quien quiera
   * seguir editándolo lo hace por la edición de F06, sobre la parte ya creada.
   */
  TRAZO_CERRADO: 'TRAZO_CERRADO',
})

/**
 * Texto en español, presentable tal cual, para cada {@link MOTIVO_DIBUJO}.
 * **Mapa explícito y TOTAL**, no una función con `default`: un `default` es
 * justo lo que hace que un motivo nuevo herede un texto que nadie ha escrito.
 *
 * @readonly
 * @type {Readonly<Record<string, string>>}
 */
export const MENSAJE_POR_MOTIVO_DIBUJO = Object.freeze({
  [MOTIVO_DIBUJO.PUNTO_REPETIDO]:
    'Ese punto cae encima del anterior, así que no se ha añadido: un lado de longitud cero no ' +
    'es un lado. Suele pasar cuando el ajuste al parcelario engancha dos clics al mismo vértice.',
  [MOTIVO_DIBUJO.MINIMO_TRES_VERTICES]:
    `Todavía no se puede cerrar el recinto: hacen falta al menos ${MINIMO_VERTICES} vértices. ` +
    'Con dos deja de ser un recinto y pasa a ser un segmento.',
  [MOTIVO_DIBUJO.TRAZO_VACIO]: 'No hay ningún vértice que deshacer: el recinto está sin empezar.',
  [MOTIVO_DIBUJO.TRAZO_CERRADO]:
    'El recinto ya está cerrado. Para seguir cambiándolo, arrastra sus vértices en el mapa o ' +
    'vuelve a dibujarlo desde cero.',
})

/**
 * Guardián de carga: {@link MENSAJE_POR_MOTIVO_DIBUJO} tiene que ser TOTAL sobre
 * {@link MOTIVO_DIBUJO}. Si mañana se añade un motivo y no se le escribe texto,
 * el módulo **no se carga** en vez de dejar un renglón en blanco la primera vez
 * que ese motivo llegue a la pantalla. Gemelo del de `edit/vertices.js`, y
 * ruidoso por la misma razón: un módulo que no carga se arregla en cinco
 * minutos; un mensaje vacío no lo ve nadie hasta que lo ve un cliente.
 */
for (const motivo of Object.values(MOTIVO_DIBUJO)) {
  /* c8 ignore next 6 -- solo se alcanza si el catálogo crece y los mensajes no */
  if (MENSAJE_POR_MOTIVO_DIBUJO[motivo] === undefined) {
    throw new Error(
      `edit/dibujo: falta el mensaje de MOTIVO_DIBUJO.${motivo}. Un motivo nuevo tiene que ` +
        `llegar a la pantalla con un texto decidido por alguien, no con un renglón en blanco.`,
    )
  }
}

// ── Helpers internos ─────────────────────────────────────────────────────────

const esNumeroFinito = (n) => typeof n === 'number' && Number.isFinite(n)

/** Contrato del llamante: `punto` es un par UTM `[x, y]` de números finitos. */
function exigirPunto(punto, fn) {
  if (
    !Array.isArray(punto) ||
    punto.length < 2 ||
    !esNumeroFinito(punto[0]) ||
    !esNumeroFinito(punto[1])
  ) {
    throw new TypeError(
      `${fn}: 'punto' debe ser un par UTM [x,y] de números finitos; recibido ${describir(punto)}.`,
    )
  }
}

/** Contrato del llamante: `trazo` es el POJO de {@link iniciar}. */
function exigirTrazo(trazo, fn) {
  if (
    !trazo ||
    typeof trazo !== 'object' ||
    Array.isArray(trazo) ||
    !Array.isArray(trazo.puntos) ||
    typeof trazo.cerrado !== 'boolean'
  ) {
    throw new TypeError(
      `${fn}: 'trazo' debe ser el POJO de iniciar() ({puntos: [], cerrado: false}); ` +
        `recibido ${describir(trazo)}.`,
    )
  }
}

/**
 * Dos puntos en el MISMO sitio. Comparación **exacta**, no por tolerancia, y es
 * una decisión: quien decide qué está «lo bastante cerca» es `edit/snap.js` con
 * su tolerancia configurable, y ya ha hablado cuando el punto llega aquí. Una
 * segunda tolerancia en este módulo sería un segundo criterio de proximidad, y
 * los dos acabarían discrepando en el peor momento.
 */
const mismoPunto = (a, b) => a !== undefined && b !== undefined && a[0] === b[0] && a[1] === b[1]

/** Copia independiente de los puntos: la salida no comparte arrays con la entrada. */
const clonarPuntos = (puntos) => puntos.map((p) => [p[0], p[1]])

// ── Operaciones ──────────────────────────────────────────────────────────────

/**
 * Un trazo nuevo, vacío. `iniciar()` es la ÚNICA forma de fabricar uno: así el
 * shape sale de un sitio y no de cinco literales repartidos por `viewer/`.
 *
 * @returns {Trazo}
 */
export function iniciar() {
  return { puntos: [], cerrado: false }
}

/**
 * Añade un vértice al final del trazo.
 *
 * El punto llega **ya ajustado** por `edit/snap.js#ajustar` si el enganche está
 * puesto: este módulo no engancha (ver la cabecera).
 *
 * @param {Trazo} trazo  No se muta.
 * @param {[number, number]} punto  Coordenada UTM.
 * @returns {ResultadoDibujo}
 * @throws {TypeError} Si `trazo` o `punto` no cumplen la forma (bug del llamante).
 */
export function anadirPunto(trazo, punto) {
  const FN = 'anadirPunto'
  exigirTrazo(trazo, FN)
  exigirPunto(punto, FN)

  if (trazo.cerrado) return { trazo, motivo: MOTIVO_DIBUJO.TRAZO_CERRADO }
  if (mismoPunto(trazo.puntos[trazo.puntos.length - 1], punto)) {
    return { trazo, motivo: MOTIVO_DIBUJO.PUNTO_REPETIDO }
  }

  return {
    trazo: { puntos: [...clonarPuntos(trazo.puntos), [punto[0], punto[1]]], cerrado: false },
    motivo: null,
  }
}

/**
 * Quita el último vértice puesto.
 *
 * Es el `Backspace` mientras se dibuja, y existe porque la alternativa —cancelar
 * y empezar otra vez— castiga el error decimotercero de un contorno de quince.
 *
 * @param {Trazo} trazo  No se muta.
 * @returns {ResultadoDibujo}
 * @throws {TypeError} Si `trazo` no cumple la forma.
 */
export function deshacerUltimo(trazo) {
  const FN = 'deshacerUltimo'
  exigirTrazo(trazo, FN)

  if (trazo.cerrado) return { trazo, motivo: MOTIVO_DIBUJO.TRAZO_CERRADO }
  if (trazo.puntos.length === 0) return { trazo, motivo: MOTIVO_DIBUJO.TRAZO_VACIO }

  return { trazo: { puntos: clonarPuntos(trazo.puntos).slice(0, -1), cerrado: false }, motivo: null }
}

/**
 * Cierra el trazo. A partir de aquí no admite más puntos.
 *
 * ⚠️ **Cerrar NO materializa el último lado**: el anillo queda ABIERTO, que es
 * como el modelo guarda la geometría en todo el proyecto (`model/parcela.js`,
 * `model/edificio.js`) y lo que `geo/poligono.js#anilloCerrado` cierra al salir
 * hacia Turf o hacia el GML. Repetir el primer punto al final aquí produciría un
 * vértice duplicado que después habría que quitar en el sitio equivocado.
 *
 * ⛔ **No comprueba si el contorno se cruza consigo mismo**, y es deliberado:
 * ver la cabecera. Eso es un HALLAZGO de `validation/`, no un fallo de la
 * herramienta, y quien dibuja tiene derecho a cerrar y ver dónde está el nudo.
 *
 * @param {Trazo} trazo  No se muta.
 * @returns {ResultadoDibujo}
 * @throws {TypeError} Si `trazo` no cumple la forma.
 */
export function cerrar(trazo) {
  const FN = 'cerrar'
  exigirTrazo(trazo, FN)

  if (trazo.cerrado) return { trazo, motivo: MOTIVO_DIBUJO.TRAZO_CERRADO }
  if (trazo.puntos.length < MINIMO_VERTICES) {
    return { trazo, motivo: MOTIVO_DIBUJO.MINIMO_TRES_VERTICES }
  }

  return { trazo: { puntos: clonarPuntos(trazo.puntos), cerrado: true }, motivo: null }
}

/**
 * Tira el trazo y devuelve uno vacío. **Nunca falla**, ni siquiera sobre un trazo
 * ya cerrado: cancelar es la salida, y una salida que a veces no funciona no es
 * una salida. Por eso devuelve un `Trazo` pelado y no un {@link ResultadoDibujo}
 * — no hay motivo posible que contar.
 *
 * @returns {Trazo}
 */
export function cancelar() {
  return iniciar()
}

/**
 * ¿Se puede cerrar ya? Para que la interfaz encienda o apague «Cerrar recinto»
 * **con el mismo criterio con el que {@link cerrar} lo acepta**, y no con una
 * copia del número tres escrita en otro fichero. La regla de oro 1 aplicada a un
 * botón: si está encendido, funciona.
 *
 * @param {Trazo} trazo
 * @returns {boolean}
 * @throws {TypeError} Si `trazo` no cumple la forma.
 */
export function sePuedeCerrar(trazo) {
  exigirTrazo(trazo, 'sePuedeCerrar')
  return !trazo.cerrado && trazo.puntos.length >= MINIMO_VERTICES
}

/**
 * El trazo como `Recinto` del modelo, o `null` si todavía no es uno.
 *
 * Es la puerta de salida de este módulo hacia
 * `edificio/mutaciones.js#conParteRedibujada`, y devuelve `null` —en vez de
 * lanzar— mientras el trazo no esté cerrado: «aún no hay recinto» es el estado
 * NORMAL de un dibujo a medias, no un error de nadie.
 *
 * ⚠️ El recinto sale **siempre `EXTERIOR`**: un trazo no puede producir un hueco
 * (criterio de aceptación 4 de la ficha).
 *
 * @param {Trazo} trazo
 * @returns {{tipo: 'EXTERIOR', vertices: Array<[number,number]>}|null}
 * @throws {TypeError} Si `trazo` no cumple la forma.
 */
export function recintoDe(trazo) {
  exigirTrazo(trazo, 'recintoDe')
  if (!trazo.cerrado || trazo.puntos.length < MINIMO_VERTICES) return null
  return { tipo: 'EXTERIOR', vertices: clonarPuntos(trazo.puntos) }
}
