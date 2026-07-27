// scripts/smoke-navegador/06-generar-gml.js — F04 · Tarea T7.2.
//
// ── QUÉ MIDE ────────────────────────────────────────────────────────────────
// La CADENA DE ENTREGA de F04 de extremo a extremo, en un navegador de verdad:
// pulsar «Generar GML» → `cablearGeneracionGml` valida y serializa → `Blob` con
// los bytes → `URL.createObjectURL` → anchor sintético con `download` → `click()`
// → revocación. Es lo ÚNICO que jsdom NO cubre: allí `Blob`, `URL` y el anchor
// son dobles del entorno de test, y lo que aquí se comprueba son los BYTES
// REALES que un Chromium de verdad mete en el fichero.
//
// Sobre el contenido capturado se miden, y se DEVUELVEN COMO MEDIDAS (no como un
// `ok` pelado), las seis cosas que un GML mal entregado rompe en silencio:
//
//   1. **UTF-8 de verdad.** El `ArrayBuffer` del Blob se decodifica con
//      `TextDecoder('utf-8', {fatal:true})`: si los bytes no fueran UTF-8 válido
//      LANZA, y eso es lo que se comprueba. Además la declaración XML tiene que
//      decir `UTF-8` (la spec de F04: «encoding declarado == bytes reales»).
//      ⚠️ Ver `utf8.comprobacionVacua` y la advertencia que emite: hoy el GML que
//      produce la app NO tiene ni un carácter no ASCII, así que el decodificador
//      fatal no puede fallar aunque la codificación estuviera rota. Para que la
//      afirmación «el Blob escribe UTF-8» no se quede en el aire, se mide aparte
//      un CONTROL (`utf8.control`) con una cadena acentuada por el MISMO camino
//      (`new Blob([texto]).arrayBuffer()`). El control NO es la salida de la app y
//      el veredicto lo dice.
//   2. **`posList` a 2 decimales.** Todos los valores casan `/^-?\d+\.\d{2}$/`
//      —incluidos los ceros no significativos (`4479678.00`), que es donde el
//      proyecto se aparta a propósito del fixture—, el número de valores es PAR y
//      el `count` declarado son PARES (`valores / 2`), no números. Confundir esas
//      dos cosas es el rechazo más fácil de cometer del proyecto.
//   3. **Anillo cerrado.** El primer par se repite al final, en cada anillo.
//   4. **`areaValue` cuadra con la geometría EMITIDA.** Es entero (override O6) y
//      se contrasta contra el shoelace calculado AQUÍ sobre las coordenadas que
//      van escritas en el fichero (exterior menos huecos), con tolerancia de
//      ±1 m². El guion no importa nada del proyecto —corre dentro de la página—,
//      así que la fórmula es una segunda implementación independiente: si
//      `gml/anillos.js` y esta cuenta discreparan, el smoke lo dice.
//   5. **Estructura.** Raíz `FeatureCollection` en el namespace de WFS 2.0 con
//      `<member>` (y NUNCA `gml:FeatureCollection`, que es el dialecto viejo),
//      los `srsName` en URI OGC y ni una sola URN en todo el documento, y ningún
//      `gml:boundedBy` ni `cp:zoning`.
//   6. **El renglón de estado** dice que se ha descargado y NOMBRA el fichero, y
//      ese nombre coincide con el `download` real del anchor y con la marca de
//      tiempo del `cp:beginLifespanVersion` de dentro (`gml/descargar.js`
//      promete que el nombre y el contenido no pueden discrepar).
//
// Y dos comprobaciones cruzadas que solo existen porque aquí hay app entera:
// la superficie que el usuario LEE en la ficha del pie contra la que se calcula
// del fichero, y las detecciones del serializador contra las tarjetas del panel
// de avisos (regla de oro 1: si el fichero no es el dibujo, se dice).
//
// ── QUÉ **NO** PUEDE MEDIR ──────────────────────────────────────────────────
//   · **Que el fichero aterrice en el disco.** Se intercepta el Blob EN LA PÁGINA
//     porque `/browse` no recoge con comodidad una descarga de blob de la carpeta
//     de descargas. La descarga real SÍ se dispara (el envoltorio devuelve la URL
//     de verdad y el `click()` del anchor sigue su curso), pero este guion mide el
//     CONTENIDO, no el aterrizaje. Abrir el fichero descargado a mano es checklist
//     humano.
//   · **Que el GML lo acepte el IVG.** Eso es el XSD (`npm run validar:xsd`) y la
//     Sede. Aquí se comprueba forma y coherencia, no conformidad completa.
//   · **La consola.** El buffer vive en el demonio de `browse`, no en la página:
//     lo mide `$B console --errors` (ver `GUION.md` §6).
//   · **El teclado.** Pulsar el botón con Enter/Espacio es checklist humano.
//
// ── POR QUÉ CLICK SINTÉTICO Y NO `$B click` ─────────────────────────────────
// La regla del runbook es preferir `$B click` (evento *trusted* de Playwright)
// cuando un selector CSS baste, y aquí el selector BASTA. Lo que no se puede
// partir es el resto: hay que envolver `URL.createObjectURL` ANTES del click y
// leer el Blob DESPUÉS, y `descargarGml` revoca la URL en el mismo turno. Con
// `$B click` eso son tres comandos y un global de página donde aparcar el Blob
// entre uno y otro; con `boton.click()` es UNA llamada y UN veredicto
// serializable. El manejador es un `addEventListener('click', …)` de
// `cablearGeneracionGml`: un click sintético lo dispara igual (nadie comprueba
// `isTrusted`), y el botón `disabled` tampoco despacharía el evento, así que la
// vía sigue pasando por el estado real de la UI.
// La comprobación con evento *trusted* la hace el runbook con
// {@link SELECTOR_BOTON} (ver `GUION.md` §12), que es único en la página.
//
// ── QUÉ SE ENVUELVE, Y QUE SE RESTAURA TODO ─────────────────────────────────
// Tres cosas, durante el click y solo durante el click:
//   · `URL.createObjectURL` — para quedarse con el `Blob`. Llama a la original y
//     devuelve su URL: la descarga de verdad no se altera.
//   · `URL.revokeObjectURL` — para comprobar que `gml/descargar.js` cumple su
//     promesa de revocar SIEMPRE, y con la misma URL que creó.
//   · `document.createElement` — para quedarse con el anchor y leer su `download`
//     real (el nodo se retira del DOM en el mismo turno; el objeto sobrevive).
// Las tres se restauran en un `finally`, y el veredicto DECLARA que se
// restauraron (`captura.restaurado`). Un guion de humo que deja la página
// parcheada convierte en mentira todo lo que se mida después de él.
//
// ── HOOKS SEMÁNTICOS QUE USA (y por qué son estables) ───────────────────────
//   · `[data-accion="generar-gml"]` y `[data-estado="generar-gml"]` — son los dos
//     literales que `app/main.js` EXPORTA (`SELECTOR_BOTON_GML`,
//     `SELECTOR_ESTADO_GML`) y contrato con `index.html`.
//   · `[data-ficha="superficie"]` y `[data-ficha="vertices"]` — ficha del pie,
//     contrato de `index.html`.
//   · `.gml-aviso` / `.gml-aviso-texto` / `.gml-aviso-veces` — panel de avisos
//     (`app/avisos.js`); `.gml-aviso-veces` NO existe cuando `veces === 1`.
//   · `?demo=hueco` — el conmutador de dataset de `app/main.js`.
//
// ── ESTADO EN QUE DEJA LA APP ───────────────────────────────────────────────
// No toca la geometría, ni las capas, ni el encuadre. Deja el renglón de estado
// escrito («Descargado «…».») y, con `?demo=hueco`, dos tarjetas más en el panel
// de avisos: son la salida NORMAL de haber pulsado el botón, no residuo del
// guion. Se puede volver a lanzar sin recargar (el segundo GML es idéntico salvo
// la marca de tiempo), pero ver la nota de `geometriaIntacta` más abajo.
//
// ── NOTAS DE EJECUCIÓN ──────────────────────────────────────────────────────
//   · Se lanza con `$B eval scripts/smoke-navegador/06-generar-gml.js`, DOS veces:
//     sobre `…/concretagml/` (parcela real) y sobre `…/concretagml/?demo=hueco`
//     (sintética). El guion detecta él solo cuál de los dos es y ajusta lo que
//     espera; no hay que pasarle nada.
//   · **Página recién cargada.** `geometriaIntacta` contrasta el `areaValue` y el
//     nº de vértices contra los del dataset de arranque: si antes se ha corrido
//     `03-arrastre.js` (que deja la geometría movida A PROPÓSITO) o se ha editado
//     una celda, este guion FALLA y lo dice. Es deliberado: el `areaValue` de
//     referencia es de las pocas cifras exactas que se pueden afirmar de F04.
//   · `browse` envuelve el fichero en `(async()=>{ … })()` PORQUE contiene `await`
//     real (`blob.arrayBuffer()`); de ahí que el `return` de nivel superior sea
//     legal. Si algún día se quitaran todos los `await`, el `return` pasaría a ser
//     un SyntaxError: no los quites.
//   · No hay `import`: `page.evaluate` no resuelve módulos. Los helpers están
//     duplicados entre guiones A PROPÓSITO.

