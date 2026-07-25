// model/parcela.js — Modelo de datos de la rama PARCELA (F00 · Cimientos, tarea 2.4).
//
// Todo lo que este módulo produce es un POJO plano: objetos y arrays de
// primitivos, SIN métodos ni instancias de clase. Es un requisito duro del
// modelo (SPEC §2 regla de oro 4): el estado completo se clona con
// `structuredClone` para el undo/redo de `edit/historial.js`, y structuredClone
// no clona funciones ni prototipos.
//
// Convenios que este módulo garantiza (SPEC §2, PLAN §4.1/§4.3):
//   - Coordenadas SIEMPRE en UTM `[x, y]` (Este, Norte). El modelo nunca acepta
//     ni devuelve lat/lon (regla 3). Los detectores de X/Y invertidas o de
//     "geográficas pegadas" viven en `geo/huso.js`, no aquí.
//   - Los anillos se guardan ABIERTOS (sin repetir el vértice de cierre). El
//     cierre se añade sólo al serializar (regla 4, §4.3). Si llega un anillo
//     cerrado se normaliza quitando el duplicado, pero NUNCA en silencio.
//   - `recintos[0]` es SIEMPRE el EXTERIOR; el resto son HUECOS (§4.3).
//   - `geometriaOficial` (la del WFS) se guarda como copia INDEPENDIENTE e
//     intacta y se congela para que NUNCA se mute (regla 2): es el término de
//     comparación del diagnóstico.

// ── Constantes de dominio ────────────────────────────────────────────────────

/** SRS admitidos: Península + Baleares (husos 29/30/31). Canarias diferido. */
export const SRS_VALIDOS = Object.freeze(['EPSG:25829', 'EPSG:25830', 'EPSG:25831'])

/** Rama del expediente. */
export const TIPO_EXPEDIENTE = Object.freeze({ PARCELA: 'PARCELA', EDIFICIO: 'EDIFICIO' })

/** Tipo de recinto (anillo). `recintos[0]` es EXTERIOR; los huecos van después. */
export const TIPO_RECINTO = Object.freeze({ EXTERIOR: 'EXTERIOR', HUECO: 'HUECO' })

/** Procedencia de la geometría de la parcela. */
export const ORIGEN_PARCELA = Object.freeze({
  WFS: 'WFS',
  LIST: 'LIST',
  TXT: 'TXT',
  DXF: 'DXF',
  GML_EXISTENTE: 'GML_EXISTENTE',
})

// ── Helpers internos ─────────────────────────────────────────────────────────

const esNumeroFinito = (n) => typeof n === 'number' && Number.isFinite(n)

/**
 * Congela en profundidad un array de recintos (recinto → vertices → par [x,y]).
 * En modo estricto (todo módulo ESM lo es) cualquier intento de mutación lanza
 * TypeError: así "geometriaOficial NUNCA se muta" deja de ser una promesa y pasa
 * a ser una barrera comprobable.
 */
function deepFreeze(valor) {
  if (Array.isArray(valor)) {
    for (const el of valor) deepFreeze(el)
    return Object.freeze(valor)
  }
  if (valor && typeof valor === 'object') {
    for (const k of Object.keys(valor)) deepFreeze(valor[k])
    return Object.freeze(valor)
  }
  return valor
}

/**
 * Valida la invariante estructural: si hay recintos, `recintos[0]` es EXTERIOR y
 * todos los demás son HUECO (multiparcela está fuera de alcance). Lanza —de
 * forma NO silenciosa— si detecta algo raro (regla 1).
 */
function validarInvarianteExterior(recintos, contexto) {
  if (recintos.length === 0) return
  if (recintos[0].tipo !== TIPO_RECINTO.EXTERIOR) {
    throw new Error(
      `${contexto}: recintos[0] debe ser el EXTERIOR (regla del modelo §4.3); ` +
        `recibido tipo='${recintos[0].tipo}'.`,
    )
  }
  for (let i = 1; i < recintos.length; i++) {
    if (recintos[i].tipo !== TIPO_RECINTO.HUECO) {
      throw new Error(
        `${contexto}: recintos[${i}] debe ser HUECO (sólo recintos[0] es EXTERIOR; ` +
          `multiparcela está fuera de alcance); recibido tipo='${recintos[i].tipo}'.`,
      )
    }
  }
}

// ── Factories ────────────────────────────────────────────────────────────────

