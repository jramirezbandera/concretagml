// test/viewer/contrato-capas.dom.test.js — F03 · Fase 4 · Tarea 4C.2.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ GUARDA TRANSVERSAL de `crossOrigin` y ATRIBUCIÓN. Hermana de              ║
// ║ `test/contrato.test.js`: no comprueba UN criterio, comprueba un           ║
// ║ INVARIANTE que ningún módulo del visor puede romper, por ningún camino.   ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// Los dos invariantes, y por qué no son cosmética:
//   · `crossOrigin: 'anonymous'` en TODA capa (criterio de aceptación 4 de F03,
//     override O7 del dossier). Sin él el canvas queda «tainted» y el plano a
//     300 ppp de F09 es IMPOSIBLE: no se podría ni leer el lienzo para
//     componerlo. No es un parche posterior, se construye desde el principio.
//   · Atribución (criterio de aceptación 5): obligación LEGAL —CC-BY 4.0 del
//     IGN, Ley 37/2007 RISP del Catastro, ODbL de OSM—, no un rótulo bonito.
//
// ── POR QUÉ ESTE FICHERO EXISTE Y NO ES UN describe MÁS ─────────────────────
// Va aparte, con sufijo `.dom`, por dos razones:
//   1. Necesita jsdom: INSTANCIA capas de Leaflet y monta un mapa real.
//   2. No puede vivir en `test/contrato.test.js`, que corre en el proyecto
//      Vitest `node` SIN `window`. Y hay una ironía que lo cierra: la razón de
//      ser de ese fichero es VIGILAR QUE LEAFLET NO ENTRE en el proyecto `node`
//      («el visor no sale por el barrel raíz»), así que meter Leaflet dentro de
//      ese guardián sería el peor sitio posible del repositorio.
// El nombre `contrato-*` es deliberado: hereda la función del guardián histórico
// y así los dos se encuentran juntos al buscar «contrato».
//
// ── REGLA DE ORO DE ESTE FICHERO: TODO DERIVADO, CERO LISTAS A MANO ─────────
// Una guarda con listas literales deja de cubrir la cuarta capa que alguien
// añada, y encima pasa en verde mientras lo hace. Aquí NO se escribe ni un id de
// capa, ni un nombre de servicio, ni un texto legal, ni una lista de ficheros:
//   · las capas del IGN salen de `Object.keys(WMTS_IGN)` y de `CAPAS_IGN`;
//   · los roles del WMS del Catastro, de `new Set(CAPAS.map(d => d.rol))`;
//   · las capas del visor, de `viewer/capas.js#CAPAS`;
//   · los textos legales, de `Object.values(ATRIBUCION)`;
//   · los ficheros vigilados, de un RECORRIDO DE DIRECTORIO con `node:fs`.
// Los únicos literales son (a) el valor canónico `'anonymous'`, que ES el
// invariante; (b) las dos cargas de los intentos de debilitamiento, que son el
// ataque; (c) las dos AGUJAS prohibidas (`tileLayer.wms`, `.css`), que son el
// invariante del punto 10/12; y (d) los dos directorios vigilados, que son el
// sujeto de ese recorrido. Ninguno es una lista que se quede corta al crecer.
//
// Cada `it` lleva EN SU NOMBRE el valor derivado (`it.each` + `$via`), para que
// un fallo diga QUÉ capa falló y por qué camino, no «una».
//
// ── PATRÓN DE INFORME (el de `test/contrato.test.js`) ───────────────────────
// Los recorridos estructurales NO devuelven un booleano: ACUMULAN RUTAS
// LEGIBLES (`viewer/capas.js:123`, `catastro.crossOrigin=false`) y el `expect`
// las compara con `[]`. Así el fallo dice DÓNDE, que es la única forma de que
// una guarda transversal sea útil el día que se pone roja.
//
// ── PRUEBA NEGATIVA (hecha a mano el 2026-07-26) ────────────────────────────
// «Un guardián que nunca se ha visto fallar no es un guardián»: en esta misma
// fase el guardián anti-`proj4` del build pasaba en verde CON proj4 dentro del
// bundle hasta que se probó a propósito. Aquí se comentó temporalmente
// `crossOrigin: 'anonymous'` en `services/osm.js` y esta suite se puso ROJA en
// **9 tests** —los dos caminos de OSM en la línea base, sus seis variantes de
// asedio y el recorrido de `montarCapas`, que reportó literalmente
// `[ 'osm.crossOrigin=false' ]`—; después se restauró el fichero (md5 idéntico).
// El sabotaje además ENCONTRÓ UN HUECO en esta guarda: sin el bloque de «línea
// base» solo fallaban los caminos CON ataque, o sea que el fallo se describía
// como «no resiste un ataque» cuando la verdad era «esa capa nunca tuvo
// crossOrigin». Ese bloque nació de esta prueba negativa. Y
// para lo que NO se puede sabotear a mano en cada ejecución —el recorrido de
// ficheros de los puntos 10/12— hay CONTROLES POSITIVOS permanentes: el
// despojador de comentarios se prueba con muestras sintéticas que SÍ deben ser
// delatadas, para que la exención de comentarios no pueda degenerar en «no
// detecta nada».
//
// NINGUNA petición real de red: jsdom no descarga imágenes ni teselas.

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { WMTS_IGN, crearCapaWMTS, CAPAS_IGN } from '../../services/ign.js'
import { OSM, crearCapaOSM, CAPA_OSM } from '../../services/osm.js'
import {
  CAPAS,
  CAPAS_BASE,
  CAPA_SUPERPUESTA,
  crearCapaBlanca,
  descriptorPorId,
  montarCapas,
} from '../../viewer/capas.js'
import { crearCapaWMSCatastro } from '../../viewer/wms-catastro.js'
import { crearMapa } from '../../viewer/mapa.js'
import { ATRIBUCION } from '../../viewer/atribucion.js'
import { crearContenedor, espiarPeticiones } from './_ayuda-jsdom.js'

// ── Los invariantes, como valores ─────────────────────────────────────────────

/** El ÚNICO valor admisible de `crossOrigin`. Es el invariante, no una lista. */
const ANONIMO = 'anonymous'

/** Atribución vacía: el caso «Blanco», legítimo y único (ver punto 7). */
const SIN_TEXTO = ''

/**
 * Vista arbitraria pero VÁLIDA (Península). La guarda no mira coordenadas; lo
 * que necesita es que el mapa TENGA vista: sin ella `Map#addLayer` difiere
 * `_layerAdd` con `whenReady` y el control de atribución no registraría nada
 * (Leaflet 1.9.4, `Control.Attribution#_addAttribution` cuelga de `layeradd`).
 */
const VISTA = Object.freeze({ centro: [40.4, -3.7], zoom: 18 })

// ── Limpieza (patrón de `capas.dom.test.js`) ──────────────────────────────────

/** Pila LIFO: se deshace aunque un `expect` falle a mitad de test. */
const pendientes = []
afterEach(() => {
  while (pendientes.length) {
    const limpiar = pendientes.pop()
    try {
      limpiar()
    } catch {
      /* la limpieza nunca debe enmascarar el fallo real del test */
    }
  }
})