/** Botón «Generar GML». Copia de `app/main.js#SELECTOR_BOTON_GML`. */
const SELECTOR_BOTON = '[data-accion="generar-gml"]'

/** Renglón `role="status"`. Copia de `app/main.js#SELECTOR_ESTADO_GML`. */
const SELECTOR_RENGLON = '[data-estado="generar-gml"]'

/** Valor de `?demo=` que carga el dataset sintético con hueco (`app/main.js`). */
const DEMO_HUECO = 'hueco'

/** Namespace de WFS 2.0: el de la RAÍZ y el de `<member>` (override O3). */
const NS_WFS = 'http://www.opengis.net/wfs/2.0'

/** Namespace de GML 3.2. */
const NS_GML = 'http://www.opengis.net/gml/3.2'

/** Namespace de INSPIRE Cadastral Parcels 4.0. */
const NS_CP = 'http://inspire.ec.europa.eu/schemas/cp/4.0'

/**
 * `srsName` que debe llevar el documento: URI OGC, NUNCA la URN (override O2).
 * Los dos datasets de demostración están en EPSG:25830 (`app/demo-datos.js`).
 */
const SRS_NAME_ESPERADO = 'http://www.opengis.net/def/crs/EPSG/0/25830'

/** Cuántas veces aparece el `srsName`: MultiSurface, Surface y Point. */
const SRS_NAME_APARICIONES = 3

/** Un valor de `posList`: entero con signo opcional y EXACTAMENTE 2 decimales. */
const RE_COORD = /^-?\d+\.\d{2}$/

/** Declaración XML del prólogo (`gml/serialize-cp.js#DECLARACION_XML`). */
const RE_DECLARACION_UTF8 = /^<\?xml version="1\.0" encoding="UTF-8"\?>/

/** Nombre del fichero: `parcela_<referencia>_<AAAA-MM-DDTHH-mm-ss>.gml`. */
const RE_NOMBRE_FICHERO = /^parcela_([A-Za-z0-9-]+)_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.gml$/