/**
 * Crea un Recinto (anillo) a partir de sus vértices UTM.
 *
 * - Copia DEFENSIVA de `vertices` como `[[x, y], ...]`: el objeto devuelto no
 *   comparte referencias con la entrada.
 * - Si el anillo llega CERRADO (primer vértice repetido al final), se normaliza
 *   a anillo abierto quitando el duplicado, avisando por `console.warn`
 *   (regla 1: ningún error silencioso).
 *
 * @param {Array<[number, number]>} vertices - Pares UTM `[x, y]` (Este, Norte).
 * @param {'EXTERIOR'|'HUECO'} [tipo='EXTERIOR']
 * @returns {{ vertices: [number, number][], tipo: string }}
 */
export function crearRecinto(vertices, tipo = TIPO_RECINTO.EXTERIOR) {
  if (!Array.isArray(vertices)) {
    throw new TypeError(
      `crearRecinto: 'vertices' debe ser un array de pares [x,y]; recibido ${typeof vertices}.`,
    )
  }
  const tiposValidos = Object.values(TIPO_RECINTO)
  if (!tiposValidos.includes(tipo)) {
    throw new RangeError(
      `crearRecinto: 'tipo' inválido: ${JSON.stringify(tipo)}. Válidos: ${tiposValidos.join(', ')}.`,
    )
  }

  const copia = vertices.map((v, i) => {
    if (!Array.isArray(v) || v.length < 2 || !esNumeroFinito(v[0]) || !esNumeroFinito(v[1])) {
      throw new TypeError(
        `crearRecinto: el vértice ${i} no es un par UTM [x,y] de números finitos: ${JSON.stringify(v)}.`,
      )
    }
    return [v[0], v[1]]
  })

  // Normalizar anillo cerrado → abierto, NUNCA en silencio (regla 4 + regla 1).
  if (copia.length >= 2) {
    const primero = copia[0]
    const ultimo = copia[copia.length - 1]
    if (primero[0] === ultimo[0] && primero[1] === ultimo[1]) {
      copia.pop()
      console.warn(
        `crearRecinto: anillo recibido CERRADO (vértice de cierre repetido); ` +
          `normalizado a anillo abierto (regla de oro 4): ${copia.length + 1} → ${copia.length} vértices.`,
      )
    }
  }

  return { vertices: copia, tipo }
}

/**
 * Crea una Parcela (POJO plano).
 *
 * @param {object} args
 * @param {string} args.idLocal - Identificador local (obligatorio).
 * @param {string|null} [args.refcat=null] - Referencia catastral.
 * @param {Array} [args.recintos=[]] - `recintos[0]` debe ser el EXTERIOR.
 * @param {Array|null} [args.geometriaOficial=null] - La del WFS; se guarda intacta.
 * @param {number|null} [args.superficieRegistral=null]
 * @param {string} args.origen - Uno de ORIGEN_PARCELA (obligatorio).
 * @returns {object} Parcela
 */
export function crearParcela({
  idLocal,
  refcat = null,
  recintos = [],
  geometriaOficial = null,
  superficieRegistral = null,
  origen,
} = {}) {
  if (typeof idLocal !== 'string' || idLocal.length === 0) {
    throw new TypeError(
      `crearParcela: 'idLocal' es obligatorio (string no vacío); recibido ${JSON.stringify(idLocal)}.`,
    )
  }
  const origenesValidos = Object.values(ORIGEN_PARCELA)
  if (!origenesValidos.includes(origen)) {
    throw new RangeError(
      `crearParcela: 'origen' inválido: ${JSON.stringify(origen)}. Válidos: ${origenesValidos.join(', ')}.`,
    )
  }
  if (refcat !== null && typeof refcat !== 'string') {
    throw new TypeError(`crearParcela: 'refcat' debe ser string o null; recibido ${typeof refcat}.`)
  }
  if (superficieRegistral !== null && !esNumeroFinito(superficieRegistral)) {
    throw new TypeError(
      `crearParcela: 'superficieRegistral' debe ser número finito o null; recibido ${JSON.stringify(superficieRegistral)}.`,
    )
  }
  if (!Array.isArray(recintos)) {
    throw new TypeError(`crearParcela: 'recintos' debe ser un array; recibido ${typeof recintos}.`)
  }

  // Copia defensiva + normalización de cada recinto.
  const recintosCopia = recintos.map((r) => crearRecinto(r.vertices, r.tipo))
  validarInvarianteExterior(recintosCopia, 'crearParcela.recintos')

  // geometriaOficial: copia INDEPENDIENTE (no comparte referencias con recintos
  // aunque se pase el mismo array) e intacta; se congela para blindar regla 2.
  let geoOficial = null
  if (geometriaOficial !== null) {
    if (!Array.isArray(geometriaOficial)) {
      throw new TypeError(
        `crearParcela: 'geometriaOficial' debe ser un array de recintos o null; recibido ${typeof geometriaOficial}.`,
      )
    }
    geoOficial = geometriaOficial.map((r) => crearRecinto(r.vertices, r.tipo))
    validarInvarianteExterior(geoOficial, 'crearParcela.geometriaOficial')
    deepFreeze(geoOficial)
  }

  return {
    idLocal,
    refcat,
    recintos: recintosCopia,
    geometriaOficial: geoOficial,
    superficieRegistral,
    origen,
  }
}