/**
 * Mapa REAL del proyecto (`viewer/mapa.js#crearMapa`, no un `L.map` a mano: el
 * punto 6 va justamente de lo que ese módulo garantiza) con vista aplicada y las
 * animaciones desactivadas por la misma razón que `montarMapa` del arnés: jsdom
 * nunca resuelve una transición CSS y el test se quedaría colgado.
 *
 * @param {{ancho?: number, alto?: number, opts?: object}} [config]
 * @returns {{mapa: import('leaflet').Map, contenedor: HTMLElement}}
 */
function mapaDePrueba({ ancho = 300, alto = 300, opts = {} } = {}) {
  const contenedor = crearContenedor({ ancho, alto })
  const { mapa, destruir } = crearMapa(contenedor, {
    vistaInicial: VISTA,
    zoomAnimation: false,
    fadeAnimation: false,
    markerZoomAnimation: false,
    inertia: false,
    ...opts,
  })
  pendientes.push(() => {
    destruir()
    contenedor.remove()
  })
  return { mapa, contenedor }
}

/** `espiarPeticiones` del arnés + su `restaurar()` registrado en la pila. */
function espiar() {
  const espia = espiarPeticiones()
  pendientes.push(() => espia.restaurar())
  return espia
}

// ── Enumeración DERIVADA de todos los caminos que crean una capa ──────────────

/**
 * Los DOS roles con los que el proyecto usa la factory del WMS del Catastro.
 * **Derivados del catálogo**, no escritos: `viewer/capas.js` monta la catastral
 * dos veces —base opaca y superpuesta translúcida— y eso es exactamente el
 * conjunto de roles que hay que atacar.
 *
 * @type {string[]}
 */
const ROLES = [...new Set(CAPAS.map((descriptor) => descriptor.rol))]

/**
 * @typedef {Object} Camino
 * @property {string} via         Etiqueta legible CON el valor derivado dentro
 *   (aparece en el nombre del `it`: un fallo dice QUÉ capa y por dónde).
 * @property {string} atribucion  Texto legal EXACTO que debe llevar la capa
 *   (`''` solo en «Blanco»).
 * @property {(opts?: object) => object} crear  Invocación del camino.
 */

/**
 * TODOS los caminos por los que este proyecto puede llegar a una capa Leaflet.
 * Son SEIS familias, y que varias lleguen a la misma capa **no es redundancia,
 * es el punto**: el invariante tiene que sobrevivir por cada vía, y la
 * auditoría de la fase 2 ya encontró un caso real de vía que se debilitaba sola
 * (hallazgo 2.3: `viewer/wms-catastro.js` sostenía `crossOrigin` por el
 * `options` del prototipo, la precedencia MÁS BAJA de Leaflet, y un futuro
 * pass-through de `...resto` lo habría apagado sin que nada avisara).
 *
 * @type {Camino[]}
 */
const CAMINOS = [
  // (A) punto 1 — factory directa del IGN, una por CLAVE de WMTS_IGN (las TRES,
  //     incluida `ign-base`, que hoy no llega al control de capas).
  ...Object.keys(WMTS_IGN).map((id) => ({
    via: `crearCapaWMTS('${id}')`,
    atribucion: WMTS_IGN[id].atribucion,
    crear: (opts) => crearCapaWMTS(id, opts),
  })),
  // (B) punto 2 — el MISMO servicio por el descriptor. Camino DISTINTO del (A) a
  //     propósito: `CAPAS_IGN[i].crear` podría dejar de reenviar a la factory
  //     (ya pasó con `alAvisar`, hallazgo 2.6) y (A) seguiría en verde.
  ...CAPAS_IGN.map((descriptor) => ({
    via: `CAPAS_IGN['${descriptor.id}'].crear()`,
    atribucion: descriptor.atribucion,
    crear: (opts) => descriptor.crear(opts),
  })),
  // (C) punto 3 — el WMS del Catastro por cada rol. `rol` va DESPUÉS del spread:
  //     el ataque no puede convertir una capa en la otra.
  ...ROLES.map((rol) => ({
    via: `crearCapaWMSCatastro({rol:'${rol}'})`,
    atribucion: ATRIBUCION.CATASTRO,
    crear: (opts) => crearCapaWMSCatastro({ ...opts, rol }),
  })),
  // (D) punto 7 — OSM.
  {
    via: `crearCapaOSM() [${OSM.id}]`,
    atribucion: OSM.atribucion,
    crear: (opts) => crearCapaOSM(opts),
  },
  // (E) punto 7 — «Blanco»: sin red y sin atribución (y es legítimo).
  {
    via: 'crearCapaBlanca()',
    atribucion: SIN_TEXTO,
    crear: (opts) => crearCapaBlanca(opts),
  },
  // (F) el camino que usa el VISOR de verdad: descriptor del catálogo por id.
  //     Cubre las seis capas —las dos catastrales incluidas— sin nombrar ninguna.
  ...CAPAS.map((descriptor) => ({
    via: `descriptorPorId('${descriptor.id}').crear()`,
    atribucion: descriptor.atribucion,
    crear: (opts) => descriptorPorId(descriptor.id).crear(opts),
  })),
]

/**
 * Intentos de DEBILITAMIENTO. Generalizan el test puntual que ya tenía
 * `test/services/ign.dom.test.js` («opts NO puede debilitar crossOrigin/
 * attribution») a TODOS los caminos: cada factory del proyecto aplica sus
 * invariantes DESPUÉS de fundir `opts`, y esto es lo que lo comprueba en vez de
 * confiar en que el patrón se haya copiado bien.
 *
 * Los dos ataques no son el mismo: el primero APAGA (valores falsy, el descuido
 * típico), el segundo SUSTITUYE por algo plausible (`'use-credentials'` es un
 * valor legal de `crossOrigin` que rompería el CORS anónimo, y una atribución
 * inventada es un incumplimiento de licencia con aspecto de texto correcto).
 */
const ATAQUES = [
  { nombre: "{crossOrigin:false, attribution:''}", opts: { crossOrigin: false, attribution: '' } },
  {
    nombre: "{crossOrigin:'use-credentials', attribution:'texto inventado'}",
    opts: { crossOrigin: 'use-credentials', attribution: 'texto inventado' },
  },
]

/** Producto cartesiano caminos × ataques (punto 4). */
const ASEDIO = CAMINOS.flatMap((camino) =>
  ATAQUES.map((ataque) => ({ via: camino.via, ataque: ataque.nombre, camino, opts: ataque.opts })),
)

/**
 * Los dos invariantes sobre una capa ya creada, con el mensaje que hace útil el
 * fallo. La atribución se compara por **IDENTIDAD** (punto 8): un
 * `toContain('Catastro')` dejaría pasar «(c) Direccion General del Catastro»,
 * que es una paráfrasis y por tanto un incumplimiento de licencia.
 *
 * @param {object} capa
 * @param {Camino} camino
 */