/** Tipo MIME del Blob (`gml/descargar.js#TIPO_MIME_GML`). */
const TIPO_MIME_GML = 'application/gml+xml;charset=utf-8'

/** Tolerancia entre el `areaValue` publicado y el shoelace de lo emitido. */
const TOLERANCIA_AREA_M2 = 1

/** Cadena de CONTROL para demostrar que el camino del Blob escribe UTF-8. */
const CONTROL_NO_ASCII = 'áéñ·²'

/**
 * Lo que cada dataset de `app/demo-datos.js` debe producir, RECIÉN CARGADA la
 * página. Copia deliberada (este guion no puede importar el módulo): si divergen,
 * el smoke debe FALLAR y decir en qué.
 *   · `real`  — parcela 9398516VK3799G del Catastro: 15 vértices, 1535,87 m².
 *   · `hueco` — sintética 24×16 m con un patio de 6×6 m: 384 − 36 = 348 m².
 * `deteccionesEsperadas` son las que el serializador publica en el panel: el
 * dataset con hueco lleva el exterior en sentido contrario al que exige el GML
 * (ORIENTACION_NORMALIZADA) y su centroide propuesto no se aporta, así que el
 * punto de referencia se calcula (PUNTO_REFERENCIA_RECALCULADO).
 */
const DATASETS = {
  real: {
    id: 'real',
    descripcion: 'parcela REAL del Catastro 9398516VK3799G',
    url: '(sin ?demo)',
    segmentoNombre: '9398516VK3799G',
    verticesAbiertos: [15],
    conInterior: false,
    areaValue: 1536,
    superficieFicha: 1535.87,
    deteccionesEsperadas: 0,
  },
  hueco: {
    id: 'hueco',
    descripcion: 'parcela SINTÉTICA con hueco (sin referencia catastral)',
    url: '?demo=hueco',
    // Sin `refcat`: `nombreFicheroGml` pone la marca honesta, no la identidad
    // interna (`gml/descargar.js#MARCA_SIN_REFCAT`).
    segmentoNombre: 'sin-referencia',
    verticesAbiertos: [4, 4],
    conInterior: true,
    areaValue: 348,
    superficieFicha: 348,
    deteccionesEsperadas: 2,
  },
}

const t0 = performance.now()

/** Lo que TUMBA el smoke. */
const problemas = []

/** Lo que hay que saber pero NO tumba el smoke (limitaciones de la medida). */
const advertencias = []

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms))

/** Redondeo a `n` decimales para no publicar 1535.8700000000001 en el veredicto. */
const redondear = (v, n = 2) => Number(v.toFixed(n))

// ── Localización de la UI ────────────────────────────────────────────────────

const idDataset = new URLSearchParams(location.search).get('demo') === DEMO_HUECO ? 'hueco' : 'real'
const esperado = DATASETS[idDataset]

const boton = document.querySelector(SELECTOR_BOTON)
const renglon = document.querySelector(SELECTOR_RENGLON)

if (boton === null || renglon === null) {
  return {
    guion: '06-generar-gml',
    feature: 'F04',
    dataset: idDataset,
    ok: false,
    problemas: [
      `La cáscara no tiene ${boton === null ? SELECTOR_BOTON : SELECTOR_RENGLON}: el ` +
        'cableado de F04 es contrato con index.html y sin ese nodo no hay nada que medir.',
    ],
  }
}

/** Peso del panel de avisos: tarjetas + repeticiones (`×N`). */
function pesoAvisos() {
  const tarjetas = [...document.querySelectorAll('#avisos .gml-aviso')]
  return {
    tarjetas: tarjetas.length,
    peso: tarjetas.reduce((total, tarjeta) => {
      const veces = tarjeta.querySelector('.gml-aviso-veces')
      // `.gml-aviso-veces` NO existe cuando `veces === 1` (contrato de app/avisos.js).
      const n = veces === null ? 1 : Number(veces.textContent.replace(/\D/g, '')) || 1
      return total + n
    }, 0),
    textos: tarjetas.map((tarjeta) => {
      const texto = tarjeta.querySelector('.gml-aviso-texto')
      return texto === null ? null : texto.textContent.slice(0, 90)
    }),
  }
}

/** Número que muestra la ficha del pie («1.535,87 m²» → 1535.87). */
function numeroDeFicha(selector) {
  const el = document.querySelector(selector)
  if (el === null) return null
  const crudo = el.textContent.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(crudo)
  return Number.isFinite(n) ? n : null
}

const avisosAntes = pesoAvisos()
const superficieFicha = numeroDeFicha('[data-ficha="superficie"]')
const verticesFicha = numeroDeFicha('[data-ficha="vertices"]')

const estadoPrevio = {
  botonDeshabilitado: boton.disabled,
  textoBoton: boton.textContent.trim(),
  renglon: renglon.textContent,
  renglonEnError: renglon.classList.contains('gml-accion-estado--error'),
  superficieFicha,
  verticesFicha,
  tarjetasDeAvisos: avisosAntes.tarjetas,
}

if (boton.disabled) {
  // Un botón deshabilitado NO despacha `click`, así que aquí no hay nada que
  // medir: el recorrido de F04 ni siquiera empieza. Y el renglón tiene que estar
  // diciendo por qué (`app/main.js#bloquear`), así que se devuelve tal cual.
  return {
    guion: '06-generar-gml',
    feature: 'F04',
    dataset: idDataset,
    datasetDescripcion: esperado.descripcion,
    ok: false,
    estadoPrevio,
    problemas: [
      'El botón «Generar GML» está DESHABILITADO con el dataset de demostración: la ' +
        'validación de F02 dice que la parcela no se puede generar. Renglón: ' +
        `${JSON.stringify(renglon.textContent)}.`,
    ],
    ms: Math.round(performance.now() - t0),
  }
}