/**
 * Crea un Expediente (POJO plano) — la raíz del modelo. Porta UNA rama según
 * `tipo`: `parcela` (PARCELA) o `edificio` (EDIFICIO); mezclar ramas LANZA
 * (regla 1; auditoría A5: antes el tipo EDIFICIO era un cascarón sin rama).
 *
 * @param {object} [args]
 * @param {'PARCELA'|'EDIFICIO'} [args.tipo='PARCELA']
 * @param {string} [args.srs='EPSG:25830'] - Uno de SRS_VALIDOS.
 * @param {string} [args.autor='']
 * @param {string} [args.idDocumento='']
 * @param {object} [args.metadatos] - `{ creado, modificado, autor, idDocumento }`;
 *        cada campo ausente se completa (autor/idDocumento desde sus params;
 *        creado/modificado con la marca de tiempo actual).
 * @param {object|null} [args.parcela=null] - Solo tipo PARCELA. Se copia vía
 *        crearParcela (validación + copia independiente).
 * @param {object|null} [args.edificio=null] - Solo tipo EDIFICIO. Construido con
 *        `model/edificio.js#crearEdificio` (dueño de su validación; las ramas del
 *        modelo no se importan entre sí): aquí solo copia estructural profunda.
 * @returns {object} Expediente
 */
export function crearExpediente({
  tipo = TIPO_EXPEDIENTE.PARCELA,
  srs = 'EPSG:25830',
  autor = '',
  idDocumento = '',
  metadatos = null,
  parcela = null,
  edificio = null,
} = {}) {
  const tiposValidos = Object.values(TIPO_EXPEDIENTE)
  if (!tiposValidos.includes(tipo)) {
    throw new RangeError(
      `crearExpediente: 'tipo' inválido: ${JSON.stringify(tipo)}. Válidos: ${tiposValidos.join(', ')}.`,
    )
  }
  if (!SRS_VALIDOS.includes(srs)) {
    throw new RangeError(
      `crearExpediente: 'srs' inválido: ${JSON.stringify(srs)}. Válidos: ${SRS_VALIDOS.join(', ')}.`,
    )
  }
  // Exclusividad de rama por tipo (regla 1: nada de estados incoherentes mudos).
  if (tipo === TIPO_EXPEDIENTE.PARCELA && edificio !== null) {
    throw new Error(`crearExpediente: un expediente de tipo PARCELA no puede llevar rama 'edificio'.`)
  }
  if (tipo === TIPO_EXPEDIENTE.EDIFICIO && parcela !== null) {
    throw new Error(`crearExpediente: un expediente de tipo EDIFICIO no puede llevar rama 'parcela'.`)
  }
  if (edificio !== null) {
    // Chequeo estructural ligero; la validación de dominio vive en crearEdificio.
    if (typeof edificio !== 'object' || !Array.isArray(edificio.partes) || typeof edificio.modelo !== 'string') {
      throw new TypeError(
        `crearExpediente: 'edificio' debe ser un Edificio de crearEdificio ` +
          `({modelo, partes[], ...}) o null; recibido ${JSON.stringify(edificio)}.`,
      )
    }
  }

  const meta = metadatos ?? {}
  const ahora = new Date().toISOString()
  const metadatosOut = {
    creado: meta.creado ?? ahora,
    modificado: meta.modificado ?? ahora,
    autor: meta.autor ?? autor,
    idDocumento: meta.idDocumento ?? idDocumento,
  }

  // Copia profunda independiente de la rama edificio. structuredClone NO
  // preserva Object.freeze, así que se RE-congela `construccionOficial` para
  // mantener la barrera de la regla 2 también en la copia del expediente.
  let edificioCopia = null
  if (edificio !== null) {
    edificioCopia = structuredClone(edificio)
    if (edificioCopia.construccionOficial != null) deepFreeze(edificioCopia.construccionOficial)
  }

  return {
    tipo,
    srs,
    metadatos: metadatosOut,
    parcela: parcela === null ? null : crearParcela(parcela),
    edificio: edificioCopia,
  }
}