function afirmarInvariantes(capa, camino) {
  expect(
    capa.options.crossOrigin,
    `${camino.via}: crossOrigin debe ser '${ANONIMO}' (criterio 4 / override O7: sin él el ` +
      `canvas del plano de F09 queda «tainted»).`,
  ).toBe(ANONIMO)
  expect(
    capa.options.attribution,
    `${camino.via}: la atribución debe ser el texto EXACTO de viewer/atribucion.js, no una ` +
      `paráfrasis (criterio 5: obligación legal).`,
  ).toBe(camino.atribucion)
  if (camino.atribucion === SIN_TEXTO) {
    // Único caso legítimo: ver punto 7.
    expect(capa.options.attribution).toBe(SIN_TEXTO)
  } else {
    expect(
      Object.values(ATRIBUCION),
      `${camino.via}: el texto tiene que SER uno de ATRIBUCION (identidad), no parecerlo.`,
    ).toContain(capa.options.attribution)
  }
}

// ── Recorrido de ficheros (puntos 10, 11 y 12) ────────────────────────────────

/**
 * Raíz del repositorio, derivada de la posición de ESTE fichero.
 *
 * ⚠️ NO uses `new URL('../../', import.meta.url)` aquí: en el entorno **jsdom**
 * el `URL` global es el de jsdom y RESUELVE CONTRA EL DOCUMENTO, no contra la
 * base que se le pasa — medido en esta tarea: devuelve
 * `http://localhost:3000/index.js` y `fileURLToPath` revienta con
 * `ERR_INVALID_URL_SCHEME`. `import.meta.dirname` es nativo, ya viene en
 * separadores del sistema y no pasa por `URL`.
 */
const RAIZ = join(import.meta.dirname, '..', '..')

/**
 * Los dos directorios del visor. Es el SUJETO del invariante (no una lista de
 * ficheros: los ficheros los descubre el recorrido). Si alguien renombra uno,
 * `readdirSync` lanza y la guarda se pone roja — que es lo correcto: una guarda
 * que apunta a un directorio inexistente pasaría en verde sin vigilar nada.
 */
const DIRECTORIOS = ['viewer', 'services']

/** Agujas PROHIBIDAS en el código de esos directorios (puntos 10 y 12). */
const TESELAR_WMS = 'tileLayer.wms'
const HOJA_DE_ESTILO = '.css'

/**
 * `import`/`export` estático cuyo especificador acaba en `.css`, ANCLADO al
 * comienzo de línea. Segundo detector del punto 12, INDEPENDIENTE del
 * despojador de comentarios: una línea de comentario empieza por `/` o por `*`,
 * así que no puede casar con este patrón ni por accidente.
 */
const IMPORT_CSS = /^[^\S\n]*(?:import|export)\b[^\n]*?['"][^'"\n]*\.css(?:[?#][^'"\n]*)?['"]/

/** @param {string} nombre @returns {boolean} */
const esModulo = (nombre) => nombre.endsWith('.js')

/**
 * Recorrido RECURSIVO de directorio. Es la pieza que hace que los puntos 10/12
 * no se queden cortos: un módulo nuevo en `viewer/` queda vigilado el mismo día
 * que se crea, sin tocar este fichero.
 *
 * @param {string} directorio
 * @param {string[]} [acc]
 * @returns {string[]}  Rutas absolutas de los `.js` encontrados.
 */
function recorrer(directorio, acc = []) {
  for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
    const ruta = join(directorio, entrada.name)
    if (entrada.isDirectory()) recorrer(ruta, acc)
    else if (entrada.isFile() && esModulo(entrada.name)) acc.push(ruta)
  }
  return acc
}

const PALABRAS_ANTES_DE_REGEX = new Set([
  'return',
  'typeof',
  'case',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'instanceof',
  'do',
  'else',
  'yield',
  'await',
  'throw',
])

/**
 * ¿Un `/` en esta posición abre un literal de expresión regular, o divide?
 * Heurística estándar: tras un identificador/número/`)`/`]` es DIVISIÓN; tras un
 * operador, coma, paréntesis abierto o una palabra clave, es REGEX.
 *
 * @param {string} ultimo   Último carácter significativo del código emitido.
 * @param {string} palabra  Última palabra completa antes de ese carácter.
 * @returns {boolean}
 */
function esPosicionRegex(ultimo, palabra) {
  if (ultimo === '') return true
  if (/[A-Za-z0-9_$]/.test(ultimo)) return PALABRAS_ANTES_DE_REGEX.has(palabra)
  if (ultimo === ')' || ultimo === ']') return false
  return true
}

/** Índice SIGUIENTE al cierre de una cadena que empieza en `i` con `comilla`. */
function finDeCadena(fuente, i, comilla) {
  let j = i + 1
  while (j < fuente.length) {
    const c = fuente[j]
    if (c === '\\') {
      j += 2
      continue
    }
    if (c === comilla) return j + 1
    if (c === '\n') return j // cadena sin cerrar: no se traga la línea siguiente
    j += 1
  }
  return j
}

/** Índice SIGUIENTE al cierre de un literal de regex que empieza en `i`. */
function finDeRegex(fuente, i) {
  let j = i + 1
  let enClase = false
  while (j < fuente.length) {
    const c = fuente[j]
    if (c === '\\') {
      j += 2
      continue
    }
    if (c === '\n') return j
    if (enClase) {
      if (c === ']') enClase = false
    } else if (c === '[') {
      enClase = true
    } else if (c === '/') {
      j += 1
      while (j < fuente.length && /[A-Za-z]/.test(fuente[j])) j += 1 // banderas
      return j
    }
    j += 1
  }
  return j
}

/**
 * Devuelve la fuente SIN comentarios, conservando el número de líneas (para que
 * un hallazgo se pueda reportar como `fichero.js:línea`).
 *
 * **POR QUÉ ES IMPRESCINDIBLE** y no una comodidad: siete módulos del visor
 * MENCIONAN `leaflet/dist/leaflet.css` en sus cabeceras — precisamente para
 * PROHIBIRSE importarlo— y `viewer/wms-catastro.js` escribe `L.tileLayer.wms`
 * en su recuadro de cabecera para decir que NUNCA se usa. Buscar la subcadena a
 * pelo daría ocho falsos positivos y la guarda nacería roja: casa el CÓDIGO, no
 * cualquier aparición del texto (la exención es esta función, explícita y
 * probada con controles positivos más abajo).
 *
 * Reconoce cadenas, plantillas (con sus `${}` anidados), literales de regex y
 * los dos tipos de comentario. Las cadenas se conservan: una URL
 * `'https://…/{z}/{x}/{y}.png'` lleva `//` dentro y un despojador ingenuo se
 * comería el resto de la línea — o sea, escondería violaciones.
 *
 * @param {string} fuente
 * @returns {string}
 */
