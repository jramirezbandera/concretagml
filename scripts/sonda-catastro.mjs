#!/usr/bin/env node
// scripts/sonda-catastro.mjs — F05 · T5D. LA SONDA EN VIVO del contrato del
// servicio del Catastro. Se lanza a mano: `npm run catastro:vivo`.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ QUE ESTA SONDA SALGA ROJA **NO** SIGNIFICA «LA APP ESTÁ ROTA HOY».       ║
// ║                                                                          ║
// ║ Significa: «el servicio del Catastro ha cambiado y los fixtures de       ║
// ║ `test/fixtures/catastro/` ya no representan la realidad».                ║
// ║                                                                          ║
// ║ Son dos cosas distintas y confundirlas lleva a arreglar lo que no es. Un ║
// ║ rojo aquí se atiende leyendo qué comprobación cayó, midiendo el caso a   ║
// ║ mano con `curl`, recapturando ESE fixture (no la tanda) y actualizando   ║
// ║ `PROCEDENCIA.md`. Solo DESPUÉS de eso se toca `services/`, y solo si el  ║
// ║ hecho nuevo lo pide.                                                     ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
//
// La suite de F05 es **100 % offline**: corre contra los fixtures capturados del
// servicio real y un doble de `fetch`. Eso la hace rápida y determinista, y es lo
// correcto — una suite que llamara al Catastro en cada `npm test` sería lenta,
// frágil y contraria al régimen de uso del servicio (override O8 de
// `spec/SPEC.md`: denegación de ~10 días ante uso abusivo).
//
// Pero tiene un agujero evidente: **el día que el Catastro cambie el formato de
// sus respuestas, la suite seguirá verde sobre fixtures viejos**, y nos
// enteraremos por un usuario. Esta sonda es lo que cierra ese agujero.
//
// **No previene el cambio: lo detecta.** Es lo único que puede hacer un cliente
// de un servicio ajeno, y decirlo así evita que alguien espere de ella otra cosa.
//
// ── LO QUE ESTA SONDA NO PUEDE SABER: SI ESTAMOS BLOQUEADOS ──────────────────
//
// El Catastro deniega el servicio ~10 días por uso abusivo y **nadie ha medido
// —ni va a medir— qué contesta a un cliente denegado**: provocarlo es exactamente
// la conducta que se sanciona (hueco declarado en `PROCEDENCIA.md`). Por tanto:
//
//   · Ocho peticiones fallidas con `SIN_RED` son compatibles con estar
//     bloqueados, con estar sin internet, con un DNS caído y con que el servicio
//     esté apagado. **Esta sonda no los distingue, y no finge distinguirlos.**
//   · Por eso «no he podido comprobarlo» es un desenlace de primera clase, con su
//     propio código de salida. Un guion que confunde «no lo sé» con «está mal»
//     acaba ignorándose, y un guardián ignorado no protege de nada.
//
// ── POR QUÉ **NO** ESTÁ EN CI, QUE ES LA DECISIÓN MENOS OBVIA ────────────────
//
// `.github/workflows/deploy.yml` **no la llama, y es a propósito.** Que no venga
// nadie a añadirla creyendo que mejora la cobertura:
//
//   · CI dispararía desde las **IP compartidas de GitHub Actions**. Eso es
//     exactamente el patrón «backend centralizado» contra el que avisa la
//     política anti-bloqueo del Catastro: muchas peticiones de una misma IP que
//     no es la de ningún usuario.
//   · La propiedad que hace viable a esta aplicación es ser **frontend puro**: la
//     carga se reparte por IP de usuario y nadie concentra el tráfico. Meter la
//     sonda en CI tiraría por tierra esa propiedad **y** pondría en riesgo el
//     servicio para todos los usuarios de la app, no solo para el que la lanzó.
//   · Y no compensa: el contrato de un servicio público no cambia entre dos
//     `push`. Esto se mira cada varias semanas, o cuando algo huele raro.
//
// La regla es corta: **la lanza una persona, desde su máquina, cuando quiere
// saber.** Ocho operaciones, una vez.
//
// ── QUÉ COMPRUEBA: EL CONTRATO, NO LOS BYTES ─────────────────────────────────
//
// Que los bytes cambien es NORMAL y no debe dar rojo: el `timeStamp` de cada
// respuesta es distinto, el orden de los miembros puede variar y las coordenadas
// se pueden reeditar en el Catastro. Lo que esta sonda vigila son los HECHOS
// MEDIDOS que `PROCEDENCIA.md` congela y de los que depende el código:
//
//   1. El catálogo de *stored queries* sigue conteniendo las que usa el código
//      —y sigue SIN contener `GetParcelsByBBox` (anti-vacuidad: sin la segunda
//      mitad, un servicio que devolviera una lista vacía aprobaría la primera).
//   2. `GetParcel` sigue devolviendo una colección con su `<member>` dentro.
//   3. `GetNeighbourParcel` sigue incluyendo a la PROPIA parcela.
//   4. Una referencia inexistente sigue contestando HTTP 200 con `ExceptionReport`
//      en `…/ows/1.1` SIN prefijo y `exceptionCode="OperationProcessingFailed"`.
//   5. Un BBOX sin parcelas sigue contestando `ExceptionReport` —no una colección
//      vacía— y con EL MISMO `exceptionCode` que el caso anterior.
//   6. Un BBOX con `count=N` sigue devolviendo N miembros mientras
//      `numberMatched`/`numberReturned` declaran otra cosa.
//   7. `Consulta_RCCOOR` sigue respondiendo a `CoorX`/`CoorY`, la ruta
//      `…coordenadas.coord[0].pc.pc1/pc2` sigue existiendo y suma 14.
//   8. Mandarle `Coordenada_X`/`Coordenada_Y` a ESE endpoint sigue dando error de
//      parámetro — que es lo que justifica la defensa 3 de `_catastro-ovc.js`.
//   9. `Access-Control-Allow-Origin: *` y el `content-type` siguen ahí.
//  10. El byte acentuado sobrevive: la respuesta sigue declarando `ISO-8859-1`
//      con bytes UTF-8, o ha dejado de hacerlo. **Las dos cosas son información.**
//
// Y la número 6 merece un aviso: **si algún día el servicio dejara de mentir en
// sus contadores, esta sonda saldría roja — y sería una BUENA noticia**, no un
// fallo. «Rojo» aquí quiere decir «el contrato ha cambiado», nunca «algo va mal».
//
// ── CÓMO ESTÁ CONSTRUIDA, Y POR QUÉ ASÍ ──────────────────────────────────────
//
//   · **Las expectativas se DERIVAN**, nunca se escriben a mano. La regla es de
//     una línea: **las PETICIONES salen de las URL medidas que documenta
//     `PROCEDENCIA.md`; las EXPECTATIVAS salen de los ficheros de respuesta; y
//     las dos las une el código de PRODUCCIÓN** (`urlGetParcel`, `urlBbox`,
//     `urlRccoor`, `leerColeccion`, `leerRccoor`, `CONSULTAS_ALMACENADAS`…). Si
//     mañana cambia una URL en `services/`, la sonda cambia sola. Si se
//     incumpliera esta regla, la sonda envejecería igual que los fixtures y no
//     serviría para nada — que es el problema que viene a resolver.
//   · **Mismo transporte que la app** (`services/_red.js`), cola incluida. Son
//     ~8 peticiones; que salgan con la misma disciplina que las de producción, y
//     de paso el transporte queda ejercitado contra el servicio real una vez.
//   · **Sin bucles ni reintentos propios.** Ocho operaciones, una vez, y ninguna
//     se repite desde aquí. Lo que sí puede repetirse es lo que repetiría la app:
//     `services/_red.js` reintenta hasta 3 veces con backoff **solo** cuando el
//     `fetch` rechaza o el estado es 5xx —nunca un 2xx, nunca un 4xx—, así que
//     con el servicio caído la tanda puede llegar a 24 peticiones. Es la
//     disciplina de producción, no una decisión de este guion; y cuando ocurre,
//     el veredicto lo dice en `advertencias` y en `transporte.reintentos`.
//   · **Nunca se ramifica sobre el texto libre del `CDATA` de los errores.** Es
//     libre, viene en dos idiomas y trae una errata del propio servicio («No
//     records *founded*»). Se compara `exceptionCode` y nada más; el texto se
//     arrastra al veredicto rotulado como `detalleNoComparado`, para que un
//     humano lo lea y nadie lo confunda con un criterio. (En `services/` hay un
//     guardián de la suite que lo impide; aquí no llega, así que es cosa de quien
//     edite este fichero.)
//
// ── CÓDIGOS DE SALIDA ────────────────────────────────────────────────────────
//   0 → el contrato sigue en pie (todas las comprobaciones en verde)
//   1 → **el contrato ha derivado**: alguna comprobación en rojo
//   2 → **no se ha podido comprobar**: el servicio no contestó, o la sonda no se
//       pudo ni preparar. NO es lo mismo que 1, y por eso no comparten código.
//
// El precedente de este repo pesa aquí: `scripts/validar-xsd.mjs` salía `SALTADO`
// con código 0 y **no llegó a ejecutarse ni una vez** mientras la suite daba
// 1.784 pruebas en verde y la Sede rechazaba el fichero (`spec/SPEC.md` §3.1). Un
// guardián que puede saltarse a sí mismo en silencio no protege de nada: por eso
// aquí «no lo sé» tiene código propio y sale escrito en el veredicto, en vez de
// pasar por un cero.
//
// ── FORMATO DEL VEREDICTO ────────────────────────────────────────────────────
// El de `scripts/smoke-navegador/GUION.md` §1-3: objeto serializable, `ok` NUNCA
// huérfano (cada comprobación lleva su `nota` en castellano, y todo `false` lleva
// su frase), expectativas derivadas y no números mágicos, y **lo que no se puede
// medir se declara por escrito** — aquí, en `noSePuedeSaber`.
//
// Extensión deliberada del contrato mínimo `{ok, comprobaciones, advertencias}`:
//   · `ok` de una comprobación puede ser `null` = «no se ha podido comprobar».
//   · `ok` del veredicto es `true` / `false` / `null`, con el mismo significado.
//   · `noSePuedeSaber` enumera los límites permanentes de la medición.
//   · `peticiones` y `transporte` dejan la evidencia de qué se pidió y qué costó.
//
// Uso: `npm run catastro:vivo` · `npm run catastro:vivo -- --json` (solo el JSON).
//
// Node puro, ESM, sin dependencias nuevas.

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { NS } from '../gml/_comun.js'
import { SIN_NAMESPACE, atributo, hijos, parsearXml } from '../gml/xml.js'
import {
  CATASTRO_OVC_RCCOOR_JSON,
  CLAVE_ENVOLTORIO_RCCOOR,
  LONGITUD_REFCAT_PARCELA,
  PARAM_RCCOOR,
  TIPO_RCCOOR,
  leerRccoor,
  urlRccoor,
} from '../services/_catastro-ovc.js'
import {
  CATASTRO_WFS_CP,
  CODIGO_CAJON_DE_SASTRE,
  CONSULTAS_ALMACENADAS,
  NS_OWS_1_1,
  TIPO_RESPUESTA_WFS,
  leerColeccion,
  srsWfs,
  urlBbox,
  urlGetNeighbourParcel,
  urlGetParcel,
} from '../services/_catastro-wfs.js'
import { crearTransporte } from '../services/_red.js'

