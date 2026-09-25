// services/cartociudad.js — ÚNICO punto del código que habla con CartoCiudad
// (el geocodificador del Instituto Geográfico Nacional). Regla de oro 7: si
// mañana cambia de dirección o de formato, se cambia AQUÍ y en ningún otro sitio.
//
// ── POR QUÉ EXISTE (revisión de diseño, 2026-09-25) ──────────────────────────
// La aplicación arranca mirando a España entera (zoom 6) y la bienvenida dice
// «busca tu parcela en el mapa y pínchala». Hasta hoy la única forma de buscar era
// acercarse a mano, unos catorce saltos de rueda desde un mapa donde un píxel son
// ~1,5 km. Este módulo es la mitad de red del buscador del mapa
// (`viewer/buscador.js`): convierte lo que el usuario teclea —una dirección, un
// municipio, un código postal, una referencia catastral— en un sitio del mapa.
//
// ── ⛔ NO ES UNA FUENTE DE REFERENCIAS CATASTRALES ───────────────────────────
// CartoCiudad devuelve `refCatastral` en los portales, y **se ignora a propósito**.
// La referencia que entra en el campo sale SIEMPRE del Catastro, por la misma
// geocodificación inversa que usa el clic en el mapa
// (`app/cableado-catastro.js#deducirEnPunto`). Dos fuentes para el mismo dato son
// dos respuestas posibles, y la de CartoCiudad es una copia con su propio desfase.
// Aquí solo sale una POSICIÓN.
//
// ── LAS DOS LLAMADAS, MEDIDAS EL 2026-09-25 CONTRA EL SERVICIO REAL ──────────
//   · `candidates?q=…&limit=…` → array JSON. Los portales y las referencias
//     catastrales llegan CON `lat`/`lng`; calles, poblaciones, municipios y
//     códigos postales llegan con `0`/`0` y hay que pedirlos aparte.
//   · `find?id=…&type=…` → un objeto con `lat`/`lng` y `geom` en WKT
//     (`MULTIPOLYGON`, `MULTILINESTRING` o `POINT`). Un municipio pesa ~8,5 KB y
//     una población hasta ~37 KB. Sin coincidencia contesta **HTTP 204 sin
//     cuerpo**, no un 404.
//   · CORS: `Access-Control-Allow-Origin: *`, sin clave. Las respuestas reales
//     están en `test/fixtures/cartociudad/` con su procedencia.
//
// ── LO QUE ESTE MÓDULO NO HACE ───────────────────────────────────────────────
//   · **No crea transporte.** Lo recibe, igual que `services/catastro.js`: crear
//     uno aquí decidiría por el llamante el `fetch`, el reloj y el canal de aviso.
//   · **No mueve el mapa.** Devuelve un centro y, si la hay, una caja. Qué zoom
//     corresponde a cada cosa lo decide la vista.
//   · **No reintenta un 2xx ni cachea.** Eso es del transporte y de nadie.
//
// Licencia de los datos: CC BY 4.0, con atribución al IGN. La lleva el propio
// buscador debajo de la lista ({@link CARTOCIUDAD}.ATRIBUCION).

import { MOTIVO_RED } from './_red.js'

/**
 * Configuración del servicio. Congelada: es la única copia de la dirección.
 *
 * @readonly
 */
export const CARTOCIUDAD = Object.freeze({
  BASE: 'https://www.cartociudad.es/geocoder/api/geocoder',
  /**
   * Candidatos por búsqueda. Ocho caben en la lista sin scroll y sobran para
   * elegir: si lo tuyo no está entre los ocho primeros, lo que falta es escribir
   * una palabra más, no ver el noveno.
   */
  LIMITE: 8,
  /**
   * Caracteres mínimos para preguntar. Con dos, «ca» devuelve ocho calles al azar
   * de toda España y el usuario todavía no ha dicho nada.
   */
  MIN_CARACTERES: 3,
  ATRIBUCION: 'Búsqueda: CartoCiudad · © Instituto Geográfico Nacional',
})

/**
 * Por qué no hay resultado. Los de red se heredan tal cual de `_red.js` (la UI
 * decide con el código, nunca leyendo el texto); estos dos son los que solo este
 * módulo puede medir.
 *
 * @readonly
 */
