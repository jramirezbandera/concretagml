// parsers/dxf.js — F01 · Parser DXF PROPIO (sin librería), CONSCIENTE DE SECCIONES.
//
// Lee geometría de parcela SOLO de la sección ENTITIES (espacio-modelo) de un DXF
// ASCII de AutoCAD. El parser NO comprueba $ACADVER: lee cualquier versión (los
// fixtures reales son AC1024/AC1027). El mínimo AC1014/R14 del override O12 es una
// restricción de EXPORTACIÓN (F10), NO de lectura ("No afecta a la lectura"). NO
// desciende a BLOCKS (sus LWPOLYLINE llevan coordenadas LOCALES del bloque, p. ej.
// −44.46, que NO son geometría de parcela), ni a TABLES/OBJECTS/HEADER/CLASSES.
//
// POR QUÉ UNA MÁQUINA DE ESTADOS Y NO grep (crítico): en DXF el "código de grupo"
// es CONTEXTUAL. El código 42 solo es *bulge* dentro de una LWPOLYLINE/VERTEX; en
// un INSERT el 42 es el factor de escala en Y. El fixture real UTM.dxf lo demuestra:
// sus 3 bloques "LOGO" (INSERT) llevan 41/42/43 = 0.6011385410059346 (escala X/Y/Z),
// que un grep de "42" confundiría con 3 arcos inexistentes. Solo procesando la
// sección ENTITIES y, dentro, cada entidad por su tipo, el 42 se interpreta bien.
//
// Reglas de oro (SPEC §2): 1 ninguna decisión silenciosa (toda entidad descartada,
// arco discretizado o Z eliminada se materializa en una Deteccion); 3 modelo en UTM
// crudo, sin lat/lon; 4 POJO plano `[x,y]`; 5/6 solo helpers propios / geo/arco.js,
// nunca turf. El parser NO cierra ni normaliza el anillo: entrega vértices crudos y
// el orquestador aguas abajo (geo/huso, geo/cierre, model) hace el saneado.
//
// Discretización de arcos: se delega ENTERAMENTE en geo/arco.js#discretizarBulge
// (no se reimplementa la matemática). Convención: devuelve SOLO los vértices NUEVOS
// intermedios (sin P1 ni P2); el tramo se reconstruye como [P1, ...vertices, P2].
//
// ── F11 · LA CAPA (código de grupo 8) ────────────────────────────────────────
//
// F01 leía la geometría y TIRABA la capa. Es el discriminante que el fichero ya
// trae y sin el cual no se puede decir cuáles de las N polilíneas son la parcela
// (o las huellas del edificio): en `UTM.dxf` hay 25 anillos repartidos en 5
// capas y DIECISÉIS son mobiliario de dibujo (cajetín, marco, leyenda). Desde
// F11 se devuelve `capas[]`, en paralelo a `anillos[]` y con la misma longitud.
//
//   · LITERAL, sin bajar a minúsculas: el usuario reconoce sus nombres de capa
//     («Construccion» no es «construccion»). Solo se recorta el espacio, que es
//     ruido de formato y no puede formar parte de un nombre de capa de AutoCAD.
//   · `''` si la entidad no traía código 8 (nunca `undefined`: quien recorra
//     `capas[i]` tiene siempre un string, y el hueco se ve).
//   · ⚠️ MEDIDO y contraintuitivo: en una POLYLINE clásica la capa la lleva la
//     CABECERA, no los VERTEX ni el SEQEND. En el fixture real de edificio el
//     SEQEND dice `0` mientras la POLYLINE dice `Construccion`; en
//     poly_clasica.dxf los VERTEX sí repiten `8/0`. Por eso `abrirPoly` captura
//     la capa y `cerrarPoly` la usa: leerla del SEQEND daría `0` para las siete
//     huellas del edificio, y el reparto saldría mal EN SILENCIO.
//
// ── EL FLAG DE CIERRE (código de grupo 70, bit 0) ────────────────────────────
//
// El parser YA lo leía —`verts.closed`— pero solo para decidir si dibujar el
// tramo Vn-1→V0, y después lo TIRABA. Es un dato que el fichero afirma y que
// aguas abajo no se puede reconstruir: `parsers/importar.js` solo ve una lista de
// vértices y, cuando el último cae cerca del primero, no sabe si eso es un
// vértice de cierre mal tecleado o una arista corta de verdad — así que pregunta.
//
// ⚠️ MEDIDO en `icuc-pruebas/UTM.dxf` (2026-08-15): una POLYLINE con `70=1` cuyos
// 21 vértices son cuatro lados rectos (9–15 m) y un arco de 17 tramos de 0,11 a
// 0,24 m. El tramo de cierre mide 0,1118 m —dentro de la banda ambigua de 0,5 m—
// y AutoCAD lo dibuja cerrado, así que el usuario veía un anillo cerrado en
// pantalla y la aplicación preguntándole por un error de cierre. Los dos tenían
// razón: el fichero NO repite V0, y a la vez declara el anillo cerrado.
//
// Con `70=1` esa ambigüedad se estrecha: la lectura «Vúltimo es V0 repetido con
// una errata» queda descartada —para eso está el flag, para NO tener que repetir
// V0—, y el tramo de cierre es una arista que el CAD dibuja. Se devuelve como
// `cerrados[]`, en paralelo a `anillos[]` y `capas[]` y con la misma longitud,
// exactamente igual que hizo F11 con la capa. Quien lo INTERPRETA es
// `parsers/importar.js#resolverCierre`; aquí solo se transporta.
//
// POR QUÉ ESTE MÓDULO NO EMITE NINGUNA DETECCIÓN NUEVA POR LA CAPA (decidido al
// medirlo, F11·T1.1): `test/export/dxf.test.js` exige `detecciones` EXACTAMENTE
// vacías al releer el DXF que escribe `export/dxf.js`, que tiene DOS capas
// (`PARCELA_OFICIAL` / `PARCELA_EDITADA`). Cualquier detección de reparto —aun
// condicionada a «más de una capa»— pondría roja esa prueba, que no es de F11 y
// que además tiene razón: releer un fichero propio no es una anomalía. El
// resumen legible del reparto («25 polilíneas en 5 capas: FINO 16, LINDE 4…») lo
// emite `parsers/importar.js`, que es por donde pasan TODOS los consumidores del
// reparto, y así este parser sigue siendo estrictamente aditivo: mismos anillos,
// mismas detecciones, un campo más.

