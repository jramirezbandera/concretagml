// app/demo-datos.js — F03 · Fase 4, Tarea 4B.2 (datos de demostración de la app).
//
// Por qué este módulo existe APARTE de `app/main.js`:
// el plan maestro exige que el build de Vite (`app/**`) NUNCA dependa de
// `test/fixtures/`. Las suites de test SÍ leen esos fixtures desde disco, pero
// un fichero de producción no puede importar nada bajo `test/` (arrastraría al
// bundle final rutas de fichero de test y acoplaría el arranque de la app a la
// estructura del harness). Por eso los 15 vértices de la parcela real de abajo
// están COPIADOS a mano como literales — no importados — desde el fixture. Si
// algún día divergen, el fixture es la fuente de verdad, no esta copia.
//
// Este módulo expone dos datasets de demostración:
//   - `parcelaDemo()`         — la parcela REAL del Catastro (ref. 9398516VK3799G).
//   - `parcelaDemoConHueco()` — una parcela SINTÉTICA (inventada) con un hueco,
//     para poder ver en el navegador el rótulo "HUECO 1" y el recorte de
//     anillos anidados. NUNCA se le añade un hueco a la parcela real: eso sería
//     presentar un dato inventado como si fuera del Catastro (SPEC, reglas de
//     oro contra maquillar datos).

import { crearParcela, crearRecinto, TIPO_RECINTO, ORIGEN_PARCELA } from '../model/parcela.js'

// ── SRS / huso de todos los datasets de este módulo ─────────────────────────
//
// `crearParcela` NO porta `srs` (vive en el Expediente, no en la Parcela; ver
// `model/parcela.js#crearExpediente`). Por eso se exporta aparte.
//
// Hoy su ÚNICO consumidor es `app/main.js`, que lo pasa al visor como
// `opciones.srs` y lo pinta en la ficha del pie: la app de F03 trabaja sobre una
// Parcela suelta y todavía NO construye ningún Expediente. Cuando F10
// (persistencia) lo construya, la llamada será
// `crearExpediente({ srs: SRS_DEMO, parcela: parcelaDemo() })` y esta constante
// seguirá siendo la fuente del `srs`.
export const SRS_DEMO = 'EPSG:25830'

// ── Parcela real: 9398516VK3799G ────────────────────────────────────────────

/** Referencia catastral de la parcela real usada como demo. */
export const REFCAT_DEMO = '9398516VK3799G'

// Anillo EXTERIOR abierto (15 vértices, sin repetir el vértice de cierre) de la
// parcela real 9398516VK3799G, en UTM [X=Este, Y=Norte], EPSG:25830 (huso 30,
// ETRS89).
//
// FUENTE (copiados a mano, no importados — ver cabecera del módulo):
//   test/fixtures/geo/parcela-ring.json → campo "anilloExterior"
// que a su vez se extrajo de:
//   test/fixtures/gml/cp_parcela_9398516VK3799G.gml (WFS GetParcel, Catastro).
// Ese fixture es la FUENTE DE VERDAD: si estos números y los del fixture
// llegaran a divergir, manda el fixture, no esta copia.
const ANILLO_EXTERIOR_9398516VK3799G = [
  [439283.23, 4479671.27],
  [439268.76, 4479658.01],
  [439257.63, 4479647.8],
  [439246.37, 4479637.48],
  [439244.43, 4479640.02],
  [439239.96, 4479646.73],
  [439229.31, 4479665.26],
  [439228.84, 4479666.09],
  [439227.62, 4479668.26],
  [439225.21, 4479672.54],
  [439222.89, 4479677.12],
  [439222.53, 4479678],
  [439222.47, 4479678.13],
  [439247.3, 4479687.38],
  [439276.64, 4479673.63],
]