function despojarComentarios(fuente) {
  const trozos = []
  /** @type {Array<{plantilla: boolean, llaves: number}>} */
  const pila = [{ plantilla: false, llaves: 0 }]
  let ultimo = ''
  let palabra = ''
  let palabraPrevia = ''
  let i = 0

  while (i < fuente.length) {
    const marco = pila[pila.length - 1]
    const c = fuente[i]
    const d = fuente[i + 1]

    if (marco.plantilla) {
      if (c === '\\') {
        trozos.push(fuente.slice(i, i + 2))
        i += 2
        continue
      }
      if (c === '`') {
        trozos.push(c)
        i += 1
        pila.pop()
        ultimo = '`'
        continue
      }
      if (c === '$' && d === '{') {
        trozos.push('${')
        i += 2
        pila.push({ plantilla: false, llaves: 0 })
        ultimo = '{'
        continue
      }
      trozos.push(c)
      i += 1
      continue
    }

    if (c === '/' && d === '/') {
      while (i < fuente.length && fuente[i] !== '\n') i += 1 // el \n lo emite la vuelta siguiente
      continue
    }
    if (c === '/' && d === '*') {
      i += 2
      while (i < fuente.length && !(fuente[i] === '*' && fuente[i + 1] === '/')) {
        if (fuente[i] === '\n') trozos.push('\n') // se conservan las líneas
        i += 1
      }
      i += 2
      continue
    }
    if (c === '"' || c === "'") {
      const fin = finDeCadena(fuente, i, c)
      trozos.push(fuente.slice(i, fin))
      i = fin
      ultimo = 'x'
      palabraPrevia = palabra || palabraPrevia
      palabra = ''
      continue
    }
    if (c === '`') {
      trozos.push(c)
      i += 1
      pila.push({ plantilla: true, llaves: 0 })
      continue
    }
    if (c === '/' && esPosicionRegex(ultimo, palabra || palabraPrevia)) {
      const fin = finDeRegex(fuente, i)
      trozos.push(fuente.slice(i, fin))
      i = fin
      ultimo = 'x'
      palabraPrevia = palabra || palabraPrevia
      palabra = ''
      continue
    }
    if (c === '}' && marco.llaves === 0 && pila.length > 1) {
      trozos.push(c)
      i += 1
      pila.pop() // cierra un `${…}` y vuelve a la plantilla
      ultimo = '}'
      continue
    }
    if (c === '{') marco.llaves += 1
    if (c === '}') marco.llaves -= 1

    trozos.push(c)
    i += 1
    if (!/\s/.test(c)) ultimo = c
    if (/[A-Za-z0-9_$]/.test(c)) {
      palabra += c
    } else if (palabra !== '') {
      palabraPrevia = palabra
      palabra = ''
    }
  }

  return trozos.join('')
}

/**
 * @typedef {Object} Modulo
 * @property {string} ruta    Relativa y con `/`, legible en un mensaje de fallo.
 * @property {string} fuente  Contenido literal (comentarios incluidos).
 * @property {string} codigo  Contenido SIN comentarios, mismas líneas.
 */

/** Todos los módulos vigilados, descubiertos por recorrido. @type {Modulo[]} */
const MODULOS = DIRECTORIOS.flatMap((directorio) => recorrer(join(RAIZ, directorio))).map(
  (absoluta) => {
    const fuente = readFileSync(absoluta, 'utf8')
    return {
      ruta: relative(RAIZ, absoluta).split(sep).join('/'),
      fuente,
      codigo: despojarComentarios(fuente),
    }
  },
)

/**
 * Rutas legibles `fichero.js:línea` donde `aguja` aparece en el CÓDIGO. Devuelve
 * rutas y no un booleano: es el patrón de `test/contrato.test.js` —el fallo
 * tiene que decir DÓNDE— y el que hace que esta guarda sirva para algo el día
 * que se ponga roja.
 *
 * @param {Modulo[]} modulos
 * @param {string} aguja
 * @param {{insensible?: boolean}} [opciones]
 * @returns {string[]}
 */
function rutasConAguja(modulos, aguja, { insensible = false } = {}) {
  const buscada = insensible ? aguja.toLowerCase() : aguja
  const rutas = []
  for (const modulo of modulos) {
    modulo.codigo.split('\n').forEach((linea, indice) => {
      const texto = insensible ? linea.toLowerCase() : linea
      if (texto.includes(buscada)) rutas.push(`${modulo.ruta}:${indice + 1}`)
    })
  }
  return rutas
}

/** Rutas legibles de las líneas de la fuente CRUDA que casan con `patron`. */
function rutasConPatron(modulos, patron) {
  const rutas = []
  for (const modulo of modulos) {
    modulo.fuente.split('\n').forEach((linea, indice) => {
      if (patron.test(linea)) rutas.push(`${modulo.ruta}:${indice + 1}`)
    })
  }
  return rutas
}

/** Atajo para los controles positivos: busca en una muestra sintética. */
function rutasEnMuestra(fuente, aguja, opciones) {
  const muestra = { ruta: '(muestra)', fuente, codigo: despojarComentarios(fuente) }
  return rutasConAguja([muestra], aguja, opciones)
}

// ═════════════════════════════════════════════════════════════════════════════
// LÍNEA BASE · TODA capa, por TODO camino, SIN opciones
// ═════════════════════════════════════════════════════════════════════════════