// ── Rutas y ficheros de verdad externa ────────────────────────────────────────

const RAIZ = resolve(import.meta.dirname, '..')
const DIR_CATASTRO = join(RAIZ, 'test', 'fixtures', 'catastro')
const DIR_GML = join(RAIZ, 'test', 'fixtures', 'gml')

/**
 * Los ficheros que esta sonda vigila. Son la IDENTIDAD de cada caso medido, y por
 * eso están nombrados: si alguien renombra uno, la preparación falla en voz alta
 * (salida 2) en vez de dejar de comprobar ese caso en silencio.
 *
 * `parcela` es el único que NO vive en `test/fixtures/catastro/`: el camino de
 * éxito de `GetParcel` está versionado en `test/fixtures/gml/` y **no se
 * duplica** (un fixture duplicado son dos fixtures que se pueden desincronizar).
 *
 * @readonly
 */
const FIXTURES = Object.freeze({
  catalogo: 'wfs-describestoredqueries.xml',
  vecindad: 'wfs-neighbour-9398516VK3799G.xml',
  bboxCount: 'wfs-bbox-count10.xml',
  bboxVacio: 'wfs-bbox-vacio-mar.xml',
  rcInexistente: 'wfs-exceptionreport-rc-inexistente.xml',
  rccoor: 'ovc-rccoor-ok.json',
  rccoorAsmx: 'ovc-rccoor-cod76.json',
  parcela: 'cp_parcela_9398516VK3799G.gml',
})

/**
 * El `id` que **no** debe existir en el catálogo. No sale de ningún fixture —no
 * se puede derivar la ausencia de una cosa de un fichero que no la contiene—, así
 * que aquí está escrito, con su procedencia: `spec/feature-05-catastro-vivo.md`
 * lo nombra en una enumeración donde las demás funciones SÍ tienen su *stored
 * query* una a una, y esa simetría invita a buscarlo. `PROCEDENCIA.md` demuestra
 * que no existe. Esta constante es la anti-vacuidad de la comprobación anterior.
 */
const CONSULTA_QUE_NO_EXISTE = 'GetParcelsByBBox'

/**
 * Marca de «la sonda no se ha podido ni preparar». Es un problema de ESTE repo
 * (un fixture movido, `PROCEDENCIA.md` con otro formato), no del Catastro, y por
 * eso sale con el código de «no lo sé» y no con el de «el contrato ha derivado».
 */
const ERROR_DE_PREPARACION = Symbol('sonda-catastro: no se ha podido preparar la sonda')

/** @param {string} mensaje @returns {Error} marcado como fallo de preparación. */
function errorDePreparacion(mensaje) {
  const error = new Error(mensaje)
  error[ERROR_DE_PREPARACION] = true
  return error
}

/**
 * Lee un fichero de verdad externa como UTF-8.
 *
 * **Siempre UTF-8, e ignorando lo que el fichero diga de sí mismo**: los cinco
 * `.xml` declaran `ISO-8859-1` y sus bytes son UTF-8 (hecho transversal 4 de
 * `PROCEDENCIA.md`). Decodificarlos como latin-1 «por respeto a la declaración»
 * produciría texto roto a partir de bytes correctos.
 *
 * @param {string} dir
 * @param {string} nombre
 * @returns {string}
 */
function leerFixture(dir, nombre) {
  try {
    return readFileSync(join(dir, nombre), 'utf8')
  } catch (error) {
    throw errorDePreparacion(
      `No se ha podido leer el fixture «${nombre}» en ${dir} (${error.message}). ` +
        'Esta sonda no comprueba nada sin él: sus expectativas SALEN de los fixtures, no de ' +
        'una lista escrita a mano.',
    )
  }
}

// ── `PROCEDENCIA.md`: de dónde salen las peticiones ───────────────────────────

/**
 * Extrae del documento de procedencia la URL EXACTA con que se midió cada
 * fixture. Es la fila `| URL | \`…\` |` de la tabla de cada sección
 * `## \`fichero\` — …`.
 *
 * Por qué se leen de ahí y no se escriben aquí: `PROCEDENCIA.md` es el documento
 * que esta sonda vigila. Si alguien recaptura un caso con otros parámetros y
 * anota la URL nueva, la sonda pasa a probar ESA, sin tocar este fichero. Y si el
 * documento cambia de formato, esto devuelve un mapa incompleto y la preparación
 * falla en voz alta.
 *
 * @param {string} markdown  Contenido de `PROCEDENCIA.md`.
 * @returns {Map<string, string>}  nombre de fichero → URL medida.
 */