import { crearDeteccion, declinar, TIPO_DETECCION, SEVERIDAD } from './_comun.js'
import { discretizarBulge } from '../geo/arco.js'

/** Procedencia fijada por este parser (uno de ORIGEN_PARCELA en model/parcela.js). */
const ORIGEN = 'DXF'

// ── Clasificación de entidades de ENTITIES ────────────────────────────────────
//
// ANILLO: forma un recinto → se extrae como anillo.
// NO_SOPORTADA (AVISO): entidad que un usuario podría CREER que aporta geometría
//   de parcela pero que deliberadamente no soportamos (bloques, splines, hatch…).
//   Una Deteccion AVISO por ocurrencia, con la guía del feature (LIMPIA/PURGE).
// ANOTACION (INFO, resumida): rótulos y cotas; hay muchas → NUNCA una por cada
//   una (regla del feature): se resumen en UNA sola Deteccion.
// PUNTO (2026-08-18): `POINT` suelto → se DEVUELVE en `puntos[]`. No forma anillo,
//   pero en un levantamiento es EL dato (hay ficheros con 88 puntos y cero
//   polilíneas). Ver {@link puntoDe}. Ya NO cae en el resumen de abajo.
// El resto (LINE, IMAGE…): no forman anillo por sí solas → se resumen en
//   UNA Deteccion INFO "otras entidades ignoradas".

const ENT_NO_SOPORTADA = new Set([
  'INSERT', 'SPLINE', 'HATCH', '3DFACE', 'ELLIPSE', 'MLINE', 'REGION',
  'XLINE', 'RAY', 'BODY', '3DSOLID', 'SOLID', 'SURFACE', 'MESH', 'ACAD_PROXY_ENTITY',
])
const ENT_ANOTACION = new Set([
  'TEXT', 'MTEXT', 'DIMENSION', 'LEADER', 'MLEADER', 'MULTILEADER',
  'ATTDEF', 'ATTRIB', 'TOLERANCE',
])

// La guía única que acompaña a cada aviso de entidad no soportada (feature
// §Alcance) vive desde F14 en `parsers/_comun.js#SUJETO`, junto a las tres
// declinaciones del sujeto: **no es la misma para una parcela y para una
// construcción**, y no por el sustantivo. A una parcela se le dice «deja SOLO la
// polilínea»; a una construcción eso le haría perder doce de las trece partes.

// ── Lector genérico de pares (código, valor) ──────────────────────────────────

/**
 * Trocea el texto DXF en pares [códigoTrim, valorCrudo] línea a línea. El DXF ASCII
 * es estrictamente alternante: línea impar = código de grupo (a veces con sangría/
 * espacios → se recorta), línea par = valor. Tolera fin de línea Windows (\r\n) y
 * un BOM inicial. NO recorta el valor (una coord con espacios la absorbe parseFloat;
 * los nombres de tipo/sección se recortan en el punto de uso).
 *
 * ⛔ H3 (auditoría 2026-08-15) · Emparejar por POSICIÓN ABSOLUTA de línea era
 * frágil: con UNA línea en blanco inicial todos los pares quedaban corridos uno
 * —cada «valor» se leía como «código» y viceversa— y el parser devolvía
 * `anillos: []` con `detecciones: []`, la violación exacta de la regla 1 que la
 * cabecera de este fichero promete no cometer. La resincronización es
 * CONSERVADORA a propósito: un código de grupo es SIEMPRE un entero, pero un
 * VALOR puede ser cualquier texto (incluso uno que parece un entero), así que
 * solo se descartan líneas INICIALES hasta la primera que parsea como código;
 * a partir de ahí la alternancia manda, como siempre. Lo descartado se cuenta
 * y `parseDXF` lo materializa como detección (nada se corrige callado).
 *
 * @param {string} texto
 * @returns {{ pares: Array<[string, string]>, lineasDescartadas: number,
 *   descartadasNoVacias: boolean }}  `lineasDescartadas` = nº de líneas
 *   iniciales saltadas para realinear; `descartadasNoVacias` = alguna tenía
 *   contenido (no era solo una línea en blanco).
 */
function leerPares(texto) {
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1) // BOM
  const lineas = texto.split(/\r?\n/)
  let inicio = 0
  let descartadasNoVacias = false
  while (inicio < lineas.length && !/^\s*\d+\s*$/.test(lineas[inicio])) {
    if (lineas[inicio].trim() !== '') descartadasNoVacias = true
    inicio++
  }
  const pares = []
  for (let i = inicio; i + 1 < lineas.length; i += 2) {
    pares.push([lineas[i].trim(), lineas[i + 1]])
  }
  return { pares, lineasDescartadas: inicio, descartadasNoVacias }
}