// ── Interceptación EN LA PÁGINA y pulsación del botón ────────────────────────

const crearUrlOriginal = URL.createObjectURL
const revocarUrlOriginal = URL.revokeObjectURL
const crearElementoOriginal = document.createElement
const teniaCreateElementPropio = Object.prototype.hasOwnProperty.call(document, 'createElement')

/** @type {Blob[]} */
const blobs = []
/** @type {string[]} */
const hrefsCreados = []
/** @type {string[]} */
const hrefsRevocados = []
/** @type {HTMLAnchorElement[]} */
const anclas = []

URL.createObjectURL = function (objeto) {
  const href = crearUrlOriginal.call(URL, objeto)
  blobs.push(objeto)
  hrefsCreados.push(href)
  return href
}
URL.revokeObjectURL = function (href) {
  hrefsRevocados.push(href)
  return revocarUrlOriginal.call(URL, href)
}
document.createElement = function (etiqueta, ...resto) {
  const el = crearElementoOriginal.call(document, etiqueta, ...resto)
  if (String(etiqueta).toLowerCase() === 'a') anclas.push(el)
  return el
}

let excepcionAlPulsar = null
try {
  // El gesto: se pulsa el BOTÓN, no se llama a ninguna función interna.
  boton.click()
} catch (error) {
  excepcionAlPulsar = `${error.name}: ${error.message}`
} finally {
  URL.createObjectURL = crearUrlOriginal
  URL.revokeObjectURL = revocarUrlOriginal
  if (teniaCreateElementPropio) document.createElement = crearElementoOriginal
  else delete document.createElement
}

// El recorrido de `cablearGeneracionGml` es SÍNCRONO; el margen es para que el
// renglón y el panel hayan pintado antes de leerlos.
await dormir(150)

const restaurado =
  URL.createObjectURL === crearUrlOriginal &&
  URL.revokeObjectURL === revocarUrlOriginal &&
  document.createElement === crearElementoOriginal

const ancla = anclas.find((a) => typeof a.download === 'string' && a.download.length > 0) || null

const captura = {
  excepcionAlPulsar,
  blobsCapturados: blobs.length,
  urlsCreadas: hrefsCreados.length,
  urlsRevocadas: hrefsRevocados.length,
  // `gml/descargar.js` promete revocar SIEMPRE, y la misma URL que creó.
  revocaLaQueCreo:
    hrefsCreados.length === hrefsRevocados.length &&
    hrefsCreados.every((href, i) => href === hrefsRevocados[i]),
  anclasCreadas: anclas.length,
  nombreDelAncla: ancla === null ? null : ancla.download,
  anclaFueraDelDom: ancla === null ? null : !document.body.contains(ancla),
  restaurado,
}

if (excepcionAlPulsar !== null) {
  problemas.push(`Pulsar «Generar GML» ha LANZADO: ${excepcionAlPulsar}.`)
}
if (!restaurado) {
  problemas.push(
    'El guion NO ha restaurado los envoltorios de `URL.createObjectURL` / ' +
      '`URL.revokeObjectURL` / `document.createElement`: la página queda parcheada y ' +
      'cualquier medida posterior es sospechosa.',
  )
}
if (blobs.length !== 1) {
  problemas.push(
    `Se esperaba EXACTAMENTE 1 llamada a URL.createObjectURL al pulsar el botón y ha ` +
      `habido ${blobs.length}. Renglón: ${JSON.stringify(renglon.textContent)}.`,
  )
}
if (blobs.length > 0 && !captura.revocaLaQueCreo) {
  problemas.push(
    `La URL de blob NO se ha revocado (o se ha revocado otra): creadas ` +
      `${JSON.stringify(hrefsCreados)}, revocadas ${JSON.stringify(hrefsRevocados)}. ` +
      '`gml/descargar.js` promete revocar SIEMPRE, en el `finally` más interno.',
  )
}

const renglonTexto = renglon.textContent
const renglonEnError = renglon.classList.contains('gml-accion-estado--error')

if (blobs.length === 0) {
  return {
    guion: '06-generar-gml',
    feature: 'F04',
    dataset: idDataset,
    datasetDescripcion: esperado.descripcion,
    ok: false,
    estadoPrevio,
    captura,
    renglon: { texto: renglonTexto, enError: renglonEnError },
    avisos: pesoAvisos(),
    problemas,
    ms: Math.round(performance.now() - t0),
  }
}

// ── 1 · Los BYTES: UTF-8 de verdad ──────────────────────────────────────────

const blob = blobs[0]
const buffer = await blob.arrayBuffer()

let texto = null
let errorDecodificacion = null
try {
  // `fatal: true` LANZA ante cualquier secuencia que no sea UTF-8 válido. Es la
  // única forma de afirmar algo sobre los BYTES: mirar `blob.type` solo
  // comprobaría lo que el fichero DICE de sí mismo.
  texto = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
} catch (error) {
  errorDecodificacion = `${error.name}: ${error.message}`
}

// CONTROL, por el MISMO camino (string → Blob → ArrayBuffer) pero con una cadena
// que sí tiene caracteres no ASCII. No es la salida de la app: es lo que impide
// que el punto 1 sea una afirmación vacía cuando el GML sale ASCII puro.
const bytesControl = [...new Uint8Array(await new Blob([CONTROL_NO_ASCII]).arrayBuffer())]
const bytesEsperadosControl = [...new TextEncoder().encode(CONTROL_NO_ASCII)]