describe('guarda transversal · línea base · toda capa nace con los dos invariantes', () => {
  // Este bloque es la enumeración COMPLETA y sin argumentos: el caso normal, el
  // que de verdad ejecuta el visor. Existe porque la prueba negativa de esta
  // tarea (comentar `crossOrigin` en `services/osm.js`) demostró que sin él la
  // guarda solo se enteraba por los caminos con ATAQUE y por `montarCapas` —o
  // sea, el fallo se reportaba como «no resiste un ataque» cuando la verdad era
  // «esta capa NUNCA tuvo crossOrigin». Un guardián tiene que nombrar el hecho
  // simple antes que el sofisticado.
  it.each(CAMINOS)('$via: crossOrigin y atribución correctos sin pasar NADA', (camino) => {
    afirmarInvariantes(camino.crear(), camino)
  })

  it(`la enumeración cubre los ${CAMINOS.length} caminos derivados del proyecto`, () => {
    // Recuento DERIVADO: tres WMTS por clave + tres por descriptor + un rol por
    // capa catastral + OSM + Blanco + el catálogo entero. Si mañana entra una
    // capa nueva, este número sube solo.
    const esperados =
      Object.keys(WMTS_IGN).length + CAPAS_IGN.length + ROLES.length + 2 + CAPAS.length
    expect(CAMINOS.length).toBe(esperados)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// PUNTO 1 · `crearCapaWMTS(id)`, derivado de `Object.keys(WMTS_IGN)`
// ═════════════════════════════════════════════════════════════════════════════

describe('guarda transversal · punto 1 · services/ign.js#crearCapaWMTS (por clave de WMTS_IGN)', () => {
  it.each(Object.keys(WMTS_IGN))(
    "crearCapaWMTS('%s') nace con crossOrigin='anonymous' y su atribución EXACTA",
    (id) => {
      const camino = CAMINOS.find((c) => c.via === `crearCapaWMTS('${id}')`)
      afirmarInvariantes(camino.crear(), camino)
    },
  )

  it('las TRES WMTS del IGN están vigiladas (incluida la que no llega al control de capas)', () => {
    // No es un recuento decorativo: `services/ign.js` aísla tres servicios y
    // `viewer/capas.js` monta dos. La guarda cubre los tres — si mañana entra
    // una cuarta WMTS, este bloque la cubre el mismo día, sin tocar nada.
    const cubiertas = CAMINOS.filter((c) => c.via.startsWith('crearCapaWMTS(')).length
    expect(cubiertas).toBe(Object.keys(WMTS_IGN).length)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// PUNTO 2 · `descriptor.crear()` — camino DISTINTO, recorriendo `CAPAS_IGN`
// ═════════════════════════════════════════════════════════════════════════════

describe('guarda transversal · punto 2 · services/ign.js#CAPAS_IGN por descriptor', () => {
  it.each(CAPAS_IGN.map((descriptor) => descriptor.id))(
    "CAPAS_IGN['%s'].crear() mantiene los dos invariantes (vía descriptor, no factory)",
    (id) => {
      const camino = CAMINOS.find((c) => c.via === `CAPAS_IGN['${id}'].crear()`)
      afirmarInvariantes(camino.crear(), camino)
    },
  )

  it('el descriptor declara la MISMA atribución que su servicio (no una copia suya)', () => {
    const desviados = CAPAS_IGN.filter(
      (descriptor) => descriptor.atribucion !== WMTS_IGN[descriptor.id].atribucion,
    ).map((descriptor) => descriptor.id)
    expect(desviados).toEqual([])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// PUNTO 3 · el WMS del Catastro, en sus DOS roles
// ═════════════════════════════════════════════════════════════════════════════

describe('guarda transversal · punto 3 · viewer/wms-catastro.js#crearCapaWMSCatastro por rol', () => {
  it('los roles se DERIVAN del catálogo de capas, no se escriben', () => {
    expect(ROLES).toEqual([...new Set(CAPAS.map((descriptor) => descriptor.rol))])
    // Dos roles: la catastral se monta como base opaca y como superpuesta
    // translúcida (`viewer/capas.js`, punto 9 de la cabecera del módulo WMS).
    expect(ROLES.length).toBe(2)
  })

  it.each(ROLES)("crearCapaWMSCatastro({rol:'%s'}) mantiene los dos invariantes", (rol) => {
    const camino = CAMINOS.find((c) => c.via === `crearCapaWMSCatastro({rol:'${rol}'})`)
    afirmarInvariantes(camino.crear(), camino)
  })

  it('los dos roles producen capas DISTINTAS (pane/opacidad) con la MISMA atribución', () => {
    const capas = ROLES.map((rol) => crearCapaWMSCatastro({ rol }))
    const panes = new Set(capas.map((capa) => capa.options.pane))
    expect(panes.size).toBe(ROLES.length)
    expect(new Set(capas.map((capa) => capa.options.attribution)).size).toBe(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// PUNTO 4 · INTENTOS DE DEBILITAMIENTO — producto cartesiano de caminos × ataques
// ═════════════════════════════════════════════════════════════════════════════

describe('guarda transversal · punto 4 · ningún llamante puede debilitar los invariantes', () => {
  it(`el asedio cubre los ${CAMINOS.length} caminos × ${ATAQUES.length} ataques`, () => {
    expect(ASEDIO.length).toBe(CAMINOS.length * ATAQUES.length)
  })

  it.each(ASEDIO)('$via resiste $ataque', ({ camino, opts }) => {
    afirmarInvariantes(camino.crear({ ...opts }), camino)
  })

  it.each(CAMINOS)('$via resiste el ataque CAMUFLADO entre opciones legítimas', (camino) => {
    // Variante del ataque con más superficie: la carga viaja rodeada de opciones
    // negociables y de verdad (`className`, `zIndex`, `maxZoom`), que es la forma
    // que tendría el descuido real. Es el escenario que `viewer/wms-catastro.js`
    // dejó anotado como riesgo: «en cuanto alguien añada un pass-through de
    // ...resto —la petición natural de la Fase 3 para className/zIndex—
    // crossOrigin y attribution se debilitarían sin que nada avisara».
    //
    // NO se afirma nada sobre el pass-through en sí: que una factory reenvíe o
    // descarte las opciones desconocidas es decisión de cada módulo (la del WMS
    // del Catastro las DESCARTA a propósito) y no es un invariante transversal.
    // Lo transversal es que el ataque no cuele por esta vía.
    const capa = camino.crear({
      className: 'gml-prueba-asedio',
      zIndex: 7,
      maxZoom: 22,
      crossOrigin: 'use-credentials',
      attribution: 'texto inventado',
    })
    afirmarInvariantes(capa, camino)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// PUNTO 5 · las DOS imágenes de la capa WMS del Catastro
// ═════════════════════════════════════════════════════════════════════════════

describe('guarda transversal · punto 5 · las DOS imágenes de la capa WMS', () => {
  it.each(ROLES)(
    "rol '%s': la imagen VISIBLE (capa.getElement()) nace con crossOrigin='anonymous'",
    (rol) => {
      const { mapa } = mapaDePrueba()
      espiar()
      const capa = crearCapaWMSCatastro({ rol })
      capa.addTo(mapa)

      const elemento = capa.getElement()
      expect(elemento, `rol '${rol}': la capa debería tener <img> tras addTo`).toBeTruthy()
      expect(elemento.crossOrigin).toBe(ANONIMO)
      expect(elemento.getAttribute('crossorigin')).toBe(ANONIMO)
    },
  )

  it.each(ROLES)(
    "rol '%s': la PRECARGA desprendida (new Image()) —la que trae los píxeles— también",
    (rol) => {
      // La imagen VISIBLE la crea Leaflet y solo recibe URLs YA cargadas; la que
      // de verdad viaja a la red es este `new Image()` de `_solicitar`. Si solo
      // se vigilara `getElement()`, el canvas de F09 quedaría contaminado por la
      // imagen que sí descarga (y el test seguiría verde).
      const espia = espiar()
      const { mapa } = mapaDePrueba()
      const capa = crearCapaWMSCatastro({ rol })
      capa.addTo(mapa)

      expect(espia.total, 'la capa debería haber emitido su petición al añadirse').toBeGreaterThan(0)
      const precarga = espia.ultima()
      expect(precarga.crossOrigin).toBe(ANONIMO)
      expect(precarga.getAttribute('src')).toContain('REQUEST=GetMap')
    },
  )

  it('la precarga fija crossOrigin ANTES de src (regla CORS del dossier §4.4)', () => {
    // Orden OBLIGATORIO: asignar `src` primero contamina el canvas aunque el
    // servidor emita ACAO. Se instrumenta el setter de `src` de la INSTANCIA
    // para leer el `crossOrigin` que había en ese instante.
    const espia = espiar()
    const Base = globalThis.Image
    const prototipoImagen = globalThis.HTMLImageElement.prototype
    const descriptorSrc = Object.getOwnPropertyDescriptor(prototipoImagen, 'src')
    const alAsignarSrc = []
    globalThis.Image = function ImagenOrdenada() {
      const img = new Base()
      Object.defineProperty(img, 'src', {
        configurable: true,
        get: () => descriptorSrc.get.call(img),
        set: (valor) => {
          alAsignarSrc.push(img.crossOrigin)
          descriptorSrc.set.call(img, valor)
        },
      })
      return img
    }
    pendientes.push(() => {
      globalThis.Image = Base
    })

    const { mapa } = mapaDePrueba()
    crearCapaWMSCatastro({ rol: ROLES[0] }).addTo(mapa)

    expect(alAsignarSrc.length).toBeGreaterThan(0)
    expect(alAsignarSrc, 'crossOrigin debe estar puesto ANTES de asignar src').toEqual(
      alAsignarSrc.map(() => ANONIMO),
    )
    expect(espia.total).toBeGreaterThan(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// PUNTO 6 · el MAPA: sin control de atribución, capas atribuidas no sirven
// ═════════════════════════════════════════════════════════════════════════════

describe('guarda transversal · punto 6 · el MAPA lleva el control de atribución', () => {
  it('crearMapa(el) fija attributionControl: true', () => {
    const { mapa } = mapaDePrueba()
    expect(mapa.options.attributionControl).toBe(true)
    expect(mapa.attributionControl, 'el control tiene que estar de verdad en el mapa').toBeTruthy()
  })

  it('SOBREVIVE a crearMapa(el, {attributionControl: false})', () => {
    // Sin esto la guarda certificaría capas perfectamente atribuidas en un visor
    // que no muestra ninguna atribución (hallazgo 2.2 de la auditoría 2C.2).
    const { mapa } = mapaDePrueba({ opts: { attributionControl: false } })
    expect(mapa.options.attributionControl).toBe(true)
    expect(mapa.attributionControl).toBeTruthy()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// PUNTO 7 · OSM con enlace a la licencia · «Blanco» sin atribución, y es legítimo
// ═════════════════════════════════════════════════════════════════════════════

describe('guarda transversal · punto 7 · OSM con enlace, «Blanco» sin texto (legítimo)', () => {
  it('la capa OSM lleva el <a href="…openstreetmap.org/copyright"> que exige la ODbL', () => {
    // ODbL: mención + ENLACE a la licencia. El enlace es parte del requisito
    // legal, no adorno; y se comprueba sobre la CAPA creada, no sobre la
    // constante, porque es lo que pinta el control de atribución.
    const capa = crearCapaOSM()
    expect(capa.options.attribution).toBe(OSM.atribucion)
    expect(capa.options.attribution).toMatch(
      /<a\s+href="https?:\/\/[^"]*openstreetmap\.org\/copyright"\s*>/i,
    )
    expect(CAPA_OSM.atribucion).toBe(OSM.atribucion)
  })

  it("«Blanco» lleva attribution === '' y eso es LEGÍTIMO, no un olvido", () => {
    // RAZÓN (viewer/capas.js, cabecera): la atribución es una obligación sobre
    // DATOS DE TERCEROS y en «Blanco» no hay datos de nadie —ni imagen, ni
    // geometría, ni topónimo—, solo píxeles blancos generados en el cliente. No
    // existe titular al que citar; poner un texto sería inventarse una cesión.
    // `L.Control.Attribution#addAttribution` ignora las cadenas vacías.
    const capa = crearCapaBlanca()
    expect(capa.options.attribution).toBe(SIN_TEXTO)
    // Y aun así declara crossOrigin: el atributo es VACUO aquí (no hay petición)
    // y está para que esta guarda pueda ENUMERAR sin excepciones.
    expect(capa.options.crossOrigin).toBe(ANONIMO)
  })

  it('EXACTAMENTE UNA capa del catálogo tiene atribución vacía (la excepción no se propaga)', () => {
    const vacias = CAPAS.filter((descriptor) => descriptor.atribucion === SIN_TEXTO).map(
      (descriptor) => descriptor.id,
    )
    expect(vacias).toHaveLength(1)
  })

  it('ATRIBUCION NO tiene clave para esa capa (no debe existir un ATRIBUCION.BLANCO)', () => {
    // La clave se DERIVA de la capa sin atribución, no se escribe: si mañana la
    // capa se llamara de otro modo, esta aserción la seguiría.
    const [sinAtribucion] = CAPAS.filter((descriptor) => descriptor.atribucion === SIN_TEXTO)
    const claves = Object.keys(ATRIBUCION).map((clave) => clave.toLowerCase())
    expect(
      claves,
      `ATRIBUCION no debe tener clave '${sinAtribucion.id.toUpperCase()}': no hay datos de ` +
        `terceros que citar en «${sinAtribucion.nombre}».`,
    ).not.toContain(sinAtribucion.id.toLowerCase())
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// PUNTO 8 · IDENTIDAD, no contención — sobre TODOS los caminos
// ═════════════════════════════════════════════════════════════════════════════

describe('guarda transversal · punto 8 · la atribución se compara por IDENTIDAD', () => {
  it.each(CAMINOS)('$via: options.attribution ES un valor de ATRIBUCION (o la vacía legítima)', ({
    via,
    atribucion,
    crear,
  }) => {
    const capa = crear()
    if (atribucion === SIN_TEXTO) {
      expect(capa.options.attribution).toBe(SIN_TEXTO)
      return
    }
    expect(
      Object.values(ATRIBUCION),
      `${via}: un toContain('Catastro') dejaría pasar «(c) Direccion General del Catastro», que ` +
        `es una paráfrasis y por tanto un incumplimiento de licencia.`,
    ).toContain(capa.options.attribution)
  })

  it('una PARÁFRASIS del texto legal no pasaría esta comparación (control positivo)', () => {
    const original = ATRIBUCION.CATASTRO
    const parafrasis = original.replace('©', '(c)').normalize('NFD').replace(/\p{Diacritic}/gu, '')
    expect(parafrasis).not.toBe(original)
    // Lo que un `toContain` laxo dejaría pasar…
    expect(parafrasis).toContain('Catastro')
    // …y lo que la comparación por identidad rechaza.
    expect(Object.values(ATRIBUCION)).not.toContain(parafrasis)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// PUNTO 9 · RECORRIDO INVERSO: todo texto legal es alcanzable desde el visor
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Claves de `catalogo` cuyo texto NO aparece en `alcanzados`. Función y no
 * `expect` en línea para poder probar que **nombra la clave huérfana**, que es
 * el requisito del punto 9: un `expect(cubre).toBe(true)` diría «false» y
 * dejaría al siguiente buscando cuál de los cuatro textos sobra.
 *
 * @param {Record<string, string>} catalogo
 * @param {Set<string>} alcanzados
 * @returns {string[]}
 */
function clavesHuerfanas(catalogo, alcanzados) {
  return Object.entries(catalogo)
    .filter(([, texto]) => texto !== SIN_TEXTO && !alcanzados.has(texto))
    .map(([clave]) => clave)
}

describe('guarda transversal · punto 9 · recorrido INVERSO de ATRIBUCION', () => {
  it('los textos DECLARADOS por los descriptores de CAPAS cubren todo ATRIBUCION', () => {
    const alcanzados = new Set(CAPAS.map((descriptor) => descriptor.atribucion))
    const huerfanas = clavesHuerfanas(ATRIBUCION, alcanzados)
    expect(
      huerfanas,
      `hay claves de ATRIBUCION que NINGUNA capa del visor usa: ${huerfanas.join(', ')}. O falta ` +
        `montar esa cartografía, o el texto legal está de más (y entonces sobra en el módulo).`,
    ).toEqual([])
  })

  it('los textos de las capas REALMENTE creadas cubren todo ATRIBUCION', () => {
    // Camino distinto del anterior a propósito: un descriptor podría declarar
    // una atribución que su `crear()` no aplica.
    espiar()
    const alcanzados = new Set(
      CAPAS.map((descriptor) => descriptor.crear().options.attribution),
    )
    expect(clavesHuerfanas(ATRIBUCION, alcanzados)).toEqual([])
  })

  it('montarCapas() monta las capas del catálogo y TODAS llevan los dos invariantes', () => {
    espiar()
    const { mapa } = mapaDePrueba()
    const montado = montarCapas({ mapa })
    pendientes.push(() => montado.destruir())

    expect(montado.capas.size).toBe(CAPAS.length)
    const fallos = []
    for (const [id, capa] of montado.capas) {
      const esperada = descriptorPorId(id).atribucion
      if (capa.options.crossOrigin !== ANONIMO) {
        fallos.push(`${id}.crossOrigin=${JSON.stringify(capa.options.crossOrigin)}`)
      }
      if (capa.options.attribution !== esperada) {
        fallos.push(`${id}.attribution=${JSON.stringify(capa.options.attribution)}`)
      }
    }
    expect(fallos).toEqual([])
    expect(montado.bases.size).toBe(CAPAS_BASE.length)
    expect(montado.capas.has(CAPA_SUPERPUESTA.id)).toBe(true)
  })

  it('con TODAS las capas en el mapa, el control de atribución MUESTRA todos los textos', () => {
    // El extremo final del criterio 5: no basta con que las capas lleven el
    // texto; tiene que llegar a la pantalla. Lo pinta `L.Control.Attribution`
    // a partir de las capas AÑADIDAS, así que se añaden todas a la vez.
    espiar()
    const { mapa } = mapaDePrueba()
    for (const descriptor of CAPAS) mapa.addLayer(descriptor.crear())

    const contenedor = mapa.attributionControl.getContainer()
    const visible = contenedor.textContent
    const ausentes = Object.entries(ATRIBUCION)
      .filter(([, texto]) => !visible.includes(texto.replace(/<[^>]+>/g, '')))
      .map(([clave]) => clave)
    expect(ausentes, `el control de atribución no muestra: ${ausentes.join(', ')}.`).toEqual([])
    // …y el enlace de la ODbL llega como enlace de verdad, no como texto plano.
    expect(contenedor.querySelector('a[href*="openstreetmap.org/copyright"]')).toBeTruthy()
  })

  it('el recorrido inverso FALLA NOMBRANDO la clave huérfana (control positivo)', () => {
    const alcanzados = new Set(CAPAS.map((descriptor) => descriptor.atribucion))
    const conIntrusa = { ...ATRIBUCION, INVENTADA: 'texto que nadie usa' }
    expect(clavesHuerfanas(conIntrusa, alcanzados)).toEqual(['INVENTADA'])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// PUNTOS 10 · 11 · 12 — recorrido de `viewer/` y `services/` con node:fs
// ═════════════════════════════════════════════════════════════════════════════

describe('guarda transversal · el recorrido de módulos es real y no vacío', () => {
  it.each(DIRECTORIOS)("el recorrido de '%s/' encuentra módulos .js", (directorio) => {
    const encontrados = MODULOS.filter((modulo) => modulo.ruta.startsWith(`${directorio}/`))
    expect(encontrados.length, `${directorio}/ no ha dado ningún módulo`).toBeGreaterThan(0)
  })

  it('el recorrido alcanza el módulo que MENCIONA tileLayer.wms para prohibirlo', () => {
    // Control de que la exención de comentarios se está EJERCITANDO de verdad
    // sobre el fichero más delicado: si este `filter` se quedara a cero, la
    // aserción del punto 10 estaría pasando sin haber leído la trampa.
    const mencionan = MODULOS.filter((modulo) =>
      modulo.fuente.toLowerCase().includes(TESELAR_WMS.toLowerCase()),
    ).map((modulo) => modulo.ruta)
    expect(mencionan.length).toBeGreaterThan(0)
  })

  it('el recorrido alcanza los módulos que MENCIONAN el CSS para prohibirlo', () => {
    const mencionan = MODULOS.filter((modulo) => modulo.fuente.includes(HOJA_DE_ESTILO)).map(
      (modulo) => modulo.ruta,
    )
    expect(mencionan.length).toBeGreaterThan(0)
  })
})

describe('guarda transversal · punto 10 · NADIE tesela el WMS del Catastro', () => {
  it('ningún módulo de viewer/ ni de services/ usa tileLayer.wms', () => {
    // EL MAYOR RIESGO DE BLOQUEO DEL PROYECTO: el `ServidorWMS.aspx` rasteriza
    // en cada petición y la DGC desaconseja el mosaico; la penalización por
    // abuso es denegación de servicio ~10 días, con detección de rotación de
    // IP/UA. `viewer/wms-catastro.js` gestiona UN `L.ImageOverlay` = UNA imagen
    // por encuadre justamente para no caer en esto. Búsqueda INSENSIBLE a
    // mayúsculas: cubre también la forma de clase `new L.TileLayer.WMS(...)`.
    const rutas = rutasConAguja(MODULOS, TESELAR_WMS, { insensible: true })
    expect(
      rutas,
      `se ha colado un teselado del WMS del Catastro en: ${rutas.join(', ')}. Teselar ese ` +
        `servicio es EL mayor riesgo de bloqueo del proyecto (denegación ~10 días): usa el ` +
        `L.ImageOverlay gestionado de viewer/wms-catastro.js, UNA imagen por encuadre.`,
    ).toEqual([])
  })

  it('un tileLayer.wms REAL en código sí se detecta (control positivo)', () => {
    expect(rutasEnMuestra('const capa = L.tileLayer.wms(url, {})\n', TESELAR_WMS)).toEqual([
      '(muestra):1',
    ])
    // …y la forma de CLASE también, por la búsqueda insensible.
    expect(
      rutasEnMuestra('const capa = new L.TileLayer.WMS(url, {})\n', TESELAR_WMS, {
        insensible: true,
      }),
    ).toEqual(['(muestra):1'])
  })

  it('una MENCIÓN en comentario (la que prohíbe el teselado) no se toma por uso', () => {
    expect(
      rutasEnMuestra('// Por eso aquí NO se usa `L.tileLayer.wms` NUNCA.\nconst a = 1\n', TESELAR_WMS, {
        insensible: true,
      }),
    ).toEqual([])
  })
})

describe('guarda transversal · punto 12 · ningún módulo del visor importa CSS', () => {
  it('ningún módulo de viewer/ ni de services/ contiene la subcadena .css en su CÓDIGO', () => {
    // Siete módulos REPITEN en sus cabeceras que no importan CSS —es lo que
    // permite que F05/F06/F08 consuman el visor como LIBRERÍA—, pero hasta ahora
    // era una convención escrita, no verificable. Cierra la segunda forma de un
    // riesgo ya anotado: no «exportar el visor por el barrel raíz», sino «que
    // viewer/capas.js importe un CSS para que el control de opacidad se vea
    // bien». El CSS de Leaflet va SOLO en la entrada demo de la Fase 4.
    const rutas = rutasConAguja(MODULOS, HOJA_DE_ESTILO)
    expect(
      rutas,
      `un módulo del visor referencia una hoja de estilo en su código: ${rutas.join(', ')}. El ` +
        `visor tiene que ser consumible como librería (F05/F06/F08): los estilos van en la ` +
        `entrada de la app, y lo imprescindible en línea (ver el ControlOpacidad).`,
    ).toEqual([])
  })

  it('ninguna línea de viewer/ ni services/ ABRE con un import/export de .css', () => {
    // Segundo detector, INDEPENDIENTE del despojador: anclado al comienzo de
    // línea, así que un comentario (que empieza por `/` o `*`) no puede casar.
    // Si el despojador tuviera un fallo que ocultara un import, este lo pilla.
    const rutas = rutasConPatron(MODULOS, IMPORT_CSS)
    expect(rutas, `import estático de CSS en: ${rutas.join(', ')}.`).toEqual([])
  })

  it('un import REAL de CSS sí se detecta, por los DOS detectores (control positivo)', () => {
    const fuente = "import 'leaflet/dist/leaflet.css'\n"
    expect(rutasEnMuestra(fuente, HOJA_DE_ESTILO)).toEqual(['(muestra):1'])
    const muestra = [{ ruta: '(muestra)', fuente, codigo: fuente }]
    expect(rutasConPatron(muestra, IMPORT_CSS)).toEqual(['(muestra):1'])
  })

  it('una MENCIÓN en comentario (la que prohíbe el CSS) no se toma por import', () => {
    const muestra =
      '//     `node` del proyecto). Tampoco importa `leaflet/dist/leaflet.css`.\nconst a = 1\n'
    expect(rutasEnMuestra(muestra, HOJA_DE_ESTILO)).toEqual([])
    expect(
      rutasConPatron([{ ruta: '(muestra)', fuente: muestra, codigo: muestra }], IMPORT_CSS),
    ).toEqual([])
  })
})

describe('guarda transversal · el despojador de comentarios (controles positivos)', () => {
  // Sin estos controles, un despojador demasiado agresivo dejaría los puntos
  // 10/12 en verde permanente sin vigilar nada — el mismo modo de fallo del
  // guardián anti-proj4 del build, que pasaba con proj4 dentro del bundle.
  it('un /* bloque */ multilínea no delata, y conserva los números de línea', () => {
    const muestra = `/* no importa\n leaflet/dist/leaflet.css */\nimport './de-verdad.css'\n`
    expect(rutasEnMuestra(muestra, HOJA_DE_ESTILO)).toEqual(['(muestra):3'])
  })

  it('una URL dentro de una cadena NO se toma por comentario de línea', () => {
    // Sin tratamiento de cadenas, el `//` de `https://` se comería el resto de
    // la línea y la violación siguiente quedaría INVISIBLE.
    const muestra = `const u = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'; import('./a.css')\n`
    expect(rutasEnMuestra(muestra, HOJA_DE_ESTILO)).toEqual(['(muestra):1'])
  })

  it('un literal de plantilla con ${} no oculta el código que lleva dentro', () => {
    const muestra = 'const u = `${base}?A=1`\nconst c = L.tileLayer.wms(u)\n'
    expect(rutasEnMuestra(muestra, TESELAR_WMS)).toEqual(['(muestra):2'])
  })

  it('un literal de regex con / dentro no descuadra el resto del fichero', () => {
    const muestra = "const r = /a\\/\\/b/\nimport './x.css'\n"
    expect(rutasEnMuestra(muestra, HOJA_DE_ESTILO)).toEqual(['(muestra):2'])
  })

  it('una división NO se confunde con un literal de regex', () => {
    const muestra = "const o = pasos / PASOS\nimport './y.css'\n"
    expect(rutasEnMuestra(muestra, HOJA_DE_ESTILO)).toEqual(['(muestra):2'])
  })

  it('los módulos reales siguen teniendo código después de despojar (no se ha vaciado todo)', () => {
    const vacios = MODULOS.filter((modulo) => modulo.codigo.trim().length === 0).map((m) => m.ruta)
    expect(vacios).toEqual([])
    // Y el despojado tiene el MISMO número de líneas que el original: es lo que
    // hace fiables los `fichero.js:línea` de los mensajes de fallo.
    const descuadrados = MODULOS.filter(
      (modulo) => modulo.codigo.split('\n').length !== modulo.fuente.split('\n').length,
    ).map((m) => m.ruta)
    expect(descuadrados).toEqual([])
  })
})

describe('guarda transversal · punto 11 · los textos legales tienen UNA sola fuente', () => {
  // Punto RECONSTRUIDO: la especificación de 12 puntos que llegó a esta tarea
  // salta del 10 al 12 (no hay 11 escrito). Se reconstruye con lo que dice el
  // MISMO recorrido de ficheros y lo que cuatro cabeceras afirman por escrito
  // («el texto NO se copia a mano aquí: se importa de viewer/atribucion.js, la
  // única fuente de esos strings en todo el proyecto»). Es la misma clase de
  // invariante que 10 y 12 y se comprueba en el mismo recorrido; si el punto 11
  // original era otra cosa, esto no le quita el sitio.
  const declaraFuente = /export\s+const\s+ATRIBUCION\b/

  it('EXACTAMENTE UN módulo declara ATRIBUCION', () => {
    const declarantes = MODULOS.filter((modulo) => declaraFuente.test(modulo.codigo)).map(
      (modulo) => modulo.ruta,
    )
    expect(declarantes, `declarantes de ATRIBUCION: ${declarantes.join(', ')}`).toHaveLength(1)
  })

  it.each(Object.keys(ATRIBUCION))(
    'el texto legal ATRIBUCION.%s no está copiado a mano en ningún OTRO módulo',
    (clave) => {
      const otros = MODULOS.filter((modulo) => !declaraFuente.test(modulo.codigo))
      const rutas = rutasConAguja(otros, ATRIBUCION[clave])
      expect(
        rutas,
        `el texto de ATRIBUCION.${clave} aparece copiado en: ${rutas.join(', ')}. Debe importarse ` +
          `de viewer/atribucion.js: dos copias divergen, y una atribución divergente es un ` +
          `incumplimiento de licencia.`,
      ).toEqual([])
    },
  )
})