export const MOTIVO_CARTOCIUDAD = Object.freeze({
  ...MOTIVO_RED,
  /** Hubo 2xx, pero lo que llegó no es el JSON que el servicio documenta. */
  RESPUESTA_ILEGIBLE: 'RESPUESTA_ILEGIBLE',
  /** `find` contestó 204: el candidato ya no existe (o nunca tuvo geometría). */
  NO_ENCONTRADO: 'NO_ENCONTRADO',
})

/**
 * Los tipos que CartoCiudad llega CON coordenadas en `candidates`. Son los únicos
 * que se sitúan como PUNTO, a escala de parcela; el resto son zonas.
 */
const TIPOS_PUNTO = Object.freeze(['portal', 'refcatastral'])

/**
 * Nombre humano de cada tipo, para la segunda línea de cada candidato. Las
 * claves son las cadenas EXACTAS que manda el servicio (con su mayúscula en
 * `Municipio` y `Codpost`, medido). Un tipo que no esté aquí se enseña tal cual:
 * inventarle un nombre sería peor que dejar ver el suyo.
 *
 * @readonly
 */
export const ROTULO_TIPO = Object.freeze({
  portal: 'Portal',
  refcatastral: 'Referencia catastral',
  callejero: 'Calle',
  poblacion: 'Población',
  Municipio: 'Municipio',
  Codpost: 'Código postal',
})

/**
 * Un candidato, ya en el vocabulario de la aplicación.
 *
 * @typedef {Object} LugarCartoCiudad
 * @property {string} id       El del servicio; `find` lo necesita tal cual.
 * @property {string} tipo     El tipo CRUDO del servicio (`'portal'`, `'Municipio'`…).
 * @property {string} rotulo   Primera línea: la dirección, el nombre o el código.
 * @property {string} detalle  Segunda línea: tipo y dónde (`'Portal · Madrid'`).
 * @property {boolean} esPunto `true` si se sitúa a escala de parcela.
 * @property {{lat: number, lng: number}|null} centro  Solo si el servicio lo dio.
 */

/**
 * Lo que se devuelve siempre, acierte o falle: una sola forma, como
 * `services/catastro.js#crearResultado`.
 *
 * @typedef {Object} ResultadoCartoCiudad
 * @property {boolean} ok
 * @property {*} datos        `LugarCartoCiudad[]` en `buscar`; `{centro, caja}` en `situar`.
 * @property {string|null} motivo   Clave de {@link MOTIVO_CARTOCIUDAD}.
 * @property {string|null} mensaje  Español presentable.
 */

const resultado = (ok, datos, motivo = null, mensaje = null) => ({ ok, datos, motivo, mensaje })

/** ¿Un par lat/lng que de verdad es un sitio? El servicio manda 0/0 por «no lo sé». */
function centroDe(lat, lng) {
  const la = Number(lat)
  const ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null
  if (la === 0 && ln === 0) return null
  if (Math.abs(la) > 90 || Math.abs(ln) > 180) return null
  return { lat: la, lng: ln }
}

/**
 * La caja de una geometría WKT, como `[[sur, oeste], [norte, este]]` (el orden de
 * `L.latLngBounds`). **No parsea la estructura**: recorre los pares de números y
 * se queda con los extremos, que es todo lo que un encuadre necesita. El orden de
 * los pares es `lng lat`, que es el del WKT (medido en las tres geometrías).
 *
 * Devuelve `null` para un `POINT` (una caja de área cero no se puede encuadrar) y
 * para cualquier cosa sin coordenadas. Exportada porque es lo único de este
 * módulo que es cálculo puro, y se prueba aparte.
 *
 * @param {string|null|undefined} wkt
 * @returns {[[number, number], [number, number]]|null}
 */
export function cajaDeWkt(wkt) {
  if (typeof wkt !== 'string' || wkt === '') return null
  const par = /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g
  let sur = Infinity
  let norte = -Infinity
  let oeste = Infinity
  let este = -Infinity
  let pares = 0
  for (const [, lngTexto, latTexto] of wkt.matchAll(par)) {
    const lng = Number(lngTexto)
    const lat = Number(latTexto)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    pares += 1
    if (lat < sur) sur = lat
    if (lat > norte) norte = lat
    if (lng < oeste) oeste = lng
    if (lng > este) este = lng
  }
  if (pares === 0 || (sur === norte && oeste === este)) return null
  return [
    [sur, oeste],
    [norte, este],
  ]
}

