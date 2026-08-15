// parsers/list.js — F01 · Parser del pegado de LISTA (comando _LIST) de AutoCAD.
//
// Vía PRINCIPAL de entrada del técnico (feature-01 §Parsers). El usuario copia la
// salida del comando LISTA sobre una LWPOLYLINE y la pega tal cual: un bloque con
// cabeceras («Trazo», «Capa», «Área», «Perímetro», «Marcas de polilínea…») y una
// línea «Ubicación:  X= …  Y= …  Z= …» por vértice.
//
// Este módulo NO hace el trabajo pesado: lo delega en extraerPares() de _comun.js,
// que ya es tolerante a cabeceras/etiquetas, autodetecta el separador decimal,
// descarta la Z y respeta la convención `separador` para multipolígono. Aquí sólo:
//   1. Se valida que la entrada sea un string (regla de oro 1: nada silencioso;
//      entrada de tipo equivocado → TypeError, no un resultado vacío mudo).
//   2. Se etiqueta el origen como 'LIST' (ORIGEN_PARCELA, model/parcela.js).
//   3. Valor añadido: se capturan los metadatos que la propia LISTA reporta
//      (Área, Perímetro, Cerrado) como `meta`, para cotejarlos aguas abajo contra
//      la superficie por shoelace y el cierre real (regla de oro 1: dato visible,
//      no descartado). Ver nota sobre por qué `meta` y no una Deteccion.
//
// Fronteras (SPEC §2, y el encabezado de _comun.js): el parser NO cierra el
// anillo, NO quita duplicados, NO proyecta y NO toca el modelo. Devuelve `anillos`
// crudos en UTM [x, y]; el cierre (geo/cierre.js), el saneado (geo/huso.js) y el
// volcado a model/parcela.js los hace el orquestador en una tarea posterior.

import { ORIGEN_PARCELA } from '../model/parcela.js'
import {
  autodetectarSeparadorDecimal,
  crearDeteccion,
  extraerPares,
  tokensNumericos,
  SEVERIDAD,
  TIPO_DETECCION,
} from './_comun.js'
import { discretizarBulge } from '../geo/arco.js'

/**
 * Metadatos que la LISTA de AutoCAD reporta y que interesan para cotejo posterior.
 * @typedef {Object} MetaLIST
 * @property {number} [areaReportada]       Valor de «Área:» tal cual lo dio AutoCAD.
 * @property {number} [perimetroReportado]  Valor de «Perímetro:».
 * @property {boolean} [cerrado]            true si «Marcas de polilínea: Cerrado».
 */

/**
 * Extrae el primer número de una línea respetando el separador decimal elegido.
 * Reutiliza el tokenizador de _comun.js (exportado desde 2026-08-15): así los
 * metadatos entienden EXACTAMENTE los mismos números que los vértices (miles
 * español y notación científica incluidos), y no hay dos regex que divergan.
 *
 * @param {string} linea
 * @param {','|'.'} sepDecimal
 * @returns {number|undefined}
 */
function primerNumero(linea, sepDecimal) {
  return tokensNumericos(linea, sepDecimal)[0]
}

/**
 * Lee los metadatos declarados por la LISTA (Área/Perímetro/Cerrado). Todos son
 * opcionales: sólo aparecen en `meta` los que la entrada realmente reporta.
 *
 * Por qué `meta` y NO una Deteccion: crearDeteccion() sólo admite el vocabulario
 * CONGELADO de TIPO_DETECCION (_comun.js), que no tiene un tipo para "área/
 * perímetro reportados"; forzarlos dentro de, p. ej., CIERRE contaminaría la
 * semántica que el orquestador usa aguas abajo. Se exponen como campo aparte,
 * aditivo y opcional, que quien no lo necesite ignora sin romper el contrato.
 *
 * @param {string} texto
 * @param {','|'.'} sepDecimal
 * @returns {MetaLIST|undefined}
 */