function urlesMedidas(markdown) {
  const mapa = new Map()
  for (const bloque of markdown.split(/^## /m).slice(1)) {
    const fichero = /^`([^`]+)`/.exec(bloque)
    const url = /^\|\s*URL\s*\|\s*`([^`]+)`\s*\|/m.exec(bloque)
    if (fichero !== null && url !== null) mapa.set(fichero[1], url[1])
  }
  return mapa
}

/**
 * La URL medida de un fixture, o un fallo de preparación.
 *
 * @param {Map<string, string>} mapa
 * @param {string} fichero
 * @returns {string}
 */
function urlMedida(mapa, fichero) {
  const url = mapa.get(fichero)
  if (url === undefined) {
    throw errorDePreparacion(
      `«${fichero}» no tiene fila «| URL | \`…\` |» en test/fixtures/catastro/PROCEDENCIA.md. ` +
        'De ahí salen los parámetros de las peticiones de esta sonda: sin esa fila no se sabe ' +
        'qué se midió, y adivinarlo sería inventarse la medición.',
    )
  }
  return url
}

/**
 * Parámetros de una URL medida, en el orden y con los valores tal cual.
 *
 * @param {string} url
 * @returns {URLSearchParams}
 */
function parametros(url) {
  return new URL(url).searchParams
}

/**
 * Valor obligatorio de un parámetro de una URL medida.
 *
 * @param {URLSearchParams} params
 * @param {string} nombre
 * @param {string} contexto
 * @returns {string}
 */
function exigirParametro(params, nombre, contexto) {
  const valor = params.get(nombre)
  if (valor === null) {
    throw errorDePreparacion(
      `La URL medida de ${contexto} no lleva el parámetro «${nombre}». ` +
        'Esta sonda deriva sus peticiones de esas URL: si el parámetro no está, no hay nada ' +
        'que derivar.',
    )
  }
  return valor
}

/**
 * `EPSG::25830` (forma del WFS) → `EPSG:25830` (forma corta del modelo).
 *
 * Se comprueba el camino de vuelta con {@link srsWfs}, que es la función de
 * PRODUCCIÓN: si la conversión no cerrara el círculo, la sonda estaría pidiendo
 * un SRS distinto del medido y no se enteraría.
 *
 * @param {string} valorWfs  El `srsname` tal como venía en la URL medida.
 * @returns {string}
 */
function srsCortoDeWfs(valorWfs) {
  const corto = valorWfs.replace('::', ':')
  if (srsWfs(corto) !== valorWfs) {
    throw errorDePreparacion(
      `El «srsname» medido (${valorWfs}) no se corresponde con ninguna forma corta que ` +
        `services/_catastro-wfs.js#srsWfs sepa reconstruir (probé «${corto}» y devolvió ` +
        `«${srsWfs(corto)}»).`,
    )
  }
  return corto
}

// ── Derivación: peticiones y expectativas ─────────────────────────────────────

/**
 * Ids de las *stored queries* que publica un `DescribeStoredQueriesResponse`.
 *
 * Se parsea el XML de verdad (`gml/xml.js`) en vez de barrer con una expresión
 * regular: una RegExp no puede decidir sobre XML, y aquí la lista es justamente
 * el dato que se compara.
 *
 * @param {string} xml
 * @returns {string[]}  Ids en el orden del documento. Vacío si no es ese documento.
 */
function idsDelCatalogo(xml) {
  const { raiz } = parsearXml(xml)
  if (raiz === null || raiz.ns !== NS.wfs || raiz.local !== 'DescribeStoredQueriesResponse') {
    return []
  }
  return hijos(raiz, NS.wfs, 'StoredQueryDescription')
    .map((nodo) => atributo(nodo, SIN_NAMESPACE, 'id'))
    .filter((id) => typeof id === 'string' && id !== '')
}

/**
 * Las referencias catastrales de una colección ya leída, en orden.
 *
 * @param {import('../services/_catastro-wfs.js').RespuestaWfs} coleccion
 * @returns {string[]}
 */
function refcatsDe(coleccion) {
  if (coleccion.tipo !== TIPO_RESPUESTA_WFS.PARCELAS) return []
  return coleccion.parcelas.map((p) => p.refcat)
}

/**
 * El valor si es un objeto plano (ni `null`, ni array); `null` si no. Mismo
 * criterio que `services/_catastro-ovc.js#esObjeto`, escrito aquí porque aquel es
 * interno de su módulo y esta sonda no debe forzar su exportación.
 *
 * @param {*} v
 * @returns {Object|null}
 */
function objeto(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? v : null
}

/**
 * Camina `Consulta_RCCOORResult.coordenadas.coord[0].pc` de un cuerpo del OVC ya
 * parseado. Devuelve `null` si la ruta no existe ENTERA: es la ruta la que se
 * comprueba, y una ruta a medias no es la ruta.
 *
 * @param {*} cuerpo  JSON ya parseado.
 * @returns {{pc1: *, pc2: *}|null}
 */
function pcDelPrimerCandidato(cuerpo) {
  const envoltorio = objeto(cuerpo) === null ? null : cuerpo[CLAVE_ENVOLTORIO_RCCOOR]
  const coordenadas = objeto(envoltorio) === null ? null : envoltorio.coordenadas
  const lista = objeto(coordenadas) === null ? null : coordenadas.coord
  if (!Array.isArray(lista) || lista.length === 0) return null
  const pc = objeto(lista[0]) === null ? null : lista[0].pc
  if (objeto(pc) === null) return null
  return { pc1: pc.pc1, pc2: pc.pc2 }
}

/**
 * JSON tolerante: devuelve `null` en vez de lanzar. La respuesta de un servicio
 * ajeno que no sea JSON es una respuesta rara, no un bug (misma frontera que
 * `services/_catastro-ovc.js`).
 *
 * @param {string} texto
 * @returns {*}
 */
function jsonONulo(texto) {
  try {
    return JSON.parse(texto)
  } catch {
    return null
  }
}

/**
 * Prepara la sonda: lee la verdad externa, deriva las 8 peticiones con el código
 * de PRODUCCIÓN y deja calculadas las expectativas que salen de los fixtures.
 *
 * @returns {{peticiones: Array<{nombre: string, familia: 'xml'|'json', url: string,
 *   urlMedida: string|null, titulo: string}>, esperado: Object, advertencias: string[]}}
 * @throws {Error} marcado con {@link ERROR_DE_PREPARACION}.
 */
function prepararse() {
  const advertencias = []
  const medidas = urlesMedidas(leerFixture(DIR_CATASTRO, 'PROCEDENCIA.md'))

  // ── Fixtures leídos con el MISMO lector que usa la app ──────────────────────
  const catalogoFixture = idsDelCatalogo(leerFixture(DIR_CATASTRO, FIXTURES.catalogo))
  if (catalogoFixture.length === 0) {
    throw errorDePreparacion(
      `El fixture «${FIXTURES.catalogo}» no ha dado ninguna *stored query*. Sin catálogo de ` +
        'referencia, la comprobación del catálogo sería vacua.',
    )
  }

  const parcelaFixture = leerColeccion(leerFixture(DIR_GML, FIXTURES.parcela))
  if (parcelaFixture.tipo !== TIPO_RESPUESTA_WFS.PARCELAS || parcelaFixture.parcelas.length === 0) {
    throw errorDePreparacion(
      `El fixture «${FIXTURES.parcela}» no se lee como colección de parcelas (salió ` +
        `${parcelaFixture.tipo}). Es la fuente de la referencia catastral y del SRS con que ` +
        'se piden los dos casos de éxito.',
    )
  }
  const refcatParcela = parcelaFixture.parcelas[0].refcat
  const srsParcela = parcelaFixture.parcelas[0].srs
  if (typeof refcatParcela !== 'string' || refcatParcela === '' || typeof srsParcela !== 'string') {
    throw errorDePreparacion(
      `El fixture «${FIXTURES.parcela}» no trae referencia catastral y SRS legibles ` +
        `(refcat=${JSON.stringify(refcatParcela)}, srs=${JSON.stringify(srsParcela)}).`,
    )
  }

  const vecindadFixture = leerColeccion(leerFixture(DIR_CATASTRO, FIXTURES.vecindad))
  const bboxCountFixture = leerColeccion(leerFixture(DIR_CATASTRO, FIXTURES.bboxCount))
  const rccoorFixture = jsonONulo(leerFixture(DIR_CATASTRO, FIXTURES.rccoor))
  const asmxFixture = leerRccoor(leerFixture(DIR_CATASTRO, FIXTURES.rccoorAsmx))

  const pcFixture = pcDelPrimerCandidato(rccoorFixture)
  if (pcFixture === null) {
    throw errorDePreparacion(
      `El fixture «${FIXTURES.rccoor}» no trae la ruta ` +
        `${CLAVE_ENVOLTORIO_RCCOOR}.coordenadas.coord[0].pc: es la ruta que la sonda va a ` +
        'buscar en la respuesta viva, y hay que saber que existía.',
    )
  }

  // ── Encoding declarado por los fixtures XML (para la comprobación 10) ───────
  const encodingsFixtures = [
    FIXTURES.catalogo,
    FIXTURES.vecindad,
    FIXTURES.bboxCount,
    FIXTURES.bboxVacio,
    FIXTURES.rcInexistente,
  ].map((f) => {
    const declaracion = parsearXml(leerFixture(DIR_CATASTRO, f)).declaracion
    return declaracion === null || declaracion.encoding === null
      ? null
      : declaracion.encoding.toLowerCase()
  })
  const encodingEsperado = [...new Set(encodingsFixtures)]

  // ── Las 8 peticiones, construidas con el código de PRODUCCIÓN ───────────────
  //
  // Cada una: parámetros de la URL MEDIDA + constructor de `services/`. Lo que
  // sale es lo que la app emitiría hoy para ese caso.

  const peticiones = []
  /** Referencia catastral con la que se pide la vecindad; sale de su URL medida. */
  let refcatVecindad = null

  /**
   * Registra una petición y avisa si lo que construye el código ya no coincide
   * con lo que se midió. **No es un fallo del contrato del servicio** —es una
   * divergencia entre `services/` y `PROCEDENCIA.md`—, así que va a
   * `advertencias` y no a `comprobaciones`: mezclarlas haría que un cambio
   * nuestro se leyera como un cambio del Catastro.
   */
  const registrar = ({ nombre, titulo, familia, url, medida }) => {
    if (medida !== null && url !== medida) {
      advertencias.push(
        `La URL que construye el código para «${nombre}» ya no es la que documenta ` +
          `PROCEDENCIA.md. Se ha pedido la del código (que es lo que la app emitiría hoy).\n` +
          `      código:      ${url}\n` +
          `      PROCEDENCIA: ${medida}`,
      )
    }
    peticiones.push({ nombre, titulo, familia, url, urlMedida: medida })
  }

  // 1 · DescribeStoredQueries. No hay constructor en `services/` (el código no la
  //     pide nunca: usa el catálogo congelado en `CONSULTAS_ALMACENADAS`), así que
  //     se compone con la constante base de producción y los parámetros medidos.
  {
    const medida = urlMedida(medidas, FIXTURES.catalogo)
    const p = parametros(medida)
    const url =
      `${CATASTRO_WFS_CP}?service=${exigirParametro(p, 'service', 'DescribeStoredQueries')}` +
      `&version=${exigirParametro(p, 'version', 'DescribeStoredQueries')}` +
      `&request=${exigirParametro(p, 'request', 'DescribeStoredQueries')}`
    registrar({
      nombre: 'catalogo',
      titulo: 'DescribeStoredQueries · el catálogo que da el propio servicio',
      familia: 'xml',
      url,
      medida,
    })
  }

  // 2 · GetParcel de la referencia del fixture. Su URL NO está en este
  //     PROCEDENCIA.md (su fixture vive en ../gml/), así que no hay contra qué
  //     cotejarla: se construye entera con `urlGetParcel` y se declara el hueco.
  advertencias.push(
    `La URL del «GetParcel» correcto no está documentada en test/fixtures/catastro/` +
      `PROCEDENCIA.md: su fixture es ../gml/${FIXTURES.parcela} y allí no se anotó la URL. ` +
      'Se construye con `urlGetParcel` a partir de la referencia y el SRS que trae el propio ' +
      'fichero, y no hay URL medida contra la que cotejarla.',
  )
  registrar({
    nombre: 'parcela',
    titulo: `GetParcel · la parcela ${refcatParcela} (camino de éxito)`,
    familia: 'xml',
    url: urlGetParcel(refcatParcela, srsParcela),
    medida: null,
  })

  // 3 · GetNeighbourParcel.
  {
    const medida = urlMedida(medidas, FIXTURES.vecindad)
    const p = parametros(medida)
    const refcat = exigirParametro(p, 'refcat', 'GetNeighbourParcel')
    const srs = srsCortoDeWfs(exigirParametro(p, 'srsname', 'GetNeighbourParcel'))
    refcatVecindad = refcat
    registrar({
      nombre: 'vecindad',
      titulo: `GetNeighbourParcel · la vecindad de ${refcat}`,
      familia: 'xml',
      url: urlGetNeighbourParcel(refcat, srs),
      medida,
    })
  }

  // 4 · GetParcel de una referencia inexistente.
  {
    const medida = urlMedida(medidas, FIXTURES.rcInexistente)
    const p = parametros(medida)
    const refcat = exigirParametro(p, 'refcat', 'GetParcel de referencia inexistente')
    const srs = srsCortoDeWfs(exigirParametro(p, 'srsname', 'GetParcel de referencia inexistente'))
    registrar({
      nombre: 'rc-inexistente',
      titulo: `GetParcel · la referencia ${refcat}, que no existe`,
      familia: 'xml',
      url: urlGetParcel(refcat, srs),
      medida,
    })
  }

  // 5 y 6 · Los dos BBOX. Mismo constructor, `urlBbox`: el BBOX NO es una *stored
  //         query* (no existe `GetParcelsByBBox`), es `GetFeature` estándar.
  const bboxDe = (fichero, contexto) => {
    const medida = urlMedida(medidas, fichero)
    const p = parametros(medida)
    const trozos = exigirParametro(p, 'bbox', contexto).split(',')
    if (trozos.length !== 5) {
      throw errorDePreparacion(
        `El «bbox» medido de ${contexto} no tiene 5 componentes (4 coordenadas + SRS): ` +
          `${JSON.stringify(trozos)}.`,
      )
    }
    const [minX, minY, maxX, maxY] = trozos.slice(0, 4).map(Number)
    const srs = srsCortoDeWfs(trozos[4])
    const count = Number(exigirParametro(p, 'count', contexto))
    return { medida, bbox: { minX, minY, maxX, maxY }, srs, count }
  }

  const vacio = bboxDe(FIXTURES.bboxVacio, 'el BBOX sin parcelas')
  registrar({
    nombre: 'bbox-vacio',
    titulo: 'GetFeature + bbox · una caja de mar abierto, sin ninguna parcela',
    familia: 'xml',
    url: urlBbox(vacio.bbox, vacio.srs, { count: vacio.count }),
    medida: vacio.medida,
  })

  const conCount = bboxDe(FIXTURES.bboxCount, 'el BBOX con count')
  // El fixture y la URL medida tienen que contarse lo mismo: si el fichero no
  // trae tantos miembros como `count` pedía, uno de los dos se ha recapturado sin
  // el otro y la expectativa de esta sonda ya no descansa sobre nada.
  if (bboxCountFixture.nMiembros !== conCount.count) {
    advertencias.push(
      `El fixture «${FIXTURES.bboxCount}» trae ${bboxCountFixture.nMiembros} miembros y su URL ` +
        `medida pide count=${conCount.count}. Fichero y URL se han desincronizado en ` +
        'PROCEDENCIA.md; la sonda sigue, pero esa pareja hay que rehacerla.',
    )
  }
  registrar({
    nombre: 'bbox-count',
    titulo: `GetFeature + bbox · una caja con parcelas y count=${conCount.count}`,
    familia: 'xml',
    url: urlBbox(conCount.bbox, conCount.srs, { count: conCount.count }),
    medida: conCount.medida,
  })

  // 7 · Consulta_RCCOOR con los nombres BUENOS de este endpoint.
  {
    const medida = urlMedida(medidas, FIXTURES.rccoor)
    const p = parametros(medida)
    const x = Number(exigirParametro(p, PARAM_RCCOOR.x, 'Consulta_RCCOOR'))
    const y = Number(exigirParametro(p, PARAM_RCCOOR.y, 'Consulta_RCCOOR'))
    const srs = exigirParametro(p, PARAM_RCCOOR.srs, 'Consulta_RCCOOR')
    registrar({
      nombre: 'rccoor',
      titulo: `Consulta_RCCOOR · el punto [${x}, ${y}] con ${PARAM_RCCOOR.x}/${PARAM_RCCOOR.y}`,
      familia: 'json',
      url: urlRccoor(x, y, srs),
      medida,
    })
  }

  // 8 · Consulta_RCCOOR con los nombres del OTRO endpoint (el `.asmx`). Aquí NO
  //     se usa `urlRccoor` a propósito: la gracia del caso es mandar unos
  //     parámetros que esa función jamás emitiría. Se compone con la constante
  //     base de producción y los parámetros LITERALES de la URL medida.
  {
    const medida = urlMedida(medidas, FIXTURES.rccoorAsmx)
    const p = parametros(medida)
    const nombres = [...p.keys()]
    // Anti-vacuidad de esta petición: si la URL medida llevara los nombres BUENOS,
    // el caso no probaría nada y saldría verde por el motivo equivocado.
    if (nombres.includes(PARAM_RCCOOR.x) || nombres.includes(PARAM_RCCOOR.y)) {
      throw errorDePreparacion(
        `La URL medida de «${FIXTURES.rccoorAsmx}» lleva ${PARAM_RCCOOR.x}/${PARAM_RCCOOR.y}, ` +
          'que son los nombres BUENOS de este endpoint. Ese fixture existe para el caso ' +
          'contrario (los nombres del .asmx): con los buenos, la comprobación sería vacua.',
      )
    }
    const url = `${CATASTRO_OVC_RCCOOR_JSON}?${[...p].map(([k, v]) => `${k}=${v}`).join('&')}`
    const deCoordenada = nombres.filter((n) => n !== PARAM_RCCOOR.srs).join('/')
    registrar({
      nombre: 'rccoor-parametros-del-asmx',
      titulo: `Consulta_RCCOOR · el MISMO punto con ${deCoordenada} (los del .asmx)`,
      familia: 'json',
      url,
      medida,
    })
  }

  return {
    peticiones,
    esperado: {
      catalogoFixture,
      consultasDelCodigo: Object.values(CONSULTAS_ALMACENADAS),
      refcatParcela,
      nMiembrosParcela: parcelaFixture.nMiembros,
      refcatVecindad,
      nMiembrosVecindad: vecindadFixture.nMiembros,
      countPedido: conCount.count,
      refcatRccoorFixture: `${pcFixture.pc1}${pcFixture.pc2}`,
      codAsmxFixture: asmxFixture.cod,
      tipoRccoorAsmxFixture: asmxFixture.tipo,
      encodingEsperado,
    },
    advertencias,
  }
}

// ── Transporte: el mismo que la app, con las cabeceras observadas al vuelo ────

/**
 * `fetch` que delega en el del entorno y APUNTA las cabeceras de cada respuesta.
 *
 * Existe porque `services/_red.js` no expone las cabeceras (a propósito: un
 * transporte que solo entrega texto y estado es más difícil de usar mal), y esta
 * sonda necesita mirar `Access-Control-Allow-Origin`. Se envuelve por FUERA en
 * vez de tocar el transporte: la petición que sale es exactamente la de la app.
 *
 * ⚠️ Esto corre en Node, donde no hay política de mismo origen: **leer la
 * cabecera no es comprobar que el navegador acepte la respuesta.** Ver
 * `noSePuedeSaber`.
 *
 * @param {Map<string, {acao: string|null, tipoContenido: string|null, cors: string[]}>} registro
 * @returns {typeof globalThis.fetch}
 */
function fetchQueApunta(registro) {
  return async (url, opciones) => {
    const respuesta = await fetch(url, opciones)
    registro.set(String(url), {
      acao: respuesta.headers.get('access-control-allow-origin'),
      tipoContenido: respuesta.headers.get('content-type'),
      cors: [...respuesta.headers.keys()].filter((k) => k.startsWith('access-control-')),
    })
    return respuesta
  }
}

/**
 * Emite las 8 peticiones por el transporte de la app.
 *
 * Se lanzan TODAS a la vez a propósito: la cola de `services/_red.js` las va a
 * serializar de dos en dos (`MAX_CONCURRENCIA`), que es justo la disciplina que
 * interesa ejercitar contra el servicio real. No hay bucle ni reintento propio:
 * el backoff ya vive en el transporte y no reintenta un 2xx.
 *
 * @param {{pedirTexto: Function, estado: Function}} red
 * @param {Array<{nombre: string, url: string}>} peticiones
 * @param {Map<string, *>} registro  Cabeceras apuntadas por {@link fetchQueApunta}.
 * @returns {Promise<Map<string, Object>>}
 */
async function emitirTodas(red, peticiones, registro) {
  const hechas = await Promise.all(
    peticiones.map(async (peticion) => {
      const r = await red.pedirTexto(peticion.url)
      return {
        ...peticion,
        ok: r.ok,
        estado: r.estado,
        texto: r.texto,
        tipoContenido: r.tipoContenido,
        motivo: r.motivo,
        mensaje: r.mensaje,
        intentos: r.intentos,
        ms: r.ms,
        cabeceras: registro.get(peticion.url) ?? null,
      }
    }),
  )
  return new Map(hechas.map((p) => [p.nombre, p]))
}

// ── Vocabulario del veredicto ─────────────────────────────────────────────────

/**
 * Una comprobación del contrato.
 *
 * `ok` tiene TRES valores y no dos, y esa es la decisión de diseño de este
 * fichero: `true` (sigue como estaba), `false` (**el contrato ha derivado**) y
 * `null` (**no se ha podido comprobar**). El tercero no es un `false` cobarde: es
 * la diferencia entre «el Catastro ha cambiado» y «hoy el Catastro no ha
 * contestado», y confundirlas es lo que hace que un guion acabe ignorándose.
 *
 * `nota` NO es opcional: el `ok` nunca viaja huérfano. Cada valor lleva su frase
 * en castellano, y la de un `false` dice además qué habría que hacer.
 *
 * @typedef {Object} Comprobacion
 * @property {string} nombre
 * @property {*} esperado    Derivado de fixtures o de constantes de producción.
 * @property {*} observado   Lo que ha contestado el servicio hoy. `null` si no.
 * @property {boolean|null} ok
 * @property {string} nota
 */

/**
 * @param {string} nombre
 * @param {{esperado: *, observado: *, ok: boolean, nota: string}} datos
 * @returns {Comprobacion}
 */
function comprobacion(nombre, { esperado, observado, ok, nota }) {
  return { nombre, esperado, observado, ok, nota }
}

/**
 * La comprobación que no se ha podido hacer porque su petición no trajo cuerpo.
 *
 * @param {string} nombre
 * @param {*} esperado
 * @param {{titulo: string, motivo: string|null, mensaje: string|null}} peticion
 * @returns {Comprobacion}
 */
function sinMedir(nombre, esperado, peticion) {
  return {
    nombre,
    esperado,
    observado: null,
    ok: null,
    nota:
      `NO SE HA PODIDO COMPROBAR: la petición «${peticion.titulo}» no ha traído cuerpo ` +
      `(${peticion.motivo}: ${peticion.mensaje}). Esto NO dice que el contrato haya cambiado; ` +
      'dice que hoy no se sabe.',
  }
}

// ── Las comprobaciones ────────────────────────────────────────────────────────

/**
 * Juzga las respuestas contra las expectativas derivadas.
 *
 * Cada bloque empieza mirando si su petición trajo cuerpo. Si no, sus
 * comprobaciones salen `null` y el veredicto lo dice; **jamás se sustituye una
 * medición que falta por una suposición**.
 *
 * @param {Object} esperado  El bloque `esperado` de {@link prepararse}.
 * @param {Map<string, Object>} respuestas
 * @returns {{comprobaciones: Comprobacion[], advertencias: string[]}}
 */
function juzgar(esperado, respuestas) {
  const comprobaciones = []
  const advertencias = []
  const con = (nombre) => respuestas.get(nombre)
  const cuerpoDe = (peticion) =>
    peticion.ok && typeof peticion.texto === 'string' ? peticion.texto : null

  // ── El catálogo de *stored queries* ─────────────────────────────────────────
  {
    const p = con('catalogo')
    const cuerpo = cuerpoDe(p)
    const ids = cuerpo === null ? null : idsDelCatalogo(cuerpo)

    if (ids === null) {
      comprobaciones.push(
        sinMedir(
          'catálogo · las consultas que usa el código siguen publicadas',
          esperado.consultasDelCodigo,
          p,
        ),
        sinMedir(
          `catálogo · «${CONSULTA_QUE_NO_EXISTE}» sigue sin existir (anti-vacuidad)`,
          'ausente',
          p,
        ),
        sinMedir(
          'catálogo · sigue siendo el mismo que congela el fixture',
          esperado.catalogoFixture,
          p,
        ),
      )
    } else {
      const faltan = esperado.consultasDelCodigo.filter((id) => !ids.includes(id))
      comprobaciones.push(
        comprobacion('catálogo · las consultas que usa el código siguen publicadas', {
          esperado: esperado.consultasDelCodigo,
          observado: ids,
          ok: faltan.length === 0,
          nota:
            faltan.length === 0
              ? 'Las *stored queries* de `CONSULTAS_ALMACENADAS` siguen en el catálogo que ' +
                'publica el servicio. La lista esperada NO está escrita aquí: sale de la ' +
                'constante de producción.'
              : `El servicio ha dejado de publicar ${faltan.join(', ')}. Las peticiones que el ` +
                'código construye con esos identificadores han dejado de tener destino: hay ' +
                'que mirar qué las sustituye ANTES de tocar `services/_catastro-wfs.js`.',
        }),
        comprobacion(`catálogo · «${CONSULTA_QUE_NO_EXISTE}» sigue sin existir (anti-vacuidad)`, {
          esperado: `«${CONSULTA_QUE_NO_EXISTE}» NO está en el catálogo`,
          observado: ids.includes(CONSULTA_QUE_NO_EXISTE) ? 'está' : 'no está',
          ok: !ids.includes(CONSULTA_QUE_NO_EXISTE),
          nota: ids.includes(CONSULTA_QUE_NO_EXISTE)
            ? `El servicio ha empezado a publicar «${CONSULTA_QUE_NO_EXISTE}». Es una NOVEDAD, ` +
              'no una avería: el BBOX se puede seguir haciendo con `GetFeature` estándar, que ' +
              'es lo que hace `urlBbox`. Actualizar PROCEDENCIA.md y decidir si compensa.'
            : 'Esta es la mitad que impide que la comprobación anterior sea vacua: sin ella, un ' +
              'servicio que devolviera una lista VACÍA aprobaría el «no contiene» sin decir nada.',
        }),
        comprobacion('catálogo · sigue siendo el mismo que congela el fixture', {
          esperado: esperado.catalogoFixture,
          observado: ids,
          ok:
            ids.length === esperado.catalogoFixture.length &&
            esperado.catalogoFixture.every((id) => ids.includes(id)),
          nota:
            ids.length === esperado.catalogoFixture.length &&
            esperado.catalogoFixture.every((id) => ids.includes(id))
              ? 'El catálogo publicado coincide con el que congela el fixture.'
              : 'El catálogo del servicio ya no es el del fixture. Que gane una consulta no es ' +
                'malo; que pierda una sí puede serlo. En los dos casos, `PROCEDENCIA.md` ha ' +
                'dejado de describir la realidad y hay que recapturar ESTE fixture.',
        }),
      )
    }
  }

  // ── `GetParcel`: el camino de éxito ─────────────────────────────────────────
  {
    const p = con('parcela')
    const cuerpo = cuerpoDe(p)
    const leida = cuerpo === null ? null : leerColeccion(cuerpo)

    if (leida === null) {
      comprobaciones.push(
        sinMedir(
          'GetParcel · sigue devolviendo una colección con su miembro',
          esperado.nMiembrosParcela,
          p,
        ),
        sinMedir(
          'GetParcel · la referencia pedida sigue viniendo dentro',
          esperado.refcatParcela,
          p,
        ),
      )
    } else {
      const refcats = refcatsDe(leida)
      const bien =
        leida.tipo === TIPO_RESPUESTA_WFS.PARCELAS &&
        leida.nMiembros === esperado.nMiembrosParcela
      comprobaciones.push(
        comprobacion('GetParcel · sigue devolviendo una colección con su miembro', {
          esperado: { tipo: TIPO_RESPUESTA_WFS.PARCELAS, nMiembros: esperado.nMiembrosParcela },
          observado: { tipo: leida.tipo, nMiembros: leida.nMiembros ?? 0 },
          ok: bien,
          nota: bien
            ? 'Los miembros se cuentan CONTÁNDOLOS, no leyendo `numberReturned` (ver la ' +
              'comprobación del BBOX con `count`).'
            : 'La *stored query* de parcela ha dejado de devolver lo que devolvía. Es el camino ' +
              'más usado de F05 («carga por RC»): mirar el cuerpo entero antes de suponer nada.',
        }),
        comprobacion('GetParcel · la referencia pedida sigue viniendo dentro', {
          esperado: esperado.refcatParcela,
          observado: refcats,
          ok: refcats.includes(esperado.refcatParcela),
          nota: refcats.includes(esperado.refcatParcela)
            ? 'La parcela que se pidió está en la colección que ha llegado.'
            : 'Se ha pedido una referencia y ha venido otra cosa. Hasta saber por qué, ningún ' +
              'automatismo debería dar por buena la parcela recibida.',
        }),
      )
    }
  }

  // ── `GetNeighbourParcel`: la vecindad se incluye a sí misma ─────────────────
  {
    const p = con('vecindad')
    const cuerpo = cuerpoDe(p)
    const leida = cuerpo === null ? null : leerColeccion(cuerpo)

    if (leida === null) {
      comprobaciones.push(
        sinMedir(
          'GetNeighbourParcel · sigue incluyendo a la propia parcela',
          esperado.refcatVecindad,
          p,
        ),
        sinMedir(
          'GetNeighbourParcel · sigue devolviendo el mismo número de miembros',
          esperado.nMiembrosVecindad,
          p,
        ),
      )
    } else {
      const refcats = refcatsDe(leida)
      const seIncluye = refcats.includes(esperado.refcatVecindad)
      const mismosMiembros = leida.nMiembros === esperado.nMiembrosVecindad
      comprobaciones.push(
        comprobacion('GetNeighbourParcel · sigue incluyendo a la propia parcela', {
          esperado: `la colección contiene ${esperado.refcatVecindad}`,
          observado: refcats,
          ok: seIncluye,
          nota: seIncluye
            ? 'Sigue viniendo la parcela consultada entre sus vecinas, y sigue sin ser la ' +
              `primera (posición ${refcats.indexOf(esperado.refcatVecindad) + 1} de ` +
              `${refcats.length}): no se puede descartar por índice, hay que filtrar por ` +
              'referencia catastral, que es lo que hace `services/catastro.js`.'
            : 'El servicio ha DEJADO de incluir la parcela consultada entre sus vecinas. El ' +
              'filtro por referencia de `services/catastro.js` seguiría siendo correcto (no ' +
              'encontraría nada que quitar), pero la aritmética de colindantes cambia y ' +
              '`PROCEDENCIA.md` documenta lo contrario: hay que recapturar el fixture.',
        }),
        comprobacion('GetNeighbourParcel · sigue devolviendo el mismo número de miembros', {
          esperado: esperado.nMiembrosVecindad,
          observado: leida.nMiembros ?? 0,
          ok: mismosMiembros,
          nota: mismosMiembros
            ? 'Mismo número de miembros que el día de la captura.'
            : 'La vecindad de esa parcela ha cambiado de tamaño. Puede ser una segregación o ' +
              'una agrupación reales en el Catastro —dato de la realidad, no avería— y ' +
              'entonces lo que toca es recapturar el fixture y anotarlo en PROCEDENCIA.md.',
        }),
      )
    }
  }

  // ── La referencia inexistente: el error que viene con HTTP 200 ──────────────
  let codigoRcInexistente = null
  {
    const p = con('rc-inexistente')
    const cuerpo = cuerpoDe(p)

    // El estado se juzga aparte del cuerpo, porque es lo único que se puede
    // afirmar de un no-2xx: `services/_red.js` NO lee el cuerpo de una respuesta
    // que no sea 2xx. Y si NO LLEGÓ A HABER respuesta (`estado === null`,
    // invariante de `ResultadoHttp`), esto no se sabe — no es que sea falso.
    comprobaciones.push(
      p.estado === null
        ? sinMedir('referencia inexistente · sigue llegando con HTTP 200', 200, p)
        : comprobacion('referencia inexistente · sigue llegando con HTTP 200', {
            esperado: 200,
            observado: p.estado,
            ok: p.estado === 200,
            nota:
              p.estado === 200
                ? '`response.ok` sigue sin clasificar nada en este servicio: la clasificación ' +
                  'se hace leyendo el cuerpo. Es el hecho transversal 1 de PROCEDENCIA.md y la ' +
                  'razón de ser de la frontera de `services/_red.js`.'
                : `El servicio ha empezado a contestar ${p.estado} a una referencia que no ` +
                  'existe. Sería una MEJORA del servicio, pero cambia el camino del transporte: ' +
                  'un no-2xx no lee cuerpo (`services/_red.js`), así que el `ExceptionReport` ' +
                  'dejaría de llegar a `leerColeccion` y el usuario perdería el mensaje del ' +
                  'Catastro.',
          }),
    )

    if (cuerpo === null) {
      comprobaciones.push(
        sinMedir(
          'referencia inexistente · sigue siendo un ExceptionReport de OWS 1.1 sin prefijo',
          NS_OWS_1_1,
          p,
        ),
        sinMedir(
          'referencia inexistente · sigue trayendo el exceptionCode cajón de sastre',
          CODIGO_CAJON_DE_SASTRE,
          p,
        ),
      )
    } else {
      const { raiz } = parsearXml(cuerpo)
      const observadoRaiz = {
        ns: raiz === null ? null : raiz.ns,
        local: raiz === null ? null : raiz.local,
        prefijo: raiz === null ? null : raiz.prefijo,
      }
      const raizBien =
        raiz !== null &&
        raiz.ns === NS_OWS_1_1 &&
        raiz.local === 'ExceptionReport' &&
        raiz.prefijo === ''
      const leida = leerColeccion(cuerpo)
      codigoRcInexistente = leida.codigo ?? null

      comprobaciones.push(
        comprobacion(
          'referencia inexistente · sigue siendo un ExceptionReport de OWS 1.1 sin prefijo',
          {
            esperado: { ns: NS_OWS_1_1, local: 'ExceptionReport', prefijo: '' },
            observado: observadoRaiz,
            ok: raizBien,
            nota: raizBien
              ? 'El namespace sigue declarado POR DEFECTO y la raíz sigue sin prefijo: un ' +
                'olfateo de `<ows:ExceptionReport` no la vería. La discriminación es por ' +
                'namespace + nombre local, y así la hace `leerExceptionReport`.'
              : 'La raíz del error ya no es la que espera `services/_catastro-wfs.js`. Con esta ' +
                'forma, `leerColeccion` clasificaría la respuesta como RESPUESTA_ILEGIBLE en vez ' +
                'de NO_ENCONTRADO, y el usuario vería «no entiendo al Catastro» donde debería ' +
                'leer «esa referencia no existe».',
          },
        ),
        comprobacion('referencia inexistente · sigue trayendo el exceptionCode cajón de sastre', {
          esperado: CODIGO_CAJON_DE_SASTRE,
          observado: {
            codigo: leida.codigo ?? null,
            tipo: leida.tipo,
            // El texto del CDATA se ARRASTRA como dato presentable y NO se compara
            // con nada: es libre, viene en dos idiomas y trae la errata del propio
            // servicio. Ver la cabecera de este fichero.
            detalleNoComparado: leida.detalle ?? null,
          },
          ok: leida.codigo === CODIGO_CAJON_DE_SASTRE,
          nota:
            leida.codigo === CODIGO_CAJON_DE_SASTRE
              ? 'Sigue siendo el cajón de sastre, y `leerColeccion` lo sigue traduciendo a ' +
                `${TIPO_RESPUESTA_WFS.NO_ENCONTRADO}.`
              : `El código ha cambiado a ${JSON.stringify(leida.codigo)}. Con el nuevo, ` +
                `\`leerColeccion\` devuelve ${TIPO_RESPUESTA_WFS.EXCEPCION} en vez de ` +
                `${TIPO_RESPUESTA_WFS.NO_ENCONTRADO}, así que «esa parcela no existe» dejaría ` +
                'de leerse como un resultado y pasaría a leerse como un fallo raro. Actualizar ' +
                '`CODIGO_CAJON_DE_SASTRE` solo DESPUÉS de recapturar los dos fixtures de error.',
        }),
      )
    }
  }

  // ── El BBOX vacío: «vacío» se dice igual que «fallo» ────────────────────────
  {
    const p = con('bbox-vacio')
    const cuerpo = cuerpoDe(p)

    if (cuerpo === null) {
      comprobaciones.push(
        sinMedir(
          'BBOX sin parcelas · sigue siendo un ExceptionReport, no una colección vacía',
          TIPO_RESPUESTA_WFS.NO_ENCONTRADO,
          p,
        ),
        sinMedir(
          'BBOX sin parcelas · sigue compartiendo exceptionCode con la referencia inexistente',
          codigoRcInexistente,
          p,
        ),
      )
    } else {
      const leida = leerColeccion(cuerpo)
      const esExcepcion = leida.tipo === TIPO_RESPUESTA_WFS.NO_ENCONTRADO
      comprobaciones.push(
        comprobacion(
          'BBOX sin parcelas · sigue siendo un ExceptionReport, no una colección vacía',
          {
            esperado: TIPO_RESPUESTA_WFS.NO_ENCONTRADO,
            observado: {
              tipo: leida.tipo,
              nMiembros: leida.nMiembros ?? null,
              detalleNoComparado: leida.detalle ?? null,
            },
            ok: esExcepcion,
            nota: esExcepcion
              ? 'La «feature vacía» sigue sin existir. Es la medición que CORRIGIÓ a ' +
                '`spec/feature-05-catastro-vivo.md` («el WFS puede devolver ExceptionReport o ' +
                'feature vacía»): las dos ramas son la misma rama.'
              : leida.tipo === TIPO_RESPUESTA_WFS.PARCELAS && leida.nMiembros === 0
                ? 'El servicio ha empezado a devolver COLECCIÓN VACÍA para una caja sin ' +
                  'parcelas. Es la mejor noticia posible —«cero resultados» dejaría de ser ' +
                  'indistinguible de «fallo»— y obliga a revisar la spec de F05 y el camino ' +
                  '`kind:empty`.'
                : 'Una caja sin parcelas ha contestado algo que no es ninguno de los dos casos ' +
                  'conocidos. Mirar el cuerpo tal cual antes de suponer nada.',
          },
        ),
      )

      if (codigoRcInexistente === null) {
        comprobaciones.push(
          sinMedir(
            'BBOX sin parcelas · sigue compartiendo exceptionCode con la referencia inexistente',
            'el mismo código que la referencia inexistente',
            con('rc-inexistente'),
          ),
        )
      } else {
        const mismo = (leida.codigo ?? null) === codigoRcInexistente
        comprobaciones.push(
          comprobacion(
            'BBOX sin parcelas · sigue compartiendo exceptionCode con la referencia inexistente',
            {
              // La expectativa es el código que ha traído HOY el otro caso, no una
              // constante: lo que se comprueba es que los dos SIGUEN siendo el mismo,
              // sea cual sea.
              esperado: codigoRcInexistente,
              observado: leida.codigo ?? null,
              ok: mismo,
              nota: mismo
                ? 'Los dos errores siguen siendo indistinguibles por código: `exceptionCode` no ' +
                  'clasifica nada en este servicio, y lo único que los separa es el texto libre ' +
                  'del CDATA —que NO se compara aquí ni se puede usar para ramificar.'
                : 'El servicio ha empezado a DISTINGUIR «no hay nada en esta caja» de «esa ' +
                  'referencia no existe». Es una mejora de verdad: permitiría separar «cero ' +
                  'resultados» (estado normal) de «fallo» sin analizar texto libre. Hay que ' +
                  'rehacer los dos fixtures y revisar `CODIGO_CAJON_DE_SASTRE`.',
            },
          ),
        )
      }
    }
  }

  // ── El BBOX con `count`: los contadores mienten ─────────────────────────────
  {
    const p = con('bbox-count')
    const cuerpo = cuerpoDe(p)

    if (cuerpo === null) {
      comprobaciones.push(
        sinMedir(
          'BBOX con count · sigue devolviendo tantos miembros como se piden',
          esperado.countPedido,
          p,
        ),
        sinMedir(
          'BBOX con count · numberMatched/numberReturned siguen mintiendo',
          'distintos de los miembros contados',
          p,
        ),
      )
    } else {
      const leida = leerColeccion(cuerpo)
      const nMiembros = leida.tipo === TIPO_RESPUESTA_WFS.PARCELAS ? leida.nMiembros : null
      const declarado = leida.tipo === TIPO_RESPUESTA_WFS.PARCELAS ? leida.declarado : null
      const cumpleCount = nMiembros === esperado.countPedido

      comprobaciones.push(
        comprobacion('BBOX con count · sigue devolviendo tantos miembros como se piden', {
          esperado: esperado.countPedido,
          observado: { tipo: leida.tipo, nMiembrosContados: nMiembros },
          ok: cumpleCount,
          nota: cumpleCount
            ? 'El tope de `count` se sigue respetando. No es cosmético: la misma caja sin tope ' +
              'devolvió 539 parcelas y ~1,15 MB, y una descarga masiva accidental es justo lo ' +
              'que el Catastro sanciona (`COUNT_BBOX_DEFECTO`).'
            : nMiembros === null
              ? 'La caja con parcelas ha dejado de devolver una colección. Si ha quedado sin ' +
                'parcelas por un cambio real del Catastro, hay que elegir otra caja y ' +
                'recapturar el fixture.'
              : `Se pidieron ${esperado.countPedido} y han venido ${nMiembros}. El tope ya no ` +
                'se comporta como se midió: revisar `urlBbox` y el tamaño de lo que baja antes ' +
                'de que un usuario se traiga un megabyte sin querer.',
        }),
      )

      if (declarado === null) {
        comprobaciones.push(
          sinMedir(
            'BBOX con count · numberMatched/numberReturned siguen mintiendo',
            'distintos de los miembros contados',
            p,
          ),
        )
      } else {
        const matched = declarado.numberMatched
        const returned = declarado.numberReturned
        // «Mentir» = declarar un número que NO es el de miembros que trae el cuerpo.
        // La expectativa no es «539»: es «distinto de lo que hay», derivado de lo
        // que hay hoy.
        const miente =
          String(returned) !== String(nMiembros) || String(matched) !== String(nMiembros)
        comprobaciones.push(
          comprobacion('BBOX con count · numberMatched/numberReturned siguen mintiendo', {
            esperado:
              `numberMatched y numberReturned distintos de los ${nMiembros} miembros ` +
              'contados',
            observado: { nMiembrosContados: nMiembros, ...declarado },
            ok: miente,
            nota: miente
              ? 'Los dos contadores siguen sin enterarse de que la respuesta está truncada. ' +
                '`numberMatched` sigue siendo útil (el total real de la caja); `numberReturned` ' +
                'no sirve para paginar ni para dibujar un contador. Los miembros se cuentan ' +
                'contándolos, que es lo que hace `nMiembros`.'
              : '⚑ EL SERVICIO HA DEJADO DE MENTIR: `numberReturned` ya coincide con los ' +
                'miembros que trae el cuerpo. **Es una buena noticia, no un fallo.** Esta ' +
                'sonda sale roja porque el contrato ha CAMBIADO, que es lo único que sabe ' +
                'decir. Toca recapturar el fixture y revisar el hecho (d) de la cabecera de ' +
                '`services/_catastro-wfs.js`, que hoy documenta lo contrario.',
          }),
        )
      }
    }
  }

  // ── `Consulta_RCCOOR`: la RC llega partida en dos ───────────────────────────
  {
    const p = con('rccoor')
    const cuerpo = cuerpoDe(p)

    if (cuerpo === null) {
      comprobaciones.push(
        sinMedir(
          `Consulta_RCCOOR · sigue respondiendo a ${PARAM_RCCOOR.x}/${PARAM_RCCOOR.y}`,
          TIPO_RCCOOR.CANDIDATOS,
          p,
        ),
        sinMedir(
          'Consulta_RCCOOR · la ruta pc1/pc2 sigue existiendo y suma 14',
          LONGITUD_REFCAT_PARCELA,
          p,
        ),
      )
    } else {
      const leido = leerRccoor(cuerpo)
      const responde = leido.tipo === TIPO_RCCOOR.CANDIDATOS
      const pc = pcDelPrimerCandidato(jsonONulo(cuerpo))
      const refcat = pc === null ? null : `${pc.pc1 ?? ''}${pc.pc2 ?? ''}`
      const rutaIntacta = typeof refcat === 'string' && refcat.length === LONGITUD_REFCAT_PARCELA

      comprobaciones.push(
        comprobacion(`Consulta_RCCOOR · sigue respondiendo a ${PARAM_RCCOOR.x}/${PARAM_RCCOOR.y}`, {
          esperado: TIPO_RCCOOR.CANDIDATOS,
          observado: { tipo: leido.tipo, cuantos: leido.cuantos, cod: leido.cod, des: leido.des },
          ok: responde,
          nota: responde
            ? 'El endpoint `.svc/json` sigue entendiendo los nombres de parámetro de ESTE ' +
              'endpoint, que no son los del `.asmx`.'
            : 'El endpoint ha dejado de resolver el punto medido. Si contesta un `cod` ' +
              'desconocido, `leerRccoor` lo clasifica como fallo NUESTRO y no como «aquí no ' +
              'hay parcela» (defensa 3), que es el lado seguro: NO metas ese código en ' +
              '`COD_OVC_SIN_REFERENCIA` para «que no dé error».',
        }),
        comprobacion('Consulta_RCCOOR · la ruta pc1/pc2 sigue existiendo y suma 14', {
          esperado: {
            ruta: `${CLAVE_ENVOLTORIO_RCCOOR}.coordenadas.coord[0].pc.pc1/pc2`,
            longitud: LONGITUD_REFCAT_PARCELA,
            refcatDelFixture: esperado.refcatRccoorFixture,
          },
          observado: { pc, refcat, longitud: refcat === null ? null : refcat.length },
          ok: rutaIntacta,
          nota:
            rutaIntacta
              ? 'La referencia sigue llegando PARTIDA en dos campos de 7 y sigue sin haber ' +
                'ningún campo con los 14 juntos: hay que concatenar, y comprobar el total.'
              : 'La ruta de la referencia catastral ha cambiado o ya no suma ' +
                `${LONGITUD_REFCAT_PARCELA}. \`leerCandidato\` devolvería «fallo» y la ` +
                'geocodificación inversa dejaría de deducir la parcela del centroide.',
        }),
      )
    }
  }

  // ── `Consulta_RCCOOR` con los parámetros del OTRO endpoint ──────────────────
  {
    const p = con('rccoor-parametros-del-asmx')
    const cuerpo = cuerpoDe(p)

    if (cuerpo === null) {
      comprobaciones.push(
        sinMedir(
          'Consulta_RCCOOR · los parámetros del .asmx siguen dando error de parámetro',
          esperado.codAsmxFixture,
          p,
        ),
        sinMedir(
          'Consulta_RCCOOR · ese error se sigue clasificando como fallo NUESTRO',
          esperado.tipoRccoorAsmxFixture,
          p,
        ),
      )
    } else {
      const crudo = jsonONulo(cuerpo)
      const envoltorio = objeto(crudo) === null ? null : objeto(crudo[CLAVE_ENVOLTORIO_RCCOOR])
      const control = envoltorio === null ? null : objeto(envoltorio.control)
      const cuerr = control === null ? undefined : control.cuerr
      const lerr = envoltorio === null ? undefined : envoltorio.lerr
      const primerError = Array.isArray(lerr) && lerr.length > 0 ? objeto(lerr[0]) : null
      const cod = primerError === null ? null : primerError.cod
      const des = primerError === null ? null : primerError.des ?? null
      const leido = leerRccoor(cuerpo)

      const hayError = typeof cuerr === 'number' && cuerr > 0 && cod === esperado.codAsmxFixture
      comprobaciones.push(
        comprobacion('Consulta_RCCOOR · los parámetros del .asmx siguen dando error de parámetro', {
          esperado: { clave: 'control.cuerr', cod: esperado.codAsmxFixture },
          observado: { cuerr: cuerr ?? null, cod, des },
          ok: hayError,
          nota: hayError
            ? 'Los dos endpoints de geocodificación siguen SIN compartir los nombres de sus ' +
              'parámetros, y el `.svc/json` sigue diciéndolo con el vocabulario de un ' +
              'resultado negativo (HTTP 200 + `cuerr`). Esto es lo que justifica las tres ' +
              'defensas de `services/_catastro-ovc.js`.'
            : 'El endpoint ya no contesta el error de parámetro que se midió. Si ha empezado a ' +
              'ACEPTAR `Coordenada_X`/`Coordenada_Y`, la trampa de la cabecera de ' +
              '`_catastro-ovc.js` deja de existir; si contesta otro código, hay que ver cuál ' +
              'antes de tocar nada. En ningún caso se añade un código a ' +
              '`COD_OVC_SIN_REFERENCIA` para silenciarlo.',
        }),
        comprobacion('Consulta_RCCOOR · ese error se sigue clasificando como fallo NUESTRO', {
          esperado: esperado.tipoRccoorAsmxFixture,
          observado: { tipo: leido.tipo, cod: leido.cod },
          ok: leido.tipo === esperado.tipoRccoorAsmxFixture,
          nota:
            leido.tipo === esperado.tipoRccoorAsmxFixture
              ? 'La defensa 3 sigue haciendo su trabajo: un `cod` fuera de la tabla sale como ' +
                'fallo técnico de ESTA aplicación, no como «aquí no hay parcela».'
              : `Con la respuesta de hoy, \`leerRccoor\` devuelve ${leido.tipo}. Si eso es ` +
                `${TIPO_RCCOOR.SIN_REFERENCIA}, una URL mal construida —bug nuestro, ` +
                'reproducible en el 100 % de las peticiones— se le estaría enseñando al ' +
                'usuario como «aquí no hay parcela». Es el error silencioso que la regla de ' +
                'oro 1 prohíbe.',
        }),
      )
    }
  }

  // ── Cabeceras: CORS y tipo de contenido ─────────────────────────────────────
  {
    const conCabeceras = [...respuestas.values()].filter((p) => p.cabeceras !== null)
    const acao = conCabeceras.map((p) => ({ peticion: p.nombre, acao: p.cabeceras.acao }))
    const sinComodin = acao.filter((a) => a.acao !== '*')

    if (conCabeceras.length === 0) {
      comprobaciones.push(
        sinMedir('cabeceras · Access-Control-Allow-Origin: * sigue presente', '*', {
          titulo: 'ninguna',
          motivo: 'SIN_CABECERAS',
          mensaje: 'no ha llegado ninguna respuesta de la que leer cabeceras',
        }),
        sinMedir('cabeceras · el content-type sigue siendo el de su familia', 'xml / json', {
          titulo: 'ninguna',
          motivo: 'SIN_CABECERAS',
          mensaje: 'no ha llegado ninguna respuesta de la que leer cabeceras',
        }),
      )
    } else {
      comprobaciones.push(
        comprobacion('cabeceras · Access-Control-Allow-Origin: * sigue presente', {
          esperado: `«*» en las ${conCabeceras.length} respuestas que han llegado`,
          observado: {
            acao,
            // PROCEDENCIA.md anota que ACAO es la ÚNICA cabecera CORS presente: se
            // deja como dato para que se vea si eso cambia, sin convertirlo en
            // criterio (una `-Headers` de más no rompería nada nuestro).
            cabecerasCorsPresentes: [...new Set(conCabeceras.flatMap((p) => p.cabeceras.cors))],
          },
          ok: sinComodin.length === 0,
          nota:
            sinComodin.length === 0
              ? 'El CORS abierto sigue ahí, que es lo que permite que esto sea un frontend puro ' +
                'sin proxy. Ojo: leer la cabecera NO es comprobar que el navegador acepte la ' +
                'respuesta (ver `noSePuedeSaber`).'
              : 'Estas respuestas ya no traen el comodín: ' +
                sinComodin.map((a) => a.peticion).join(', ') +
                '. Si se confirma, la app deja de poder hablar con el Catastro desde el ' +
                'navegador y hay que apuntar `CATASTRO_WFS_CP` / `CATASTRO_OVC_RCCOOR_JSON` a ' +
                'un proxy — que están en un solo sitio precisamente para esto (regla de oro 7).',
        }),
      )

      // La familia se DERIVA de la extensión del fixture de cada caso: `.xml` →
      // el content-type debe hablar de XML; `.json` → de JSON. No hay una lista
      // de tipos MIME escrita a mano.
      const tipos = [...respuestas.values()].map((p) => ({
        peticion: p.nombre,
        familia: p.familia,
        tipoContenido: p.tipoContenido,
      }))
      const discordantes = tipos.filter(
        (t) =>
          typeof t.tipoContenido !== 'string' ||
          !t.tipoContenido.toLowerCase().includes(t.familia),
      )
      comprobaciones.push(
        comprobacion('cabeceras · el content-type sigue siendo el de su familia', {
          esperado: 'cada respuesta declara un content-type que nombra su familia (xml / json)',
          observado: tipos,
          ok: discordantes.length === 0,
          nota:
            discordantes.length === 0
              ? 'El `charset=utf-8` de la cabecera es el que obedece `fetch().text()`, y es lo ' +
                'que salva a los XML de su propia declaración `ISO-8859-1`.'
              : 'Estas respuestas no declaran el tipo esperado: ' +
                discordantes
                  .map((t) => `${t.peticion} → ${JSON.stringify(t.tipoContenido)}`)
                  .join('; ') +
                '. Si el «charset» desaparece o cambia, el texto que entrega el transporte ' +
                'puede dejar de estar bien decodificado.',
        }),
      )
    }
  }

  // ── El encoding: el XML sigue mintiendo sobre sí mismo (o ha dejado) ────────
  {
    const xml = [...respuestas.values()].filter((p) => p.familia === 'xml' && cuerpoDe(p) !== null)

    if (xml.length === 0) {
      comprobaciones.push(
        sinMedir('encoding · los XML siguen declarando ISO-8859-1', esperado.encodingEsperado, {
          titulo: 'ninguna respuesta XML',
          motivo: 'SIN_CUERPO',
          mensaje: 'ninguna de las peticiones XML ha traído cuerpo',
        }),
        sinMedir('encoding · el byte acentuado sobrevive', 'ningún carácter de reemplazo', {
          titulo: 'ninguna respuesta XML',
          motivo: 'SIN_CUERPO',
          mensaje: 'ninguna de las peticiones XML ha traído cuerpo',
        }),
      )
    } else {
      const declarados = xml.map((p) => {
        const declaracion = parsearXml(p.texto).declaracion
        return {
          peticion: p.nombre,
          encoding:
            declaracion === null || declaracion.encoding === null
              ? null
              : declaracion.encoding.toLowerCase(),
        }
      })
      const discordantes = declarados.filter((d) => !esperado.encodingEsperado.includes(d.encoding))
      comprobaciones.push(
        comprobacion('encoding · los XML siguen declarando ISO-8859-1', {
          esperado: esperado.encodingEsperado,
          observado: declarados,
          ok: discordantes.length === 0,
          nota:
            discordantes.length === 0
              ? 'Los XML siguen declarando un encoding que NO es el de sus bytes. No se ' +
                'corrige y no se obedece: quien lea estos ficheros desde disco los decodifica ' +
                'como UTF-8 e ignora la declaración.'
              : `Ha cambiado la declaración en: ${discordantes
                  .map((d) => `${d.peticion} → ${JSON.stringify(d.encoding)}`)
                  .join('; ')}. Si ahora declara UTF-8, el servicio ha dejado de mentir sobre ` +
                'sí mismo: buena noticia, y hay que actualizar el hecho transversal 4 de ' +
                'PROCEDENCIA.md y el guardián de encoding de `gml/`.',
        }),
      )

      // El byte acentuado: si los bytes fueran de verdad ISO-8859-1, decodificarlos
      // como UTF-8 —que es lo que hace `response.text()` obedeciendo la cabecera—
      // dejaría caracteres de reemplazo (U+FFFD). Que no haya ninguno Y que haya
      // caracteres no ASCII es la prueba de que los bytes son UTF-8.
      const noAscii = xml.map((p) => ({
        peticion: p.nombre,
        noAscii: (p.texto.match(/[^\x00-\x7F]/g) ?? []).length,
        reemplazos: (p.texto.match(/\uFFFD/g) ?? []).length,
        muestra: (p.texto.match(/[^\x00-\x7F][^\s<]*/) ?? [null])[0],
      }))
      const totalNoAscii = noAscii.reduce((n, x) => n + x.noAscii, 0)
      const totalReemplazos = noAscii.reduce((n, x) => n + x.reemplazos, 0)

      if (totalNoAscii === 0) {
        advertencias.push(
          'La comprobación del byte acentuado ha salido VACUA: ninguna de las respuestas XML ' +
            'de hoy trae un solo carácter no ASCII, así que no hay nada que pueda romperse al ' +
            'decodificar. No es un fallo; es una limitación de la medida, y se dice en vez de ' +
            'fingir que se ha comprobado algo.',
        )
      }
      comprobaciones.push(
        comprobacion('encoding · el byte acentuado sobrevive', {
          esperado: 'caracteres no ASCII presentes y CERO caracteres de reemplazo (U+FFFD)',
          observado: { porPeticion: noAscii, totalNoAscii, totalReemplazos },
          ok: totalNoAscii === 0 ? null : totalReemplazos === 0,
          nota:
            totalNoAscii === 0
              ? 'NO SE HA PODIDO COMPROBAR: no ha llegado ningún carácter acentuado, así que la ' +
                'comprobación sería vacua. Ver `advertencias`.'
              : totalReemplazos === 0
                ? 'Los acentos llegan enteros: los bytes son UTF-8 y la cabecera HTTP ' +
                  '(`charset=utf-8`) manda sobre la declaración del prólogo, que miente. Esto ' +
                  'es lo que sostiene que `services/_red.js` NO transcodifique a mano.'
                : `Han llegado ${totalReemplazos} caracteres de reemplazo (U+FFFD): el texto ` +
                  'que entrega el transporte está ROTO. O los bytes ya no son UTF-8, o la ' +
                  'cabecera ha dejado de decir `charset=utf-8`. Un `ldt` o un `ExceptionText` ' +
                  'con acentos se le enseñaría al usuario con basura dentro.',
        }),
      )
    }
  }

  return { comprobaciones, advertencias }
}

// ── Lo que esta sonda NO puede saber ──────────────────────────────────────────

/**
 * Los límites PERMANENTES de esta medición. Van dentro del veredicto, y no solo
 * en un comentario, porque el formato de este repo lo pide: **lo que no se puede
 * medir se declara por escrito** (`scripts/smoke-navegador/GUION.md` §3). Quien
 * cite un resultado de esta sonda tiene que poder leer al lado qué no cubre.
 *
 * @readonly
 */
const NO_SE_PUEDE_SABER = Object.freeze([
  'SI EL CATASTRO NOS HA BLOQUEADO. La política de uso contempla denegación del servicio ~10 ' +
    'días por uso abusivo, y nadie ha medido —ni va a medir— qué contesta el servicio a un ' +
    'cliente denegado: provocarlo es la conducta que se sanciona. Una tanda de fallos con ' +
    'motivo SIN_RED es compatible con estar bloqueados, con estar sin internet, con un DNS ' +
    'caído y con que el servicio esté apagado. Esta sonda no los distingue.',
  'SI LA APP FUNCIONA. Aquí se mide el CONTRATO del servicio, no el comportamiento de la ' +
    'aplicación. Verde no significa «la app va bien»; rojo no significa «la app está rota hoy».',
  'SI EL NAVEGADOR ACEPTARÍA ESTAS RESPUESTAS. Esto corre en Node, donde no hay política de ' +
    'mismo origen: se LEE la cabecera `Access-Control-Allow-Origin`, que es el dato, pero no se ' +
    'ejerce el comportamiento. Y solo la petición SIMPLE está respaldada por medición: no hay ' +
    '`-Headers` ni `-Methods`, así que nadie debe añadir cabeceras a estas peticiones.',
  'QUÉ CONTESTA EL ENDPOINT `.asmx` DE GEOCODIFICACIÓN. Nunca se ha medido (hueco declarado en ' +
    'PROCEDENCIA.md) y el proyecto no lo usa: sondearlo sería una petición más para medir algo ' +
    'que no está en ningún camino de la app.',
  'QUÉ CONTESTA `Consulta_RCCOOR` CON UN SRS INVÁLIDO (el `cod:16` del fixture). No se sondea ' +
    'porque `urlRccoor` valida el SRS ANTES de emitir (defensa 1): esa petición no puede ' +
    'existir saliendo de la app, y gastar una llamada en provocarla sería medir un camino ' +
    'muerto.',
  'CUÁNTAS PARCELAS TRAE UNA CAJA SIN `count`. Se midieron 539 y ~1,15 MB una vez, y no se ' +
    'repite: es precisamente la descarga masiva accidental contra la que existe ' +
    '`COUNT_BBOX_DEFECTO`.',
])

// ── Salida legible ────────────────────────────────────────────────────────────

const linea = (s = '') => process.stdout.write(`${s}\n`)

/** Marca de tres caracteres, en ASCII a propósito (esto se lee en una consola). */
function marca(ok) {
  return ok === true ? 'OK' : ok === false ? 'NO' : '??'
}

/** Serializa un valor del veredicto para que quepa en una línea de consola. */
function corto(valor, maximo = 150) {
  const texto = typeof valor === 'string' ? valor : JSON.stringify(valor)
  if (typeof texto !== 'string') return String(valor)
  return texto.length <= maximo ? texto : `${texto.slice(0, maximo - 1)}…`
}

/**
 * Imprime el veredicto para una persona. La sonda la lanza alguien a mano, así
 * que el JSON no basta: hace falta poder leer de un vistazo qué cayó y por qué.
 *
 * @param {Object} veredicto
 */
function imprimirLegible(veredicto) {
  linea('')
  linea('  SONDA DEL CONTRATO DEL SERVICIO DEL CATASTRO')
  linea('  ═══════════════════════════════════════════════════════════════════════')
  linea(`  ${veredicto.fecha}`)
  linea('')
  linea('  Roja NO significa «la app está rota hoy»: significa «el servicio ha')
  linea('  cambiado y los fixtures ya no representan la realidad».')
  linea('')

  linea('  PETICIONES')
  linea('  ───────────────────────────────────────────────────────────────────────')
  for (const p of veredicto.peticiones) {
    const desenlace = p.ok ? `${p.estado} · ${p.ms} ms` : `${p.motivo} · ${p.ms} ms`
    linea(`  ${p.ok ? 'OK' : 'NO'}  ${p.titulo}`)
    linea(`      ${desenlace}   (intentos: ${p.intentos})`)
    linea(`      ${p.url}`)
  }
  const t = veredicto.transporte
  linea('')
  linea(
    `  Transporte: ${t.peticiones} peticiones emitidas, ${t.exitos} con éxito, ` +
      `${t.fallidas} fallidas, ${t.reintentos} reintentos.`,
  )

  linea('')
  linea('  COMPROBACIONES')
  linea('  ───────────────────────────────────────────────────────────────────────')
  for (const c of veredicto.comprobaciones) {
    linea(`  ${marca(c.ok)}  ${c.nombre}`)
    if (c.ok !== true) {
      linea(`        esperado   ${corto(c.esperado)}`)
      linea(`        observado  ${corto(c.observado)}`)
    }
    linea(`        ${c.nota.replace(/\s+/g, ' ')}`)
    linea('')
  }

  if (veredicto.advertencias.length > 0) {
    linea('  ADVERTENCIAS  (no cambian el veredicto)')
    linea('  ───────────────────────────────────────────────────────────────────────')
    for (const a of veredicto.advertencias) linea(`  ·  ${a}`)
    linea('')
  }

  linea('  LO QUE ESTA SONDA NO PUEDE SABER')
  linea('  ───────────────────────────────────────────────────────────────────────')
  for (const n of veredicto.noSePuedeSaber) linea(`  ·  ${n.replace(/\s+/g, ' ')}`)
  linea('')

  const cuenta = veredicto.resumen
  linea('  VEREDICTO')
  linea('  ═══════════════════════════════════════════════════════════════════════')
  linea(`  ${cuenta.enVerde} en verde · ${cuenta.enRojo} en rojo · ${cuenta.sinMedir} sin medir`)
  linea('')
  if (veredicto.ok === true) {
    linea('  EL CONTRATO SIGUE EN PIE. Los fixtures de test/fixtures/catastro/ siguen')
    linea('  representando lo que el servicio contesta hoy. (Salida 0.)')
  } else if (veredicto.ok === false) {
    linea('  EL CONTRATO HA DERIVADO. Lee arriba QUÉ comprobación ha caído y su nota.')
    linea('  El orden correcto: medir el caso a mano con curl → recapturar ESE fixture')
    linea('  → actualizar PROCEDENCIA.md → y solo entonces, si hace falta, services/.')
    linea('  (Salida 1.)')
  } else {
    linea('  NO SE HA PODIDO COMPROBAR. Ninguna comprobación ha salido en rojo, pero')
    linea('  faltan mediciones: el servicio no ha contestado a todo. Esto NO es «el')
    linea('  contrato ha cambiado». Vuelve a intentarlo más tarde. (Salida 2.)')
  }
  linea('')
}

// ── Programa ──────────────────────────────────────────────────────────────────

/**
 * @param {Comprobacion[]} comprobaciones
 * @returns {{ok: boolean|null, codigoSalida: 0|1|2, resumen: Object}}
 */
function concluir(comprobaciones) {
  const enRojo = comprobaciones.filter((c) => c.ok === false).length
  const sin = comprobaciones.filter((c) => c.ok === null).length
  const enVerde = comprobaciones.length - enRojo - sin
  const ok = enRojo > 0 ? false : sin > 0 ? null : true
  return {
    ok,
    codigoSalida: ok === false ? 1 : ok === null ? 2 : 0,
    resumen: { total: comprobaciones.length, enVerde, enRojo, sinMedir: sin },
  }
}

async function principal() {
  const soloJson = process.argv.slice(2).includes('--json')

  const { peticiones, esperado, advertencias } = prepararse()

  const registroDeCabeceras = new Map()
  const avisosDelTransporte = []
  const red = crearTransporte({
    fetch: fetchQueApunta(registroDeCabeceras),
    // El canal de avisos del proyecto, recogido en vez de impreso: los fallos de
    // red ya salen en el veredicto con su petición, y duplicarlos por consola
    // enturbiaría la lectura. Que se recojan —y no se tiren— es la regla de oro 1.
    alAvisar: (mensaje, detalle) => {
      avisosDelTransporte.push(`${(detalle && detalle.nivel) || 'AVISO'}: ${mensaje}`)
    },
  })

  let emitidas
  try {
    emitidas = await emitirTodas(red, peticiones, registroDeCabeceras)
  } finally {
    red.destruir()
  }

  const juicio = juzgar(esperado, emitidas)
  const todasLasAdvertencias = [...advertencias, ...juicio.advertencias]
  const estado = red.estado()
  if (estado.reintentos > 0) {
    todasLasAdvertencias.push(
      `El transporte ha reintentado ${estado.reintentos} ` +
        `${estado.reintentos === 1 ? 'vez' : 'veces'}: ` +
        'alguna petición falló con 5xx o no llegó a haber respuesta. No lo decide esta sonda ' +
        '(el backoff vive en `services/_red.js`), pero conviene saberlo: el servicio no iba fino.',
    )
  }
  for (const aviso of avisosDelTransporte) {
    todasLasAdvertencias.push(`El transporte avisó: ${aviso}`)
  }

  const { ok, codigoSalida, resumen } = concluir(juicio.comprobaciones)
  const veredicto = {
    ok,
    codigoSalida,
    fecha: new Date().toISOString(),
    resumen,
    comprobaciones: juicio.comprobaciones,
    advertencias: todasLasAdvertencias,
    noSePuedeSaber: [...NO_SE_PUEDE_SABER],
    peticiones: [...emitidas.values()].map((p) => ({
      nombre: p.nombre,
      titulo: p.titulo,
      url: p.url,
      urlMedida: p.urlMedida,
      ok: p.ok,
      estado: p.estado,
      motivo: p.motivo,
      mensaje: p.mensaje,
      intentos: p.intentos,
      ms: p.ms,
      tipoContenido: p.tipoContenido,
      bytes: typeof p.texto === 'string' ? p.texto.length : null,
      acao: p.cabeceras === null ? null : p.cabeceras.acao,
    })),
    transporte: estado,
  }

  if (!soloJson) imprimirLegible(veredicto)
  linea(JSON.stringify(veredicto, null, 2))
  process.exitCode = codigoSalida
}

principal().catch((error) => {
  linea('')
  if (error && error[ERROR_DE_PREPARACION]) {
    linea('  LA SONDA NO SE HA PODIDO PREPARAR')
    linea('  ───────────────────────────────────────────────────────────────────────')
    linea(`  ${error.message}`)
    linea('')
    linea('  Esto es un problema de ESTE repositorio, no del Catastro: no se ha llegado')
    linea('  a emitir ninguna petición. Sale con 2 («no lo sé») y no con 1 («el contrato')
    linea('  ha derivado»), porque no es lo mismo y confundirlos manda a arreglar lo que')
    linea('  no es.')
  } else {
    linea('  LA SONDA HA FALLADO DE UNA FORMA NO PREVISTA')
    linea('  ───────────────────────────────────────────────────────────────────────')
    linea(`  ${error && error.stack ? error.stack : String(error)}`)
    linea('')
    linea('  No se puede afirmar nada del contrato del servicio a partir de esto.')
  }
  linea('')
  process.exitCode = 2
})