// ── Parser público ────────────────────────────────────────────────────────────

// ── F22 · LOS RÓTULOS, QUE HASTA AHORA SE TIRABAN ────────────────────────────
//
// F01 contaba las anotaciones y las resumía en una detección. Es correcto para la
// GEOMETRÍA —un `TEXT` no es un anillo— y era una pérdida para todo lo demás: el
// DXF de «Consulta Masiva» del Catastro trae **la referencia catastral de cada
// finca rotulada dentro de ella**, en una capa propia (`RefCatastral`), y con eso
// se puede preguntar «¿cuál de estas ocho es la tuya?» con los códigos delante en
// vez de con «Recinto 3». Medido: los 8 rótulos caen 1:1 en los 8 recintos.
//
// Se devuelven CRUDOS y sin interpretar: este parser no sabe qué es una
// referencia catastral ni qué capa las contiene. Quien empareja rótulo y recinto
// es `parsers/topologia.js`, y quien decide qué capa nombra las fincas es
// `parsers/importar.js` — y lo decide MIDIENDO, no por el nombre de la capa (F11
// ya pagó que en `UTM.dxf` la parcela buena está en la capa «0» y no en la que se
// llama «PARCELA»).
//
// ⚠️ **La trampa del punto de inserción, que es de manual y muerde en silencio.**
// En un `TEXT`, el 10/20 es el «primer punto de alineación» y **solo es la
// posición real si el texto está alineado a la izquierda**. Con justificación
// (códigos 72/73 distintos de 0) la posición de verdad es el **11/21**, y el
// 10/20 puede ser cualquier cosa. Los ocho rótulos del fichero real traen
// **72=1 y 73=1** —centrado— así que la regla APLICA; lo que pasa es que ese
// escritor duplica el punto en los dos sitios y **10/20 y 11/21 coinciden
// exactamente**. O sea: el fixture NO ejercita esta rama, y se dice en vez de
// dejar que parezca probada. Se implementa igual porque el siguiente fichero
// puede no ser tan amable, y el fallo sería mudo (rótulos en 0,0 que no caen en
// ningún recinto).
//
// ⚠️ El texto va LITERAL, sin quitar los códigos de formato de un `MTEXT`
// (`\A1;`, `{\f…}`). Los rótulos que interesan son `TEXT` planos; limpiar MTEXT
// es un problema propio y no se resuelve de refilón.

/** Entidades con estructura de texto: el 11/21 manda si hay justificación. */
const ENT_CON_ALINEACION = new Set(['TEXT', 'ATTRIB', 'ATTDEF'])

/**
 * Extrae el rótulo de una entidad de anotación, o `null` si no lo tiene.
 *
 * @param {string} tipo
 * @param {Array<[string, string]>} grupos
 * @returns {{tipo: string, capa: string, texto: string, x: number, y: number}|null}
 */
function rotuloDe(tipo, grupos) {
  let texto = ''
  const chunks = [] // MTEXT parte el texto largo en códigos 3 + un 1 final.
  let x = NaN
  let y = NaN
  let xAlt = NaN
  let yAlt = NaN
  let justificado = false
  for (const [code, val] of grupos) {
    if (code === '1') texto = val
    else if (code === '3') chunks.push(val)
    else if (code === '10') x = parseFloat(val)
    else if (code === '20') y = parseFloat(val)
    else if (code === '11') xAlt = parseFloat(val)
    else if (code === '21') yAlt = parseFloat(val)
    else if (code === '72' || code === '73') {
      if (parseInt(val, 10) !== 0) justificado = true
    }
  }
  const contenido = (chunks.join('') + texto).trim()
  if (contenido === '') return null

  // Ver la cabecera: con justificación manda el 11/21, y solo si de verdad viene.
  const usarAlt =
    justificado && ENT_CON_ALINEACION.has(tipo) && Number.isFinite(xAlt) && Number.isFinite(yAlt)
  const px = usarAlt ? xAlt : x
  const py = usarAlt ? yAlt : y
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null

  return { tipo, capa: capaDe(grupos), texto: contenido, x: px, y: py }
}

/**
 * Un `POINT` suelto → `{capa, x, y, z}`, o `null` si no trae posición utilizable.
 *
 * ── POR QUÉ EXISTE (2026-08-18) ─────────────────────────────────────────────
 * Hasta hoy los `POINT` caían en el cajón `otras` y salían por el resumen «Se
 * ignoraron N entidad(es) que no forman anillo». Eso era CIERTO —un punto no
 * forma anillo— y a la vez inútil: en un levantamiento de topografía los puntos
 * **son el dato**. Medido sobre los cinco ficheros de `icuc-pruebas/ejemplos dxf/`
 * (levantamientos reales del autor, 2023 y 2025): traen entre 26 y 88 puntos,
 * **ni una polilínea**, y el parser devolvía `anillos: []`. O sea que la
 * aplicación leía el fichero entero, contaba sus puntos, tiraba las coordenadas y
 * enseñaba una parcela vacía.
 *
 * Es el mismo movimiento que F22 hizo con las anotaciones —de «se ignoraron» a
 * `rotulos[]`— y por el mismo argumento, que está escrito unas líneas más abajo
 * en la detección de anotaciones: *«dejarlo como estaba sería la clase de frase
 * que enseña a desconfiar de lo que la aplicación dice de sí misma»*.
 *
 * ── LO QUE NO HACE, Y ES DELIBERADO ────────────────────────────────────────
 * **No deduplica ni elige capa.** Los cinco ficheros medidos escriben CADA punto
 * dos veces, en `VER_P2D` y en `VER_P3D`, con la misma X/Y. Quedarse con una de
 * las dos es una decisión del llamante —igual que con los anillos, donde este
 * módulo devuelve `capas[]` y quien reparte es el diálogo de capas—, no del
 * parser. Aquí se devuelve lo que hay, con su capa, y se dice cuántos por capa.
 *
 * `z` (código 30) se conserva porque en un punto de levantamiento **sí es dato**
 * —la cota—, al revés que en un vértice de polilínea, donde se descarta y se
 * cuenta en `zCount`. Nadie la usa todavía; tirarla aquí obligaría a reparsear.
 *
 * @param {Array<[string, string]>} grupos  Pares (código, valor) de la entidad.
 * @returns {{capa: string, x: number, y: number, z: number|null}|null}
 */