function extraerMetadatosLIST(texto, sepDecimal) {
  const meta = {}
  for (const linea of texto.split(/\r?\n/)) {
    if (/[áa]rea\s*:/i.test(linea)) {
      const n = primerNumero(linea, sepDecimal)
      if (n !== undefined) meta.areaReportada = n
    } else if (/per[íi]metro\s*:/i.test(linea)) {
      const n = primerNumero(linea, sepDecimal)
      if (n !== undefined) meta.perimetroReportado = n
    } else if (/marcas de pol/i.test(linea)) {
      // «Marcas de polilínea:  Cerrado» (o «Abierto»). Basta con anclar en el
      // rótulo «Marcas de pol…» para ser robusto a la grafía de «polilínea».
      meta.cerrado = /cerrado/i.test(linea)
    }
  }
  return Object.keys(meta).length > 0 ? meta : undefined
}

// ── ⛔ H1 (auditoría 2026-08-15) · LOS ARCOS DE LA LISTA ─────────────────────
//
// La LISTA de una polilínea con arcos imprime, por cada arco, su `Curvatura`
// (el bulge, mismo convenio de signo que el código DXF 42), su `Centro` y su
// `Radio`. Hasta hoy la línea `Centro:` (3 números) entraba como VÉRTICE y la
// curvatura se tiraba: el arco quedaba sustituido por su cuerda en silencio,
// con el centro del arco como vértice fantasma y `bloqueos: []`.
//
// `extraerPares` (que es quien tokeniza) ya excluye esas líneas y devuelve las
// curvaturas; AQUÍ se discretiza cada arco con geo/arco.js#discretizarBulge —
// exactamente el mismo motor y la misma convención que la vía DXF, incluida la
// forma de las detecciones ARCO_DISCRETIZADO (una por arco + un resumen)—.
// _comun.js no puede hacerlo él mismo: su cabecera fija que NO importa geo/arco.

/**
 * Discretiza IN SITU los arcos que la LISTA declara (`curvaturas` de
 * extraerPares) y materializa las detecciones. Muta `anillos` (inserta los
 * vértices intermedios en su sitio) y empuja a `detecciones`.
 *
 * @param {number[][][]} anillos
 * @param {import('./_comun.js').CurvaturaLIST[]} curvaturas
 * @param {boolean} cerrado  Si la LISTA declaró «Marcas de polilínea: Cerrado»:
 *   un arco que sale del ÚLTIMO vértice envuelve hasta V0 (tramo de cierre).
 * @param {number|undefined} flechaMax  Tolerancia de flecha (m); ver geo/arco.js.
 * @param {import('./_comun.js').Deteccion[]} detecciones
 */
function discretizarCurvaturas(anillos, curvaturas, cerrado, flechaMax, detecciones) {
  let arcosN = 0
  let segTotal = 0
  let deltaSTotal = 0

  // Por anillo y de MAYOR a MENOR índice de vértice: insertar de atrás hacia
  // delante no desplaza los índices de los arcos aún pendientes.
  const porAnillo = new Map()
  for (const c of curvaturas) {
    if (!porAnillo.has(c.anillo)) porAnillo.set(c.anillo, [])
    porAnillo.get(c.anillo).push(c)
  }

  for (const [idx, eventos] of porAnillo) {
    const anillo = anillos[idx]
    eventos.sort((a, b) => b.vertice - a.vertice)
    for (const { vertice, b } of eventos) {
      if (b === 0 || anillo === undefined || anillo[vertice] === undefined) continue
      const esUltimo = vertice === anillo.length - 1
      const P1 = anillo[vertice]
      const P2 = esUltimo ? (cerrado ? anillo[0] : null) : anillo[vertice + 1]
      // Sin destino (arco en el último vértice de una polilínea NO cerrada) o
      // cuerda degenerada: no se inventa nada — la cuerda se queda y SE DICE.
      if (P2 === null || (P1[0] === P2[0] && P1[1] === P2[1])) {
        detecciones.push(
          crearDeteccion(
            TIPO_DETECCION.ARCO_DISCRETIZADO,
            `La LISTA declara un arco (Curvatura ${b}) en el vértice ${vertice + 1} que no se puede ` +
              `reconstruir (${P2 === null ? 'no hay vértice siguiente y la polilínea no está cerrada' : 'la cuerda es de longitud 0'}): ` +
              `el arco queda sustituido por su cuerda.`,
            SEVERIDAD.AVISO,
            { bulge: b, vertice, anillo: idx, aplicado: false },
          ),
        )
        continue
      }
      const arco = discretizarBulge(P1, P2, b, flechaMax === undefined ? undefined : { flechaMax })
      anillo.splice(vertice + 1, 0, ...arco.vertices)
      arcosN++
      segTotal += arco.nSeg
      deltaSTotal += arco.deltaS
      // Mismo texto y mismos `datos` que parsers/dxf.js (una detección por arco).
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

  if (arcosN > 0) {
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.ARCO_DISCRETIZADO,
        `Se discretizaron ${arcosN} arco(s) en ${segTotal} tramo(s); ` +
          `variación total de superficie ΔS=${deltaSTotal.toExponential(3)} m².`,
        SEVERIDAD.INFO,
        { arcos: arcosN, segmentos: segTotal, deltaSTotal },
      ),
    )
  }
}

