// derivacion/entrega-expediente.js — F25 · fase 4 · EL FICHERO DE LAS PARCELAS DEL EXPEDIENTE.
//
// `derivacion/entrega.js` arma el expediente que el PROGRAMA deriva de una parcela
// editada —la matriz, su sobrante y los vecinos que recorta—. Esto arma el que el
// TÉCNICO ha compuesto a mano en «Parcelas del expediente»: las que haya elegido, cada
// una tal como la ha dejado. Las preguntas son las mismas y las respuestas se piden a
// los mismos sitios —`validation/parcela.js`, `comprobacion/conjunto.js`,
// `derivacion/operacion.js`, `gml/serialize-cp.js`—; lo que cambia es de dónde salen
// las parcelas.
//
// ── QUÉ BLOQUEA, Y POR QUÉ NO TODO LO QUE BLOQUEA F17 ───────────────────────
//   · Una parcela que no pasa la validación ........ SIEMPRE (no se puede escribir).
//   · Dos que saldrían con el mismo `localId` ...... SIEMPRE (los `gml:id` chocarían).
//   · Dos que se PISAN ............................. SIEMPRE: dos fincas de un mismo
//     envío no pueden ocupar el mismo suelo, sea cual sea la operación.
//   · Que el conjunto no CIERRE sobre lo oficial ... SOLO si la forma del envío es la
//     de una Segregación (hay altas). Es lo que F17 exige, y por lo mismo: repartir
//     suelo oficial entre fincas nuevas obliga a aportarlo todo o el IVG sale negativo.
//     Un envío de parcelas oficiales corregidas es una Subsanación, y ahí cada una se
//     sostiene sola —que la medición no coincida con el contorno es el caso normal de
//     esta herramienta, y eso lo mide el diagnóstico, no esto—.
//
// Qué operación es lo PROPONE `derivacion/operacion.js` por la forma del fichero, y
// la decide quien firma (regla de oro 9). Aquí solo se usa para saber qué afirmar.
//
// Módulo puro: sin DOM, sin red, sin reloj. Devuelve el XML; quien descarga es la
// aplicación (la misma frontera que `entrega.js`, M15 de F17).

import { comprobarConjunto } from '../comprobacion/conjunto.js'
import { serializarExpedienteCp } from '../gml/serialize-cp.js'
import { validarParcela } from '../validation/parcela.js'
import { SEVERIDAD, TIPO_DERIVACION, crearDeteccionDerivacion, numero, resumirDetecciones } from './_comun.js'
import { identidadDeMiembro } from './identidad.js'
import { tipoDeOperacion } from './operacion.js'

/**
 * @typedef {Object} MiembroDelEnvio
 * @property {string} idLocal
 * @property {string} etiqueta  Cómo se nombra en los mensajes: su `localId`.
 * @property {import('./identidad.js').IdentidadInspire} identidad
 * @property {{errores: object[], avisos: object[], puedeGenerar: boolean}} validacion
 */

/**
 * @typedef {Object} EntregaExpediente
 * @property {boolean} puedeEntregarse  Lo que hay que mirar, no `xml !== null`.
 * @property {string[]} bloqueos  Tipos de las detecciones ERROR, sin repetir.
 * @property {string|null} xml
 * @property {number} nMiembros
 * @property {string|null} refcat  La de la PRINCIPAL, para el nombre del fichero.
 * @property {MiembroDelEnvio[]} miembros
 * @property {import('./operacion.js').OperacionPropuesta|null} operacion
 * @property {import('../comprobacion/conjunto.js').ComprobacionConjunto|null} cierre
 * @property {object[]} detecciones
 * @property {object[]} deteccionesGml  Lo que decidió el escritor, para el panel.
 * @property {object} resumen
 */

const texto = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

/**
 * Arma el fichero de las parcelas elegidas.
 *
 * @param {object} entrada
 * @param {object[]} entrada.parcelas  Las parcelas que van al fichero, EN ORDEN (el del
 *   expediente). Cada una, una `Parcela` del modelo.
 * @param {object|null} [entrada.principal=null]  La parcela principal del expediente:
 *   de ella sale la identidad de las piezas del sobrante y el nombre del fichero.
 * @param {string} entrada.srs  Forma corta (`'EPSG:25830'`…).
 * @returns {EntregaExpediente}
 * @throws {TypeError|RangeError}  Contrato del programador: sin parcelas no hay envío.
 */