/**
 * Quita la repetición con la que CartoCiudad escribe las poblaciones (medido):
 * «Alhaurín de la Torre, Alhaurín de la Torre» y «Alhaurín Golf, Alhaurín Golf
 * (Alhaurín el Grande)». Si la segunda mitad EMPIEZA por la primera, la primera
 * sobra. «CALLE MAYOR 12, Alcalá de Henares» no se toca.
 *
 * @param {string} texto
 * @returns {string}
 */
export function sinRepeticion(texto) {
  const coma = texto.indexOf(', ')
  if (coma <= 0) return texto
  const primera = texto.slice(0, coma)
  const resto = texto.slice(coma + 2)
  return resto.startsWith(primera) ? resto : texto
}

/**
 * Traduce un candidato crudo. Devuelve `null` si no trae lo mínimo para usarlo
 * (un `id` y un `type`), y quien llama lo descarta: un candidato que no se puede
 * situar no se ofrece.
 *
 * @param {*} crudo
 * @returns {LugarCartoCiudad|null}
 */
function lugarDe(crudo) {
  if (!crudo || typeof crudo !== 'object') return null
  const id = crudo.id === null || crudo.id === undefined ? '' : String(crudo.id)
  const tipo = typeof crudo.type === 'string' ? crudo.type : ''
  if (id === '' || tipo === '') return null
  const esPunto = TIPOS_PUNTO.includes(tipo)
  const rotulo = sinRepeticion(
    (typeof crudo.address === 'string' && crudo.address.trim()) ||
      (typeof crudo.postalCode === 'string' && crudo.postalCode.trim()) ||
      id,
  )
  // Dónde: el municipio si lo hay y no está ya en la primera línea, y si no la
  // provincia. «Calle Mayor 12 · Portal · Alcalá de Henares» es lo que distingue
  // entre las seis «Calle Mayor 12» que devuelve el servicio (medido).
  const donde = [crudo.muni, crudo.province].find(
    (v) => typeof v === 'string' && v.trim() !== '' && !rotulo.includes(v.trim()),
  )
  const detalle = [ROTULO_TIPO[tipo] ?? tipo, donde].filter(Boolean).join(' · ')
  return { id, tipo, rotulo, detalle, esPunto, centro: centroDe(crudo.lat, crudo.lng) }
}

/** ¿Es el transporte de `services/_red.js`? Misma comprobación que el Catastro. */
function esTransporte(t) {
  return (
    !!t &&
    typeof t === 'object' &&
    typeof t.pedirTexto === 'function' &&
    typeof t.estado === 'function' &&
    typeof t.destruir === 'function'
  )
}

/**
 * Crea el cliente de CartoCiudad.
 *
 * ```js
 * const cartociudad = crearClienteCartoCiudad({ transporte: crearTransporte() })
 * const r = await cartociudad.buscar('calle san restituto 72 madrid', { senal })
 * if (r.ok) pintar(r.datos)               // ← LugarCartoCiudad[], puede venir vacío
 * const s = await cartociudad.situar(r.datos[0], { senal })
 * if (s.ok) encuadrar(s.datos.centro, s.datos.caja)
 * ```
 *
 * @param {object} opciones
 * @param {{pedirTexto: Function, estado: Function, destruir: Function}} opciones.transporte
 *   El de `services/_red.js#crearTransporte`. Obligatorio y sin defecto.
 * @returns {{buscar: (texto: string, o?: {senal?: AbortSignal|null}) => Promise<ResultadoCartoCiudad>,
 *            situar: (lugar: LugarCartoCiudad, o?: {senal?: AbortSignal|null}) => Promise<ResultadoCartoCiudad>}}
 * @throws {TypeError} Contrato roto por el programador.
 */