const noAscii = texto === null ? [] : [...texto].filter((c) => c.codePointAt(0) > 127)

const utf8 = {
  tipoMimeDelBlob: blob.type,
  tamanoBytes: buffer.byteLength,
  decodificaFatalSinLanzar: errorDecodificacion === null,
  errorDecodificacion,
  declaracionDiceUtf8: texto !== null && RE_DECLARACION_UTF8.test(texto),
  caracteresNoAscii: noAscii.length,
  ejemplosNoAscii: [...new Set(noAscii)].slice(0, 6),
  // Si el documento es ASCII puro, `fatal: true` no puede fallar: la medida 1 no
  // demuestra nada por sí sola y hay que decirlo.
  comprobacionVacua: noAscii.length === 0,
  control: {
    queEs:
      'CONTROL del guion, NO salida de la app: misma cadena por el mismo camino ' +
      '(string → Blob → ArrayBuffer) con caracteres no ASCII.',
    cadena: CONTROL_NO_ASCII,
    bytes: bytesControl,
    bytesEsperadosUtf8: bytesEsperadosControl,
    esUtf8: bytesControl.join(',') === bytesEsperadosControl.join(','),
  },
}

if (texto === null) {
  problemas.push(
    `Los bytes del Blob NO son UTF-8 válido: TextDecoder('utf-8', {fatal:true}) ha ` +
      `lanzado ${errorDecodificacion}. El GML declara UTF-8 en su prólogo, así que el ` +
      'fichero se estaría contradiciendo a sí mismo (spec de F04).',
  )
  return {
    guion: '06-generar-gml',
    feature: 'F04',
    dataset: idDataset,
    ok: false,
    estadoPrevio,
    captura,
    utf8,
    problemas,
    ms: Math.round(performance.now() - t0),
  }
}

if (!utf8.declaracionDiceUtf8) {
  problemas.push(
    `La declaración XML no dice UTF-8. Empieza por ${JSON.stringify(texto.slice(0, 60))}.`,
  )
}
if (blob.type !== TIPO_MIME_GML) {
  problemas.push(
    `El Blob no lleva el tipo MIME de F04: ${JSON.stringify(blob.type)} en vez de ` +
      `${JSON.stringify(TIPO_MIME_GML)}.`,
  )
}
if (!utf8.control.esUtf8) {
  problemas.push(
    `El CONTROL de codificación falla: new Blob(['${CONTROL_NO_ASCII}']) ha dado los bytes ` +
      `${JSON.stringify(bytesControl)} en vez de los UTF-8 ` +
      `${JSON.stringify(bytesEsperadosControl)}. Este navegador no está escribiendo UTF-8.`,
  )
}
if (utf8.comprobacionVacua) {
  advertencias.push(
    'El GML generado por la app NO tiene ni un carácter no ASCII (0 de ' +
      `${texto.length}), así que TextDecoder('utf-8',{fatal:true}) no podía fallar: la ` +
      'comprobación de codificación sobre la salida real es VACUA. Motivo: `app/main.js` ' +
      'llama a `serializarParcelaCp` sin `comentario`, y el resto del documento ' +
      '(namespaces, ids, coordenadas) es ASCII por construcción. Lo que sostiene hoy la ' +
      'afirmación «el Blob escribe UTF-8» es `utf8.control`, que NO es salida de la app. ' +
      'Si algún día el prólogo lleva un comentario acentuado, esta advertencia desaparece sola.',
  )
}

// ── 2 · Parseo y estructura ─────────────────────────────────────────────────

const doc = new DOMParser().parseFromString(texto, 'application/xml')
const errorDeParseo = doc.querySelector('parsererror')
if (errorDeParseo !== null) {
  problemas.push(
    `El GML descargado NO está bien formado: ${errorDeParseo.textContent.trim().slice(0, 240)}.`,
  )
  return {
    guion: '06-generar-gml',
    feature: 'F04',
    dataset: idDataset,
    ok: false,
    estadoPrevio,
    captura,
    utf8,
    muestra: texto.slice(0, 400),
    problemas,
    ms: Math.round(performance.now() - t0),
  }
}

const raiz = doc.documentElement
const miembros = doc.getElementsByTagNameNS(NS_WFS, 'member')
const srsNames = [...doc.querySelectorAll('[srsName]')].map((el) => el.getAttribute('srsName'))
const boundedBy = doc.getElementsByTagNameNS(NS_GML, 'boundedBy')
const zoning = doc.getElementsByTagNameNS(NS_CP, 'zoning')
const interiores = doc.getElementsByTagNameNS(NS_GML, 'interior')

const estructura = {
  raizNombreLocal: raiz.localName,
  raizNamespace: raiz.namespaceURI,
  raizPrefijo: raiz.prefix,
  esFeatureCollectionWfs20: raiz.localName === 'FeatureCollection' && raiz.namespaceURI === NS_WFS,
  // El dialecto viejo. Se busca en el TEXTO además de en el árbol: un
  // `gml:FeatureCollection` con el prefijo mal declarado no aparecería como tal
  // en el DOM y sí en el fichero que ve el validador.
  sinGmlFeatureCollection: !texto.includes('<gml:FeatureCollection'),
  miembros: miembros.length,
  numberMatched: raiz.getAttribute('numberMatched'),
  numberReturned: raiz.getAttribute('numberReturned'),
  srsNames,
  srsNamesEnUriOgc: srsNames.length > 0 && srsNames.every((s) => s === SRS_NAME_ESPERADO),
  // Override O2: la URN (`urn:ogc:def:crs:EPSG::25830`) es rechazo. Se busca en
  // TODO el documento, no solo en los `srsName`.
  ningunaUrn: !/urn:/i.test(texto),
  gmlBoundedBy: boundedBy.length,
  cpZoning: zoning.length,
  interiores: interiores.length,
  beginLifespanVersion: (() => {
    const el = doc.getElementsByTagNameNS(NS_CP, 'beginLifespanVersion')[0]
    return el === undefined ? null : el.textContent
  })(),
  localId: (() => {
    const el = doc.getElementsByTagNameNS('http://inspire.ec.europa.eu/schemas/base/3.3', 'localId')[0]
    return el === undefined ? null : el.textContent
  })(),
  areaValue: (() => {
    const el = doc.getElementsByTagNameNS(NS_CP, 'areaValue')[0]
    return el === undefined ? null : el.textContent
  })(),
  uomArea: (() => {
    const el = doc.getElementsByTagNameNS(NS_CP, 'areaValue')[0]
    return el === undefined ? null : el.getAttribute('uom')
  })(),
}