/**
 * Parsea un pegado de LISTA (_LIST) de AutoCAD a un {@link ResultadoParse}.
 *
 * @param {string} texto  El bloque de texto copiado de la LISTA de AutoCAD.
 * @param {object} [opts]
 * @param {','|'.'} [opts.separadorDecimal]  Fuerza el separador decimal (si se
 *   omite, se autodetecta; ver _comun.js).
 * @param {string} [opts.palabraSeparador='separador']  Palabra que, sola en su
 *   línea, corta un polígono del siguiente (multipolígono).
 * @param {number} [opts.flechaMax=0.01]  Flecha máx. (m) para discretizar los
 *   arcos que la LISTA declare (líneas «Curvatura»); misma opción que en dxf.js.
 * @returns {{ anillos: number[][][], detecciones: import('./_comun.js').Deteccion[],
 *   origen: string, meta?: MetaLIST }}  `origen` = 'LIST'. `meta` sólo si la
 *   LISTA reportó Área/Perímetro/Cerrado. `anillos` crudos en UTM, SIN cerrar
 *   (los arcos declarados llegan YA discretizados, con sus ARCO_DISCRETIZADO).
 * @throws {TypeError}   Si `texto` no es un string (regla de oro 1).
 * @throws {RangeError}  Si `opts.separadorDecimal` se aporta y no es ',' ni '.'.
 */
export function parseLIST(texto, opts = {}) {
  if (typeof texto !== 'string') {
    throw new TypeError(
      `parseLIST: se esperaba un string con el pegado de la LISTA; recibido ${typeof texto}.`,
    )
  }

  // Delegamos el grueso en extraerPares: cabeceras, «X= Y= Z=», descarte de Z,
  // separador decimal y convención `separador`. Le pasamos opts TAL CUAL para no
  // alterar el mensaje de su Deteccion SEPARADOR_DECIMAL (autodetectado vs indicado).
  const { anillos, detecciones, curvaturas } = extraerPares(texto, opts)

  const resultado = { anillos, detecciones, origen: ORIGEN_PARCELA.LIST }

  // El separador para leer los metadatos coincide con el que usó extraerPares.
  const sepDecimal = opts.separadorDecimal ?? autodetectarSeparadorDecimal(texto)
  const meta = extraerMetadatosLIST(texto, sepDecimal)
  if (meta) resultado.meta = meta

  // H1 · Los arcos que la LISTA declara (líneas «Curvatura») se discretizan con
  // geo/arco.js, igual que la vía DXF. ⚠️ Va DESPUÉS de leer `meta` porque el
  // tramo de cierre necesita saber si la LISTA dice «Cerrado».
  if (curvaturas.length > 0) {
    discretizarCurvaturas(anillos, curvaturas, meta?.cerrado === true, opts.flechaMax, detecciones)
  }

  return resultado
}