export function crearClienteCartoCiudad(opciones = {}) {
  if (!opciones || typeof opciones !== 'object') {
    throw new TypeError(
      `crearClienteCartoCiudad: 'opciones' debe ser un objeto; recibido ${typeof opciones}.`,
    )
  }
  const { transporte } = opciones
  if (!esTransporte(transporte)) {
    throw new TypeError(
      `crearClienteCartoCiudad: 'transporte' debe ser el de services/_red.js#crearTransporte ` +
        `(con pedirTexto, estado y destruir); recibido ${typeof transporte}. No se crea uno por ` +
        `defecto: en un test tocaría la red de verdad.`,
    )
  }

  /**
   * Pide una URL y la lee como JSON. Un fallo de red sale con el motivo y el
   * mensaje del transporte, sin retocar; uno de formato, con los de este módulo.
   *
   * @returns {Promise<{ok: true, json: *, vacio: boolean}|ResultadoCartoCiudad>}
   */
  async function pedirJson(url, senal) {
    const r = await transporte.pedirTexto(url, { senal })
    if (!r.ok) return resultado(false, null, r.motivo, r.mensaje)
    const texto = typeof r.texto === 'string' ? r.texto.trim() : ''
    if (texto === '') return { ok: true, json: null, vacio: true }
    try {
      return { ok: true, json: JSON.parse(texto), vacio: false }
    } catch {
      return resultado(
        false,
        null,
        MOTIVO_CARTOCIUDAD.RESPUESTA_ILEGIBLE,
        'CartoCiudad ha contestado, pero con algo que no se puede leer. Puede haber cambiado ' +
          'su formato; mientras tanto, acércate con el mapa y pincha tu parcela.',
      )
    }
  }

  return {
    /**
     * Candidatos para un texto. Con menos de {@link CARTOCIUDAD}.MIN_CARACTERES
     * contesta `ok` y vacío SIN pedir nada: no es un fallo, es que aún no se ha
     * preguntado nada.
     */
    async buscar(texto, { senal = null } = {}) {
      if (typeof texto !== 'string') {
        throw new TypeError(`buscar: 'texto' debe ser una cadena; recibido ${typeof texto}.`)
      }
      const q = texto.trim()
      if (q.length < CARTOCIUDAD.MIN_CARACTERES) return resultado(true, [])
      const url =
        `${CARTOCIUDAD.BASE}/candidates?q=${encodeURIComponent(q)}` +
        `&limit=${CARTOCIUDAD.LIMITE}`
      const r = await pedirJson(url, senal)
      if (!r.ok) return r
      if (r.vacio) return resultado(true, [])
      if (!Array.isArray(r.json)) {
        return resultado(
          false,
          null,
          MOTIVO_CARTOCIUDAD.RESPUESTA_ILEGIBLE,
          'CartoCiudad ha contestado con algo que no es una lista de lugares.',
        )
      }
      return resultado(true, r.json.map(lugarDe).filter(Boolean))
    },

    /**
     * Dónde está un candidato: `{centro, caja}`. Un punto que ya trae centro NO
     * cuesta una segunda petición; una zona sí (`find`), y de su geometría sale
     * la caja. Un `POINT` o una geometría ilegible dejan `caja: null` y el centro
     * del servicio, que la vista encuadra con un zoom fijo.
     */
    async situar(lugar, { senal = null } = {}) {
      if (!lugar || typeof lugar.id !== 'string' || typeof lugar.tipo !== 'string') {
        throw new TypeError(
          `situar: 'lugar' debe ser un candidato de buscar() (con id y tipo); recibido ` +
            `${JSON.stringify(lugar)}.`,
        )
      }
      if (lugar.esPunto && lugar.centro !== null) {
        return resultado(true, { centro: lugar.centro, caja: null })
      }
      const url =
        `${CARTOCIUDAD.BASE}/find?id=${encodeURIComponent(lugar.id)}` +
        `&type=${encodeURIComponent(lugar.tipo)}`
      const r = await pedirJson(url, senal)
      if (!r.ok) return r
      const centro = r.vacio || !r.json ? null : centroDe(r.json.lat, r.json.lng)
      const caja = r.vacio || !r.json ? null : cajaDeWkt(r.json.geom)
      if (centro === null && caja === null) {
        return resultado(
          false,
          null,
          MOTIVO_CARTOCIUDAD.NO_ENCONTRADO,
          `CartoCiudad ya no encuentra «${lugar.rotulo}». Prueba a escribirlo de otra forma.`,
        )
      }
      return resultado(true, { centro, caja })
    },
  }
}
