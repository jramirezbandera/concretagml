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

import { crearDeteccion, TIPO_DETECCION, SEVERIDAD } from './_comun.js'
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
// El resto (LINE, POINT, IMAGE…): no forman anillo por sí solas → se resumen en
//   UNA Deteccion INFO "otras entidades ignoradas".

const ENT_NO_SOPORTADA = new Set([
  'INSERT', 'SPLINE', 'HATCH', '3DFACE', 'ELLIPSE', 'MLINE', 'REGION',
  'XLINE', 'RAY', 'BODY', '3DSOLID', 'SOLID', 'SURFACE', 'MESH', 'ACAD_PROXY_ENTITY',
])
const ENT_ANOTACION = new Set([
  'TEXT', 'MTEXT', 'DIMENSION', 'LEADER', 'MLEADER', 'MULTILEADER',
  'ATTDEF', 'ATTRIB', 'TOLERANCE',
])

/** Guía única que acompaña a cada aviso de entidad no soportada (feature §Alcance). */
const GUIA_NO_SOPORTADA =
  'Deja solo la polilínea de la parcela en la capa 0 y ejecuta LIMPIA (PURGE); ' +
  'no se importan bloques, INSERT, xref ni splines.'

// ── Lector genérico de pares (código, valor) ──────────────────────────────────

/**
 * Trocea el texto DXF en pares [códigoTrim, valorCrudo] línea a línea. El DXF ASCII
 * es estrictamente alternante: línea impar = código de grupo (a veces con sangría/
 * espacios → se recorta), línea par = valor. Tolera fin de línea Windows (\r\n) y
 * un BOM inicial. NO recorta el valor (una coord con espacios la absorbe parseFloat;
 * los nombres de tipo/sección se recortan en el punto de uso).
 *
 * @param {string} texto
 * @returns {Array<[string, string]>}
 */
function leerPares(texto) {
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1) // BOM
  const lineas = texto.split(/\r?\n/)
  const pares = []
  for (let i = 0; i + 1 < lineas.length; i += 2) {
    pares.push([lineas[i].trim(), lineas[i + 1]])
  }
  return pares
}

// ── Parser público ────────────────────────────────────────────────────────────

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
 * @returns {{ anillos: number[][][], capas: string[],
 *   detecciones: import('./_comun.js').Deteccion[], origen: 'DXF' }}
 *   `capas[i]` es la capa de `anillos[i]` (LITERAL, `''` si no había código 8);
 *   los dos arrays tienen SIEMPRE la misma longitud.
 * @throws {TypeError}  Si `texto` no es un string (regla de oro 1: no se adivina).
 */
export function parseDXF(texto, opts = {}) {
  if (typeof texto !== 'string') {
    throw new TypeError(
      `parseDXF: se esperaba el contenido del DXF como string; recibido ${typeof texto}.`,
    )
  }
  const flechaMax = opts.flechaMax
  const pares = leerPares(texto)

  // ── Acumuladores del resultado ──────────────────────────────────────────────
  const anillos = []
  const capas = [] // capas[i] ↔ anillos[i]; se empujan SIEMPRE a la vez.
  const detecciones = []
  let zCount = 0 // vértices con código 30 (Z) descartada.
  const anotaciones = new Map() // tipo → nº (resumen INFO).
  const otras = new Map() // LINE/POINT/IMAGE/… → nº (resumen INFO).
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
    if (v.length < 2) {
      anillos.push(v.map((p) => [p.x, p.y]))
      capas.push(capa)
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
      else if (code === '42') {
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
  const agregarVertice = (grupos) => {
    let x = NaN
    let y = NaN
    let b = 0
    for (const [code, val] of grupos) {
      if (code === '10') x = parseFloat(val)
      else if (code === '20') y = parseFloat(val)
      else if (code === '30') zCount++
      else if (code === '42') b = parseFloat(val)
    }
    polyAbierto.push({ x, y, b })
  }
  const cerrarPoly = () => {
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
      default:
        if (ENT_NO_SOPORTADA.has(tipo)) {
          // Aviso por ocurrencia (regla 1 + AC4): nunca un fallo de programa.
          detecciones.push(
            crearDeteccion(
              TIPO_DETECCION.ENTIDAD_NO_SOPORTADA,
              `Entidad DXF no soportada: ${tipo}. ${GUIA_NO_SOPORTADA}`,
              SEVERIDAD.AVISO,
              { tipo },
            ),
          )
        } else if (ENT_ANOTACION.has(tipo)) {
          anotaciones.set(tipo, (anotaciones.get(tipo) || 0) + 1)
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
  if (anotaciones.size > 0) {
    const tipos = Object.fromEntries(anotaciones)
    const total = [...anotaciones.values()].reduce((a, b) => a + b, 0)
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.ENTIDAD_NO_SOPORTADA,
        `Se ignoraron ${total} anotación(es) (${[...anotaciones.keys()].join(', ')}): ` +
          `no son geometría de parcela.`,
        SEVERIDAD.INFO,
        { tipos, total },
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

  return { anillos, capas, detecciones, origen: ORIGEN }
}

export default parseDXF