function puntoDe(grupos) {
  let x = NaN
  let y = NaN
  let z = NaN
  for (const [code, val] of grupos) {
    if (code === '10') x = parseFloat(val)
    else if (code === '20') y = parseFloat(val)
    else if (code === '30') z = parseFloat(val)
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { capa: capaDe(grupos), x, y, z: Number.isFinite(z) ? z : null }
}

/**
 * Lee la CAPA (código de grupo 8) de los pares de una entidad.
 *
 * Devuelve el PRIMER código 8 recortado —una entidad DXF lleva uno solo— o `''`
 * si la entidad no lo trae. Nunca `undefined`: el contrato dice `string`.
 *
 * @param {Array<[string, string]>} grupos  Pares (código, valor) de la entidad.
 * @returns {string}  Nombre de capa LITERAL (sin normalizar) o `''`.
 */
function capaDe(grupos) {
  for (const [code, val] of grupos) {
    if (code === '8') return val.trim()
  }
  return ''
}

/**
 * Parsea un DXF ASCII y devuelve los anillos de la sección ENTITIES en UTM crudo.
 *
 * @param {string} texto  Contenido completo del .dxf (ASCII).
 * @param {object} [opts]
 * @param {number} [opts.flechaMax=0.01]  Flecha máx. (m) para discretizar arcos
 *   (se pasa tal cual a geo/arco.js#discretizarBulge).
 * @returns {{ anillos: number[][][], capas: string[], cerrados: boolean[],
 *   rotulos: Array<{tipo: string, capa: string, texto: string, x: number, y: number}>,
 *   puntos: Array<{capa: string, x: number, y: number, z: number|null}>,
 *   detecciones: import('./_comun.js').Deteccion[], origen: 'DXF' }}
 *   `capas[i]` es la capa de `anillos[i]` (LITERAL, `''` si no había código 8);
 *   los dos arrays tienen SIEMPRE la misma longitud.
 *   `cerrados[i]` es el flag de cierre (código 70, bit 0) de la entidad de
 *   `anillos[i]`: `true` = el fichero DECLARA el anillo cerrado, así que el tramo
 *   Vn-1→V0 es una arista dibujada y NO hay vértice de cierre repetido. Mismo
 *   largo que `anillos`, siempre booleano (nunca `undefined`).
 *   `rotulos` (F22) son las anotaciones con texto y posición, en el orden del
 *   fichero. ⚠️ **NO va 1:1 con `anillos`** —hay planos con 153 rótulos y 8
 *   recintos, y otros sin ninguno—: emparejarlos es de `parsers/topologia.js`.
 *   `puntos` (2026-08-18) son los `POINT` sueltos, en el orden del fichero, SIN
 *   deduplicar y SIN elegir capa (ver {@link puntoDe}), y sin los que caen en
 *   (0, 0). En un levantamiento son EL dato: hay ficheros con 88 puntos y cero
 *   anillos. ⚠️ Tampoco va 1:1 con nada, pero **en los cinco levantamientos
 *   medidos SÍ casa 1:1 y por orden con los rótulos de cada capa de etiquetas**
 *   (número de punto, cota y código), una vez fuera el punto del origen.
 * @throws {TypeError}  Si `texto` no es un string (regla de oro 1: no se adivina).
 */
export function parseDXF(texto, opts = {}) {
  if (typeof texto !== 'string') {
    throw new TypeError(
      `parseDXF: se esperaba el contenido del DXF como string; recibido ${typeof texto}.`,
    )
  }
  const flechaMax = opts.flechaMax
  // ⭐ F14 · De QUÉ hablan los mensajes. El defecto es «la parcela», así que un
  // llamante que no diga nada lee exactamente lo de siempre.
  const sujeto = declinar(opts.sujeto)
  const { pares, lineasDescartadas, descartadasNoVacias } = leerPares(texto)

  // ── Acumuladores del resultado ──────────────────────────────────────────────
  const anillos = []
  const capas = [] // capas[i] ↔ anillos[i]; se empujan SIEMPRE a la vez.
  const cerrados = [] // cerrados[i] ↔ anillos[i]; flag 70 bit 0. Ver la cabecera.
  const rotulos = [] // F22 · anotaciones con texto y sitio; NO va 1:1 con anillos.
  const puntos = [] // 2026-08-18 · POINT sueltos; ver puntoDe. NO va 1:1 con nada.
  /**
   * Puntos EXACTAMENTE en (0, 0), descartados y contados aparte.
   *
   * ⚠️ **MEDIDO, y el resultado corrige la sospecha que motivó esta guarda.** Los
   * cinco levantamientos de `icuc-pruebas/ejemplos dxf/` traen un `POINT` en (0,0)
   * —dos, uno por capa— pero **viven en la sección BLOCKS**, y este parser no
   * desciende a BLOCKS (ver la cabecera). O sea que **no llegan hasta aquí y esta
   * guarda no se dispara con ellos**. Decirlo importa: el contador saldrá 0 en
   * esos ficheros, y quien lo vea a 0 no debe concluir que está roto.
   *
   * Se deja puesta igualmente, y no es defensa por si acaso: un punto en (0,0)
   * **en ENTITIES** sería basura inequívoca —en EPSG:25830 el origen cae en el
   * Atlántico, a cientos de kilómetros de cualquier parcela española— y colarlo
   * saldría caro, no feo. Medido sobre el fichero entero, con él dentro la
   * extensión pasa de 48×150 m (una parcela) a **4.090 km**: cualquier encuadre
   * sobre esos puntos dejaría la parcela en un píxel. Cuesta cuatro líneas y se
   * DICE cuántos, porque un descarte silencioso es lo que este parser no hace en
   * ningún otro sitio.
   */
  let puntosEnOrigen = 0
  const detecciones = []
  let zCount = 0 // vértices con código 30 (Z) descartada.
  let elevacionesLW = 0 // H7 · LWPOLYLINE con elevación (código 38) NO nula, descartada.
  const anotaciones = new Map() // tipo → nº (resumen INFO).
  const otras = new Map() // LINE/POINT/IMAGE/… → nº (resumen INFO).
  const contornosSueltos = new Map() // H8 · ARC/CIRCLE: pueden SER la geometría (AVISO propio).

  // H3 · Fichero desalineado: se descartaron líneas iniciales para que la
  // alternancia código/valor volviera a casar (ver leerPares). Se calla solo el
  // caso trivial de un texto vacío sin nada que alinear.
  if (lineasDescartadas > 0 && (pares.length > 0 || descartadasNoVacias)) {
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.FORMATO_NO_SOPORTADO,
        `El DXF no empieza por un código de grupo (línea(s) en blanco o texto ajeno al ` +
          `principio): se descartaron ${lineasDescartadas} línea(s) iniciales para realinear ` +
          `los pares código/valor.`,
        SEVERIDAD.AVISO,
        { lineasDescartadas, descartadasNoVacias },
      ),
    )
  }
  // Arcos discretizados: una Deteccion por arco + un resumen total (regla 1).
  let arcosN = 0
  let arcoSegTotal = 0
  let arcoDeltaSTotal = 0

  /** Estado de una POLYLINE clásica abierta (VERTEX… hasta SEQEND). */
  let polyAbierto = null

  // ── Ensamblado de un anillo con discretización de bulges ──────────────────────
  //
  // verts: [{ x, y, b }] en orden. `b` = bulge del segmento DESDE este vértice
  // HASTA el siguiente (0 = recto). `closed`: el último segmento envuelve Vn-1→V0.
  // `capa`: la capa de la ENTIDAD (no la de sus vértices) — ver la cabecera.
  // Devuelve el anillo ABIERTO (sin repetir V0 al final) con los vértices de arco
  // insertados en su sitio, incluido el segmento de cierre.
  const ensamblarAnillo = (verts, capa) => {
    const v = verts.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    if (v.length === 0) return
    // `verts.closed` puede no venir (una POLYLINE sin código 70): se normaliza a
    // booleano aquí y no aguas abajo, para que `cerrados[i]` sea SIEMPRE `true` o
    // `false` y nadie tenga que distinguir «abierto» de «no se sabe».
    const cerrado = verts.closed === true
    if (v.length < 2) {
      anillos.push(v.map((p) => [p.x, p.y]))
      capas.push(capa)
      cerrados.push(cerrado)
      return
    }
    const n = v.length
    const out = []
    for (let i = 0; i < n; i++) {
      out.push([v[i].x, v[i].y])
      const esUltimo = i === n - 1
      if (esUltimo && !verts.closed) break // abierto: el último vértice no tiene tramo saliente.
      const j = (i + 1) % n
      const b = v[i].b
      if (b && b !== 0) {
        const P1 = [v[i].x, v[i].y]
        const P2 = [v[j].x, v[j].y]
        const arco = discretizarBulge(P1, P2, b, flechaMax === undefined ? undefined : { flechaMax })
        for (const nuevo of arco.vertices) out.push(nuevo)
        // Una Deteccion por arco discretizado (regla 1) + acumulado para el resumen.
        arcosN++
        arcoSegTotal += arco.nSeg
        arcoDeltaSTotal += arco.deltaS
        detecciones.push(
          crearDeteccion(
            TIPO_DETECCION.ARCO_DISCRETIZADO,
            `Arco (bulge ${b}) discretizado en ${arco.nSeg} tramo(s); ` +
              `variación de superficie ΔS=${arco.deltaS.toExponential(3)} m².`,
            SEVERIDAD.INFO,
            { nSeg: arco.nSeg, deltaS: arco.deltaS, radio: arco.radio },
          ),
        )
      }
    }
    anillos.push(out)
    capas.push(capa)
    cerrados.push(cerrado)
  }

  // ── Parseo de las group codes de una LWPOLYLINE → anillo ──────────────────────
  const finalizarLW = (grupos) => {
    const verts = []
    verts.closed = false
    let cur = null
    for (const [code, val] of grupos) {
      if (code === '70') verts.closed = (parseInt(val, 10) & 1) === 1
      else if (code === '10') {
        if (cur) verts.push(cur)
        cur = { x: parseFloat(val), y: NaN, b: 0 }
      } else if (code === '20') {
        if (cur) cur.y = parseFloat(val)
      } else if (code === '30') zCount++ // atípico en LWPOLYLINE (2D), pero por si acaso.
      else if (code === '38') {
        // H7 · Elevación de la LWPOLYLINE entera (no de un vértice). Se descarta
        // —el modelo es 2D— pero se CUENTA para materializarlo (regla 1): antes
        // se tiraba sin Z_DESCARTADA. Una elevación 0 no descarta nada.
        if (parseFloat(val) !== 0) elevacionesLW++
      } else if (code === '42') {
        if (cur) cur.b = parseFloat(val)
      }
    }
    if (cur) verts.push(cur)
    // La capa se lee en una pasada APARTE (código 8), para no tocar ni una rama
    // del bucle de arriba: F11 no puede alterar ni un anillo de F01.
    ensamblarAnillo(verts, capaDe(grupos))
  }

  // ── POLYLINE / VERTEX / SEQEND clásicos ───────────────────────────────────────
  const abrirPoly = (grupos) => {
    let closed = false
    for (const [code, val] of grupos) {
      if (code === '70') closed = (parseInt(val, 10) & 1) === 1
    }
    polyAbierto = []
    polyAbierto.closed = closed
    // ⚠️ La capa se captura AQUÍ, en la cabecera, y NO en los VERTEX ni en el
    // SEQEND: es la trampa medida en el fixture real de edificio (ver cabecera).
    polyAbierto.capa = capaDe(grupos)
  }
  // ⛔ H4 (auditoría 2026-08-15) · EL FLAG 70 DEL VERTEX, QUE SE IGNORABA.
  // Una POLYLINE pasada por PEDIT>Spline lleva DOS familias de VERTEX: los del
  // MARCO DE CONTROL (70 bit 16 = 16), que son los puntos que el usuario clicó y
  // NO están sobre la curva, y los de la CURVA AJUSTADA (70 bit 8 = 8), que sí.
  // Ignorar el flag metía los puntos de control DENTRO del anillo (geometría por
  // la que la curva ni pasa) sin una sola detección. Y una malla polifacética
  // (POLYFACE MESH) usa VERTEX con bit 128 como REGISTROS DE CARA —sus 10/20 son
  // 0.0 y sus 71..74 son índices, no coordenadas— que entraban como vértices
  // [0,0]. Desde hoy: bit 16 y bit 128 se EXCLUYEN (contándolos), bit 8 se
  // CONSERVA, y `cerrarPoly` materializa qué se hizo (VERTICE_EXCLUIDO).
  const agregarVertice = (grupos) => {
    let x = NaN
    let y = NaN
    let b = 0
    let flags = 0
    for (const [code, val] of grupos) {
      if (code === '10') x = parseFloat(val)
      else if (code === '20') y = parseFloat(val)
      else if (code === '30') zCount++
      else if (code === '42') b = parseFloat(val)
      else if (code === '70') flags = parseInt(val, 10) || 0
    }
    if (flags & 16) {
      polyAbierto.nControl = (polyAbierto.nControl || 0) + 1
      return // vértice de marco de control de spline: NO es geometría del anillo
    }
    if (flags & 128) {
      polyAbierto.nCara = (polyAbierto.nCara || 0) + 1
      return // registro de cara / vértice de malla polifacética: NO es un anillo
    }
    if (flags & 8) polyAbierto.nCurva = (polyAbierto.nCurva || 0) + 1
    polyAbierto.push({ x, y, b })
  }
  const cerrarPoly = () => {
    const nControl = polyAbierto.nControl || 0
    const nCara = polyAbierto.nCara || 0
    const nCurva = polyAbierto.nCurva || 0
    if (nControl > 0) {
      detecciones.push(
        crearDeteccion(
          TIPO_DETECCION.VERTICE_EXCLUIDO,
          `POLYLINE ajustada a spline (PEDIT>Spline): se excluyen ${nControl} vértice(s) del ` +
            `marco de control (código 70, bit 16), que no están sobre la curva` +
            (polyAbierto.length > 0
              ? `; el anillo usa los ${polyAbierto.length} vértice(s) restantes` +
                (nCurva > 0 ? ` (${nCurva} de la curva ajustada, bit 8)` : '') +
                `.`
              : `. La polilínea no trae vértices de curva: no aporta ningún anillo.`),
          polyAbierto.length > 0 ? SEVERIDAD.INFO : SEVERIDAD.AVISO,
          { control: nControl, curva: nCurva, conservados: polyAbierto.length },
        ),
      )
    }
    if (nCara > 0) {
      detecciones.push(
        crearDeteccion(
          TIPO_DETECCION.VERTICE_EXCLUIDO,
          `POLYLINE de malla polifacética: se excluyen ${nCara} registro(s) de cara/vértice(s) ` +
            `de malla (código 70, bit 128) — una malla no es geometría ${sujeto.escueto}.`,
          SEVERIDAD.AVISO,
          { caras: nCara, conservados: polyAbierto.length },
        ),
      )
    }
    ensamblarAnillo(polyAbierto, polyAbierto.capa)
    polyAbierto = null
  }

  // ── Despacho de una entidad de ENTITIES por su tipo ───────────────────────────
  const procesarEntidad = (tipo, grupos) => {
    switch (tipo) {
      case 'LWPOLYLINE':
        finalizarLW(grupos)
        return
      case 'POLYLINE':
        abrirPoly(grupos)
        return
      case 'VERTEX':
        if (polyAbierto) agregarVertice(grupos)
        return
      case 'SEQEND':
        if (polyAbierto) cerrarPoly()
        return
      // 2026-08-18 · El `POINT` deja el cajón `otras` y pasa a ser DATO. Va como
      // `case` propio y no dentro del `default` porque ya no es «lo que no
      // reconocemos»: es una entidad soportada, como las tres de aquí arriba.
      case 'POINT': {
        const punto = puntoDe(grupos)
        if (punto === null) return
        if (punto.x === 0 && punto.y === 0) {
          puntosEnOrigen += 1
          return
        }
        puntos.push(punto)
        return
      }
      default:
        if (ENT_NO_SOPORTADA.has(tipo)) {
          // Aviso por ocurrencia (regla 1 + AC4): nunca un fallo de programa.
          detecciones.push(
            crearDeteccion(
              TIPO_DETECCION.ENTIDAD_NO_SOPORTADA,
              `Entidad DXF no soportada: ${tipo}. ${sujeto.guia}`,
              SEVERIDAD.AVISO,
              { tipo },
            ),
          )
        } else if (ENT_ANOTACION.has(tipo)) {
          // El recuento NO cambia (sigue contando TODAS, como desde F01); lo que
          // F22 añade es quedarse con las que traen texto y sitio.
          anotaciones.set(tipo, (anotaciones.get(tipo) || 0) + 1)
          const rot = rotuloDe(tipo, grupos)
          if (rot !== null) rotulos.push(rot)
        } else if (tipo === 'ARC' || tipo === 'CIRCLE') {
          // H8 (2026-08-15) · Un ARC o un CIRCLE no forman anillo por sí solos,
          // pero un contorno LINE+ARC es habitual en topografía: pueden SER la
          // geometría que el usuario busca. Van a un AVISO propio con guía (abajo),
          // no al resumen INFO de «entidades que no forman anillo».
          contornosSueltos.set(tipo, (contornosSueltos.get(tipo) || 0) + 1)
        } else {
          // LINE/POINT/IMAGE/…: no forman anillo por sí solas → resumen.
          otras.set(tipo, (otras.get(tipo) || 0) + 1)
        }
    }
  }

  // ── Bucle principal: máquina de estados de secciones ──────────────────────────
  //
  // Solo se procesan entidades cuando la sección activa es ENTITIES. Al abrir una
  // SECTION se lee su nombre (código 2). Las group codes de cada entidad se agrupan
  // leyendo hasta el siguiente código 0 (que abre la entidad siguiente o cierra la
  // sección). Todo lo que no sea ENTITIES se ignora sin descender (BLOCKS incluido).
  let seccion = null
  let i = 0
  while (i < pares.length) {
    const [code, valRaw] = pares[i]
    if (code === '0') {
      const val = valRaw.trim()
      if (val === 'SECTION') {
        // El nombre de la sección viene en el siguiente par (código 2).
        seccion = pares[i + 1] && pares[i + 1][0] === '2' ? pares[i + 1][1].trim() : null
        polyAbierto = null // higiene: ninguna POLYLINE cruza fronteras de sección.
        i += 2
        continue
      }
      if (val === 'ENDSEC') {
        if (polyAbierto) cerrarPoly() // cierra una POLYLINE sin SEQEND antes de salir.
        seccion = null
        i += 1
        continue
      }
      if (val === 'EOF') break
      if (seccion === 'ENTITIES') {
        // Entidad: agrupar sus códigos hasta el próximo código 0.
        let k = i + 1
        const grupos = []
        while (k < pares.length && pares[k][0] !== '0') {
          grupos.push(pares[k])
          k++
        }
        procesarEntidad(val, grupos)
        i = k
        continue
      }
    }
    i += 1
  }
  if (polyAbierto) cerrarPoly() // por si el DXF termina sin ENDSEC/EOF.

  // ── Resúmenes (regla 1: nada se descarta en silencio) ─────────────────────────
  if (arcosN > 0) {
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.ARCO_DISCRETIZADO,
        `Se discretizaron ${arcosN} arco(s) en ${arcoSegTotal} tramo(s); ` +
          `variación total de superficie ΔS=${arcoDeltaSTotal.toExponential(3)} m².`,
        SEVERIDAD.INFO,
        { arcos: arcosN, segmentos: arcoSegTotal, deltaSTotal: arcoDeltaSTotal },
      ),
    )
  }
  if (zCount > 0) {
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.Z_DESCARTADA,
        `Se descartó la coordenada Z en ${zCount} vértice(s) (el modelo es 2D en UTM).`,
        SEVERIDAD.INFO,
        { vertices: zCount },
      ),
    )
  }
  if (elevacionesLW > 0) {
    // H7 · La elevación (código 38) es la «Z» de la LWPOLYLINE entera: se
    // descarta igual que la Z por vértice, y desde hoy se DICE igual que ella.
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.Z_DESCARTADA,
        `Se descartó la elevación (código 38) de ${elevacionesLW} polilínea(s) LWPOLYLINE ` +
          `(el modelo es 2D en UTM).`,
        SEVERIDAD.INFO,
        { polilineas: elevacionesLW, codigo: 38 },
      ),
    )
  }
  if (contornosSueltos.size > 0) {
    // H8 · ARC/CIRCLE sueltos: hasta hoy se resumían como «entidades que no
    // forman anillo» (INFO), que es cierto y a la vez inútil — un contorno de
    // LINE+ARC puede SER la parcela. El aviso dice cómo proceder.
    const tipos = Object.fromEntries(contornosSueltos)
    const total = [...contornosSueltos.values()].reduce((a, b) => a + b, 0)
    const nLineas = otras.get('LINE') || 0
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.ENTIDAD_NO_SOPORTADA,
        `${total} arco(s)/círculo(s) sueltos (${[...contornosSueltos.keys()].join(', ')})` +
          (nLineas > 0 ? ` junto a ${nLineas} LINE` : '') +
          `: no forman anillo por sí solos, pero un contorno dibujado con LINE+ARC (o un ` +
          `CIRCLE) puede SER la geometría ${sujeto.escueto}. Esta versión no ensambla ` +
          `entidades sueltas: en el CAD, únelas en UNA polilínea (EDITPOL/PEDIT → Juntar, ` +
          `o redibuja el contorno con POLILINEA) y vuelve a importar.`,
        SEVERIDAD.AVISO,
        { tipos, total, lineas: nLineas },
      ),
    )
  }
  if (anotaciones.size > 0) {
    const tipos = Object.fromEntries(anotaciones)
    const total = [...anotaciones.values()].reduce((a, b) => a + b, 0)
    // ⚠️ **F22 · Este mensaje decía «Se ignoraron N anotación(es)» y dejó de ser
    // cierto.** No son geometría —eso sigue igual— pero ya no se ignoran: las que
    // traen texto y sitio se devuelven como `rotulos[]` y pueden acabar nombrando
    // los recintos. Dejarlo como estaba sería la clase de frase que enseña a
    // desconfiar de lo que la aplicación dice de sí misma.
    const conRotulo = rotulos.length
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.ENTIDAD_NO_SOPORTADA,
        `${total} anotación(es) (${[...anotaciones.keys()].join(', ')}): no son geometría ` +
          `${sujeto.escueto} y no forman ningún anillo` +
          (conRotulo > 0
            ? `. ${conRotulo} de ellas traen texto y posición, así que se leen como ` +
              `rótulos y pueden servir para nombrar los recintos.`
            : `.`),
        SEVERIDAD.INFO,
        { tipos, total, conRotulo },
      ),
    )
  }
  // 2026-08-18 · Los PUNTOS, que hasta hoy salían por el resumen de aquí abajo con
  // la frase «se ignoraron». Ya no se ignoran, así que la frase no puede seguir.
  //
  // ⚠️ Se emite también con `puntos.length === 0` si se descartó algún (0,0): el
  // fichero que trae UN punto y es el de origen queda si no completamente mudo, y
  // ése es justo el caso en el que el usuario se pregunta por qué no sale nada.
  if (puntos.length > 0 || puntosEnOrigen > 0) {
    const porCapa = new Map()
    for (const p of puntos) porCapa.set(p.capa, (porCapa.get(p.capa) || 0) + 1)
    const capasDePuntos = [...porCapa.keys()]
    const conCota = puntos.reduce((n, p) => n + (p.z !== null ? 1 : 0), 0)
    const descarte =
      puntosEnOrigen > 0
        ? ` Se ha descartado ${puntosEnOrigen === 1 ? 'otro' : `otros ${puntosEnOrigen}`} en ` +
          `la coordenada (0, 0): el origen no es un sitio, y colarlo estiraría el encuadre ` +
          `miles de kilómetros.`
        : ''
    const reparto =
      capasDePuntos.length > 1
        ? ` Vienen repartidos en ${capasDePuntos.length} capas ` +
          `(${capasDePuntos.map((c) => `${c || 'sin capa'}: ${porCapa.get(c)}`).join(', ')}), y ` +
          `hay software de topografía que escribe CADA punto en dos de ellas: elige una sola o ` +
          `los tendrás por duplicado.`
        : capasDePuntos.length === 1
          ? ` Todos en la capa «${capasDePuntos[0] || 'sin capa'}».`
          : ''
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.ENTIDAD_NO_SOPORTADA,
        puntos.length === 0
          ? `Este DXF no trae ningún punto utilizable.${descarte}`
          : `${puntos.length} punto(s) sueltos. No forman anillo por sí solos, pero en un ` +
            `levantamiento son EL dato: se leen con sus coordenadas y sirven de enganche para ` +
            `dibujar la geometría ${sujeto.escueto}.${reparto}${descarte}` +
            (conCota > 0 ? ` ${conCota} traen cota (Z).` : ''),
        SEVERIDAD.INFO,
        {
          total: puntos.length,
          porCapa: Object.fromEntries(porCapa),
          enOrigenDescartados: puntosEnOrigen,
          conCota,
        },
      ),
    )
  }
  if (otras.size > 0) {
    const tipos = Object.fromEntries(otras)
    const total = [...otras.values()].reduce((a, b) => a + b, 0)
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.ENTIDAD_NO_SOPORTADA,
        `Se ignoraron ${total} entidad(es) que no forman anillo ` +
          `(${[...otras.keys()].join(', ')}).`,
        SEVERIDAD.INFO,
        { tipos, total },
      ),
    )
  }

  return { anillos, capas, cerrados, rotulos, puntos, detecciones, origen: ORIGEN }
}

export default parseDXF