if (!estructura.esFeatureCollectionWfs20) {
  problemas.push(
    `La raíz no es {${NS_WFS}}FeatureCollection sino ` +
      `{${raiz.namespaceURI}}${raiz.localName} (override O3).`,
  )
}
if (!estructura.sinGmlFeatureCollection) {
  problemas.push(
    'El documento contiene `<gml:FeatureCollection`: es el dialecto viejo y el IVG lo ' +
      'rechaza (override O3).',
  )
}
if (estructura.miembros !== 1) {
  problemas.push(
    `Se esperaba 1 <member> en el namespace de WFS 2.0 y hay ${estructura.miembros}.`,
  )
}
if (srsNames.length !== SRS_NAME_APARICIONES) {
  problemas.push(
    `Se esperaban ${SRS_NAME_APARICIONES} atributos srsName (MultiSurface, Surface y Point) ` +
      `y hay ${srsNames.length}: ${JSON.stringify(srsNames)}.`,
  )
}
if (!estructura.srsNamesEnUriOgc) {
  problemas.push(
    `Algún srsName no es la URI OGC ${SRS_NAME_ESPERADO}: ${JSON.stringify(srsNames)} ` +
      '(override O2).',
  )
}
if (!estructura.ningunaUrn) {
  problemas.push(
    'El documento contiene una URN (`urn:…`). El override O2 exige URI OGC en los srsName ' +
      'y la URN es rechazo del IVG.',
  )
}
if (estructura.gmlBoundedBy > 0) {
  problemas.push(`El documento emite ${estructura.gmlBoundedBy} gml:boundedBy, y no debe emitir ninguno.`)
}
if (estructura.cpZoning > 0) {
  problemas.push(`El documento emite ${estructura.cpZoning} cp:zoning, y no debe emitir ninguno.`)
}
if (esperado.conInterior && estructura.interiores !== 1) {
  problemas.push(
    `El dataset con hueco debe producir EXACTAMENTE 1 gml:interior y ha producido ` +
      `${estructura.interiores}: el patio no ha llegado al fichero.`,
  )
}
if (!esperado.conInterior && estructura.interiores !== 0) {
  problemas.push(
    `La parcela real no tiene huecos y el fichero trae ${estructura.interiores} gml:interior.`,
  )
}

// ── 3 · posList: 2 decimales, pares, count y cierre ─────────────────────────

const posLists = [...doc.getElementsByTagNameNS(NS_GML, 'posList')]
const anillos = posLists.map((pos, i) => {
  // posList → gml:LinearRing → gml:exterior | gml:interior
  const abuelo = pos.parentElement === null ? null : pos.parentElement.parentElement
  const rol = abuelo === null ? null : abuelo.localName
  const valores = pos.textContent.trim().split(/\s+/)
  const countDeclarado = Number(pos.getAttribute('count'))
  const dosDecimales = valores.every((v) => RE_COORD.test(v))
  const numeroPar = valores.length % 2 === 0
  const pares = []
  for (let j = 0; j + 1 < valores.length; j += 2) {
    pares.push([Number(valores[j]), Number(valores[j + 1])])
  }
  const primero = pares[0]
  const ultimo = pares[pares.length - 1]
  const cerrado =
    pares.length > 1 && primero[0] === ultimo[0] && primero[1] === ultimo[1]

  const fila = {
    indice: i,
    rol,
    srsDimension: pos.getAttribute('srsDimension'),
    countDeclarado,
    valores: valores.length,
    pares: pares.length,
    // El `count` es el número de PARES, no de números: el error más fácil de
    // cometer aquí y rechazo directo.
    countSonPares: countDeclarado === valores.length / 2,
    numeroDeValoresPar: numeroPar,
    dosDecimalesTodos: dosDecimales,
    ejemplosMalFormados: valores.filter((v) => !RE_COORD.test(v)).slice(0, 5),
    cerrado,
    primerPar: primero,
    ultimoPar: ultimo,
    verticesAbiertos: pares.length - 1,
  }

  if (!numeroPar) {
    problemas.push(`El posList ${i} (${rol}) tiene ${valores.length} valores: no es par.`)
  }
  if (!dosDecimales) {
    problemas.push(
      `El posList ${i} (${rol}) tiene valores que NO están a 2 decimales exactos: ` +
        `${JSON.stringify(fila.ejemplosMalFormados)} (regla de oro 11).`,
    )
  }
  if (!fila.countSonPares) {
    problemas.push(
      `El posList ${i} (${rol}) declara count="${countDeclarado}" y tiene ` +
        `${valores.length} valores (= ${valores.length / 2} pares): el count es el número ` +
        'de PARES, no de números.',
    )
  }
  if (!cerrado) {
    problemas.push(
      `El anillo ${i} (${rol}) NO está cerrado: empieza en ${JSON.stringify(primero)} y ` +
        `acaba en ${JSON.stringify(ultimo)}.`,
    )
  }
  if (fila.srsDimension !== '2') {
    problemas.push(
      `El posList ${i} (${rol}) declara srsDimension="${fila.srsDimension}" y debe ser "2" ` +
        '(el modelo es plano, regla de oro 3).',
    )
  }
  return { fila, pares }
})