export function prepararEntregaExpediente({ parcelas, principal = null, srs } = {}) {
  if (!Array.isArray(parcelas) || parcelas.length === 0) {
    throw new RangeError(
      'prepararEntregaExpediente: hace falta al menos una parcela. Un envío vacío no es un ' +
        'fichero que se pueda presentar, y quien lo pide tendría que haberlo impedido antes.',
    )
  }
  if (typeof srs !== 'string' || srs === '') {
    throw new TypeError(`prepararEntregaExpediente: 'srs' es obligatorio; recibido ${JSON.stringify(srs)}.`)
  }

  const detecciones = []
  const refcatPrincipal = texto(principal?.refcat)

  // ── 1 · Identidad y validación, parcela a parcela ─────────────────────────
  const miembros = parcelas.map((p) => {
    const identidad = identidadDeMiembro(p, { principal })
    return {
      idLocal: p.idLocal,
      etiqueta: identidad.refcat,
      identidad,
      recintos: p.recintos,
      validacion: validarParcela(p.recintos, { srs }),
    }
  })

  for (const m of miembros) {
    if (m.validacion.puedeGenerar) continue
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.PIEZA_INVALIDA,
        `«${m.etiqueta}» no pasa la validación geométrica: ` +
          `${m.validacion.errores.map((e) => e.mensaje).join(' ')} Ponla en edición y corrígela, ` +
          'o déjala fuera de la selección.',
        SEVERIDAD.ERROR,
        { idLocal: m.idLocal, errores: m.validacion.errores },
      ),
    )
  }

  // Dos que saldrían con el mismo `localId`. Pasa, por ejemplo, con una colindante
  // añadida y la misma finca traída otra vez por otra puerta: el expediente las
  // distingue por `idLocal`, pero el fichero las nombraría igual.
  const porLocalId = new Map()
  for (const m of miembros) {
    const clave = m.identidad.refcat
    porLocalId.set(clave, [...(porLocalId.get(clave) ?? []), m.idLocal])
  }
  for (const [localId, idLocales] of porLocalId) {
    if (idLocales.length < 2) continue
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.IDENTIDAD_REPETIDA,
        `${idLocales.length} parcelas de la selección saldrían en el fichero con el mismo ` +
          `identificador, «${localId}». Deja solo una de ellas en la selección.`,
        SEVERIDAD.ERROR,
        { localId, idLocales },
      ),
    )
  }

  const operacion = tipoDeOperacion(miembros.map((m) => m.identidad))
  const salida = { nMiembros: miembros.length, refcat: refcatPrincipal ?? texto(parcelas[0].refcat), miembros, operacion }
  const esBloqueo = (d) => d.severidad === SEVERIDAD.ERROR
  const cerrar = (extra = {}) => {
    const bloqueos = [...new Set(detecciones.filter(esBloqueo).map((d) => d.tipo))]
    return {
      puedeEntregarse: bloqueos.length === 0,
      bloqueos,
      xml: null,
      cierre: null,
      deteccionesGml: [],
      ...salida,
      ...extra,
      detecciones,
      resumen: resumirDetecciones(detecciones),
    }
  }
  if (detecciones.some(esBloqueo)) return cerrar()

  // ── 2 · Solapes, y el cierre cuando toca ──────────────────────────────────
  // La diana es TODO lo oficial que la selección modifica: el contorno oficial de
  // cada parcela que lo tiene (F23 ya enseñó que con uno solo un vecino modificado
  // saldría como superficie que sobra). Sin ninguna oficial no hay diana, pero los
  // solapes entre parcelas se miden igual: se le da como diana la primera, y de la
  // comprobación solo se lee `solapes`.
  const oficiales = parcelas.filter((p) => Array.isArray(p.geometriaOficial) && p.geometriaOficial.length > 0)
  const diana = oficiales.length > 0 ? oficiales[0].geometriaOficial : parcelas[0].recintos
  let cierre = null
  try {
    cierre = comprobarConjunto({
      geometriaOficial: diana,
      oficialesExtra: oficiales.slice(1).map((p) => ({ etiqueta: texto(p.refcat) ?? p.idLocal, recintos: p.geometriaOficial })),
      miembros: miembros.map((m) => ({ etiqueta: m.etiqueta, recintos: m.recintos })),
    })
  } catch (causa) {
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.CONJUNTO_NO_CIERRA,
        `No se ha podido comprobar el conjunto: ${causa?.message ?? causa}. Eso NO es que esté ` +
          'bien: es que no se sabe, y presentarlo así sería firmarlo a ciegas.',
        SEVERIDAD.ERROR,
        {},
      ),
    )
    return cerrar()
  }

  if (cierre.solapes.cumple === false) {
    const pares = cierre.solapes.pares.map((p) => `«${p.a}» y «${p.b}» (${numero(p.area)} m²)`).join('; ')
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.PARCELAS_SE_PISAN,
        `Hay parcelas de la selección que se pisan: ${pares}. Dos fincas del mismo envío no ` +
          'pueden ocupar el mismo suelo; ajusta el lindero que comparten.',
        SEVERIDAD.ERROR,
        { pares: cierre.solapes.pares },
      ),
    )
  }

  const esSegregacion = operacion.tipo === 'SEGREGACION'
  const exigeCierre = esSegregacion && oficiales.length > 0
  if (exigeCierre && cierre.cierra !== true && cierre.solapes.cumple !== false) {
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.CONJUNTO_NO_CIERRA,
        cierre.cierra === null
          ? 'No se ha podido comprobar que las parcelas cubran el contorno oficial. Eso NO es que ' +
            'cierre: es que no se sabe.'
          : `Es un envío con forma de Segregación y las parcelas no cubren exactamente lo oficial ` +
            `que modifican (${numero(cierre.suma.areaOficial)} m² oficiales; las parcelas suman ` +
            `${numero(cierre.suma.areaMiembros)} m²). El IVG lo devolvería negativo: falta o sobra ` +
            'alguna parcela en la selección, o un lindero no coincide.',
        SEVERIDAD.ERROR,
        { cierra: cierre.cierra, suma: cierre.suma, cobertura: { area: cierre.cobertura.area } },
      ),
    )
  }
  if (detecciones.some(esBloqueo)) return cerrar({ cierre: oficiales.length > 0 ? cierre : null })

  // ── 3 · El fichero ────────────────────────────────────────────────────────
  const { xml, detecciones: deteccionesGml, resumen: resumenGml } = serializarExpedienteCp({
    parcelas: miembros.map((m) => ({ ...m.identidad, recintos: m.recintos, srs })),
  })
  if (xml === null) {
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.PIEZA_INVALIDA,
        `El escritor de GML no ha podido emitir el fichero: ${resumenGml.bloqueos.join(', ')}. ` +
          'El detalle, parcela por parcela, está en los avisos que siguen a éste.',
        SEVERIDAD.ERROR,
        { bloqueos: resumenGml.bloqueos },
      ),
    )
    return cerrar({ cierre: oficiales.length > 0 ? cierre : null, deteccionesGml })
  }

  detecciones.push(
    crearDeteccionDerivacion(
      TIPO_DERIVACION.ENTREGA_LISTA,
      `El fichero sale con ${miembros.length} ${miembros.length === 1 ? 'parcela' : 'parcelas'}: ` +
        'cada una pasa la validación geométrica y ninguna pisa a otra' +
        (exigeCierre ? ` y entre todas cubren los ${numero(cierre.suma.areaOficial)} m² oficiales.` : '.'),
      SEVERIDAD.INFO,
      { nMiembros: miembros.length, tipoOperacion: operacion.tipo },
    ),
  )
  return cerrar({ cierre: oficiales.length > 0 ? cierre : null, deteccionesGml, xml })
}

export default prepararEntregaExpediente
