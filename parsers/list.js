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
import { autodetectarSeparadorDecimal, extraerPares } from './_comun.js'

/**
 * Metadatos que la LISTA de AutoCAD reporta y que interesan para cotejo posterior.
 * @typedef {Object} MetaLIST
 * @property {number} [areaReportada]       Valor de «Área:» tal cual lo dio AutoCAD.
 * @property {number} [perimetroReportado]  Valor de «Perímetro:».
 * @property {boolean} [cerrado]            true si «Marcas de polilínea: Cerrado».
 */

/**
 * Extrae el primer número de una línea respetando el separador decimal elegido.
 * (No se reutiliza el tokenizador interno de _comun.js porque no está exportado;
 * esto es una lectura puntual de metadatos, no el camino caliente de vértices.)
 *
 * @param {string} linea
 * @param {','|'.'} sepDecimal
 * @returns {number|undefined}
 */
function primerNumero(linea, sepDecimal) {
  const re = sepDecimal === ',' ? /-?\d+(?:,\d+)?/ : /-?\d+(?:\.\d+)?/
  const m = linea.match(re)
  if (!m) return undefined
  const crudo = sepDecimal === ',' ? m[0].replace(',', '.') : m[0]
  const n = Number(crudo)
  return Number.isFinite(n) ? n : undefined
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

/**
 * Parsea un pegado de LISTA (_LIST) de AutoCAD a un {@link ResultadoParse}.
 *
 * @param {string} texto  El bloque de texto copiado de la LISTA de AutoCAD.
 * @param {object} [opts]
 * @param {','|'.'} [opts.separadorDecimal]  Fuerza el separador decimal (si se
 *   omite, se autodetecta; ver _comun.js).
 * @param {string} [opts.palabraSeparador='separador']  Palabra que, sola en su
 *   línea, corta un polígono del siguiente (multipolígono).
 * @returns {{ anillos: number[][][], detecciones: import('./_comun.js').Deteccion[],
 *   origen: string, meta?: MetaLIST }}  `origen` = 'LIST'. `meta` sólo si la
 *   LISTA reportó Área/Perímetro/Cerrado. `anillos` crudos en UTM, SIN cerrar.
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
  const { anillos, detecciones } = extraerPares(texto, opts)

  const resultado = { anillos, detecciones, origen: ORIGEN_PARCELA.LIST }

  // El separador para leer los metadatos coincide con el que usó extraerPares.
  const sepDecimal = opts.separadorDecimal ?? autodetectarSeparadorDecimal(texto)
  const meta = extraerMetadatosLIST(texto, sepDecimal)
  if (meta) resultado.meta = meta

  return resultado
}