const filasAnillos = anillos.map((a) => a.fila)

if (filasAnillos.length !== esperado.verticesAbiertos.length) {
  problemas.push(
    `Se esperaban ${esperado.verticesAbiertos.length} anillo(s) en el ${esperado.descripcion} ` +
      `y hay ${filasAnillos.length}.`,
  )
}
if (filasAnillos.length > 0 && filasAnillos[0].rol !== 'exterior') {
  problemas.push(`El primer anillo del fichero es «${filasAnillos[0].rol}» y debe ser «exterior».`)
}

// ── 4 · areaValue contra el shoelace de LO EMITIDO ──────────────────────────

/**
 * Fórmula del polígono sobre un anillo YA CERRADO. Segunda implementación,
 * independiente de `gml/anillos.js`: si las dos discreparan, el smoke lo dice.
 *
 * @param {Array<[number, number]>} paresCerrados
 * @returns {number}  Área con signo.
 */
function shoelace(paresCerrados) {
  let suma = 0
  for (let i = 0; i + 1 < paresCerrados.length; i += 1) {
    const [x1, y1] = paresCerrados[i]
    const [x2, y2] = paresCerrados[i + 1]
    suma += x1 * y2 - x2 * y1
  }
  return suma / 2
}

const areasPorAnillo = anillos.map((a) => ({
  rol: a.fila.rol,
  areaConSigno: redondear(shoelace(a.pares)),
  // Sentido HORARIO en coordenadas UTM = shoelace negativo. El exterior de un
  // GML del Catastro va horario y los huecos al revés (override O1).
  sentido: shoelace(a.pares) < 0 ? 'horario' : 'antihorario',
}))

const areaExterior = anillos
  .filter((a) => a.fila.rol === 'exterior')
  .reduce((total, a) => total + Math.abs(shoelace(a.pares)), 0)
const areaHuecos = anillos
  .filter((a) => a.fila.rol === 'interior')
  .reduce((total, a) => total + Math.abs(shoelace(a.pares)), 0)
const areaCalculada = areaExterior - areaHuecos

const areaValue = Number(estructura.areaValue)
const diferenciaArea = Math.abs(areaValue - areaCalculada)

const area = {
  areaValuePublicado: areaValue,
  esEntero: Number.isInteger(areaValue),
  uom: estructura.uomArea,
  shoelaceExterior: redondear(areaExterior),
  shoelaceHuecos: redondear(areaHuecos),
  shoelaceNeto: redondear(areaCalculada),
  diferencia: redondear(diferenciaArea),
  toleranciaM2: TOLERANCIA_AREA_M2,
  cuadra: diferenciaArea <= TOLERANCIA_AREA_M2,
  porAnillo: areasPorAnillo,
  // Cruce con lo que el usuario LEE en pantalla: la ficha del pie sale de
  // `geo/area.js` sobre el modelo, y esto de las coordenadas ya redondeadas.
  superficieDeLaFicha: superficieFicha,
  diferenciaConLaFicha:
    superficieFicha === null ? null : redondear(Math.abs(superficieFicha - areaCalculada)),
}

if (!area.esEntero) {
  problemas.push(`cp:areaValue no es entero: ${JSON.stringify(estructura.areaValue)} (override O6).`)
}
if (area.uom !== 'm2') {
  problemas.push(`cp:areaValue lleva uom=${JSON.stringify(area.uom)} y debe ser "m2" (override O6).`)
}
if (!area.cuadra) {
  problemas.push(
    `cp:areaValue (${areaValue} m²) NO cuadra con el shoelace de las coordenadas EMITIDAS ` +
      `(${redondear(areaCalculada)} m²): difieren ${redondear(diferenciaArea)} m², más de la ` +
      `tolerancia de ${TOLERANCIA_AREA_M2} m². El fichero publica una superficie que su propia ` +
      'geometría no sostiene.',
  )
}
if (area.diferenciaConLaFicha !== null && area.diferenciaConLaFicha > TOLERANCIA_AREA_M2) {
  problemas.push(
    `La superficie que muestra la ficha del pie (${superficieFicha} m²) y la que se deduce ` +
      `del GML descargado (${redondear(areaCalculada)} m²) difieren ` +
      `${area.diferenciaConLaFicha} m²: el usuario está viendo en pantalla una cifra que el ` +
      'fichero no confirma.',
  )
}

// ── 5 · Geometría intacta (¿es este el dataset de arranque?) ────────────────

const verticesAbiertos = filasAnillos.map((f) => f.verticesAbiertos)
const geometriaIntacta =
  verticesAbiertos.join(',') === esperado.verticesAbiertos.join(',') &&
  areaValue === esperado.areaValue

if (!geometriaIntacta) {
  problemas.push(
    `La geometría emitida NO es la de arranque del ${esperado.descripcion}: se esperaban ` +
      `vértices ${JSON.stringify(esperado.verticesAbiertos)} y areaValue ` +
      `${esperado.areaValue}, y han salido ${JSON.stringify(verticesAbiertos)} y ${areaValue}. ` +
      'Causa habitual: se ha corrido `03-arrastre.js` antes (deja la geometría movida a ' +
      'propósito) o se ha editado una celda. Recarga la página y repite. Si con la página ' +
      'recién cargada sigue sin cuadrar, hay regresión en `gml/` o en `app/demo-datos.js`.',
  )
}