/**
 * Parcela de demostración REAL: la parcela del Catastro con referencia
 * {@link REFCAT_DEMO}, con su único recinto EXTERIOR de 15 vértices (anillo
 * abierto, UTM EPSG:25830 huso 30). Ver la constante
 * `ANILLO_EXTERIOR_9398516VK3799G` para la procedencia exacta de las
 * coordenadas.
 *
 * - `origen: 'WFS'` porque el anillo viene tal cual del servicio WFS del
 *   Catastro (es la verdad de dónde sale este dato).
 * - `geometriaOficial` recibe el MISMO anillo: es el estado real de una
 *   parcela recién cargada del Catastro (exterior actual === oficial), y de
 *   paso permite ejercitar en el visor el polígono de referencia que dibuja
 *   `viewer/sincronizacion.js`.
 * - Construida con `crearParcela`/`crearRecinto` (nunca a mano): los
 *   invariantes del modelo (anillo abierto, `recintos[0]` EXTERIOR, copia
 *   defensiva de vértices) quedan garantizados por construcción.
 * - Cada llamada construye un POJO NUEVO e independiente (ninguna referencia
 *   compartida entre llamadas ni entre `recintos` y `geometriaOficial`):
 *   dos vistas que llamen a `parcelaDemo()` por separado nunca se pisan el
 *   estado.
 *
 * @returns {object} Parcela (ver `model/parcela.js#crearParcela`), con
 *   `refcat = REFCAT_DEMO` y un único recinto EXTERIOR de 15 vértices.
 */
export function parcelaDemo() {
  return crearParcela({
    idLocal: `demo-${REFCAT_DEMO}`,
    refcat: REFCAT_DEMO,
    origen: ORIGEN_PARCELA.WFS,
    recintos: [crearRecinto(ANILLO_EXTERIOR_9398516VK3799G, TIPO_RECINTO.EXTERIOR)],
    geometriaOficial: [crearRecinto(ANILLO_EXTERIOR_9398516VK3799G, TIPO_RECINTO.EXTERIOR)],
  })
}

// ── Parcela sintética con hueco ──────────────────────────────────────────────
//
// Aviso para que la UI pueda rotular este dataset como lo que es: NO es la
// parcela real anterior con un patio inventado encima (eso sería maquillar un
// dato real), sino una parcela DISTINTA, enteramente inventada, pensada solo
// para poder ver en pantalla un hueco interior y su rótulo "HUECO 1".
export const AVISO_DEMO_HUECO_SINTETICO =
  'Parcela SINTÉTICA de demostración (no procede del Catastro): se usa únicamente ' +
  'para ilustrar un hueco/patio interior y el recorte de anillos anidados.'

// Exterior SINTÉTICO (rectángulo de 24 × 16 m), en el entorno de
// `referencePoint` del fixture F00 ([439250.35, 4479664.55]) pero desplazado
// para que no se solape con la parcela real de arriba. UTM EPSG:25830 (huso
// 30). Anillo ABIERTO.
const ANILLO_EXTERIOR_SINTETICO = [
  [439300, 4479650],
  [439324, 4479650],
  [439324, 4479666],
  [439300, 4479666],
]

// Hueco SINTÉTICO (rectángulo de 6 × 6 m), centrado y claramente contenido
// dentro de `ANILLO_EXTERIOR_SINTETICO` (margen ≥ 3 m por cada lado). Anillo
// ABIERTO.
const ANILLO_HUECO_SINTETICO = [
  [439309, 4479655],
  [439315, 4479655],
  [439315, 4479661],
  [439309, 4479661],
]

/**
 * Parcela de demostración SINTÉTICA (inventada, no es la parcela real del
 * Catastro) con un exterior y un hueco interior, para poder ver en el
 * navegador el rótulo "HUECO 1" y el recorte de anillos anidados.
 *
 * NO es {@link parcelaDemo} con un patio añadido: es un dataset
 * independiente. Sin `refcat` (queda `null`) y con `origen: 'LIST'` (dato
 * tecleado a mano, no descargado de ningún servicio) para que también a nivel
 * de datos quede claro que no es un dato oficial del Catastro. Para el aviso
 * textual que la UI puede mostrar, ver {@link AVISO_DEMO_HUECO_SINTETICO}.
 *
 * - Construida con `crearParcela`/`crearRecinto` (nunca a mano): mismos
 *   invariantes garantizados por construcción que en `parcelaDemo`.
 * - Cada llamada construye un POJO NUEVO e independiente.
 *
 * @returns {object} Parcela (ver `model/parcela.js#crearParcela`) con dos
 *   recintos: `recintos[0].tipo === 'EXTERIOR'` y `recintos[1].tipo === 'HUECO'`,
 *   el hueco contenido en el exterior.
 */
export function parcelaDemoConHueco() {
  return crearParcela({
    idLocal: 'demo-sintetica-hueco',
    origen: ORIGEN_PARCELA.LIST,
    recintos: [
      crearRecinto(ANILLO_EXTERIOR_SINTETICO, TIPO_RECINTO.EXTERIOR),
      crearRecinto(ANILLO_HUECO_SINTETICO, TIPO_RECINTO.HUECO),
    ],
  })
}