// ── 6 · El nombre del fichero y el renglón de estado ────────────────────────

const nombre = captura.nombreDelAncla
const casaNombre = nombre === null ? null : RE_NOMBRE_FICHERO.exec(nombre)
const marcaEnElNombre = casaNombre === null ? null : casaNombre[2]
const marcaDelContenido =
  estructura.beginLifespanVersion === null
    ? null
    : estructura.beginLifespanVersion.split(':').join('-')

const fichero = {
  nombre,
  formaValida: casaNombre !== null,
  segmentoReferencia: casaNombre === null ? null : casaNombre[1],
  segmentoReferenciaEsperado: esperado.segmentoNombre,
  marcaDeTiempoDelNombre: marcaEnElNombre,
  beginLifespanVersionDelContenido: estructura.beginLifespanVersion,
  // `gml/descargar.js` promete que el nombre y el contenido no pueden discrepar.
  marcaCoincideConElContenido: marcaEnElNombre !== null && marcaEnElNombre === marcaDelContenido,
  tamanoBytes: buffer.byteLength,
}

if (nombre === null) {
  problemas.push('No se ha podido leer el `download` del anchor: no hay nombre de fichero que comprobar.')
} else {
  if (!fichero.formaValida) {
    problemas.push(
      `El nombre del fichero no tiene la forma parcela_<referencia>_<AAAA-MM-DDTHH-mm-ss>.gml: ` +
        `${JSON.stringify(nombre)}.`,
    )
  }
  if (fichero.segmentoReferencia !== esperado.segmentoNombre) {
    problemas.push(
      `El segmento de referencia del nombre es ${JSON.stringify(fichero.segmentoReferencia)} y ` +
        `debería ser ${JSON.stringify(esperado.segmentoNombre)} en el ${esperado.descripcion}.`,
    )
  }
  if (!fichero.marcaCoincideConElContenido) {
    problemas.push(
      `La marca de tiempo del NOMBRE (${marcaEnElNombre}) no es la del ` +
        `cp:beginLifespanVersion del CONTENIDO (${estructura.beginLifespanVersion}): ` +
        'emparejar el fichero con lo que lleva dentro deja de ser posible.',
    )
  }
}

const estadoRenglon = {
  texto: renglonTexto,
  enError: renglonEnError,
  diceDescargado: /descargad/i.test(renglonTexto),
  nombraElFichero: nombre !== null && renglonTexto.includes(nombre),
}

if (!estadoRenglon.diceDescargado) {
  problemas.push(
    `El renglón [data-estado="generar-gml"] no dice que se haya descargado nada: ` +
      `${JSON.stringify(renglonTexto)}.`,
  )
}
if (!estadoRenglon.nombraElFichero) {
  problemas.push(
    `El renglón de estado no NOMBRA el fichero descargado (${JSON.stringify(nombre)}): ` +
      `dice ${JSON.stringify(renglonTexto)}. Sin el nombre, el usuario no sabe cuál de los ` +
      'ficheros de su carpeta de descargas acaba de generar.',
  )
}
if (renglonEnError) {
  problemas.push(
    'El renglón de estado ha quedado con la clase de ERROR después de una descarga que ' +
      `dice haber salido bien: ${JSON.stringify(renglonTexto)}.`,
  )
}

// ── 7 · Regla de oro 1: las detecciones del serializador llegan al panel ────

const avisosDespues = pesoAvisos()
const avisos = {
  tarjetasAntes: avisosAntes.tarjetas,
  tarjetasDespues: avisosDespues.tarjetas,
  pesoAntes: avisosAntes.peso,
  pesoDespues: avisosDespues.peso,
  deteccionesEsperadas: esperado.deteccionesEsperadas,
  crecio: avisosDespues.peso > avisosAntes.peso,
  textos: avisosDespues.textos,
}

if (esperado.deteccionesEsperadas > 0 && !avisos.crecio) {
  problemas.push(
    `El serializador emite ${esperado.deteccionesEsperadas} detecciones con el ` +
      `${esperado.descripcion} (se invierte el anillo exterior y se recalcula el punto de ` +
      'referencia) y el panel de avisos NO ha crecido: el fichero que baja no es el dibujo ' +
      'que el usuario tiene delante y nadie se lo está contando (regla de oro 1).',
  )
}
if (esperado.deteccionesEsperadas === 0 && avisos.crecio) {
  problemas.push(
    `El ${esperado.descripcion} no debería producir ninguna detección y el panel ha pasado ` +
      `de peso ${avisosAntes.peso} a ${avisosDespues.peso}: ${JSON.stringify(avisosDespues.textos)}.`,
  )
}

// ── Veredicto ───────────────────────────────────────────────────────────────

return {
  guion: '06-generar-gml',
  feature: 'F04',
  tarea: 'T7.2',
  dataset: idDataset,
  datasetDescripcion: esperado.descripcion,
  url: location.href,
  ok: problemas.length === 0,
  selectorTrusted: SELECTOR_BOTON,
  esGestoDeRatonReal: false,
  estadoPrevio,
  captura,
  fichero,
  utf8,
  estructura,
  anillos: filasAnillos,
  area,
  geometriaIntacta,
  renglon: estadoRenglon,
  avisos,
  consola: {
    medidaAqui: false,
    comoSeMide: '$B console --errors (el buffer vive en el demonio de browse, no en la página)',
    reglaEnGuion: 'GUION.md · §6 «Qué cuenta como consola limpia»',
  },
  advertencias,
  problemas,
  ms: Math.round(performance.now() - t0),
}
